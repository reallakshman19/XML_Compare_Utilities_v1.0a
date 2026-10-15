import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  applyAppliesToPropagation,
  extractLineKey,
  inferPipeAxis,
  parseAppliesToDirective,
} from '../tabs/navis-tag-isonote/navis-tag-applies-to.js';
import { resolveNavisTagIsonotes } from '../tabs/navis-tag-isonote/navis-tag-proximity-engine.js';
import { _test as evidenceUiTest } from '../tabs/navis-tag-isonote/navis-tag-isonote-ui-evidence.js';

const appliesToComment = 'R+G+LS (applies to /ASIM-1885-8"-P8810204-31441C4-PP-01, /ASIM-1885-4"-P8810306-31441C4-PP-01).';
const directive = parseAppliesToDirective(appliesToComment);
assert.equal(directive.matched, true);
assert.equal(directive.note, 'R+G+LS');
assert.deepEqual(directive.targets, [
  '/ASIM-1885-8"-P8810204-31441C4-PP-01',
  '/ASIM-1885-4"-P8810306-31441C4-PP-01',
]);
assert.equal(extractLineKey(directive.targets[1]).key, 'P8810306');
assert.equal(extractLineKey('LINE=P8810306', {
  appliesToLineKeyRegex: 'LINE=([A-Z]\\d{7})',
  appliesToLineKeyCaptureGroup: 1,
}).key, 'P8810306');

function spec(rowId, identity, pipe, x, y, z) {
  return { rowId, identity, pipe, point: { x, y, z } };
}
const specs = [
  spec('S1', 'PS-100.1', '/ASIM-1885-6"-CURRENT-31441C4-PP-01', 100, 200, 1000),
  spec('S2', 'PS-100.2', '/ASIM-1885-6"-CURRENT-31441C4-PP-01', 100, 1200, 1000),
  spec('T1', 'PS-200.1', '/ASIM-1885-8"-P8810204-31441C4-PP-01', 450, 200, 1500),
  spec('T2', 'PS-200.2', '/ASIM-1885-8"-P8810204-31441C4-PP-01', 450, 1200, 1500),
  spec('TX1', 'PS-201.1', '/OTHER-8"-P8810204-ALTERNATE', 400, 200, 1500),
  spec('TX2', 'PS-201.2', '/OTHER-8"-P8810204-ALTERNATE', 400, 1200, 1500),
  spec('U1', 'PS-300.1', '/OTHER-4"-P8810306-ALTERNATE', -200, 200, 1600),
  spec('U2', 'PS-300.2', '/OTHER-4"-P8810306-ALTERNATE', -200, 1200, 1600),
  spec('V1', 'PS-400.1', '/ASIM-1885-4"-P9999999-31441C4-PP-01', 100, 300, 1200),
  spec('V2', 'PS-400.2', '/ASIM-1885-4"-P9999999-31441C4-PP-01', 1100, 300, 1200),
];

const records = specs.map((item, index) => ({
  rowId: item.rowId,
  rowIndex: index + 1,
  identity: item.identity,
  identityRaw: item.identity,
  supportRoot: item.identity.split('.')[0],
  inputPipe: item.pipe,
  rawRow: { ID: item.identity },
}));
const traceRows = specs.map((item, index) => ({
  tableRowId: item.rowId,
  tableRowIndex: index + 1,
  tableIdentityRaw: item.identity,
  canonicalIdentity: item.identity,
  status: 'RESOLVED_EXACT_PIPE',
  traceId: `TRACE-${item.rowId}`,
  resolvedPipe: item.pipe,
  position: item.point,
  positionSourcePath: 'attributes.POSI',
  tableRecord: records[index],
}));
const tableBuild = {
  config: { supportCoordinateSource: 'prefer-json-fallback-table' },
  records,
  diagnostics: [],
  summary: {},
};
const identityTrace = {
  config: {},
  rows: traceRows,
  diagnostics: [],
  summary: { resolvedCount: traceRows.length },
};
const navisParse = {
  summary: { tagCount: 1 },
  diagnostics: [],
  tags: [{
    evidenceId: 'view-8:tag-8',
    viewName: 'Tag View 8',
    viewGuid: 'view-8',
    tagId: '8',
    commentId: '8',
    commentBody: appliesToComment,
    commentUser: 'reviewer',
    commentStatus: '',
    commentDate: '',
    position: { x: 100, y: 200, z: 1000 },
    positionSource: 'RLTAG_POS3D',
    diagnostics: [],
  }],
};
const config = {
  eastingToleranceMm: 100,
  northingToleranceMm: 100,
  elevationToleranceMm: 100,
  appliesToParallelOffsetToleranceMm: 500,
  appliesToAlongAxisToleranceMm: 100,
  appliesToElevationToleranceMm: 700,
};
const audit = resolveNavisTagIsonotes(tableBuild, identityTrace, navisParse, config);
const byId = new Map(audit.decisions.map((row) => [row.tableRowId, row]));

assert.equal(inferPipeAxis([byId.get('S1'), byId.get('S2')], navisParse.tags[0].position).axis, 'N-S');
assert.equal(byId.get('S1').supportIsonote, 'R+G+LS');
assert.equal(byId.get('S1').isonoteSource, 'DIRECT');
assert.deepEqual(byId.get('S1').appliesToDirective.targets, directive.targets);
assert.equal(byId.get('T1').supportIsonote, 'R+G+LS (Based on Tag 8)');
assert.equal(byId.get('T1').isonoteSource, 'PROPAGATED');
assert.deepEqual(byId.get('T1').propagatedFromTagIds, ['8']);
assert.equal(byId.get('U1').supportIsonote, 'R+G+LS (Based on Tag 8)');
assert.equal(byId.get('TX1').supportIsonote, '', 'full-name exact match must take precedence over same-key fallback pipes');
assert.equal(byId.get('T2').supportIsonote, '', 'support 1000 mm away along the pipe axis must be rejected');
assert.equal(audit.augmentedRows[specs.findIndex((item) => item.rowId === 'T1')]['ISONOTE Source'], 'PROPAGATED');
assert.equal(audit.summary.appliesToDirectiveCount, 1);
assert.equal(audit.summary.propagatedTargetRowCount, 2);
assert.ok(audit.propagationLedger.some((row) => row.targetTableRowId === 'T1' && row.applied && row.pipeMatchBasis === 'FULL_PIPE_NAME_EXACT'));
assert.ok(audit.propagationLedger.some((row) => row.targetTableRowId === 'U1' && row.applied && row.pipeMatchBasis === 'LINE_KEY_FALLBACK'));
assert.ok(audit.propagationLedger.some((row) => row.targetTableRowId === 'T2' && !row.applied && row.rejectionReasons.includes('ALONG_AXIS_OUTSIDE_TOLERANCE')));

const matchUiRows = evidenceUiTest.matchRows({ identityTrace, audit });
const uiByRow = new Map(matchUiRows.map((row) => [row.resolutionRow, row]));
assert.equal(uiByRow.get(1).isonoteSource, 'DIRECT');
assert.equal(uiByRow.get(3).isonoteSource, 'PROPAGATED');
assert.equal(uiByRow.get(3).displayedNavisRole, 'NEAREST_REJECTED');
assert.equal(uiByRow.get(3).navisTagId, '8');
assert.equal(uiByRow.get(3).propagatedFromTagIds, '8');
assert.equal(uiByRow.get(3).selectedIsonote, 'R+G+LS (Based on Tag 8)');
const propagationUiRows = evidenceUiTest.propagationRows({ audit });
assert.ok(propagationUiRows.some((row) => row.targetTableRowId === 'T1' && row.propagationResult === 'APPLIED' && row.parallelOffset === 350));
assert.ok(propagationUiRows.some((row) => row.targetTableRowId === 'T2' && row.propagationResult === 'REJECTED' && row.rejectionReasonsDisplay.includes('ALONG_AXIS_OUTSIDE_TOLERANCE')));

const nonParallelAudit = applyAppliesToPropagation({
  config,
  decisions: [
    ...audit.decisions.filter((row) => ['S1', 'S2', 'V1', 'V2'].includes(row.tableRowId)).map((row) => ({
      ...row,
      supportIsonote: row.tableRowId === 'S1' ? appliesToComment.replace('/ASIM-1885-8"-P8810204-31441C4-PP-01, /ASIM-1885-4"-P8810306-31441C4-PP-01', '/ASIM-1885-4"-P9999999-31441C4-PP-01') : '',
      selectedCandidate: row.tableRowId === 'S1' ? { ...row.selectedCandidate, commentBody: appliesToComment.replace('/ASIM-1885-8"-P8810204-31441C4-PP-01, /ASIM-1885-4"-P8810306-31441C4-PP-01', '/ASIM-1885-4"-P9999999-31441C4-PP-01') } : null,
      status: row.tableRowId === 'S1' ? 'RESOLVED' : 'UNRESOLVED',
    })),
  ],
  augmentedRows: [{}, {}, {}, {}],
  diagnostics: [],
  summary: {},
}, config);
assert.ok(nonParallelAudit.propagationLedger.some((row) => row.targetTableRowId === 'V1' && row.rejectionReasons.includes('TARGET_PIPE_NOT_PARALLEL')));

const tighterAudit = resolveNavisTagIsonotes(tableBuild, identityTrace, navisParse, {
  ...config,
  appliesToParallelOffsetToleranceMm: 300,
});
assert.equal(new Map(tighterAudit.decisions.map((row) => [row.tableRowId, row])).get('T1').supportIsonote, '', 'the 500 mm cross-pipe window must be configurable');

const uiViewSource = readFileSync('tabs/navis-tag-isonote/navis-tag-isonote-ui-view.js', 'utf8');
const evidenceSource = readFileSync('tabs/navis-tag-isonote/navis-tag-isonote-ui-evidence.js', 'utf8');
assert.match(uiViewSource, /data-nti-config="appliesToDirectiveRegex"/);
assert.match(uiViewSource, /data-nti-config="appliesToLineKeyRegex"/);
assert.match(uiViewSource, /data-nti-config="appliesToParallelOffsetToleranceMm"/);
assert.match(uiViewSource, /data-nti-config="appliesToAlongAxisToleranceMm"/);
assert.match(uiViewSource, /data-nti-config="appliesToElevationToleranceMm"/);
assert.match(uiViewSource, /Pipe lookup preference: normalized full pipe name first/);
assert.match(evidenceSource, /Applies-to pipe propagation/);
assert.match(evidenceSource, /FULL_PIPE_NAME_EXACT|Pipe match basis/);
assert.match(evidenceSource, /propagationRows/);

await import('./navis-tag-applies-to-all.test.js');
console.log('navis-tag applies-to propagation tests passed');
