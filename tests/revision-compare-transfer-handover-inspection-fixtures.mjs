import { webcrypto } from 'node:crypto';
import { deepFreeze } from '../tabs/revision-compare/revision-contract-utils.js';
import { createProjectDocument, createProjectSession, attachProjectDocument } from '../tabs/revision-compare/revision-session-contracts.js';
import { createRevisionComparisonBasis } from '../tabs/revision-compare/revision-comparison-basis.js';
import { revisionComparisonPreflight } from '../tabs/revision-compare/revision-preflight.js';
import { createRevisionCompareJsonDocumentSnapshot } from '../tabs/revision-compare/revision-json-document.js';
import { createReviewSession, setReviewItemState } from '../tabs/revision-compare/revision-review-session.js';
import { createDecisionLedger } from '../tabs/revision-compare/revision-decision-ledger.js';
import {
  captureRevisionCompareTransferAuthority, createRevisionCompareTransferSelection,
  createRevisionCompareTransferState,
} from '../tabs/revision-compare/revision-transfer-contracts.js';
import { REVISION_COMPARE_TRANSFER_POLICY_VERSION } from '../tabs/revision-compare/revision-transfer-policy.js';
import { createRevisionCompareTransferPlan } from '../tabs/revision-compare/revision-transfer-plan.js';
import { createRevisionCompareTransferApplication } from '../tabs/revision-compare/revision-transfer-result.js';
import { createRevisionCompareEvidencePackage } from '../tabs/revision-compare/revision-evidence-package.js';
import { createRevisionCompareTransferCompletionApplication } from '../tabs/revision-compare/revision-transfer-completion-controller.js';
import { completeRevisionCompareTransferCompletionState } from '../tabs/revision-compare/revision-transfer-completion-state.js';
import { adoptRevisionCompareTransferArchiveWorkspace } from '../tabs/revision-compare/revision-transfer-archive-workspace-state.js';

export const cryptoRef = webcrypto;
export const createdAt = '2026-07-26T01:00:00.000Z';
const hash = (character) => character.repeat(64);
function projectDocument(slotId, role, documentId, character, fileName) {
  return createProjectDocument({
    documentId, slotId, role, fileName, fileSizeBytes: 100, sourceHash: hash(character),
    scopedHash: hash(character === 'a' ? 'c' : 'd'), stagedSchema: 'stage/v1', rootShape: 'branches',
    unit: 'mm', verticalAxis: 'Z', coordinateFrame: 'PLANT', createdAt,
    stats: { branchCount: 1, componentCount: 1, recordCount: 1, geometryEvidenceCount: 1,
      scanned: 1, matched: 1, filtered: 0 },
    scope: { wildcard: '', selectedIds: ['/B-1'] },
  });
}
function intake(slotId, role, document, snapshot) {
  return deepFreeze({
    schema: 'RevisionIntakeState.v1', slotId, role, requestGeneration: 1, status: 'SCOPED',
    fileName: document.fileName, fileSizeBytes: document.fileSizeBytes, contentHash: document.sourceHash,
    document, jsonSnapshot: snapshot, branchTree: [], branchIndex: [], branchIndexSummary: { branchCount: 1 },
    scopeDraft: { selectedIds: ['/B-1'], exclusions: [] }, scopeResult: { status: 'READY' },
    warnings: [], blockers: [], error: null,
  });
}
function proposalFor(revA, revB) {
  return deepFreeze({
    schema: 'RevisionScopeProposal.v1', proposalId: 'scope-proposal:handover-inspection',
    revADocumentId: revA.documentId, revBDocumentId: revB.documentId,
    commonBranchIds: ['/B-1'], revAOnlyBranchIds: [], revBOnlyBranchIds: [],
    includedBranchIdsA: ['/B-1'], includedBranchIdsB: ['/B-1'], excludedBranches: [],
    commonBranches: [{ branchId: '/B-1' }], revAOnlyBranches: [], revBOnlyBranches: [],
    summary: { commonBranchCount: 1, revAOnlyBranchCount: 0, revBOnlyBranchCount: 0,
      includedBranchCountA: 1, includedBranchCountB: 1, excludedBranchCount: 0,
      retainedComponentCountA: 1, retainedComponentCountB: 1,
      retainedRecordCountA: 1, retainedRecordCountB: 1 },
    warnings: [], validation: { status: 'READY', errors: [] },
  });
}
function visualModel(side, documentId, objectId) {
  return deepFreeze({
    contract: 'VisualGeometryModel.v2', schema: 'VisualGeometryModel.v2', modelId: `model:${side}`,
    documentId, revisionId: `revision:${side}`, unit: 'MM', coordinateFrame: 'PLANT',
    verticalAxis: 'Z', origin: [0, 0, 0], segments: [],
    markers: [{ primitiveId: `marker:${objectId}`, objectId, position: [0, 0, 0], kind: 'NODE' }],
    bounds: { min: [0, 0, 0], max: [1, 1, 1] },
  });
}
function auditFor(basis, sourceId, targetId, properties) {
  const row = deepFreeze({
    schema: 'RevisionDifferenceRow.v1', differenceId: 'difference:handover:1',
    differenceCategory: 'CHANGED', matchCertainty: 'EXACT', sourceRecordId: sourceId,
    targetRecordId: targetId, candidateEvidenceId: null, changeReasons: ['VALUE_CHANGED'],
    changedProperties: properties, geometryDelta: { status: 'AVAILABLE', changed: false,
      maximumPointDelta: 0, reason: 'Persisted.' }, evidenceSummary: { primary: 'Persisted evidence.' },
    visualRefs: { sourceObjectId: `A:${sourceId}`, targetObjectId: `B:${targetId}` },
    context: { branchId: '/B-1', componentType: 'PIPE', revAIdentity: sourceId, revBIdentity: targetId },
  });
  return deepFreeze({
    schema: 'RevisionCompareAudit.v1', auditId: 'audit:handover-inspection', basisId: basis.basisId,
    revADocumentId: basis.revADocumentId, revBDocumentId: basis.revBDocumentId,
    engineVersion: 'revision-compare-engine/test', configuration: { engineVersion: 'revision-compare-engine/test' },
    summary: { unchanged: 0, changed: 1, added: 0, removed: 0, needsDecision: 0, exact: 1, inferred: 0 },
    differenceRows: [row], candidateEvidence: [],
    visualModels: { revA: visualModel('A', basis.revADocumentId, `A:${sourceId}`),
      revB: visualModel('B', basis.revBDocumentId, `B:${targetId}`),
      statusByObjectId: { [`A:${sourceId}`]: 'MODIFIED', [`B:${targetId}`]: 'MODIFIED' } },
    visualReadiness: { status: 'READY' }, warnings: [], performanceReceipt: { elapsedMs: 1 },
    validation: { status: 'READY', errors: [] },
  });
}
async function authorityState() {
  const sourceValue = { schema: 'stage/v1', branches: [{ name: 'B-1', children: [{ id: 'S-1', description: 'New', material: 'CS' }] }] };
  const targetValue = { schema: 'stage/v1', branches: [{ name: 'B-1', children: [{ id: 'T-1', description: 'Old', material: 'SS' }] }] };
  const revADocument = projectDocument('baseline', 'REFERENCE', 'doc:A', 'a', 'rev-a.json');
  const revBDocument = projectDocument('candidate', 'CANDIDATE', 'doc:B', 'b', 'rev-b.json');
  const revA = await createRevisionCompareJsonDocumentSnapshot({ side: 'REV_A', sourceDocumentId: 'doc:A',
    sourceContentSha256: hash('a'), fileName: 'rev-a.json', profile: 'stage/v1', parsedValue: sourceValue }, cryptoRef);
  const revB = await createRevisionCompareJsonDocumentSnapshot({ side: 'REV_B', sourceDocumentId: 'doc:B',
    sourceContentSha256: hash('b'), fileName: 'rev-b.json', profile: 'stage/v1', parsedValue: targetValue }, cryptoRef);
  let session = createProjectSession({ sessionId: 'revision-session-handover-inspection', createdAt });
  session = attachProjectDocument(session, revADocument, createdAt); session = attachProjectDocument(session, revBDocument, createdAt);
  const baseline = intake('baseline', 'REFERENCE', revADocument, revA);
  const candidate = intake('candidate', 'CANDIDATE', revBDocument, revB);
  const proposal = proposalFor(revADocument, revBDocument); const preflight = revisionComparisonPreflight(baseline, candidate, proposal);
  const basis = await createRevisionComparisonBasis({ sessionId: session.sessionId, revA: baseline, revB: candidate, proposal, preflight }, cryptoRef);
  const sourceId = revA.entityIndex.find((item) => item.entityKind === 'COMPONENT').entityId;
  const targetId = revB.entityIndex.find((item) => item.entityKind === 'COMPONENT').entityId;
  const properties = [
    { propertyKey: 'description', revAValue: 'New', revBValue: 'Old',
      revAEvidencePath: '$.branches[0].children[0].description',
      revBEvidencePath: '$.branches[0].children[0].description', normalizationRule: 'trim-preserve-scalar' },
    { propertyKey: 'material', revAValue: 'CS', revBValue: 'SS',
      revAEvidencePath: '$.branches[0].children[0].material',
      revBEvidencePath: '$.branches[0].children[0].material', normalizationRule: 'trim-preserve-scalar' },
  ];
  const audit = auditFor(basis, sourceId, targetId, properties);
  let reviewSession = createReviewSession(audit, createdAt);
  reviewSession = setReviewItemState(reviewSession, audit, audit.differenceRows[0].differenceId, 'REVIEWED', createdAt);
  const decisionLedger = createDecisionLedger(audit, createdAt);
  const base = { schema: 'RevisionCompareWorkspaceState.v12', session, slots: { baseline, candidate },
    proposal, basis, basisStatus: 'CURRENT', compare: { status: 'COMPLETE', audit },
    review: { session: reviewSession }, decision: { ledger: decisionLedger },
    evidencePackageImport: { status: 'IDLE' }, signOff: { status: 'IDLE' }, trustReceipt: { status: 'IDLE' },
    transferReview: { schema: 'RevisionCompareTransferReviewState.v1' }, transferCompletion: { status: 'IDLE' } };
  return { base, preflight, sourceId, targetId, properties };
}
export async function handoverInspectionFixture() {
  const authority = await authorityState(); const base = authority.base;
  const emptyTransfer = createRevisionCompareTransferState(REVISION_COMPARE_TRANSFER_POLICY_VERSION, captureRevisionCompareTransferAuthority(base));
  const state = deepFreeze({ ...base, transfer: emptyTransfer });
  const selection = createRevisionCompareTransferSelection({ selectionRevision: 1, items: [{
    differenceId: state.compare.audit.differenceRows[0].differenceId, sourceRecordId: authority.sourceId,
    targetRecordId: authority.targetId, fields: authority.properties.map((property) => ({
      propertyKey: property.propertyKey, revAEvidencePath: property.revAEvidencePath,
      revBEvidencePath: property.revBEvidencePath, targetFieldPath: `/${property.propertyKey}`,
    })),
  }] });
  const plan = await createRevisionCompareTransferPlan(state, selection, { cryptoRef });
  const planned = deepFreeze({ ...emptyTransfer, status: 'PLANNED', plan, selection,
    sourceDocumentId: plan.sourceDocument.documentId, sourceDocumentSha256: plan.sourceDocument.contentSha256,
    targetDocumentId: plan.receiverDocument.documentId, targetDocumentSha256: plan.receiverDocument.contentSha256,
    policyVersion: plan.policyVersion });
  const plannedWorkspace = deepFreeze({ ...state, transfer: planned });
  const application = await createRevisionCompareTransferApplication(plannedWorkspace, { createdAt, cryptoRef });
  const transfer = deepFreeze({ ...planned, status: 'APPLIED', result: application.result,
    audit: application.audit, proof: application.proof, manifest: application.manifest,
    artifacts: application.artifacts, patchedSnapshot: application.patchedSnapshot });
  const applied = deepFreeze({ ...state, transfer });
  const evidencePackage = await createRevisionCompareEvidencePackage(applied, authority.preflight, cryptoRef);
  const completion = await createRevisionCompareTransferCompletionApplication(applied,
    { declarantName: 'Lakshman', declarantRole: 'Engineer', organization: 'Example Org' }, createdAt,
    { cryptoRef, preflight: authority.preflight, createEvidencePackage: async () => evidencePackage });
  const completionState = completeRevisionCompareTransferCompletionState(completion, applied);
  const workspace = adoptRevisionCompareTransferArchiveWorkspace(deepFreeze({ ...applied, transferCompletion: completionState }));
  return { ...authority, workspace, bundle: completion.bundle, evidencePackage, completion };
}
export function clone(value) { return structuredClone(value); }
