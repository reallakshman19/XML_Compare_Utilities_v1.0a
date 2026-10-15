import assert from 'node:assert/strict';
import {
  assertTopologySequentialMoveNodeRequest,
  createTopologySequentialMoveNodeRequest,
  topologySequentialMoveNodeRequestFileName,
  validateTopologySequentialMoveNodeRequest,
} from '../tabs/topology-trace-validator/topology-sequential-move-node-request.js';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const CREATED_AT = '2026-07-29T07:50:00.000Z';
const canonical = Object.freeze({
  schema: 'CanonicalTopology.v1',
  canonicalTopologyHash: 'canonical:abc123',
  nodes: Object.freeze([Object.freeze({
    id: 'CN-7',
    position: Object.freeze({ x: 10, y: 20, z: 30 }),
    sourcePaths: Object.freeze(['$.objects[2].children[4]', '$.objects[2].children[5]']),
  })]),
});
const draft = Object.freeze({
  schema: 'TopologyEditDraft.v1',
  topologyEditDraftHash: 'draft:def456',
});
const commandAuthority = Object.freeze({ authorityId: 'authority:head-17' });
const projectDocument = Object.freeze({
  schema: 'ProjectDocument.v1',
  documentId: 'document:baseline-1',
  slotId: 'baseline',
  fileName: 'model.json',
  sourceHash: HASH_A,
  scopedHash: HASH_B,
  stagedSchema: 'inputxml-managed-stage/v1',
  rootShape: 'objects',
  unit: 'MM',
  verticalAxis: 'Z',
  coordinateFrame: 'GLOBAL',
  stats: Object.freeze({ branchCount: 3, componentCount: 12, scanned: 3, matched: 3, filtered: 0 }),
  scope: Object.freeze({ wildcard: '', selectedIds: Object.freeze([]) }),
  createdAt: CREATED_AT,
});
const input = Object.freeze({
  canonical,
  draft,
  commandAuthority,
  projectDocument,
  nodeId: 'CN-7',
  targetPosition: Object.freeze({ x: 15, y: 25, z: 35 }),
  createdAt: CREATED_AT,
});

const request = createTopologySequentialMoveNodeRequest(input);
assert.equal(request.schema, 'TopologySequentialMoveNodeRequest.v1');
assert.equal(request.sourceCommand.type, 'MOVE_NODE');
assert.deepEqual(request.sourceCommand.payload.position, { x: 15, y: 25, z: 35 });
assert.deepEqual(request.sourceNode.currentPosition, { x: 10, y: 20, z: 30 });
assert.deepEqual(request.sourceNode.sourceBranchIndexes, [2]);
assert.equal(request.sequentialIntent.requiredOperation, 'STRETCH_NODE');
assert.equal(request.sequentialIntent.automaticIdentityMapping, false);
assert.equal(request.sequentialIntent.publicationState, 'NOT_PUBLISHED');
assert.equal(Object.isFrozen(request), true);
assert.equal(assertTopologySequentialMoveNodeRequest(request), request);
assert.deepEqual(validateTopologySequentialMoveNodeRequest(request, input), request);
assert.equal(topologySequentialMoveNodeRequestFileName(request, 'plant.model.json'),
  'plant.model.CN-7.topology-sequential-move-node-request.v1.json');

assert.throws(() => createTopologySequentialMoveNodeRequest({
  ...input,
  targetPosition: canonical.nodes[0].position,
}), (error) => error.code === 'TOPOLOGY_SEQUENTIAL_MOVE_NODE_NO_CHANGE');

const tampered = JSON.parse(JSON.stringify(request));
tampered.sourceCommand.payload.position.x = 999;
assert.throws(() => assertTopologySequentialMoveNodeRequest(tampered),
  (error) => error.code === 'TOPOLOGY_SEQUENTIAL_MOVE_NODE_REQUEST_INVALID');

assert.throws(() => validateTopologySequentialMoveNodeRequest(request, {
  ...input,
  targetPosition: { x: 16, y: 25, z: 35 },
}), (error) => error.code === 'TOPOLOGY_SEQUENTIAL_MOVE_NODE_REQUEST_INVALID');

console.log('[PASS] MOVE_NODE Sequential request artifact, no-change, tamper, and regeneration');
