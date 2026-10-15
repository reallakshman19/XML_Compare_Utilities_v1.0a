import assert from 'node:assert/strict';

import { convertSupportRevisionTable } from '../tabs/csv-rev-compare/support-revision-pipeline.js';
import { runSupportRevisionCompare } from '../tabs/csv-rev-compare/support-revision-engine.js';
import { runPsNoChangeBenchmark } from '../tabs/csv-rev-compare/support-revision-phase1-benchmark.js';

const CIVIL_HEADER = 'CIVIL SECONDARY SUPPORT \n(Tag provided by Civil)';
const H = [
  'PREV PRIMARY SUPPORT NAME', 'SCOPE', CIVIL_HEADER, 'PIPE', 'SIZE',
  'PIPING PRIMARY SUPPORT', 'SUPPORT TYPE', 'PIPING PRIMARY SUPPORT REFERENCE',
  'EAST/WEST', 'NORTH/SOUTH', 'BOP ELEVATION', 'TOTAL SUPPORT POINTS ON SECONDARY',
  'REMARKS (IF ANY)', 'PRIMARY SUPPORT DESCRIPTION', 'PRIMARY SUPPORT ZONE', 'PRIMARY SUPPORT SITE',
  'PIPE SCHEDULE', 'INSULATION TYPE AND THICKNESS', 'STRESS SYSTEM NUMBER', 'NODE NO', 'REVISION',
  'Fx', 'Fy', 'Fz',
];

function row(overrides = {}) {
  const value = {
    'PREV PRIMARY SUPPORT NAME': 'PS-OLD',
    SCOPE: 'BWGA',
    [CIVIL_HEADER]: 'SL-100(REF)',
    PIPE: 'BWGA-1000-4"-B1110103-11503-01',
    SIZE: '100',
    'PIPING PRIMARY SUPPORT': '/SL-100.1',
    'SUPPORT TYPE': 'REST-100',
    'PIPING PRIMARY SUPPORT REFERENCE': '=100/1',
    'EAST/WEST': 'E 1000 mm',
    'NORTH/SOUTH': 'N 2000 mm',
    'BOP ELEVATION': 'U 3000 mm',
    'TOTAL SUPPORT POINTS ON SECONDARY': '1',
    'REMARKS (IF ANY)': '',
    'PRIMARY SUPPORT DESCRIPTION': 'Pipe Rest',
    'PRIMARY SUPPORT ZONE': 'BWGA-ZONE',
    'PRIMARY SUPPORT SITE': 'BWGA-SITE',
    'PIPE SCHEDULE': 'PIPE Sch 40',
    'INSULATION TYPE AND THICKNESS': 'PP 50mm',
    'STRESS SYSTEM NUMBER': 'SYS-1',
    'NODE NO': '10',
    REVISION: '2',
    Fx: '-', Fy: '-', Fz: '-',
    ...overrides,
  };
  return H.map((header) => value[header] ?? '');
}

function table(rows) {
  return [H, ...rows].map((cells) => cells.map(csvCell).join(',')).join('\n');
}
function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

// The real Support Report Civil header contains a newline. It remains one CSV
// record and is canonicalized without introducing a second parser.
{
  const conversion = convertSupportRevisionTable(table([row()]));
  assert.equal(conversion.ok, true, JSON.stringify(conversion.validationResults, null, 2));
  assert.ok(conversion.source.originalHeaders.includes(CIVIL_HEADER));
  assert.ok(conversion.source.headers.includes('CIVILSECONDARYSUPPORT'));
  assert.ok(conversion.source.headers.includes('PREV NAME'));
  assert.ok(conversion.source.headers.includes('INSULATION'));
  const location = conversion.graph.nodes.find((node) => node.levelId === 'supportLocation');
  assert.equal(location.fields.supportLocationIdentity, 'SL-100(REF)||BWGA-1000-4"-B1110103-11503-01');
  assert.notEqual(location.fields.supportLocationIdentity, 'SL-100(REF)');
}

// Same Civil tag with different PIPE values means two distinct logical support
// locations. Reordering rows must not cross-match them, even without references.
{
  const pipeA = 'BWGA-1000-4"-B1110103-11503-01';
  const pipeB = 'BWGA-1000-8"-P1110102-96620M0-01';
  const a = row({ [CIVIL_HEADER]: 'SL-SHARED', PIPE: pipeA, 'PIPING PRIMARY SUPPORT': '/SL-SHARED.1', 'PIPING PRIMARY SUPPORT REFERENCE': '' });
  const b = row({ [CIVIL_HEADER]: 'SL-SHARED', PIPE: pipeB, 'PIPING PRIMARY SUPPORT': '/SL-SHARED.2', 'PIPING PRIMARY SUPPORT REFERENCE': '', 'NORTH/SOUTH': 'N 2500 mm' });
  const result = runSupportRevisionCompare(table([a, b]), table([b, a]));
  assert.equal(result.stage, 'READY_TO_EXPORT');
  assert.equal(result.lineage.ambiguous.length, 0);
  assert.equal(result.lineage.edges.length, 2);
  for (const edge of result.lineage.edges) {
    const source = result.sourceModel.locationByNodeId.get(edge.sourceNodeIds[0]);
    const target = result.targetModel.locationByNodeId.get(edge.targetNodeIds[0]);
    assert.equal(source.supportLocationIdentity, target.supportLocationIdentity);
    assert.ok(edge.reasonCodes.includes('SUPPORT_LOCATION_IDENTITY_EXACT'));
  }
}

// Civil equality by itself is insufficient. Different PIPE and no persistent
// reference remains removed+added instead of a false 1->1 continuation. Keep
// both revisions in the same area/scope so this exercises lineage rather than
// the pair-compatibility gate.
{
  const before = row({ [CIVIL_HEADER]: 'SL-SHARED', PIPE: 'BWGA-1000-4"-B1110103-11503-01', 'PIPING PRIMARY SUPPORT REFERENCE': '' });
  const after = row({ [CIVIL_HEADER]: 'SL-SHARED', PIPE: 'BWGA-1000-12"-Z9999999-OTHER-99', 'PIPING PRIMARY SUPPORT REFERENCE': '', 'EAST/WEST': 'E 9000 mm', 'NORTH/SOUTH': 'N 9000 mm' });
  const result = runSupportRevisionCompare(table([before]), table([after]));
  assert.equal(result.stage, 'READY_TO_EXPORT');
  assert.equal(result.lineage.edges.length, 0);
  assert.equal(result.lineage.removed.length, 1);
  assert.equal(result.lineage.added.length, 1);
}

// Phase 1 PS-number change: persistent component reference proves continuation
// across a changed Civil support number; the renderer emits the governed token.
{
  const pipe = 'BWGA-1000-4"-B1110103-11503-01';
  const before = row({ [CIVIL_HEADER]: 'SL-OLD', PIPE: pipe, 'PIPING PRIMARY SUPPORT': '/SL-OLD.1', 'PIPING PRIMARY SUPPORT REFERENCE': '=PS/1', REVISION: '2' });
  const after = row({ [CIVIL_HEADER]: 'SL-NEW', PIPE: pipe, 'PIPING PRIMARY SUPPORT': '/SL-NEW.7', 'PIPING PRIMARY SUPPORT REFERENCE': '=PS/1', REVISION: '3' });
  const result = runSupportRevisionCompare(table([before]), table([after]));
  const familyEvent = result.ledger.events.find((event) => event.type === 'SECONDARY_SUPPORT_FAMILY_CHANGED');
  assert.ok(familyEvent);
  assert.ok(familyEvent.persistentReferences.includes('=PS/1'));
  const targetLocation = result.targetModel.locations[0];
  assert.equal(result.remarks.targetRemarks[targetLocation.sourceRowId].remark, 'PS No./Line No. Change Earlier:SL-OLD(=PS/1)');
}

// R3 remarks are benchmark labels only. PS No. change is scored; HOLD is neither
// consulted by the comparison engine nor treated as a Phase 1 expected event.
{
  const pipe1 = 'BWGA-1000-4"-B1110103-11503-01';
  const pipe2 = 'BWGA-1000-8"-P1110102-96620M0-01';
  const earlier = table([
    row({ [CIVIL_HEADER]: 'SL-OLD', PIPE: pipe1, 'PIPING PRIMARY SUPPORT': '/SL-OLD.1', 'PIPING PRIMARY SUPPORT REFERENCE': '=PS/1', REVISION: '2' }),
    row({ [CIVIL_HEADER]: 'SL-HOLD', PIPE: pipe2, 'PREV PRIMARY SUPPORT NAME': 'PS-HOLD', 'PIPING PRIMARY SUPPORT': '/SL-HOLD.1', 'PIPING PRIMARY SUPPORT REFERENCE': '=H/1', REVISION: '2' }),
  ]);
  const r3Oracle = table([
    row({ [CIVIL_HEADER]: 'SL-NEW', PIPE: pipe1, 'PIPING PRIMARY SUPPORT': '/SL-NEW.7', 'PIPING PRIMARY SUPPORT REFERENCE': '=PS/1', 'REMARKS (IF ANY)': 'PS No. change, HOLD - manual benchmark note', REVISION: '3' }),
    row({ [CIVIL_HEADER]: 'SL-HOLD', PIPE: pipe2, 'PREV PRIMARY SUPPORT NAME': 'PS-HOLD', 'PIPING PRIMARY SUPPORT': '/SL-HOLD.1', 'PIPING PRIMARY SUPPORT REFERENCE': '=H/1', 'REMARKS (IF ANY)': 'HOLD - vendor information', REVISION: '3' }),
  ]);
  const benchmark = runPsNoChangeBenchmark(earlier, r3Oracle);
  assert.equal(benchmark.bucket, 'PS No. change');
  assert.equal(benchmark.metrics.expected, 1);
  assert.equal(benchmark.metrics.detected, 1);
  assert.equal(benchmark.metrics.truePositives, 1);
  assert.equal(benchmark.metrics.falsePositives, 0);
  assert.equal(benchmark.metrics.falseNegatives, 0);
  assert.equal(benchmark.metrics.precision, 1);
  assert.equal(benchmark.metrics.recall, 1);
  assert.ok(benchmark.compareResult.targetModel.locations.every((location) => location.sourceFields.historicalRemarks === ''));
  assert.ok(!benchmark.compareResult.ledger.events.some((event) => /HOLD/i.test(event.type)));
}

console.log('csv rev compare phase 1 PS No. change tests passed');