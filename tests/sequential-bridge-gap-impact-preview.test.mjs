import assert from 'node:assert/strict';
import { createTopologySequentialBridgeGapRequest } from '../tabs/topology-trace-validator/topology-sequential-bridge-gap-request.js';
import {
  assertSequentialBridgeGapImpact,
  createSequentialBridgeGapImpact,
  validateSequentialBridgeGapImpact,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-bridge-gap-impact-preview.js';

const CREATED_AT = '2026-07-29T09:50:00.000Z';
const request = createTopologySequentialBridgeGapRequest({
  canonical: {
    schema: 'CanonicalTopology.v1', canonicalTopologyHash: 'canonical:bridge-preview',
    nodes: [
      { id: 'VN-F', position: { x: 0, y: 0, z: 0 }, sourcePaths: ['$.objects[0]'] },
      { id: 'VN-T', position: { x: 5, y: 0, z: 0 }, sourcePaths: ['$.objects[1]'] },
      { id: 'VN-C1', position: { x: 0, y: 1, z: 0 }, sourcePaths: ['$.objects[0]'] },
      { id: 'VN-C2', position: { x: 1, y: 1, z: 0 }, sourcePaths: ['$.objects[0]'] },
    ],
    edges: [{ id: 'VE-CONTEXT', fromNodeId: 'VN-C1', toNodeId: 'VN-C2',
      sourcePaths: ['$.objects[0]'], componentType: 'PIPE' }],
  },
  draft: { schema: 'TopologyEditDraft.v1', topologyEditDraftHash: 'draft:bridge-preview' },
  commandAuthority: { authorityId: 'authority:bridge-preview' },
  projectDocument: {
    schema: 'ProjectDocument.v1', documentId: 'document:bridge-preview',
    slotId: 'baseline', fileName: 'bridge-preview.json',
    sourceHash: 'a'.repeat(64), scopedHash: 'b'.repeat(64),
    stagedSchema: 'inputxml-managed-stage/v1', rootShape: 'objects',
    unit: 'MM', verticalAxis: 'Z', coordinateFrame: 'GLOBAL',
    stats: { branchCount: 2, componentCount: 2, scanned: 2, matched: 2, filtered: 0 },
    scope: { wildcard: '', selectedIds: [] }, createdAt: CREATED_AT,
  },
  fromNodeId: 'VN-F', toNodeId: 'VN-T', contextEdgeId: 'VE-CONTEXT',
  createdAt: CREATED_AT,
});

const blockedTopology = {
  schema: 'SequentialEditableTopologySnapshot.v1',
  authority: { authorityId: 'ssk-authority:1' },
  topologyFingerprint: 'topology:1', geometryFingerprint: 'geometry:1',
  ancestryFingerprint: 'ancestry:1', snapshotFingerprint: 'snapshot:1',
  nodes: [
    {
      nodeId: 'SN-F', position: { x: 0, y: 0, z: 0 }, degree: 2,
      boundaryClass: 'CONNECTED', positionProvenance: 'CONFIRMED_PORT',
      portIds: ['P-F'], incidentComponentIds: ['C-1'],
      incidentGeometryPartIds: ['G-1'], incidentEdgeIds: ['IE-DIRECT'],
      committedConnectionIds: ['CON-DIRECT'],
    },
    {
      nodeId: 'SN-T', position: { x: 3, y: 4, z: 0 }, degree: 2,
      boundaryClass: 'REPAIR_BOUNDARY', positionProvenance: 'CONFIRMED_PORT',
      portIds: ['P-T'], incidentComponentIds: ['C-1', 'C-2'],
      incidentGeometryPartIds: ['G-2'], incidentEdgeIds: ['IE-DIRECT'],
      committedConnectionIds: ['CON-DIRECT'],
    },
  ],
  ports: [
    { portId: 'P-F', nodeId: 'SN-F', componentId: 'C-1', position: { x: 0, y: 0, z: 0 } },
    { portId: 'P-T', nodeId: 'SN-T', componentId: 'C-2', position: { x: 3, y: 4, z: 0 } },
  ],
  components: [
    { componentId: 'C-1', branchId: 'B-1', supportAttachmentIds: ['SUP-1'] },
    { componentId: 'C-2', branchId: 'B-2', supportAttachmentIds: [] },
  ],
  internalEdges: [
    { edgeId: 'IE-DIRECT', fromNodeId: 'SN-F', toNodeId: 'SN-T' },
  ],
  committedConnections: [
    { connectionId: 'CON-DIRECT', fromNodeId: 'SN-F', toNodeId: 'SN-T',
      fromPortId: 'P-F', toPortId: 'P-T' },
  ],
};
const input = {
  request,
  sequentialFromNodeId: 'SN-F', sequentialToNodeId: 'SN-T',
  sequentialFromPortId: 'P-F', sequentialToPortId: 'P-T',
};
const preview = createSequentialBridgeGapImpact(blockedTopology, input);
assert.equal(preview.schema, 'SequentialBridgeGapImpactPreview.v1');
assert.equal(preview.impactStatus, 'BLOCKED');
assert.equal(preview.separationMm, 5);
assert.deepEqual(preview.displacement, { x: 3, y: 4, z: 0 });
assert.deepEqual(preview.affected.componentIds, ['C-1', 'C-2']);
assert.deepEqual(preview.affected.supportAttachmentIds, ['SUP-1']);
assert.deepEqual(preview.blockers.map((row) => row.code), [
  'DIRECT_COMMITTED_CONNECTION_EXISTS',
  'DIRECT_INTERNAL_EDGE_EXISTS',
  'PORT_ALREADY_CONNECTED',
  'REPAIR_BOUNDARY',
  'SAME_COMPONENT_LOOP',
  'SUPPORTED_COMPONENT',
]);
assert.deepEqual(preview.reviewFlags, ['CROSS_BRANCH_IMPACT', 'MIXED_BOUNDARY_CLASS']);
assert.equal(preview.applicationDisposition, 'REQUIRES_QUALIFIED_CONNECTION_AUTHORITY');
assert.equal(preview.candidateNativeOperation, 'MANUAL_CONNECT');
assert.equal(preview.candidateNativeOperationIsDecisionBound, true);
assert.equal(preview.publicationState, 'NOT_PUBLISHED');
assert.equal(assertSequentialBridgeGapImpact(preview), preview);
assert.deepEqual(validateSequentialBridgeGapImpact(preview, blockedTopology, input), preview);

const cleanTopology = {
  ...blockedTopology,
  authority: { authorityId: 'ssk-authority:2' },
  topologyFingerprint: 'topology:2', geometryFingerprint: 'geometry:2',
  ancestryFingerprint: 'ancestry:2', snapshotFingerprint: 'snapshot:2',
  nodes: [
    { ...blockedTopology.nodes[0], nodeId: 'SN-A', portIds: ['P-A'],
      incidentComponentIds: ['C-3'], incidentEdgeIds: [], committedConnectionIds: [],
      boundaryClass: 'OPEN_TERMINAL' },
    { ...blockedTopology.nodes[1], nodeId: 'SN-B', portIds: ['P-B'],
      incidentComponentIds: ['C-4'], incidentEdgeIds: [], committedConnectionIds: [],
      boundaryClass: 'OPEN_TERMINAL' },
  ],
  ports: [
    { portId: 'P-A', nodeId: 'SN-A', componentId: 'C-3', position: { x: 0, y: 0, z: 0 } },
    { portId: 'P-B', nodeId: 'SN-B', componentId: 'C-4', position: { x: 3, y: 4, z: 0 } },
  ],
  components: [
    { componentId: 'C-3', branchId: 'B-1', supportAttachmentIds: [] },
    { componentId: 'C-4', branchId: 'B-1', supportAttachmentIds: [] },
  ],
  internalEdges: [], committedConnections: [],
};
const reviewInput = {
  request,
  sequentialFromNodeId: 'SN-A', sequentialToNodeId: 'SN-B',
  sequentialFromPortId: 'P-A', sequentialToPortId: 'P-B',
};
const reviewable = createSequentialBridgeGapImpact(cleanTopology, reviewInput);
assert.equal(reviewable.impactStatus, 'REVIEWABLE');
assert.deepEqual(reviewable.blockers, []);
assert.deepEqual(reviewable.reviewFlags, []);

assert.throws(() => createSequentialBridgeGapImpact(cleanTopology, {
  ...reviewInput, sequentialFromPortId: '',
}), (error) => error.code === 'SEQUENTIAL_BRIDGE_GAP_EXPLICIT_IDENTITY_REQUIRED');
assert.throws(() => createSequentialBridgeGapImpact(cleanTopology, {
  ...reviewInput, sequentialFromPortId: 'P-B', sequentialToPortId: 'P-A',
}), (error) => error.code === 'SEQUENTIAL_BRIDGE_GAP_PORT_NODE_MISMATCH');
const tampered = JSON.parse(JSON.stringify(request));
tampered.sourceCommand.payload.fromNodeId = 'ALTERED';
assert.throws(() => createSequentialBridgeGapImpact(cleanTopology, {
  ...reviewInput, request: tampered,
}), (error) => error.code === 'SEQUENTIAL_BRIDGE_GAP_REQUEST_INVALID');

console.log('[PASS] BRIDGE_GAP impact, explicit node/port mapping, blockers and regeneration');
