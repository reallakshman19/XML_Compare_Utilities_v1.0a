/** Deterministic self-contained transfer handover bundle. */
import { assertJsonSafe, deepFreeze } from './revision-contract-utils.js';
import { canonicalRevisionCompareEvidenceValue } from './revision-evidence-package.js';
import { sha256Text } from './revision-hash.js';
import { REVISION_COMPARE_TRANSFER_COMPLETION_REPORT_SCHEMA } from './revision-transfer-completion.js';

export const REVISION_COMPARE_TRANSFER_HANDOVER_BUNDLE_SCHEMA = 'RevisionCompareTransferHandoverBundle.v1';
export const REVISION_COMPARE_TRANSFER_HANDOVER_ID_PREFIX = 'revision-transfer-handover:';
const ROOT_KEYS = Object.freeze(['schema', 'identity', 'payload', 'validation', 'bundleId', 'contentSha256']);
const IDENTITY_KEYS = Object.freeze(['sessionId', 'evidencePackageId', 'completionReportId', 'planId', 'resultId', 'originalTargetSha256', 'patchedTargetSha256']);
const PAYLOAD_KEYS = Object.freeze(['evidencePackage', 'transferPlan', 'transferResult', 'transferAudit', 'transferProof', 'transferManifest', 'transferArtifacts', 'completionReport']);
const PLAN_KEYS = Object.freeze(['schema', 'direction', 'sourceDocument', 'receiverDocument', 'scope', 'comparisonBasis', 'audit', 'reviewSession', 'decisionLedger', 'activity', 'selection', 'policyVersion', 'operations', 'summary', 'status', 'blockers', 'planId', 'contentSha256']);
const DOCUMENT_KEYS = Object.freeze(['schema', 'side', 'documentId', 'contentSha256', 'fileName', 'rootKind', 'profile']);
const BASIS_KEYS = Object.freeze(['basisId', 'revADocumentId', 'revBDocumentId', 'revAContentHash', 'revBContentHash']);
const AUDIT_AUTHORITY_KEYS = Object.freeze(['auditId', 'basisId', 'revADocumentId', 'revBDocumentId', 'engineVersion']);
const REVIEW_AUTHORITY_KEYS = Object.freeze(['reviewSessionId', 'auditId', 'basisId', 'revision', 'status', 'importError', 'replacementRequired']);
const DECISION_AUTHORITY_KEYS = Object.freeze(['ledgerId', 'auditId', 'basisId', 'revision', 'status', 'importError', 'replacementRequired']);
const OPERATION_KEYS = Object.freeze(['schema', 'operationType', 'expectedTargetState', 'sourceDocumentId', 'sourceDocumentSha256', 'targetDocumentId', 'targetDocumentSha256', 'sourceEntityId', 'targetEntityId', 'sourceCanonicalPath', 'targetCanonicalPath', 'fieldPath', 'afterValue', 'valueType', 'transferPolicy', 'targetAddress', 'evidenceReferences', 'operationId', 'status', 'blockers']);
const ADDRESS_KEYS = Object.freeze(['schema', 'targetDocumentId', 'targetDocumentSha256', 'targetEntityId', 'entityCanonicalPath', 'fieldPath', 'expectedTargetState', 'expectedEntitySha256']);
function copy(value, path) { return deepFreeze(canonicalRevisionCompareEvidenceValue(JSON.parse(JSON.stringify(value)), path)); }
function exactKeys(value, required, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be a plain JSON object.`);
  const keys = Object.keys(value); const allowed = new Set(required);
  if (required.some((key) => !Object.hasOwn(value, key)) || keys.some((key) => !allowed.has(key))) throw new TypeError(`${label} contains unsupported or missing fields.`);
}
function validateSelection(selection) {
  exactKeys(selection, ['schema', 'direction', 'selectionRevision', 'items'], 'Transfer selection');
  if (!Array.isArray(selection.items)) throw new TypeError('Transfer selection items must be an array.');
  selection.items.forEach((item, index) => {
    exactKeys(item, ['differenceId', 'sourceRecordId', 'targetRecordId', 'fields'], `Transfer selection item ${index}`);
    if (!Array.isArray(item.fields)) throw new TypeError(`Transfer selection item ${index} fields must be an array.`);
    item.fields.forEach((field, fieldIndex) => exactKeys(field, ['propertyKey', 'revAEvidencePath', 'revBEvidencePath', 'targetFieldPath'], `Transfer selection field ${index}:${fieldIndex}`));
  });
}
function validateOperation(operation, index) {
  const present = operation?.expectedTargetState === 'PRESENT';
  exactKeys(operation, present ? [...OPERATION_KEYS, 'beforeValue'] : OPERATION_KEYS, `Transfer operation ${index}`);
  exactKeys(operation.transferPolicy, ['schema', 'policyVersion', 'propertyKey', 'fieldPath', 'classification', 'ruleId', 'writable', 'blockers'], `Transfer operation ${index} policy`);
  exactKeys(operation.targetAddress, present ? [...ADDRESS_KEYS, 'expectedCurrentValue'] : ADDRESS_KEYS, `Transfer operation ${index} address`);
  exactKeys(operation.evidenceReferences, ['differenceId', 'auditId', 'reviewSessionId', 'reviewRevision', 'decisionLedgerId', 'decisionRevision', 'decisionEventId', 'revAEvidencePath', 'revBEvidencePath'], `Transfer operation ${index} evidence references`);
}
function validatePlan(plan) {
  exactKeys(plan, PLAN_KEYS, 'Transfer plan');
  exactKeys(plan.sourceDocument, DOCUMENT_KEYS, 'Transfer plan source document');
  exactKeys(plan.receiverDocument, DOCUMENT_KEYS, 'Transfer plan receiver document');
  exactKeys(plan.scope, ['proposalId', 'basisStatus'], 'Transfer plan scope');
  exactKeys(plan.comparisonBasis, BASIS_KEYS, 'Transfer plan comparison basis');
  exactKeys(plan.audit, AUDIT_AUTHORITY_KEYS, 'Transfer plan audit authority');
  exactKeys(plan.reviewSession, REVIEW_AUTHORITY_KEYS, 'Transfer plan review authority');
  exactKeys(plan.decisionLedger, DECISION_AUTHORITY_KEYS, 'Transfer plan decision authority');
  exactKeys(plan.activity, ['revAIntakeStatus', 'revBIntakeStatus', 'comparisonStatus'], 'Transfer plan activity');
  exactKeys(plan.summary, ['selectedItemCount', 'operationCount', 'readyOperationCount', 'blockedOperationCount', 'replaceExistingCount', 'addMissingCount'], 'Transfer plan summary');
  validateSelection(plan.selection);
  if (!Array.isArray(plan.operations)) throw new TypeError('Transfer plan operations must be an array.');
  plan.operations.forEach(validateOperation);
}
function validateRevisionCompareTransferHandoverContractShapes(bundle) {
  exactKeys(bundle, ROOT_KEYS, 'Transfer handover bundle');
  exactKeys(bundle.identity, IDENTITY_KEYS, 'Transfer handover identity');
  exactKeys(bundle.payload, PAYLOAD_KEYS, 'Transfer handover payload');
  exactKeys(bundle.validation, ['status', 'errors'], 'Transfer handover validation');
  validatePlan(bundle.payload.transferPlan); return bundle;
}
export function revisionCompareTransferHandoverHashMaterial(value) { return copy({ schema: value?.schema, identity: value?.identity, payload: value?.payload, validation: value?.validation }, 'transferHandoverHashMaterial'); }
export async function createRevisionCompareTransferHandoverBundle(input, options = {}) {
  const cryptoRef = options.cryptoRef ?? globalThis.crypto; const workspace = input.workspace;
  if (input.report?.schema !== REVISION_COMPARE_TRANSFER_COMPLETION_REPORT_SCHEMA) throw new TypeError('A current RevisionCompareTransferCompletionReport.v1 is required.');
  const transfer = workspace?.transfer;
  if (!transfer?.plan || !transfer?.result || !transfer?.audit || !transfer?.proof || !transfer?.manifest || transfer?.artifacts?.length !== 4) throw new Error('Complete retained transfer evidence is required for handover.');
  const material = revisionCompareTransferHandoverHashMaterial({
    schema: REVISION_COMPARE_TRANSFER_HANDOVER_BUNDLE_SCHEMA,
    identity: { sessionId: workspace.session.sessionId, evidencePackageId: input.evidencePackage.packageId, completionReportId: input.report.reportId, planId: transfer.plan.planId, resultId: transfer.result.resultId, originalTargetSha256: transfer.result.originalTargetSha256, patchedTargetSha256: transfer.result.patchedTargetSha256 },
    payload: { evidencePackage: input.evidencePackage, transferPlan: transfer.plan, transferResult: transfer.result, transferAudit: transfer.audit, transferProof: transfer.proof, transferManifest: transfer.manifest, transferArtifacts: transfer.artifacts, completionReport: input.report },
    validation: { status: 'READY', errors: [] },
  });
  const hash = await sha256Text(JSON.stringify(material), cryptoRef);
  const bundle = copy({ ...material, bundleId: `${REVISION_COMPARE_TRANSFER_HANDOVER_ID_PREFIX}${hash}`, contentSha256: hash }, REVISION_COMPARE_TRANSFER_HANDOVER_BUNDLE_SCHEMA);
  assertJsonSafe(bundle, REVISION_COMPARE_TRANSFER_HANDOVER_BUNDLE_SCHEMA); return bundle;
}
export async function validateRevisionCompareTransferHandoverBundleIdentity(bundle, cryptoRef = globalThis.crypto) {
  if (bundle?.schema !== REVISION_COMPARE_TRANSFER_HANDOVER_BUNDLE_SCHEMA) throw new TypeError(`A ${REVISION_COMPARE_TRANSFER_HANDOVER_BUNDLE_SCHEMA} is required.`);
  validateRevisionCompareTransferHandoverContractShapes(bundle);
  const hash = await sha256Text(JSON.stringify(revisionCompareTransferHandoverHashMaterial(bundle)), cryptoRef);
  if (bundle.contentSha256 !== hash || bundle.bundleId !== `${REVISION_COMPARE_TRANSFER_HANDOVER_ID_PREFIX}${hash}`) throw new Error('Transfer handover bundle identity does not recompute.');
  return bundle;
}
export function serializeRevisionCompareTransferHandoverBundle(bundle) { if (bundle?.schema !== REVISION_COMPARE_TRANSFER_HANDOVER_BUNDLE_SCHEMA) throw new TypeError(`A ${REVISION_COMPARE_TRANSFER_HANDOVER_BUNDLE_SCHEMA} is required.`); return `${JSON.stringify(canonicalRevisionCompareEvidenceValue(bundle), null, 2)}\n`; }
export function revisionCompareTransferHandoverFileName(sessionId, bundleId) { const safe = (value) => String(value ?? '').trim().replace(/[^A-Za-z0-9._-]/g, '_'); if (!safe(sessionId) || !safe(bundleId)) throw new TypeError('Session ID and bundle ID are required.'); return `${safe(sessionId)}.${safe(bundleId)}.json`; }
export const _test = Object.freeze({ copy });