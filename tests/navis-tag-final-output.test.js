import assert from 'node:assert/strict';
import {
  ALTERNATE_MATCH_COLUMN,
  buildFinalOutputRows,
  expandTagKeywords,
  keywordMappingRows,
  selectOutputSupportIdentity,
  UNMATCHED_NAVIS_TAG_LOCATION_MESSAGE,
} from '../tabs/navis-tag-isonote/navis-tag-final-output.js';
import { _test as workflowTest } from '../tabs/navis-tag-isonote/navis-tag-isonote-ui-workflow.js';
import { _test as tabTest } from '../tabs/navis-tag-isonote/navis-tag-isonote-tab.js';

const sourcePosition = { x: 100, y: 200, z: 1000 };
const directDecision = {
  tableRowId: 'D1', tableRowIndex: 1, canonicalIdentity: 'PS-12244/SREF',
  groupedIdentities: ['/PS-12244/SREF', '/PS-12244/DATUM', '/PS-12244.1'],
  tableIdentityRaw: '/PS-12244/SREF|/PS-12244/DATUM|/PS-12244.1',
  resolvedPipe: '/ASIM-1885-6"-CURRENT-31441C4-PP-01',
  supportPosition: { x: 100, y: 200, z: 1000 }, selectedTagId: '8',
  selectedEvidenceId: 'view-8:tag-8', selectedViewGuid: 'view-8', selectedCommentId: '8',
  selectedNavisPosition: sourcePosition, selectedAnchorBasis: 'Tag 8 ↔ /PS-12244/DATUM',
  selectedCandidate: {
    evidenceId: 'view-8:tag-8', viewGuid: 'view-8', tagId: '8', commentId: '8',
    commentBody: 'R+G+LS (applies to /ASIM-1885-8"-P8810204-31441C4-PP-01).',
    tagPosition: sourcePosition, anchorBasisLabel: 'Tag 8 ↔ /PS-12244/DATUM', score: 94,
    normalizedGeometryRms: 0.1, spatialDistanceMm: 10,
  },
  appliesToDirective: { note: 'R+G+LS', targets: ['/ASIM-1885-8"-P8810204-31441C4-PP-01'] },
  directSupportIsonote: 'R+G+LS', propagatedIsonotes: [], propagatedFromTagIds: [], confidence: 'HIGH', confidenceScore: 94,
  status: 'RESOLVED',
};
const targetDecision = {
  tableRowId: 'T1', tableRowIndex: 2, canonicalIdentity: 'PS-12123.13',
  groupedIdentities: ['/PS-12123.13', '/PS-12123.1', '/PS-12123.2', '/PS-12123.6'],
  tableIdentityRaw: '/PS-12123.13|/PS-12123.1|/PS-12123.2|/PS-12123.6',
  resolvedPipe: '/ASIM-1885-8"-P8810204-31441C4-PP-01',
  supportPosition: { x: 450, y: 200, z: 1500 }, directSupportIsonote: '',
  propagatedIsonotes: [{ sourceTagId: '8', sourceTableRowId: 'D1', baseIsonote: 'R+G+LS', note: 'R+G+LS (Based on Tag 8)' }],
  propagatedFromTagIds: ['8'], confidence: 'UNRESOLVED', status: 'UNRESOLVED',
};
const audit = {
  config: {}, decisions: [directDecision, targetDecision], candidateLedger: [],
  propagationLedger: [{
    sourceTableRowId: 'D1', sourceTagId: '8', sourcePosition, targetTableRowId: 'T1', applied: true,
    pipeMatchBasis: 'FULL_PIPE_NAME_EXACT', sourceAxis: 'N-S', targetPipeAxis: 'N-S',
    alongAxisDeltaMm: 0, parallelOffsetMm: 350, elevationDeltaMm: 500,
  }],
};
const navisParse = {
  tags: [
    { evidenceId: 'view-8:tag-8', viewGuid: 'view-8', tagId: '8', commentId: '8', commentBody: 'R+G+LS (applies to /ASIM-1885-8"-P8810204-31441C4-PP-01).', position: sourcePosition },
    { evidenceId: 'view-9:tag-9', viewGuid: 'view-9', tagId: '9', commentId: '9', commentBody: 'G+LS', position: { x: 900, y: 800, z: 1700 } },
  ],
};

assert.equal(selectOutputSupportIdentity(directDecision), '/PS-12244/DATUM');
assert.equal(selectOutputSupportIdentity(targetDecision), '/PS-12123.1');
assert.deepEqual(expandTagKeywords('R+G+LS'), ['REST', 'GUIDE', 'LINE STOP']);
assert.deepEqual(keywordMappingRows({}).map((row) => row.key), ['R', 'G', 'LS']);

const rows = buildFinalOutputRows(audit);
assert.equal(rows.length, 2);
assert.deepEqual(Object.keys(rows[0]), [
  'Name of the element', 'PIPE', 'POS', 'Navis Tag ID', 'Navis Tag POS', 'Tag',
  'Support ISONOTE', 'confidence', 'Anchor pair basis', ALTERNATE_MATCH_COLUMN, 'Basis',
]);
assert.equal(rows[0]['Name of the element'], '/PS-12244/DATUM');
assert.equal(rows[0].Tag, 'R+G+LS');
assert.equal(rows[0]['Support ISONOTE'], ':/PS-12244/DATUM REST, GUIDE, LINE STOP (C=H)');
assert.equal(rows[0]['Navis Tag ID'], '8');
assert.equal(rows[0]['Anchor pair basis'], 'Tag 8 ↔ /PS-12244/DATUM');
assert.equal(rows[0][ALTERNATE_MATCH_COLUMN], '');
assert.match(rows[0].Basis, /DIRECT_TAG_PROXIMITY/);

assert.equal(rows[1]['Name of the element'], '/PS-12123.1');
assert.equal(rows[1].Tag, 'R+G+LS');
assert.equal(rows[1]['Support ISONOTE'], ':/PS-12123.1 REST, GUIDE, LINE STOP (C=H)');
assert.equal(rows[1]['Navis Tag ID'], '8');
assert.equal(rows[1].confidence, 'HIGH');
assert.equal(rows[1]['Anchor pair basis'], 'Tag 8 ↔ /PS-12244/DATUM');
assert.match(rows[1].Basis, /FULL_PIPE_NAME_EXACT/);
assert.match(rows[1].Basis, /OFFSET=350mm/);

const rowsWithUnmatched = buildFinalOutputRows(audit, {}, navisParse);
assert.equal(rowsWithUnmatched.length, 3);
const unmatched = rowsWithUnmatched[2];
assert.equal(unmatched['Name of the element'], UNMATCHED_NAVIS_TAG_LOCATION_MESSAGE);
assert.equal(unmatched['Navis Tag ID'], '9');
assert.equal(unmatched['Navis Tag POS'], 'E=900;N=800;EL=1700');
assert.equal(unmatched.Tag, 'G+LS');
assert.equal(unmatched['Support ISONOTE'], '');
assert.equal(unmatched.confidence, 'UNRESOLVED');
assert.equal(unmatched['Anchor pair basis'], '');
assert.equal(unmatched[ALTERNATE_MATCH_COLUMN], '');
assert.match(unmatched.Basis, /NO_PS_MATCH/);
assert.ok(!rowsWithUnmatched.some((row) => row['Navis Tag ID'] === '8' && row['Name of the element'] === UNMATCHED_NAVIS_TAG_LOCATION_MESSAGE));

const duplicateTagDecision = (tableRowId, identity, score, rms, distance) => ({
  tableRowId, tableRowIndex: Number(tableRowId.slice(1)), canonicalIdentity: identity,
  groupedIdentities: [`/${identity}`], tableIdentityRaw: `/${identity}`,
  resolvedPipe: '/PIPE-DIRECT', supportPosition: { x: score, y: 0, z: 0 },
  status: 'RESOLVED', confidence: score >= 90 ? 'HIGH' : 'MEDIUM', confidenceScore: score,
  selectedTagId: '3', selectedEvidenceId: 'view-3:tag-3', selectedViewGuid: 'view-3', selectedCommentId: '3',
  selectedNavisPosition: { x: score, y: 0, z: 0 }, selectedAnchorBasis: 'Tag 23 ↔ /PS-11181/DATUM',
  selectedCandidate: {
    evidenceId: 'view-3:tag-3', viewGuid: 'view-3', tagId: '3', commentId: '3', commentBody: 'R+G',
    tagPosition: { x: score, y: 0, z: 0 }, anchorBasisLabel: 'Tag 23 ↔ /PS-11181/DATUM',
    score, normalizedGeometryRms: rms, spatialDistanceMm: distance,
  },
  directSupportIsonote: 'R+G', propagatedIsonotes: [], propagatedFromTagIds: [],
});
const duplicateRows = buildFinalOutputRows({
  config: {}, candidateLedger: [], propagationLedger: [],
  decisions: [
    duplicateTagDecision('D3', 'PS-11170.5', 78, 0.35, 60),
    duplicateTagDecision('D4', 'PS-11170.8', 96, 0.05, 8),
  ],
});
assert.equal(duplicateRows.length, 1, 'one direct Navis evidence item may own only its highest-score final row');
assert.equal(duplicateRows[0]['Name of the element'], '/PS-11170.8');
assert.equal(duplicateRows[0]['Navis Tag ID'], '3');
assert.match(duplicateRows[0][ALTERNATE_MATCH_COLUMN], /AMBIGUOUS SUPPORT/);
assert.match(duplicateRows[0][ALTERNATE_MATCH_COLUMN], /\/PS-11170\.5/);
assert.ok(!duplicateRows.some((row) => row.confidence === 'NOT_SELECTED'));

const customRows = buildFinalOutputRows(audit, {
  isonoteKeywordMappings: [
    { key: 'R', value: 'RESTRAINT' }, { key: 'G', value: 'GUIDED' }, { key: 'LS', value: 'AXIAL STOP' },
  ],
});
assert.equal(customRows[0]['Support ISONOTE'], ':/PS-12244/DATUM RESTRAINT, GUIDED, AXIAL STOP (C=H)');

const configHtml = workflowTest.renderConfig({
  config: {
    isonoteKeywordMappings: [{ key: 'R', value: 'REST' }], tableIdentityColumns: ['Name of the element'],
    tableReferenceColumns: ['Reference of the element'], tablePipeColumns: ['PIPE'], jsonIdentityPaths: ['attributes.NAME'],
    jsonReferencePaths: ['attributes.REF'], jsonPositionPaths: ['attributes.POSI'], jsonBranchPaths: ['attributes.OWNER'],
    jsonPipePaths: ['attributes.PIPE'], jsonZonePaths: ['attributes.ZONE'], jsonOdPaths: ['attributes.OD'],
    jsonBorePaths: ['attributes.BORE'], boreToOdLookup: {},
  }, status: '',
});
assert.match(configHtml, /DEDICATED CONFIGURATION/);
assert.match(configHtml, /Tag keyword mappings/);
assert.match(configHtml, /data-nti-action="add-keyword"/);
assert.match(configHtml, /Same-station tolerance mm/);

const homeHtml = workflowTest.renderHome({
  tableText: 'Name of the element', navisText: '<exchange/>',
  stagedDocuments: [{ sourceFile: 'managed.json', data: {} }],
  sourceNames: { table: 'supports.csv', navis: 'tags.xml', staged: 'managed.zip' },
  sourceTypes: { table: 'CSV', navis: 'XML', staged: 'ZIP' },
  sessionMeta: { restoredAt: '2026-07-15T18:00:00.000Z' }, inputsDirty: true, status: 'Ready', config: {},
});
assert.match(homeHtml, /Restored from this browser/);
assert.match(homeHtml, /Build evidence/);

const finalHtml = workflowTest.renderFinal({ audit: { finalRows: rows, augmentedRows: [], ambiguousRows: [], rejectedRows: [] } });
assert.match(finalHtml, /Name of the element/);
assert.match(finalHtml, /Navis Tag POS/);
assert.match(finalHtml, /Ambiguous \/ Alternate Match/);
assert.match(finalHtml, /Export final CSV/);

const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => memory.has(key) ? memory.get(key) : null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key),
};
const savedState = {
  tableText: 'Name of the element\tPIPE\tPOS', navisText: '<exchange units="m"/>',
  stagedDocuments: [{ sourceFile: 'managed.json', data: { type: 'SITE' } }],
  tableImport: { kind: 'text', candidates: [], diagnostics: [] },
  sourceNames: { table: 'supports.tsv', navis: 'tags.xml', staged: 'managed.json' },
  sourceTypes: { table: 'TSV', navis: 'XML', staged: 'JSON' },
};
tabTest.saveSession(savedState);
const restoredState = tabTest.createState();
assert.equal(restoredState.tableText, savedState.tableText);
assert.equal(restoredState.navisText, savedState.navisText);
assert.equal(restoredState.stagedDocuments.length, 1);
assert.equal(restoredState.sourceNames.navis, 'tags.xml');
assert.ok(restoredState.sessionMeta.restoredAt);

console.log('navis-tag consolidated final output and workflow UI tests passed');
