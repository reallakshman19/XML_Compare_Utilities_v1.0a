import assert from 'node:assert/strict';
import { createTopologySequentialMergeNodesRequest } from '../tabs/topology-trace-validator/topology-sequential-merge-nodes-request.js';
import {
  assertSequentialMergeNodesImpact,
  createSequentialMergeNodesImpact,
  validateSequentialMergeNodesImpact,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-merge-nodes-impact-preview.js';

const CREATED_AT = '2026-07-29T09:10:00.000Z';
const request = createTopologySequentialMergeNodesRequest({
  canonical: {
    schema: 'CanonicalTopology.v1', canonicalTopologyHash: 'canonical:merge-preview',
    nodes: [
      { id: 'VN-S', position: { x: 0, y: 0, z: 0 }, sourcePaths: ['$.objects[0]'] },
      { id: 'VN-T', position: { x: 5, y: 0, z: 0 }, sourcePaths: ['$.objects[1]'] },
    ], edges: [],
  },
  draft: { schema: 'TopologyEditDraft.v1', topologyEditDraftHash: 'draft:merge-preview' },
  commandAuthority: { authorityId: 'authority:merge-preview' },
  projectDocument: {
    schema: 'ProjectDocument.v1', documentId: 'document:merge-preview',
    slotId: 'baseline', fileName: 'merge-preview.json',
    sourceHash: 'a'.repeat(64), scopedHash: 'b'.repeat(64),
    stagedSchema: 'inputxml-managed-stage/v1', rootShape: 'objects',
    unit: 'MM', verticalAxis: 'Z', coordinateFrame: 'GLOBAL',
    stats: { branchCount: 2, componentCount: 2, scanned: 2, matched: 2, filtered: 0 },
    scope: { wildcard: '', selectedIds: [] }, createdAt: CREATED_AT,
  },
  sourceNodeId: 'VN-S', targetNodeId: 'VN-T', createdAt: CREATED_AT,
});

const blockedTopology = {
  schema: 'SequentialEditableTopologySnapshot.v1',
  authority: { authorityId: 'ssk-authority:1' },
  topologyFingerprint: 'topology:1', geometryFingerprint: 'geometry:1',
  ancestryFingerprint: 'ancestry:1', snapshotFingerprint: 'snapshot:1',
  nodes: [
    {
      nodeId: 'SN-S', position: { x: 0, y: 0, z: 0 }, degree: 2,
      boundaryClass: 'CONNECTED', positionProvenance: 'CONFIRMED_PORT',
      portIds: ['P-S'], incidentComponentIds: ['C-1'],
      incidentGeometryPartIds: ['G-1'], incidentEdgeIds: ['E-DIRECT'],
      committedConnectionIds: ['CON-DIRECT'],
    },
    {
      nodeId: 'SN-T', position: { x: 3, y: 4, z: 0 }, degree: 3,
      boundaryClass: 'REPAIR_BOUNDARY', positionProvenance: 'CONFIRMED_PORT',
      portIds: ['P-T'], incidentComponentIds: ['C-1', 'C-2'],
      incidentGeometryPartIds: ['G-2'], incidentEdgeIds: ['E-DIRECT'],
      committedConnectionIds: ['CON-DIRECT'],
    },
  ],
  components: [
    { componentId: 'C-1', branchId: 'B-1', supportAttachmentIds: ['SUP-1'] },
    { componentId: 'C-2', branchId: 'B-2', supportAttachmentIds: [] },
  ],
  internalEdges: [
    { edgeId: 'E-DIRECT', fromNodeId: 'SN-S', toNodeId: 'SN-T' },
  ],
  committedConnections: [
    { connectionId: 'CON-DIRECT', fromNodeId: 'SN-T', toNodeId: 'SN-S' },
  ],
};

const input = {
  request, sequentialSourceNodeId: 'SN-S', sequentialTargetNodeId: 'SN-T',
};
const preview = createSequentialMergeNodesImpact(blockedTopology, input);
assert.equal(preview.schema, 'SequentialMergeNodesImpactPreview.v1');
assert.equal(preview.impactStatus, 'BLOCKED');
assert.equal(preview.separationMm, 5);
assert.deepEqual(preview.displacement, { x: 3, y: 4, z: 0 });
assert.deepEqual(preview.affected.componentIds, ['C-1', 'C-2']);
assert.deepEqual(preview.affected.supportAttachmentIds, ['SUP-1']);
assert.deepEqual(preview.blockers.map((row) => row.code), [
  'COMMITTED_CONNECTION_COLLAPSE',
  'INTERNAL_EDGE_COLLAPSE',
  'REPAIR_BOUNDARY',
  'SHARED_COMPONENT_COLLAPSE',
  'SUPPORTED_COMPONENT',
]);
assert.deepEqual(preview.reviewFlags, ['CROSS_BRANCH_IMPACT', 'MIXED_BOUNDARY_CLASS']);
assert.equal(preview.publicationState, 'NOT_PUBLISHED');
assert.equal(preview.applicationDisposition, 'REQUIRES_QUALIFIED_STRUCTURAL_JOURNAL');
assert.equal(assertSequentialMergeNodesImpact(preview), preview);
assert.deepEqual(validateSequentialMergeNodesImpact(preview, blockedTopology, input), preview);

const cleanTopology = {
  ...blockedTopology,
  authority: { authorityId: 'ssk-authority:2' },
  topologyFingerprint: 'topology:2', geometryFingerprint: 'geometry:2',
  ancestryFingerprint: 'ancestry:2', snapshotFingerprint: 'snapshot:2',
  nodes: [
    { ...blockedTopology.nodes[0], nodeId: 'SN-A', incidentComponentIds: ['C-3'],
      incidentEdgeIds: [], committedConnectionIds: [], boundaryClass: 'CONNECTED' },
    { ...blockedTopology.nodes[1], nodeId: 'SN-B', incidentComponentIds: ['C-4'],
      incidentEdgeIds: [], committedConnectionIds: [], boundaryClass: 'CONNECTED' },
  ],
  components: [
    { componentId: 'C-3', branchId: 'B-1', supportAttachmentIds: [] },
    { componentId: 'C-4', branchId: 'B-1', supportAttachmentIds: [] },
  ],
  internalEdges: [], committedConnections: [],
};
const reviewable = createSequentialMergeNodesImpact(cleanTopology, {
  request, sequentialSourceNodeId: 'SN-A', sequentialTargetNodeId: 'SN-B',
});
assert.equal(reviewable.impactStatus, 'REVIEWABLE');
assert.deepEqual(reviewable.blockers, []);
assert.deepEqual(reviewable.reviewFlags, []);

assert.throws(() => createSequentialMergeNodesImpact(cleanTopology, {
  request, sequentialTargetNodeId: 'SN-B',
}), (error) => error.code === 'SEQUENTIAL_MERGE_NODES_EXPLICIT_IDENTITY_REQUIRED');
assert.throws(() => createSequentialMergeNodesImpact(cleanTopology, {
  request, sequentialSourceNodeId: 'SN-A', sequentialTargetNodeId: 'SN-A',
}), (error) => error.code === 'SEQUENTIAL_MERGE_NODES_SAME_NODE');

const tampered = JSON.parse(JSON.stringify(request));
tampered.sourceCommand.payload.sourceNodeId = 'ALTERED';
assert.throws(() => createSequentialMergeNodesImpact(cleanTopology, {
  request: tampered, sequentialSourceNodeId: 'SN-A', sequentialTargetNodeId: 'SN-B',
}), (error) => error.code === 'SEQUENTIAL_MERGE_NODES_REQUEST_INVALID');

console.log('[PASS] MERGE_NODES impact aggregation, blockers, explicit identity and regeneration');
