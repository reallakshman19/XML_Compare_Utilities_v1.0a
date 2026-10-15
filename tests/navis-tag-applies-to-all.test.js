import assert from 'node:assert/strict';
import {
  DEFAULT_APPLIES_TO_CONFIG,
  applyAppliesToPropagation,
  normalizeAppliesToConfig,
  parseAppliesToDirective,
} from '../tabs/navis-tag-isonote/navis-tag-applies-to.js';
import { buildFinalOutputRows } from '../tabs/navis-tag-isonote/navis-tag-final-output.js';

const acceptedAliases = [
  'R+G+LS (APPLIES TO ALL)',
  'R+G+LS (Applies to all)',
  'R+G+LS (Apply to all)',
  'R+G+LS ( APPLY   TO   ALL )',
  'R+G+LS (TYP TO ALL)',
  'R+G+LS (TYP. TO ALL)',
  'R+G+LS (Typical to all)',
  'R+G+LS (typ\n\tto\tall).',
  'R+G+LS (applies to all.)',
];
for (const source of acceptedAliases) {
  const parsed = parseAppliesToDirective(source);
  assert.equal(parsed.matched, true, source);
  assert.equal(parsed.mode, 'ALL_PARALLEL_IN_WINDOW', source);
  assert.equal(parsed.appliesToAll, true, source);
  assert.equal(parsed.note, 'R+G+LS', source);
  assert.deepEqual(parsed.targets, [], source);
}

const named = parseAppliesToDirective('R+G (applies to /AREA-8"-P8810204-PP-01).');
assert.equal(named.mode, 'TARGET_LIST');
assert.deepEqual(named.targets, ['/AREA-8"-P8810204-PP-01']);

const ambiguous = parseAppliesToDirective('R+G (applies to all, /AREA-8"-P8810204-PP-01)');
assert.equal(ambiguous.matched, true);
assert.equal(ambiguous.mode, 'AMBIGUOUS');
assert.equal(ambiguous.ambiguity, 'MIXED_ALL_AND_TARGETS');

const invalidTyp = parseAppliesToDirective('R+G (TYP TO /AREA-8"-P8810204-PP-01)');
assert.equal(invalidTyp.mode, 'AMBIGUOUS');
assert.equal(invalidTyp.ambiguity, 'TYP_REQUIRES_ALL');

for (const source of ['R+G applies to all', 'R+G (apply all)', 'R+G (typical)']) {
  assert.equal(parseAppliesToDirective(source).matched, false, source);
}

const legacy = '^(.*?)\\s*\\(\\s*applies\\s+to\\s+([\\s\\S]+?)\\s*\\)\\s*\\.?\\s*$';
assert.equal(normalizeAppliesToConfig({ appliesToDirectiveRegex: legacy }).appliesToDirectiveRegex, DEFAULT_APPLIES_TO_CONFIG.appliesToDirectiveRegex);

function decision(rowId, pipe, x, y, z, index, extra = {}) {
  return {
    tableRowId: rowId,
    tableRowIndex: index,
    canonicalIdentity: `PS-${rowId}`,
    supportRoot: `PS-${rowId}`,
    resolvedPipe: pipe,
    supportPosition: { x, y, z },
    status: 'UNRESOLVED',
    supportIsonote: '',
    ...extra,
  };
}

const sourcePipe = '/AREA-6"-SOURCE-P8810001-PP-01';
const targetA = '/AREA-8"-TARGET-A-P8810002-PP-01';
const targetB = '/AREA-4"-TARGET-B-P8810003-PP-01';
const offsetFail = '/AREA-4"-OFFSET-P8810004-PP-01';
const elevationFail = '/AREA-4"-ELEV-P8810005-PP-01';
const nonParallel = '/AREA-4"-EW-P8810006-PP-01';
const sourceComment = 'R+G+LS (TYP. TO ALL)';

const decisions = [
  decision('S1', sourcePipe, 100, 200, 1000, 1, {
    status: 'RESOLVED',
    supportIsonote: sourceComment,
    selectedTagId: '8',
    selectedCommentId: '8',
    selectedNavisPosition: { x: 100, y: 200, z: 1000 },
    selectedCandidate: { commentBody: sourceComment, tagPosition: { x: 100, y: 200, z: 1000 } },
  }),
  decision('S2', sourcePipe, 100, 1200, 1000, 2),
  decision('A1', targetA, 450, 200, 1500, 3),
  decision('A2', targetA, 450, 1200, 1500, 4),
  decision('B1', targetB, -200, 200, 1600, 5),
  decision('B2', targetB, -200, 1200, 1600, 6),
  decision('O1', offsetFail, 800, 200, 1000, 7),
  decision('O2', offsetFail, 800, 1200, 1000, 8),
  decision('Z1', elevationFail, 200, 200, 1800, 9),
  decision('Z2', elevationFail, 200, 1200, 1800, 10),
  decision('E1', nonParallel, 100, 300, 1200, 11),
  decision('E2', nonParallel, 1100, 300, 1200, 12),
];

const config = {
  appliesToAlongAxisToleranceMm: 100,
  appliesToParallelOffsetToleranceMm: 500,
  appliesToElevationToleranceMm: 700,
  appliesToAllMaxTargetRows: 100,
};
const audit = applyAppliesToPropagation({ decisions, augmentedRows: decisions.map(() => ({})), diagnostics: [], summary: {} }, config);
const byId = new Map(audit.decisions.map((row) => [row.tableRowId, row]));

assert.equal(byId.get('S1').supportIsonote, 'R+G+LS');
assert.equal(byId.get('S2').supportIsonote, '', 'source-pipe supports are excluded from all-scope propagation');
assert.equal(byId.get('A1').supportIsonote, 'R+G+LS (Based on Tag 8)');
assert.equal(byId.get('B1').supportIsonote, 'R+G+LS (Based on Tag 8)');
assert.equal(byId.get('A2').supportIsonote, '', 'out-of-station support must be rejected');
assert.equal(byId.get('O1').supportIsonote, '', 'out-of-offset support must be rejected');
assert.equal(byId.get('Z1').supportIsonote, '', 'out-of-elevation support must be rejected');
assert.equal(byId.get('E1').supportIsonote, '', 'nonparallel target pipe must be rejected');

assert.equal(audit.summary.appliesToAllDirectiveCount, 1);
assert.equal(audit.summary.appliesToAllCandidatePipeCount, 5);
assert.equal(audit.summary.appliesToAllCandidateRowCount, 10);
assert.equal(audit.summary.appliesToAllApplicationCount, 2);
assert.equal(audit.summary.propagatedTargetRowCount, 2);
assert.ok(audit.propagationLedger.some((row) => row.targetTableRowId === 'A1' && row.applied && row.pipeMatchBasis === 'ALL_PARALLEL_PIPE_GROUPS'));
assert.ok(audit.propagationLedger.some((row) => row.targetTableRowId === 'A2' && row.rejectionReasons.includes('ALONG_AXIS_OUTSIDE_TOLERANCE')));
assert.ok(audit.propagationLedger.some((row) => row.targetTableRowId === 'O1' && row.rejectionReasons.includes('PARALLEL_OFFSET_OUTSIDE_TOLERANCE')));
assert.ok(audit.propagationLedger.some((row) => row.targetTableRowId === 'Z1' && row.rejectionReasons.includes('ELEVATION_OUTSIDE_TOLERANCE')));
assert.ok(audit.propagationLedger.some((row) => row.targetTableRowId === 'E1' && row.rejectionReasons.includes('TARGET_PIPE_NOT_PARALLEL')));
assert.equal(audit.augmentedRows[0]['Applies-To Mode'], 'ALL_PARALLEL_IN_WINDOW');
assert.equal(audit.augmentedRows[0]['Applies-To Target Pipes'], 'ALL');
const finalRows = buildFinalOutputRows(audit);
const finalA1 = finalRows.find((row) => row['Name of the element'] === '/PS-A1');
assert.equal(finalA1?.Tag, 'R+G+LS');
assert.equal(finalA1?.['Navis Tag ID'], '8');
assert.equal(finalA1?.['Support ISONOTE'], ':/PS-A1 REST, GUIDE, LINE STOP (C=P)');
assert.match(finalA1?.Basis || '', /ALL_PARALLEL_PIPE_GROUPS/);

const limited = applyAppliesToPropagation({ decisions, augmentedRows: decisions.map(() => ({})), diagnostics: [], summary: {} }, { ...config, appliesToAllMaxTargetRows: 1 });
assert.equal(limited.summary.appliesToAllApplicationCount, 0);
assert.ok(limited.diagnostics.some((row) => row.code === 'APPLIES_TO_ALL_TARGET_ROW_LIMIT_REACHED'));
assert.ok(limited.propagationLedger.some((row) => row.outcome === 'ALL_SCOPE_LIMIT_EXCEEDED'));

const disabled = applyAppliesToPropagation({ decisions, augmentedRows: decisions.map(() => ({})), diagnostics: [], summary: {} }, { ...config, appliesToAllEnabled: false });
assert.equal(disabled.summary.appliesToAllApplicationCount, 0);
assert.ok(disabled.diagnostics.some((row) => row.code === 'APPLIES_TO_ALL_DISABLED'));

const ambiguousDecisions = decisions.map((row) => row.tableRowId === 'S1'
  ? { ...row, supportIsonote: 'R+G (applies to all, /AREA-8"-P8810204-PP-01)', selectedCandidate: { ...row.selectedCandidate, commentBody: 'R+G (applies to all, /AREA-8"-P8810204-PP-01)' } }
  : row);
const ambiguousAudit = applyAppliesToPropagation({ decisions: ambiguousDecisions, augmentedRows: ambiguousDecisions.map(() => ({})), diagnostics: [], summary: {} }, config);
assert.equal(ambiguousAudit.summary.propagatedApplicationCount, 0);
assert.ok(ambiguousAudit.diagnostics.some((row) => row.code === 'APPLIES_TO_ALL_DIRECTIVE_AMBIGUOUS'));

console.log('navis-tag applies-to-all tests passed');
