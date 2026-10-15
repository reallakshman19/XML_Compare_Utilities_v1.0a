import {
  buildAngleWindow,
  buildSegmentLengths,
  classifyAngleWindow,
  resolveRadiusForClassification,
} from './pipeline-3d-model-bend-classification.js?v=20260721-bend-policy-v3-1';

const DEG = 180 / Math.PI;
const NODE_START = 100;
const NODE_STEP = 10;

function sources(point) {
  return Array.isArray(point?.sources) ? point.sources : [point?.source].filter(Boolean);
}

function isGeometryAuthority(point) {
  const values = sources(point);
  return values.includes('vertex') || values.includes('table2');
}

function rowDistanceMm(a, b) {
  if (!a || !b) return 0;
  return Math.hypot(
    Number(b.x) - Number(a.x),
    Number(b.y) - Number(a.y),
    Number(b.z) - Number(a.z),
  );
}

function geometryNodeName(point, fallback) {
  const evidence = Array.isArray(point?.markerEvidence) ? point.markerEvidence : [];
  const labels = sources(point).map((source, index) => {
    const item = evidence[index] || {};
    if (source === 'vertex') return item.point?.label || '';
    if (source === 'table2') return item.label || item.point?.label || '';
    return '';
  }).filter(Boolean);
  return [...new Set(labels)].join(' / ') || fallback || '';
}

export function buildGeometryAuthorityRoute(points = [], coordinateRows = []) {
  const authority = points.map((point, sourceIndex) => ({
    point,
    sourceIndex,
    sourceRow: coordinateRows[sourceIndex] || null,
  })).filter((entry) => entry.sourceRow && isGeometryAuthority(entry.point));
  const entries = authority.map((entry, geometryIndex) => Object.freeze({
    point: entry.point,
    sourceIndex: entry.sourceIndex,
    row: Object.freeze({
      ...entry.sourceRow,
      nodeNumber: NODE_START + geometryIndex * NODE_STEP,
      nodeName: geometryNodeName(entry.point, entry.sourceRow.nodeName),
    }),
  }));
  return Object.freeze({
    entries: Object.freeze(entries),
    points: Object.freeze(entries.map((entry) => entry.point)),
    coordinateRows: Object.freeze(entries.map((entry) => entry.row)),
    excludedMarkerCount: Math.max(0, coordinateRows.length - entries.length),
  });
}

function markerGap(leftEntry, rightEntry, geometryGap) {
  const sourceGap = Math.max(0, rightEntry.sourceIndex - leftEntry.sourceIndex - 1);
  return Math.max(0, sourceGap - geometryGap);
}

function ignoredLength(lengths, indexes) {
  return indexes.reduce((total, index) => total + Number(lengths[index] || 0), 0);
}

function candidateLengths(entries, ownerIndex) {
  return {
    incomingLengthMm: rowDistanceMm(entries[ownerIndex - 1]?.row, entries[ownerIndex]?.row),
    outgoingLengthMm: rowDistanceMm(entries[ownerIndex]?.row, entries[ownerIndex + 1]?.row),
  };
}

function candidateFit(radiusMm, turnAngleDeg, lengths, settings) {
  const tangentMm = radiusMm && turnAngleDeg
    ? radiusMm * Math.tan((turnAngleDeg / DEG) / 2) : null;
  const requiredMm = tangentMm == null ? null : tangentMm + settings.retainedStraightAllowanceMm;
  const preferredMm = tangentMm == null ? null : tangentMm + settings.preferredStraightTangentMm;
  return {
    tangentMm,
    requiredMm,
    preferredMm,
    localGeometryFits: Boolean(
      tangentMm
      && lengths.incomingLengthMm >= requiredMm
      && lengths.outgoingLengthMm >= requiredMm
    ),
  };
}

function buildCandidate(entries, lengths, window, classification, screening) {
  const ownerIndex = classification.ownerIndexes[0] ?? window.interiorIndexes[0];
  const owner = entries[ownerIndex];
  const previous = entries[ownerIndex - 1];
  const next = entries[ownerIndex + 1];
  const radius = resolveRadiusForClassification(classification, screening);
  const spans = candidateLengths(entries, ownerIndex);
  const fit = candidateFit(radius.radiusMm, classification.turnAngleDeg, spans, screening.settings);
  return {
    id: `bend:${owner?.row.nodeNumber ?? ownerIndex}`,
    designBasis: screening.settings.designBasis,
    bendClass: classification.bendClass,
    classification: classification.classification,
    classificationReason: classification.classificationReason,
    sourceBasis: classification.sourceBasis,
    sourceRole: classification.sourceBasis,
    radiusBasis: radius.radiusBasis,
    radiusD: radius.radiusD,
    radiusMm: radius.radiusMm,
    policyReady: radius.policyReady,
    qualificationRequired: radius.qualificationRequired,
    ownershipResolved: classification.ownerIndexes.length === 1,
    pointIndex: owner?.sourceIndex,
    incomingElementIndex: ownerIndex - 1,
    outgoingElementIndex: ownerIndex,
    previousNode: previous?.row.nodeNumber ?? null,
    cornerNode: owner?.row.nodeNumber ?? null,
    nextNode: next?.row.nodeNumber ?? null,
    classificationPreviousNode: entries[window.leftSegment]?.row.nodeNumber ?? null,
    classificationNextNode: entries[window.rightSegment + 1]?.row.nodeNumber ?? null,
    previousAuthorityIndex: previous?.sourceIndex,
    nextAuthorityIndex: next?.sourceIndex,
    markerRowsExcludedBefore: markerGap(previous, owner, 0),
    markerRowsExcludedAfter: markerGap(owner, next, 0),
    ignoredSegmentIndexes: Object.freeze([...window.ignoredSegmentIndexes]),
    ignoredNodeNumbers: Object.freeze(window.interiorIndexes
      .filter((index) => index !== ownerIndex)
      .map((index) => entries[index].row.nodeNumber)),
    ignoredTotalLengthMm: ignoredLength(lengths, window.ignoredSegmentIndexes),
    planAngleDeg: classification.planAngleDeg,
    profileAngleDeg: classification.profileAngleDeg,
    turnAngleDeg: classification.turnAngleDeg,
    ...spans,
    tangentMm: fit.tangentMm,
    retainedStraightAllowanceMm: screening.settings.retainedStraightAllowanceMm,
    requiredIncomingMm: fit.requiredMm,
    requiredOutgoingMm: fit.requiredMm,
    preferredRequiredMm: fit.preferredMm,
    localGeometryFits: fit.localGeometryFits,
    geometryFits: fit.localGeometryFits,
    preferredStraightFits: Boolean(
      fit.tangentMm
      && spans.incomingLengthMm >= fit.preferredMm
      && spans.outgoingLengthMm >= fit.preferredMm
    ),
    bendTypeCode: screening.settings.bendTypeCode,
  };
}

export function buildRawBendCandidateWindows(entries, settings) {
  const lengths = buildSegmentLengths(entries);
  const windows = [];
  const seen = new Set();
  for (let index = 1; index < entries.length - 1; index += 1) {
    const window = buildAngleWindow(entries, lengths, index, settings);
    if (!window) continue;
    const key = `${window.leftSegment}:${window.rightSegment}`;
    if (seen.has(key)) continue;
    seen.add(key); windows.push(window);
  }
  return Object.freeze({ lengths: Object.freeze(lengths), windows: Object.freeze(windows) });
}

export function materializeRawBendCandidate(entries, lengths, window, screening) {
  const classification = classifyAngleWindow(entries, window, screening.settings);
  return classification ? Object.freeze(buildCandidate(entries, lengths, window, classification, screening)) : null;
}

export function buildRawBendCandidates(entries, screening) {
  const evidence = buildRawBendCandidateWindows(entries, screening.settings);
  return Object.freeze(evidence.windows.map((window) => materializeRawBendCandidate(
    entries, evidence.lengths, window, screening)).filter(Boolean));
}
