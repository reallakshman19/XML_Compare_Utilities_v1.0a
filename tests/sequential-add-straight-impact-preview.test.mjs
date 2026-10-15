import assert from 'node:assert/strict';
import { createTopologySequentialAddStraightRequest } from '../tabs/topology-trace-validator/topology-sequential-add-straight-request.js';
import {
  assertSequentialAddStraightImpact,
  createSequentialAddStraightImpact,
  validateSequentialAddStraightImpact,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-add-straight-impact-preview.js';

const CREATED_AT = '2026-07-29T10:40:00.000Z';
const projectDocument = Object.freeze({
  schema: 'ProjectDocument.v1', documentId: 'DOC-ADD-IMPACT', slotId: 'candidate',
  fileName: 'add-impact.json', sourceHash: 'a'.repeat(64), scopedHash: 'b'.repeat(64),
  stagedSchema: 'StagedJSON.v1', rootShape: 'ARRAY', unit: 'MM',
  verticalAxis: 'Z', coordinateFrame: 'GLOBAL',
  stats: { branchCount: 1, componentCount: 1, scanned: 1, matched: 1, filtered: 0 },
  scope: { wildcard: '*', selectedIds: [] }, createdAt: CREATED_AT,
});
const canonical = Object.freeze({
  schema: 'CanonicalTopology.v1', canonicalTopologyHash: 'canonical-add-impact',
  nodes: [
    { id: 'VN-1', position: { x: 0, y: 0, z: 0 }, sourcePaths: ['$[0].node'] },
    { id: 'VN-C1', position: { x: 0, y: 10, z: 0 }, sourcePaths: ['$[0].edge'] },
    { id: 'VN-C2', position: { x: 10, y: 10, z: 0 }, sourcePaths: ['$[0].edge'] },
  ],
  edges: [{ id: 'VE-1', fromNodeId: 'VN-C1', toNodeId: 'VN-C2',
    sourcePaths: ['$[0].edge'], componentType: 'PIPE' }],
});
const request = createTopologySequentialAddStraightRequest({
  canonical,
  draft: { schema: 'TopologyEditDraft.v1', topologyEditDraftHash: 'draft-add-impact' },
  commandAuthority: { authorityId: 'AUTH-ADD-IMPACT' },
  projectDocument,
  nodeId: 'VN-1', contextEdgeId: 'VE-1',
  targetPosition: { x: 10, y: 0, z: 0 }, createdAt: CREATED_AT,
});
const blockedTopology = {
  schema: 'SequentialEditableTopologySnapshot.v1',
  authority: { authorityId: 'authority:blocked' },
  topologyFingerprint: 'topology:blocked', geometryFingerprint: 'geometry:blocked',
  ancestryFingerprint: 'ancestry:blocked', snapshotFingerprint: 'snapshot:blocked',
  branch: { branchId: 'B1', branchIds: ['B1', 'B2'] },
  nodes: [
    { nodeId: 'SN-1', position: { x: 1, y: 0, z: 0 }, degree: 2,
      boundaryClass: 'REPAIR_BOUNDARY', positionProvenance: 'CONFIRMED_PORT',
      portIds: ['SP-1'], incidentComponentIds: ['C1'], incidentGeometryPartIds: ['G1'],
      incidentEdgeIds: ['E1'], committedConnectionIds: ['CON-1'] },
    { nodeId: 'SN-COLLIDE', position: { x: 10, y: 0, z: 0 }, degree: 0,
      boundaryClass: 'OPEN_TERMINAL', positionProvenance: 'CONFIRMED_PORT',
      portIds: ['SP-2'], incidentComponentIds: ['C2'], incidentGeometryPartIds: ['G2'],
      incidentEdgeIds: [], committedConnectionIds: [] },
  ],
  ports: [
    { portId: 'SP-1', nodeId: 'SN-1', componentId: 'C1', branchId: 'B1', role: 'OUTLET', position: { x: 1, y: 0, z: 0 } },
    { portId: 'SP-2', nodeId: 'SN-COLLIDE', componentId: 'C2', branchId: 'B2', role: 'INLET', position: { x: 10, y: 0, z: 0 } },
  ],
  components: [
    { componentId: 'C1', canonicalType: 'PIPE', branchId: 'B1', supportAttachmentIds: ['SUP-1'] },
    { componentId: 'C2', canonicalType: 'PIPE', branchId: 'B2', supportAttachmentIds: [] },
  ],
  internalEdges: [{ edgeId: 'E1', componentId: 'C1', fromNodeId: 'SN-0', toNodeId: 'SN-1' }],
  committedConnections: [{ connectionId: 'CON-1', fromPortId: 'SP-1', toPortId: 'SP-X', fromNodeId: 'SN-1', toNodeId: 'SN-X' }],
};
const blockedInput = { request, sequentialFromNodeId: 'SN-1', sequentialFromPortId: 'SP-1',
  newComponentCanonicalType: 'PIPE', targetBranchId: 'B2' };
const blocked = createSequentialAddStraightImpact(blockedTopology, blockedInput);
assert.equal(blocked.schema, 'SequentialAddStraightImpactPreview.v1');
assert.equal(blocked.impactStatus, 'BLOCKED');
assert.deepEqual(blocked.proposedSegment.displacement, { x: 9, y: 0, z: 0 });
assert.equal(blocked.proposedSegment.lengthMm, 9);
assert.equal(blocked.sourcePositionOffsetMm, 1);
assert.deepEqual(blocked.affected.componentIds, ['C1']);
assert.deepEqual(blocked.affected.supportAttachmentIds, ['SUP-1']);
assert.deepEqual(blocked.blockers.map((row) => row.code), [
  'PORT_ALREADY_CONNECTED', 'REPAIR_BOUNDARY', 'SUPPORTED_START_COMPONENT',
  'TARGET_BRANCH_DISCONTINUITY', 'TARGET_NODE_COLLISION',
]);
assert.deepEqual(blocked.reviewFlags, ['SOURCE_POSITION_MISMATCH', 'PORT_BRANCH_DIFFERS_FROM_TARGET']);
assert.equal(blocked.applicationDisposition, 'REQUIRES_QUALIFIED_CONSTRUCTION_AUTHORITY');
assert.equal(blocked.currentNativeConstructionAuthority, 'UNAVAILABLE');
assert.equal(blocked.candidateNativeOperation, null);
assert.equal(blocked.publicationState, 'NOT_PUBLISHED');
assert.equal(assertSequentialAddStraightImpact(blocked), blocked);
assert.deepEqual(validateSequentialAddStraightImpact(blocked, blockedTopology, blockedInput), blocked);

const cleanTopology = {
  ...blockedTopology,
  authority: { authorityId: 'authority:clean' },
  topologyFingerprint: 'topology:clean', geometryFingerprint: 'geometry:clean',
  ancestryFingerprint: 'ancestry:clean', snapshotFingerprint: 'snapshot:clean',
  nodes: [{ ...blockedTopology.nodes[0], position: { x: 0, y: 0, z: 0 }, degree: 1,
    boundaryClass: 'OPEN_TERMINAL', incidentEdgeIds: ['E1'], committedConnectionIds: [] }],
  ports: [{ ...blockedTopology.ports[0], position: { x: 0, y: 0, z: 0 } }],
  components: [{ ...blockedTopology.components[0], supportAttachmentIds: [] }],
  committedConnections: [],
};
const cleanInput = { request, sequentialFromNodeId: 'SN-1', sequentialFromPortId: 'SP-1',
  newComponentCanonicalType: 'pipe', targetBranchId: 'B1' };
const reviewable = createSequentialAddStraightImpact(cleanTopology, cleanInput);
assert.equal(reviewable.impactStatus, 'REVIEWABLE');
assert.deepEqual(reviewable.blockers, []);
assert.deepEqual(reviewable.reviewFlags, []);
assert.equal(reviewable.proposedSegment.lengthMm, 10);

assert.throws(() => createSequentialAddStraightImpact(cleanTopology, { ...cleanInput,
  newComponentCanonicalType: 'ELBOW' }), (error) => error.code === 'SEQUENTIAL_ADD_STRAIGHT_TYPE_INVALID');
assert.throws(() => createSequentialAddStraightImpact(cleanTopology, { ...cleanInput,
  targetBranchId: 'MISSING' }), (error) => error.code === 'SEQUENTIAL_ADD_STRAIGHT_BRANCH_MISSING');
assert.throws(() => createSequentialAddStraightImpact(cleanTopology, { ...cleanInput,
  sequentialFromPortId: 'SP-MISSING' }), (error) => error.code === 'SEQUENTIAL_ADD_STRAIGHT_PORT_MISSING');
const mismatched = { ...cleanTopology, ports: [{ ...cleanTopology.ports[0], nodeId: 'OTHER' }] };
assert.throws(() => createSequentialAddStraightImpact(mismatched, cleanInput),
  (error) => error.code === 'SEQUENTIAL_ADD_STRAIGHT_PORT_NODE_MISMATCH');
const tamperedRequest = JSON.parse(JSON.stringify(request));
tamperedRequest.proposedSegment.targetPosition.x = 20;
assert.throws(() => createSequentialAddStraightImpact(cleanTopology, { ...cleanInput, request: tamperedRequest }),
  (error) => error.code === 'SEQUENTIAL_ADD_STRAIGHT_REQUEST_INVALID');

console.log('[PASS] ADD_STRAIGHT impact mapping, geometry, blockers, authority and regeneration');
