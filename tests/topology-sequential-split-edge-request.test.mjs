import assert from 'node:assert/strict';
import {
  assertTopologySequentialSplitEdgeRequest,
  createTopologySequentialSplitEdgeRequest,
  topologySequentialSplitEdgeRequestFileName,
  validateTopologySequentialSplitEdgeRequest,
} from '../tabs/topology-trace-validator/topology-sequential-split-edge-request.js';
import { semanticHash } from '../tabs/topology-trace-validator/topology-validator-values.js';

const CREATED_AT = '2026-07-29T12:00:00.000Z';
const projectDocument = Object.freeze({ schema: 'ProjectDocument.v1', documentId: 'DOC-SPLIT-1',
  slotId: 'candidate', fileName: 'split-source.json', sourceHash: 'a'.repeat(64),
  scopedHash: 'b'.repeat(64), stagedSchema: 'StagedJSON.v1', rootShape: 'ARRAY', unit: 'MM',
  verticalAxis: 'Z', coordinateFrame: 'GLOBAL', stats: { branchCount: 1, componentCount: 1,
    scanned: 1, matched: 1, filtered: 0 }, scope: { wildcard: '*', selectedIds: [] },
  createdAt: CREATED_AT });
const canonical = Object.freeze({ schema: 'CanonicalTopology.v1', canonicalTopologyHash: 'split-topology-1',
  nodes: [
    { id: 'N1', position: { x: 0, y: 0, z: 0 }, sourcePaths: ['$[0].from'] },
    { id: 'N2', position: { x: 100, y: 40, z: 0 }, sourcePaths: ['$[0].to'] },
  ],
  edges: [{ id: 'E1', fromNodeId: 'N1', toNodeId: 'N2', segmentRole: 'ROUTE',
    sourcePaths: ['$[0].edge'], componentType: 'PIPE' }],
  supports: [{ id: 'S1', nodeId: 'N1' }], rigids: [{ id: 'R1', edgeId: 'E1' }],
  junctions: [{ id: 'J1', nodeIds: ['N2'] }], boundaries: [{ id: 'B1', nodeId: 'N2' }],
  bends: [{ id: 'BD1', edgeIds: ['E1'] }], pointFeatures: [{ id: 'PF1', edgeId: 'E1' }] });
const input = Object.freeze({ canonical,
  draft: { schema: 'TopologyEditDraft.v1', topologyEditDraftHash: 'draft-split-1' },
  commandAuthority: { authorityId: 'AUTH-SPLIT-1' }, projectDocument,
  edgeId: 'E1', fraction: 0.25, createdAt: CREATED_AT });

const request = createTopologySequentialSplitEdgeRequest(input);
assert.equal(request.sourceCommand.type, 'SPLIT_EDGE');
assert.equal(request.sourceCommand.payload.fraction, 0.25);
assert.deepEqual(request.splitGeometry.displacement, { x: 100, y: 40, z: 0 });
assert.deepEqual(request.splitGeometry.splitPosition, { x: 25, y: 10, z: 0 });
assert.equal(request.splitGeometry.leftLengthMm, request.splitGeometry.lengthMm * 0.25);
assert.equal(request.splitGeometry.rightLengthMm, request.splitGeometry.lengthMm * 0.75);
assert.deepEqual(request.relatedEvidence.rigids.map((row) => row.id), ['R1']);
assert.deepEqual(request.relatedEvidence.bends.map((row) => row.id), ['BD1']);
assert.deepEqual(request.sequentialIntent.requiredExplicitInputs, [
  'sequentialComponentId', 'sequentialGeometryPartId', 'sequentialInternalEdgeId', 'sequentialBranchId',
]);
assert.equal(request.sequentialIntent.candidateNativeOperation, 'SPLIT_PIPE');
assert.equal(request.sequentialIntent.candidateNativeOperationIsBounded, true);
assert.equal(request.sequentialIntent.publicationState, 'NOT_PUBLISHED');
assert.equal(Object.isFrozen(request), true);
assert.equal(validateTopologySequentialSplitEdgeRequest(request, input).requestFingerprint,
  request.requestFingerprint);
assert.equal(topologySequentialSplitEdgeRequestFileName(request, 'model.json'),
  'model.E1.topology-sequential-split-edge-request.v1.json');
for (const fraction of [0, 1, -0.1, 1.1, null, '', Number.NaN]) {
  assert.throws(() => createTopologySequentialSplitEdgeRequest({ ...input, fraction }),
    (error) => error.code === 'TOPOLOGY_SEQUENTIAL_SPLIT_EDGE_FRACTION_INVALID');
}
const zeroCanonical = { ...canonical, nodes: [canonical.nodes[0],
  { ...canonical.nodes[1], position: { x: 0, y: 0, z: 0 } }] };
assert.throws(() => createTopologySequentialSplitEdgeRequest({ ...input, canonical: zeroCanonical }),
  (error) => error.code === 'TOPOLOGY_SEQUENTIAL_SPLIT_EDGE_GEOMETRY_INVALID');
const forged = structuredClone(request);
forged.splitGeometry.splitPosition.x = 26;
const material = { ...forged }; delete material.requestFingerprint;
forged.requestFingerprint = semanticHash(material);
assert.throws(() => assertTopologySequentialSplitEdgeRequest(forged),
  (error) => error.code === 'TOPOLOGY_SEQUENTIAL_SPLIT_EDGE_REQUEST_INVALID');
const forgedFraction = structuredClone(request);
forgedFraction.sourceCommand.payload.fraction = 0.5;
const material2 = { ...forgedFraction }; delete material2.requestFingerprint;
forgedFraction.requestFingerprint = semanticHash(material2);
assert.throws(() => assertTopologySequentialSplitEdgeRequest(forgedFraction),
  (error) => error.code === 'TOPOLOGY_SEQUENTIAL_SPLIT_EDGE_REQUEST_INVALID');
console.log('[PASS] SPLIT_EDGE geometry, authority, limits, tamper and regeneration');
