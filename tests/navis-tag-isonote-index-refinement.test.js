import assert from 'node:assert/strict';
import { parseSupportTableText, buildSupportTableRecords } from '../tabs/navis-tag-isonote/navis-tag-table-source.js';
import { buildStagedJsonHierarchy, buildStagedSupportIndex } from '../tabs/navis-tag-isonote/navis-tag-staged-tree.js';
import { refineStagedSupportIndex } from '../tabs/navis-tag-isonote/navis-tag-index-refinement.js';
import { buildIdentityNodeTrace } from '../tabs/navis-tag-isonote/navis-tag-identity-trace.js';

const staged = {
  type: 'BRANCH',
  name: 'ASIM-1836-2"-A8010850-13421/B1',
  attributes: { OWNER: 'ASIM-1836-2"-A8010850-13421/B1' },
  children: [
    { type: 'SUPPORT', attributes: { STEX: 'PS-14416.2', REF: '=100/1', APOS: '1000 2000 3000', LBORE: 50 } },
    { type: 'SUPPORT', attributes: { STEX: 'PS-14416.2', REF: '=100/2', APOS: '1100 2100 3100', LBORE: 50 } },
  ],
};
const config = {
  tableIdentityColumns: ['TAG'],
  tableReferenceColumns: ['REFCOL'],
  tablePipeColumns: ['PIPE'],
  jsonIdentityPaths: ['attributes.STEX', 'STEX'],
  jsonReferencePaths: ['attributes.REF', 'REF'],
  jsonPositionPaths: ['attributes.APOS', 'APOS'],
  jsonBranchPaths: ['attributes.OWNER'],
  jsonPipePaths: [],
  jsonZonePaths: [],
  jsonOdPaths: [],
  jsonBorePaths: ['attributes.LBORE', 'LBORE'],
  jsonUnits: 'mm',
  supportCoordinateSource: 'json-only',
};
const tree = buildStagedJsonHierarchy([{ sourceFile: 'managed.json', data: staged }], config);
const rawIndex = buildStagedSupportIndex(tree, config);
assert.equal(rawIndex.entries.length, 4, 'parent support nodes and their attribute child mirrors are initially indexed when both path aliases are configured');
const refined = refineStagedSupportIndex(rawIndex, tree, config);
assert.equal(refined.entries.length, 2, 'metadata mirror nodes must be suppressed');
assert.equal(refined.summary.suppressedMirrorEntryCount, 2);
assert.equal(refined.summary.referenceEntryCount, 2);
assert.equal(refined.summary.pipeResolvedEntryCount, 2);
assert.ok(refined.entries.every((entry) => entry.resolvedPipe === 'ASIM-1836-2"-A8010850-13421'));
assert.ok(refined.entries.every((entry) => entry.resolvedPipeBasis === 'DERIVED_FROM_BRANCH'));
assert.ok(refined.entries.every((entry) => entry.odMm == null));
assert.ok(refined.entries.every((entry) => entry.boreNominalMm === 50));

const table = parseSupportTableText(`TAG\tREFCOL\tPIPE
PS-14416.2\t=100/2\tASIM-1836-2"-A8010850-13421`);
const tableBuild = buildSupportTableRecords(table, config);
assert.equal(tableBuild.records[0].inputReference, '=100/2');
const trace = buildIdentityNodeTrace(tableBuild.records, refined, config);
assert.equal(trace.summary.resolvedCount, 1);
assert.equal(trace.summary.referenceResolvedCount, 1);
assert.equal(trace.rows[0].status, 'RESOLVED_EXACT_REFERENCE');
assert.equal(trace.rows[0].selectedReference, '=100/2');
assert.equal(trace.rows[0].selectedReferencePath, 'attributes.REF');
assert.equal(trace.rows[0].position.x, 1100);
assert.equal(trace.rows[0].candidateCount, 2);

console.log('navis-tag-isonote index refinement tests passed');
