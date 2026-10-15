import assert from 'node:assert/strict';
import { normalizeConfig } from '../tabs/navis-tag-isonote/navis-tag-isonote-contracts.js';
import { parseSupportTableText, buildSupportTableRecords } from '../tabs/navis-tag-isonote/navis-tag-table-source.js';
import { buildStagedJsonHierarchy, buildStagedSupportIndex } from '../tabs/navis-tag-isonote/navis-tag-staged-tree.js';

const separateTable = parseSupportTableText(`TAG\tE\tN\tEL
PS-900.1\t151.763923\t125.051844\t101.634463`);
const separateBuild = buildSupportTableRecords(separateTable, {
  tableIdentityColumns: ['TAG'],
  tablePositionMode: 'separate',
  tableEastingColumn: 'E',
  tableNorthingColumn: 'N',
  tableElevationColumn: 'EL',
  tableUnits: 'm',
});
assert.equal(separateBuild.records[0].positionColumn, 'E|N|EL');
assert.ok(Math.abs(separateBuild.records[0].position.x - 151763.923) < 0.001);
assert.ok(Math.abs(separateBuild.records[0].position.y - 125051.844) < 0.001);
assert.ok(Math.abs(separateBuild.records[0].position.z - 101634.463) < 0.001);

const staged = {
  type: 'ZONE',
  name: 'Z-1',
  children: [{
    type: 'PIPE',
    name: 'PIPE-1',
    children: [{
      type: 'BRANCH',
      name: 'PIPE-1/B1',
      children: [{
        type: 'SUPPORT',
        attributes: {
          TAG: 'PS-900.1',
          ALT_COORD: '151763.923 125051.844 101634.463',
          BORE: 80,
        },
      }],
    }],
  }],
};
const baseConfig = {
  jsonIdentityPaths: ['attributes.TAG'],
  jsonPositionPaths: ['attributes.MISSING', 'attributes.ALT_COORD'],
  jsonBorePaths: ['attributes.BORE'],
  jsonOdPaths: ['attributes.OD'],
  jsonUnits: 'mm',
  jsonBoreUnits: 'mm',
};
const tree = buildStagedJsonHierarchy([{ sourceFile: 'source.json', data: staged }], baseConfig);
const index = buildStagedSupportIndex(tree, baseConfig);
assert.equal(index.entries.length, 1);
assert.equal(index.entries[0].positionPath, 'attributes.ALT_COORD');
assert.equal(index.entries[0].boreNominalMm, 80);
assert.equal(index.entries[0].odMm, null, 'bore must not implicitly become OD');
assert.equal(index.entries[0].odSource, 'NONE');

const lookupConfig = normalizeConfig({
  ...baseConfig,
  boreToOdLookupEnabled: true,
  boreToOdLookupName: 'explicit-test-profile',
  boreToOdLookup: { '80': 88.9 },
});
const lookupTree = buildStagedJsonHierarchy([{ sourceFile: 'source.json', data: staged }], lookupConfig);
const lookupIndex = buildStagedSupportIndex(lookupTree, lookupConfig);
assert.equal(lookupIndex.entries[0].odMm, 88.9);
assert.equal(lookupIndex.entries[0].odSource, 'CUSTOM_EXPLICIT_BORE_TO_OD_LOOKUP');
assert.equal(lookupIndex.entries[0].odLookupName, 'explicit-test-profile');

console.log('navis-tag-isonote v3 contract tests passed');
