import { buildElementPaths, scorePathMatch, alignElementSequence } from '../model-converters/xml-cii-inputxml-path-aligner.js';
import { deepFreeze, stableId, stableStringify } from './cii-workspace-contracts.js';
import { ciiAlignmentScore } from './cii-workspace-evidence.js';
import { deriveCiiAlignmentCorrespondence } from './cii-workspace-alignment.js';
import { buildCiiCandidateEvidence, candidateStatus, targetCustodyConflicts } from './cii-workspace-candidates.js';
import { evaluateCiiAnchorPathGate, applyCiiPathGateToRows } from './cii-workspace-path-gates.js';

function otherNode(edge, current) { return edge.from === current ? edge.to : edge.from; }
function sortIncidents(rows) { return [...(rows || [])].sort((a, b) => a.elementId.localeCompare(b.elementId, undefined, { numeric: true })); }

function reachableWithoutEdge(graph, start, end, blockedEdgeId) {
  const visited = new Set([start]); const queue = [start];
  while (queue.length) {
    const node = queue.shift(); if (node === end) return true;
    for (const edge of sortIncidents(graph.adjacency.get(node))) {
      if (edge.elementId === blockedEdgeId) continue;
      const next = otherNode(edge, node); if (!visited.has(next)) { visited.add(next); queue.push(next); }
    }
  }
  return false;
}

function uniqueRoute(graph, start, end) {
  const source = String(start); const target = String(end);
  if (!graph.adjacency.has(source) || !graph.adjacency.has(target)) return { status: 'BLOCKED', blocker: 'LOCKED_ANCHOR_NODE_NOT_FOUND' };
  const distance = new Map([[source, 0]]); const ways = new Map([[source, 1]]); const previous = new Map(); const queue = [source];
  while (queue.length) {
    const node = queue.shift();
    for (const edge of sortIncidents(graph.adjacency.get(node))) {
      const next = otherNode(edge, node); const candidate = distance.get(node) + 1;
      if (!distance.has(next)) { distance.set(next, candidate); ways.set(next, ways.get(node)); previous.set(next, { node, edge }); queue.push(next); }
      else if (distance.get(next) === candidate) ways.set(next, Math.min(2, (ways.get(next) || 0) + (ways.get(node) || 0)));
    }
  }
  if (!distance.has(target)) return { status: 'BLOCKED', blocker: 'LOCKED_ANCHORS_DISCONNECTED' };
  if ((ways.get(target) || 0) !== 1) return { status: 'BLOCKED', blocker: 'AMBIGUOUS_ANCHOR_ROUTE' };
  const steps = [];
  for (let node = target; node !== source;) {
    const item = previous.get(node); if (!item) return { status: 'BLOCKED', blocker: 'ANCHOR_ROUTE_RECONSTRUCTION_FAILED' };
    steps.push({ edge: item.edge, from: item.node, to: node }); node = item.node;
  }
  steps.reverse();
  if (steps.some((step) => reachableWithoutEdge(graph, source, target, step.edge.elementId))) return { status: 'BLOCKED', blocker: 'AMBIGUOUS_ANCHOR_ROUTE' };
  return { status: 'READY', steps };
}

function orientEdge(step) {
  const edge = step.edge; const reverse = edge.from !== step.from;
  return {
    ...edge, routeFrom: step.from, routeTo: step.to,
    dx: reverse ? -edge.dx : edge.dx, dy: reverse ? -edge.dy : edge.dy, dz: reverse ? -edge.dz : edge.dz,
    fromPos: reverse ? edge.toPos : edge.fromPos, toPos: reverse ? edge.fromPos : edge.toPos,
    fromContext: reverse ? edge.toContext : edge.fromContext, toContext: reverse ? edge.fromContext : edge.toContext,
  };
}

function routePath(route, pathId, toleranceMm) {
  const elements = route.steps.map(orientEdge); let station = 0;
  for (const edge of elements) {
    edge.pathStationStartMm = station; station += Number(edge.lengthMm || 0);
    edge.pathStationEndMm = station; edge.pathStationMidMm = (edge.pathStationStartMm + station) / 2;
  }
  for (let index = 0; index < elements.length; index += 1) {
    const edge = elements[index]; edge.pathTotalLengthMm = station;
    edge.pathSequenceContext = Object.freeze([elements[index - 1]?.componentKind || '^', edge.componentKind || 'PIPE', elements[index + 1]?.componentKind || '$']);
  }
  const bucket = (value) => Math.round(Number(value || 0) / toleranceMm) * toleranceMm;
  return {
    pathId, startNode: route.steps[0]?.from || '', endNode: route.steps.at(-1)?.to || '', startAnchorType: 'LOCKED', endAnchorType: 'LOCKED', elements,
    totalLengthMm: station, packetSequence: elements.map((edge) => edge.componentKind || 'PIPE'), lengthSequence: elements.map((edge) => bucket(edge.lengthMm)),
  };
}

function pathNodes(path) { return [path.startNode, ...path.elements.map((edge) => edge.routeTo)]; }
function pathVectorLength(path) {
  const vector = (path?.elements || []).reduce((sum, edge) => ({ x: sum.x + Number(edge.dx || 0), y: sum.y + Number(edge.dy || 0), z: sum.z + Number(edge.dz || 0) }), { x: 0, y: 0, z: 0 });
  return Math.hypot(vector.x, vector.y, vector.z);
}
function intermediateAnchorBlocker(sourcePath, targetPath, anchors) {
  if (anchors.length <= 2) return '';
  const sourceNodes = pathNodes(sourcePath); const targetNodes = pathNodes(targetPath); let sourceLast = -1; let targetLast = -1;
  for (const pair of anchors) {
    const sourceIndex = sourceNodes.indexOf(String(pair.sourceNodeId)); const targetIndex = targetNodes.indexOf(String(pair.targetNodeId));
    if (sourceIndex < 0 || targetIndex < 0) return 'LOCKED_ANCHOR_OUTSIDE_SPAN';
    if (sourceIndex <= sourceLast || targetIndex <= targetLast) return 'LOCKED_ANCHOR_ORDER_CONTRADICTION';
    sourceLast = sourceIndex; targetLast = targetIndex;
  }
  return '';
}

function subdivisionEvidence(sourcePath, targetPath, options) {
  if (sourcePath.elements.length !== 1 || targetPath.elements.length < 2) return null;
  const source = sourcePath.elements[0]; const internalNodes = targetPath.elements.slice(0, -1).map((edge) => edge.routeTo);
  if (source.componentKind !== 'PIPE' || internalNodes.some((id) => (options.targetGraph.adjacency.get(id) || []).length !== 2)) return null;
  const lengthDeltaMm = Math.abs(sourcePath.totalLengthMm - targetPath.totalLengthMm);
  const lengthOk = lengthDeltaMm <= Number(options.pathLengthToleranceMm || 25);
  const diameterOk = targetPath.elements.every((edge) => Math.abs(edge.diameter - source.diameter) <= Number(options.diameterToleranceMm || 2));
  const wallOk = targetPath.elements.every((edge) => Math.abs(edge.wall - source.wall) <= Number(options.wallToleranceMm || 1));
  const componentOk = targetPath.elements.every((edge) => edge.componentKind === 'PIPE');
  const transitionOk = targetPath.elements.every((edge) => !edge.fromContext?.sizeTransition && !edge.toContext?.sizeTransition);
  const sourceStraightness = pathVectorLength(sourcePath) / Math.max(sourcePath.totalLengthMm, 1);
  const targetStraightness = pathVectorLength(targetPath) / Math.max(targetPath.totalLengthMm, 1);
  const straightnessOk = targetStraightness >= Number(options.subdivisionMinStraightness ?? 0.995)
    && Math.abs(sourceStraightness - targetStraightness) <= Number(options.subdivisionStraightnessTolerance ?? 0.01);
  const evidenceFamilies = deepFreeze({
    topology: { internalDegree2: true, sourceEndpointDegrees: [source.fromContext?.degree || 0, source.toContext?.degree || 0], targetEndpointDegrees: [targetPath.elements[0]?.fromContext?.degree || 0, targetPath.elements.at(-1)?.toContext?.degree || 0] },
    neighbourhood: { source: [source.fromContext?.neighbourhoodLayers || [], source.toContext?.neighbourhoodLayers || []], target: [targetPath.elements[0]?.fromContext?.neighbourhoodLayers || [], targetPath.elements.at(-1)?.toContext?.neighbourhoodLayers || []] },
    pathSequence: { source: [source.componentKind], target: targetPath.elements.map((edge) => edge.componentKind) },
    od: { source: source.diameter, target: targetPath.elements.map((edge) => edge.diameter), compatible: diameterOk },
    wall: { source: source.wall, target: targetPath.elements.map((edge) => edge.wall), compatible: wallOk },
    componentKind: { source: source.componentKind, target: targetPath.elements.map((edge) => edge.componentKind), compatible: componentOk },
    rigidLength: { applicable: false },
    pathStation: { sourceLengthMm: sourcePath.totalLengthMm, targetLengthMm: targetPath.totalLengthMm, lengthDeltaMm },
    registeredGeometry: { available: options.geometryTransform?.status === 'READY', transformStatus: options.geometryTransform?.status || 'UNAVAILABLE' },
  });
  const compatible = lengthOk && diameterOk && wallOk && componentOk && transitionOk && straightnessOk;
  return deepFreeze({ compatible, lengthDeltaMm, lengthOk, diameterOk, wallOk, componentOk, transitionOk, straightnessOk, sourceStraightness, targetStraightness, internalNodes, evidenceFamilies });
}

function lockedNodeRows(anchorPairs) {
  return anchorPairs.map((pair) => deepFreeze({
    correspondenceId: stableId('node', pair.sourceNodeId, pair.targetNodeId), kind: 'NODE', sourceNodeId: String(pair.sourceNodeId), targetNodeId: String(pair.targetNodeId),
    status: 'LOCKED', authority: 'USER_LOCKED_ANCHOR', anchorSchema: 'CIIWorkspaceAnchor.v1',
  }));
}

function insertedRows(subdivision) {
  if (!subdivision?.compatible) return [];
  return subdivision.internalNodes.map((targetNodeId) => deepFreeze({
    correspondenceId: stableId('insert', targetNodeId), kind: 'NODE', sourceNodeId: null, targetNodeId, status: 'INSERTED', authority: 'SOURCE_1_TO_TARGET_N_SUBDIVISION',
  }));
}

function withCandidateEvidence(rows, sourcePath, targetPath, options) {
  const sourceById = new Map(sourcePath.elements.map((edge) => [edge.elementId, edge]));
  return rows.map((row) => {
    if (row.kind !== 'ELEMENT' || !row.sourceElementId || !row.targetElementIds?.[0]) return row;
    const source = sourceById.get(row.sourceElementId); if (!source) return row;
    const candidates = buildCiiCandidateEvidence(source, targetPath.elements, row.targetElementIds[0], options);
    const status = row.status === 'CONFLICT' ? 'CONFLICT' : candidateStatus(candidates, row.status);
    return deepFreeze({ ...row, status, evidence: deepFreeze({ element: row.evidence, candidates }) });
  });
}

function correspondenceIdentity(sourceGraph, targetGraph, anchors, elementRows) {
  return stableId('correspondence', sourceGraph.documentId, targetGraph.documentId, stableStringify(anchors), stableStringify(elementRows.map((row) => row.correspondenceId)));
}

function singleAnchorCorrespondence(sourceGraph, targetGraph, anchor, options) {
  const sourceNode = String(anchor.sourceNodeId); const targetNode = String(anchor.targetNodeId);
  if (!sourceGraph.adjacency.has(sourceNode) || !targetGraph.adjacency.has(targetNode)) {
    return deepFreeze({ status: 'BLOCKED', blockers: Object.freeze(['LOCKED_ANCHOR_NODE_NOT_FOUND']), nodeRows: Object.freeze(lockedNodeRows([anchor])), elementRows: Object.freeze([]) });
  }
  const sources = sortIncidents(sourceGraph.adjacency.get(sourceNode)); const targets = sortIncidents(targetGraph.adjacency.get(targetNode));
  const elementRows = sources.map((source) => {
    const initial = buildCiiCandidateEvidence(source, targets, null, options); const winner = initial.winnerTargetElementId;
    const evidence = winner ? buildCiiCandidateEvidence(source, targets, winner, options) : initial;
    const baseStatus = evidence.winnerScore >= Number(options.highConfidenceScore || 82) ? 'HIGH' : 'REVIEW';
    return deepFreeze({
      correspondenceId: stableId('element', source.elementId, winner), kind: 'ELEMENT', sourceElementId: source.elementId,
      targetElementIds: Object.freeze(winner ? [winner] : []), status: candidateStatus(evidence, baseStatus),
      authority: 'SINGLE_ANCHOR_NEIGHBOURHOOD_CANDIDATE', evidence: deepFreeze({ candidates: evidence }),
    });
  });
  const custody = targetCustodyConflicts(elementRows); const targetById = new Map(targets.map((edge) => [edge.elementId, edge]));
  const nodeRows = [...lockedNodeRows([anchor])];
  for (const row of elementRows) {
    const source = sources.find((edge) => edge.elementId === row.sourceElementId); const target = targetById.get(row.targetElementIds?.[0]);
    if (!source || !target || row.status === 'UNRESOLVED') continue;
    nodeRows.push(deepFreeze({
      correspondenceId: stableId('node', otherNode(source, sourceNode), otherNode(target, targetNode)), kind: 'NODE', sourceNodeId: otherNode(source, sourceNode), targetNodeId: otherNode(target, targetNode),
      status: row.status, authority: 'SINGLE_ANCHOR_NEIGHBOURHOOD_CANDIDATE', evidence: row.evidence,
    }));
  }
  const blockers = custody.length ? ['TARGET_CUSTODY_AMBIGUOUS'] : [];
  const status = blockers.length ? 'UNRESOLVED' : (elementRows.some((row) => ['HIGH', 'REVIEW'].includes(row.status)) ? 'READY' : 'UNRESOLVED');
  return deepFreeze({
    schema: 'CIIWorkspaceCorrespondence.v1', status, blockers: Object.freeze(blockers), targetCustodyConflicts: custody,
    correspondenceIdentity: correspondenceIdentity(sourceGraph, targetGraph, [anchor], elementRows), nodeRows: Object.freeze(nodeRows), elementRows: Object.freeze(elementRows),
  });
}

export function compareLockedCiiAnchorSpan(sourceGraph, targetGraph, anchorPairs, options = {}) {
  if (!Array.isArray(anchorPairs) || !anchorPairs.length) return deepFreeze({ status: 'BLOCKED', blockers: Object.freeze(['LOCKED_ANCHOR_PAIR_REQUIRED']), nodeRows: Object.freeze([]), elementRows: Object.freeze([]) });
  const ordered = [...anchorPairs];
  if (ordered.length === 1) return singleAnchorCorrespondence(sourceGraph, targetGraph, ordered[0], options);
  const first = ordered[0]; const last = ordered[ordered.length - 1];
  const sourceRoute = uniqueRoute(sourceGraph, first.sourceNodeId, last.sourceNodeId); const targetRoute = uniqueRoute(targetGraph, first.targetNodeId, last.targetNodeId);
  const routeBlockers = [sourceRoute, targetRoute].filter((item) => item.status !== 'READY').map((item) => item.blocker);
  if (routeBlockers.length) return deepFreeze({ status: 'BLOCKED', blockers: Object.freeze(routeBlockers), nodeRows: Object.freeze(lockedNodeRows(ordered)), elementRows: Object.freeze([]) });
  const toleranceMm = Number(options.lengthToleranceMm || 6); const sourcePath = routePath(sourceRoute, 'LOCKED-SOURCE', toleranceMm); const targetPath = routePath(targetRoute, 'LOCKED-TARGET', toleranceMm);
  const anchorOrderBlocker = intermediateAnchorBlocker(sourcePath, targetPath, ordered);
  if (anchorOrderBlocker) return deepFreeze({ status: 'BLOCKED', blockers: Object.freeze([anchorOrderBlocker]), nodeRows: Object.freeze(lockedNodeRows(ordered)), elementRows: Object.freeze([]) });
  const scoreOptions = { ...options, geometryTransform: options.geometryTransform };
  const alignment = alignElementSequence(sourcePath, targetPath, (a, b) => ciiAlignmentScore(a, b, scoreOptions), options);
  const alignmentRows = deriveCiiAlignmentCorrespondence(alignment, scoreOptions); const subdivision = subdivisionEvidence(sourcePath, targetPath, { ...options, targetGraph });
  const pathScore = scorePathMatch(sourcePath, targetPath, options);
  const pathGate = evaluateCiiAnchorPathGate(sourcePath, targetPath, alignment, subdivision, pathScore, options);
  const rawElementRows = subdivision?.compatible ? [deepFreeze({
    correspondenceId: stableId('path', sourcePath.elements[0].elementId, ...targetPath.elements.map((edge) => edge.elementId)), kind: 'ELEMENT_PATH', sourceElementIds: Object.freeze([sourcePath.elements[0].elementId]),
    targetElementIds: Object.freeze(targetPath.elements.map((edge) => edge.elementId)), status: 'HIGH', authority: 'LOCKED_ANCHOR_SPAN_SUBDIVISION', evidence: deepFreeze({ subdivision, pathScore: Number(pathScore.toFixed(1)) }),
  })] : withCandidateEvidence(alignmentRows.elementRows, sourcePath, targetPath, scoreOptions);
  const elementRows = applyCiiPathGateToRows(rawElementRows, pathGate);
  const nodeRows = [...lockedNodeRows(ordered), ...(subdivision?.compatible ? insertedRows(subdivision) : alignmentRows.nodeRows)];
  const custody = targetCustodyConflicts(elementRows); const hardConflicts = elementRows.filter((row) => row.status === 'CONFLICT');
  const ambiguity = elementRows.some((row) => row.status === 'REVIEW' && row.evidence?.candidates?.status === 'AMBIGUOUS');
  const matched = elementRows.some((row) => ['HIGH', 'REVIEW'].includes(row.status) || row.kind === 'ELEMENT_PATH');
  const resultBlockers = [...(custody.length ? ['TARGET_CUSTODY_AMBIGUOUS'] : []), ...pathGate.blockers];
  const status = hardConflicts.length ? 'CONFLICT' : (resultBlockers.length ? 'UNRESOLVED' : (matched ? 'READY' : 'UNRESOLVED'));
  return deepFreeze({
    schema: 'CIIWorkspaceCorrespondence.v1', status, blockers: Object.freeze(resultBlockers), ambiguityRetained: ambiguity, targetCustodyConflicts: custody,
    correspondenceIdentity: correspondenceIdentity(sourceGraph, targetGraph, ordered, elementRows), pathScore: Number(pathScore.toFixed(1)), pathGate, sourcePath, targetPath,
    alignment: deepFreeze({ score: alignment.score, operations: alignment.operations.map((op) => ({ op: op.op, sourceElementId: op.refEdge?.elementId || null, targetElementId: op.targetEdge?.elementId || null })) }),
    nodeRows: Object.freeze(nodeRows), elementRows: Object.freeze(elementRows),
  });
}

export function buildCiiAutomaticPathAudit(sourceGraph, targetGraph, options = {}) {
  const source = buildElementPaths(sourceGraph, options); const target = buildElementPaths(targetGraph, options);
  return deepFreeze({ sourcePathRows: source.pathRows, targetPathRows: target.pathRows, sourceAnchorNodeCount: source.anchorNodeCount, targetAnchorNodeCount: target.anchorNodeCount });
}
