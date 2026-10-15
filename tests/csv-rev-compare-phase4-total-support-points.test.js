import assert from 'node:assert/strict';
import { runSupportRevisionCompare } from '../tabs/csv-rev-compare/support-revision-engine.js';
import { runTotalSupportPointChangeBenchmark } from '../tabs/csv-rev-compare/support-revision-phase4-benchmark.js';
import { normalizeSupportPointCount, SUPPORT_REV_TOTAL_POINTS_EVENT } from '../tabs/csv-rev-compare/support-revision-total-points.js';

const HEADERS = [
  'PREV NAME', 'SCOPE', 'CIVILSECONDARYSUPPORT', 'PIPE', 'SIZE',
  'PIPING PRIMARY SUPPORT', 'SUPPORT TYPE', 'PIPING PRIMARY SUPPORT REFERENCE',
  'TOTAL SUPPORT POINTS ON SECONDARY', 'EAST/WEST', 'NORTH/SOUTH', 'BOP ELEVATION',
  'REVISION', 'REMARKS (IF ANY)', 'Fy',
];

function row(id, revision, options = {}) {
  const values = {
    'PREV NAME': options.prevName || `PS-${id}`,
    SCOPE: 'PL',
    CIVILSECONDARYSUPPORT: options.family || 'SL-SHARED(REF)',
    PIPE: options.pipe || `AREA-01-PL-${id}`,
    SIZE: '6',
    'PIPING PRIMARY SUPPORT': options.member || `/SL-SHARED.${id}`,
    'SUPPORT TYPE': options.supportType || 'REST-50',
    'PIPING PRIMARY SUPPORT REFERENCE': options.reference || `=${id}/1`,
    'TOTAL SUPPORT POINTS ON SECONDARY': options.totalSupportPoints ?? '1',
    'EAST/WEST': options.eastWest || `E ${1000 + Number(id)}`,
    'NORTH/SOUTH': options.northSouth || `N ${2000 + Number(id)}`,
    'BOP ELEVATION': options.bop || 'U 3000',
    REVISION: String(revision),
    'REMARKS (IF ANY)': options.remark || '',
    Fy: options.load ?? '10',
  };
  return HEADERS.map((header) => values[header] ?? '');
}

function csv(rows) {
  return [HEADERS, ...rows].map((cells) => cells.map(csvCell).join(',')).join('\n');
}
function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
function totalEvents(result) {
  return (result?.ledger?.events || []).filter((event) => event.type === SUPPORT_REV_TOTAL_POINTS_EVENT);
}

// Discrete counts compare numerically where possible, so representation-only 2 -> 2.0 is unchanged.
{
  assert.equal(normalizeSupportPointCount('2').value, 2);
  assert.equal(normalizeSupportPointCount('2.0').value, 2);
}

// Same CIVIL tag on two pipes is two distinct support locations. A governed total-support
// field delta is attributable only when the exact Civil+PIPE lineage pair also carries a
// local support-graph delta. PIPE-A changes both its total field and component reference;
// PIPE-B is representation-only unchanged.
{
  const earlier = csv([
    row(1, 2, { pipe: 'PIPE-A', reference: '=A/1', totalSupportPoints: '1' }),
    row(2, 2, { pipe: 'PIPE-B', reference: '=B/1', totalSupportPoints: '2' }),
  ]);
  const later = csv([
    row(2, 3, { pipe: 'PIPE-B', reference: '=B/1', totalSupportPoints: '2.0' }),
    row(1, 3, { pipe: 'PIPE-A', reference: '=A/2', totalSupportPoints: '2', remark: 'Total No. of support changes' }),
  ]);
  const result = runSupportRevisionCompare(earlier, later);
  assert.equal(result.ok, true);
  assert.equal(totalEvents(result).length, 1);
  const event = totalEvents(result)[0];
  assert.equal(event.normalizedState.before, 1);
  assert.equal(event.normalizedState.after, 2);
  assert.equal(event.normalizedState.delta, 1);
  assert.ok(event.reasonCodes.includes('LOCAL_SUPPORT_GRAPH_CHANGED'));
  const target = result.targetModel.locationByNodeId.get(event.targetXmlNode);
  assert.equal(target.supportLocationIdentity, 'SL-SHARED(REF)||PIPE-A');
  assert.match(result.remarks.targetRemarks[target.sourceRowId].remark, /Total No\. of support changes/);

  const benchmark = runTotalSupportPointChangeBenchmark(earlier, later);
  assert.equal(benchmark.metrics.oracleExpected, 1);
  assert.equal(benchmark.metrics.unsupported, 0);
  assert.equal(benchmark.metrics.expected, 1);
  assert.equal(benchmark.metrics.detected, 1);
  assert.equal(benchmark.metrics.truePositives, 1);
  assert.equal(benchmark.metrics.falsePositives, 0);
  assert.equal(benchmark.metrics.falseNegatives, 0);
}

// Family/aggregate field ripple negative control: a raw total-support field delta without
// any local support-component graph change must not be broadcast onto this Civil+PIPE item.
{
  const earlier = csv([row(30, 2, { family: 'SL-RIPPLE(REF)', pipe: 'PIPE-R', reference: '=R/1', totalSupportPoints: '4' })]);
  const later = csv([row(30, 3, { family: 'SL-RIPPLE(REF)', pipe: 'PIPE-R', reference: '=R/1', totalSupportPoints: '5' })]);
  const result = runSupportRevisionCompare(earlier, later);
  assert.equal(result.ok, true);
  assert.equal(totalEvents(result).length, 0);
}

// A target-only composite may carry an R3 oracle remark, but without an R2 predecessor
// the count delta is not checkable. Report it unsupported; never manufacture an event.
{
  const earlier = csv([row(10, 2, { family: 'SL-X(REF)', pipe: 'PIPE-X', reference: '=X/1', totalSupportPoints: '1' })]);
  const later = csv([
    row(10, 3, { family: 'SL-X(REF)', pipe: 'PIPE-X', reference: '=X/1', totalSupportPoints: '1' }),
    row(11, 3, { family: 'SL-X(REF)', pipe: 'PIPE-Y', reference: '=Y/1', totalSupportPoints: '2', remark: 'Total No. of support changes' }),
  ]);
  const benchmark = runTotalSupportPointChangeBenchmark(earlier, later);
  assert.equal(benchmark.metrics.oracleExpected, 1);
  assert.equal(benchmark.metrics.unsupported, 1);
  assert.equal(benchmark.metrics.expected, 0);
  assert.equal(benchmark.metrics.detected, 0);
  assert.equal(benchmark.unsupported[0].reason, 'NO_LINEAGE_PREDECESSOR');
}

// Oracle poisoning negative control: unchanged XML field + R3 remark stays an FN.
{
  const earlier = csv([row(20, 2, { family: 'SL-Z(REF)', pipe: 'PIPE-Z', reference: '=Z/1', totalSupportPoints: '2' })]);
  const later = csv([row(20, 3, { family: 'SL-Z(REF)', pipe: 'PIPE-Z', reference: '=Z/1', totalSupportPoints: '2', remark: 'Total No. of support changes' })]);
  const benchmark = runTotalSupportPointChangeBenchmark(earlier, later);
  assert.equal(benchmark.metrics.oracleExpected, 1);
  assert.equal(benchmark.metrics.unsupported, 0);
  assert.equal(benchmark.metrics.expected, 1);
  assert.equal(benchmark.metrics.detected, 0);
  assert.equal(benchmark.metrics.falseNegatives, 1);
  assert.equal(totalEvents(benchmark.compareResult).length, 0);
}

console.log('csv-rev-compare Phase 4 total-support-points tests: PASS');
