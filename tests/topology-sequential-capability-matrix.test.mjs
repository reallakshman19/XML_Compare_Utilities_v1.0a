import assert from 'node:assert/strict';

import { TOPOLOGY_NATIVE_TARGET_RESOLVER_TYPES } from '../tabs/topology-trace-validator/topology-scoped-edit-command-targets.js';
import {
  assertTopologySequentialCapabilityMatrix,
  createTopologySequentialCapabilityMatrix,
  topologySequentialCapability,
  topologySequentialReleaseBlockers,
  TOPOLOGY_SEQUENTIAL_CAPABILITY_DISPOSITION,
  TOPOLOGY_SEQUENTIAL_COVERAGE,
  TOPOLOGY_SEQUENTIAL_REQUIRED_COMMANDS,
} from '../tabs/topology-trace-validator/topology-sequential-capability-matrix.js';

const matrix = createTopologySequentialCapabilityMatrix();
const expectedCommands = [...TOPOLOGY_NATIVE_TARGET_RESOLVER_TYPES,
  'ATTRIBUTE_EDIT', 'REMARK_SET'].sort();

assert.equal(matrix.schema, 'TopologySequentialCapabilityMatrix.v1');
assert.deepEqual(matrix.sourceVocabulary, expectedCommands);
assert.deepEqual(TOPOLOGY_SEQUENTIAL_REQUIRED_COMMANDS, expectedCommands);
assert.equal(matrix.entries.length, expectedCommands.length);
assert.equal(matrix.summary.explicitCoverageReady, true);
assert.equal(matrix.summary.validatorPreservationReady, false);
assert.equal(matrix.summary.sequentialParityReady, false);
assert.deepEqual(assertTopologySequentialCapabilityMatrix(matrix), matrix);

const move = topologySequentialCapability(matrix, 'move_node');
assert.equal(move.disposition,
  TOPOLOGY_SEQUENTIAL_CAPABILITY_DISPOSITION.ADAPTED_SEQUENTIAL_OPERATION);
assert.equal(move.coverage, TOPOLOGY_SEQUENTIAL_COVERAGE.PARTIAL);
assert.deepEqual(move.sequentialOperations, ['STRETCH_NODE']);

const split = topologySequentialCapability(matrix, 'SPLIT_EDGE');
assert.equal(split.coverage, TOPOLOGY_SEQUENTIAL_COVERAGE.PARTIAL);
assert.deepEqual(split.sequentialOperations, ['SPLIT_PIPE']);
assert.equal(split.nextGate, 'SSK-TS-3Q');

const bend = topologySequentialCapability(matrix, 'ADD_BEND_DEFINITION');
assert.equal(bend.coverage, TOPOLOGY_SEQUENTIAL_COVERAGE.PRESERVED_SEPARATELY);
assert.equal(bend.disposition,
  TOPOLOGY_SEQUENTIAL_CAPABILITY_DISPOSITION.VALIDATOR_ONLY_OPERATION);
assert.equal(bend.authorityOwner, 'TOPOLOGY_VALIDATOR');
assert.equal(bend.nextGate, 'COMPLETE');
assert.deepEqual(bend.sequentialOperations, []);

const junction = topologySequentialCapability(matrix, 'ADD_JUNCTION_DEFINITION');
assert.equal(junction.coverage, TOPOLOGY_SEQUENTIAL_COVERAGE.PRESERVED_SEPARATELY);
assert.equal(junction.disposition,
  TOPOLOGY_SEQUENTIAL_CAPABILITY_DISPOSITION.VALIDATOR_ONLY_OPERATION);
assert.equal(junction.authorityOwner, 'TOPOLOGY_VALIDATOR');
assert.equal(junction.nextGate, 'COMPLETE');
assert.deepEqual(junction.sequentialOperations, []);

for (const commandType of ['ATTRIBUTE_EDIT', 'REMARK_SET']) {
  const capability = topologySequentialCapability(matrix, commandType);
  assert.equal(capability.coverage, TOPOLOGY_SEQUENTIAL_COVERAGE.PRESERVED_SEPARATELY);
  assert.equal(capability.disposition,
    TOPOLOGY_SEQUENTIAL_CAPABILITY_DISPOSITION.VALIDATOR_ONLY_OPERATION);
}

const blockers = topologySequentialReleaseBlockers(matrix);
assert.deepEqual(blockers.map((row) => row.commandType), [
  'ADD_STRAIGHT_ELEMENT',
  'BRIDGE_GAP',
  'DELETE_EDGE',
  'DISCONNECT_ENDPOINT',
  'MERGE_NODES',
  'MOVE_NODE',
  'SPLIT_EDGE',
  'TRANSACTION',
  'TRIM_EDGE',
]);
assert.equal(matrix.summary.counts.FULL, 0);
assert.equal(matrix.summary.counts.PARTIAL, 4);
assert.equal(matrix.summary.counts.PRESERVED_SEPARATELY, 4);
assert.equal(matrix.summary.counts.MISSING, 5);

assert.throws(() => topologySequentialCapability(matrix, 'UNKNOWN_COMMAND'),
  /not covered/);
assert.throws(() => createTopologySequentialCapabilityMatrix({ entries: matrix.entries.slice(1) }),
  /complete current Topology Edit Draft command vocabulary/);
assert.throws(() => assertTopologySequentialCapabilityMatrix({ ...matrix,
  matrixFingerprint: 'tampered' }), /canonical regeneration/);

console.log('[PASS] bend and junction preservation gates complete in fail-closed capability matrix');
