/** Deterministic patched-target completion authority and cross-evidence validation. */
import { assertJsonSafe, deepFreeze, stableStringify } from './revision-contract-utils.js';
import {
  canonicalRevisionCompareEvidenceValue, REVISION_COMPARE_EVIDENCE_PACKAGE_SCHEMA,
  revisionCompareEvidencePackageHashMaterial, revisionCompareEvidencePackageReadiness,
} from './revision-evidence-package.js';
import { sha256Text } from './revision-hash.js';
import { DECISION_LEDGER_SCHEMA, decisionSummary } from './revision-decision-contracts.js';
import { REVIEW_SESSION_SCHEMA, reviewSummary } from './revision-review-contracts.js';
import {
  captureRevisionCompareTransferAuthority, revisionCompareTransferPlanAuthority,
} from './revision-transfer-contracts.js';

export const REVISION_COMPARE_TRANSFER_COMPLETION_REPORT_SCHEMA = 'RevisionCompareTransferCompletionReport.v1';
export const REVISION_COMPARE_TRANSFER_COMPLETION_ID_PREFIX = 'revision-transfer-completion:';
export const REVISION_COMPARE_TRANSFER_COMPLETION_DECLARATION = 'I confirm that the recorded Revision Compare review is complete and that the patched Rev B identified by this report was produced by the current deterministic transfer plan and verification evidence.';
export const REVISION_COMPARE_TRANSFER_COMPLETION_TRUST_STATEMENT = 'This is a self-declared transfer completion record. Declarant identity, organizational authority and cryptographic authenticity are not established.';
const SCHEMAS = Object.freeze({ plan: 'RevisionCompareTransferPlan.v1', result: 'RevisionCompareTransferResult.v1', audit: 'RevisionCompareTransferAudit.v1', proof: 'RevisionCompareTransferProof.v1', manifest: 'RevisionCompareTransferManifest.v1', artifact: 'RevisionCompareTransferArtifact.v1' });
const PREFIXES = Object.freeze({ plan: 'revision-transfer-plan:', result: 'revision-transfer-result:', audit: 'revision-transfer-audit:', proof: 'revision-transfer-proof:', manifest: 'revision-transfer-manifest:' });

function equal(left, right) { return stableStringify(left) === stableStringify(right); }
function without(value, keys) { return Object.fromEntries(Object.entries(value ?? {}).filter(([key]) => !keys.includes(key))); }
function byteSize(text) { return new TextEncoder().encode(String(text)).byteLength; }
function activeComparison(state) { return ['PROJECTING', 'COMPARING', 'BUILDING_VISUAL'].includes(state?.compare?.status); }
function activeImport(value) { return Boolean(value?.request || value?.importRequest || value?.importing || value?.status === 'IMPORTING'); }
function proofReady(proof) { const values = Object.values(proof?.invariants ?? {}); return proof?.schema === SCHEMAS.proof && proof.status === 'READY' && values.length > 0 && values.every((value) => value === true); }

function reviewBlockers(state, blockers) {
  const session = state?.review?.session;
  if (session?.schema !== REVIEW_SESSION_SCHEMA) blockers.push('Patched-target completion requires a ReviewSession.v1.');
  else if (session.status !== 'CURRENT') blockers.push('Patched-target completion requires a CURRENT review session.');
  if (!Array.isArray(session?.items) || !equal(session?.summary, reviewSummary(session?.items))) blockers.push('Review summary does not reconcile with retained review items.');
  if (session?.items?.some((item) => item.reviewState !== 'REVIEWED')) blockers.push('Every review item must be REVIEWED before patched-target completion.');
}
function decisionBlockers(state, blockers) {
  const ledger = state?.decision?.ledger;
  if (ledger?.schema !== DECISION_LEDGER_SCHEMA) blockers.push('Patched-target completion requires an AmbiguityDecisionLedger.v1.');
  else if (ledger.status !== 'CURRENT') blockers.push('Patched-target completion requires a CURRENT decision ledger.');
  if (!Array.isArray(ledger?.decisions) || !equal(ledger?.summary, decisionSummary(ledger?.decisions))) blockers.push('Decision summary does not reconcile with retained decision items.');
  if (ledger?.decisions?.some((item) => !['ACCEPTED_CANDIDATE', 'CONFIRMED_NO_MATCH'].includes(item.decisionState))) blockers.push('Every ambiguity decision must be resolved before patched-target completion.');
}
function transferBlockers(state, blockers) {
  const transfer = state?.transfer; const plan = transfer?.plan; const result = transfer?.result;
  if (transfer?.status !== 'APPLIED') blockers.push('Patched-target completion requires one current APPLIED transfer.');
  if (plan?.schema !== SCHEMAS.plan || plan.status !== 'READY') blockers.push('Patched-target completion requires one current READY transfer plan.');
  if (result?.schema !== SCHEMAS.result || result.status !== 'READY') blockers.push('Patched-target completion requires one current READY transfer result.');
  if (transfer?.audit?.schema !== SCHEMAS.audit || transfer.audit.status !== 'READY') blockers.push('Patched-target completion requires one current READY transfer audit.');
  if (!proofReady(transfer?.proof)) blockers.push('Patched-target completion requires a READY transfer proof with every invariant true.');
  if (transfer?.manifest?.schema !== SCHEMAS.manifest || (transfer.manifest.status && transfer.manifest.status !== 'READY')) blockers.push('Patched-target completion requires one current READY transfer manifest.');
  if (!transfer?.patchedSnapshot) blockers.push('Patched-target completion requires the retained patched target snapshot.');
  if (!Array.isArray(transfer?.artifacts) || transfer.artifacts.length !== 4 || transfer.artifacts.some((item) => item?.descriptorSchema !== SCHEMAS.artifact)) blockers.push('Patched-target completion requires exactly four current transfer artifact descriptors.');
  if (result && plan && (result.summary?.planOperationCount !== plan.operations?.length || result.summary?.appliedOperationCount !== plan.operations?.length)) blockers.push('Result operation counts must equal the current plan operation count.');
  if ((result?.summary?.skippedOperationCount ?? 1) !== 0) blockers.push('Patched-target completion requires zero skipped operations.');
  if ((result?.summary?.blockedOperationCount ?? 1) !== 0) blockers.push('Patched-target completion requires zero blocked operations.');
}
function activityBlockers(state, blockers) {
  if (state?.slots?.baseline?.status === 'LOADING' || state?.slots?.candidate?.status === 'LOADING') blockers.push('Wait for active revision source loading to finish.');
  if (activeComparison(state)) blockers.push('Wait for active comparison execution to finish.');
  if (state?.transfer?.request) blockers.push('Wait for the active transfer-plan request to finish.');
  if (state?.transfer?.applyRequest) blockers.push('Wait for the active transfer apply request to finish.');
  if (activeImport(state?.review)) blockers.push('Wait for active review import to finish.');
  if (activeImport(state?.decision)) blockers.push('Wait for active decision import to finish.');
  if (state?.evidencePackageImport?.status === 'IMPORTING') blockers.push('Wait for evidence-package verification to finish.');
}
export function revisionCompareTransferCompletionReadiness(state) {
  const blockers = []; const audit = state?.compare?.audit;
  if (state?.basisStatus !== 'CURRENT' || !state?.basis) blockers.push('Patched-target completion requires a CURRENT comparison basis.');
  if (audit?.schema !== 'RevisionCompareAudit.v1' || audit?.validation?.status !== 'READY') blockers.push('Patched-target completion requires a READY RevisionCompareAudit.v1.');
  reviewBlockers(state, blockers); decisionBlockers(state, blockers); transferBlockers(state, blockers); activityBlockers(state, blockers);
  const packageReadiness = revisionCompareEvidencePackageReadiness(state);
  if (packageReadiness.status !== 'READY') blockers.push(`Current evidence package is not recreatable: ${packageReadiness.blockers[0]}`);
  return deepFreeze({ status: blockers.length ? 'BLOCKED' : 'READY', blockers: Object.freeze(blockers) });
}

function normalizedField(value, label, maximum, required) { const text = String(value ?? '').trim(); if (required && !text) throw new RangeError(`${label} is required.`); if (text.length > maximum) throw new RangeError(`${label} is limited to ${maximum} characters.`); return text; }
export function normalizeRevisionCompareTransferCompletionDeclarant(input = {}) { return deepFreeze({ declarantName: normalizedField(input.declarantName, 'Declarant name', 120, true), declarantRole: normalizedField(input.declarantRole, 'Declarant role', 120, true), organization: normalizedField(input.organization, 'Organization', 160, false) }); }
function exactTimestamp(value) { const parsed = typeof value === 'string' && value ? new Date(value) : null; if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) throw new RangeError('declaredAt must be one injected ISO timestamp.'); return value; }

async function verifyIdentity(value, idKey, prefix, cryptoRef) { const hash = await sha256Text(stableStringify(without(value, [idKey, 'contentSha256'])), cryptoRef); if (value?.contentSha256 !== hash || value?.[idKey] !== `${prefix}${hash}`) throw new Error(`${value?.schema ?? idKey} content identity does not recompute.`); }
async function verifyEvidencePackage(packageValue, workspace, cryptoRef) {
  if (packageValue?.schema !== REVISION_COMPARE_EVIDENCE_PACKAGE_SCHEMA) throw new Error('Current evidence package recreation failed.');
  const hash = await sha256Text(JSON.stringify(revisionCompareEvidencePackageHashMaterial(packageValue)), cryptoRef);
  if (packageValue.contentSha256 !== hash || packageValue.packageId !== `revision-evidence-package:${hash}`) throw new Error('Evidence package identity does not recompute.');
  const identity = packageValue.identity; const payload = packageValue.payload;
  if (identity?.sessionId !== workspace.session?.sessionId || identity?.basisId !== workspace.basis?.basisId || identity?.auditId !== workspace.compare?.audit?.auditId || identity?.reviewSessionId !== workspace.review?.session?.reviewSessionId || identity?.decisionLedgerId !== workspace.decision?.ledger?.ledgerId) throw new Error('Recreated evidence package does not match current workspace identities.');
  if (!equal(payload?.sessionManifest?.session, workspace.session) || !equal(payload?.scopeBasisManifest?.basis, workspace.basis)) throw new Error('Recreated evidence package does not match current session or basis authority.');
  if (!equal(payload?.audit, workspace.compare.audit) || !equal(payload?.reviewSession, workspace.review.session) || !equal(payload?.decisionLedger, workspace.decision.ledger)) throw new Error('Recreated evidence package payload does not match current audit, review, or decision authority.');
}
function reference(artifact) { return { filename: artifact.filename, schema: artifact.schema, mimeType: artifact.mimeType, contentSha256: artifact.contentSha256, sizeBytes: artifact.sizeBytes }; }
function reportDescriptor(artifact) { return deepFreeze({ descriptorSchema: artifact.descriptorSchema, ...reference(artifact) }); }
async function verifyArtifacts(transfer, cryptoRef) {
  const artifacts = transfer.artifacts;
  for (const artifact of artifacts) { if (artifact.descriptorSchema !== SCHEMAS.artifact || artifact.mimeType !== 'application/json' || typeof artifact.text !== 'string') throw new Error('Transfer artifact descriptor is invalid.'); if (await sha256Text(artifact.text, cryptoRef) !== artifact.contentSha256) throw new Error(`Transfer artifact SHA-256 mismatch for ${artifact.filename}.`); if (byteSize(artifact.text) !== artifact.sizeBytes) throw new Error(`Transfer artifact byte-size mismatch for ${artifact.filename}.`); }
  const [patched, auditArtifact, proofArtifact, manifestArtifact] = artifacts;
  if (patched.text !== transfer.result.patchedTargetText || patched.contentSha256 !== transfer.result.patchedTargetSha256) throw new Error('Patched-target artifact text or SHA-256 does not match the transfer result.');
  for (const [artifact, value, label] of [[auditArtifact, transfer.audit, 'audit'], [proofArtifact, transfer.proof, 'proof'], [manifestArtifact, transfer.manifest, 'manifest']]) { let parsed; try { parsed = JSON.parse(artifact.text); } catch { throw new Error(`Transfer ${label} artifact text is not valid JSON.`); } if (!equal(parsed, value)) throw new Error(`Transfer ${label} artifact text does not match retained evidence.`); }
  const manifest = transfer.manifest;
  if (!equal(manifest.artifacts, artifacts.slice(0, 3).map(reference))) throw new Error('Transfer manifest descriptors do not match retained artifacts.');
  const self = manifest.manifestArtifact;
  if (self?.filename !== manifestArtifact.filename || self?.schema !== manifestArtifact.schema || self?.mimeType !== manifestArtifact.mimeType || self?.contentHashPolicy !== 'CANONICAL_MANIFEST_MATERIAL' || self?.byteHashDescriptorSchema !== SCHEMAS.artifact) throw new Error('Transfer manifest self-reference does not match its descriptor.');
  return Object.freeze(artifacts.map(reportDescriptor));
}
function absoluteOperationPath(operation) { const parent = operation.targetCanonicalPath === '/' ? '' : operation.targetCanonicalPath; return `${parent}${operation.fieldPath}` || '/'; }
function validateOperationCoverage(transfer) {
  const planIds = transfer.plan.operations.map((item) => item.operationId); const resultIds = transfer.result.appliedOperations; const auditIds = transfer.audit.rows.map((item) => item.operationId);
  if (new Set(planIds).size !== planIds.length || !equal(planIds, resultIds) || !equal(planIds, auditIds)) throw new Error('Operation IDs do not reconcile across plan, result, and audit evidence.');
  const expectedPaths = transfer.plan.operations.map(absoluteOperationPath).sort(); const actualPaths = (transfer.proof.actualChanges ?? []).map((item) => item.path).sort();
  if (!equal(expectedPaths, actualPaths)) throw new Error('Transfer proof mutation coverage does not reconcile with plan operation IDs.');
}
async function validateTransfer(workspace, cryptoRef, options) {
  const transfer = workspace.transfer; const plan = transfer.plan; const result = transfer.result;
  await verifyIdentity(plan, 'planId', PREFIXES.plan, cryptoRef); await verifyIdentity(result, 'resultId', PREFIXES.result, cryptoRef); await verifyIdentity(transfer.audit, 'auditId', PREFIXES.audit, cryptoRef); await verifyIdentity(transfer.proof, 'proofId', PREFIXES.proof, cryptoRef); await verifyIdentity(transfer.manifest, 'manifestId', PREFIXES.manifest, cryptoRef);
  const capture = options.captureTransferAuthority ?? captureRevisionCompareTransferAuthority; const fromPlan = options.planTransferAuthority ?? revisionCompareTransferPlanAuthority;
  if (!equal(capture(workspace), fromPlan(plan)) || !equal(plan.selection, transfer.selection)) throw new Error('Current transfer plan authority or selection does not match live workspace authority.');
  const original = workspace.slots?.candidate?.jsonSnapshot; const patched = transfer.patchedSnapshot;
  if (result.planId !== plan.planId || result.planContentSha256 !== plan.contentSha256) throw new Error('Transfer result does not match the current plan identity.');
  if (result.targetDocumentId !== original?.sourceDocumentId || result.originalTargetSha256 !== original?.sourceContentSha256) throw new Error('Transfer result original-target identity does not match current Rev B.');
  if (result.patchedTargetDocumentId !== patched?.sourceDocumentId || result.patchedTargetSha256 !== patched?.sourceContentSha256) throw new Error('Transfer result patched-target identity does not match the patched snapshot.');
  if (transfer.audit.planId !== plan.planId || transfer.audit.planContentSha256 !== plan.contentSha256 || transfer.audit.createdAt !== result.createdAt || transfer.audit.summary?.operationCount !== plan.operations.length || transfer.audit.summary?.appliedCount !== plan.operations.length || transfer.audit.summary?.skippedCount !== 0 || transfer.audit.summary?.blockedCount !== 0) throw new Error('Transfer audit identity or summary does not match the current plan and result.');
  if (transfer.proof.planId !== plan.planId || transfer.proof.planContentSha256 !== plan.contentSha256 || transfer.proof.originalTargetDocumentId !== result.targetDocumentId || transfer.proof.originalTargetSha256 !== result.originalTargetSha256 || transfer.proof.patchedTargetDocumentId !== result.patchedTargetDocumentId || transfer.proof.patchedTargetSha256 !== result.patchedTargetSha256) throw new Error('Transfer proof identities do not match the current result.');
  if (transfer.manifest.planId !== plan.planId || transfer.manifest.resultId !== result.resultId || transfer.manifest.createdAt !== result.createdAt) throw new Error('Transfer manifest identities do not match the current result.');
  validateOperationCoverage(transfer); return verifyArtifacts(transfer, cryptoRef);
}
function reportMaterial(workspace, evidencePackage, declarant, declaredAt, descriptors) { const transfer = workspace.transfer; const result = transfer.result; return { schema: REVISION_COMPARE_TRANSFER_COMPLETION_REPORT_SCHEMA, sourceEvidence: { packageId: evidencePackage.packageId, packageContentSha256: evidencePackage.contentSha256, sessionId: evidencePackage.identity.sessionId, basisId: evidencePackage.identity.basisId, auditId: evidencePackage.identity.auditId, reviewSessionId: evidencePackage.identity.reviewSessionId, decisionLedgerId: evidencePackage.identity.decisionLedgerId, reviewRevision: workspace.review.session.revision, decisionRevision: workspace.decision.ledger.revision }, transferEvidence: { planId: transfer.plan.planId, planContentSha256: transfer.plan.contentSha256, resultId: result.resultId, resultContentSha256: result.contentSha256, originalTargetDocumentId: result.targetDocumentId, originalTargetSha256: result.originalTargetSha256, patchedTargetDocumentId: result.patchedTargetDocumentId, patchedTargetSha256: result.patchedTargetSha256, transferAuditContentSha256: transfer.audit.contentSha256, transferProofContentSha256: transfer.proof.contentSha256, transferManifestContentSha256: transfer.manifest.contentSha256, artifactDescriptors: descriptors }, completion: { status: 'COMPLETE', operationCount: transfer.plan.operations.length, appliedOperationCount: result.summary.appliedOperationCount, skippedOperationCount: 0, blockedOperationCount: 0, blockers: [] }, declaration: { ...declarant, statement: REVISION_COMPARE_TRANSFER_COMPLETION_DECLARATION, declaredAt }, trustBoundary: { identityStatus: 'SELF_DECLARED', authorityStatus: 'NOT_ESTABLISHED', authenticityStatus: 'NOT_ESTABLISHED', statement: REVISION_COMPARE_TRANSFER_COMPLETION_TRUST_STATEMENT }, validation: { status: 'READY', errors: [] } }; }
export async function createRevisionCompareTransferCompletionReport(workspace, evidencePackage, input, declaredAt, options = {}) { const readiness = revisionCompareTransferCompletionReadiness(workspace); if (readiness.status !== 'READY') throw new Error(readiness.blockers[0]); const cryptoRef = options.cryptoRef ?? globalThis.crypto; const declarant = normalizeRevisionCompareTransferCompletionDeclarant(input); const timestamp = exactTimestamp(declaredAt); await verifyEvidencePackage(evidencePackage, workspace, cryptoRef); const descriptors = await validateTransfer(workspace, cryptoRef, options); const material = canonicalRevisionCompareEvidenceValue(reportMaterial(workspace, evidencePackage, declarant, timestamp, descriptors), 'transferCompletionMaterial'); const hash = await sha256Text(JSON.stringify(material), cryptoRef); const report = deepFreeze(canonicalRevisionCompareEvidenceValue({ ...material, reportId: `${REVISION_COMPARE_TRANSFER_COMPLETION_ID_PREFIX}${hash}`, contentSha256: hash }, REVISION_COMPARE_TRANSFER_COMPLETION_REPORT_SCHEMA)); assertJsonSafe(report, REVISION_COMPARE_TRANSFER_COMPLETION_REPORT_SCHEMA); return report; }
export async function validateRevisionCompareTransferCompletionReportIdentity(report, cryptoRef = globalThis.crypto) { if (report?.schema !== REVISION_COMPARE_TRANSFER_COMPLETION_REPORT_SCHEMA) throw new TypeError(`A ${REVISION_COMPARE_TRANSFER_COMPLETION_REPORT_SCHEMA} is required.`); const material = canonicalRevisionCompareEvidenceValue(without(report, ['reportId', 'contentSha256']), 'transferCompletionValidation'); const hash = await sha256Text(JSON.stringify(material), cryptoRef); if (report.contentSha256 !== hash || report.reportId !== `${REVISION_COMPARE_TRANSFER_COMPLETION_ID_PREFIX}${hash}`) throw new Error('Transfer completion report identity does not recompute.'); if (report.declaration?.statement !== REVISION_COMPARE_TRANSFER_COMPLETION_DECLARATION || report.trustBoundary?.statement !== REVISION_COMPARE_TRANSFER_COMPLETION_TRUST_STATEMENT) throw new Error('Transfer completion fixed statements do not match the governing contract.'); return report; }
export function serializeRevisionCompareTransferCompletionReport(report) { if (report?.schema !== REVISION_COMPARE_TRANSFER_COMPLETION_REPORT_SCHEMA) throw new TypeError(`A ${REVISION_COMPARE_TRANSFER_COMPLETION_REPORT_SCHEMA} is required.`); return `${JSON.stringify(canonicalRevisionCompareEvidenceValue(report), null, 2)}\n`; }
export function revisionCompareTransferCompletionFileName(sessionId, reportId) { const safe = (value) => String(value ?? '').trim().replace(/[^A-Za-z0-9._-]/g, '_'); if (!safe(sessionId) || !safe(reportId)) throw new TypeError('Session ID and report ID are required.'); return `${safe(sessionId)}.${safe(reportId)}.json`; }
export const _test = Object.freeze({ absoluteOperationPath, byteSize, equal, exactTimestamp, reference, reportDescriptor, validateOperationCoverage, verifyArtifacts, verifyEvidencePackage, verifyIdentity });
