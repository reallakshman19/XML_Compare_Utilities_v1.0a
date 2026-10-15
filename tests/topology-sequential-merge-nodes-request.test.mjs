import assert from 'node:assert/strict';
import {
  assertTopologySequentialMergeNodesRequest,
  createTopologySequentialMergeNodesRequest,
  topologySequentialMergeNodesRequestFileName,
  validateTopologySequentialMergeNodesRequest,
} from '../tabs/topology-trace-validator/topology-sequential-merge-nodes-request.js';

const CREATED_AT = '2026-07-29T08:30:00.000Z';
const canonical = Object.freeze({
  schema: 'CanonicalTopology.v1', canonicalTopologyHash: 'canonical:merge-1',
  nodes: Object.freeze([
    Object.freeze({ id: 'CN-A', position: Object.freeze({ x: 0, y: 0, z: 0 }),
      sourcePaths: Object.freeze(['$.objects[1].children[0]']) }),
    Object.freeze({ id: 'CN-B', position: Object.freeze({ x: 3, y: 4, z: 0 }),
      sourcePaths: Object.freeze(['$.objects[2].children[1]']) }),
  ]),
  edges: Object.freeze([
    Object.freeze({ id: 'CE-A', fromNodeId: 'CN-A', toNodeId: 'CN-X' }),
    Object.freeze({ id: 'CE-B', fromNodeId: 'CN-Y', toNodeId: 'CN-B' }),
  ]),
});
const draft = Object.freeze({ schema: 'TopologyEditDraft.v1', topologyEditDraftHash: 'draft:merge-1' });
const commandAuthority = Object.freeze({ authorityId: 'authority:merge-1' });
const projectDocument = Object.freeze({
  schema: 'ProjectDocument.v1', documentId: 'document:merge-1', slotId: 'baseline', fileName: 'merge.json',
  sourceHash: 'a'.repeat(64), scopedHash: 'b'.repeat(64), stagedSchema: 'inputxml-managed-stage/v1',
  rootShape: 'objects', unit: 'MM', verticalAxis: 'Z', coordinateFrame: 'GLOBAL',
  stats: Object.freeze({ branchCount: 3, componentCount: 6, scanned: 3, matched: 3, filtered: 0 }),
  scope: Object.freeze({ wildcard: '', selectedIds: Object.freeze([]) }), createdAt: CREATED_AT,
});
const input = Object.freeze({ canonical, draft, commandAuthority, projectDocument,
  sourceNodeId: 'CN-A', targetNodeId: 'CN-B', createdAt: CREATED_AT });

const request = createTopologySequentialMergeNodesRequest(input);
assert.equal(request.schema, 'TopologySequentialMergeNodesRequest.v1');
assert.deepEqual(request.sourceCommand.payload, { sourceNodeId: 'CN-A', targetNodeId: 'CN-B' });
assert.deepEqual(request.sourceNodes.map((row) => row.role), ['RETIRED', 'RETAINED']);
assert.deepEqual(request.sourceNodes[0].sourceBranchIndexes, [1]);
assert.deepEqual(request.sourceNodes[1].sourceBranchIndexes, [2]);
assert.deepEqual(request.sourceNodes[0].incidentEdgeIds, ['CE-A']);
assert.deepEqual(request.sourceNodes[1].incidentEdgeIds, ['CE-B']);
assert.equal(request.separationMm, 5);
assert.equal(request.sequentialIntent.requiredOperation, 'MERGE_NODES');
assert.equal(request.sequentialIntent.automaticIdentityMapping, false);
assert.equal(request.sequentialIntent.publicationState, 'NOT_PUBLISHED');
assert.equal(Object.isFrozen(request), true);
assert.equal(assertTopologySequentialMergeNodesRequest(request), request);
assert.deepEqual(validateTopologySequentialMergeNodesRequest(request, input), request);
assert.equal(topologySequentialMergeNodesRequestFileName(request, 'plant.model.json'),
  'plant.model.CN-A-to-CN-B.topology-sequential-merge-nodes-request.v1.json');

assert.throws(() => createTopologySequentialMergeNodesRequest({ ...input, targetNodeId: 'CN-A' }),
  (error) => error.code === 'TOPOLOGY_SEQUENTIAL_MERGE_NODES_SAME_NODE');
const tampered = JSON.parse(JSON.stringify(request));
tampered.sourceNodes[0].role = 'RETAINED';
assert.throws(() => assertTopologySequentialMergeNodesRequest(tampered),
  (error) => error.code === 'TOPOLOGY_SEQUENTIAL_MERGE_NODES_REQUEST_INVALID');
assert.throws(() => validateTopologySequentialMergeNodesRequest(request,
  { ...input, sourceNodeId: 'CN-B', targetNodeId: 'CN-A' }),
(error) => error.code === 'TOPOLOGY_SEQUENTIAL_MERGE_NODES_REQUEST_INVALID');

console.log('[PASS] MERGE_NODES request roles, ancestry, distance, tamper and regeneration');
