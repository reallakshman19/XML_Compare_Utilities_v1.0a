import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectSupportWorksheetFromMatrices } from '../tabs/navis-tag-isonote/navis-tag-isonote-ui-io.js';
import { buildNavisTagIsonoteReadiness } from '../tabs/navis-tag-isonote/navis-tag-readiness.js';

const titleThenData = selectSupportWorksheetFromMatrices([
  {
    name: 'Cover',
    matrix: [
      ['ASIM Support Register'],
      ['Revision', 'A'],
    ],
  },
  {
    name: 'Support Data',
    matrix: [
      ['Project: ASIM-1885'],
      [],
      ['Name of the element', 'Reference of the element', 'PIPE', 'Position'],
      ['PS-12123.13', '=1006649732/52074', 'ASIM-1885-4"-W8810126-31441C4-01/B4', 'E 614860.813mm S 1114939.912mm U 1238.148mm'],
      ['PS-12123.5', '=1006649732/54878', 'ASIM-1885-4"-P8810306-31441C4-PP-01/B2', 'E 616110.812mm S 1114939.912mm U 1236.151mm'],
    ],
  },
], {
  identityColumns: ['Name of the element'],
  referenceColumns: ['Reference of the element'],
  pipeColumns: ['PIPE'],
  positionColumn: 'Position',
});
assert.equal(titleThenData.selected.sheetName, 'Support Data');
assert.equal(titleThenData.selected.headerRowNumber, 3);
assert.equal(titleThenData.selected.dataRowCount, 2);
assert.equal(titleThenData.selected.identityValueCount, 2);
assert.equal(titleThenData.selectionMode, 'IDENTITY_HEADER');
assert.ok(titleThenData.diagnostics.some((item) => item.code === 'WORKBOOK_SUPPORT_SHEET_SELECTED'));

const firstSheetCompatible = selectSupportWorksheetFromMatrices([
  {
    name: 'Sheet1',
    matrix: [
      ['Name of the element', 'Position'],
      ['PS-1.1', 'E 1mm N 2mm U 3mm'],
    ],
  },
  {
    name: 'Notes',
    matrix: [['General notes'], ['No support data']],
  },
], { identityColumns: ['Name of the element'], positionColumn: 'Position' });
assert.equal(firstSheetCompatible.selected.sheetName, 'Sheet1');
assert.equal(firstSheetCompatible.selected.headerRowNumber, 1);
assert.equal(firstSheetCompatible.selected.dataRowCount, 1);

const fallback = selectSupportWorksheetFromMatrices([
  { name: 'Empty', matrix: [] },
  { name: 'Unmapped Data', matrix: [['Custom ID', 'Custom POS'], ['PS-2.1', '1 2 3']] },
], { identityColumns: ['Name of the element'] });
assert.equal(fallback.selected.sheetName, 'Unmapped Data');
assert.equal(fallback.selectionMode, 'FALLBACK_NON_EMPTY');
assert.ok(fallback.diagnostics.some((item) => item.code === 'WORKBOOK_SUPPORT_SHEET_FALLBACK'));

const emptyWorkbook = selectSupportWorksheetFromMatrices([
  { name: 'Sheet1', matrix: [] },
  { name: 'Sheet2', matrix: [[], []] },
], { identityColumns: ['Name of the element'] });
assert.equal(emptyWorkbook.selected, null);
assert.equal(emptyWorkbook.selectionMode, 'NONE');
assert.ok(emptyWorkbook.diagnostics.some((item) => item.code === 'WORKBOOK_NO_NONEMPTY_WORKSHEET'));

const workbookFallbackReadiness = buildNavisTagIsonoteReadiness({
  config: { supportCoordinateSource: 'json-only' },
  tableImport: {
    kind: 'workbook',
    selectedSheetName: 'Cover',
    headerRowNumber: 1,
    candidateDataRowCount: 0,
    selectionMode: 'FALLBACK_NON_EMPTY',
    sheetCount: 2,
  },
  tableBuild: { headers: ['ASIM Support Register'], records: [] },
  resolutionBuild: { sourceKind: 'STAGED_JSON', headers: [], records: [{ identity: 'PS-1.1' }] },
  tree: { summary: { nodeCount: 1, branchResolvedNodeCount: 1, pipeResolvedNodeCount: 1, zoneResolvedNodeCount: 1 } },
  stagedIndex: { entries: [{ identity: 'PS-1.1', position: { x: 1, y: 2, z: 3 } }] },
  identityTrace: { rows: [{ position: { x: 1, y: 2, z: 3 }, tableRecord: { position: null } }], summary: {} },
  navisParse: { tags: [{ commentBody: 'R', position: { x: 1, y: 2, z: 3 } }], summary: { tagCount: 1 } },
});
assert.equal(workbookFallbackReadiness.status, 'READY_WITH_WARNINGS');
assert.equal(workbookFallbackReadiness.canResolve, true);
assert.ok(workbookFallbackReadiness.warnings.some((item) => item.code === 'WORKBOOK_SUPPORT_TABLE_ROWS_MISSING_USING_STAGED_JSON'));
assert.ok(!workbookFallbackReadiness.blockers.some((item) => item.code === 'WORKBOOK_SUPPORT_TABLE_ROWS_MISSING'));
assert.equal(workbookFallbackReadiness.summary.selectedSheetName, 'Cover');
assert.equal(workbookFallbackReadiness.summary.workbookSheetCount, 2);
assert.equal(workbookFallbackReadiness.summary.resolutionSource, 'STAGED_JSON');

const tabSource = readFileSync(new URL('../tabs/navis-tag-isonote/navis-tag-isonote-tab.js', import.meta.url), 'utf8');
assert.match(tabSource, /returnMetadata:\s*true/);
assert.match(tabSource, /state\.tableImport\s*=\s*imported\.meta/);
assert.match(tabSource, /resolution rows from/);
assert.match(tabSource, /tableImport:\s*state\.tableImport/);

console.log('navis-tag-isonote workbook ingestion tests passed');
