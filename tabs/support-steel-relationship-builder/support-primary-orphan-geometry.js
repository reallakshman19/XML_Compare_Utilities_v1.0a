import {
  SUPPORT_REPORT_AXIAL_BORE_FACTOR,
  SUPPORT_REPORT_LATERAL_ALLOWANCE_MM,
  SUPPORT_REPORT_LATERAL_BORE_FACTOR,
  buildSupportReportPrincipalAxisModel,
  buildSupportReportTraversalGeometryIndex,
  deriveSupportReportLocationNominalBoreMm,
} from './support-report-location-grouping.js?v=20260915-support-primary-hardening-1';

const EPSILON = 1e-9;

export function buildOrphanRecoveryGeometryContext(rows = []) {
  return Object.freeze({
    traversalGeometry: buildSupportReportTraversalGeometryIndex(rows),
    pipeGeometry: buildPipeGeometryIndex(rows),
  });
}

export function evaluateOrphanRecoveryGeometry(sourceGroup, targetGroup, config, context, samePipe) {
  const branches = branchRelationship(sourceGroup, targetGroup);
  const pointA = sourceGroup?.representativeClashPointGlobalMm;
  const pointB = targetGroup?.representativeClashPointGlobalMm;
  const pointAvailable = validPoint(pointA) && validPoint(pointB);
  const sourceBoreMm = groupBoreMm(sourceGroup);
  const targetBoreMm = groupBoreMm(targetGroup);
  const boreForToleranceMm = recoveryBoreMm(sourceBoreMm, targetBoreMm, config);
  const axisModel = selectAxisModel(sourceGroup, targetGroup, context, branches, samePipe);
  const metrics = pointAvailable && positive(boreForToleranceMm) && axisModel?.trusted
    ? axisSeparation(pointA, pointB, axisModel.axis)
    : null;
  const baseAxialToleranceMm = positive(boreForToleranceMm)
    ? boreForToleranceMm * SUPPORT_REPORT_AXIAL_BORE_FACTOR : null;
  const baseLateralToleranceMm = positive(boreForToleranceMm)
    ? boreForToleranceMm * SUPPORT_REPORT_LATERAL_BORE_FACTOR + SUPPORT_REPORT_LATERAL_ALLOWANCE_MM : null;
  const recoveryAxialToleranceMm = Number.isFinite(baseAxialToleranceMm)
    ? baseAxialToleranceMm * config.axialMultiplier : null;
  const recoveryLateralToleranceMm = Number.isFinite(baseLateralToleranceMm)
    ? baseLateralToleranceMm * config.lateralMultiplier : null;
  const geometryPass = Boolean(metrics
    && metrics.axialMm <= recoveryAxialToleranceMm + EPSILON
    && metrics.lateralMm <= recoveryLateralToleranceMm + EPSILON);
  return Object.freeze({
    branches,
    pointAvailable,
    sourceBoreMm,
    targetBoreMm,
    boreForToleranceMm,
    axisModel,
    metrics,
    baseAxialToleranceMm,
    baseLateralToleranceMm,
    recoveryAxialToleranceMm,
    recoveryLateralToleranceMm,
    geometryPass,
  });
}

export function buildPipeGeometryIndex(rows = []) {
  const buckets = new Map();
  for (const row of rows || []) {
    if (!validPoint(row?.clashPointGlobalMm)) continue;
    const key = token(row?.fullLineTag);
    if (!key) continue;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(row.clashPointGlobalMm);
  }
  const output = new Map();
  for (const [key, points] of buckets) output.set(key, buildSupportReportPrincipalAxisModel(points));
  return output;
}

export function selectAxisModel(sourceGroup, targetGroup, context, branches, samePipe) {
  const sourcePipe = token(sourceGroup?.fullLineTag);
  if (samePipe && branches.different) return trustedPipeModel(context.pipeGeometry.get(sourcePipe));
  const traversalModel = trustedTraversalModel(sourceGroup, context.traversalGeometry);
  if (traversalModel?.trusted) return traversalModel;
  return trustedPipeModel(context.pipeGeometry.get(sourcePipe));
}

export function trustedPipeModel(model) {
  // A two-point pipe-wide model could be nothing more than the orphan/target pair.
  // Require a third independent point before pipe-level evidence can override traversal separation.
  return model?.trusted && Number(model?.pointCount || 0) >= 3 ? model : null;
}

function trustedTraversalModel(group, index) {
  const pipe = token(group?.fullLineTag);
  for (const branch of normalizedBranches(group)) {
    const model = index.get(`${pipe}::${branch || 'UNRESOLVED_BRANCH'}`);
    if (model?.trusted) return model;
  }
  const unresolved = index.get(`${pipe}::UNRESOLVED_BRANCH`);
  return unresolved?.trusted ? unresolved : null;
}

export function branchRelationship(left, right) {
  const leftBranches = normalizedBranches(left);
  const rightBranches = normalizedBranches(right);
  if (!leftBranches.length || !rightBranches.length) return Object.freeze({
    status: 'UNAVAILABLE', different: false,
  });
  const overlap = leftBranches.some((branch) => rightBranches.includes(branch));
  return Object.freeze({ status: overlap ? 'SAME_TRAVERSAL' : 'DIFFERENT_TRAVERSAL', different: !overlap });
}

function normalizedBranches(group) {
  return unique((group?.branchNodes || []).map(token).filter(Boolean)).sort();
}

function groupBoreMm(group) {
  const direct = Number(group?.locationNominalBoreMm);
  if (positive(direct)) return direct;
  const derived = Number(deriveSupportReportLocationNominalBoreMm(group?.fullLineTag));
  return positive(derived) ? derived : null;
}

export function recoveryBoreMm(sourceBoreMm, targetBoreMm, config) {
  if (config.requireSameBore) return positive(sourceBoreMm) && positive(targetBoreMm)
    && Math.abs(sourceBoreMm - targetBoreMm) <= EPSILON ? sourceBoreMm : null;
  const available = [sourceBoreMm, targetBoreMm].filter(positive);
  return available.length ? Math.min(...available) : null;
}

export function axisSeparation(a, b, axis) {
  if (!validPoint(a) || !validPoint(b) || !validAxis(axis)) return null;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const signedAxial = dx * axis.x + dy * axis.y + dz * axis.z;
  const axialMm = Math.abs(signedAxial);
  const distanceSquared = dx * dx + dy * dy + dz * dz;
  const lateralMm = Math.sqrt(Math.max(0, distanceSquared - signedAxial * signedAxial));
  return Object.freeze({ axialMm, lateralMm });
}

export function positive(value) { return Number.isFinite(Number(value)) && Number(value) > 0; }
function validPoint(point) { return Boolean(point && [point.x, point.y, point.z].every(Number.isFinite)); }
function validAxis(axis) {
  return Boolean(axis && [axis.x, axis.y, axis.z].every(Number.isFinite)
    && Math.hypot(axis.x, axis.y, axis.z) > EPSILON);
}
function token(value) { return clean(value).replace(/^\/+/, '').replace(/\(REF\)$/iu, '').toUpperCase(); }
function clean(value) { return value == null ? '' : String(value).trim(); }
function unique(values) { return [...new Set((values || []).filter(Boolean))]; }
