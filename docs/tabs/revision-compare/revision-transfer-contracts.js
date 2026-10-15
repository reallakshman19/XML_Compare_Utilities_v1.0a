/** Immutable Revision Compare transfer selection, operation, plan and lifecycle contracts. */
import { assertJsonSafe, cleanText, deepFreeze, stableStringify } from './revision-contract-utils.js';
import {
  REVISION_COMPARE_TRANSFER_DIRECTION,
  REVISION_COMPARE_TRANSFER_POLICY_VERSION,
} from './revision-transfer-policy.js';
export const REVISION_COMPARE_TRANSFER_SELECTION_SCHEMA = 'RevisionCompareTransferSelection.v1';
export const REVISION_COMPARE_TRANSFER_OPERATION_SCHEMA = 'RevisionCompareTransferOperation.v1';
export const REVISION_COMPARE_TRANSFER_PLAN_SCHEMA = 'RevisionCompareTransferPlan.v1';
export const REVISION_COMPARE_TRANSFER_PLAN_REQUEST_SCHEMA = 'RevisionCompareTransferPlanRequest.v1';
export const REVISION_COMPARE_TRANSFER_STATE_SCHEMA = 'RevisionCompareTransferState.v1';
export const REVISION_COMPARE_TRANSFER_AUTHORITY_SCHEMA = 'RevisionCompareTransferAuthority.v1';
export const REVISION_COMPARE_TRANSFER_PLAN_ID_PREFIX = 'revision-transfer-plan:';
export const REVISION_COMPARE_TRANSFER_OPERATION_ID_PREFIX = 'revision-transfer-operation:';
export const REVISION_COMPARE_TRANSFER_STATE_STATUS = Object.freeze({
  IDLE: 'IDLE', PLANNED: 'PLANNED', APPLYING: 'APPLYING', APPLIED: 'APPLIED',
  STALE: 'STALE', FAILED: 'FAILED',
});
export const REVISION_COMPARE_TRANSFER_OPERATION_TYPE = Object.freeze({
  REPLACE_EXISTING_PROPERTY: 'REPLACE_EXISTING_PROPERTY',
  ADD_MISSING_PROPERTY: 'ADD_MISSING_PROPERTY',
});
function canonicalEqual(left, right) { return stableStringify(left) === stableStringify(right); }
function nullableText(value) { const text = cleanText(value); return text || null; }
function fieldSelection(value) {
  const result = deepFreeze({
    propertyKey: cleanText(value?.propertyKey),
    revAEvidencePath: cleanText(value?.revAEvidencePath),
    revBEvidencePath: nullableText(value?.revBEvidencePath),
    targetFieldPath: cleanText(value?.targetFieldPath),
  });
  if (!result.propertyKey || !result.revAEvidencePath || !result.targetFieldPath) {
    throw new TypeError('Each transfer field selection requires propertyKey, Rev A evidence path, and explicit targetFieldPath.');
  }
  if (!result.targetFieldPath.startsWith('/') || result.targetFieldPath === '/') {
    throw new TypeError('Each transfer targetFieldPath must be a non-root JSON Pointer relative to the target entity.');
  }
  return result;
}
function itemSelection(value) {
  const fields = Object.freeze((value?.fields ?? []).map(fieldSelection)
    .sort((a, b) => a.propertyKey.localeCompare(b.propertyKey)
      || a.targetFieldPath.localeCompare(b.targetFieldPath)));
  const result = deepFreeze({
    differenceId: cleanText(value?.differenceId),
    sourceRecordId: cleanText(value?.sourceRecordId),
    targetRecordId: cleanText(value?.targetRecordId),
    fields,
  });
  if (!result.differenceId || !result.sourceRecordId || !result.targetRecordId || !fields.length) {
    throw new TypeError('Each transfer item requires explicit difference, source, target and field identities.');
  }
  return result;
}
export function createRevisionCompareTransferSelection(input) {
  const items = Object.freeze((input?.items ?? []).map(itemSelection)
    .sort((a, b) => a.differenceId.localeCompare(b.differenceId)
      || a.targetRecordId.localeCompare(b.targetRecordId)));
  const selection = deepFreeze({
    schema: REVISION_COMPARE_TRANSFER_SELECTION_SCHEMA,
    direction: REVISION_COMPARE_TRANSFER_DIRECTION,
    selectionRevision: Math.max(0, Math.trunc(Number(input?.selectionRevision) || 0)),
    items,
  });
  if (!items.length) throw new TypeError('Transfer selection must contain at least one explicit item.');
  const keys = items.map((item) => item.differenceId);
  if (new Set(keys).size !== keys.length) throw new TypeError('Transfer selection contains duplicate difference IDs.');
  assertJsonSafe(selection, REVISION_COMPARE_TRANSFER_SELECTION_SCHEMA);
  return selection;
}
function documentAuthority(slot) {
  const snapshot = slot?.jsonSnapshot;
  return {
    documentId: snapshot?.sourceDocumentId ?? null,
    contentSha256: snapshot?.sourceContentSha256 ?? null,
  };
}
function basisAuthority(state) {
  const basis = state?.basis;
  return {
    basisId: basis?.basisId ?? null,
    revADocumentId: basis?.revADocumentId ?? null,
    revBDocumentId: basis?.revBDocumentId ?? null,
    revAContentHash: basis?.revAContentHash ?? null,
    revBContentHash: basis?.revBContentHash ?? null,
  };
}
function auditAuthority(state) {
  const audit = state?.compare?.audit;
  return {
    auditId: audit?.auditId ?? null,
    basisId: audit?.basisId ?? null,
    revADocumentId: audit?.revADocumentId ?? null,
    revBDocumentId: audit?.revBDocumentId ?? null,
    engineVersion: audit?.engineVersion ?? null,
  };
}
function reviewAuthority(state) {
  const review = state?.review?.session;
  return {
    reviewSessionId: review?.reviewSessionId ?? null,
    auditId: review?.auditId ?? null,
    basisId: review?.basisId ?? null,
    revision: review?.revision ?? null,
    status: review?.status ?? null,
    importError: state?.review?.importError ?? null,
    replacementRequired: state?.review?.replacementRequired ?? false,
  };
}
function decisionAuthority(state) {
  const decision = state?.decision?.ledger;
  return {
    ledgerId: decision?.ledgerId ?? null,
    auditId: decision?.auditId ?? null,
    basisId: decision?.basisId ?? null,
    revision: decision?.revision ?? null,
    status: decision?.status ?? null,
    importError: state?.decision?.importError ?? null,
    replacementRequired: state?.decision?.replacementRequired ?? false,
  };
}
function activityAuthority(state) {
  return { revAIntakeStatus: state?.slots?.baseline?.status ?? 'EMPTY',
    revBIntakeStatus: state?.slots?.candidate?.status ?? 'EMPTY', comparisonStatus: state?.compare?.status ?? 'IDLE' };
}
export function captureRevisionCompareTransferAuthority(state) {
  const authority = deepFreeze({
    schema: REVISION_COMPARE_TRANSFER_AUTHORITY_SCHEMA,
    sourceDocument: documentAuthority(state?.slots?.baseline),
    receiverDocument: documentAuthority(state?.slots?.candidate),
    scope: { proposalId: state?.proposal?.proposalId ?? null, basisStatus: state?.basisStatus ?? 'NONE' },
    comparisonBasis: basisAuthority(state),
    audit: auditAuthority(state),
    reviewSession: reviewAuthority(state),
    decisionLedger: decisionAuthority(state),
    activity: activityAuthority(state),
  });
  assertJsonSafe(authority, REVISION_COMPARE_TRANSFER_AUTHORITY_SCHEMA);
  return authority;
}
export function revisionCompareTransferPlanAuthority(plan) {
  return deepFreeze({
    schema: REVISION_COMPARE_TRANSFER_AUTHORITY_SCHEMA,
    sourceDocument: {
      documentId: plan?.sourceDocument?.documentId ?? null,
      contentSha256: plan?.sourceDocument?.contentSha256 ?? null,
    },
    receiverDocument: {
      documentId: plan?.receiverDocument?.documentId ?? null,
      contentSha256: plan?.receiverDocument?.contentSha256 ?? null,
    },
    scope: plan?.scope ?? { proposalId: null, basisStatus: 'NONE' },
    comparisonBasis: plan?.comparisonBasis ?? basisAuthority(null),
    audit: plan?.audit ?? auditAuthority(null),
    reviewSession: plan?.reviewSession ?? reviewAuthority(null),
    decisionLedger: plan?.decisionLedger ?? decisionAuthority(null),
    activity: plan?.activity ?? activityAuthority(null),
  });
}
function nextCounter(state, key, label) {
  const current = Number(state?.[key] ?? 0);
  if (!Number.isSafeInteger(current) || current < 0 || current === Number.MAX_SAFE_INTEGER) {
    throw new RangeError(`${label} generation is invalid or exhausted.`);
  }
  return current + 1;
}
function nextGeneration(state) { return nextCounter(state, 'requestGeneration', 'Transfer-plan request'); }
function nextApplyGeneration(state) { return nextCounter(state, 'applyGeneration', 'Transfer apply request'); }
export function createRevisionCompareTransferState(
  policyVersion = REVISION_COMPARE_TRANSFER_POLICY_VERSION,
  authority = captureRevisionCompareTransferAuthority(null),
) {
  return deepFreeze({
    schema: REVISION_COMPARE_TRANSFER_STATE_SCHEMA,
    status: REVISION_COMPARE_TRANSFER_STATE_STATUS.IDLE,
    plan: null,
    selection: null,
    sourceDocumentId: null,
    sourceDocumentSha256: null,
    targetDocumentId: null,
    targetDocumentSha256: null,
    policyVersion,
    authority,
    requestGeneration: 0, request: null,
    applyGeneration: 0, applyAuthority: null, applyRequest: null,
    result: null, audit: null, proof: null, manifest: null,
    artifacts: Object.freeze([]), patchedSnapshot: null, error: null,
  });
}
function invalidatedStatus(state) {
  return state?.plan ? REVISION_COMPARE_TRANSFER_STATE_STATUS.STALE
    : REVISION_COMPARE_TRANSFER_STATE_STATUS.IDLE;
}
export function invalidateRevisionCompareTransferRequest(state, authority = state?.authority) {
  const current = state ?? createRevisionCompareTransferState();
  return deepFreeze({
    ...current,
    status: invalidatedStatus(current),
    authority: authority ?? captureRevisionCompareTransferAuthority(null),
    requestGeneration: nextGeneration(current), request: null,
    applyGeneration: nextApplyGeneration(current), applyRequest: null, error: null,
  });
}
export function staleRevisionCompareTransferState(state) {
  return invalidateRevisionCompareTransferRequest(state);
}
export function resetRevisionCompareTransferState(state) {
  const reset = createRevisionCompareTransferState(
    state?.policyVersion ?? REVISION_COMPARE_TRANSFER_POLICY_VERSION,
    state?.authority ?? captureRevisionCompareTransferAuthority(null),
  );
  return deepFreeze({ ...reset, requestGeneration: nextGeneration(state ?? reset),
    applyGeneration: nextApplyGeneration(state ?? reset) });
}
export function invalidateRevisionCompareTransferAuthority(state, workspace) {
  const authority = captureRevisionCompareTransferAuthority(workspace);
  if (canonicalEqual(state?.authority, authority)) return state;
  return invalidateRevisionCompareTransferRequest(state, authority);
}
export function reconcileRevisionCompareTransferAuthority(state, workspace) {
  return invalidateRevisionCompareTransferAuthority(state, workspace);
}
export function setRevisionCompareTransferSelection(state, selection) {
  if (state?.selection && canonicalEqual(state.selection, selection)) return state;
  const next = invalidateRevisionCompareTransferRequest(state);
  return deepFreeze({ ...next, selection, error: null });
}
export function setRevisionCompareTransferPolicyVersion(state, policyVersion) {
  const value = cleanText(policyVersion);
  if (!value || value === state.policyVersion) return state;
  const next = invalidateRevisionCompareTransferRequest(state);
  return deepFreeze({ ...next, policyVersion: value, error: null });
}
export function startRevisionCompareTransferPlanRequest(state, selection, authority = state?.authority) {
  let next = state ?? createRevisionCompareTransferState();
  if (!canonicalEqual(next.authority, authority)) next = invalidateRevisionCompareTransferRequest(next, authority);
  next = setRevisionCompareTransferSelection(next, selection);
  const generation = nextGeneration(next);
  const request = deepFreeze({
    schema: REVISION_COMPARE_TRANSFER_PLAN_REQUEST_SCHEMA,
    generation,
    selection: next.selection,
    policyVersion: next.policyVersion,
    authority: next.authority,
  });
  return deepFreeze({ ...next, requestGeneration: generation, request, error: null });
}
function requestMismatch(state, plan) {
  const request = state.request;
  if (!request) return 'No active transfer-plan request matches this completion.';
  if (!canonicalEqual(plan?.selection, request.selection) || !canonicalEqual(state.selection, request.selection)) {
    return 'Transfer-plan completion selection does not match the active request.';
  }
  if (plan?.policyVersion !== request.policyVersion || state.policyVersion !== request.policyVersion) {
    return 'Transfer-plan completion policy does not match the active request.';
  }
  const planAuthority = revisionCompareTransferPlanAuthority(plan);
  if (!canonicalEqual(planAuthority, request.authority) || !canonicalEqual(state.authority, request.authority)) {
    return 'Transfer-plan completion authority does not match the active request.';
  }
  return null;
}
function rejectedCompletion(state, message) {
  return deepFreeze({
    ...state,
    status: invalidatedStatus(state),
    request: null,
    error: message,
  });
}
export function completeRevisionCompareTransferPlanRequest(state, generation, plan) {
  if (!state?.request || state.requestGeneration !== generation || state.request.generation !== generation) return state;
  const mismatch = requestMismatch(state, plan);
  if (mismatch) return rejectedCompletion(state, mismatch);
  return deepFreeze({
    ...state,
    status: REVISION_COMPARE_TRANSFER_STATE_STATUS.PLANNED,
    plan,
    selection: plan.selection,
    sourceDocumentId: plan.sourceDocument.documentId,
    sourceDocumentSha256: plan.sourceDocument.contentSha256,
    targetDocumentId: plan.receiverDocument.documentId,
    targetDocumentSha256: plan.receiverDocument.contentSha256,
    policyVersion: plan.policyVersion, request: null,
    applyGeneration: nextApplyGeneration(state), applyAuthority: null, applyRequest: null,
    result: null, audit: null, proof: null, manifest: null,
    artifacts: Object.freeze([]), patchedSnapshot: null, error: null,
  });
}
export function failRevisionCompareTransferPlanRequest(state, generation, error) {
  if (!state?.request || state.requestGeneration !== generation || state.request.generation !== generation) return state;
  return rejectedCompletion(state, String(error?.message ?? error));
}
export function serializeRevisionCompareTransferPlan(plan) {
  if (plan?.schema !== REVISION_COMPARE_TRANSFER_PLAN_SCHEMA) throw new TypeError(`A ${REVISION_COMPARE_TRANSFER_PLAN_SCHEMA} is required.`);
  assertJsonSafe(plan, REVISION_COMPARE_TRANSFER_PLAN_SCHEMA); return `${stableStringify(plan)}\n`;
}
export const _test = Object.freeze({ canonicalEqual, requestMismatch });
