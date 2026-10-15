import { CII_WORKSPACE_SCHEMAS, deepFreeze } from './cii-workspace-contracts.js';
import { qualifyCiiGeometryTransform } from './cii-workspace-geometry.js';
import { qualifyCiiMethodBRunBasis } from './cii-workspace-pipe-runs.js';

function loopStatus(status) {
  if (status === 'READY') return 'READY';
  if (status === 'INCOMPATIBLE') return 'BLOCKED';
  return 'REVIEW';
}
function methodALoop(base, index, options) {
  const anchorPairs = base?.anchorPairs || [];
  const geometry = qualifyCiiGeometryTransform(anchorPairs, { ...options, registrationProbePoints: base?.probePoints || options.registrationProbePoints || [] });
  return deepFreeze({
    schema: CII_WORKSPACE_SCHEMAS.methodABaseLoop, loopId: String(base?.baseId || `METHOD_A_${index + 1}`),
    method: 'METHOD_A_SPATIAL', combination: 'INDEPENDENT_OR_LOOP', status: loopStatus(geometry.status),
    confidence: geometry.confidence || 'REVIEW', weight: geometry.weight || null, geometry,
    anchorPairs: deepFreeze(anchorPairs.map((pair) => ({
      sourceNodeId: pair.sourceNodeId == null ? null : String(pair.sourceNodeId),
      targetNodeId: pair.targetNodeId == null ? null : String(pair.targetNodeId),
    }))),
  });
}
function methodBLoop(anchor, index, sourceGraph, targetGraph, options) {
  const evidence = qualifyCiiMethodBRunBasis(sourceGraph, targetGraph, anchor.sourceNodeId, anchor.targetNodeId, options);
  return deepFreeze({
    loopId: String(anchor?.baseId || `METHOD_B_${index + 1}`), method: 'METHOD_B_NETWORK', combination: 'INDEPENDENT_OR_LOOP',
    status: evidence.status, weight: evidence.weight || null, evidence,
    anchorPairs: Object.freeze([{ sourceNodeId: String(anchor.sourceNodeId), targetNodeId: String(anchor.targetNodeId) }]),
  });
}
function readyClaims(loops) {
  return loops.filter((loop) => loop.status === 'READY').flatMap((loop) => (loop.anchorPairs || []).flatMap((pair) => {
    if (pair.sourceNodeId == null || pair.targetNodeId == null) return [];
    return [{ loopId: loop.loopId, method: loop.method, sourceNodeId: String(pair.sourceNodeId), targetNodeId: String(pair.targetNodeId) }];
  }));
}
function conflictRows(claims, keyField, valueField, kind) {
  const grouped = new Map();
  for (const claim of claims) {
    const key = claim[keyField]; if (!grouped.has(key)) grouped.set(key, []); grouped.get(key).push(claim);
  }
  const conflicts = [];
  for (const [key, rows] of grouped.entries()) {
    const values = [...new Set(rows.map((row) => row[valueField]))];
    if (values.length > 1) conflicts.push({ kind, key, values, claims: rows });
  }
  return conflicts;
}
function identityConflicts(loops) {
  const claims = readyClaims(loops);
  return [
    ...conflictRows(claims, 'sourceNodeId', 'targetNodeId', 'SOURCE_TO_MULTIPLE_TARGETS'),
    ...conflictRows(claims, 'targetNodeId', 'sourceNodeId', 'TARGET_TO_MULTIPLE_SOURCES'),
  ];
}

export function qualifyCiiMultiBaseAuthority(input = {}, options = {}) {
  const methodA = (input.methodABases || []).map((base, index) => methodALoop(base, index, options));
  const methodB = (input.methodBAnchors || []).map((anchor, index) => methodBLoop(anchor, index, input.sourceGraph, input.targetGraph, options));
  const loops = [...methodA, ...methodB]; const conflicts = identityConflicts(loops);
  const readyLoopCount = loops.filter((loop) => loop.status === 'READY').length;
  const status = conflicts.length ? 'AMBIGUOUS' : (readyLoopCount ? 'READY' : (loops.length ? 'REVIEW' : 'UNAVAILABLE'));
  return deepFreeze({
    schema: CII_WORKSPACE_SCHEMAS.multiBaseAuthority, status, combination: 'OR_WITH_CONFLICT_VETO',
    authority: 'EVIDENCE_ONLY_ENGINEER_ACCEPT_REQUIRED', readyLoopCount, loopCount: loops.length,
    methodAReadyCount: methodA.filter((loop) => loop.status === 'READY').length,
    methodBReadyCount: methodB.filter((loop) => loop.status === 'READY').length,
    loops, conflicts,
    reason: conflicts.length ? 'CROSS_LOOP_ANCHOR_IDENTITY_CONFLICT' : (readyLoopCount ? 'AT_LEAST_ONE_INDEPENDENT_BASE_LOOP_READY' : 'NO_INDEPENDENT_BASE_LOOP_READY'),
  });
}
