import { webcrypto } from 'node:crypto';
import { deepFreeze, stableStringify } from '../tabs/revision-compare/revision-contract-utils.js';
import { canonicalRevisionCompareEvidenceValue, revisionCompareEvidencePackageHashMaterial } from '../tabs/revision-compare/revision-evidence-package.js';
import { sha256Text } from '../tabs/revision-compare/revision-hash.js';
import { reviewSummary } from '../tabs/revision-compare/revision-review-contracts.js';
import { decisionSummary } from '../tabs/revision-compare/revision-decision-contracts.js';
import { createRevisionCompareTransferAddress } from '../tabs/revision-compare/revision-transfer-address.js';
import { createRevisionCompareTransferCompletionState } from '../tabs/revision-compare/revision-transfer-completion-state.js';
import { classifyRevisionCompareTransferField, REVISION_COMPARE_TRANSFER_POLICY_VERSION } from '../tabs/revision-compare/revision-transfer-policy.js';

export const cryptoRef = webcrypto;
export const declaredAt = '2026-07-25T03:00:00.000Z';
const hash = (character) => character.repeat(64);
const jsonText = (value) => `${JSON.stringify(value, null, 2)}\n`;
async function identified(material, idKey, prefix) { const contentSha256 = await sha256Text(stableStringify(material), cryptoRef); return deepFreeze({ ...material, [idKey]: `${prefix}${contentSha256}`, contentSha256 }); }
async function descriptor(filename, schema, text) { return deepFreeze({ descriptorSchema: 'RevisionCompareTransferArtifact.v1', filename, schema, mimeType: 'application/json', text, contentSha256: await sha256Text(text, cryptoRef), sizeBytes: new TextEncoder().encode(text).byteLength }); }
function artifactReference(item) { return deepFreeze({ filename: item.filename, schema: item.schema, mimeType: item.mimeType, contentSha256: item.contentSha256, sizeBytes: item.sizeBytes }); }
async function transferOperation() {
  const material = JSON.parse(stableStringify({
    schema: 'RevisionCompareTransferOperation.v1', operationType: 'REPLACE_EXISTING_PROPERTY',
    expectedTargetState: 'PRESENT', sourceDocumentId: 'doc:A', sourceDocumentSha256: hash('a'),
    targetDocumentId: 'doc:B', targetDocumentSha256: hash('b'), sourceEntityId: 'source:1',
    targetEntityId: 'target:1', sourceCanonicalPath: '/branches/0/children/0',
    targetCanonicalPath: '/branches/0/children/0', fieldPath: '/description', beforeValue: 'Old',
    afterValue: 'New', valueType: 'STRING',
    transferPolicy: classifyRevisionCompareTransferField({ propertyKey: 'description', fieldPath: '/description' }),
    targetAddress: createRevisionCompareTransferAddress({ targetDocumentId: 'doc:B',
      targetDocumentSha256: hash('b'), targetEntityId: 'target:1',
      entityCanonicalPath: '/branches/0/children/0', fieldPath: '/description',
      expectedTargetState: 'PRESENT', expectedEntitySha256: hash('e'), expectedCurrentValue: 'Old' }),
    evidenceReferences: { differenceId: 'difference:1', auditId: 'audit:completion',
      reviewSessionId: 'review-session:audit:completion:v1', reviewRevision: 1,
      decisionLedgerId: 'ambiguity-ledger:audit:completion:v1', decisionRevision: 0,
      decisionEventId: null, revAEvidencePath: '$.description', revBEvidencePath: '$.description' },
  }));
  const operationId = `revision-transfer-operation:${await sha256Text(JSON.stringify(material), cryptoRef)}`;
  return deepFreeze({ ...material, operationId, status: 'READY', blockers: [] });
}
export async function completionFixture() {
  const session = deepFreeze({ schema: 'ProjectSession.v1', sessionId: 'revision-session:completion', createdAt: '2026-07-25T01:00:00.000Z', updatedAt: '2026-07-25T01:00:00.000Z', documents: {} });
  const basis = deepFreeze({ schema: 'RevisionComparisonBasis.v1', basisId: 'basis:completion', sessionId: session.sessionId, revADocumentId: 'doc:A', revBDocumentId: 'doc:B', revAContentHash: hash('a'), revBContentHash: hash('b') });
  const compareAudit = deepFreeze({ schema: 'RevisionCompareAudit.v1', auditId: 'audit:completion', basisId: basis.basisId, revADocumentId: 'doc:A', revBDocumentId: 'doc:B', engineVersion: 'test', differenceRows: [{ differenceId: 'difference:1', differenceCategory: 'CHANGED' }], validation: { status: 'READY', errors: [] } });
  const reviewItems = deepFreeze([{ schema: 'ReviewItemState.v1', differenceId: 'difference:1', reviewState: 'REVIEWED', note: '', noteHash: hash('0'), firstReviewedAt: declaredAt, updatedAt: declaredAt, eventIds: [] }]);
  const review = deepFreeze({ schema: 'ReviewSession.v1', reviewSessionId: 'review-session:audit:completion:v1', auditId: compareAudit.auditId, basisId: basis.basisId, revADocumentId: 'doc:A', revBDocumentId: 'doc:B', status: 'CURRENT', revision: 1, createdAt: declaredAt, updatedAt: declaredAt, items: reviewItems, events: [], summary: reviewSummary(reviewItems), validation: { status: 'READY', errors: [] } });
  const decisions = deepFreeze([]);
  const decision = deepFreeze({ schema: 'AmbiguityDecisionLedger.v1', ledgerId: 'ambiguity-ledger:audit:completion:v1', auditId: compareAudit.auditId, basisId: basis.basisId, revADocumentId: 'doc:A', revBDocumentId: 'doc:B', status: 'CURRENT', revision: 0, createdAt: declaredAt, updatedAt: declaredAt, decisions, events: [], selectedPairEvidence: [], summary: decisionSummary(decisions), validation: { status: 'READY', errors: [] } });
  const revA = deepFreeze({ schema: 'RevisionCompareJsonDocumentSnapshot.v1', side: 'REV_A', sourceDocumentId: 'doc:A', sourceContentSha256: hash('a'), fileName: 'rev-a.json', rootKind: 'ENVELOPE', profile: 'stage/v1', parsedValue: { branches: [{ children: [{ id: 'P1', description: 'New' }] }] }, entityIndex: [] });
  const revB = deepFreeze({ schema: 'RevisionCompareJsonDocumentSnapshot.v1', side: 'REV_B', sourceDocumentId: 'doc:B', sourceContentSha256: hash('b'), fileName: 'rev-b.json', rootKind: 'ENVELOPE', profile: 'stage/v1', parsedValue: { branches: [{ children: [{ id: 'P1', description: 'Old' }] }] }, entityIndex: [] });
  const patchedText = `${JSON.stringify({ branches: [{ children: [{ id: 'P1', description: 'New' }] }] }, null, 2)}\n`;
  const patchedSha = await sha256Text(patchedText, cryptoRef);
  const patchedSnapshot = deepFreeze({ ...revB, side: 'REV_B', sourceDocumentId: `revision-patched-target:${patchedSha}`, sourceContentSha256: patchedSha, parsedValue: JSON.parse(patchedText) });
  const selection = deepFreeze({ schema: 'RevisionCompareTransferSelection.v1', direction: 'REV_A_TO_REV_B', selectionRevision: 1, items: [{ differenceId: 'difference:1', sourceRecordId: 'source:1', targetRecordId: 'target:1', fields: [{ propertyKey: 'description', revAEvidencePath: '$.description', revBEvidencePath: '$.description', targetFieldPath: '/description' }] }] });
  const authorityFields = { scope: { proposalId: 'proposal:completion', basisStatus: 'CURRENT' }, comparisonBasis: { basisId: basis.basisId, revADocumentId: 'doc:A', revBDocumentId: 'doc:B', revAContentHash: hash('a'), revBContentHash: hash('b') }, audit: { auditId: compareAudit.auditId, basisId: basis.basisId, revADocumentId: 'doc:A', revBDocumentId: 'doc:B', engineVersion: 'test' }, reviewSession: { reviewSessionId: review.reviewSessionId, auditId: compareAudit.auditId, basisId: basis.basisId, revision: review.revision, status: 'CURRENT', importError: null, replacementRequired: false }, decisionLedger: { ledgerId: decision.ledgerId, auditId: compareAudit.auditId, basisId: basis.basisId, revision: decision.revision, status: 'CURRENT', importError: null, replacementRequired: false }, activity: { revAIntakeStatus: 'SCOPED', revBIntakeStatus: 'SCOPED', comparisonStatus: 'COMPLETE' } };
  const operation = await transferOperation();
  const planMaterial = canonicalRevisionCompareEvidenceValue({ schema: 'RevisionCompareTransferPlan.v1', direction: 'REV_A_TO_REV_B', sourceDocument: { schema: revA.schema, side: 'REV_A', documentId: 'doc:A', contentSha256: hash('a'), fileName: revA.fileName, rootKind: revA.rootKind, profile: revA.profile }, receiverDocument: { schema: revB.schema, side: 'REV_B', documentId: 'doc:B', contentSha256: hash('b'), fileName: revB.fileName, rootKind: revB.rootKind, profile: revB.profile }, ...authorityFields, selection, policyVersion: REVISION_COMPARE_TRANSFER_POLICY_VERSION, operations: [operation], summary: { selectedItemCount: 1, operationCount: 1, readyOperationCount: 1, blockedOperationCount: 0, replaceExistingCount: 1, addMissingCount: 0 }, status: 'READY', blockers: [] });
  const plan = await identified(planMaterial, 'planId', 'revision-transfer-plan:');
  const resultMaterial = { schema: 'RevisionCompareTransferResult.v1', planId: plan.planId, planContentSha256: plan.contentSha256, sourceDocumentId: 'doc:A', sourceDocumentSha256: hash('a'), targetDocumentId: 'doc:B', originalTargetSha256: hash('b'), patchedTargetDocumentId: patchedSnapshot.sourceDocumentId, patchedTargetSha256: patchedSha, patchedTargetText: patchedText, appliedOperations: [operation.operationId], skippedOperations: [], blockedOperations: [], summary: { planOperationCount: 1, appliedOperationCount: 1, skippedOperationCount: 0, blockedOperationCount: 0 }, validation: { status: 'READY', errors: [] }, createdAt: declaredAt, status: 'READY', errors: [] };
  const result = await identified(resultMaterial, 'resultId', 'revision-transfer-result:');
  const transferAudit = await identified({ schema: 'RevisionCompareTransferAudit.v1', planId: plan.planId, planContentSha256: plan.contentSha256, createdAt: declaredAt, rows: [{ operationId: operation.operationId, status: 'APPLIED' }], summary: { operationCount: 1, appliedCount: 1, skippedCount: 0, blockedCount: 0 }, status: 'READY', errors: [] }, 'auditId', 'revision-transfer-audit:');
  const transferProof = await identified({ schema: 'RevisionCompareTransferProof.v1', planId: plan.planId, planContentSha256: plan.contentSha256, serializedPlanSha256: hash('c'), originalTargetDocumentId: 'doc:B', originalTargetSha256: hash('b'), patchedTargetDocumentId: patchedSnapshot.sourceDocumentId, patchedTargetSha256: patchedSha, createdAt: declaredAt, actualChanges: [{ path: '/branches/0/children/0/description', kind: 'REPLACED' }], invariants: { jsonReparseSucceeded: true, supportedRootAndProfile: true, operationReconciliation: true, protectedFieldsUnchanged: true, entityCountUnchanged: true, entityIdentitiesUnchanged: true, arrayLengthsAndOrderUnchanged: true, hierarchyAndTopologyUnchanged: true, schemaAndEnvelopeUnchanged: true, unknownFieldsRetained: true, unselectedValuesUnchanged: true, objectKeyOrderPreserved: true, everyMutationCoveredExactlyOnce: true }, status: 'READY', errors: [] }, 'proofId', 'revision-transfer-proof:');
  const patchedArtifact = await descriptor('rev-b_patched_target.json', revB.profile, patchedText);
  const auditArtifact = await descriptor('rev-b_transfer_audit.json', transferAudit.schema, jsonText(transferAudit));
  const proofArtifact = await descriptor('rev-b_transfer_proof.json', transferProof.schema, jsonText(transferProof));
  const manifestMaterial = { schema: 'RevisionCompareTransferManifest.v1', planId: plan.planId, resultId: result.resultId, createdAt: declaredAt, targetFileStem: 'rev-b', artifacts: [patchedArtifact, auditArtifact, proofArtifact].map(artifactReference), manifestArtifact: { filename: 'rev-b_transfer_manifest.json', schema: 'RevisionCompareTransferManifest.v1', mimeType: 'application/json', contentHashPolicy: 'CANONICAL_MANIFEST_MATERIAL', byteHashDescriptorSchema: 'RevisionCompareTransferArtifact.v1' } };
  const manifest = await identified(manifestMaterial, 'manifestId', 'revision-transfer-manifest:');
  const manifestArtifact = await descriptor('rev-b_transfer_manifest.json', manifest.schema, jsonText(manifest));
  const transfer = deepFreeze({ schema: 'RevisionCompareTransferState.v1', status: 'APPLIED', plan, selection, policyVersion: REVISION_COMPARE_TRANSFER_POLICY_VERSION, authority: { schema: 'RevisionCompareTransferAuthority.v1', sourceDocument: { documentId: 'doc:A', contentSha256: hash('a') }, receiverDocument: { documentId: 'doc:B', contentSha256: hash('b') }, ...authorityFields }, request: null, applyRequest: null, result, audit: transferAudit, proof: transferProof, manifest, artifacts: [patchedArtifact, auditArtifact, proofArtifact, manifestArtifact], patchedSnapshot, error: null });
  const workspace = deepFreeze({ schema: 'RevisionCompareWorkspaceState.v12', session, proposal: { proposalId: 'proposal:completion' }, basis, basisStatus: 'CURRENT', slots: { baseline: { status: 'SCOPED', jsonSnapshot: revA }, candidate: { status: 'SCOPED', jsonSnapshot: revB } }, compare: { status: 'COMPLETE', audit: compareAudit, presentationMode: 'overlay', queue: { search: '' } }, review: { session: review }, decision: { ledger: decision }, evidencePackageImport: { status: 'IDLE' }, transfer, transferCompletion: createRevisionCompareTransferCompletionState(), viewerRuntime: { zoom: 5 }, search: { common: 'not authority' }, evidencePackageReadiness: { status: 'READY', blockers: [] } });
  const packageMaterial = canonicalRevisionCompareEvidenceValue({ schema: 'RevisionCompareEvidencePackage.v1', identity: { sessionId: session.sessionId, basisId: basis.basisId, auditId: compareAudit.auditId, reviewSessionId: review.reviewSessionId, decisionLedgerId: decision.ledgerId, revADocumentId: 'doc:A', revBDocumentId: 'doc:B', engineVersion: 'test' }, authorityStatus: { basisStatus: 'CURRENT', auditValidationStatus: 'READY', reviewStatus: 'CURRENT', decisionStatus: 'CURRENT' }, payload: { sessionManifest: { session }, scopeBasisManifest: { basis }, audit: compareAudit, reviewSession: review, decisionLedger: decision }, validation: { status: 'READY', errors: [] } });
  const packageHash = await sha256Text(JSON.stringify(revisionCompareEvidencePackageHashMaterial(packageMaterial)), cryptoRef);
  const evidencePackage = deepFreeze({ ...packageMaterial, packageId: `revision-evidence-package:${packageHash}`, contentSha256: packageHash });
  return { workspace, evidencePackage, input: { declarantName: '  Lakshman  ', declarantRole: ' Engineer ', organization: ' Example Org ' }, options: { cryptoRef }, operation };
}
export function clone(value) { return structuredClone(value); }
export async function rehash(value, idKey, prefix) { delete value[idKey]; delete value.contentSha256; const contentSha256 = await sha256Text(stableStringify(value), cryptoRef); value[idKey] = `${prefix}${contentSha256}`; value.contentSha256 = contentSha256; return value; }
