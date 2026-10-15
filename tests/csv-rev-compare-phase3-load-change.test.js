import assert from 'node:assert/strict';
import { runSupportRevisionCompare } from '../tabs/csv-rev-compare/support-revision-engine.js';
import { compareLoadVectors, SUPPORT_REV_LOAD_POLICY_V1 } from '../tabs/csv-rev-compare/support-revision-loads.js';
import { runLoadChangeBenchmark } from '../tabs/csv-rev-compare/support-revision-phase3-benchmark.js';

const BASE_HEADERS = [
  'PREV NAME', 'SCOPE', 'CIVILSECONDARYSUPPORT', 'PIPE', 'SIZE',
  'PIPING PRIMARY SUPPORT', 'SUPPORT TYPE', 'PIPING PRIMARY SUPPORT REFERENCE',
  'EAST/WEST', 'NORTH/SOUTH', 'BOP ELEVATION', 'REVISION', 'REMARKS (IF ANY)',
];
const LOAD_HEADERS = ['Fy', 'Fy', 'Fz'];
const HEADERS = [...BASE_HEADERS, ...LOAD_HEADERS];

function row(id, revision, options = {}) {
  const fields = {
    'PREV NAME': options.prevName || `PS-${id}`,
    SCOPE: 'PL',
    CIVILSECONDARYSUPPORT: options.family || `SL-${id}`,
    PIPE: options.pipe || `AREA-01-PL-6"-M${id}-01`,
    SIZE: '6',
    'PIPING PRIMARY SUPPORT': options.member || `/SL-${id}.1`,
    'SUPPORT TYPE': options.supportType || 'REST-50',
    'PIPING PRIMARY SUPPORT REFERENCE': options.reference || `=${id}/1`,
    'EAST/WEST': options.eastWest || `E ${1000 + Number(id) || 1000}`,
    'NORTH/SOUTH': options.northSouth || `N ${2000 + Number(id) || 2000}`,
    'BOP ELEVATION': options.bop || 'U 3000',
    REVISION: String(revision),
    'REMARKS (IF ANY)': options.remark || '',
  };
  return [...BASE_HEADERS.map((header) => fields[header] ?? ''), ...(options.loads || ['', '', ''])];
}

function csv(rows) {
  return [HEADERS, ...rows].map((cells) => cells.map(csvCell).join(',')).join('\n');
}
function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
function loadEvents(result) {
  return (result?.ledger?.events || []).filter((event) => ['LOAD_BECAME_NUMERIC', 'LOAD_SIGNATURE_CHANGED'].includes(event.type));
}
function targetRemarks(result) {
  return Object.values(result?.remarks?.targetRemarks || {}).map((item) => item.remark);
}
function outputRemarks(result) {
  const remarkIndex = result.output?.headers?.indexOf('REMARKS (IF ANY)') ?? -1;
  if (remarkIndex < 0) return [];
  return (result.output?.rows || []).filter((row) => row.disposition === 'REV2').map((row) => row.values[remarkIndex]);
}

// Stable column IDs, not array order or duplicate header text, own slot identity.
{
  const before = [
    { sourceHeader: 'Fy', ordinal: 1, columnId: 'Fy', raw: '-13623' },
    { sourceHeader: 'Fy', ordinal: 2, columnId: 'Fy__2', raw: '-11594' },
  ];
  const reordered = [before[1], before[0]];
  const result = compareLoadVectors(before, reordered);
  assert.equal(result.classification, 'UNCHANGED');
  assert.deepEqual(result.deltas.map((item) => item.slotKey).sort(), ['COLUMN:FY', 'COLUMN:FY__2']);
}

// Numeric comparison uses the versioned tolerance profile rather than literals in event code.
{
  const slot = (raw) => [{ sourceHeader: 'Fy', ordinal: 1, columnId: 'Fy', raw }];
  assert.equal(compareLoadVectors(slot('10'), slot('10.0005')).classification, 'UNCHANGED');
  assert.equal(compareLoadVectors(slot('10'), slot('10.002')).classification, 'LOAD_SIGNATURE_CHANGED');
  assert.equal(SUPPORT_REV_LOAD_POLICY_V1.policyId, 'SUPPORT_REV_LOAD_POLICY_V1');
}

// Workbook placeholders are semantic empties. Preserve their raw audit values,
// but never manufacture a load-change event for R2 "-" versus an R3 blank cell.
{
  const before = [{ sourceHeader: 'Fy', ordinal: 1, columnId: 'Fy', raw: '-' }];
  const after = [{ sourceHeader: 'Fy', ordinal: 1, columnId: 'Fy', raw: '' }];
  const result = compareLoadVectors(before, after);
  assert.equal(result.classification, 'UNCHANGED');
  assert.equal(result.before.state, 'EMPTY');
  assert.equal(result.after.state, 'EMPTY');
  assert.equal(result.before.slots[0].raw, '-');
  assert.equal(result.after.slots[0].raw, '');
}

// XML-lineage qualification fixture: standardisation, changed numeric signature,
// unchanged numeric loads and HOLD-only remarks are all present together.
{
  const earlier = csv([
    row(101, 2, { loads: ['', '', ''] }),
    row(102, 2, { loads: ['-13623', '-11594', '25'] }),
    row(103, 2, { loads: ['10', '20', '30'] }),
    row(104, 2, { loads: ['40', '50', '60'] }),
  ]);
  const later = csv([
    row(104, 3, { loads: ['40', '50', '60'], remark: 'HOLD' }),
    row(103, 3, { loads: ['10', '20', '30'] }),
    row(102, 3, { loads: ['-14000', '-11594', '25'], remark: 'Minor Load change' }),
    row(101, 3, { loads: ['-13623', '-11594', '0'], remark: 'load standardised' }),
  ]);
  const result = runSupportRevisionCompare(earlier, later);
  assert.equal(result.ok, true);
  assert.deepEqual(loadEvents(result).map((event) => event.type).sort(), ['LOAD_BECAME_NUMERIC', 'LOAD_SIGNATURE_CHANGED']);
  assert.ok(targetRemarks(result).includes('load standardised'));
  assert.ok(targetRemarks(result).includes('Minor Load change'));
  assert.ok(outputRemarks(result).includes('Minor Load change'), 'final REV2 output must carry Owner load vocabulary');
  assert.ok(!result.ledger.events.some((event) => /HOLD/.test(event.type)));

  const benchmark = runLoadChangeBenchmark(earlier, later);
  assert.equal(benchmark.metrics.expected, 2);
  assert.equal(benchmark.metrics.detected, 2);
  assert.equal(benchmark.metrics.truePositives, 2);
  assert.equal(benchmark.metrics.falsePositives, 0);
  assert.equal(benchmark.metrics.falseNegatives, 0);
  assert.equal(benchmark.phase1Guard.metrics.falsePositives, 0);
  assert.equal(benchmark.phase1Guard.metrics.falseNegatives, 0);
  assert.equal(benchmark.phase2Guard.metrics.falsePositives, 0);
  assert.equal(benchmark.phase2Guard.metrics.falseNegatives, 0);
}

// Oracle poisoning is a negative control: an R3 load-change label on unchanged
// numeric XML state must remain a benchmark FN, never comparison evidence.
{
  const earlier = csv([row(201, 2, { loads: ['1', '2', '3'] })]);
  const later = csv([row(201, 3, { loads: ['1', '2', '3'], remark: 'Minor Load change' })]);
  const benchmark = runLoadChangeBenchmark(earlier, later);
  assert.equal(benchmark.metrics.expected, 1);
  assert.equal(benchmark.metrics.detected, 0);
  assert.equal(benchmark.metrics.falseNegatives, 1);
  assert.equal(loadEvents(benchmark.compareResult).length, 0);
}

console.log('csv-rev-compare Phase 3 load-change tests: PASS');
