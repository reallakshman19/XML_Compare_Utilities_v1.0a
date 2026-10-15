import { webcrypto } from 'node:crypto';
import { deepFreeze, stableStringify } from '../tabs/revision-compare/revision-contract-utils.js';
import { sha256Text } from '../tabs/revision-compare/revision-hash.js';
import { createRevisionCompareJsonDocumentSnapshot } from '../tabs/revision-compare/revision-json-document.js';
import { createRevisionCompareTransferAddress, REVISION_COMPARE_TARGET_STATE } from '../tabs/revision-compare/revision-transfer-address.js';
import { createRevisionCompareTransferReviewState } from '../tabs/revision-compare/revision-transfer-review-state.js';
import {
  REVISION_COMPARE_TRANSFER_OPERATION_TYPE,
  REVISION_COMPARE_TRANSFER_PLAN_ID_PREFIX,
  REVISION_COMPARE_TRANSFER_PLAN_SCHEMA,
  REVISION_COMPARE_TRANSFER_STATE_SCHEMA,
} from '../tabs/revision-compare/revision-transfer-contracts.js';
import {
  classifyRevisionCompareTransferField,
  REVISION_COMPARE_TRANSFER_POLICY_VERSION,
} from '../tabs/revision-compare/revision-transfer-policy.js';

export const cryptoRef = webcrypto;
export const createdAt = '2026-07-24T13:45:00.000Z';
const hash = (value) => value.repeat(64);

function documents(rootKind, target) {
  const sourceComponent = {
    id: 'SOURCE-1', type: 'PIPE', description: 'New', weight: 12, material: 'CS',
  };
  const branchA = { name: 'B-1', children: [sourceComponent], extension: { keep: true } };
  const branchB = { name: 'B-1', children: [target], extension: { keep: true } };
  if (rootKind === 'ARRAY') return { revAValue: [branchA], revBValue: [branchB] };
  return {
    revAValue: { schema: 'stage/v1', metadata: { owner: 'fixture', unknown: [3, 1, 2] }, branches: [branchA], future: { keep: true } },
    revBValue: { schema: 'stage/v1', metadata: { owner: 'fixture', unknown: [3, 1, 2] }, branches: [branchB], future: { keep: true } },
  };
}
function sourceValue(propertyKey) { return propertyKey === 'weight' ? 12 : propertyKey === 'material' ? 'CS' : 'New'; }
function selectionFor(specs, sourceEntity, targetEntity) {
  return deepFreeze({
    schema: 'RevisionCompareTransferSelection.v1', direction: 'REV_A_TO_REV_B', selectionRevision: 1,
    items: [{ differenceId: 'difference:1', sourceRecordId: sourceEntity.entityId,
      targetRecordId: targetEntity.entityId,
      fields: specs.map((spec) => ({ propertyKey: spec.propertyKey,
        revAEvidencePath: spec.revAEvidencePath ?? '$.branches[0].children[0].description',
        revBEvidencePath: spec.expectedTargetState === 'PRESENT'
          ? (spec.revBEvidencePath ?? '$.branches[0].children[0].description') : null,
        targetFieldPath: spec.fieldPath })) }],
  });
}
function operationFor(spec, index, snapshots, sourceEntity, targetEntity) {
  const beforePresent = spec.expectedTargetState === REVISION_COMPARE_TARGET_STATE.PRESENT;
  const addressInput = {
    targetDocumentId: snapshots.revB.sourceDocumentId,
    targetDocumentSha256: snapshots.revB.sourceContentSha256,
    targetEntityId: targetEntity.entityId, entityCanonicalPath: targetEntity.canonicalPath,
    fieldPath: spec.fieldPath, expectedTargetState: spec.expectedTargetState,
    expectedEntitySha256: spec.entitySha256 ?? targetEntity.entitySha256,
  };
  if (beforePresent) addressInput.expectedCurrentValue = spec.beforeValue;
  const operation = {
    schema: 'RevisionCompareTransferOperation.v1', operationId: `revision-transfer-operation:${String(index + 1).padStart(64, '0')}`,
    operationType: spec.operationType, expectedTargetState: spec.expectedTargetState,
    sourceDocumentId: snapshots.revA.sourceDocumentId, sourceDocumentSha256: snapshots.revA.sourceContentSha256,
    targetDocumentId: snapshots.revB.sourceDocumentId, targetDocumentSha256: snapshots.revB.sourceContentSha256,
    sourceEntityId: sourceEntity.entityId, targetEntityId: targetEntity.entityId,
    sourceCanonicalPath: sourceEntity.canonicalPath, targetCanonicalPath: targetEntity.canonicalPath,
    fieldPath: spec.fieldPath, afterValue: spec.afterValue,
    valueType: spec.afterValue === null ? 'NULL' : typeof spec.afterValue === 'number' ? 'NUMBER' : typeof spec.afterValue === 'boolean' ? 'BOOLEAN' : 'STRING',
    transferPolicy: classifyRevisionCompareTransferField({ propertyKey: spec.propertyKey, fieldPath: spec.fieldPath }),
    targetAddress: createRevisionCompareTransferAddress(addressInput),
    evidenceReferences: { differenceId: 'difference:1', auditId: 'audit:1', reviewSessionId: 'review:1',
      reviewRevision: 1, decisionLedgerId: 'decision:1', decisionRevision: 0,
      decisionEventId: null, revAEvidencePath: spec.revAEvidencePath ?? '$.branches[0].children[0].description',
      revBEvidencePath: beforePresent ? (spec.revBEvidencePath ?? '$.branches[0].children[0].description') : null },
    status: spec.status ?? 'READY', blockers: Object.freeze(spec.blockers ?? []),
  };
  if (beforePresent) operation.beforeValue = spec.beforeValue;
  return deepFreeze(operation);
}
async function planFor(specs, snapshots, sourceEntity, targetEntity) {
  const selection = selectionFor(specs, sourceEntity, targetEntity);
  const operations = Object.freeze(specs.map((spec, index) => operationFor(spec, index, snapshots, sourceEntity, targetEntity)));
  const material = {
    schema: REVISION_COMPARE_TRANSFER_PLAN_SCHEMA, direction: 'REV_A_TO_REV_B',
    sourceDocument: { schema: snapshots.revA.schema, side: 'REV_A', documentId: snapshots.revA.sourceDocumentId,
      contentSha256: snapshots.revA.sourceContentSha256, fileName: snapshots.revA.fileName,
      rootKind: snapshots.revA.rootKind, profile: snapshots.revA.profile },
    receiverDocument: { schema: snapshots.revB.schema, side: 'REV_B', documentId: snapshots.revB.sourceDocumentId,
      contentSha256: snapshots.revB.sourceContentSha256, fileName: snapshots.revB.fileName,
      rootKind: snapshots.revB.rootKind, profile: snapshots.revB.profile },
    scope: { proposalId: 'proposal:1', basisStatus: 'CURRENT' },
    comparisonBasis: { basisId: 'basis:1', revADocumentId: 'doc:A', revBDocumentId: 'doc:B',
      revAContentHash: hash('a'), revBContentHash: hash('b') },
    audit: { auditId: 'audit:1', basisId: 'basis:1', revADocumentId: 'doc:A', revBDocumentId: 'doc:B', engineVersion: 'test' },
    reviewSession: { reviewSessionId: 'review:1', auditId: 'audit:1', basisId: 'basis:1', revision: 1,
      status: 'CURRENT', importError: null, replacementRequired: false },
    decisionLedger: { ledgerId: 'decision:1', auditId: 'audit:1', basisId: 'basis:1', revision: 0,
      status: 'CURRENT', importError: null, replacementRequired: false },
    activity: { revAIntakeStatus: 'SCOPED', revBIntakeStatus: 'SCOPED', comparisonStatus: 'COMPLETE' },
    selection, policyVersion: REVISION_COMPARE_TRANSFER_POLICY_VERSION, operations,
    summary: { selectedItemCount: 1, operationCount: operations.length,
      readyOperationCount: operations.length, blockedOperationCount: 0,
      replaceExistingCount: operations.filter((item) => item.operationType === 'REPLACE_EXISTING_PROPERTY').length,
      addMissingCount: operations.filter((item) => item.operationType === 'ADD_MISSING_PROPERTY').length },
    status: 'READY', blockers: Object.freeze([]),
  };
  const contentSha256 = await sha256Text(stableStringify(material), cryptoRef);
  return deepFreeze({ ...material, planId: `${REVISION_COMPARE_TRANSFER_PLAN_ID_PREFIX}${contentSha256}`, contentSha256 });
}

export async function workspaceFixture(options = {}) {
  const rootKind = options.rootKind ?? 'ENVELOPE';
  const target = { id: 'TARGET-1', type: 'PIPE', description: options.description ?? 'Old',
    tags: ['A', 'B'], unknownExtension: { flag: true, order: [2, 1] } };
  if (options.descriptionAbsent) delete target.description;
  if (options.descriptionNull) target.description = null;
  const docs = documents(rootKind, target);
  const revA = await createRevisionCompareJsonDocumentSnapshot({ side: 'REV_A', sourceDocumentId: 'doc:A',
    sourceContentSha256: hash('a'), fileName: 'source.json', profile: 'stage/v1', parsedValue: docs.revAValue }, cryptoRef);
  const revB = await createRevisionCompareJsonDocumentSnapshot({ side: 'REV_B', sourceDocumentId: 'doc:B',
    sourceContentSha256: hash('b'), fileName: options.fileName ?? 'Target Rev B.json', profile: 'stage/v1', parsedValue: docs.revBValue }, cryptoRef);
  const sourceEntity = revA.entityIndex.find((entry) => entry.entityKind === 'COMPONENT');
  const targetEntity = revB.entityIndex.find((entry) => entry.entityKind === 'COMPONENT');
  const specs = options.specs ?? [{ propertyKey: 'description', fieldPath: '/description',
    operationType: REVISION_COMPARE_TRANSFER_OPERATION_TYPE.REPLACE_EXISTING_PROPERTY,
    expectedTargetState: REVISION_COMPARE_TARGET_STATE.PRESENT,
    beforeValue: target.description, afterValue: 'New' }];
  const plan = await planFor(specs, { revA, revB }, sourceEntity, targetEntity);
  const transfer = deepFreeze({
    schema: REVISION_COMPARE_TRANSFER_STATE_SCHEMA, status: 'PLANNED', plan, selection: plan.selection,
    sourceDocumentId: 'doc:A', sourceDocumentSha256: hash('a'), targetDocumentId: 'doc:B',
    targetDocumentSha256: hash('b'), policyVersion: REVISION_COMPARE_TRANSFER_POLICY_VERSION,
    authority: null, requestGeneration: 1, request: null, applyGeneration: 0,
    applyAuthority: null, applyRequest: null, result: null, audit: null, proof: null,
    manifest: null, artifacts: Object.freeze([]), patchedSnapshot: null, error: null,
  });
  return deepFreeze({
    schema: 'RevisionCompareWorkspaceState.v12', proposal: { proposalId: 'proposal:1' }, basisStatus: 'CURRENT',
    basis: plan.comparisonBasis, slots: { baseline: { status: 'SCOPED', jsonSnapshot: revA }, candidate: { status: 'SCOPED', jsonSnapshot: revB } },
    compare: { status: 'COMPLETE', audit: plan.audit, presentationMode: 'overlay' },
    review: { session: plan.reviewSession, importError: null, replacementRequired: false },
    decision: { ledger: plan.decisionLedger, importError: null, replacementRequired: false },
    evidencePackageImport: options.packageState ?? { status: 'IDLE', packageId: null, contentSha256: null },
    transferReview: createRevisionCompareTransferReviewState(), transfer,
  });
}

export const operationSpec = ({ propertyKey = 'description', fieldPath = '/description', operationType,
  expectedTargetState, beforeValue, afterValue = sourceValue(propertyKey), ...rest }) => ({
  propertyKey, fieldPath, operationType, expectedTargetState, beforeValue, afterValue, ...rest,
});
