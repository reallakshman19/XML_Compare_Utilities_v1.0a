import { deepFreeze } from './cii-workspace-contracts.js';
import { registeredCiiPoint } from './cii-workspace-geometry.js';
import { ciiCorroborationBand, ciiOdConfidenceBand } from './cii-workspace-confidence-bands.js';
import { compareCiiElementNodeNames } from './cii-workspace-node-name-corroboration.js';

export const CII_MATCH_DEFAULTS = Object.freeze({
  spatialToleranceMm: 100,
  diameterRelativeTolerance: 0.10,
  wallRelativeTolerance: 0.10,
  networkPassingScore: 55,
  networkStrongScore: 70,
  identityWeight: 50,
  diameterWeight: 30,
  wallWeight: 30,
});

function number(value) { return Number(value); }
function closeness(a, b, tolerance) {
  const left = number(a); const right = number(b); const scale = Math.max(number(tolerance) || 1, 1e-9);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return 0;
  return Math.max(0, 1 - Math.abs(left - right) / scale);
}
function endpointDegrees(edge) { return [edge?.fromContext?.degree || 0, edge?.toContext?.degree || 0].sort((a, b) => a - b); }
function pointDistance(a, b) { return Math.hypot(number(a.x) - number(b.x), number(a.y) - number(b.y), number(a.z) - number(b.z)); }
function registeredPoint(point, transform) {
  if (!point) return null;
  if (!transform) return point;
  if (transform.status !== 'READY') return null;
  return registeredCiiPoint(transform, point) || null;
}
function endpointSpatialEvidence(source, target, transform) {
  if (!source?.fromPos || !source?.toPos || !target?.fromPos || !target?.toPos) return null;
  const sourceFrom = registeredPoint(source.fromPos, transform); const sourceTo = registeredPoint(source.toPos, transform);
  if (!sourceFrom || !sourceTo) return null;
  const direct = [pointDistance(sourceFrom, target.fromPos), pointDistance(sourceTo, target.toPos)];
  const reverse = [pointDistance(sourceFrom, target.toPos), pointDistance(sourceTo, target.fromPos)];
  const directMax = Math.max(...direct); const reverseMax = Math.max(...reverse);
  return directMax <= reverseMax
    ? { orientation: 'DIRECT', endpointDistancesMm: direct, distanceMm: directMax }
    : { orientation: 'REVERSED', endpointDistancesMm: reverse, distanceMm: reverseMax };
}
function stripDimensionTokens(value) { return String(value ?? '').replace(/\|OD[^|]*/gi, '').replace(/\|WT[^|]*/gi, ''); }
function jaccard(left = [], right = []) {
  const a = new Set(left.map(stripDimensionTokens)); const b = new Set(right.map(stripDimensionTokens));
  if (!a.size && !b.size) return 1;
  let hits = 0; for (const value of a) if (b.has(value)) hits += 1;
  return hits / Math.max(new Set([...a, ...b]).size, 1);
}
function contextSimilarity(left, right) {
  const a = left?.neighbourhoodLayers || []; const b = right?.neighbourhoodLayers || [];
  if (!a.length && !b.length) return closeness(left?.degree || 0, right?.degree || 0, 2);
  const weights = [1, 0.7, 0.45]; let total = 0; let weight = 0;
  for (let index = 0; index < weights.length; index += 1) {
    if (!a[index] && !b[index]) continue;
    total += weights[index] * jaccard(a[index] || [], b[index] || []); weight += weights[index];
  }
  return weight ? total / weight : 0;
}
function neighbourhoodSimilarity(source, target) {
  const direct = (contextSimilarity(source?.fromContext, target?.fromContext) + contextSimilarity(source?.toContext, target?.toContext)) / 2;
  const reverse = (contextSimilarity(source?.fromContext, target?.toContext) + contextSimilarity(source?.toContext, target?.fromContext)) / 2;
  return Math.max(direct, reverse);
}
function sequenceSimilarity(source, target) {
  const a = source?.pathSequenceContext || []; const b = target?.pathSequenceContext || [];
  if (!a.length || !b.length) return 0;
  const length = Math.max(a.length, b.length); let hits = 0;
  for (let index = 0; index < length; index += 1) if (a[index] === b[index]) hits += 1;
  return hits / length;
}
function stationFraction(edge) {
  if (edge?.pathStationMidMm == null) return null;
  const total = number(edge.pathTotalLengthMm || edge.pathTotalVectorLengthMm || 0);
  return total > 0 ? number(edge.pathStationMidMm) / total : null;
}
function networkBlockers(source, target, options = {}) {
  const blockers = []; const s = endpointDegrees(source); const t = endpointDegrees(target);
  if (!options?.propagation && s[1] >= 3 && t[1] < 3) blockers.push('BRANCH_TOPOLOGY_INCOMPATIBLE');
  if ((source?.componentKind === 'RIGID') !== (target?.componentKind === 'RIGID')) blockers.push('RIGID_COMPONENT_KIND_INCOMPATIBLE');
  return blockers;
}
function relativeEvidence(sourceValue, targetValue, tolerance, label) {
  const source = number(sourceValue); const target = number(targetValue);
  if (!(source > 0) || !(target > 0)) return deepFreeze({ available: false, pass: false, relativeDelta: null, tolerance, source, target, reason: `${label}_UNAVAILABLE` });
  const relativeDelta = Math.abs(target - source) / Math.abs(source);
  return deepFreeze({ available: true, pass: relativeDelta <= tolerance, relativeDelta, tolerance, source, target });
}

export function evaluateCiiSpatialMethod(source, target, options = {}) {
  const toleranceMm = number(options.spatialToleranceMm ?? options.coordinateToleranceMm ?? CII_MATCH_DEFAULTS.spatialToleranceMm);
  const spatial = endpointSpatialEvidence(source, target, options.geometryTransform);
  if (!spatial) {
    const registration = options.geometryTransform || null;
    const registrationBlocked = Boolean(registration && registration.status !== 'READY');
    return deepFreeze({
      method: 'M1_SPATIAL', available: false, pass: false, score: 0, distanceMm: null, endpointDistancesMm: Object.freeze([]),
      toleranceMm, basis: registrationBlocked ? 'REGISTRATION_UNDERDETERMINED' : 'UNAVAILABLE', orientation: null,
      registrationStatus: registration?.status || null, registrationReason: registration?.reason || null,
      reasons: Object.freeze([registrationBlocked ? 'SPATIAL_REGISTRATION_NOT_READY' : 'SPATIAL_COORDINATES_UNAVAILABLE']),
    });
  }
  const pass = spatial.distanceMm <= toleranceMm;
  return deepFreeze({
    method: 'M1_SPATIAL', available: true, pass,
    score: Number((100 * closeness(spatial.distanceMm, 0, toleranceMm)).toFixed(1)),
    distanceMm: spatial.distanceMm, endpointDistancesMm: Object.freeze(spatial.endpointDistancesMm.map((value) => Number(value.toFixed(6)))),
    toleranceMm, basis: options.geometryTransform?.status === 'READY' ? 'REGISTERED' : 'RAW_GLOBAL', orientation: spatial.orientation,
    reasons: Object.freeze(pass ? [] : ['SPATIAL_TOLERANCE_EXCEEDED']),
  });
}

export function evaluateCiiNetworkMethod(source, target, options = {}) {
  const blockers = networkBlockers(source, target, options); const sDegrees = endpointDegrees(source); const tDegrees = endpointDegrees(target);
  const sourceStation = stationFraction(source); const targetStation = stationFraction(target);
  const components = {
    topology: 20 * Number(sDegrees[0] === tDegrees[0] && sDegrees[1] === tDegrees[1]),
    neighbourhood: 25 * neighbourhoodSimilarity(source, target),
    pathSequence: 20 * sequenceSimilarity(source, target),
    componentKind: 15 * Number(source?.componentKind === target?.componentKind),
    pathStation: sourceStation != null && targetStation != null ? 10 * closeness(sourceStation, targetStation, 0.12) : 0,
    localLength: 10 * closeness(source?.lengthMm, target?.lengthMm, options.networkLocalLengthToleranceMm || 250),
  };
  const score = blockers.length ? 0 : Object.values(components).reduce((sum, value) => sum + value, 0);
  const threshold = number(options.networkPassingScore ?? CII_MATCH_DEFAULTS.networkPassingScore);
  return deepFreeze({ method: 'M2_NETWORK', available: true, pass: !blockers.length && score >= threshold,
    score: Number(score.toFixed(1)), threshold,
    components: Object.freeze(Object.fromEntries(Object.entries(components).map(([key, value]) => [key, Number(value.toFixed(1))]))),
    blockers: Object.freeze(blockers), reasons: Object.freeze(blockers.length ? blockers : (score >= threshold ? [] : ['NETWORK_SCORE_BELOW_THRESHOLD'])) });
}

export function evaluateCiiDimensionEvidence(source, target, options = {}) {
  return deepFreeze({
    diameter: relativeEvidence(source?.diameter, target?.diameter, number(options.diameterRelativeTolerance ?? CII_MATCH_DEFAULTS.diameterRelativeTolerance), 'OD'),
    wall: relativeEvidence(source?.wall, target?.wall, number(options.wallRelativeTolerance ?? CII_MATCH_DEFAULTS.wallRelativeTolerance), 'WALL'),
  });
}

export function normalizedCiiMethodScore(method, dimensions, options = {}) {
  const identityWeight = number(options.identityWeight ?? CII_MATCH_DEFAULTS.identityWeight);
  const diameterWeight = number(options.diameterWeight ?? CII_MATCH_DEFAULTS.diameterWeight);
  const total = identityWeight + diameterWeight;
  const od = ciiOdConfidenceBand(dimensions?.diameter);
  const odFactor = od.confidence === 'HIGH' ? 1 : (od.confidence === 'MEDIUM' ? 0.5 : 0);
  const earned = identityWeight * Number(Boolean(method?.pass)) + diameterWeight * odFactor;
  return total > 0 ? Number((100 * earned / total).toFixed(1)) : 0;
}

function networkStrong(m2, options) {
  const threshold = number(options.networkStrongScore ?? CII_MATCH_DEFAULTS.networkStrongScore);
  return Boolean(m2?.pass && Number(m2.score || 0) >= threshold);
}
function identityConfidence(m1, m2, od, nodeName, options) {
  const identitySupported = Boolean(m1?.pass || m2?.pass);
  if (!identitySupported) return 'UNRESOLVED';
  if (od.confidence === 'REVIEW') return 'REVIEW';
  if (m1?.pass && m2?.pass) return od.confidence === 'HIGH' ? 'HIGH' : 'MEDIUM';
  if (m1?.available === false && m2?.pass) {
    if (od.confidence === 'HIGH' && (networkStrong(m2, options) || nodeName?.match)) return 'HIGH';
    return 'MEDIUM';
  }
  if (m1?.available !== false && !m1?.pass && m2?.pass) return 'MEDIUM';
  if (m1?.pass && !m2?.pass) return od.confidence === 'HIGH' && nodeName?.match ? 'MEDIUM' : 'REVIEW';
  return 'REVIEW';
}

function identityReasons(m1, m2, od, nodeName, confidence, options) {
  const rows = [];
  if (!(m1?.pass || m2?.pass)) rows.push('IDENTITY_METHOD_NOT_SUPPORTED');
  if (m1?.available === false) rows.push('M1_UNAVAILABLE');
  else rows.push(m1?.pass ? 'M1_PASS' : 'M1_FAIL');
  rows.push(m2?.pass ? 'M2_PASS' : 'M2_FAIL');
  rows.push(od.reason);
  if (nodeName?.available !== false) rows.push(nodeName?.match ? `NODE_NAME_${nodeName.kind}_MATCH` : 'NODE_NAME_NO_MATCH');
  if (m1?.available === false && m2?.pass) rows.push('M1_UNAVAILABLE_M2_SUPPORTED');
  if (m1?.available !== false && !m1?.pass && m2?.pass) rows.push('M1_FAIL_M2_PASS_GEOMETRY_CHANGED');
  if (confidence === 'HIGH' && m1?.available === false) rows.push(networkStrong(m2, options)
    ? 'HIGH_BY_STRONG_M2_AND_OD' : 'HIGH_BY_M2_OD_NODE_NAME_CORROBORATION');
  return rows;
}

export function fuseCiiIdentityEvidence(m1, m2, dimensions, nodeNameOrOptions = null, maybeOptions = {}) {
  const isNameEvidence = nodeNameOrOptions && (Object.hasOwn(nodeNameOrOptions, 'kind') || Object.hasOwn(nodeNameOrOptions, 'matchRatio'));
  const nodeName = isNameEvidence ? nodeNameOrOptions : null; const options = isNameEvidence ? maybeOptions : (nodeNameOrOptions || {});
  const m1Score = normalizedCiiMethodScore(m1, dimensions, options); const m2Score = normalizedCiiMethodScore(m2, dimensions, options);
  const odConfidence = ciiOdConfidenceBand(dimensions?.diameter); const confidence = identityConfidence(m1, m2, odConfidence, nodeName, options);
  const identitySupported = Boolean(m1?.pass || m2?.pass); const corroborationBand = ciiCorroborationBand({ m1, m2, od: odConfidence, nodeName });
  return deepFreeze({
    confidence, identitySupported, odConfidence, nodeNameEvidence: nodeName, corroborationBand,
    weightedScores: Object.freeze({ m1: m1Score, m2: m2Score }), score: identitySupported ? Math.max(m1Score, m2Score) : 0,
    reasons: Object.freeze(identityReasons(m1, m2, odConfidence, nodeName, confidence, options)),
  });
}

export function evaluateCiiMatchMethods(source, target, options = {}) {
  const m1Spatial = evaluateCiiSpatialMethod(source, target, options); const m2Network = evaluateCiiNetworkMethod(source, target, options);
  const dimensions = evaluateCiiDimensionEvidence(source, target, options); const nodeName = compareCiiElementNodeNames(source, target);
  const identity = fuseCiiIdentityEvidence(m1Spatial, m2Network, dimensions, nodeName, options);
  return deepFreeze({ m1Spatial, m2Network, dimensions, nodeName, identity });
}