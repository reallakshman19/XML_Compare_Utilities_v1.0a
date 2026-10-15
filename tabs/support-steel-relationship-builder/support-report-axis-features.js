import {
  buildSupportReportTraversalGeometryIndex,
  deriveSupportReportLocationNominalBoreMm,
} from './support-report-location-grouping.js?v=20260915-support-primary-hardening-1';
import { normalizePipeClass } from './support-report-typicality.js?v=20260911-support-report-typicality-member-count-1';

const EPSILON = 1e-9;

export function extractAxisTypicalityFamilyFeatures(evidence = {}) {
  const familyIds = unique((evidence?.groups || [])
    .map((group) => token(group?.secondarySupportFamilyId))
    .filter(Boolean)).sort();
  return Object.freeze(familyIds.map((familyId) => axisFamilyFeatures(evidence, familyId)));
}

export function axisFamilyFeatures(evidence, familyId) {
  const groups = (evidence?.groups || []).filter((group) => token(group?.secondarySupportFamilyId) === familyId);
  const rows = uniqueRows(groups.flatMap((group) => group?.evidenceRows || []));
  const geometryIndex = buildSupportReportTraversalGeometryIndex(rows);
  const traversalMap = new Map();
  let ambiguousGroupTraversalCount = 0;

  for (const group of groups) {
    const traversal = groupTraversal(group);
    if (!traversal) {
      ambiguousGroupTraversalCount += 1;
      continue;
    }
    if (!traversalMap.has(traversal.key)) traversalMap.set(traversal.key, {
      key: traversal.key,
      fullLineTag: traversal.fullLineTag,
      branchNode: traversal.branchNode,
      groups: [],
    });
    traversalMap.get(traversal.key).groups.push(group);
  }

  const traversals = [...traversalMap.values()].sort((left, right) => left.key.localeCompare(right.key));
  const internalAxes = [];
  const locationsPerTraversalSpectrum = [];
  const dnNormalizedPairSpectrum = [];
  const returnClassCounts = new Map();
  let unavailableTraversalCount = 0;
  let missingBorePairOpportunityCount = 0;

  for (const traversal of traversals) {
    const model = geometryIndex.get(traversal.key) || null;
    const trusted = Boolean(model?.trusted && validAxis(model.axis));
    locationsPerTraversalSpectrum.push(traversal.groups.length);
    const pipeClass = normalizePipeClass(traversal.fullLineTag);
    if (pipeClass) returnClassCounts.set(pipeClass, (returnClassCounts.get(pipeClass) || 0) + 1);
    if (!trusted) {
      unavailableTraversalCount += 1;
      continue;
    }
    internalAxes.push({
      key: traversal.key,
      axis: model.axis,
      basis: model.basis,
      confidenceRatio: finiteOrNull(model.confidenceRatio),
      pointCount: Number(model.pointCount || 0),
    });
    const boreMm = traversalBoreMm(traversal.groups, traversal.fullLineTag);
    const pointGroups = traversal.groups.filter((group) => validPoint(group?.representativeClashPointGlobalMm));
    if (pointGroups.length >= 2 && !positive(boreMm)) missingBorePairOpportunityCount += pairCount(pointGroups.length);
    if (!positive(boreMm)) continue;
    for (let left = 0; left < pointGroups.length; left += 1) {
      for (let right = left + 1; right < pointGroups.length; right += 1) {
        const descriptor = normalizedPairDescriptor(
          pointGroups[left].representativeClashPointGlobalMm,
          pointGroups[right].representativeClashPointGlobalMm,
          model.axis,
          boreMm,
        );
        if (descriptor) dnNormalizedPairSpectrum.push(descriptor);
      }
    }
  }

  const relativeAxisAngleSpectrumDeg = [];
  for (let left = 0; left < internalAxes.length; left += 1) {
    for (let right = left + 1; right < internalAxes.length; right += 1) {
      relativeAxisAngleSpectrumDeg.push(unsignedAxisAngleDeg(internalAxes[left].axis, internalAxes[right].axis));
    }
  }

  dnNormalizedPairSpectrum.sort(pairDescriptorCompare);
  relativeAxisAngleSpectrumDeg.sort((a, b) => a - b);
  locationsPerTraversalSpectrum.sort((a, b) => a - b);
  const returnMultiplicitySpectrum = [...returnClassCounts.values()].sort((a, b) => a - b);
  const informedGeometryCount = dnNormalizedPairSpectrum.length + relativeAxisAngleSpectrumDeg.length;
  const authorityStatus = !internalAxes.length || !informedGeometryCount
    ? 'UNAVAILABLE'
    : ambiguousGroupTraversalCount > 0 || unavailableTraversalCount > 0 || missingBorePairOpportunityCount > 0
      ? 'PARTIAL'
      : 'COMPLETE';

  return Object.freeze({
    familyId,
    authorityStatus,
    sourceLocationCount: groups.length,
    sourceTraversalCount: traversals.length,
    trustedTraversalCount: internalAxes.length,
    unavailableTraversalCount,
    ambiguousGroupTraversalCount,
    missingBorePairOpportunityCount,
    locationsPerTraversalSpectrum: Object.freeze(locationsPerTraversalSpectrum),
    returnMultiplicitySpectrum: Object.freeze(returnMultiplicitySpectrum),
    dnNormalizedPairSpectrum: Object.freeze(dnNormalizedPairSpectrum.map((item) => Object.freeze(item))),
    relativeAxisAngleSpectrumDeg: Object.freeze(relativeAxisAngleSpectrumDeg.map(rounded)),
    normalizedPairCount: dnNormalizedPairSpectrum.length,
    relativeAxisAngleCount: relativeAxisAngleSpectrumDeg.length,
    traversalAxisEvidence: Object.freeze(internalAxes.map((item) => Object.freeze({
      axisBasis: item.basis,
      axisConfidenceRatio: item.confidenceRatio,
      axisPointCount: item.pointCount,
    }))),
  });
}

export function normalizedPairDescriptor(left, right, axis, boreMm) {
  if (!validPoint(left) || !validPoint(right) || !validAxis(axis) || !positive(boreMm)) return null;
  const dx = right.x - left.x;
  const dy = right.y - left.y;
  const dz = right.z - left.z;
  const signedAxial = dx * axis.x + dy * axis.y + dz * axis.z;
  const axialMm = Math.abs(signedAxial);
  const distanceSquared = dx * dx + dy * dy + dz * dz;
  const lateralMm = Math.sqrt(Math.max(0, distanceSquared - signedAxial * signedAxial));
  return {
    axialRatio: rounded(axialMm / boreMm),
    lateralRatio: rounded(lateralMm / boreMm),
  };
}

export function unsignedAxisAngleDeg(left, right) {
  if (!validAxis(left) || !validAxis(right)) return null;
  const dot = Math.abs(left.x * right.x + left.y * right.y + left.z * right.z);
  const clamped = Math.max(-1, Math.min(1, dot));
  return rounded(Math.acos(clamped) * 180 / Math.PI);
}

export function groupTraversal(group) {
  const fullLineTag = clean(group?.fullLineTag);
  if (!fullLineTag) return null;
  const branches = unique([
    ...(group?.branchNodes || []),
    ...(group?.evidenceRows || []).map((row) => row?.branchNode),
  ]).map(token).filter(Boolean);
  if (branches.length > 1) return null;
  const branchNode = branches[0] || '';
  return Object.freeze({
    fullLineTag,
    branchNode,
    key: traversalKey(fullLineTag, branchNode),
  });
}

function traversalBoreMm(groups, fullLineTag) {
  const direct = unique((groups || []).map((group) => Number(group?.locationNominalBoreMm)).filter(positive));
  if (direct.length === 1) return direct[0];
  const derived = Number(deriveSupportReportLocationNominalBoreMm(fullLineTag));
  return positive(derived) ? derived : null;
}

function pairDescriptorCompare(left, right) {
  return left.axialRatio - right.axialRatio || left.lateralRatio - right.lateralRatio;
}
function pairCount(value) { return value > 1 ? (value * (value - 1)) / 2 : 0; }
function traversalKey(fullLineTag, branchNode) { return `${token(fullLineTag)}::${token(branchNode) || 'UNRESOLVED_BRANCH'}`; }
function uniqueRows(rows) {
  const output = [];
  const seen = new Set();
  for (const row of rows || []) {
    if (!row || seen.has(row)) continue;
    seen.add(row);
    output.push(row);
  }
  return output;
}
function validPoint(point) { return Boolean(point && [point.x, point.y, point.z].every(Number.isFinite)); }
function validAxis(axis) { return Boolean(axis && [axis.x, axis.y, axis.z].every(Number.isFinite) && Math.hypot(axis.x, axis.y, axis.z) > EPSILON); }
function finiteOrNull(value) { return Number.isFinite(value) ? rounded(value) : value === Number.POSITIVE_INFINITY ? 'INFINITY' : null; }
function positive(value) { return Number.isFinite(Number(value)) && Number(value) > 0; }
function rounded(value) { return Math.round(Number(value) * 1000) / 1000; }
function clean(value) { return value == null ? '' : String(value).trim(); }
function token(value) { return clean(value).replace(/^\/+/, '').replace(/\(REF\)$/iu, '').toUpperCase(); }
function unique(values) { return [...new Set((values || []).filter(Boolean))]; }
