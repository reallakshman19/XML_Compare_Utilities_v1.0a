/** Deterministic transfer result and complete apply evidence orchestration. */
import { assertJsonSafe, cleanText, deepFreeze, stableStringify } from './revision-contract-utils.js';
import { sha256Text } from './revision-hash.js';
import { createRevisionCompareTransferArtifacts } from './revision-transfer-artifacts.js';
import { verifyRevisionCompareTransferApplication } from './revision-transfer-verifier.js';
import { writeRevisionComparePatchedTarget } from './revision-transfer-writer.js';

export const REVISION_COMPARE_TRANSFER_RESULT_SCHEMA = 'RevisionCompareTransferResult.v1';
export const REVISION_COMPARE_TRANSFER_APPLICATION_SCHEMA = 'RevisionCompareTransferApplication.v1';
const RESULT_PREFIX = 'revision-transfer-result:';

function exactTimestamp(value) {
  const text = cleanText(value);
  if (!text || Number.isNaN(Date.parse(text))) throw new TypeError('Transfer apply createdAt must be an injected ISO timestamp.');
  return text;
}
function operationIds(entries) {
  return Object.freeze(entries.map((entry) => entry.operation.operationId));
}
async function resultIdentity(material, cryptoRef) {
  const contentSha256 = await sha256Text(stableStringify(material), cryptoRef);
  return { contentSha256, resultId: `${RESULT_PREFIX}${contentSha256}` };
}
export async function createRevisionCompareTransferResult(input, options = {}) {
  const cryptoRef = options.cryptoRef ?? globalThis.crypto;
  const appliedOperations = operationIds(input.written.validatedOperations);
  if (appliedOperations.length !== input.written.plan.operations.length) {
    throw new Error('Successful transfer result must account for every plan operation.');
  }
  const material = {
    schema: REVISION_COMPARE_TRANSFER_RESULT_SCHEMA,
    planId: input.written.plan.planId, planContentSha256: input.written.plan.contentSha256,
    sourceDocumentId: input.written.plan.sourceDocument.documentId,
    sourceDocumentSha256: input.written.plan.sourceDocument.contentSha256,
    targetDocumentId: input.written.plan.receiverDocument.documentId,
    originalTargetSha256: input.written.plan.receiverDocument.contentSha256,
    patchedTargetDocumentId: input.written.patchedTargetDocumentId,
    patchedTargetSha256: input.written.patchedTargetSha256,
    patchedTargetText: input.written.patchedTargetText,
    appliedOperations, skippedOperations: Object.freeze([]), blockedOperations: Object.freeze([]),
    summary: deepFreeze({
      planOperationCount: input.written.plan.operations.length,
      appliedOperationCount: appliedOperations.length, skippedOperationCount: 0, blockedOperationCount: 0,
    }),
    validation: deepFreeze({ status: 'READY', errors: Object.freeze([]) }),
    createdAt: input.createdAt, status: 'READY', errors: Object.freeze([]),
  };
  const identity = await resultIdentity(material, cryptoRef);
  const result = deepFreeze({ ...material, ...identity });
  assertJsonSafe(result, REVISION_COMPARE_TRANSFER_RESULT_SCHEMA); return result;
}

export async function createRevisionCompareTransferApplication(workspace, options = {}) {
  const cryptoRef = options.cryptoRef ?? globalThis.crypto; const createdAt = exactTimestamp(options.createdAt);
  if (workspace?.transfer?.status === 'APPLYING'
      && workspace.transfer.applyRequest?.createdAt !== createdAt) {
    throw new Error('Transfer application createdAt must match the accepted apply request.');
  }
  const written = await writeRevisionComparePatchedTarget(workspace, { cryptoRef });
  const verified = await verifyRevisionCompareTransferApplication({ ...written, createdAt }, { cryptoRef });
  const result = await createRevisionCompareTransferResult({ written, createdAt }, { cryptoRef });
  const artifactBundle = await createRevisionCompareTransferArtifacts({
    result, audit: verified.audit, proof: verified.proof,
    targetFileName: written.originalSnapshot.fileName, patchedSnapshot: written.patchedSnapshot,
  }, { cryptoRef });
  const application = deepFreeze({
    schema: REVISION_COMPARE_TRANSFER_APPLICATION_SCHEMA, result,
    audit: verified.audit, proof: verified.proof, manifest: artifactBundle.manifest,
    artifacts: artifactBundle.artifacts, patchedSnapshot: written.patchedSnapshot,
  });
  assertJsonSafe(application, REVISION_COMPARE_TRANSFER_APPLICATION_SCHEMA); return application;
}

export const _test = Object.freeze({ exactTimestamp, operationIds });
