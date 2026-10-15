import assert from 'node:assert/strict';
import {
  assertTopologySequentialDeleteEdgeRequest,
  createTopologySequentialDeleteEdgeRequest,
  topologySequentialDeleteEdgeRequestFileName,
  validateTopologySequentialDeleteEdgeRequest,
} from '../tabs/topology-trace-validator/topology-sequential-delete-edge-request.js';
import { semanticHash } from '../tabs/topology-trace-validator/topology-validator-values.js';

const CREATED_AT = '2026-07-29T15:00:00.000Z';
const projectDocument = Object.freeze({ schema: 'ProjectDocument.v1', documentId: 'DOC-DELETE-1',
  slotId: 'candidate', fileName: 'retirement-source.json', sourceHash: 'a'.repeat(64),
  scopedHash: 'b'.repeat(64), stagedSchema: 'StagedJSON.v1', rootShape: 'ARRAY', unit: 'MM',
  verticalAxis: 'Z', coordinateFrame: 'GLOBAL', stats: { branchCount: 1, componentCount: 3,
    scanned: 3, matched: 3, filtered: 0 }, scope: { wildcard: '*', selectedIds: [] },
  createdAt: CREATED_AT });
const canonical = Object.freeze({ schema: 'CanonicalTopology.v1', canonicalTopologyHash: 'delete-topology-1',
  nodes: [
    { id: 'N0', position: { x: -50, y: 0, z: 0 }, sourcePaths: ['$[0].from'] },
    { id: 'N1', position: { x: 0, y: 0, z: 0 }, sourcePaths: ['$[1].from'] },
    { id: 'N2', position: { x: 100, y: 40, z: 0 }, sourcePaths: ['$[1].to'] },
    { id: 'N3', position: { x: 150, y: 40, z: 0 }, sourcePaths: ['$[2].to'] },
  ],
  edges: [
    { id: 'E0', fromNodeId: 'N0', toNodeId: 'N1', segmentRole: 'ROUTE', sourcePaths: ['$[0].edge'] },
    { id: 'E1', fromNodeId: 'N1', toNodeId: 'N2', segmentRole: 'ROUTE',
      sourcePaths: ['$[1].edge'], componentType: 'PIPE' },
    { id: 'E2', fromNodeId: 'N2', toNodeId: 'N3', segmentRole: 'ROUTE', sourcePaths: ['$[2].edge'] },
  ],
  supports: [{ id: 'S1', nodeId: 'N1' }], rigids: [{ id: 'R1', edgeId: 'E1' }],
  junctions: [{ id: 'J1', nodeIds: ['N2'] }], boundaries: [{ id: 'B1', nodeId: 'N2' }],
  bends: [{ id: 'BD1', edgeIds: ['E1'] }], pointFeatures: [{ id: 'PF1', edgeId: 'E1' }] });
const input = Object.freeze({ canonical,
  draft: { schema: 'TopologyEditDraft.v1', topologyEditDraftHash: 'draft-delete-1' },
  commandAuthority: { authorityId: 'AUTH-DELETE-1' }, projectDocument,
  edgeId: 'E1', createdAt: CREATED_AT });

const request = createTopologySequentialDeleteEdgeRequest(input);
assert.equal(request.sourceCommand.type, 'DELETE_EDGE');
assert.equal(request.sourceCommand.payload.edgeId, 'E1');
assert.deepEqual(request.retirementGeometry.displacement, { x: 100, y: 40, z: 0 });
assert.equal(request.retirementGeometry.lengthMm, Math.hypot(100, 40));
assert.deepEqual(request.fromEndpoint.incidentEdgeIds, ['E0', 'E1']);
assert.deepEqual(request.fromEndpoint.otherIncidentEdgeIds, ['E0']);
assert.deepEqual(request.toEndpoint.incidentEdgeIds, ['E1', 'E2']);
assert.deepEqual(request.toEndpoint.otherIncidentEdgeIds, ['E2']);
assert.deepEqual(request.relatedEvidence.rigids.map((row) => row.id), ['R1']);
assert.deepEqual(request.relatedEvidence.bends.map((row) => row.id), ['BD1']);
assert.deepEqual(request.sequentialIntent.requiredExplicitInputs, [
  'sequentialComponentId', 'sequentialGeometryPartId', 'sequentialInternalEdgeId', 'sequentialBranchId',
]);
assert.equal(request.sequentialIntent.candidateNativeOperation, null);
assert.equal(request.sequentialIntent.currentNativeRetirementAuthority, 'UNAVAILABLE');
assert.equal(request.sequentialIntent.retirementQualificationScope, 'WHOLE_COMPONENT_ONLY');
assert.equal(request.sequentialIntent.publicationState, 'NOT_PUBLISHED');
assert.equal(Object.isFrozen(request), true);
assert.equal(validateTopologySequentialDeleteEdgeRequest(request, input).requestFingerprint,
  request.requestFingerprint);
assert.equal(topologySequentialDeleteEdgeRequestFileName(request, 'model.json'),
  'model.E1.topology-sequential-delete-edge-request.v1.json');

const zeroCanonical = { ...canonical, nodes: canonical.nodes.map((row) =>
  row.id === 'N2' ? { ...row, position: { x: 0, y: 0, z: 0 } } : row) };
assert.throws(() => createTopologySequentialDeleteEdgeRequest({ ...input, canonical: zeroCanonical }),
  (error) => error.code === 'TOPOLOGY_SEQUENTIAL_DELETE_EDGE_GEOMETRY_INVALID');
const nullCanonical = { ...canonical, nodes: canonical.nodes.map((row) =>
  row.id === 'N2' ? { ...row, position: { x: null, y: 40, z: 0 } } : row) };
assert.throws(() => createTopologySequentialDeleteEdgeRequest({ ...input, canonical: nullCanonical }),
  (error) => error.code === 'TOPOLOGY_SEQUENTIAL_DELETE_EDGE_NODE_INVALID');

function refingerprint(value) {
  const material = { ...value }; delete material.requestFingerprint;
  value.requestFingerprint = semanticHash(material); return value;
}
const forgedGeometry = structuredClone(request);
forgedGeometry.retirementGeometry.lengthMm += 1; refingerprint(forgedGeometry);
assert.throws(() => assertTopologySequentialDeleteEdgeRequest(forgedGeometry),
  (error) => error.code === 'TOPOLOGY_SEQUENTIAL_DELETE_EDGE_REQUEST_INVALID');
const forgedEndpoint = structuredClone(request);
forgedEndpoint.fromEndpoint.position.x = 5; refingerprint(forgedEndpoint);
assert.throws(() => assertTopologySequentialDeleteEdgeRequest(forgedEndpoint),
  (error) => error.code === 'TOPOLOGY_SEQUENTIAL_DELETE_EDGE_REQUEST_INVALID');
const forgedEdge = structuredClone(request);
forgedEdge.sourceEdge.fromNodeId = 'N2'; refingerprint(forgedEdge);
assert.throws(() => assertTopologySequentialDeleteEdgeRequest(forgedEdge),
  (error) => error.code === 'TOPOLOGY_SEQUENTIAL_DELETE_EDGE_REQUEST_INVALID');
const forgedIncidence = structuredClone(request);
forgedIncidence.fromEndpoint.otherIncidentEdgeIds = []; refingerprint(forgedIncidence);
assert.throws(() => assertTopologySequentialDeleteEdgeRequest(forgedIncidence),
  (error) => error.code === 'TOPOLOGY_SEQUENTIAL_DELETE_EDGE_REQUEST_INVALID');
const forgedSource = structuredClone(request);
forgedSource.sourceEdge.sourcePaths = ['$[9].edge']; refingerprint(forgedSource);
assert.throws(() => assertTopologySequentialDeleteEdgeRequest(forgedSource),
  (error) => error.code === 'TOPOLOGY_SEQUENTIAL_DELETE_EDGE_REQUEST_INVALID');
const forgedIncidentRecord = structuredClone(request);
forgedIncidentRecord.fromEndpoint.incidentEdges[1].segmentRole = 'FORGED';
refingerprint(forgedIncidentRecord);
assert.throws(() => assertTopologySequentialDeleteEdgeRequest(forgedIncidentRecord),
  (error) => error.code === 'TOPOLOGY_SEQUENTIAL_DELETE_EDGE_REQUEST_INVALID');
const forgedRelated = structuredClone(request);
forgedRelated.relatedEvidence.supports.push({ id: 'S9', nodeId: 'N9' }); refingerprint(forgedRelated);
assert.throws(() => assertTopologySequentialDeleteEdgeRequest(forgedRelated),
  (error) => error.code === 'TOPOLOGY_SEQUENTIAL_DELETE_EDGE_REQUEST_INVALID');
console.log('[PASS] DELETE_EDGE retirement geometry, incidence, authority, tamper and regeneration');
