import { deepFreeze, stableId, stableStringify } from './cii-workspace-contracts.js';
import { buildCiiCandidateEvidence } from './cii-workspace-candidates.js';
import { scoreCiiEdgeCandidate } from './cii-workspace-evidence.js';

function otherNode(edge, node) { return edge.from === node ? edge.to : edge.from; }
function sortedEdges(rows) { return [...(rows || [])].sort((a, b) => String(a.elementId).localeCompare(String(b.elementId), undefined, { numeric: true })); }
function pairKey(sourceNode, targetNode) { return `${sourceNode}=>${targetNode}`; }
function workflowStatus(confidence) { return confidence === 'HIGH' ? 'HIGH' : 'REVIEW'; }

function singleAnchorMatchOptions(options) {
  const geometryTransform = options?.geometryTransform || Object.freeze({
    status: 'UNDERDETERMINED', mode: 'SINGLE_LOCKED_ANCHOR',
    reason: 'ONE_ANCHOR_CANNOT_ESTABLISH_ROTATION',
  });
  return Object.freeze({ ...options, propagation: true, geometryTransform });
}

function componentEdgeIds(graph, startNode) {
  const start = String(startNode); const nodes = new Set([start]); const edges = new Set(); const queue = [start];
  while (queue.length) {
    const node = queue.shift();
    for (const edge of sortedEdges(graph?.adjacency?.get(node))) {
      edges.add(edge.elementId); const next = otherNode(edge, node);
      if (!nodes.has(next)) { nodes.add(next); queue.push(next); }
    }
  }
  return { nodes, edges };
}

function candidateMatrix(sourceEdges, targetEdges, options) {
  return sourceEdges.map((source) => targetEdges.map((target) => ({ source, target, evidence: scoreCiiEdgeCandidate(source, target, options) })));
}

function enumerateAssignments(matrix, targetCount, limit = 720) {
  const rows = []; const used = new Set(); const selected = [];
  function walk(sourceIndex) {
    if (rows.length >= limit) return;
    if (sourceIndex >= matrix.length) {
      const rankingScore = selected.reduce((sum, item) => sum + item.evidence.rankingScore, 0) / Math.max(selected.length, 1);
      rows.push({ pairs: [...selected], rankingScore }); return;
    }
    for (let targetIndex = 0; targetIndex < targetCount; targetIndex += 1) {
      if (used.has(targetIndex)) continue;
      const pair = matrix[sourceIndex][targetIndex];
      if (!pair?.evidence?.identitySupported || pair.evidence.hardFail) continue;
      used.add(targetIndex); selected.push(pair); walk(sourceIndex + 1); selected.pop(); used.delete(targetIndex);
    }
  }
  walk(0);
  return rows.sort((a, b) => b.rankingScore - a.rankingScore
    || stableStringify(a.pairs.map((pair) => pair.target.elementId)).localeCompare(stableStringify(b.pairs.map((pair) => pair.target.elementId)), undefined, { numeric: true }));
}

function frontierAssignment(sourceEdges, targetEdges, matchOptions) {
  if (sourceEdges.length > targetEdges.length) return { status: 'BLOCKED', blocker: 'FRONTIER_CARDINALITY_MISMATCH' };
  if (!sourceEdges.length) return { status: 'EMPTY', pairs: [] };
  const maxDegree = Number(matchOptions.maxPropagationFrontierDegree || 6);
  if (sourceEdges.length > maxDegree) return { status: 'BLOCKED', blocker: 'FRONTIER_DEGREE_LIMIT_EXCEEDED' };
  const assignments = enumerateAssignments(candidateMatrix(sourceEdges, targetEdges, matchOptions), targetEdges.length, Number(matchOptions.maxFrontierAssignments || 720));
  if (!assignments.length) return { status: 'BLOCKED', blocker: 'NO_SUPPORTED_FRONTIER_ASSIGNMENT' };
  const winner = assignments[0]; const runner = assignments[1] || null;
  const gap = runner ? winner.rankingScore - runner.rankingScore : 100;
  const requiredGap = Number(matchOptions.frontierWinnerGap ?? matchOptions.winnerGap ?? 8);
  if (runner && gap < requiredGap) return { status: 'AMBIGUOUS', blocker: 'FRONTIER_WINNER_GAP_NOT_SATISFIED', winner, runner, gap, requiredGap };
  return { status: 'SUPPORTED', winner, runner, gap, requiredGap };
}

function unresolvedElementRow(source, target, authority, evidence) {
  return deepFreeze({
    correspondenceId: stableId('element-unresolved', source?.elementId, target?.elementId || ''), kind: 'ELEMENT',
    sourceElementId: source?.elementId || null, targetElementIds: Object.freeze(target?.elementId ? [target.elementId] : []),
    status: 'UNRESOLVED', authority, evidence: deepFreeze(evidence || {}),
  });
}

function correspondenceIdentity(sourceGraph, targetGraph, anchor, elementRows) {
  return stableId('correspondence', sourceGraph.documentId, targetGraph.documentId,
    stableStringify([{ sourceNodeId: String(anchor.sourceNodeId), targetNodeId: String(anchor.targetNodeId), locked: true }]),
    stableStringify(elementRows.map((row) => row.correspondenceId)));
}

export function propagateSingleCiiAnchorCorrespondence(sourceGraph, targetGraph, anchor, options = {}) {
  const sourceAnchor = String(anchor?.sourceNodeId ?? ''); const targetAnchor = String(anchor?.targetNodeId ?? '');
  const lockedRow = deepFreeze({
    correspondenceId: stableId('node', sourceAnchor, targetAnchor), kind: 'NODE', sourceNodeId: sourceAnchor, targetNodeId: targetAnchor,
    status: 'LOCKED', authority: 'USER_LOCKED_ANCHOR', anchorSchema: 'CIIWorkspaceAnchor.v1',
  });
  if (!sourceGraph?.adjacency?.has(sourceAnchor) || !targetGraph?.adjacency?.has(targetAnchor)) {
    return deepFreeze({ schema: 'CIIWorkspaceCorrespondence.v1', status: 'BLOCKED', blockers: Object.freeze(['LOCKED_ANCHOR_NODE_NOT_FOUND']),
      targetCustodyConflicts: Object.freeze([]), nodeRows: Object.freeze([lockedRow]), elementRows: Object.freeze([]) });
  }

  const sourceComponent = componentEdgeIds(sourceGraph, sourceAnchor); const targetComponent = componentEdgeIds(targetGraph, targetAnchor);
  const sourceEdgeCustody = new Map(); const targetEdgeCustody = new Map();
  const sourceNodeCustody = new Map([[sourceAnchor, targetAnchor]]); const targetNodeCustody = new Map([[targetAnchor, sourceAnchor]]);
  const blockedSourceEdges = new Set(); const visitedPairs = new Set(); const queuedPairs = new Set([pairKey(sourceAnchor, targetAnchor)]);
  const queue = [{ sourceNode: sourceAnchor, targetNode: targetAnchor, depth: 0 }];
  const elementRows = []; const nodeRows = [lockedRow]; const blockers = new Set(); const custodyConflicts = [];
  const maxPairs = Number(options.maxPropagationNodePairs || 10000);
  const matchOptions = singleAnchorMatchOptions(options);

  while (queue.length && visitedPairs.size < maxPairs) {
    const current = queue.shift(); const currentKey = pairKey(current.sourceNode, current.targetNode);
    if (visitedPairs.has(currentKey)) continue; visitedPairs.add(currentKey);
    const sourceEdges = sortedEdges(sourceGraph.adjacency.get(current.sourceNode)).filter((edge) => !sourceEdgeCustody.has(edge.elementId) && !blockedSourceEdges.has(edge.elementId));
    const targetEdges = sortedEdges(targetGraph.adjacency.get(current.targetNode)).filter((edge) => !targetEdgeCustody.has(edge.elementId));
    if (!sourceEdges.length) continue;

    const assignment = frontierAssignment(sourceEdges, targetEdges, matchOptions);
    if (assignment.status !== 'SUPPORTED') {
      blockers.add(assignment.blocker || 'PROPAGATION_FRONTIER_UNRESOLVED');
      for (const source of sourceEdges) {
        blockedSourceEdges.add(source.elementId);
        const initial = targetEdges.length ? buildCiiCandidateEvidence(source, targetEdges, null, matchOptions) : null;
        elementRows.push(unresolvedElementRow(source, null, 'ANCHOR_PROPAGATION_FRONTIER_BLOCKED', {
          propagation: { sourceNode: current.sourceNode, targetNode: current.targetNode, depth: current.depth, assignmentStatus: assignment.status,
            assignmentGap: assignment.gap ?? null, requiredGap: assignment.requiredGap ?? null, blocker: assignment.blocker }, candidates: initial,
        }));
      }
      continue;
    }

    for (const selected of assignment.winner.pairs) {
      const source = selected.source; const target = selected.target;
      const candidates = buildCiiCandidateEvidence(source, targetEdges, target.elementId, matchOptions);
      const propagationEvidence = { sourceNode: current.sourceNode, targetNode: current.targetNode, depth: current.depth,
        assignmentScore: assignment.winner.rankingScore, assignmentGap: assignment.gap, requiredGap: assignment.requiredGap };
      if (candidates.status !== 'SUPPORTED') {
        blockedSourceEdges.add(source.elementId); blockers.add('PROPAGATION_CANDIDATE_AMBIGUITY');
        elementRows.push(unresolvedElementRow(source, target, 'ANCHOR_PROPAGATION_CANDIDATE_BLOCKED', { propagation: propagationEvidence, candidates }));
        continue;
      }
      if (targetEdgeCustody.has(target.elementId) && targetEdgeCustody.get(target.elementId) !== source.elementId) {
        blockers.add('TARGET_EDGE_CUSTODY_CONFLICT'); blockedSourceEdges.add(source.elementId);
        custodyConflicts.push({ kind: 'EDGE', targetElementId: target.elementId, first: targetEdgeCustody.get(target.elementId), second: source.elementId });
        elementRows.push(unresolvedElementRow(source, target, 'ANCHOR_PROPAGATION_EDGE_CUSTODY_BLOCKED', { propagation: propagationEvidence, candidates }));
        continue;
      }

      const nextSource = otherNode(source, current.sourceNode); const nextTarget = otherNode(target, current.targetNode);
      const sourceClaim = sourceNodeCustody.get(nextSource); const targetClaim = targetNodeCustody.get(nextTarget);
      if ((sourceClaim && sourceClaim !== nextTarget) || (targetClaim && targetClaim !== nextSource)) {
        blockers.add('TARGET_NODE_CUSTODY_CONFLICT'); blockedSourceEdges.add(source.elementId);
        custodyConflicts.push({ kind: 'NODE', sourceNodeId: nextSource, targetNodeId: nextTarget, sourceClaim: sourceClaim || null, targetClaim: targetClaim || null });
        elementRows.push(unresolvedElementRow(source, target, 'ANCHOR_PROPAGATION_NODE_CUSTODY_BLOCKED', { propagation: propagationEvidence, candidates }));
        continue;
      }

      sourceEdgeCustody.set(source.elementId, target.elementId); targetEdgeCustody.set(target.elementId, source.elementId);
      sourceNodeCustody.set(nextSource, nextTarget); targetNodeCustody.set(nextTarget, nextSource);
      const confidence = candidates.winnerIdentityConfidence || selected.evidence.identityConfidence || 'REVIEW';
      const row = deepFreeze({
        correspondenceId: stableId('element', source.elementId, target.elementId), kind: 'ELEMENT', sourceElementId: source.elementId,
        targetElementIds: Object.freeze([target.elementId]), status: workflowStatus(confidence), authority: 'ANCHOR_PROPAGATED_M1_M2',
        evidence: deepFreeze({ candidates, propagation: { ...propagationEvidence,
          assignmentScore: Number(assignment.winner.rankingScore.toFixed(1)), assignmentGap: Number(assignment.gap.toFixed(1)) } }),
      });
      elementRows.push(row);
      if (!nodeRows.some((item) => item.sourceNodeId === nextSource && item.targetNodeId === nextTarget)) {
        nodeRows.push(deepFreeze({ correspondenceId: stableId('node', nextSource, nextTarget), kind: 'NODE', sourceNodeId: nextSource, targetNodeId: nextTarget,
          status: row.status, authority: 'ANCHOR_PROPAGATED_M1_M2', evidence: row.evidence }));
      }
      const nextKey = pairKey(nextSource, nextTarget);
      if (!visitedPairs.has(nextKey) && !queuedPairs.has(nextKey)) { queuedPairs.add(nextKey); queue.push({ sourceNode: nextSource, targetNode: nextTarget, depth: current.depth + 1 }); }
    }
  }

  if (queue.length) blockers.add('PROPAGATION_NODE_PAIR_LIMIT_REACHED');
  const unmatchedSource = [...sourceComponent.edges].filter((id) => !sourceEdgeCustody.has(id));
  const unmatchedTarget = [...targetComponent.edges].filter((id) => !targetEdgeCustody.has(id));
  if (unmatchedSource.length) blockers.add('SOURCE_COMPONENT_NOT_FULLY_PROPAGATED');
  if (elementRows.some((row) => row.status === 'UNRESOLVED')) blockers.add('PROPAGATION_AMBIGUITY_RETAINED');

  elementRows.sort((a, b) => String(a.sourceElementId || '').localeCompare(String(b.sourceElementId || ''), undefined, { numeric: true }));
  nodeRows.sort((a, b) => a.status === 'LOCKED' ? -1 : (b.status === 'LOCKED' ? 1 : String(a.sourceNodeId || '').localeCompare(String(b.sourceNodeId || ''), undefined, { numeric: true })));
  const blockerRows = [...blockers].sort(); const status = blockerRows.length ? 'UNRESOLVED' : 'READY';
  return deepFreeze({
    schema: 'CIIWorkspaceCorrespondence.v1', status, blockers: Object.freeze(blockerRows), ambiguityRetained: elementRows.some((row) => row.status === 'UNRESOLVED'),
    targetCustodyConflicts: Object.freeze(custodyConflicts), correspondenceIdentity: correspondenceIdentity(sourceGraph, targetGraph, anchor, elementRows),
    propagation: deepFreeze({ sourceComponentEdgeCount: sourceComponent.edges.size, targetComponentEdgeCount: targetComponent.edges.size,
      matchedEdgeCount: sourceEdgeCustody.size, matchedNodeCount: sourceNodeCustody.size, visitedNodePairCount: visitedPairs.size,
      unmatchedSourceElementIds: Object.freeze(unmatchedSource.sort()), unmatchedTargetElementIds: Object.freeze(unmatchedTarget.sort()) }),
    nodeRows: Object.freeze(nodeRows), elementRows: Object.freeze(elementRows),
  });
}
