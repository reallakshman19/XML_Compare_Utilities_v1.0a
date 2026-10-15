import assert from 'node:assert/strict';
import { buildNavisTagIsonoteReadiness } from '../tabs/navis-tag-isonote/navis-tag-readiness.js';
import { DEFAULT_BORE_TO_OD_PROFILE } from '../tabs/navis-tag-isonote/navis-tag-bore-od-master.js';

const empty = buildNavisTagIsonoteReadiness({
  config: { supportCoordinateSource: 'json-only' },
  tableBuild: { headers: [], records: [] },
  resolutionBuild: { headers: [], records: [], sourceKind: 'STAGED_JSON' },
  tree: { summary: { nodeCount: 0 } }, stagedIndex: { entries: [] },
  identityTrace: { rows: [], summary: {} }, navisParse: { tags: [], summary: {} },
});
assert.equal(empty.status, 'BLOCKED');
assert.equal(empty.canResolve, false);
assert.ok(!empty.blockers.some((item) => item.code === 'TABLE_ROWS_MISSING'));
assert.ok(empty.blockers.some((item) => item.code === 'RESOLUTION_ROWS_MISSING'));
assert.ok(empty.blockers.some((item) => item.code === 'STAGED_JSON_REQUIRED'));
assert.ok(empty.blockers.some((item) => item.code === 'NAVIS_VALID_TAGS_MISSING'));

const tableOnly = buildNavisTagIsonoteReadiness({
  config: { supportCoordinateSource: 'table-only', tablePositionMode: 'single', tablePositionColumn: 'POS' },
  tableBuild: { headers: ['TAG', 'POS'], records: [{ identity: 'PS-1.1', position: { x: 1, y: 2, z: 3 } }] },
  tree: { summary: { nodeCount: 0 } }, stagedIndex: { entries: [] }, identityTrace: { rows: [], summary: {} },
  navisParse: { tags: [{ commentBody: 'Note', position: { x: 1, y: 2, z: 3 } }], summary: { tagCount: 1 } },
});
assert.equal(tableOnly.status, 'READY');
assert.equal(tableOnly.canResolve, true);
assert.equal(tableOnly.summary.stagedJsonRequired, false);

const tableOnlyMissing = buildNavisTagIsonoteReadiness({
  config: { supportCoordinateSource: 'table-only', tablePositionMode: 'single', tablePositionColumn: 'POS' },
  tableBuild: { headers: [], records: [] },
  resolutionBuild: { headers: [], records: [], sourceKind: 'SUPPORT_TABLE' },
  tree: { summary: { nodeCount: 0 } }, stagedIndex: { entries: [] }, identityTrace: { rows: [], summary: {} },
  navisParse: { tags: [{ commentBody: 'Note', position: { x: 1, y: 2, z: 3 } }], summary: { tagCount: 1 } },
});
assert.equal(tableOnlyMissing.canResolve, false);
assert.ok(tableOnlyMissing.blockers.some((item) => item.code === 'TABLE_ROWS_MISSING'));

const stagedOnly = buildNavisTagIsonoteReadiness({
  config: { supportCoordinateSource: 'prefer-table-fallback-json', tablePositionMode: 'single', tablePositionColumn: 'POS' },
  tableBuild: { headers: [], records: [] },
  resolutionBuild: { headers: [], records: [{ identity: 'PS-1.1' }], sourceKind: 'STAGED_JSON' },
  tree: { summary: { nodeCount: 1, branchResolvedNodeCount: 1, pipeResolvedNodeCount: 1, zoneResolvedNodeCount: 1 } },
  stagedIndex: { entries: [{ identity: 'PS-1.1', position: { x: 1, y: 2, z: 3 } }] },
  identityTrace: { rows: [{ position: { x: 1, y: 2, z: 3 }, tableRecord: { position: null } }], summary: { ambiguousCount: 0 } },
  navisParse: { tags: [{ commentBody: 'Note', position: { x: 1, y: 2, z: 3 } }], summary: { tagCount: 1 } },
});
assert.equal(stagedOnly.status, 'READY');
assert.equal(stagedOnly.canResolve, true);
assert.equal(stagedOnly.summary.resolutionSource, 'STAGED_JSON');
assert.equal(stagedOnly.summary.resolutionRowCount, 1);
assert.ok(!stagedOnly.blockers.some((item) => item.code === 'TABLE_ROWS_MISSING'));
assert.ok(!stagedOnly.warnings.some((item) => /TABLE_.*POSITION_COLUMN/.test(item.code)));

const invalidSeparate = buildNavisTagIsonoteReadiness({
  config: {
    supportCoordinateSource: 'table-only',
    tablePositionMode: 'separate',
    tableEastingColumn: 'E',
    tableNorthingColumn: 'N',
    tableElevationColumn: '',
  },
  tableBuild: { headers: ['TAG', 'E', 'N'], records: [{ identity: 'PS-1.1', position: null }] },
  tree: { summary: { nodeCount: 0 } }, stagedIndex: { entries: [] }, identityTrace: { rows: [], summary: {} },
  navisParse: { tags: [{ commentBody: 'Note', position: { x: 1, y: 2, z: 3 } }], summary: { tagCount: 1 } },
});
assert.equal(invalidSeparate.status, 'BLOCKED');
assert.ok(invalidSeparate.blockers.some((item) => item.code === 'TABLE_SEPARATE_POSITION_COLUMNS_INCOMPLETE'));

const partial = buildNavisTagIsonoteReadiness({
  config: { supportCoordinateSource: 'prefer-table-fallback-json', tablePositionMode: 'single', tablePositionColumn: 'POS' },
  tableBuild: { headers: ['TAG', 'POS'], records: [{ identity: 'PS-1.1', position: { x: 1, y: 2, z: 3 } }, { identity: '', position: null }] },
  tree: { summary: { nodeCount: 1, branchResolvedNodeCount: 1, pipeResolvedNodeCount: 1, zoneResolvedNodeCount: 1 } },
  stagedIndex: { entries: [{ position: { x: 1, y: 2, z: 3 } }] },
  identityTrace: { rows: [{ position: { x: 1, y: 2, z: 3 }, tableRecord: { position: null } }], summary: { ambiguousCount: 1 } },
  navisParse: { tags: [{ commentBody: 'Note', position: { x: 1, y: 2, z: 3 } }], summary: { tagCount: 1 } },
});
assert.equal(partial.status, 'READY_WITH_WARNINGS');
assert.ok(partial.warnings.some((item) => item.code === 'TABLE_IDENTITIES_PARTIAL'));
assert.ok(partial.warnings.some((item) => item.code === 'IDENTITY_AMBIGUITIES_PRESENT'));

const builtInLookup = buildNavisTagIsonoteReadiness({
  config: { supportCoordinateSource: 'table-only', tablePositionColumn: 'POS', boreToOdLookupEnabled: true, boreToOdLookup: {}, boreToOdLookupName: '' },
  tableBuild: { headers: ['TAG', 'POS'], records: [{ identity: 'PS-1.1', position: { x: 1, y: 2, z: 3 } }] },
  tree: { summary: { nodeCount: 0 } }, stagedIndex: { entries: [] }, identityTrace: { rows: [], summary: {} },
  navisParse: { tags: [{ commentBody: 'Note', position: { x: 1, y: 2, z: 3 } }], summary: { tagCount: 1 } },
});
assert.equal(builtInLookup.canResolve, true);
assert.equal(builtInLookup.summary.boreToOdBuiltInProfileAvailable, true);
assert.equal(builtInLookup.summary.boreToOdBuiltInProfile.name, DEFAULT_BORE_TO_OD_PROFILE);
assert.ok(!builtInLookup.blockers.some((item) => /BORE_TO_OD_LOOKUP/.test(item.code)));

const invalidLookup = buildNavisTagIsonoteReadiness({
  config: { supportCoordinateSource: 'table-only', tablePositionColumn: 'POS', boreToOdLookupEnabled: true, boreToOdLookup: {}, boreToOdLookupName: 'UNKNOWN_PROFILE' },
  tableBuild: { headers: ['TAG', 'POS'], records: [{ identity: 'PS-1.1', position: { x: 1, y: 2, z: 3 } }] },
  tree: { summary: { nodeCount: 0 } }, stagedIndex: { entries: [] }, identityTrace: { rows: [], summary: {} },
  navisParse: { tags: [{ commentBody: 'Note', position: { x: 1, y: 2, z: 3 } }], summary: { tagCount: 1 } },
});
assert.ok(invalidLookup.blockers.some((item) => item.code === 'BORE_TO_OD_LOOKUP_PROFILE_INVALID'));

console.log('navis-tag-isonote readiness tests passed');
