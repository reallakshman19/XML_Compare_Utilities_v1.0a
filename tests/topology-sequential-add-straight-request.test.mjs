import assert from 'node:assert/strict';
import {
  assertTopologySequentialAddStraightRequest,
  createTopologySequentialAddStraightRequest,
  topologySequentialAddStraightRequestFileName,
  validateTopologySequentialAddStraightRequest,
} from '../tabs/topology-trace-validator/topology-sequential-add-straight-request.js';

const CREATED_AT = '2026-07-29T10:15:00.000Z';
const projectDocument = Object.freeze({
  schema: 'ProjectDocument.v1', documentId: 'DOC-ADD-1', slotId: 'candidate',
  fileName: 'add-source.json', sourceHash: 'a'.repeat(64), scopedHash: 'b'.repeat(64),
  stagedSchema: 'StagedJSON.v1', rootShape: 'ARRAY', unit: 'MM',
  verticalAxis: 'Z', coordinateFrame: 'GLOBAL',
  stats: { branchCount: 1, componentCount: 1, scanned: 1, matched: 1, filtered: 0 },
  scope: { wildcard: '*', selectedIds: [] }, createdAt: CREATED_AT,
});
const canonical = Object.freeze({
  schema: 'CanonicalTopology.v1', canonicalTopologyHash: 'canonical-add-1',
  nodes: [
    { id: 'N-START', position: { x: 10, y: 20, z: 30 }, sourcePaths: ['$[0].node'] },
    { id: 'N-C1', position: { x: 0, y: 0, z: 0 }, sourcePaths: ['$[0].edge'] },
    { id: 'N-C2', position: { x: 100, y: 0, z: 0 }, sourcePaths: ['$[0].edge'] },
  ],
  edges: [{ id: 'E-CONTEXT', fromNodeId: 'N-C1', toNodeId: 'N-C2',
    sourcePaths: ['$[0].edge'], componentType: 'PIPE', specification: 'P1' }],
});
const input = Object.freeze({
  canonical,
  draft: { schema: 'TopologyEditDraft.v1', topologyEditDraftHash: 'draft-add-1' },
  commandAuthority: { authorityId: 'AUTH-ADD-1' },
  projectDocument,
  nodeId: 'N-START', contextEdgeId: 'E-CONTEXT',
  targetPosition: { x: 13, y: 24, z: 30 }, createdAt: CREATED_AT,
});

const request = createTopologySequentialAddStraightRequest(input);
assert.equal(request.schema, 'TopologySequentialAddStraightRequest.v1');
assert.equal(request.sourceCommand.type, 'ADD_STRAIGHT_ELEMENT');
assert.deepEqual(request.sourceNode.position, { x: 10, y: 20, z: 30 });
assert.deepEqual(request.proposedSegment.targetPosition, { x: 13, y: 24, z: 30 });
assert.deepEqual(request.proposedSegment.displacement, { x: 3, y: 4, z: 0 });
assert.equal(request.proposedSegment.lengthMm, 5);
assert.equal(request.contextEdge.canonicalRecord.specification, 'P1');
assert.deepEqual(request.contextEdge.sourceBranchIndexes, [0]);
assert.equal(request.sequentialIntent.candidateNativeOperation, null);
assert.equal(request.sequentialIntent.currentNativeConstructionAuthority, 'UNAVAILABLE');
assert.equal(request.sequentialIntent.applicationDisposition,
  'REQUIRES_QUALIFIED_CONSTRUCTION_AUTHORITY');
assert.equal(request.sequentialIntent.publicationState, 'NOT_PUBLISHED');
assert.equal(Object.isFrozen(request), true);
assert.equal(validateTopologySequentialAddStraightRequest(request, input).requestFingerprint,
  request.requestFingerprint);
assert.match(topologySequentialAddStraightRequestFileName(request, 'model.json'),
  /^model\.N-START\./);

const tampered = { ...request, proposedSegment: { ...request.proposedSegment, lengthMm: 1 } };
assert.throws(() => assertTopologySequentialAddStraightRequest(tampered),
  (error) => error.code === 'TOPOLOGY_SEQUENTIAL_ADD_STRAIGHT_REQUEST_INVALID');
assert.throws(() => createTopologySequentialAddStraightRequest({
  ...input, targetPosition: { x: 10, y: 20, z: 30 },
}), (error) => error.code === 'TOPOLOGY_SEQUENTIAL_ADD_STRAIGHT_ZERO_LENGTH');

console.log('[PASS] ADD_STRAIGHT_ELEMENT request geometry, authority, tamper and regeneration');
