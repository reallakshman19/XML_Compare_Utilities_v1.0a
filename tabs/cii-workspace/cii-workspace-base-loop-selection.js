import { deepFreeze } from './cii-workspace-contracts.js';

function text(value) { return String(value ?? '').trim(); }
function pair(sourceNodeId, targetNodeId) {
  return Object.freeze({ sourceNodeId: text(sourceNodeId), targetNodeId: text(targetNodeId) });
}
function pairKey(value) { return `${text(value?.sourceNodeId)}=>${text(value?.targetNodeId)}`; }
export function ciiSuggestionSelectionKey(row) { return pairKey(row); }

function methodIncludesA(method) { return method === 'METHOD_A_SPATIAL' || method === 'METHOD_A_AND_B'; }
function methodIncludesB(method) { return method === 'METHOD_B_NETWORK' || method === 'METHOD_A_AND_B'; }
function reviewDiscoveryOnly(row) {
  return text(row?.candidateGeneration?.authorityRole) === 'REVIEW_DISCOVERY_ONLY_NOT_IDENTITY_AUTHORITY'
    || row?.candidateGeneration?.reviewDiscovery?.reviewOnly === true;
}
function validAnchorPairs(rows) {
  return (rows || []).map((row) => pair(row?.sourceNodeId, row?.targetNodeId))
    .filter((row) => row.sourceNodeId && row.targetNodeId);
}
function methodALoop(row) {
  const method = text(row?.basisMethod); const evidence = row?.methodA; const base = evidence?.bestBase;
  if (!methodIncludesA(method) || evidence?.status !== 'READY' || !base?.baseId) return null;
  const anchorPairs = validAnchorPairs(base.anchorPairs);
  if (anchorPairs.length < 3) return null;
  return Object.freeze({ method: 'METHOD_A_SPATIAL', baseId: text(base.baseId), anchorPairs: Object.freeze(anchorPairs) });
}
function methodBLoop(row) {
  const method = text(row?.basisMethod); const evidence = row?.methodB;
  if (!methodIncludesB(method) || evidence?.status !== 'READY') return null;
  const sourceNodeId = text(row?.sourceNodeId); const targetNodeId = text(row?.targetNodeId);
  if (!sourceNodeId || !targetNodeId) return null;
  return Object.freeze({
    method: 'METHOD_B_NETWORK', baseId: `METHOD_B_ACCEPTED_${sourceNodeId}_${targetNodeId}`,
    anchorPairs: Object.freeze([pair(sourceNodeId, targetNodeId)]),
  });
}

export function ciiQualifiedLoopsForSuggestion(row) {
  if (reviewDiscoveryOnly(row)) return deepFreeze([]);
  return deepFreeze([methodALoop(row), methodBLoop(row)].filter(Boolean));
}
function loopKey(loop) {
  if (loop.method === 'METHOD_A_SPATIAL') return `A:${loop.baseId}`;
  return `B:${pairKey(loop.anchorPairs?.[0])}`;
}
export function buildCiiSelectedBaseLoops(suggestions = [], selectedKeys = []) {
  const selected = new Set([...selectedKeys].map(text)); const loops = new Map();
  for (const row of suggestions || []) {
    if (!selected.has(ciiSuggestionSelectionKey(row))) continue;
    for (const loop of ciiQualifiedLoopsForSuggestion(row)) if (!loops.has(loopKey(loop))) loops.set(loopKey(loop), loop);
  }
  return deepFreeze([...loops.values()]);
}

const AUTO_CONFIDENCE_RANK = Object.freeze({ HIGH: 3, MEDIUM: 2, REVIEW: 1 });
const AUTO_BASIS_RANK = Object.freeze({ METHOD_A_AND_B: 3, METHOD_A_SPATIAL: 2, METHOD_B_NETWORK: 1 });
function autoStrength(row) {
  return Math.max(Number(row?.methodA?.bestBase?.weight?.total || 0), Number(row?.methodBWeight?.total || 0));
}
function autoEvidenceTuple(row) {
  return Object.freeze([
    AUTO_CONFIDENCE_RANK[text(row?.confidence).toUpperCase()] || 0,
    AUTO_BASIS_RANK[text(row?.basisMethod).toUpperCase()] || 0,
    autoStrength(row),
    Number(row?.winnerGap || 0),
    Number(row?.score || 0),
  ]);
}
function compareEvidenceTuple(left, right) {
  for (let index = 0; index < left.length; index += 1) if (left[index] !== right[index]) return right[index] - left[index];
  return 0;
}
function automaticCandidate(row, minimumConfidence) {
  if (reviewDiscoveryOnly(row) || !ciiQualifiedLoopsForSuggestion(row).length) return false;
  return (AUTO_CONFIDENCE_RANK[text(row?.confidence).toUpperCase()] || 0) >= minimumConfidence;
}
function autoOutcomeSignature(row) {
  return ciiQualifiedLoopsForSuggestion(row).map(loopKey).sort().join('|');
}
function automaticCandidateOrder(left, right) {
  return compareEvidenceTuple(autoEvidenceTuple(left), autoEvidenceTuple(right))
    || autoOutcomeSignature(left).localeCompare(autoOutcomeSignature(right), undefined, { numeric: true })
    || pairKey(left).localeCompare(pairKey(right), undefined, { numeric: true });
}
export function ciiAutomaticBaseSelection(suggestions = [], options = {}) {
  const minimumName = text(options.minimumConfidence || 'MEDIUM').toUpperCase();
  const minimumConfidence = AUTO_CONFIDENCE_RANK[minimumName] || AUTO_CONFIDENCE_RANK.MEDIUM;
  const candidates = (suggestions || []).filter((row) => automaticCandidate(row, minimumConfidence)).sort(automaticCandidateOrder);
  if (!candidates.length) return deepFreeze({
    status: 'REVIEW_REQUIRED', reason: 'NO_HIGH_OR_MEDIUM_QUALIFIED_TOPOLOGY_BASE',
    selectionKeys: deepFreeze([]), baseLoops: deepFreeze([]), candidates: deepFreeze([]),
  });
  const winner = candidates[0]; const winnerTuple = autoEvidenceTuple(winner);
  const tied = candidates.filter((row) => compareEvidenceTuple(winnerTuple, autoEvidenceTuple(row)) === 0);
  const outcomeSignatures = [...new Set(tied.map(autoOutcomeSignature))];
  if (outcomeSignatures.length > 1) return deepFreeze({
    status: 'AMBIGUOUS', reason: 'EQUALLY_STRONG_DIFFERENT_TOPOLOGY_OUTCOMES',
    selectionKeys: deepFreeze([]), baseLoops: deepFreeze([]),
    candidates: deepFreeze(tied.map((row) => deepFreeze({
      selectionKey: ciiSuggestionSelectionKey(row), sourceNodeId: text(row?.sourceNodeId), targetNodeId: text(row?.targetNodeId),
      confidence: text(row?.confidence), basisMethod: text(row?.basisMethod), outcomeSignature: autoOutcomeSignature(row),
    }))),
  });
  const selectionKey = ciiSuggestionSelectionKey(winner);
  const baseLoops = buildCiiSelectedBaseLoops(suggestions, [selectionKey]);
  return deepFreeze({
    status: 'READY', reason: 'STRONGEST_QUALIFIED_TOPOLOGY_BASE',
    selectionKeys: deepFreeze([selectionKey]), baseLoops,
    sourceNodeId: text(winner?.sourceNodeId), targetNodeId: text(winner?.targetNodeId),
    confidence: text(winner?.confidence), basisMethod: text(winner?.basisMethod),
    evidenceTuple: winnerTuple, outcomeSignature: autoOutcomeSignature(winner),
    candidates: deepFreeze(candidates.map((row) => ciiSuggestionSelectionKey(row))),
  });
}

export function ciiSelectedAnchorPairs(baseLoops = []) {
  const rows = new Map();
  for (const loop of baseLoops || []) for (const item of loop.anchorPairs || []) {
    const key = pairKey(item); if (item.sourceNodeId && item.targetNodeId && !rows.has(key)) rows.set(key, pair(item.sourceNodeId, item.targetNodeId));
  }
  return deepFreeze([...rows.values()]);
}
export function ciiBaseSelectionSummary(baseLoops = []) {
  const methodA = (baseLoops || []).filter((loop) => loop.method === 'METHOD_A_SPATIAL').length;
  const methodB = (baseLoops || []).filter((loop) => loop.method === 'METHOD_B_NETWORK').length;
  return deepFreeze({ loopCount: methodA + methodB, methodA, methodB, combination: 'OR_WITH_CONFLICT_VETO' });
}
export function ciiApplyBaseSelection(baseInput, baseLoops, legacyAnchorPairs) {
  const { anchorPairs: _anchors, baseLoops: _loops, ...rest } = baseInput || {};
  if (Array.isArray(baseLoops) && baseLoops.length) return { ...rest, baseLoops };
  return { ...rest, anchorPairs: legacyAnchorPairs };
}

export const _test = Object.freeze({
  methodALoop, methodBLoop, loopKey, pairKey, reviewDiscoveryOnly,
  autoStrength, autoEvidenceTuple, compareEvidenceTuple, automaticCandidate, autoOutcomeSignature, automaticCandidateOrder,
});
