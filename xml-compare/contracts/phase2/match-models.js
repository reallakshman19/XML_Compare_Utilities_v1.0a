import {
  APPROVED_MATCH_SET_SCHEMA,
  APPROVED_STATUSES,
  DEFAULT_TRANSFORM_POLICY,
  MATCH_CANDIDATE_SET_SCHEMA,
  MATCH_DECISION_SCHEMA,
  TRANSFORM_POLICY_SCHEMA,
  TOLERANCE_BUCKETS,
  clean,
  cloneArray,
  diagnostic,
  finite,
  pairKey,
  stableHash,
} from './shared.js';

export function createTransformPolicy(input = {}) {
  const allowed = Array.isArray(input.allowedTransforms) && input.allowedTransforms.length
    ? input.allowedTransforms.map(clean).filter(Boolean)
    : [...DEFAULT_TRANSFORM_POLICY.allowedTransforms];
  return Object.freeze({
    schema: TRANSFORM_POLICY_SCHEMA,
    allowedTransforms: Object.freeze(allowed),
    blockFreeAxisPermutation: input.blockFreeAxisPermutation !== false,
    diagnosticFreeSearchAllowed: input.diagnosticFreeSearchAllowed !== false,
    approved: Boolean(input.approved),
    approvalBasis: clean(input.approvalBasis),
  });
}

function toleranceBucket(deltaMm = Number.POSITIVE_INFINITY, tolerance = TOLERANCE_BUCKETS) {
  const d = finite(deltaMm, Number.POSITIVE_INFINITY);
  if (d <= finite(tolerance.exact, TOLERANCE_BUCKETS.exact)) return 'exact';
  if (d <= finite(tolerance.approx1, TOLERANCE_BUCKETS.approx1)) return 'approx1';
  if (d <= finite(tolerance.approx2, TOLERANCE_BUCKETS.approx2)) return 'approx2';
  if (d <= finite(tolerance.approx3, TOLERANCE_BUCKETS.approx3)) return 'approx3';
  return 'rejected';
}

function bucketRank(bucket = '') {
  return { exact: 0, approx1: 1, approx2: 2, approx3: 3, rejected: 99 }[bucket] ?? 99;
}

function withSecondBest(candidates = []) {
  const bySource = new Map();
  for (const candidate of candidates) {
    const key = clean(candidate.sourceUid);
    if (!bySource.has(key)) bySource.set(key, []);
    bySource.get(key).push(candidate);
  }
  const secondBest = new Map();
  for (const [sourceUid, rows] of bySource.entries()) {
    const sorted = [...rows].sort((a, b) => bucketRank(a.toleranceBucket) - bucketRank(b.toleranceBucket) || a.deltaMm - b.deltaMm);
    secondBest.set(sourceUid, sorted[1]?.deltaMm ?? null);
  }
  return candidates.map((candidate) => Object.freeze({
    ...candidate,
    secondBestDeltaMm: candidate.secondBestDeltaMm ?? secondBest.get(clean(candidate.sourceUid)),
  }));
}

function ambiguousPairSet(candidates = []) {
  const ambiguous = new Set();
  const bySource = new Map();
  for (const candidate of candidates.filter((item) => item.status !== 'rejected')) {
    const sourceUid = clean(candidate.sourceUid);
    if (!bySource.has(sourceUid)) bySource.set(sourceUid, []);
    bySource.get(sourceUid).push(candidate);
  }
  for (const rows of bySource.values()) markAmbiguousBucket(rows, ambiguous);
  return ambiguous;
}

function markAmbiguousBucket(rows, ambiguous) {
  const sorted = [...rows].sort((a, b) => bucketRank(a.toleranceBucket) - bucketRank(b.toleranceBucket) || a.deltaMm - b.deltaMm);
  const topBucket = sorted[0]?.toleranceBucket;
  const topRows = sorted.filter((item) => item.toleranceBucket === topBucket);
  if (topRows.length > 1) topRows.forEach((item) => ambiguous.add(pairKey(item.sourceUid, item.targetUid)));
}

function conflictPairSet(candidates = []) {
  const conflicts = new Set();
  const byTarget = new Map();
  for (const candidate of candidates.filter((item) => item.status !== 'rejected' && !item.allowDuplicateTarget)) {
    const targetUid = clean(candidate.targetUid);
    if (!byTarget.has(targetUid)) byTarget.set(targetUid, []);
    byTarget.get(targetUid).push(candidate);
  }
  for (const rows of byTarget.values()) {
    const sources = new Set(rows.map((item) => clean(item.sourceUid)));
    if (sources.size > 1) rows.forEach((item) => conflicts.add(pairKey(item.sourceUid, item.targetUid)));
  }
  return conflicts;
}

function normalizeCandidate(candidate, tolerance) {
  const deltaMm = finite(candidate.deltaMm ?? candidate.delta?.maxAbs ?? candidate.delta?.srss, Number.POSITIVE_INFINITY);
  const status = clean(candidate.status || 'candidate');
  return Object.freeze({
    sourceUid: clean(candidate.sourceUid),
    targetUid: clean(candidate.targetUid),
    sourceStableKey: clean(candidate.sourceStableKey || candidate.sourceUid),
    targetStableKey: clean(candidate.targetStableKey || candidate.targetUid),
    basis: Object.freeze([...(Array.isArray(candidate.basis) ? candidate.basis : [candidate.basis || 'unspecified']).map(clean).filter(Boolean)]),
    score: finite(candidate.score, 0),
    deltaMm,
    secondBestDeltaMm: candidate.secondBestDeltaMm == null ? null : finite(candidate.secondBestDeltaMm, null),
    identityConfidence: finite(candidate.identityConfidence ?? candidate.confidence, 0),
    coordinateFrameOk: candidate.coordinateFrameOk !== false,
    transformBasis: clean(candidate.transformBasis || candidate.transform?.basis || 'identity-offset'),
    allowDuplicateTarget: Boolean(candidate.allowDuplicateTarget),
    toleranceBucket: toleranceBucket(deltaMm, tolerance),
    status: status === 'rejected' ? 'rejected' : 'candidate',
    diagnostics: cloneArray(candidate.diagnostics || []),
  });
}

export function createMatchCandidateSet({ sourceId = 'source', targetId = 'target', candidates = [], tolerance = TOLERANCE_BUCKETS, transformPolicy = null } = {}) {
  const initial = (Array.isArray(candidates) ? candidates : []).map((item) => normalizeCandidate(item, tolerance)).filter((item) => item.sourceUid && item.targetUid);
  const withBest = withSecondBest(initial);
  const ambiguous = ambiguousPairSet(withBest);
  const conflicts = conflictPairSet(withBest);
  const normalized = withBest.map((candidate) => withStatus(candidate, ambiguous, conflicts));
  return Object.freeze({
    schema: MATCH_CANDIDATE_SET_SCHEMA,
    sourceId: clean(sourceId),
    targetId: clean(targetId),
    transformPolicy: createTransformPolicy(transformPolicy || {}),
    candidates: Object.freeze(normalized),
    summary: summarizeCandidates(normalized),
  });
}

function withStatus(candidate, ambiguous, conflicts) {
  const key = pairKey(candidate.sourceUid, candidate.targetUid);
  const status = candidate.status === 'rejected' ? 'rejected' : ambiguous.has(key) ? 'ambiguous' : conflicts.has(key) ? 'conflict' : 'candidate';
  return Object.freeze({ ...candidate, status });
}

function summarizeCandidates(candidates) {
  return Object.freeze({
    candidateCount: candidates.length,
    ambiguousCount: candidates.filter((item) => item.status === 'ambiguous').length,
    conflictCount: candidates.filter((item) => item.status === 'conflict').length,
    rejectedCount: candidates.filter((item) => item.status === 'rejected').length,
  });
}

export function createMatchDecision(input = {}) {
  const decision = clean(input.decision);
  return Object.freeze({
    schema: MATCH_DECISION_SCHEMA,
    sourceUid: clean(input.sourceUid),
    targetUid: clean(input.targetUid),
    decision: ['approved', 'rejected', 'needs-review'].includes(decision) ? decision : 'needs-review',
    decisionBasis: clean(input.decisionBasis || 'manual-review'),
    reviewer: clean(input.reviewer),
    createdAt: clean(input.createdAt || new Date(0).toISOString()),
    confidence: finite(input.confidence, 0),
    diagnostics: cloneArray(input.diagnostics || []),
  });
}

export function createApprovedMatchSet({ sourceGraph = null, targetGraph = null, decisions = [], candidateSet = null, transformPolicy = null } = {}) {
  const policy = createTransformPolicy(transformPolicy || candidateSet?.transformPolicy || {});
  const candidatesByPair = new Map((candidateSet?.candidates || []).map((candidate) => [pairKey(candidate.sourceUid, candidate.targetUid), candidate]));
  const state = { approved: [], rejected: [], ambiguous: [], diagnostics: [] };
  for (const decision of (Array.isArray(decisions) ? decisions : []).map(createMatchDecision)) processDecision(decision, candidatesByPair, state);
  return approvedSetResult(sourceGraph, targetGraph, policy, state);
}

function processDecision(decision, candidatesByPair, state) {
  const candidate = candidatesByPair.get(pairKey(decision.sourceUid, decision.targetUid));
  if (decision.decision === 'rejected') return state.rejected.push(Object.freeze({ sourceUid: decision.sourceUid, targetUid: decision.targetUid, decision }));
  if (!APPROVED_STATUSES.has(decision.decision)) return null;
  if (!candidate) return state.diagnostics.push(diagnostic('BLOCKER', 'MATCH_CANDIDATE_MISSING', 'Approved decision references a missing candidate.', { sourceUid: decision.sourceUid, targetUid: decision.targetUid }));
  if (candidate.status === 'ambiguous' || candidate.status === 'conflict') return blockCandidateDecision(decision, candidate, state);
  return state.approved.push(approvedMatch(decision, candidate));
}

function blockCandidateDecision(decision, candidate, state) {
  state.ambiguous.push(Object.freeze({ sourceUid: decision.sourceUid, targetUid: decision.targetUid, status: candidate.status, decision, candidate }));
  return state.diagnostics.push(diagnostic('BLOCKER', candidate.status === 'ambiguous' ? 'MATCH_AMBIGUOUS' : 'MATCH_CONFLICT', 'Approved decision is blocked by candidate status.', { sourceUid: decision.sourceUid, targetUid: decision.targetUid, status: candidate.status }));
}

function approvedMatch(decision, candidate) {
  return Object.freeze({
    sourceUid: decision.sourceUid,
    targetUid: decision.targetUid,
    sourceStableKey: clean(candidate.sourceStableKey || decision.sourceUid),
    targetStableKey: clean(candidate.targetStableKey || decision.targetUid),
    matchType: clean(decision.decisionBasis || 'manual'),
    confidence: Math.max(finite(decision.confidence, 0), finite(candidate.score, 0), finite(candidate.identityConfidence, 0)),
    identityConfidence: finite(candidate.identityConfidence, 0),
    coordinateDeltaMm: finite(candidate.deltaMm, null),
    allowDuplicateTarget: Boolean(candidate.allowDuplicateTarget),
    basis: cloneArray(candidate.basis || []),
    transformBasis: clean(candidate.transformBasis),
    reviewerStatus: decision.decision,
    diagnostics: cloneArray([...candidate.diagnostics, ...decision.diagnostics]),
  });
}

function approvedSetResult(sourceGraph, targetGraph, policy, state) {
  return Object.freeze({
    schema: APPROVED_MATCH_SET_SCHEMA,
    sourceGraphHash: stableHash(sourceGraph || {}),
    targetGraphHash: stableHash(targetGraph || {}),
    transformPolicy: policy,
    approvedMatches: Object.freeze(state.approved),
    rejectedMatches: Object.freeze(state.rejected),
    ambiguousMatches: Object.freeze(state.ambiguous),
    diagnostics: Object.freeze(state.diagnostics),
    summary: Object.freeze({
      approvedCount: state.approved.length,
      rejectedCount: state.rejected.length,
      ambiguousCount: state.ambiguous.length,
      blockerCount: state.diagnostics.filter((item) => item.severity === 'BLOCKER').length,
    }),
  });
}

export const _testMatchModels = Object.freeze({ toleranceBucket, bucketRank, ambiguousPairSet, conflictPairSet });
