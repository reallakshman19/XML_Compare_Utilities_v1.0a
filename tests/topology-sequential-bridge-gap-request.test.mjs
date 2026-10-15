import assert from 'node:assert/strict';
import {
  assertTopologySequentialBridgeGapRequest,
  createTopologySequentialBridgeGapRequest,
  topologySequentialBridgeGapRequestFileName,
  validateTopologySequentialBridgeGapRequest,
} from '../tabs/topology-trace-validator/topology-sequential-bridge-gap-request.js';

const createdAt = '2026-07-29T09:40:00.000Z';
const projectDocument = Object.freeze({
  schema: 'ProjectDocument.v1',
  documentId: 'DOC-1',
  slotId: 'candidate',
  fileName: 'bridge-source.json',
  sourceHash: 'a'.repeat(64),
  scopedHash: 'b'.repeat(64),
  stagedSchema: 'StagedJSON.v1',
  rootShape: 'ARRAY',
  unit: 'MM',
  verticalAxis: 'Z',
  coordinateFrame: 'GLOBAL',
  stats: { branchCount: 2, componentCount: 2, scanned: 2, matched: 2, filtered: 0 },
  scope: { wildcard: '*', selectedIds: [] },
  createdAt,
});
const canonical = Object.freeze({
  schema: 'CanonicalTopology.v1',
  canonicalTopologyHash: 'canonical-bridge-1',
  nodes: Object.freeze([
    { id: 'N-FROM', position: { x: 0, y: 0, z: 0 }, sourcePaths: ['$[0].children[0]'] },
    { id: 'N-TO', position: { x: 300, y: 400, z: 0 }, sourcePaths: ['$[1].children[0]'] },
    { id: 'N-C1', position: { x: -100, y: 0, z: 0 }, sourcePaths: ['$[0].children[0]'] },
    { id: 'N-C2', position: { x: -200, y: 0, z: 0 }, sourcePaths: ['$[0].children[0]'] },
  ]),
  edges: Object.freeze([
    { id: 'E-CONTEXT', fromNodeId: 'N-C1', toNodeId: 'N-C2',
      sourcePaths: ['$[0].children[0]'], componentType: 'PIPE', specification: 'P1' },
  ]),
});
const input = Object.freeze({
  canonical,
  draft: { schema: 'TopologyEditDraft.v1', topologyEditDraftHash: 'draft-bridge-1' },
  commandAuthority: { authorityId: 'AUTH-BRIDGE-1' },
  projectDocument,
  fromNodeId: 'N-FROM',
  toNodeId: 'N-TO',
  contextEdgeId: 'E-CONTEXT',
  createdAt,
});

const request = createTopologySequentialBridgeGapRequest(input);
assert.equal(request.schema, 'TopologySequentialBridgeGapRequest.v1');
assert.equal(request.endpoints[0].role, 'FROM');
assert.equal(request.endpoints[1].role, 'TO');
assert.deepEqual(request.gap.displacement, { x: 300, y: 400, z: 0 });
assert.equal(request.gap.separationMm, 500);
assert.equal(request.contextEdge.edgeId, 'E-CONTEXT');
assert.equal(request.contextEdge.canonicalRecord.specification, 'P1');
assert.deepEqual(request.contextEdge.sourceBranchIndexes, [0]);
assert.equal(request.sequentialIntent.candidateNativeOperation, 'MANUAL_CONNECT');
assert.equal(request.sequentialIntent.candidateNativeOperationIsDecisionBound, true);
assert.equal(request.sequentialIntent.applicationDisposition,
  'REQUIRES_QUALIFIED_CONNECTION_AUTHORITY');
assert.equal(request.sequentialIntent.publicationState, 'NOT_PUBLISHED');
assert.equal(Object.isFrozen(request), true);
assert.equal(validateTopologySequentialBridgeGapRequest(request, input).requestFingerprint,
  request.requestFingerprint);
assert.match(topologySequentialBridgeGapRequestFileName(request, 'model.json'),
  /^model\.N-FROM-to-N-TO\./);

const tampered = { ...request, gap: { ...request.gap, separationMm: 1 } };
assert.throws(() => assertTopologySequentialBridgeGapRequest(tampered),
  (error) => error.code === 'TOPOLOGY_SEQUENTIAL_BRIDGE_GAP_REQUEST_INVALID');
assert.throws(() => createTopologySequentialBridgeGapRequest({ ...input, toNodeId: 'N-FROM' }),
  (error) => error.code === 'TOPOLOGY_SEQUENTIAL_BRIDGE_GAP_SAME_NODE');
const directCanonical = { ...canonical, edges: [...canonical.edges,
  { id: 'E-DIRECT', fromNodeId: 'N-FROM', toNodeId: 'N-TO', sourcePaths: [] }] };
assert.throws(() => createTopologySequentialBridgeGapRequest({ ...input,
  canonical: directCanonical }),
(error) => error.code === 'TOPOLOGY_SEQUENTIAL_BRIDGE_GAP_DIRECT_EDGE_EXISTS');

console.log('[PASS] BRIDGE_GAP request authority, ordering, context, tamper and regeneration');
