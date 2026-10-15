import assert from 'node:assert/strict';
import { semanticHash } from '../tabs/topology-trace-validator/topology-validator-values.js';
import {
  assertTopologySequentialDisconnectEndpointRequest,
  createTopologySequentialDisconnectEndpointRequest,
  topologySequentialDisconnectEndpointRequestFileName,
  validateTopologySequentialDisconnectEndpointRequest,
} from '../tabs/topology-trace-validator/topology-sequential-disconnect-endpoint-request.js';

const CREATED_AT = '2026-07-29T11:05:00.000Z';
const projectDocument = Object.freeze({
  schema: 'ProjectDocument.v1', documentId: 'DOC-DISCONNECT-1', slotId: 'candidate',
  fileName: 'disconnect-source.json', sourceHash: 'a'.repeat(64), scopedHash: 'b'.repeat(64),
  stagedSchema: 'StagedJSON.v1', rootShape: 'ARRAY', unit: 'MM',
  verticalAxis: 'Z', coordinateFrame: 'GLOBAL',
  stats: { branchCount: 1, componentCount: 2, scanned: 2, matched: 2, filtered: 0 },
  scope: { wildcard: '*', selectedIds: [] }, createdAt: CREATED_AT,
});
const canonical = Object.freeze({
  schema: 'CanonicalTopology.v1', canonicalTopologyHash: 'canonical-disconnect-1',
  nodes: [
    { id: 'N-FROM', position: { x: 0, y: 0, z: 0 }, sourcePaths: ['$[0].from'] },
    { id: 'N-TO', position: { x: 300, y: 400, z: 0 }, sourcePaths: ['$[0].to'] },
    { id: 'N-OTHER', position: { x: -100, y: 0, z: 0 }, sourcePaths: ['$[0].other'] },
  ],
  edges: [
    { id: 'E-DISCONNECT', fromNodeId: 'N-FROM', toNodeId: 'N-TO', segmentRole: 'ROUTE',
      sourcePaths: ['$[0].edge'], specification: 'P1' },
    { id: 'E-INCIDENT', fromNodeId: 'N-OTHER', toNodeId: 'N-FROM', segmentRole: 'ROUTE',
      sourcePaths: ['$[0].incident'] },
  ],
  supports: [{ id: 'S-1', nodeId: 'N-FROM', tag: 'SUP-1', sourcePaths: ['$[0].support'] }],
  rigids: [{ id: 'R-1', edgeId: 'E-DISCONNECT', nodeIds: ['N-FROM'], sourcePaths: ['$[0].rigid'] }],
  junctions: [{ id: 'J-1', nodeId: 'N-FROM', edgeIds: ['E-DISCONNECT'], sourcePaths: ['$[0].junction'] }],
  boundaries: [{ id: 'B-1', nodeId: 'N-FROM', boundaryClass: 'EXTERNAL', sourcePaths: ['$[0].boundary'] }],
});
const input = Object.freeze({
  canonical,
  draft: { schema: 'TopologyEditDraft.v1', topologyEditDraftHash: 'draft-disconnect-1' },
  commandAuthority: { authorityId: 'AUTH-DISCONNECT-1' },
  projectDocument, edgeId: 'E-DISCONNECT', endpoint: 'FROM', createdAt: CREATED_AT,
});

const request = createTopologySequentialDisconnectEndpointRequest(input);
assert.equal(request.schema, 'TopologySequentialDisconnectEndpointRequest.v1');
assert.deepEqual(request.sourceCommand.payload, { edgeId: 'E-DISCONNECT', endpoint: 'FROM' });
assert.equal(request.selectedEndpoint.nodeId, 'N-FROM');
assert.equal(request.oppositeEndpoint.nodeId, 'N-TO');
assert.deepEqual(request.selectedEndpoint.incidentEdgeIds, ['E-DISCONNECT', 'E-INCIDENT']);
assert.deepEqual(request.selectedEndpoint.sourceBranchIndexes, [0]);
assert.deepEqual(request.selectedEndpoint.context.supports.map((row) => row.id), ['S-1']);
assert.deepEqual(request.selectedEndpoint.context.rigids.map((row) => row.id), ['R-1']);
assert.deepEqual(request.selectedEndpoint.context.junctions.map((row) => row.id), ['J-1']);
assert.deepEqual(request.selectedEndpoint.context.boundaries.map((row) => row.id), ['B-1']);
assert.deepEqual(request.edgeGeometry.displacement, { x: 300, y: 400, z: 0 });
assert.equal(request.edgeGeometry.lengthMm, 500);
assert.deepEqual(request.sequentialIntent.supportedRelationshipKinds,
  ['INTERNAL_EDGE', 'COMMITTED_CONNECTION']);
assert.equal(request.sequentialIntent.currentNativeDisconnectAuthority, 'UNAVAILABLE');
assert.equal(request.sequentialIntent.applicationDisposition,
  'REQUIRES_QUALIFIED_TOPOLOGY_AUTHORITY');
assert.equal(request.sequentialIntent.publicationState, 'NOT_PUBLISHED');
assert.equal(Object.isFrozen(request), true);
assert.equal(validateTopologySequentialDisconnectEndpointRequest(request, input).requestFingerprint,
  request.requestFingerprint);
assert.match(topologySequentialDisconnectEndpointRequestFileName(request, 'model.json'),
  /^model\.E-DISCONNECT\.from\./);

const tamperedMaterial = { ...request, selectedEndpoint: { ...request.selectedEndpoint, endpoint: 'TO' } };
delete tamperedMaterial.requestFingerprint;
const tampered = { ...tamperedMaterial, requestFingerprint: semanticHash(tamperedMaterial) };
assert.throws(() => assertTopologySequentialDisconnectEndpointRequest(tampered),
  (error) => error.code === 'TOPOLOGY_SEQUENTIAL_DISCONNECT_REQUEST_INVALID');
assert.throws(() => createTopologySequentialDisconnectEndpointRequest({ ...input, endpoint: 'SIDE' }),
  (error) => error.code === 'TOPOLOGY_SEQUENTIAL_DISCONNECT_ENDPOINT_INVALID');
assert.throws(() => createTopologySequentialDisconnectEndpointRequest({
  ...input, canonical: { ...canonical, nodes: canonical.nodes.map((node) =>
    node.id === 'N-FROM' ? { ...node, position: { x: null, y: 0, z: 0 } } : node) },
}), (error) => error.code === 'TOPOLOGY_SEQUENTIAL_DISCONNECT_NODE_INVALID');

console.log('[PASS] DISCONNECT_ENDPOINT request role, context, authority, tamper and regeneration');
