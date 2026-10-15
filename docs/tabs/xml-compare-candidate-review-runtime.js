export const XML_COMPARE_CANDIDATE_REVIEW_RUNTIME_SCHEMA = 'xml-compare-candidate-review-runtime/v3-inert-helpers';

const clean = (value) => String(value ?? '').trim();

function basisList(value = '') {
  return clean(value).split('|').map(clean).filter(Boolean);
}

function candidateFromDataset(data = {}) {
  const sourceUid = clean(data.sourceUid);
  const targetUid = clean(data.targetUid);
  if (!sourceUid || !targetUid) return null;
  return Object.freeze({
    id: clean(data.xmlCompareCandidateRow) || `candidate:${sourceUid}=>${targetUid}`,
    sourceUid,
    targetUid,
    sourceStableKey: clean(data.sourceStable),
    targetStableKey: clean(data.targetStable),
    sourceLabel: clean(data.sourceLabel || sourceUid),
    targetLabel: clean(data.targetLabel || targetUid),
    status: clean(data.status),
    method: clean(data.method),
    basis: Object.freeze(basisList(data.basis)),
    allowDuplicateTarget: data.allowDuplicateTarget === 'true',
    score: Number(data.score || 0.85),
    identityConfidence: Number(data.score || 0.85),
  });
}

export function candidateFromApproveRejectButton(button = null) {
  return candidateFromDataset(button?.dataset || {});
}

export function candidateFromRow(row = null) {
  return candidateFromDataset(row?.dataset || {});
}

export function dispatchStateAction(detail = {}, dispatchTarget = globalThis.document) {
  if (!dispatchTarget?.dispatchEvent || typeof CustomEvent === 'undefined') return false;
  return dispatchTarget.dispatchEvent(new CustomEvent('xml-compare:state-action', { detail }));
}

export function acceptRow(row, dispatchTarget = globalThis.document) {
  const candidate = candidateFromRow(row);
  return candidate ? dispatchStateAction({ type: 'accept-candidate', candidate }, dispatchTarget) : false;
}

export function rejectRow(row, dispatchTarget = globalThis.document) {
  const candidate = candidateFromRow(row);
  return candidate ? dispatchStateAction({ type: 'reject-candidate', candidateId: candidate.id, candidate }, dispatchTarget) : false;
}

export function installXmlCompareCandidateReviewRuntime() {
  return false;
}

export const _test = Object.freeze({
  clean,
  basisList,
  candidateFromApproveRejectButton,
  candidateFromRow,
  dispatchStateAction,
  acceptRow,
  rejectRow,
  installXmlCompareCandidateReviewRuntime,
});
