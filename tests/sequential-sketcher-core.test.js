import assert from 'node:assert/strict';
import { buildBranchInventory, parseStagedJson, selectExactBranch } from '../tabs/sequential-sketcher/sequential-sketcher-source.js';
import { buildBranchTopology } from '../tabs/sequential-sketcher/sequential-sketcher-topology.js';
import { planSequentialTraversal } from '../tabs/sequential-sketcher/sequential-sketcher-traversal.js';

const branchId = '/ASIM-TEST-6"-S0001-CLASS/B2';
const source = [{
  name: branchId, type: 'BRANCH', attributes: {
    NAME: branchId,
    HPOS: { x: 0, y: 0, z: 0 }, HREF: '/UPSTREAM/B1',
    TPOS: { x: 20, y: 10, z: 0 }, TREF: '/DOWNSTREAM/B3',
  },
  children: [
    { name: 'P1', type: 'PIPE', attributes: { APOS: { x: 0, y: 0, z: 0 }, LPOS: { x: 10, y: 0, z: 0 } } },
    { name: 'T1', type: 'TEE', attributes: { NAME: 'T1', APOS: { x: 10, y: 0, z: 0 }, POS: { x: 10, y: 5, z: 0 }, LPOS: { x: 10, y: 10, z: 0 }, CREF: '/SIDE/B9' } },
    { name: 'P2', type: 'PIPE', attributes: { APOS: { x: 10, y: 10, z: 0 }, LPOS: { x: 20, y: 10, z: 0 } } },
    { name: 'SUPPORT PS-1', type: 'SUPPORT', attributes: { NAME: '/PS-1/DATUM', TYPE: 'ATTA', OWNER: branchId, POS: { x: 5, y: 0, z: 0 } } },
  ],
}];

const records = parseStagedJson(JSON.stringify(source));
assert.deepEqual(parseStagedJson(JSON.stringify({
  schema: 'SequentialProjectExport.v2',
  stagedSchema: 'sequential-sketcher-source-array/v1',
  unit: 'MM', coordinateFrame: 'PLANT', verticalAxis: 'Z', branches: source,
})), source, 'metadata envelopes must preserve the authoritative branch records');
assert.throws(() => parseStagedJson(JSON.stringify({ objects: source })), /envelope containing branches/i);
const branch = selectExactBranch(records, branchId);
const inventory = buildBranchInventory(branch);
assert.equal(inventory.routeComponents.length, 3);
assert.equal(inventory.supportRecords.length, 1);
assert.equal(inventory.ignoredRecords.length, 1);
assert.equal(inventory.ignoredRecords[0].recordClass, 'SUPPORT_EVIDENCE');
const topology = buildBranchTopology(inventory, { toleranceMm: 0.001 });
assert.equal(topology.components.length, 3);
assert.equal(topology.inventory.supportRecordCount, 1);
assert.equal(topology.boundaries.length, 3);
assert.equal(topology.boundaries.find((row) => row.role === 'CREF').referenceTarget, '/SIDE/B9');
assert.equal(topology.segments.length, 4, 'tee must split around its explicit POS junction');
assert.equal(topology.supportSummary.familyCount, 0, 'support projection must not execute inside topology construction');
const traversal = planSequentialTraversal(topology);
assert.equal(new Set(traversal.commands.filter((row) => row.op === 'DRAW_SEGMENT').map((row) => row.segmentId)).size, topology.segments.length);
assert.equal(traversal.issues.filter((row) => row.code === 'UNACCOUNTED_COMPONENT').length, 0);
assert.equal(traversal.routeSections.length, 2, 'CREF junction must split the run into two route sections');
assert.equal(traversal.graphClass, 'BRANCHED_GRAPH');
assert.throws(() => selectExactBranch(records, '/MISSING'), /not found/i);
console.log('sequential sketcher core tests passed');
