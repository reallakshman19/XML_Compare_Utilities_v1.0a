import { deepFreeze } from './cii-workspace-contracts.js';
import { propagateSingleCiiAnchorCorrespondence } from './cii-workspace-propagation.js';
import { compareLockedCiiAnchorSpan } from './cii-workspace-topology.js';
import { arbitrateCiiLoopCorrespondences } from './cii-workspace-correspondence-arbitration.js';

function blockedCorrespondence(reason) {
  return deepFreeze({ schema: 'CIIWorkspaceCorrespondence.v1', status: 'BLOCKED', blockers: Object.freeze([reason]),
    targetCustodyConflicts: Object.freeze([]), nodeRows: Object.freeze([]), elementRows: Object.freeze([]) });
}
function anchorPairs(loop) {
  return (loop?.anchorPairs || []).map((pair) => ({ sourceNodeId: String(pair.sourceNodeId), targetNodeId: String(pair.targetNodeId) }));
}
function buildMethodACorrespondence(sourceGraph, targetGraph, loop, options) {
  const anchors = anchorPairs(loop);
  if (anchors.length < 3) return blockedCorrespondence('METHOD_A_READY_LOOP_REQUIRES_THREE_ANCHORS');
  return compareLockedCiiAnchorSpan(sourceGraph, targetGraph, anchors, { ...options, geometryTransform: loop.geometry });
}
function buildMethodBCorrespondence(sourceGraph, targetGraph, loop, options) {
  const anchors = anchorPairs(loop);
  if (anchors.length !== 1) return blockedCorrespondence('METHOD_B_READY_LOOP_REQUIRES_ONE_ANCHOR_PAIR');
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
  return legacySingleLoopResult(loopResults) || arbitrateCiiLoopCorrespondences(loopResults);
}
