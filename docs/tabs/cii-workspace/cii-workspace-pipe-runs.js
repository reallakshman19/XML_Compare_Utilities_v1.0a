import { CII_WORKSPACE_SCHEMAS, deepFreeze, uniqueStrings } from './cii-workspace-contracts.js';

function otherNode(edge, nodeId) { return String(edge.from) === String(nodeId) ? String(edge.to) : String(edge.from); }
function dot(a, b) { return a.reduce((sum, value, index) => sum + value * b[index], 0); }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function mag(a) { return Math.sqrt(dot(a, a)); }
function mul(a, scale) { return a.map((value) => value * scale); }
function clamp(value, low = -1, high = 1) { return Math.max(low, Math.min(high, value)); }
function unit(vector) { const length = mag(vector); return length > 1e-9 ? mul(vector, 1 / length) : null; }
function angleDeg(a, b, undirected = false) {
  const cosine = dot(a, b);
  return Math.acos(clamp(undirected ? Math.abs(cosine) : cosine)) * 180 / Math.PI;
}
function edgeLength(edge) { return Number(edge.lengthMm || Math.hypot(Number(edge.dx || 0), Number(edge.dy || 0), Number(edge.dz || 0))); }
function rawVector(edge) { return [Number(edge.dx || 0), Number(edge.dy || 0), Number(edge.dz || 0)]; }
function awayVector(edge, nodeId) { return String(edge.from) === String(nodeId) ? rawVector(edge) : mul(rawVector(edge), -1); }
function edgeId(edge) { return String(edge.elementId || `${edge.from}->${edge.to}`); }
function positiveNumber(value) { const parsed = Number(value); return Number.isFinite(parsed) && parsed > 0 ? parsed : null; }

function canonicalUndirected(direction) {
  const result = [...direction]; const pivot = result.find((value) => Math.abs(value) > 1e-12);
  return pivot != null && pivot < 0 ? mul(result, -1) : result;
}
function axisLabel(direction, snapDeg) {
  const axes = [['X', [1, 0, 0]], ['Y', [0, 1, 0]], ['Z', [0, 0, 1]]];
  for (const [label, axis] of axes) if (angleDeg(direction, axis, true) <= snapDeg) return label;
  return `SKEW(${direction.map((value) => Number(value.toFixed(6))).join(',')})`;
}
function terminator(kind, nodeId, componentKind = null) { return Object.freeze({ kind, nodeId: String(nodeId), componentKind }); }

function continueRay(graph, currentNode, previousEdge, currentDirection, options) {
  const incident = [...(graph?.adjacency?.get(String(currentNode)) || [])];
  if (incident.length <= 1) return { stop: terminator('TERMINAL', currentNode) };
  if (incident.length >= 3) return { stop: terminator('BRANCH', currentNode) };
  const next = incident.find((edge) => edge !== previousEdge && edgeId(edge) !== edgeId(previousEdge));
  if (!next) return { stop: terminator('TERMINAL', currentNode) };
  if (next.componentKind !== 'PIPE') return { stop: terminator('COMPONENT_TRANSITION', currentNode, next.componentKind) };
  const direction = unit(awayVector(next, currentNode));
  if (!direction) return { stop: terminator('INVALID_GEOMETRY', currentNode) };
  if (angleDeg(currentDirection, direction) > options.runCollinearAngleDeg) return { stop: terminator('DIRECTION_CHANGE', currentNode) };
  return { next, direction };
}
function walkRay(graph, anchorNodeId, startEdge, options) {
  const firstDirection = unit(awayVector(startEdge, anchorNodeId));
  if (!firstDirection || edgeLength(startEdge) <= 1e-9) return null;
  let currentNode = otherNode(startEdge, anchorNodeId); let previousEdge = startEdge;
  let currentDirection = firstDirection; let totalLengthMm = edgeLength(startEdge);
  const elementIds = [edgeId(startEdge)]; let end = null;
  while (!end) {
    if (elementIds.length >= options.maxRunElements) { end = terminator('TRUNCATED', currentNode); break; }
    const nextStep = continueRay(graph, currentNode, previousEdge, currentDirection, options);
    if (nextStep.stop) { end = nextStep.stop; break; }
    totalLengthMm += edgeLength(nextStep.next); elementIds.push(edgeId(nextStep.next));
    previousEdge = nextStep.next; currentDirection = nextStep.direction; currentNode = otherNode(nextStep.next, currentNode);
  }
  return { axis: canonicalUndirected(firstDirection), totalLengthMm, elementIds, terminator: end };
}
function mergeRays(rays, options) {
  const groups = [];
  for (const ray of [...rays].sort((a, b) => a.elementIds[0].localeCompare(b.elementIds[0], undefined, { numeric: true }))) {
    let group = groups.find((item) => angleDeg(item.axis, ray.axis, true) <= options.runCollinearAngleDeg);
    if (!group) { group = { axis: ray.axis, rays: [] }; groups.push(group); }
    group.rays.push(ray);
  }
  return groups.map((group, index) => {
    const elementIds = uniqueStrings(group.rays.flatMap((ray) => ray.elementIds));
    const terminators = group.rays.map((ray) => ray.terminator);
    return Object.freeze({
      runId: `R${index + 1}`, axis: Object.freeze(group.axis), axisLabel: axisLabel(group.axis, options.axisLabelSnapDeg),
      totalLengthMm: group.rays.reduce((sum, ray) => sum + ray.totalLengthMm, 0), elementCount: elementIds.length,
      elementIds: Object.freeze(elementIds), terminators: Object.freeze(terminators),
      terminatorClasses: Object.freeze(terminators.map((item) => `${item.kind}:${item.componentKind || ''}`).sort()),
      truncated: terminators.some((item) => item.kind === 'TRUNCATED'),
    });
  });
}

function independentPairs(runs, minimumAngleDeg) {
  const result = [];
  for (let a = 0; a < runs.length - 1; a += 1) for (let b = a + 1; b < runs.length; b += 1) {
    const includedAngleDeg = angleDeg(runs[a].axis, runs[b].axis, true);
    if (includedAngleDeg >= minimumAngleDeg) result.push({ indexes: [a, b], includedAngleDeg });
  }
  return result;
}
function maxIndependentCount(runs, minimumAngleDeg) {
  if (!runs.length) return 0;
  if (runs.length > 12) return independentPairs(runs, minimumAngleDeg).length ? 2 : 1;
  let best = 0;
  const visit = (index, chosen) => {
    if (index === runs.length) { best = Math.max(best, chosen.length); return; }
    visit(index + 1, chosen);
    if (chosen.every((item) => angleDeg(runs[item].axis, runs[index].axis, true) >= minimumAngleDeg)) visit(index + 1, [...chosen, index]);
  };
  visit(0, []); return best;
}
function maxTripleProduct(runs) {
  let best = 0;
  for (let a = 0; a < runs.length - 2; a += 1) for (let b = a + 1; b < runs.length - 1; b += 1) {
    for (let c = b + 1; c < runs.length; c += 1) best = Math.max(best, Math.abs(dot(runs[a].axis, cross(runs[b].axis, runs[c].axis))));
  }
  return best;
}
function geometryDescriptor(result) {
  const count = result.independentAxisRunCount; const triple = count >= 3 ? maxTripleProduct(result.runs) : 0;
  const dimension = count < 2 ? 'ONE_AXIS' : (count === 2 ? 'TWO_AXIS' : (triple > 1e-6 ? 'FULL_3D' : 'PLANAR_MULTI_AXIS'));
  return { independentAxisRunCount: count, maxScalarTripleProduct: triple, dimension };
}

function optionsFor(raw = {}) {
  return {
    runCollinearAngleDeg: Number(raw.runCollinearAngleDeg ?? 0.5), axisLabelSnapDeg: Number(raw.axisLabelSnapDeg ?? 2),
    independentAxisAngleDeg: Number(raw.independentAxisAngleDeg ?? 15), odToleranceFactor: positiveNumber(raw.odToleranceFactor) ?? 2,
    maxRunElements: Math.max(1, Number(raw.maxRunElements ?? 256)),
  };
}
function sourceTolerancePolicy(graph, nodeId, options) {
  const incident = [...(graph?.adjacency?.get(String(nodeId)) || [])].filter((edge) => edge.componentKind === 'PIPE');
  const ods = incident.map((edge) => positiveNumber(edge.diameter ?? edge.od)).filter((value) => value != null);
  const odRefMm = ods.length ? Math.min(...ods) : null;
  return Object.freeze({
    kind: 'OD_SCALED', factor: options.odToleranceFactor, configurable: true, odAuthority: 'SOURCE',
    odReferencePolicy: 'MIN_POSITIVE_INCIDENT_SOURCE_OD', identityRole: 'TOLERANCE_SCALE_ONLY',
    available: odRefMm != null, odRefMm, toleranceMm: odRefMm == null ? null : options.odToleranceFactor * odRefMm,
  });
}

export function extractCiiPipeRunsAtNode(graph, nodeId, rawOptions = {}) {
  const options = optionsFor(rawOptions); const key = String(nodeId);
  const incident = [...(graph?.adjacency?.get(key) || [])].filter((edge) => edge.componentKind === 'PIPE');
  const rays = incident.map((edge) => walkRay(graph, key, edge, options)).filter(Boolean);
  const runs = mergeRays(rays, options); const pairs = independentPairs(runs, options.independentAxisAngleDeg);
  const result = {
    nodeId: key, runs, runCount: runs.length, independentAxisRunCount: maxIndependentCount(runs, options.independentAxisAngleDeg),
    independentPairs: pairs, truncated: runs.some((run) => run.truncated),
    policy: Object.freeze({ runCollinearAngleDeg: options.runCollinearAngleDeg, independentAxisAngleDeg: options.independentAxisAngleDeg,
      axisLabelSnapDeg: options.axisLabelSnapDeg, maxRunElements: options.maxRunElements }),
  };
  result.geometry = Object.freeze(geometryDescriptor(result));
  return deepFreeze(result);
}

function sameStrings(left, right) { return left.length === right.length && left.every((value, index) => value === right[index]); }
function mappingEvidence(sourceRuns, targetRuns, mapping, toleranceMm) {
  const rows = mapping.map(([sourceIndex, targetIndex]) => {
    const source = sourceRuns[sourceIndex]; const target = targetRuns[targetIndex];
    const lengthDeltaMm = Math.abs(source.totalLengthMm - target.totalLengthMm);
    return { sourceRunId: source.runId, targetRunId: target.runId, lengthDeltaMm,
      normalizedLengthError: lengthDeltaMm / toleranceMm, terminatorsCompatible: sameStrings(source.terminatorClasses, target.terminatorClasses) };
  });
  const maxNormalizedLengthError = Math.max(...rows.map((row) => row.normalizedLengthError));
  return { rows, maxNormalizedLengthError,
    qualified: maxNormalizedLengthError <= 1 && rows.every((row) => row.terminatorsCompatible) };
}
function mappingGeometry(source, target, mapping, toleranceMm) {
  const mapped = mappingEvidence(source.runs, target.runs, mapping, toleranceMm); const angleRows = [];
  for (let a = 0; a < mapping.length - 1; a += 1) for (let b = a + 1; b < mapping.length; b += 1) {
    const [sa, ta] = mapping[a]; const [sb, tb] = mapping[b];
    const sourceAngleDeg = angleDeg(source.runs[sa].axis, source.runs[sb].axis, true);
    const targetAngleDeg = angleDeg(target.runs[ta].axis, target.runs[tb].axis, true);
    const angleDifferenceDeg = Math.abs(sourceAngleDeg - targetAngleDeg);
    const characteristicLengthMm = Math.min(source.runs[sa].totalLengthMm, source.runs[sb].totalLengthMm,
      target.runs[ta].totalLengthMm, target.runs[tb].totalLengthMm);
    const angularDisplacementMm = 2 * characteristicLengthMm * Math.sin((angleDifferenceDeg * Math.PI / 180) / 2);
    angleRows.push({ sourceAngleDeg, targetAngleDeg, angleDifferenceDeg, characteristicLengthMm,
      angularDisplacementMm, normalizedAngleError: angularDisplacementMm / toleranceMm });
  }
  const maxNormalizedAngleError = angleRows.length ? Math.max(...angleRows.map((row) => row.normalizedAngleError)) : 0;
  return { mapping: mapped, angleRows, maxNormalizedAngleError,
    maxNormalizedGeometricError: Math.max(mapped.maxNormalizedLengthError, maxNormalizedAngleError),
    qualified: mapped.qualified && maxNormalizedAngleError <= 1 };
}
function mappingTripleProduct(source, target, mapping) {
  let best = 0;
  for (let a = 0; a < mapping.length - 2; a += 1) for (let b = a + 1; b < mapping.length - 1; b += 1) {
    for (let c = b + 1; c < mapping.length; c += 1) {
      const sourceValue = Math.abs(dot(source.runs[mapping[a][0]].axis, cross(source.runs[mapping[b][0]].axis, source.runs[mapping[c][0]].axis)));
      const targetValue = Math.abs(dot(target.runs[mapping[a][1]].axis, cross(target.runs[mapping[b][1]].axis, target.runs[mapping[c][1]].axis)));
      best = Math.max(best, Math.min(sourceValue, targetValue));
    }
  }
  return best;
}
function independentAddition(source, target, mapping, sourceIndex, targetIndex, minimumAngleDeg) {
  return mapping.every(([s, t]) => angleDeg(source.runs[s].axis, source.runs[sourceIndex].axis, true) >= minimumAngleDeg
    && angleDeg(target.runs[t].axis, target.runs[targetIndex].axis, true) >= minimumAngleDeg);
}
function extendMapping(source, target, seed, toleranceMm, minimumAngleDeg) {
  if (source.runs.length > 8 || target.runs.length > 8) return seed;
  let best = seed; const seedSources = new Set(seed.runMapping.map(([s]) => s)); const seedTargets = new Set(seed.runMapping.map(([, t]) => t));
  const visit = (sourceIndex, mapping, usedTargets) => {
    if (sourceIndex >= source.runs.length) {
      const evidence = mappingGeometry(source, target, mapping, toleranceMm);
      if (!evidence.qualified) return;
      if (mapping.length > best.compatibleIndependentRunCount
        || (mapping.length === best.compatibleIndependentRunCount && evidence.maxNormalizedGeometricError < best.maxNormalizedGeometricError)) {
        best = { ...best, runMapping: mapping.map((row) => [...row]), mapping: evidence.mapping, fullGeometry: evidence,
          compatibleIndependentRunCount: mapping.length, compatibleTripleProduct: mappingTripleProduct(source, target, mapping),
          maxNormalizedGeometricError: evidence.maxNormalizedGeometricError };
      }
      return;
    }
    if (seedSources.has(sourceIndex)) { visit(sourceIndex + 1, mapping, usedTargets); return; }
    visit(sourceIndex + 1, mapping, usedTargets);
    for (let targetIndex = 0; targetIndex < target.runs.length; targetIndex += 1) {
      if (usedTargets.has(targetIndex) || seedTargets.has(targetIndex)) continue;
      if (!independentAddition(source, target, mapping, sourceIndex, targetIndex, minimumAngleDeg)) continue;
      const candidate = [...mapping, [sourceIndex, targetIndex]];
      if (!mappingGeometry(source, target, candidate, toleranceMm).qualified) continue;
      visit(sourceIndex + 1, candidate, new Set([...usedTargets, targetIndex]));
    }
  };
  visit(0, seed.runMapping, new Set(seedTargets)); return best;
}
function pairCandidate(source, target, sourcePair, targetPair, mapping, toleranceMm) {
  const geometry = mappingGeometry(source, target, mapping, toleranceMm); const angle = geometry.angleRows[0];
  return {
    sourcePair: sourcePair.indexes, targetPair: targetPair.indexes, runMapping: mapping,
    sourceIncludedAngleDeg: sourcePair.includedAngleDeg, targetIncludedAngleDeg: targetPair.includedAngleDeg,
    angleDifferenceDeg: angle.angleDifferenceDeg, characteristicLengthMm: angle.characteristicLengthMm,
    angularDisplacementMm: angle.angularDisplacementMm, normalizedAngleError: angle.normalizedAngleError,
    mapping: geometry.mapping, fullGeometry: geometry, maxNormalizedGeometricError: geometry.maxNormalizedGeometricError,
    compatibleIndependentRunCount: mapping.length, compatibleTripleProduct: 0, qualified: geometry.qualified,
  };
}
function comparePairBasis(source, target, sourcePair, targetPair, toleranceMm) {
  const [sa, sb] = sourcePair.indexes; const [ta, tb] = targetPair.indexes;
  return [
    pairCandidate(source, target, sourcePair, targetPair, [[sa, ta], [sb, tb]], toleranceMm),
    pairCandidate(source, target, sourcePair, targetPair, [[sa, tb], [sb, ta]], toleranceMm),
  ];
}
function methodBWeight(source, target, selected) {
  const count = selected?.compatibleIndependentRunCount || 0; const triple = selected?.compatibleTripleProduct || 0;
  const geometryComplexity = count < 2 ? 0 : (count === 2 ? 24 : 32 + (8 * clamp(triple, 0, 1)));
  const runCompatibility = selected ? 20 * (1 - clamp(selected.maxNormalizedGeometricError, 0, 1)) : 0;
  const topologyFingerprint = selected?.mapping?.rows?.every((row) => row.terminatorsCompatible) ? 15 : 0;
  const compatibleDimension = count < 2 ? 'ONE_AXIS' : (count === 2 ? 'TWO_AXIS' : (triple > 1e-6 ? 'FULL_3D' : 'PLANAR_MULTI_AXIS'));
  return Object.freeze({
    geometryComplexity: Number(geometryComplexity.toFixed(3)), runCompatibility: Number(runCompatibility.toFixed(3)),
    topologyFingerprint, subtotal: Number((geometryComplexity + runCompatibility + topologyFingerprint).toFixed(3)),
    compatibleIndependentRunCount: count, compatibleDimension, compatibleTripleProduct: Number(triple.toFixed(6)),
    sourceDimension: source.geometry.dimension, targetDimension: target.geometry.dimension,
    sourceTripleProduct: Number(source.geometry.maxScalarTripleProduct.toFixed(6)), targetTripleProduct: Number(target.geometry.maxScalarTripleProduct.toFixed(6)),
  });
}

export function qualifyCiiMethodBRunBasis(sourceGraph, targetGraph, sourceNodeId, targetNodeId, rawOptions = {}) {
  const options = optionsFor(rawOptions); const tolerancePolicy = sourceTolerancePolicy(sourceGraph, sourceNodeId, options);
  const source = extractCiiPipeRunsAtNode(sourceGraph, sourceNodeId, options); const target = extractCiiPipeRunsAtNode(targetGraph, targetNodeId, options);
  const hardGate = source.independentAxisRunCount >= 2 && target.independentAxisRunCount >= 2 && !source.truncated && !target.truncated;
  const candidates = [];
  if (tolerancePolicy.available) for (const sourcePair of source.independentPairs) for (const targetPair of target.independentPairs) {
    candidates.push(...comparePairBasis(source, target, sourcePair, targetPair, tolerancePolicy.toleranceMm));
  }
  const qualified = candidates.filter((item) => item.qualified)
    .map((item) => extendMapping(source, target, item, tolerancePolicy.toleranceMm, options.independentAxisAngleDeg))
    .sort((a, b) => b.compatibleIndependentRunCount - a.compatibleIndependentRunCount
      || a.maxNormalizedGeometricError - b.maxNormalizedGeometricError
      || a.sourcePair.join('-').localeCompare(b.sourcePair.join('-')) || a.targetPair.join('-').localeCompare(b.targetPair.join('-')));
  const status = tolerancePolicy.available && hardGate && qualified.length ? 'READY' : 'REVIEW';
  const selectedBasis = qualified[0] || null; const weight = methodBWeight(source, target, selectedBasis);
  const reason = !tolerancePolicy.available ? 'SOURCE_OD_TOLERANCE_UNAVAILABLE'
    : (!hardGate ? 'METHOD_B_TWO_AXIS_GATE_NOT_MET' : (qualified.length ? 'TWO_AXIS_RUN_BASIS_COMPATIBLE' : 'NO_OD_SCALED_COMPATIBLE_RUN_BASIS'));
  return deepFreeze({
    schema: CII_WORKSPACE_SCHEMAS.methodBRunBasis, method: 'METHOD_B_NETWORK', status,
    sourceNodeId: String(sourceNodeId), targetNodeId: String(targetNodeId), source, target,
    compatibleBasisCount: qualified.length, selectedBasis, reason, tolerancePolicy, weight,
    identityExclusions: Object.freeze(['NODE_NUMBER_OFFSET_NOT_USED', 'OD_NOT_IDENTITY_USED_AS_TOLERANCE_SCALE', 'WALL_NOT_USED']),
    policy: Object.freeze({ independentAxisAngleDeg: options.independentAxisAngleDeg, odToleranceFactor: options.odToleranceFactor }),
  });
}
