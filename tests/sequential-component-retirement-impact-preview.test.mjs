import assert from 'node:assert/strict';
import { createTopologySequentialDeleteEdgeRequest } from '../tabs/topology-trace-validator/topology-sequential-delete-edge-request.js';
import { sequentialSemanticFingerprint } from '../tabs/sequential-sketcher/scoped-edit/sequential-command-contracts.js';
import {
  assertSequentialComponentRetirementImpact,
  createSequentialComponentRetirementImpact,
  parseSequentialComponentRetirementRequestText,
  validateSequentialComponentRetirementImpact,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-component-retirement-impact-preview.js';

const CREATED_AT = '2026-07-29T16:00:00.000Z';
const canonical = { schema: 'CanonicalTopology.v1', canonicalTopologyHash: 'delete-canonical-1',
  nodes: [{ id: 'VE1', position: { x: 0, y: 0, z: 0 }, sourcePaths: ['$[0].from'] },
    { id: 'VE2', position: { x: 10, y: 0, z: 0 }, sourcePaths: ['$[0].to'] }],
  edges: [{ id: 'VALIDATOR-E1', fromNodeId: 'VE1', toNodeId: 'VE2', segmentRole: 'ROUTE',
    componentType: 'PIPE', sourcePaths: ['$[0].edge'] }] };
const request = createTopologySequentialDeleteEdgeRequest({ canonical,
  draft: { schema: 'TopologyEditDraft.v1', topologyEditDraftHash: 'draft-delete-1' },
  commandAuthority: { authorityId: 'AUTH-DELETE-1' },
  projectDocument: { schema: 'ProjectDocument.v1', documentId: 'DOC-DELETE-1', slotId: 'candidate',
    fileName: 'delete.json', sourceHash: 'a'.repeat(64), scopedHash: 'b'.repeat(64),
    stagedSchema: 'StagedJSON.v1', rootShape: 'ARRAY', unit: 'MM', verticalAxis: 'Z',
    coordinateFrame: 'GLOBAL', stats: { branchCount: 1, componentCount: 1, scanned: 1,
      matched: 1, filtered: 0 }, scope: { wildcard: '*', selectedIds: [] }, createdAt: CREATED_AT },
  edgeId: 'VALIDATOR-E1', createdAt: CREATED_AT });
const component = { componentId: 'C1', canonicalType: 'PIPE', branchId: 'B1', routeOrder: 0,
  portIds: ['P1', 'P2'], nodeIds: ['N1', 'N2'], geometryPartIds: ['GP1'],
  geometryKinds: ['segment'], internalEdgeIds: ['IE1'], neighbourComponentIds: [],
  supportAttachmentIds: [], ancestry: { sourceComponentId: 'SRC-C1', sourceIndex: 0,
    sourceBranchId: 'B1', sessionFingerprint: 'session-1',
    confirmedConstructionFingerprint: 'confirmed-1', strokeId: 'STROKE-1',
    strokeOperation: 'DRAW_PIPE', sceneEntityIds: ['GP1'] } };
const part = { geometryPartId: 'GP1', sceneEntityId: 'GP1', componentId: 'C1', role: 'primary',
  geometry: { schema: 'EngineeringGeometry.v1', kind: 'segment',
    start: { x: 0, y: 0, z: 0 }, end: { x: 10, y: 0, z: 0 } },
  nodeIds: ['N1', 'N2'], portIds: ['P1', 'P2'], sourceStrokeId: 'STROKE-1' };
const edge = { edgeId: 'IE1', componentId: 'C1', geometryPartId: 'GP1', order: 0,
  fromNodeId: 'N1', toNodeId: 'N2' };
const nodes = [
  { nodeId: 'N1', position: { x: 0, y: 0, z: 0 }, portIds: ['P1'],
    incidentComponentIds: ['C1'], incidentGeometryPartIds: ['GP1'], incidentEdgeIds: ['IE1'],
    committedConnectionIds: [], degree: 1, boundaryClass: 'OPEN_TERMINAL',
    positionProvenance: 'CONFIRMED_PORT', positionAncestry: [] },
  { nodeId: 'N2', position: { x: 10, y: 0, z: 0 }, portIds: ['P2'],
    incidentComponentIds: ['C1'], incidentGeometryPartIds: ['GP1'], incidentEdgeIds: ['IE1'],
    committedConnectionIds: [], degree: 1, boundaryClass: 'OPEN_TERMINAL',
    positionProvenance: 'CONFIRMED_PORT', positionAncestry: [] },
];
const topology = { schema: 'SequentialEditableTopologySnapshot.v1',
  authority: { authorityId: 'SEQ-AUTH-1' }, branch: { branchId: 'B1', branchIds: ['B1'], state: 'COMPLETE' },
  topologyFingerprint: 'topology-1', geometryFingerprint: 'geometry-1',
  ancestryFingerprint: 'ancestry-1', snapshotFingerprint: 'snapshot-1',
  components: [component], geometryParts: [part], internalEdges: [edge], nodes,
  ports: [{ portId: 'P1', componentId: 'C1', nodeId: 'N1', position: nodes[0].position },
    { portId: 'P2', componentId: 'C1', nodeId: 'N2', position: nodes[1].position }],
  committedConnections: [], supportAttachments: [], componentBoundaryCuts: [], repairs: [],
  selectionGroups: [{ selectionGroupId: 'SG1', componentId: 'C1', geometryPartIds: ['GP1'],
    selectionCandidateIds: ['SC1'], boundaryCutIds: [], eligibilityId: 'EL1' }],
  supportCarriers: [{ carrierId: 'C1', componentId: 'C1', supportAttachmentIds: [] }],
  openBoundaries: [{ boundaryId: 'OB1', nodeId: 'N1', portIds: ['P1'], boundaryClass: 'OPEN_TERMINAL' },
    { boundaryId: 'OB2', nodeId: 'N2', portIds: ['P2'], boundaryClass: 'OPEN_TERMINAL' }] };
const input = { request, sequentialComponentId: 'C1', sequentialGeometryPartId: 'GP1',
  sequentialInternalEdgeId: 'IE1', sequentialBranchId: 'B1' };
const preview = createSequentialComponentRetirementImpact(topology, input);
assert.equal(preview.impactStatus, 'REVIEWABLE');
assert.deepEqual(preview.affected.componentIds, ['C1']);
assert.deepEqual(preview.affected.geometryPartIds, ['GP1']);
assert.deepEqual(preview.affected.internalEdgeIds, ['IE1']);
assert.deepEqual(preview.reviewFlags, ['OPEN_BOUNDARY_RETIREMENT']);
assert.equal(preview.candidateNativeOperation, null);
assert.equal(preview.currentNativeRetirementAuthority, 'UNAVAILABLE');
assert.equal(preview.publicationState, 'NOT_PUBLISHED');
assert.equal(Object.isFrozen(preview), true);
assert.equal(assertSequentialComponentRetirementImpact(preview), preview);
assert.equal(validateSequentialComponentRetirementImpact(preview, topology, input).previewFingerprint,
  preview.previewFingerprint);
assert.equal(parseSequentialComponentRetirementRequestText(JSON.stringify(request)).requestFingerprint,
  request.requestFingerprint);

const blockedTopology = structuredClone(topology);
blockedTopology.components[0].supportAttachmentIds = ['SA1'];
blockedTopology.components[0].neighbourComponentIds = ['C2'];
blockedTopology.nodes[0].incidentComponentIds = ['C1', 'C2'];
blockedTopology.nodes[0].boundaryClass = 'EXTERNAL_BOUNDARY';
blockedTopology.nodes[0].committedConnectionIds = ['CC1', 'CC2'];
blockedTopology.supportAttachments = [{ supportAttachmentId: 'SA1', supportId: 'S1',
  carrierId: 'C1', familyId: 'F1', position: { x: 0, y: 0, z: 0 } }];
blockedTopology.committedConnections = [{ connectionId: 'CC1', fromPortId: 'P1', toPortId: 'P3',
  fromNodeId: 'N1', toNodeId: 'N3', nodeRelation: 'REPAIR_MEDIATED_CONTINUITY' },
  { connectionId: 'CC2', fromPortId: 'P3', toPortId: 'P4', fromNodeId: 'N1', toNodeId: 'N4',
    nodeRelation: 'CONNECTED_DISTINCT_NODES' }];
blockedTopology.componentBoundaryCuts = [{ boundaryCutId: 'BC1', componentId: 'C1',
  connectionId: 'CC1', selectedPortId: 'P1', stationaryPortId: 'P3', stationaryComponentId: 'C2' }];
blockedTopology.selectionGroups[0].boundaryCutIds = ['BC1'];
blockedTopology.supportCarriers[0].supportAttachmentIds = ['SA1'];
blockedTopology.repairs = [{ repairId: 'R1', connectionId: 'CC1', fromNodeId: 'N1', toNodeId: 'N3' }];
const blocked = createSequentialComponentRetirementImpact(blockedTopology, input);
assert.equal(blocked.impactStatus, 'BLOCKED');
assert.deepEqual(blocked.affected.connectionIds, ['CC1', 'CC2']);
assert.deepEqual(blocked.blockers.map((row) => row.code), [
  'BOUNDARY_CUT_PRESENT', 'PROTECTED_EXTERNAL_BOUNDARY', 'REPAIR_MEDIATED_CONTINUITY',
  'SHARED_NODE_DEPENDENCY', 'SUPPORTED_COMPONENT',
]);

function reFingerprint(value) {
  const material = { ...value }; delete material.previewFingerprint;
  value.previewFingerprint = sequentialSemanticFingerprint('SSKCOMPONENTRETIREMENTIMPACT', material);
  return value;
}
const forgedMapping = structuredClone(preview);
forgedMapping.mapping.sequentialComponentId = 'C2';
assert.throws(() => assertSequentialComponentRetirementImpact(reFingerprint(forgedMapping)),
  /immutable structural-retirement/);
const forgedGeometry = structuredClone(preview);
forgedGeometry.wholeComponent.geometryParts[0].geometry.start.x = 2;
assert.throws(() => assertSequentialComponentRetirementImpact(reFingerprint(forgedGeometry)),
  /immutable structural-retirement/);
const forgedAffected = structuredClone(preview);
forgedAffected.affected.internalEdgeIds = ['IE2'];
assert.throws(() => assertSequentialComponentRetirementImpact(reFingerprint(forgedAffected)),
  /immutable structural-retirement/);
const forgedSource = structuredClone(preview);
forgedSource.validatorSource.retirementGeometry.lengthMm = 12;
assert.throws(() => assertSequentialComponentRetirementImpact(reFingerprint(forgedSource)),
  /immutable structural-retirement/);

const forgedRequest = structuredClone(preview);
forgedRequest.validatorRequest.sequentialIntent.publicationState = 'PUBLISHED';
assert.throws(() => assertSequentialComponentRetirementImpact(reFingerprint(forgedRequest)),
  /immutable structural-retirement/);
const forgedSelectionGroup = structuredClone(preview);
forgedSelectionGroup.wholeComponent.selectionGroup.boundaryCutIds = ['BC-X'];
assert.throws(() => assertSequentialComponentRetirementImpact(reFingerprint(forgedSelectionGroup)),
  /immutable structural-retirement/);
const forgedCarrier = structuredClone(blocked);
forgedCarrier.wholeComponent.supportCarrier.supportAttachmentIds = [];
assert.throws(() => assertSequentialComponentRetirementImpact(reFingerprint(forgedCarrier)),
  /immutable structural-retirement/);
const forgedConnections = structuredClone(blocked);
forgedConnections.wholeComponent.committedConnections = [];
forgedConnections.affected.connectionIds = [];
assert.throws(() => assertSequentialComponentRetirementImpact(reFingerprint(forgedConnections)),
  /immutable structural-retirement/);
assert.throws(() => createSequentialComponentRetirementImpact(topology,
  { ...input, sequentialComponentId: '' }), /sequentialComponentId is required/);
console.log('sequential component retirement impact preview tests: PASS');
