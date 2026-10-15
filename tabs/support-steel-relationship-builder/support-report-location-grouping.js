import { stripLeadingSlash } from '../ps-family-clash-audit/ps-family-token-utils.js';
import { deriveSupportReportNominalSizeMm } from './support-report-field-normalization.js?v=20260910-support-report-field-provenance-14';

export const SUPPORT_REPORT_LOCATION_MERGE_TOLERANCE_MM = 50;
export const SUPPORT_REPORT_MULTIPLE_PRIMARY_SUPPORT_REMARK = 'Multiple primary support';
export const SUPPORT_REPORT_MULTI_LOCATION_REMARK = SUPPORT_REPORT_MULTIPLE_PRIMARY_SUPPORT_REMARK;
export const SUPPORT_REPORT_AXIAL_BORE_FACTOR = 4;
export const SUPPORT_REPORT_LATERAL_BORE_FACTOR = 0.5;
export const SUPPORT_REPORT_LATERAL_ALLOWANCE_MM = 25;
export const SUPPORT_REPORT_AXIS_CONFIDENCE_MIN = 8;

const CONCRETE_SUPPORT_MEMBER_RE = /^\/(?:PS|SL)-\d+[A-Z]?\.\d+$/iu;
const SYMBOLIC_SUPPORT_REFERENCE_RE = /(?:^|\/)(?:DATUM|STRUCTURAL_REFERENCE)(?:$|\/)/iu;
const EPSILON = 1e-9;

export function groupSupportReportEvidenceByLocation(rows = [], options = {}) {
  const toleranceMm = locationTolerance(options);
  const geometryIndex = buildTraversalGeometryIndex(rows);
  const baseGroups = groupByFamilyAndLine(rows);
  const located = [];
  for (const base of baseGroups.values()) {
    const clusters = clusterRows(base.rows, toleranceMm, geometryIndex);
    clusters.forEach((cluster, index) => located.push(
      buildLocationGroup(base, cluster, index, clusters.length, toleranceMm, geometryIndex),
    ));
  }
  return applyFamilyCounts(located);
}

export function clusterSupportReportRowsByLocation(rows = [], toleranceMm = SUPPORT_REPORT_LOCATION_MERGE_TOLERANCE_MM) {
  const indexed = (rows || []).map((row, rowIndex) => ({ row, rowIndex }));
  return clusterRows(
    indexed,
    nonNegative(toleranceMm, SUPPORT_REPORT_LOCATION_MERGE_TOLERANCE_MM),
    buildTraversalGeometryIndex(rows),
  );
}

function groupByFamilyAndLine(rows) {
  const groups = new Map();
  for (const [rowIndex, row] of (rows || []).entries()) {
    if (!row?.secondarySupportFamilyId || !row?.fullLineTag) continue;
    const key = `${token(row.secondarySupportFamilyId)}::${token(row.fullLineTag)}`;
    if (!groups.has(key)) groups.set(key, {
      key,
      secondarySupportFamilyId: row.secondarySupportFamilyId,
      fullLineTag: row.fullLineTag,
      scope: row.scope,
      rows: [],
    });
    groups.get(key).rows.push({ row, rowIndex });
  }
  return groups;
}

function clusterRows(indexedRows, toleranceMm, geometryIndex = new Map()) {
  if (!indexedRows.length) return [];
  const withPoint = indexedRows.filter(({ row }) => validPoint(row.clashPointGlobalMm));
  if (!withPoint.length) return [indexedRows];
  const components = connectedComponents(withPoint, toleranceMm, geometryIndex);
  const clusters = components.map((component) => component.map((index) => withPoint[index]));
  attachPointlessRows(clusters, indexedRows.filter(({ row }) => !validPoint(row.clashPointGlobalMm)));
  return clusters.sort((left, right) => minimumIndex(left) - minimumIndex(right));
}

function connectedComponents(rows, toleranceMm, geometryIndex) {
  const visited = new Set();
  const components = [];
  for (let start = 0; start < rows.length; start += 1) {
    if (visited.has(start)) continue;
    const queue = [start];
    const component = [];
    visited.add(start);
    while (queue.length) {
      const current = queue.shift();
      component.push(current);
      for (let next = 0; next < rows.length; next += 1) {
        if (visited.has(next)
          || !locationAdjacencyBasis(rows[current].row, rows[next].row, toleranceMm, geometryIndex)) continue;
        visited.add(next);
        queue.push(next);
      }
    }
    components.push(component);
  }
  return components;
}

function attachPointlessRows(clusters, rows) {
  if (!rows.length) return;
  if (!clusters.length) { clusters.push([...rows]); return; }
  for (const entry of rows) {
    const matched = clusters.find((cluster) => cluster.some(({ row }) => sameContext(row, entry.row)));
    (matched || clusters[0]).push(entry);
  }
}

function buildLocationGroup(base, cluster, locationIndex, locationCount, toleranceMm, geometryIndex) {
  const rows = cluster.sort((left, right) => left.rowIndex - right.rowIndex).map((entry) => entry.row);
  const points = rows.map((row) => row.clashPointGlobalMm).filter(validPoint);
  const primaryPaths = uniquePaths(rows.map((row) => row.primaryPath));
  const secondaryPaths = uniquePaths(rows.map((row) => row.secondaryPath));
  const members = unique(rows.map((row) => normalizeMemberId(row.primarySupportMemberId))).sort(memberCompare);
  const branchNodes = unique(rows.map((row) => row.branchNode)).sort();
  const nominalBoreMm = derivedNominalBoreMm(base.fullLineTag);
  const axisModel = rows.length ? geometryIndex.get(traversalKey(rows[0])) || null : null;
  return Object.freeze({
    groupId: locationCount > 1 ? `${base.key}::LOC-${locationIndex + 1}` : base.key,
    secondarySupportFamilyId: base.secondarySupportFamilyId,
    fullLineTag: base.fullLineTag,
    scope: base.scope,
    branchNodes,
    primarySupportMemberIds: members,
    clashPointsGlobalMm: points,
    representativeClashPointGlobalMm: averagePoint(points),
    primaryPaths,
    secondaryPaths,
    evidenceRows: rows,
    clashCount: rows.length,
    locationIndex,
    locationCountOnPipe: locationCount,
    locationMergeToleranceMm: toleranceMm,
    locationGroupingModel: 'BRANCH_BORE_AXIS_V1',
    locationNominalBoreMm: nominalBoreMm,
    locationBoreBasis: nominalBoreMm ? 'LINE_TAG_DERIVED_DN' : 'UNAVAILABLE',
    locationAxialToleranceMm: nominalBoreMm ? nominalBoreMm * SUPPORT_REPORT_AXIAL_BORE_FACTOR : null,
    locationLateralToleranceMm: nominalBoreMm
      ? nominalBoreMm * SUPPORT_REPORT_LATERAL_BORE_FACTOR + SUPPORT_REPORT_LATERAL_ALLOWANCE_MM
      : null,
    locationAxisBasis: axisModel?.basis || 'UNAVAILABLE',
    locationAxisConfidenceRatio: Number.isFinite(axisModel?.confidenceRatio) ? axisModel.confidenceRatio : null,
    locationGroupingBasis: Object.freeze(clusterGroupingBasis(rows, toleranceMm, geometryIndex)),
    multipleLocationsOnPipe: locationCount > 1,
    totalSupportPointsOnSecondary: 0,
  });
}

function applyFamilyCounts(groups) {
  const counts = new Map();
  groups.forEach((group) => counts.set(token(group.secondarySupportFamilyId), (counts.get(token(group.secondarySupportFamilyId)) || 0) + 1));
  return groups.map((group) => Object.freeze({
    ...group,
    totalSupportPointsOnSecondary: counts.get(token(group.secondarySupportFamilyId)) || 0,
  }));
}

function locationAdjacencyBasis(left, right, toleranceMm, geometryIndex = new Map()) {
  // Concrete member identity is stronger than traversal spelling. This preserves the
  // #1205 physical-location contract while traversal guards continue to protect
  // geometry-only merging between different support members.
  if (sameConcreteMember(left, right)) return 'SAME_CONCRETE_MEMBER';
  if (!sameTraversal(left, right)) return '';

  if (withinTolerance(left, right, toleranceMm)) {
    return toleranceMm === SUPPORT_REPORT_LOCATION_MERGE_TOLERANCE_MM
      ? 'WITHIN_50MM'
      : 'WITHIN_LOCATION_TOLERANCE';
  }

  const boreMm = compatibleDerivedNominalBoreMm(left, right);
  const axisModel = geometryIndex.get(traversalKey(left));
  const nonSymbolicFallback = [left, right].some((row) =>
    !isConcreteSupportMemberId(row?.primarySupportMemberId) && !isSymbolicSupportReference(row));
  if (boreMm
    && axisModel?.trusted
    && !nonSymbolicFallback
    && withinBoreAxisWindow(left, right, axisModel.axis, boreMm)) {
    return 'WITHIN_BORE_AXIS_WINDOW';
  }
  return '';
}

function clusterGroupingBasis(rows, toleranceMm, geometryIndex = new Map()) {
  if (rows.length <= 1) return ['SINGLE_EVIDENCE_POINT'];
  const bases = [];
  for (let left = 0; left < rows.length; left += 1) {
    for (let right = left + 1; right < rows.length; right += 1) {
      const basis = locationAdjacencyBasis(rows[left], rows[right], toleranceMm, geometryIndex);
      if (basis) bases.push(basis);
    }
  }
  return unique(bases).length ? unique(bases) : ['TRANSITIVE_CLUSTER'];
}

function withinTolerance(left, right, toleranceMm) {
  const a = left.clashPointGlobalMm;
  const b = right.clashPointGlobalMm;
  if (!validPoint(a) || !validPoint(b)) return false;
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) <= toleranceMm;
}

function withinBoreAxisWindow(left, right, axis, boreMm) {
  const a = left?.clashPointGlobalMm;
  const b = right?.clashPointGlobalMm;
  if (!validPoint(a) || !validPoint(b) || !validAxis(axis) || !Number.isFinite(boreMm) || boreMm <= 0) return false;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const signedAxial = dx * axis.x + dy * axis.y + dz * axis.z;
  const axialMm = Math.abs(signedAxial);
  const distanceSquared = dx * dx + dy * dy + dz * dz;
  const lateralMm = Math.sqrt(Math.max(0, distanceSquared - signedAxial * signedAxial));
  return axialMm <= boreMm * SUPPORT_REPORT_AXIAL_BORE_FACTOR
    && lateralMm <= boreMm * SUPPORT_REPORT_LATERAL_BORE_FACTOR + SUPPORT_REPORT_LATERAL_ALLOWANCE_MM;
}

function buildTraversalGeometryIndex(rows = []) {
  const buckets = new Map();
  for (const row of rows || []) {
    if (!validPoint(row?.clashPointGlobalMm)) continue;
    const key = traversalKey(row);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(row.clashPointGlobalMm);
  }
  const output = new Map();
  for (const [key, points] of buckets) output.set(key, principalAxisModel(points));
  return output;
}

function principalAxisModel(points = []) {
  const uniquePoints = deduplicatePoints(points);
  if (uniquePoints.length < 2) return Object.freeze({
    axis: null, trusted: false, confidenceRatio: 0, pointCount: uniquePoints.length, basis: 'INSUFFICIENT_POINTS',
  });
  if (uniquePoints.length === 2) {
    const axis = normalizeVector({
      x: uniquePoints[1].x - uniquePoints[0].x,
      y: uniquePoints[1].y - uniquePoints[0].y,
      z: uniquePoints[1].z - uniquePoints[0].z,
    });
    return Object.freeze({
      axis,
      trusted: Boolean(axis),
      confidenceRatio: axis ? Number.POSITIVE_INFINITY : 0,
      pointCount: 2,
      basis: axis ? 'TWO_POINT_AXIS' : 'DEGENERATE_POINTS',
    });
  }

  const center = averagePoint(uniquePoints);
  const covariance = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const point of uniquePoints) {
    const d = [point.x - center.x, point.y - center.y, point.z - center.z];
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 3; column += 1) covariance[row][column] += d[row] * d[column];
    }
  }

  const diagonal = [covariance[0][0], covariance[1][1], covariance[2][2]];
  const initialIndex = diagonal.indexOf(Math.max(...diagonal));
  let vector = [0, 0, 0];
  vector[initialIndex] = 1;
  for (let iteration = 0; iteration < 24; iteration += 1) {
    const next = multiplyMatrixVector(covariance, vector);
    const magnitude = Math.hypot(...next);
    if (magnitude <= EPSILON) break;
    vector = next.map((value) => value / magnitude);
  }

  const projected = multiplyMatrixVector(covariance, vector);
  const lambda1 = Math.max(0, vector[0] * projected[0] + vector[1] * projected[1] + vector[2] * projected[2]);
  const trace = covariance[0][0] + covariance[1][1] + covariance[2][2];
  const residual = Math.max(0, trace - lambda1);
  const confidenceRatio = lambda1 <= EPSILON ? 0 : residual <= EPSILON ? Number.POSITIVE_INFINITY : lambda1 / residual;
  const axis = normalizeVector({ x: vector[0], y: vector[1], z: vector[2] });
  return Object.freeze({
    axis,
    trusted: Boolean(axis) && confidenceRatio >= SUPPORT_REPORT_AXIS_CONFIDENCE_MIN,
    confidenceRatio,
    pointCount: uniquePoints.length,
    basis: 'PCA_BRANCH_AXIS',
  });
}

function multiplyMatrixVector(matrix, vector) {
  return [
    matrix[0][0] * vector[0] + matrix[0][1] * vector[1] + matrix[0][2] * vector[2],
    matrix[1][0] * vector[0] + matrix[1][1] * vector[1] + matrix[1][2] * vector[2],
    matrix[2][0] * vector[0] + matrix[2][1] * vector[1] + matrix[2][2] * vector[2],
  ];
}

function normalizeVector(vector) {
  const magnitude = Math.hypot(vector?.x || 0, vector?.y || 0, vector?.z || 0);
  if (magnitude <= EPSILON) return null;
  return { x: vector.x / magnitude, y: vector.y / magnitude, z: vector.z / magnitude };
}

function validAxis(axis) {
  return Boolean(axis && [axis.x, axis.y, axis.z].every(Number.isFinite)
    && Math.hypot(axis.x, axis.y, axis.z) > EPSILON);
}

function deduplicatePoints(points = []) {
  const seen = new Set();
  return (points || []).filter((point) => {
    if (!validPoint(point)) return false;
    const key = `${point.x}\u0000${point.y}\u0000${point.z}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sameConcreteMember(left, right) {
  const leftId = normalizeMemberId(left?.primarySupportMemberId);
  const rightId = normalizeMemberId(right?.primarySupportMemberId);
  return isConcreteSupportMemberId(leftId)
    && isConcreteSupportMemberId(rightId)
    && token(leftId) === token(rightId);
}

function isSymbolicSupportReference(row) {
  const candidates = [row?.primaryItemName, ...(row?.primaryPath || [])]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  return candidates.some((value) => SYMBOLIC_SUPPORT_REFERENCE_RE.test(value.replace(/\\/gu, '/')));
}

function sameTraversal(left, right) {
  const leftBranch = token(left?.branchNode);
  const rightBranch = token(right?.branchNode);
  if (leftBranch && rightBranch) return leftBranch === rightBranch;
  return token(left?.fullLineTag) === token(right?.fullLineTag);
}

function sameContext(left, right) {
  if (!sameTraversal(left, right)) return false;
  if (sameConcreteMember(left, right)) return true;
  return token(left.branchNode) === token(right.branchNode);
}

function traversalKey(row) {
  return `${token(row?.fullLineTag)}::${token(row?.branchNode) || 'UNRESOLVED_BRANCH'}`;
}

function compatibleDerivedNominalBoreMm(left, right) {
  const leftBore = derivedNominalBoreMm(left?.fullLineTag);
  const rightBore = derivedNominalBoreMm(right?.fullLineTag);
  if (!leftBore || !rightBore || Math.abs(leftBore - rightBore) > EPSILON) return null;
  return leftBore;
}

function derivedNominalBoreMm(fullLineTag) {
  const nominalSizeMm = Number(deriveSupportReportNominalSizeMm(fullLineTag));
  return Number.isFinite(nominalSizeMm) && nominalSizeMm > 0 ? nominalSizeMm : null;
}

function locationTolerance(options) {
  return nonNegative(options.locationMergeToleranceMm, SUPPORT_REPORT_LOCATION_MERGE_TOLERANCE_MM);
}
function nonNegative(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}
function validPoint(point) {
  return Boolean(point && [point.x, point.y, point.z].every(Number.isFinite));
}
function averagePoint(points) {
  if (!points.length) return null;
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
    z: points.reduce((sum, point) => sum + point.z, 0) / points.length,
  };
}
function uniquePaths(paths) {
  const seen = new Set();
  return (paths || []).filter((path) => {
    const signature = (path || []).join('\u0000');
    if (!signature || seen.has(signature)) return false;
    seen.add(signature);
    return true;
  }).map((path) => [...path]);
}
function normalizeMemberId(value) {
  const cleanValue = stripLeadingSlash(value).toUpperCase();
  return cleanValue ? `/${cleanValue}` : '';
}
function isConcreteSupportMemberId(value) { return CONCRETE_SUPPORT_MEMBER_RE.test(normalizeMemberId(value)); }
function memberCompare(left, right) {
  const a = Number(String(left || '').match(/\.(\d+)$/)?.[1]);
  const b = Number(String(right || '').match(/\.(\d+)$/)?.[1]);
  if (Number.isFinite(a) && Number.isFinite(b) && a !== b) return a - b;
  return String(left || '').localeCompare(String(right || ''));
}
function minimumIndex(cluster) { return Math.min(...cluster.map((entry) => entry.rowIndex)); }
function token(value) { return stripLeadingSlash(value).replace(/\(REF\)$/iu, '').toUpperCase(); }
function unique(values) { return [...new Set((values || []).filter(Boolean))]; }

export {
  buildTraversalGeometryIndex as buildSupportReportTraversalGeometryIndex,
  principalAxisModel as buildSupportReportPrincipalAxisModel,
  derivedNominalBoreMm as deriveSupportReportLocationNominalBoreMm,
};

export const _test = Object.freeze({
  locationAdjacencyBasis,
  sameConcreteMember,
  sameTraversal,
  isSymbolicSupportReference,
  clusterGroupingBasis,
  withinBoreAxisWindow,
  buildTraversalGeometryIndex,
  principalAxisModel,
  derivedNominalBoreMm,
});