import {
  cumulativeFromAbsoluteH,
  formatProfileValue,
} from './pipeline-3d-model-profile-coordinate-map.js';

const DASH = '—';

export function buildDerivedTable2Text(rows) {
  return ['Horizontal (m)\tGrade Elevation (m)', ...rows.map((row) => `${row.station}\t${row.elevation}`)].join('\n');
}

export function buildDerivedTable3Text(points) {
  const named = points.filter((point) => point.label && point.source !== 'vertex');
  let previous = 0;
  const lines = named.map((point) => {
    const length = Math.max(0, point.horizontal - previous);
    previous = point.horizontal;
    return `${point.label}\t${formatProfileValue(length)}\t${formatProfileValue(point.horizontal)}`;
  });
  return ['Marker\tSegment Length (m)\tHorizontal Distance (m)', ...lines].join('\n');
}

export function buildTable2XText(profile) {
  const header = ['Row', 'H(coor)', 'V(coor)', '[H vs V] Length', 'Station Text', 'Elevation Text', 'H', 'V', 'H_Int', 'V_Int'];
  const rows = profile.table2Rows.map((row, index) => [
    index + 1,
    row.hCoordinate?.text || DASH,
    row.vCoordinateText || DASH,
    Number.isFinite(row.spanLength) ? formatProfileValue(row.spanLength) : DASH,
    row.stationText || DASH,
    row.elevationText || DASH,
    Number.isFinite(row.stationValue) ? formatProfileValue(row.stationValue, 1) : DASH,
    Number.isFinite(row.elevationValue) ? formatProfileValue(row.elevationValue, 2) : DASH,
    Number.isFinite(row.stationValue) ? formatProfileValue(row.stationValue, 1) : DASH,
    Number.isFinite(row.elevationValue) ? formatProfileValue(row.elevationValue, 2) : DASH,
  ]);
  return [header, ...rows].map((row) => row.join('\t')).join('\n');
}

function originEvidence(profile) {
  const anchor = profile.coordinateMap.anchors[0];
  if (!anchor) return [];
  return [{
    basis: anchor.absoluteH,
    hRef: formatProfileValue(anchor.absoluteH),
    hText: '0.0',
    zRef: DASH,
    zText: DASH,
    markerRef: DASH,
    markerText: DASH,
    hLength: 0,
    cumulative: anchor.cumulative,
    cumulativeInt: anchor.cumulative,
    order: 0,
  }];
}

function lengthEvidence(profile) {
  let cumulative = 0;
  return profile.table3LengthRows.map((row) => {
    cumulative += row.hLength;
    return {
      basis: row.toH,
      hRef: `${formatProfileValue(row.fromH)} → ${formatProfileValue(row.toH)}`,
      hText: Number(row.hLength).toFixed(1),
      zRef: DASH,
      zText: DASH,
      markerRef: DASH,
      markerText: DASH,
      hLength: row.hLength,
      cumulative,
      cumulativeInt: cumulative,
      order: 10,
    };
  });
}

function depthEvidence(profile) {
  return profile.table3DepthRows.map((row) => {
    const basis = row.absoluteH ?? row.textPositionH ?? row.toH ?? row.fromH;
    return {
      basis,
      hRef: DASH,
      hText: DASH,
      zRef: Number.isFinite(row.fromH) && Number.isFinite(row.toH)
        ? `${formatProfileValue(row.fromH)} → ${formatProfileValue(row.toH)}`
        : formatProfileValue(basis),
      zText: row.zText,
      markerRef: DASH,
      markerText: DASH,
      hLength: null,
      cumulative: null,
      cumulativeInt: cumulativeFromAbsoluteH(basis, profile.coordinateMap),
      order: 20,
    };
  });
}

function markerEvidence(profile) {
  return profile.table3MarkerRows.map((row) => ({
    basis: row.absoluteH,
    hRef: DASH,
    hText: DASH,
    zRef: DASH,
    zText: DASH,
    markerRef: formatProfileValue(row.absoluteH),
    markerText: row.markerText,
    hLength: null,
    cumulative: null,
    cumulativeInt: cumulativeFromAbsoluteH(row.absoluteH, profile.coordinateMap),
    order: 30,
  }));
}

export function buildTable3EvidenceRows(profile) {
  return [...originEvidence(profile), ...lengthEvidence(profile), ...depthEvidence(profile), ...markerEvidence(profile)]
    .sort((a, b) => a.cumulativeInt - b.cumulativeInt || a.order - b.order || a.markerText.localeCompare(b.markerText));
}

export function buildTable3XText(profile) {
  const header = [
    'Row', 'H(coor basis used)', '[H vs HLength] Text Position X', 'HLength Text',
    '[H vs Z] Text Position X', 'Z Text', '[H vs Markers] Text Position X', 'Marker Text',
    'Hlength', 'Hlength_Cum', 'Hlength_Cum_Int', 'Z', 'MarkerText',
  ];
  const body = buildTable3EvidenceRows(profile).map((row, index) => [
    index + 1,
    formatProfileValue(row.basis),
    row.hRef,
    row.hText,
    row.zRef,
    row.zText,
    row.markerRef,
    row.markerText,
    Number.isFinite(row.hLength) ? Number(row.hLength).toFixed(1) : DASH,
    Number.isFinite(row.cumulative) ? Number(row.cumulative).toFixed(1) : DASH,
    Number(row.cumulativeInt).toFixed(1),
    row.zText,
    row.markerText,
  ]);
  return [header, ...body].map((row) => row.join('\t')).join('\n');
}
