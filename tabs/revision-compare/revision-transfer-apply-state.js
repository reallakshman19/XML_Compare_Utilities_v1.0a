/** Authority-bound monotonic lifecycle for deterministic transfer apply work. */
import { assertJsonSafe, cleanText, deepFreeze, stableStringify } from './revision-contract-utils.js';
import {
  reconcileRevisionCompareTransferAuthority,
  REVISION_COMPARE_TRANSFER_STATE_STATUS,
} from './revision-transfer-contracts.js';
import {
  createRevisionCompareTransferApplication, REVISION_COMPARE_TRANSFER_APPLICATION_SCHEMA,
  REVISION_COMPARE_TRANSFER_RESULT_SCHEMA,
} from './revision-transfer-result.js';
import { REVISION_COMPARE_TRANSFER_ARTIFACT_SCHEMA, REVISION_COMPARE_TRANSFER_MANIFEST_SCHEMA } from './revision-transfer-artifacts.js';
import { REVISION_COMPARE_TRANSFER_AUDIT_SCHEMA, REVISION_COMPARE_TRANSFER_PROOF_SCHEMA } from './revision-transfer-verifier.js';
import { REVISION_COMPARE_JSON_DOCUMENT_SCHEMA } from './revision-json-document.js';

export const REVISION_COMPARE_TRANSFER_APPLY_REQUEST_SCHEMA = 'RevisionCompareTransferApplyRequest.v1';
export const REVISION_COMPARE_TRANSFER_APPLY_AUTHORITY_SCHEMA = 'RevisionCompareTransferApplyAuthority.v1';

function canonicalEqual(left, right) { return stableStringify(left) === stableStringify(right); }
function snapshotAuthority(slot) {
  return {
    documentId: slot?.jsonSnapshot?.sourceDocumentId ?? null,
    contentSha256: slot?.jsonSnapshot?.sourceContentSha256 ?? null,
  };
}
function basisAuthority(workspace) {
  const basis = workspace?.basis;
  return {
    basisId: basis?.basisId ?? null, revADocumentId: basis?.revADocumentId ?? null,
    revBDocumentId: basis?.revBDocumentId ?? null, revAContentHash: basis?.revAContentHash ?? null,
    revBContentHash: basis?.revBContentHash ?? null, basisStatus: workspace?.basisStatus ?? 'NONE',
  };
}
function auditAuthority(workspace) {
  const audit = workspace?.compare?.audit;
  return {
    auditId: audit?.auditId ?? null, basisId: audit?.basisId ?? null,
    revADocumentId: audit?.revADocumentId ?? null, revBDocumentId: audit?.revBDocumentId ?? null,
    engineVersion: audit?.engineVersion ?? null,
  };
}
function reviewAuthority(workspace) {
  const review = workspace?.review?.session;
  return {
    reviewSessionId: review?.reviewSessionId ?? null, auditId: review?.auditId ?? null,
    basisId: review?.basisId ?? null, revision: review?.revision ?? null,
    status: review?.status ?? null, importError: workspace?.review?.importError ?? null,
    replacementRequired: workspace?.review?.replacementRequired ?? false,
  };
}
function decisionAuthority(workspace) {
  const decision = workspace?.decision?.ledger;
  return {
    ledgerId: decision?.ledgerId ?? null, auditId: decision?.auditId ?? null,
    basisId: decision?.basisId ?? null, revision: decision?.revision ?? null,
    status: decision?.status ?? null, importError: workspace?.decision?.importError ?? null,
    replacementRequired: workspace?.decision?.replacementRequired ?? false,
  };
}
export function captureRevisionCompareTransferApplyAuthority(workspace) {
  const transfer = workspace?.transfer;
  const authority = deepFreeze({
    schema: REVISION_COMPARE_TRANSFER_APPLY_AUTHORITY_SCHEMA,
    plan: { planId: transfer?.plan?.planId ?? null, contentSha256: transfer?.plan?.contentSha256 ?? null },
    selection: transfer?.selection ?? null, policyVersion: transfer?.policyVersion ?? null,
    sourceDocument: snapshotAuthority(workspace?.slots?.baseline),
    receiverDocument: snapshotAuthority(workspace?.slots?.candidate),
    comparisonBasis: basisAuthority(workspace), audit: auditAuthority(workspace),
    reviewSession: reviewAuthority(workspace), decisionLedger: decisionAuthority(workspace),
  });
  assertJsonSafe(authority, REVISION_COMPARE_TRANSFER_APPLY_AUTHORITY_SCHEMA); return authority;
}
function nextGeneration(state) {
  const current = Number(state?.applyGeneration ?? 0);
  if (!Number.isSafeInteger(current) || current < 0 || current === Number.MAX_SAFE_INTEGER) {
    throw new RangeError('Transfer apply request generation is invalid or exhausted.');
  }
  return current + 1;
}
function exactTimestamp(value) {
  const text = cleanText(value);
  if (!text || Number.isNaN(Date.parse(text))) throw new TypeError('Transfer apply request requires an injected ISO createdAt value.');
  return text;
}
function currentApplicationMatches(state) {
  return Boolean(state?.status === REVISION_COMPARE_TRANSFER_STATE_STATUS.APPLIED
    && state.result?.status === 'READY' && state.result.planId === state.plan?.planId
    && state.result.planContentSha256 === state.plan?.contentSha256);
}
export function startRevisionCompareTransferApplyRequest(state, authority, createdAt) {
  if (currentApplicationMatches(state)) return state;
  if (state?.status !== REVISION_COMPARE_TRANSFER_STATE_STATUS.PLANNED || state.plan?.status !== 'READY') {
    throw new Error('Transfer apply can start only from one current READY PLANNED state.');
  }
  const captured = authority ?? state.applyAuthority;
  if (captured?.schema !== REVISION_COMPARE_TRANSFER_APPLY_AUTHORITY_SCHEMA
      || captured.plan?.planId !== state.plan.planId
      || captured.plan?.contentSha256 !== state.plan.contentSha256
      || !canonicalEqual(captured.selection, state.selection)
      || captured.policyVersion !== state.policyVersion) {
    throw new Error('Transfer apply authority does not match the current plan, selection, or policy.');
  }
  const generation = nextGeneration(state);
  const request = deepFreeze({
    schema: REVISION_COMPARE_TRANSFER_APPLY_REQUEST_SCHEMA, generation,
    planId: state.plan.planId, planContentSha256: state.plan.contentSha256,
    createdAt: exactTimestamp(createdAt), authority: captured,
  });
  assertJsonSafe(request, REVISION_COMPARE_TRANSFER_APPLY_REQUEST_SCHEMA);
  return deepFreeze({ ...state, status: REVISION_COMPARE_TRANSFER_STATE_STATUS.APPLYING,
    applyGeneration: generation, applyAuthority: captured, applyRequest: request, error: null });
}
export function reconcileRevisionCompareTransferApplyAuthority(state, workspace) {
  const planCurrent = reconcileRevisionCompareTransferAuthority(state, workspace);
  if (planCurrent !== state || !planCurrent?.applyRequest) return planCurrent;
  const authority = captureRevisionCompareTransferApplyAuthority(workspace);
  if (canonicalEqual(authority, planCurrent.applyRequest.authority)
      && canonicalEqual(authority, planCurrent.applyAuthority)) return planCurrent;
  return deepFreeze({ ...planCurrent, status: REVISION_COMPARE_TRANSFER_STATE_STATUS.STALE,
    applyGeneration: nextGeneration(planCurrent), applyRequest: null, error: null });
}
function parsedTextMatches(text, value) {
  try { return canonicalEqual(JSON.parse(text), value); } catch { return false; }
}
function artifactReference(artifact) {
  return {
    filename: artifact?.filename, schema: artifact?.schema, mimeType: artifact?.mimeType,
    contentSha256: artifact?.contentSha256, sizeBytes: artifact?.sizeBytes,
  };
}
function evidenceLinkMismatch(application) {
  const { result, audit, proof, manifest, patchedSnapshot, artifacts } = application;
  if (audit?.planId !== result?.planId || audit?.planContentSha256 !== result?.planContentSha256
      || audit?.createdAt !== result?.createdAt) return 'Transfer audit does not match the result identity.';
  if (proof?.planId !== result?.planId || proof?.planContentSha256 !== result?.planContentSha256
      || proof?.createdAt !== result?.createdAt) return 'Transfer proof does not match the result identity.';
  if (manifest?.planId !== result?.planId || manifest?.resultId !== result?.resultId
      || manifest?.createdAt !== result?.createdAt) return 'Transfer manifest does not match the result identity.';
  if (patchedSnapshot?.sourceDocumentId !== result?.patchedTargetDocumentId
      || patchedSnapshot?.sourceContentSha256 !== result?.patchedTargetSha256) {
    return 'Patched snapshot does not match the result target identity.';
  }
  const operationIds = audit?.rows?.map((row) => row.operationId) ?? [];
  if (!canonicalEqual(operationIds, result?.appliedOperations)
      || result?.skippedOperations?.length || result?.blockedOperations?.length) {
    return 'Transfer audit operation coverage does not match the result.';
  }
  const [patched, auditArtifact, proofArtifact, manifestArtifact] = artifacts;
  if (patched.text !== result.patchedTargetText || patched.contentSha256 !== result.patchedTargetSha256
      || patched.schema !== patchedSnapshot.profile) return 'Patched target artifact does not match the result.';
  if (!parsedTextMatches(auditArtifact.text, audit)) return 'Transfer audit artifact text does not match the audit.';
  if (!parsedTextMatches(proofArtifact.text, proof)) return 'Transfer proof artifact text does not match the proof.';
  if (!parsedTextMatches(manifestArtifact.text, manifest)) return 'Transfer manifest artifact text does not match the manifest.';
  if (!canonicalEqual(manifest.artifacts, artifacts.slice(0, 3).map(artifactReference))) {
    return 'Transfer manifest artifact references do not match the payload descriptors.';
  }
  if (manifest.manifestArtifact?.filename !== manifestArtifact.filename
      || manifest.manifestArtifact?.schema !== manifestArtifact.schema
      || manifest.manifestArtifact?.mimeType !== manifestArtifact.mimeType) {
    return 'Transfer manifest self-reference does not match its payload descriptor.';
  }
  return null;
}
function applicationMismatch(state, application) {
  if (application?.schema !== REVISION_COMPARE_TRANSFER_APPLICATION_SCHEMA) return 'A complete transfer application is required.';
  if (application.result?.planId !== state.applyRequest.planId
      || application.result?.planContentSha256 !== state.applyRequest.planContentSha256) {
    return 'Transfer application does not match the active apply request plan.';
  }
  if (application.result?.createdAt !== state.applyRequest.createdAt) {
    return 'Transfer application createdAt does not match the accepted apply request.';
  }
  if (application.result?.status !== 'READY' || application.proof?.status !== 'READY'
      || application.audit?.status !== 'READY') return 'Transfer application evidence is not READY.';
  if (application.result?.schema !== REVISION_COMPARE_TRANSFER_RESULT_SCHEMA
      || application.audit?.schema !== REVISION_COMPARE_TRANSFER_AUDIT_SCHEMA
      || application.proof?.schema !== REVISION_COMPARE_TRANSFER_PROOF_SCHEMA
      || application.manifest?.schema !== REVISION_COMPARE_TRANSFER_MANIFEST_SCHEMA
      || application.patchedSnapshot?.schema !== REVISION_COMPARE_JSON_DOCUMENT_SCHEMA) {
    return 'Transfer application contains an invalid evidence contract.';
  }
  if (!Array.isArray(application.artifacts) || application.artifacts.length !== 4
      || application.artifacts.some((item) => item?.descriptorSchema !== REVISION_COMPARE_TRANSFER_ARTIFACT_SCHEMA)) {
    return 'Transfer application artifact descriptors are incomplete or invalid.';
  }
  return evidenceLinkMismatch(application);
}
function rejectedApplication(state, message) {
  return deepFreeze({ ...state, status: REVISION_COMPARE_TRANSFER_STATE_STATUS.FAILED,
    result: null, audit: null, proof: null, manifest: null, artifacts: Object.freeze([]),
    patchedSnapshot: null, applyRequest: null, error: message });
}
export function completeRevisionCompareTransferApplyRequest(state, generation, application) {
  if (!state?.applyRequest || state.applyGeneration !== generation
      || state.applyRequest.generation !== generation) return state;
  const mismatch = applicationMismatch(state, application);
  if (mismatch) return rejectedApplication(state, mismatch);
  return deepFreeze({
    ...state, status: REVISION_COMPARE_TRANSFER_STATE_STATUS.APPLIED,
    result: application.result, audit: application.audit, proof: application.proof,
    manifest: application.manifest, artifacts: application.artifacts,
    patchedSnapshot: application.patchedSnapshot, applyRequest: null, error: null,
  });
}
export function failRevisionCompareTransferApplyRequest(state, generation, error) {
  if (!state?.applyRequest || state.applyGeneration !== generation
      || state.applyRequest.generation !== generation) return state;
  return rejectedApplication(state, String(error?.message ?? error));
}

export async function executeRevisionCompareTransferApply(workspace, createdAt, options = {}) {
  const current = reconcileRevisionCompareTransferAuthority(workspace?.transfer, workspace);
  const currentWorkspace = current === workspace?.transfer
    ? workspace : deepFreeze({ ...workspace, transfer: current });
  if (current.status === REVISION_COMPARE_TRANSFER_STATE_STATUS.STALE) return currentWorkspace;
  const authority = captureRevisionCompareTransferApplyAuthority(currentWorkspace);
  const applying = startRevisionCompareTransferApplyRequest(current, authority, createdAt);
  if (applying === current) return currentWorkspace;
  const applyingWorkspace = deepFreeze({ ...currentWorkspace, transfer: applying });
  try {
    const application = await createRevisionCompareTransferApplication(
      applyingWorkspace, { ...options, createdAt },
    );
    const completed = completeRevisionCompareTransferApplyRequest(
      applying, applying.applyGeneration, application,
    );
    return deepFreeze({ ...applyingWorkspace, transfer: completed });
  } catch (error) {
    const failed = failRevisionCompareTransferApplyRequest(
      applying, applying.applyGeneration, error,
    );
    return deepFreeze({ ...applyingWorkspace, transfer: failed });
  }
}

export const _test = Object.freeze({ applicationMismatch, canonicalEqual, currentApplicationMatches, nextGeneration });