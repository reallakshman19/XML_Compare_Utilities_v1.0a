export const CII_WORKSPACE_SCHEMAS = Object.freeze({
  document: 'CIIWorkspaceDocument.v1',
  graph: 'CIIWorkspaceGraph.v1',
  anchor: 'CIIWorkspaceAnchor.v1',
  baseAnchorSuggestion: 'CIIWorkspaceBaseAnchorSuggestion.v1',
  multiBaseAuthority: 'CIIWorkspaceMultiBaseAuthority.v1',
  methodABaseLoop: 'CIIWorkspaceMethodABaseLoop.v1',
  methodBRunBasis: 'CIIWorkspaceMethodBRunBasis.v1',
  candidateEvidence: 'CIIWorkspaceCandidateEvidence.v1',
  correspondence: 'CIIWorkspaceCorrespondence.v1',
  engineeringDeltaSet: 'CIIWorkspaceEngineeringDeltaSet.v1',
  compareReview: 'CIIWorkspaceCompareReview.v1',
  reviewLedger: 'CIIWorkspaceReviewLedger.v1',
  transferPlan: 'CIIWorkspaceTransferPlan.v1',
  transferOperation: 'CIIWorkspaceTransferOperation.v1',
  transferScope: 'CIIWorkspaceTransferScope.v1',
  transferScopeSelection: 'CIIWorkspaceTransferScopeSelection.v1',
  audit: 'CIIWorkspaceAudit.v1',
  stage: 'CIIWorkspaceStage.v1',
  inspection: 'CIIWorkspaceInspection.v1',
  landmarkSuggestion: 'CIIWorkspaceLandmarkSuggestion.v1',
});

export const CII_WORKSPACE_STAGES = Object.freeze([
  Object.freeze({ id: '01', label: 'Intake & model summary' }),
  Object.freeze({ id: '02', label: 'Anchors' }),
  Object.freeze({ id: '03', label: 'Topology / path match' }),
  Object.freeze({ id: '04', label: 'Correspondence review' }),
  Object.freeze({ id: '05', label: 'Property-transfer preview' }),
  Object.freeze({ id: '06', label: 'Apply to target CII' }),
  Object.freeze({ id: '07', label: 'Validation & export' }),
]);

export function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const item of Object.values(value)) deepFreeze(item);
  return value;
}

export function stableStringify(value) {
  const normalize = (item) => {
    if (Array.isArray(item)) return item.map(normalize);
    if (!item || typeof item !== 'object') return item;
    if (item instanceof Map) return normalize(Object.fromEntries([...item.entries()].sort(([a], [b]) => String(a).localeCompare(String(b)))));
    if (item instanceof Set) return normalize([...item].sort());
    return Object.fromEntries(Object.keys(item).sort().map((key) => [key, normalize(item[key])]));
  };
  return JSON.stringify(normalize(value));
}

export function stableId(prefix, ...parts) {
  return `${prefix}:${parts.map((part) => String(part ?? '').trim()).join(':')}`;
}

export function numericKey(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : Number.POSITIVE_INFINITY;
}

export function compareNodeIds(a, b) {
  const numeric = numericKey(a) - numericKey(b);
  return numeric || String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

export function uniqueStrings(values) {
  return [...new Set((values || []).map((value) => String(value ?? '').trim()).filter(Boolean))].sort();
}
