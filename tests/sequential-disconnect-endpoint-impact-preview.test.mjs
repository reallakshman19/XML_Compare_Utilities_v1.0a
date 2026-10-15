import assert from 'node:assert/strict';
import {
  assertSequentialDisconnectEndpointImpact,
  createSequentialDisconnectEndpointImpact,
  validateSequentialDisconnectEndpointImpact,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-disconnect-endpoint-impact-preview.js';
import { sequentialSemanticFingerprint } from '../tabs/sequential-sketcher/scoped-edit/sequential-command-contracts.js';
import { createTopologySequentialDisconnectEndpointRequest } from '../tabs/topology-trace-validator/topology-sequential-disconnect-endpoint-request.js';

const CREATED_AT = '2026-07-29T11:00:00.000Z';
const projectDocument = Object.freeze({ schema: 'ProjectDocument.v1', documentId: 'DOC-DISCONNECT-1',
  slotId: 'candidate', fileName: 'disconnect-source.json', sourceHash: 'a'.repeat(64),
  scopedHash: 'b'.repeat(64), stagedSchema: 'StagedJSON.v1', rootShape: 'ARRAY', unit: 'MM',
  verticalAxis: 'Z', coordinateFrame: 'GLOBAL', stats: { branchCount: 1, componentCount: 1,
    scanned: 1, matched: 1, filtered: 0 }, scope: { wildcard: '*', selectedIds: [] },
  createdAt: CREATED_AT });
const canonical = Object.freeze({ schema: 'CanonicalTopology.v1', canonicalTopologyHash: 'validator-disconnect-1',
  nodes: [{ id: 'VN-1', position: { x: 0, y: 0, z: 0 }, sourcePaths: ['$[0].from'] },
    { id: 'VN-2', position: { x: 100, y: 0, z: 0 }, sourcePaths: ['$[0].to'] }],
  edges: [{ id: 'VE-1', fromNodeId: 'VN-1', toNodeId: 'VN-2', sourcePaths: ['$[0].edge'] }],
  supports: [], rigids: [], junctions: [], boundaries: [] });
const requestInput = Object.freeze({ canonical,
  draft: { schema: 'TopologyEditDraft.v1', topologyEditDraftHash: 'draft-disconnect-1' },
  commandAuthority: { authorityId: 'AUTH-DISCONNECT-1' }, projectDocument,
  edgeId: 'VE-1', endpoint: 'FROM', createdAt: CREATED_AT });
const request = createTopologySequentialDisconnectEndpointRequest(requestInput);

function topology() {
  return { schema: 'SequentialEditableTopologySnapshot.v1', authority: { authorityId: 'SSK-A1' },
    topologyFingerprint: 'tf', geometryFingerprint: 'gf', ancestryFingerprint: 'af', snapshotFingerprint: 'sf',
    nodes: [
      { nodeId: 'N1', position: { x: 0, y: 0, z: 0 }, degree: 2, boundaryClass: 'CONNECTED',
        positionProvenance: 'CONFIRMED_PORT', portIds: ['P1'], incidentComponentIds: ['C1'],
        incidentGeometryPartIds: ['G1'], incidentEdgeIds: ['E1'], committedConnectionIds: ['K1'] },
      { nodeId: 'N2', position: { x: 100, y: 0, z: 0 }, degree: 2, boundaryClass: 'CONNECTED',
        positionProvenance: 'CONFIRMED_PORT', portIds: ['P2'], incidentComponentIds: ['C2'],
        incidentGeometryPartIds: ['G2'], incidentEdgeIds: ['E2'], committedConnectionIds: ['K1'] },
      { nodeId: 'N3', position: { x: 200, y: 0, z: 0 }, degree: 1, boundaryClass: 'OPEN_TERMINAL',
        positionProvenance: 'CONFIRMED_PORT', portIds: ['P3'], incidentComponentIds: ['C3'],
        incidentGeometryPartIds: ['G3'], incidentEdgeIds: ['E3'], committedConnectionIds: [] },
      { nodeId: 'N4', position: { x: 300, y: 0, z: 0 }, degree: 1, boundaryClass: 'INTERNAL_GEOMETRY',
        positionProvenance: 'COMPONENT_GEOMETRY', portIds: [], incidentComponentIds: ['C3'],
        incidentGeometryPartIds: ['G3'], incidentEdgeIds: ['E3'], committedConnectionIds: [] },
    ],
    ports: [
      { portId: 'P1', nodeId: 'N1', componentId: 'C1', branchId: 'B1', role: 'OUTLET', position: { x: 0, y: 0, z: 0 } },
      { portId: 'P2', nodeId: 'N2', componentId: 'C2', branchId: 'B1', role: 'INLET', position: { x: 100, y: 0, z: 0 } },
      { portId: 'P3', nodeId: 'N3', componentId: 'C3', branchId: 'B2', role: 'OUTLET', position: { x: 200, y: 0, z: 0 } },
    ],
    components: [
      { componentId: 'C1', branchId: 'B1', geometryPartIds: ['G1'], internalEdgeIds: ['E1'], supportAttachmentIds: [] },
      { componentId: 'C2', branchId: 'B1', geometryPartIds: ['G2'], internalEdgeIds: ['E2'], supportAttachmentIds: [] },
      { componentId: 'C3', branchId: 'B2', geometryPartIds: ['G3'], internalEdgeIds: ['E3'], supportAttachmentIds: [] },
    ],
    internalEdges: [
      { edgeId: 'E1', componentId: 'C1', geometryPartId: 'G1', order: 0, fromNodeId: 'NX1', toNodeId: 'N1' },
      { edgeId: 'E2', componentId: 'C2', geometryPartId: 'G2', order: 0, fromNodeId: 'N2', toNodeId: 'NX2' },
      { edgeId: 'E3', componentId: 'C3', geometryPartId: 'G3', order: 0, fromNodeId: 'N3', toNodeId: 'N4' },
    ],
    committedConnections: [{ connectionId: 'K1', fromPortId: 'P1', toPortId: 'P2', fromNodeId: 'N1',
      toNodeId: 'N2', nodeRelation: 'CONNECTED_DISTINCT_NODES', status: 'USER_CONFIRMED' }],
    componentBoundaryCuts: [{ boundaryCutId: 'BC1', componentId: 'C1', connectionId: 'K1' },
      { boundaryCutId: 'BC2', componentId: 'C2', connectionId: 'K1' }],
    repairs: [], supportAttachments: [] };
}
const input = { request, sequentialRelationshipKind: 'COMMITTED_CONNECTION',
  sequentialRelationshipId: 'K1', sequentialEndpointNodeId: 'N1', sequentialEndpointPortId: 'P1' };
const preview = createSequentialDisconnectEndpointImpact(topology(), input);
assert.equal(preview.impactStatus, 'REVIEWABLE');
assert.equal(preview.mapping.sequentialRelationshipSide, 'FROM');
assert.equal(preview.relationship.opposite.node.nodeId, 'N2');
assert.equal(preview.relationship.opposite.port.portId, 'P2');
assert.deepEqual(preview.affected.componentIds, ['C1', 'C2']);
assert.deepEqual(preview.affected.boundaryCutIds, ['BC1', 'BC2']);
assert.deepEqual(preview.blockers, []);
assert.ok(preview.reviewFlags.includes('BOUNDARY_CUT_PRESENT'));
assert.equal(preview.currentNativeDisconnectAuthority, 'UNAVAILABLE');
assert.equal(preview.publicationState, 'NOT_PUBLISHED');
assert.equal(Object.isFrozen(preview), true);
assert.equal(validateSequentialDisconnectEndpointImpact(preview, topology(), input).previewFingerprint,
  preview.previewFingerprint);
const internal = createSequentialDisconnectEndpointImpact(topology(), { request,
  sequentialRelationshipKind: 'INTERNAL_EDGE', sequentialRelationshipId: 'E3',
  sequentialEndpointNodeId: 'N3', sequentialEndpointPortId: 'P3' });
assert.equal(internal.impactStatus, 'BLOCKED');
assert.deepEqual(internal.blockers.map((row) => row.code), ['INTERNAL_COMPONENT_FRAGMENTATION']);
assert.equal(internal.relationship.opposite.node.nodeId, 'N4');
assert.equal(internal.relationship.opposite.port, null);
const repairTopology = topology();
repairTopology.committedConnections[0].nodeRelation = 'REPAIR_MEDIATED_CONTINUITY';
repairTopology.repairs = [{ repairId: 'R1', connectionId: 'K1', fromNodeId: 'N1', toNodeId: 'N2' }];
assert.ok(createSequentialDisconnectEndpointImpact(repairTopology, input).blockers
  .some((row) => row.code === 'REPAIR_MEDIATED_CONTINUITY'));
const supportedTopology = topology(); supportedTopology.components[0].supportAttachmentIds = ['S1'];
assert.ok(createSequentialDisconnectEndpointImpact(supportedTopology, input).blockers
  .some((row) => row.code === 'SUPPORTED_COMPONENT'));
assert.throws(() => createSequentialDisconnectEndpointImpact(topology(), { ...input,
  sequentialEndpointPortId: 'P2' }), (error) => error.code === 'SEQUENTIAL_DISCONNECT_ENDPOINT_PORT_NODE_MISMATCH');
assert.throws(() => createSequentialDisconnectEndpointImpact(topology(), { ...input,
  sequentialRelationshipKind: 'UNKNOWN' }), (error) => error.code === 'SEQUENTIAL_DISCONNECT_ENDPOINT_RELATIONSHIP_KIND_INVALID');
const tamperedRequest = { ...request, sourceEdge: { ...request.sourceEdge, edgeId: 'FORGED' } };
assert.throws(() => createSequentialDisconnectEndpointImpact(topology(), { ...input, request: tamperedRequest }),
  (error) => error.code === 'SEQUENTIAL_DISCONNECT_ENDPOINT_REQUEST_INVALID');
const forged = structuredClone(preview); forged.mapping.sequentialEndpointNodeId = 'N2';
const material = { ...forged }; delete material.previewFingerprint;
forged.previewFingerprint = sequentialSemanticFingerprint('SSKDISCONNECTIMPACT', material);
assert.throws(() => assertSequentialDisconnectEndpointImpact(forged),
  (error) => error.code === 'SEQUENTIAL_DISCONNECT_ENDPOINT_PREVIEW_INVALID');
const forgedInternal = structuredClone(internal); forgedInternal.endpoint.port.componentId = 'FORGED';
const internalMaterial = { ...forgedInternal }; delete internalMaterial.previewFingerprint;
forgedInternal.previewFingerprint = sequentialSemanticFingerprint('SSKDISCONNECTIMPACT', internalMaterial);
assert.throws(() => assertSequentialDisconnectEndpointImpact(forgedInternal),
  (error) => error.code === 'SEQUENTIAL_DISCONNECT_ENDPOINT_PREVIEW_INVALID');
console.log('[PASS] DISCONNECT_ENDPOINT explicit relationship impact, blockers, tamper and regeneration');
