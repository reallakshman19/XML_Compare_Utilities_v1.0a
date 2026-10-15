const DEFAULT_LENGTH_TOL_MM = 6;
const DEFAULT_PATH_SCORE_MIN = 45;

function text(value) { return value === undefined || value === null ? '' : String(value).trim(); }
function unique(values) { return [...new Set((values || []).filter((value) => text(value)))]; }
function bucket(value, tol) { const n = Number(value); return Number.isFinite(n) && tol > 0 ? Math.round(n / tol) * tol : 0; }
function fmt(value, places = 3) { const n = Number(value); return Number.isFinite(n) ? Number(n.toFixed(places)) : 0; }
function edgeKey(edge) { return edge?.elementId || `${edge?.canonicalFrom || edge?.from}->${edge?.canonicalTo || edge?.to}`; }
function edgeNodes(edge) { return [edge.canonicalFrom || edge.from, edge.canonicalTo || edge.to]; }
function otherNode(edge, node) { const [a, b] = edgeNodes(edge); return text(a) === text(node) ? b : a; }
function packetKey(edge) { return unique(edge.packetEvidence || edge.flags || []).sort().join('+') || 'PIPE'; }
function addVec(a, b) { return { x: Number(a?.x || 0) + Number(b?.x || 0), y: Number(a?.y || 0) + Number(b?.y || 0), z: Number(a?.z || 0) + Number(b?.z || 0) }; }
function mulVec(v, k) { return { x: Number(v?.x || 0) * k, y: Number(v?.y || 0) * k, z: Number(v?.z || 0) * k }; }
function mag(v) { return Math.hypot(Number(v?.x || 0), Number(v?.y || 0), Number(v?.z || 0)); }
function orientedVector(edge, fromNode, toNode) {
  const forward = text(edge.canonicalFrom || edge.from) === text(fromNode) && text(edge.canonicalTo || edge.to) === text(toNode);
  const reverse = text(edge.canonicalFrom || edge.from) === text(toNode) && text(edge.canonicalTo || edge.to) === text(fromNode);
  const base = { x: Number(edge.dx || 0), y: Number(edge.dy || 0), z: Number(edge.dz || 0) };
  return reverse && !forward ? mulVec(base, -1) : base;
}
function anchorNodeType(node, graph) {
  const incident = graph.adjacency.get(node) || [];
  const flags = [];
  if (incident.length === 1) flags.push('TERMINAL');
  if (incident.length >= 3) flags.push('BRANCH');
  if (incident.some((edge) => edge.isAnchorElement)) flags.push('PROPERTY_ANCHOR');
  return flags.length ? flags.join('+') : 'PASS_THROUGH';
}
function buildAdjacency(edges) {
  const adjacency = new Map();
  const add = (node, edge) => {
    const key = text(node);
    if (!adjacency.has(key)) adjacency.set(key, []);
    adjacency.get(key).push(edge);
  };
  for (const edge of edges || []) {
    const [a, b] = edgeNodes(edge);
    add(a, edge);
    add(b, edge);
  }
  return adjacency;
}
function anchorNodesFor(edges, adjacency) {
  const anchors = new Set();
  for (const [node, incident] of adjacency.entries()) {
    if (incident.length !== 2) anchors.add(node);
    if (incident.some((edge) => edge.isAnchorElement)) anchors.add(node);
  }
  if (!anchors.size && edges?.length) anchors.add(text(edgeNodes(edges[0])[0]));
  return anchors;
}
function pathSignature(path, toleranceMm) {
  const lengths = path.elements.map((edge) => bucket(edge.lengthMm, toleranceMm)).join(',');
  const packets = path.elements.map(packetKey).join('|');
  const anchors = `${path.startAnchorType}->${path.endAnchorType}`;
  return `N=${path.elements.length};L=${bucket(path.totalLengthMm, toleranceMm)};A=${anchors};E=${lengths};P=${packets}`;
}
function finalizePath(path, toleranceMm) {
  let station = 0;
  let coord = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < path.elements.length; i += 1) {
    const edge = path.elements[i];
    const fromNode = path.nodes[i];
    const toNode = path.nodes[i + 1];
    const vector = orientedVector(edge, fromNode, toNode);
    const nextCoord = addVec(coord, vector);
    edge.pathId = path.pathId;
    edge.pathIndex = i + 1;
    edge.pathStationStartMm = station;
    station += Number(edge.lengthMm || 0);
    edge.pathStationEndMm = station;
    edge.pathStationMidMm = (edge.pathStationStartMm + edge.pathStationEndMm) / 2;
    edge.pathStartCoord = coord;
    edge.pathEndCoord = nextCoord;
    edge.pathMidCoord = mulVec(addVec(coord, nextCoord), 0.5);
    coord = nextCoord;
  }
  path.totalLengthMm = station;
  path.totalVector = coord;
  path.totalVectorLengthMm = Math.max(mag(coord), station, 1);
  for (const edge of path.elements) edge.pathTotalVectorLengthMm = path.totalVectorLengthMm;
  path.signature = pathSignature(path, toleranceMm);
  path.packetSequence = path.elements.map(packetKey);
  path.lengthSequence = path.elements.map((edge) => bucket(edge.lengthMm, toleranceMm));
  return path;
}
function walkPath(startNode, firstEdge, graph, visited, pathId, toleranceMm) {
  const elements = [];
  const nodes = [text(startNode)];
  let currentNode = text(startNode);
  let edge = firstEdge;
  while (edge && !visited.has(edgeKey(edge))) {
    visited.add(edgeKey(edge));
    elements.push(edge);
    const nextNode = text(otherNode(edge, currentNode));
    nodes.push(nextNode);
    if (graph.anchors.has(nextNode) && nextNode !== text(startNode)) break;
    const nextEdges = (graph.adjacency.get(nextNode) || []).filter((candidate) => !visited.has(edgeKey(candidate)));
    if (nextEdges.length !== 1) break;
    currentNode = nextNode;
    edge = nextEdges[0];
  }
  const endNode = nodes[nodes.length - 1];
  return finalizePath({
    pathId,
    startNode: text(startNode),
    endNode,
    startAnchorType: anchorNodeType(text(startNode), graph),
    endAnchorType: anchorNodeType(endNode, graph),
    nodes,
    elements,
    totalLengthMm: 0,
  }, toleranceMm);
}
export function buildElementPaths(graph, options = {}) {
  const toleranceMm = Number(options.lengthToleranceMm || DEFAULT_LENGTH_TOL_MM);
  const edges = graph?.edges || [];
  const adjacency = buildAdjacency(edges);
  const anchors = anchorNodesFor(edges, adjacency);
  const pathGraph = { adjacency, anchors };
  const visited = new Set();
  const paths = [];
  let pathId = 0;
  const orderedAnchors = [...anchors].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }));
  for (const anchor of orderedAnchors) {
    const incident = adjacency.get(anchor) || [];
    for (const edge of incident) {
      if (visited.has(edgeKey(edge))) continue;
      pathId += 1;
      const path = walkPath(anchor, edge, pathGraph, visited, `P${pathId}`, toleranceMm);
      if (path.elements.length) paths.push(path);
    }
  }
  for (const edge of edges) {
    if (visited.has(edgeKey(edge))) continue;
    pathId += 1;
    const [start] = edgeNodes(edge);
    const path = walkPath(start, edge, pathGraph, visited, `P${pathId}`, toleranceMm);
    if (path.elements.length) paths.push(path);
  }
  const pathRows = paths.map((path) => ({
    pathId: path.pathId,
    startNode: path.startNode,
    endNode: path.endNode,
    startAnchorType: path.startAnchorType,
    endAnchorType: path.endAnchorType,
    elementCount: path.elements.length,
    totalLengthMm: fmt(path.totalLengthMm),
    vectorLengthMm: fmt(path.totalVectorLengthMm),
    packetSequence: path.packetSequence.join(' | '),
    lengthSequence: path.lengthSequence.join(','),
    signature: path.signature,
  }));
  return { paths, pathRows, anchorNodeCount: anchors.size };
}
function overlapScore(aValues, bValues, weight) {
  const a = new Set(aValues || []);
  const b = new Set(bValues || []);
  if (!a.size && !b.size) return weight;
  let hit = 0;
  for (const value of a) if (b.has(value)) hit += 1;
  return weight * hit / Math.max(a.size, b.size, 1);
}
function numericScore(a, b, tolerance, weight) {
  const delta = Math.abs(Number(a || 0) - Number(b || 0));
  return weight * Math.max(0, 1 - delta / Math.max(tolerance, 1));
}
export function scorePathMatch(referencePath, targetPath, options = {}) {
  const toleranceMm = Number(options.lengthToleranceMm || DEFAULT_LENGTH_TOL_MM);
  let score = 0;
  score += numericScore(referencePath.totalLengthMm, targetPath.totalLengthMm, toleranceMm * Math.max(referencePath.elements.length, targetPath.elements.length, 1) * 3, 35);
  score += numericScore(referencePath.elements.length, targetPath.elements.length, 2, 15);
  score += overlapScore(referencePath.packetSequence, targetPath.packetSequence, 25);
  score += overlapScore([referencePath.startAnchorType, referencePath.endAnchorType], [targetPath.startAnchorType, targetPath.endAnchorType], 15);
  score += overlapScore(referencePath.lengthSequence, targetPath.lengthSequence, 10);
  return Math.max(0, Math.min(100, score));
}
function elementAlignmentScore(refEdge, targetEdge, scoreElementMatch, options = {}) {
  return Number(scoreElementMatch?.(refEdge, targetEdge, options) || 0);
}
export function alignElementSequence(referencePath, targetPath, scoreElementMatch, options = {}) {
  const ref = referencePath.elements || [];
  const tgt = targetPath.elements || [];
  const gapPenalty = Number(options.gapPenalty ?? -28);
  const rows = Array.from({ length: ref.length + 1 }, () => Array(tgt.length + 1).fill(null));
  rows[0][0] = { score: 0, op: 'START' };
  for (let i = 1; i <= ref.length; i += 1) rows[i][0] = { score: rows[i - 1][0].score + gapPenalty, op: 'DELETE' };
  for (let j = 1; j <= tgt.length; j += 1) rows[0][j] = { score: rows[0][j - 1].score + gapPenalty, op: 'INSERT' };
  for (let i = 1; i <= ref.length; i += 1) {
    for (let j = 1; j <= tgt.length; j += 1) {
      const matchScore = elementAlignmentScore(ref[i - 1], tgt[j - 1], scoreElementMatch, options) - 45;
      const choices = [
        { score: rows[i - 1][j - 1].score + matchScore, op: 'MATCH' },
        { score: rows[i - 1][j].score + gapPenalty, op: 'DELETE' },
        { score: rows[i][j - 1].score + gapPenalty, op: 'INSERT' },
      ];
      choices.sort((a, b) => b.score - a.score);
      rows[i][j] = choices[0];
    }
  }
  const operations = [];
  let i = ref.length;
  let j = tgt.length;
  while (i > 0 || j > 0) {
    const cell = rows[i][j] || { op: i > 0 ? 'DELETE' : 'INSERT' };
    if (cell.op === 'MATCH') {
      const refEdge = ref[i - 1];
      const targetEdge = tgt[j - 1];
      const score = elementAlignmentScore(refEdge, targetEdge, scoreElementMatch, options);
      operations.push({ op: 'MATCH', refEdge, targetEdge, elementScore: fmt(score, 1), refIndex: i, targetIndex: j });
      i -= 1; j -= 1;
    } else if (cell.op === 'DELETE') {
      operations.push({ op: 'DELETE_REFERENCE', refEdge: ref[i - 1], targetEdge: null, elementScore: 0, refIndex: i, targetIndex: '' });
      i -= 1;
    } else {
      operations.push({ op: 'INSERT_TARGET', refEdge: null, targetEdge: tgt[j - 1], elementScore: 0, refIndex: '', targetIndex: j });
      j -= 1;
    }
  }
  operations.reverse();
  return { score: fmt(rows[ref.length][tgt.length]?.score || 0, 3), operations };
}
export function alignElementPaths(referenceGraph, targetGraph, options = {}) {
  const minPathScore = Number(options.minPathScore || DEFAULT_PATH_SCORE_MIN);
  const scoreElementMatch = options.scoreElementMatch;
  const referencePaths = buildElementPaths(referenceGraph, options);
  const targetPaths = buildElementPaths(targetGraph, options);
  const pathCandidates = [];
  for (const refPath of referencePaths.paths) {
    for (const targetPath of targetPaths.paths) {
      const score = scorePathMatch(refPath, targetPath, options);
      if (score >= minPathScore) pathCandidates.push({ refPath, targetPath, score });
    }
  }
  pathCandidates.sort((a, b) => b.score - a.score);
  const usedRefPaths = new Set();
  const usedTargetPaths = new Set();
  const pathMappings = [];
  const alignmentRows = [];
  const alignedCandidates = [];
  const pathConflicts = [];
  for (const candidate of pathCandidates) {
    if (usedRefPaths.has(candidate.refPath.pathId) || usedTargetPaths.has(candidate.targetPath.pathId)) continue;
    usedRefPaths.add(candidate.refPath.pathId);
    usedTargetPaths.add(candidate.targetPath.pathId);
    const refAlternates = pathCandidates.filter((item) => item.refPath.pathId === candidate.refPath.pathId && item.targetPath.pathId !== candidate.targetPath.pathId);
    const secondBest = refAlternates[0]?.score || 0;
    const scoreGap = candidate.score - secondBest;
    const ambiguous = scoreGap < 12;
    const alignment = alignElementSequence(candidate.refPath, candidate.targetPath, scoreElementMatch, options);
    pathMappings.push({
      referencePath: candidate.refPath.pathId,
      targetPath: candidate.targetPath.pathId,
      referenceLengthMm: fmt(candidate.refPath.totalLengthMm),
      targetLengthMm: fmt(candidate.targetPath.totalLengthMm),
      referenceElements: candidate.refPath.elements.length,
      targetElements: candidate.targetPath.elements.length,
      score: fmt(candidate.score, 1),
      nextBestScore: fmt(secondBest, 1),
      scoreGap: fmt(scoreGap, 1),
      status: ambiguous ? 'AMBIGUOUS_PATH' : 'MATCHED_PATH',
      referenceSignature: candidate.refPath.signature,
      targetSignature: candidate.targetPath.signature,
    });
    if (ambiguous) pathConflicts.push({ referencePath: candidate.refPath.pathId, targetPath: candidate.targetPath.pathId, issue: 'AMBIGUOUS_PATH', detail: `path score=${fmt(candidate.score, 1)} gap=${fmt(scoreGap, 1)}` });
    for (const op of alignment.operations) {
      const row = {
        referencePath: candidate.refPath.pathId,
        targetPath: candidate.targetPath.pathId,
        op: op.op,
        referenceElement: op.refEdge ? `${op.refEdge.elementId} ${op.refEdge.normalizedFromTo || ''}` : '',
        targetElement: op.targetEdge ? `${op.targetEdge.elementId} ${op.targetEdge.normalizedFromTo || ''}` : '',
        referenceStationMm: op.refEdge ? fmt(op.refEdge.pathStationMidMm ?? op.refEdge.stationMidMm) : '',
        targetStationMm: op.targetEdge ? fmt(op.targetEdge.pathStationMidMm ?? op.targetEdge.stationMidMm) : '',
        referenceCoord: op.refEdge?.pathMidCoord ? `${fmt(op.refEdge.pathMidCoord.x)},${fmt(op.refEdge.pathMidCoord.y)},${fmt(op.refEdge.pathMidCoord.z)}` : '',
        targetCoord: op.targetEdge?.pathMidCoord ? `${fmt(op.targetEdge.pathMidCoord.x)},${fmt(op.targetEdge.pathMidCoord.y)},${fmt(op.targetEdge.pathMidCoord.z)}` : '',
        elementScore: op.elementScore,
        pathStatus: ambiguous ? 'AMBIGUOUS_PATH' : 'MATCHED_PATH',
      };
      alignmentRows.push(row);
      if (op.op === 'MATCH' && op.refEdge && op.targetEdge && !ambiguous) {
        alignedCandidates.push({
          refElement: op.refEdge,
          targetElement: op.targetEdge,
          score: Number(op.elementScore),
          pathScore: Number(candidate.score),
          referencePath: candidate.refPath.pathId,
          targetPath: candidate.targetPath.pathId,
          alignmentOp: 'MATCH',
        });
      }
    }
  }
  for (const path of referencePaths.paths) {
    if (!usedRefPaths.has(path.pathId)) pathConflicts.push({ referencePath: path.pathId, targetPath: '', issue: 'UNMATCHED_REFERENCE_PATH', detail: `elements=${path.elements.length}; length=${fmt(path.totalLengthMm)}mm` });
  }
  return {
    referencePathRows: referencePaths.pathRows,
    targetPathRows: targetPaths.pathRows,
    pathMappings,
    alignmentRows,
    alignedCandidates,
    pathConflicts,
    summary: {
      referencePathCount: referencePaths.paths.length,
      targetPathCount: targetPaths.paths.length,
      matchedPathCount: pathMappings.filter((row) => row.status === 'MATCHED_PATH').length,
      ambiguousPathCount: pathMappings.filter((row) => row.status === 'AMBIGUOUS_PATH').length,
      alignedElementCandidateCount: alignedCandidates.length,
      pathConflictCount: pathConflicts.length,
    },
  };
}
