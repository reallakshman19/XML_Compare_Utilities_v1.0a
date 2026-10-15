import { deepFreeze } from './cii-workspace-contracts.js';
import { propagateSingleCiiAnchorCorrespondence } from './cii-workspace-propagation.js';
import { compareLockedCiiAnchorSpan } from './cii-workspace-topology.js';
import { qualifyCiiMethodATerminalContinuation } from './cii-workspace-terminal-continuation.js';
import { arbitrateCiiLoopCorrespondences, arbitrateCiiSeedCorrespondences } from './cii-workspace-correspondence-arbitration.js';

function blockedCorrespondence(reason) {
  return deepFreeze({ schema: 'CIIWorkspaceCorrespondence.v1', status: 'BLOCKED', blockers: Object.freeze([reason]),
    targetCustodyConflicts: Object.freeze([]), nodeRows: Object.freeze([]), elementRows: Object.freeze([]) });
}
function anchorPairs(loop) {
  return (loop?.anchorPairs || []).map((pair) => ({ sourceNodeId: String(pair.sourceNodeId), targetNodeId: String(pair.targetNodeId) }));
}
function methodAConfidence(loop) {
  return ['HIGH', 'MEDIUM'].includes(loop?.confidence) ? loop.confidence : null;
}
function methodAQualification(loop) {
  const weight = loop?.weight;
  if (!weight || !Number.isFinite(Number(weight.total))) return null;
  return deepFreeze({
    loopId: String(loop?.loopId || loop?.baseId || ''),
    score: Number(weight.total),
    highThreshold: Number(weight.confidenceThresholds?.high ?? 85),
    mediumThreshold: Number(weight.confidenceThresholds?.medium ?? 70),
    anchorCount: (loop?.anchorPairs || []).length,
    residualQuality: weight.residualQuality,
    conditioning: weight.conditioning,
    spatialExtent: weight.spatialExtent,
    redundancy: weight.redundancy,
    basisConsensus: weight.basisConsensus,
    weights: weight.confidenceWeights || null,
  });
}
function anchorPairKey(sourceNodeId, targetNodeId) { return `${String(sourceNodeId)}=>${String(targetNodeId)}`; }
function projectMethodAAnchorRow(row, loop, anchorKeys) {
  const isAnchor = row?.kind === 'NODE' && anchorKeys.has(anchorPairKey(row.sourceNodeId, row.targetNodeId));
  if (!isAnchor || row.status !== 'LOCKED' || row.authority !== 'USER_LOCKED_ANCHOR') return row;
  const confidence = methodAConfidence(loop); const loopId = String(loop?.loopId || loop?.baseId || '');
  return deepFreeze({ ...row, status: 'REVIEW', authority: 'METHOD_A_QUALIFIED_ANCHOR',
    evidence: deepFreeze({ ...(row.evidence || {}), identitySupported: Boolean(confidence),
      identityConfidence: confidence || 'REVIEW', identityEvidenceBasis: 'METHOD_A_QUALIFIED_BASE_ANCHOR', methodALoopId: loopId,
      methodAQualification: methodAQualification(loop) }) });
}
function highIdentityEvidence(evidence) {
  return evidence?.identitySupported === true && evidence?.identityConfidence === 'HIGH';
}
function projectMethodABoundaryRow(row, loop) {
  if (row?.kind !== 'NODE' || row.authority !== 'ADJACENT_MATCH_BOUNDARY') return row;
  if (['CONFLICT', 'UNRESOLVED'].includes(row.status)) return row;
  const confidence = methodAConfidence(loop);
  const wholeEdgeSupported = highIdentityEvidence(row.evidence?.leftElement)
    && highIdentityEvidence(row.evidence?.rightElement);
  const boundaryLocalSupported = row.evidence?.boundaryIdentity?.identitySupported === true;
  const supported = Boolean(confidence) && (wholeEdgeSupported || boundaryLocalSupported);
  const loopId = String(loop?.loopId || loop?.baseId || '');
  return deepFreeze({ ...row, status: 'REVIEW',
    evidence: deepFreeze({ ...(row.evidence || {}), identitySupported: supported,
      identityConfidence: supported ? confidence : 'REVIEW',
      identityEvidenceBasis: 'METHOD_A_QUALIFIED_ADJACENT_BOUNDARY', methodALoopId: loopId,
      methodAQualification: methodAQualification(loop) }) });
}
function projectMethodAAnchorAuthority(correspondence, loop, anchors) {
  const anchorKeys = new Set(anchors.map((pair) => anchorPairKey(pair.sourceNodeId, pair.targetNodeId)));
  const nodeRows = (correspondence?.nodeRows || []).map((row) => {
    const anchorRow = projectMethodAAnchorRow(row, loop, anchorKeys);
    return projectMethodABoundaryRow(anchorRow, loop);
  });
  return deepFreeze({ ...correspondence, nodeRows: deepFreeze(nodeRows) });
}
function buildMethodACorrespondence(sourceGraph, targetGraph, loop, options) {
  const anchors = anchorPairs(loop);
  if (anchors.length < 3) return blockedCorrespondence('METHOD_A_READY_LOOP_REQUIRES_THREE_ANCHORS');
  const correspondence = compareLockedCiiAnchorSpan(sourceGraph, targetGraph, anchors, { ...options, geometryTransform: loop.geometry });
  // Opt-in until authentic cross-source, review and Writer2 qualification passes.
  // No new authority is produced by ordinary existing callers.
  if (options.methodATerminalContinuation !== true) {
    return projectMethodAAnchorAuthority(correspondence, loop, anchors);
  }
  const extension = qualifyCiiMethodATerminalContinuation(sourceGraph, targetGraph, loop, correspondence, options);
  const withTerminals = deepFreeze({
    ...correspondence, nodeRows: deepFreeze([...(correspondence.nodeRows || []), ...extension.nodeRows]),
    methodATerminalContinuation: extension,
  });
  return projectMethodAAnchorAuthority(withTerminals, loop, anchors);
}
function buildMethodBCorrespondence(sourceGraph, targetGraph, loop, options) {
  const anchors = anchorPairs(loop);
  if (anchors.length !== 1) return blockedCorrespondence('METHOD_B_READY_LOOP_REQUIRES_ONE_ANCHOR_PAIR');
  return propagateSingleCiiAnchorCorrespondence(sourceGraph, targetGraph, anchors[0], options);
}
function buildUserLockedSeedCorrespondence(sourceGraph, targetGraph, loop, options) {
  const anchors = anchorPairs(loop);
  if (anchors.length !== 1) return blockedCorrespondence('USER_LOCKED_SEED_REQUIRES_ONE_ANCHOR_PAIR');
  return propagateSingleCiiAnchorCorrespondence(sourceGraph, targetGraph, anchors[0], options);
}
function buildLegacyCorrespondence(sourceGraph, targetGraph, loop, options) {
  const anchors = anchorPairs(loop);
  if (!anchors.length) return blockedCorrespondence('LOCKED_ANCHOR_PAIR_REQUIRED');
  if (anchors.length === 1) return propagateSingleCiiAnchorCorrespondence(sourceGraph, targetGraph, anchors[0], options);
  return compareLockedCiiAnchorSpan(sourceGraph, targetGraph, anchors, { ...options, geometryTransform: loop.geometry });
}
function loopCorrespondence(sourceGraph, targetGraph, loop, options) {
  if (loop.method === 'METHOD_A_SPATIAL') return buildMethodACorrespondence(sourceGraph, targetGraph, loop, options);
  if (loop.method === 'METHOD_B_NETWORK') return buildMethodBCorrespondence(sourceGraph, targetGraph, loop, options);
  if (loop.method === 'USER_LOCKED_SEED') return buildUserLockedSeedCorrespondence(sourceGraph, targetGraph, loop, options);
  if (loop.method === 'USER_LOCKED_LEGACY') return buildLegacyCorrespondence(sourceGraph, targetGraph, loop, options);
  return blockedCorrespondence(`UNSUPPORTED_MULTI_BASE_LOOP_METHOD:${loop.method || 'UNKNOWN'}`);
}
function legacySingleLoopResult(loopResults) {
  if (loopResults.length !== 1 || loopResults[0].loop.method !== 'USER_LOCKED_LEGACY') return null;
  const item = loopResults[0]; const ready = item.correspondence?.status === 'READY';
  return deepFreeze({ ...item.correspondence, combination: 'LEGACY_SINGLE_LOOP_COMPATIBILITY',
    readyLoopCount: ready ? 1 : 0, unresolvedReadyBaseLoopCount: ready ? 0 : 1,
    contributingLoopIds: Object.freeze(ready ? [String(item.loop.loopId)] : []), loopResults: deepFreeze(loopResults),
    conflicts: Object.freeze([]) });
}
function singleSeedLoopResult(loopResults) {
  if (loopResults.length !== 1 || loopResults[0].loop.method !== 'USER_LOCKED_SEED') return null;
  const item = loopResults[0]; const ready = item.correspondence?.status === 'READY';
  return deepFreeze({ ...item.correspondence, combination: 'INDEPENDENT_MANUAL_SEED',
    readyLoopCount: ready ? 1 : 0, unresolvedReadyBaseLoopCount: ready ? 0 : 1,
    contributingLoopIds: Object.freeze([String(item.loop.loopId)]), loopResults: deepFreeze(loopResults),
    conflicts: Object.freeze([]) });
}
function unresolvedAuthorityCorrespondence(multiBaseAuthority) {
  const blocked = multiBaseAuthority.status === 'BLOCKED';
  return deepFreeze({ schema: 'CIIWorkspaceCorrespondence.v1', status: blocked ? 'BLOCKED' : 'AMBIGUOUS', combination: 'OR_WITH_CONFLICT_VETO',
    blockers: Object.freeze([blocked ? 'MULTI_BASE_INPUT_INVALID' : 'MULTI_BASE_AUTHORITY_NOT_RESOLVED']), ambiguityRetained: !blocked,
    conflicts: multiBaseAuthority.conflicts || Object.freeze([]), readyLoopCount: 0, unresolvedReadyBaseLoopCount: 0,
    contributingLoopIds: Object.freeze([]), loopResults: Object.freeze([]), targetCustodyConflicts: Object.freeze([]),
    nodeRows: Object.freeze([]), elementRows: Object.freeze([]) });
}

export function buildCiiMultiBaseCorrespondence(sourceGraph, targetGraph, multiBaseAuthority, options = {}) {
  if (!multiBaseAuthority || multiBaseAuthority.status === 'UNAVAILABLE') {
    return arbitrateCiiLoopCorrespondences([]);
  }
  if (multiBaseAuthority.status === 'AMBIGUOUS' || multiBaseAuthority.status === 'BLOCKED') {
    return unresolvedAuthorityCorrespondence(multiBaseAuthority);
  }
  const loopResults = (multiBaseAuthority.loops || []).filter((loop) => loop.status === 'READY').map((loop) => deepFreeze({
    loop, correspondence: loopCorrespondence(sourceGraph, targetGraph, loop, options),
  }));
  const legacy = legacySingleLoopResult(loopResults); if (legacy) return legacy;
  const singleSeed = singleSeedLoopResult(loopResults); if (singleSeed) return singleSeed;
  const seedOnly = loopResults.length > 1 && loopResults.every((item) => item.loop.method === 'USER_LOCKED_SEED');
  return seedOnly ? arbitrateCiiSeedCorrespondences(loopResults) : arbitrateCiiLoopCorrespondences(loopResults);
}

export const _test = Object.freeze({ projectMethodABoundaryRow });
