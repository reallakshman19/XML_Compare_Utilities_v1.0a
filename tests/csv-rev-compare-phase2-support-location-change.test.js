import assert from 'node:assert/strict';
import { runSupportRevisionCompare } from '../tabs/csv-rev-compare/support-revision-engine.js';
import { runSupportLocationChangeBenchmark } from '../tabs/csv-rev-compare/support-revision-phase2-benchmark.js';

const HEADERS = [
  'PREV NAME', 'SCOPE', 'CIVILSECONDARYSUPPORT', 'PIPE', 'SIZE',
  'EAST/WEST', 'NORTH/SOUTH', 'BOP ELEVATION',
  'PIPING PRIMARY SUPPORT', 'SUPPORT TYPE', 'PIPING PRIMARY SUPPORT REFERENCE',
  'REVISION', 'REMARKS (IF ANY)',
];

function row(index, revision, patch = {}) {
  return {
    'PREV NAME': `PS-${100 + index}`,
    SCOPE: 'MODEL',
    CIVILSECONDARYSUPPORT: `SL-${100 + index}`,
    PIPE: `AREA-01-MODEL-6-W${100 + index}-A1-1`,
    SIZE: '6',
    'EAST/WEST': `E ${1000 + (index * 100)}`,
    'NORTH/SOUTH': `N ${2000 + (index * 100)}`,
    'BOP ELEVATION': `${3000 + (index * 100)}`,
    'PIPING PRIMARY SUPPORT': `/PS-${100 + index}.1`,
    'SUPPORT TYPE': 'GUIDE',
    'PIPING PRIMARY SUPPORT REFERENCE': `=${100000 + index}/1`,
    REVISION: String(revision),
    'REMARKS (IF ANY)': '',
    ...patch,
  };
}

function csv(rows) {
  return [HEADERS, ...rows.map((item) => HEADERS.map((header) => item[header] ?? ''))]
    .map((cells) => cells.map(csvCell).join(','))
    .join('\n');
}
function csvCell(value) { const text = String(value); return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
function relocationEvents(result) { return (result?.ledger?.events || []).filter((event) => ['SUPPORT_LOCATION_RELOCATED', 'COMMON_SUPPORT_ANCHOR_RELOCATED'].includes(event.type)); }
function renderedRelocations(result) { return Object.values(result.remarks.targetRemarks).filter((item) => item.remark.includes('Support Relocated')); }
function outputRemark(result, family) {
  const location = result.targetModel.locations.find((item) => item.family === family);
  const remarkIndex = result.output?.headers?.indexOf('REMARKS (IF ANY)') ?? -1;
  const outputRow = result.output?.rows?.find((item) => item.disposition === 'REV2' && item.sourceRowId === location?.sourceRowId);
  return remarkIndex >= 0 ? outputRow?.values?.[remarkIndex] || '' : '';
}

// Accepted ordinary 1->1 movement may project Support Relocated only when a
// trusted coordinate frame proves actual normalized position change.
{
  const earlierRows = [1, 2, 3, 4].map((index) => row(index, 2));
  const laterRows = [1, 2, 3, 4].map((index) => row(index, 3));
  laterRows[3]['EAST/WEST'] = 'E 1800';
  laterRows[3]['REMARKS (IF ANY)'] = 'Support Relocated';
  const earlier = csv(earlierRows), later = csv(laterRows);
  const result = runSupportRevisionCompare(earlier, later);
  assert.equal(result.ok, true);
  assert.equal(result.lineage.coordinateFrame.scoreFrameUsable, true);
  const movedEdge = result.lineage.edges.find((edge) => edge.targetNodeIds.some((id) => result.targetModel.locationByNodeId.get(id)?.family === 'SL-104'));
  assert.ok(movedEdge.coordinateEvidence[0].residualMm > 5, 'ordinary movement must remain visible in coordinate audit');
  const events = relocationEvents(result);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'SUPPORT_LOCATION_RELOCATED');
  assert.ok(events[0].reasonCodes.includes('VALIDATED_AXES_ONLY'));
  assert.equal(renderedRelocations(result).length, 1);
  assert.equal(outputRemark(result, 'SL-104'), 'Support Relocated');

  const benchmark = runSupportLocationChangeBenchmark(earlier, later);
  assert.equal(benchmark.metrics.expected, 1, 'Owner wording Support Relocated must enter the oracle');
  assert.equal(benchmark.metrics.detected, 1);
  assert.equal(benchmark.metrics.truePositives, 1);
  assert.equal(benchmark.metrics.falsePositives, 0);
  assert.equal(benchmark.metrics.falseNegatives, 0);
}

// Direction/sign formatting normalization remains a negative control.
{
  const earlierRows = [1, 2, 3, 4].map((index) => row(index, 2));
  const laterRows = [1, 2, 3, 4].map((index) => row(index, 3));
  laterRows[1]['NORTH/SOUTH'] = `N -${2200}`;
  const result = runSupportRevisionCompare(csv(earlierRows), csv(laterRows));
  assert.equal(result.ok, true);
  assert.equal(relocationEvents(result).length, 0, 'raw sign/format change alone must not trigger relocation');
  const edge = result.lineage.edges.find((item) => item.targetNodeIds.some((id) => result.targetModel.locationByNodeId.get(id)?.family === 'SL-102'));
  assert.equal(edge.coordinateEvidence[0].classification, 'FORMAT_CHANGED');
}

// Under-anchored movement cannot create a user-facing relocation.
{
  const earlierRows = [1, 2].map((index) => row(index, 2));
  const laterRows = [1, 2].map((index) => row(index, 3));
  laterRows[1]['EAST/WEST'] = 'E 1900';
  const result = runSupportRevisionCompare(csv(earlierRows), csv(laterRows));
  assert.equal(result.ok, true);
  assert.equal(result.lineage.coordinateFrame.scoreFrameUsable, false);
  assert.equal(relocationEvents(result).length, 0, 'movement under an under-anchored frame must remain audit-only');
}

// A continuing anchor inside a proven 1->N common-support topology uses the
// same trusted-frame gate plus persistent-reference continuity.
{
  const earlierRows = [1, 2, 3, 4].map((index) => row(index, 2));
  const laterRows = [1, 2, 3, 4].map((index) => row(index, 3));
  earlierRows.push(row(90, 2, {
    'PREV NAME': 'PS-COMMON',
    CIVILSECONDARYSUPPORT: 'SL-COMMON-A',
    PIPE: 'AREA-01-MODEL-6-W900-A1-1',
    'EAST/WEST': 'E 5000', 'NORTH/SOUTH': 'N 6000', 'BOP ELEVATION': '7000',
    'PIPING PRIMARY SUPPORT': '/SL-COMMON-A.1', 'SUPPORT TYPE': 'GUIDE',
    'PIPING PRIMARY SUPPORT REFERENCE': '=COMMON/1',
  }));
  laterRows.push(row(90, 3, {
    'PREV NAME': 'PS-COMMON',
    CIVILSECONDARYSUPPORT: 'SL-COMMON-A',
    PIPE: 'AREA-01-MODEL-6-W900-A1-1',
    'EAST/WEST': 'E 5100', 'NORTH/SOUTH': 'N 6000', 'BOP ELEVATION': '7000',
    'PIPING PRIMARY SUPPORT': '/SL-COMMON-A.1', 'SUPPORT TYPE': 'GUIDE',
    'PIPING PRIMARY SUPPORT REFERENCE': '=COMMON/1',
    'REMARKS (IF ANY)': 'Support Relocated',
  }));
  laterRows.push(row(91, 3, {
    'PREV NAME': 'PS-COMMON',
    CIVILSECONDARYSUPPORT: 'SL-COMMON-B',
    PIPE: 'AREA-01-MODEL-6-W900-A1-1',
    'EAST/WEST': 'E 5500', 'NORTH/SOUTH': 'N 6500', 'BOP ELEVATION': '7100',
    'PIPING PRIMARY SUPPORT': '/SL-COMMON-B.1', 'SUPPORT TYPE': 'GUIDE',
    'PIPING PRIMARY SUPPORT REFERENCE': '=COMMON/2',
  }));
  const earlier = csv(earlierRows);
  const later = csv(laterRows);
  const result = runSupportRevisionCompare(earlier, later);
  assert.equal(result.ok, true);
  const commonEdge = result.lineage.edges.find((edge) => edge.cardinality === '1->N');
  assert.ok(commonEdge, 'fixture must prove common-support 1->N topology');
  const events = relocationEvents(result);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'COMMON_SUPPORT_ANCHOR_RELOCATED');
  assert.ok(events[0].reasonCodes.includes('PERSISTENT_REFERENCE_ANCHOR'));
  assert.ok(events[0].reasonCodes.includes('VALIDATED_AXES_ONLY'));
  assert.equal(renderedRelocations(result).length, 1);
  assert.equal(outputRemark(result, 'SL-COMMON-A'), 'Support Relocated');

  const benchmark = runSupportLocationChangeBenchmark(earlier, later);
  assert.equal(benchmark.metrics.expected, 1);
  assert.equal(benchmark.metrics.detected, 1);
  assert.equal(benchmark.metrics.truePositives, 1);
  assert.equal(benchmark.metrics.falsePositives, 0);
  assert.equal(benchmark.metrics.falseNegatives, 0);
  assert.equal(benchmark.phase1Guard.metrics.falsePositives, 0);
  assert.equal(benchmark.phase1Guard.metrics.falseNegatives, 0);
}

// A HIGH_RESIDUAL axis cannot trigger common-anchor relocation when the
// remaining validated axes are stable. X has one extreme outlier; Y/Z define
// the trustworthy frame and remain unchanged for the common anchor.
{
  const earlierRows = [1, 2, 3, 4].map((index) => row(index, 2));
  const laterRows = [1, 2, 3, 4].map((index) => row(index, 3));
  laterRows[0]['EAST/WEST'] = 'E 10000';
  laterRows[1]['EAST/WEST'] = 'E 20000';
  earlierRows.push(row(92, 2, {
    'PREV NAME': 'PS-COMMON-X', CIVILSECONDARYSUPPORT: 'SL-CX-A', PIPE: 'AREA-01-MODEL-6-W901-A1-1',
    'EAST/WEST': 'E 5000', 'NORTH/SOUTH': 'N 6000', 'BOP ELEVATION': '7000',
    'PIPING PRIMARY SUPPORT': '/SL-CX-A.1', 'SUPPORT TYPE': 'GUIDE', 'PIPING PRIMARY SUPPORT REFERENCE': '=CX/1',
  }));
  laterRows.push(row(92, 3, {
    'PREV NAME': 'PS-COMMON-X', CIVILSECONDARYSUPPORT: 'SL-CX-A', PIPE: 'AREA-01-MODEL-6-W901-A1-1',
    'EAST/WEST': 'E 9000', 'NORTH/SOUTH': 'N 6000', 'BOP ELEVATION': '7000',
    'PIPING PRIMARY SUPPORT': '/SL-CX-A.1', 'SUPPORT TYPE': 'GUIDE', 'PIPING PRIMARY SUPPORT REFERENCE': '=CX/1',
  }));
  laterRows.push(row(93, 3, {
    'PREV NAME': 'PS-COMMON-X', CIVILSECONDARYSUPPORT: 'SL-CX-B', PIPE: 'AREA-01-MODEL-6-W901-A1-1',
    'EAST/WEST': 'E 9500', 'NORTH/SOUTH': 'N 6500', 'BOP ELEVATION': '7100',
    'PIPING PRIMARY SUPPORT': '/SL-CX-B.1', 'SUPPORT TYPE': 'GUIDE', 'PIPING PRIMARY SUPPORT REFERENCE': '=CX/2',
  }));
  const result = runSupportRevisionCompare(csv(earlierRows), csv(laterRows));
  assert.equal(result.ok, true);
  assert.equal(result.lineage.coordinateFrame.axes.x.status, 'HIGH_RESIDUAL');
  assert.equal(result.lineage.coordinateFrame.axes.y.status, 'VALIDATED');
  assert.equal(result.lineage.coordinateFrame.axes.z.status, 'VALIDATED');
  assert.equal(relocationEvents(result).length, 0, 'excluded X axis must not manufacture relocation');
}

console.log('csv-rev-compare Phase 2 support-location-change tests: PASS');
