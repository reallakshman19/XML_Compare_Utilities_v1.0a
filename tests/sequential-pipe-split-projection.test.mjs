import assert from 'node:assert/strict';
import { createEngineeringScene } from '../core/engineering-scene/index.js';
import { createSequentialPipeSplitDraftStore } from '../tabs/sequential-sketcher/scoped-edit/sequential-pipe-split-draft.js';
import { createSequentialPipeSplitReplacement } from '../tabs/sequential-sketcher/scoped-edit/sequential-pipe-split-identities.js';
import { appendSequentialTopologyEdit,
  createSequentialTopologyEditJournal } from '../tabs/sequential-sketcher/scoped-edit/sequential-topology-edit-journal.js';
import { applySequentialTopologyEditJournalToScene,
  applySequentialTopologyEditJournalToTopology,
  SEQUENTIAL_TOPOLOGY_EDIT_PROJECTION_REJECTION } from '../tabs/sequential-sketcher/scoped-edit/sequential-topology-edit-projection.js';

const p = (x) => ({ x, y: 0, z: 0 });
const parent = { componentId: 'P', canonicalType: 'PIPE', branchId: '/SPLIT/PROJECTION',
  routeOrder: 1, portIds: ['PA', 'PB'], nodeIds: ['NA', 'NB'], geometryPartIds: ['G'],
  geometryKinds: ['segment'], internalEdgeIds: ['E'], neighbourComponentIds: ['C'],
  supportAttachmentIds: [], ancestry: { strokeId: 'SP', sourceComponentId: 'SRC-P',
    sourceIndex: 0, sourceBranchId: '/SPLIT/PROJECTION', sessionFingerprint: 'SF',
    confirmedConstructionFingerprint: 'CF', sceneEntityIds: ['G'] } };
const cap = { componentId: 'C', canonicalType: 'CAP', branchId: '/SPLIT/PROJECTION',
  routeOrder: 2, portIds: ['PC'], nodeIds: ['NB'], geometryPartIds: ['GC'],
  geometryKinds: ['point'], internalEdgeIds: [], neighbourComponentIds: ['P'],
  supportAttachmentIds: [], ancestry: { strokeId: 'SC', sourceComponentId: 'SRC-C',
    sourceIndex: 1, sourceBranchId: '/SPLIT/PROJECTION', sessionFingerprint: 'SF',
    confirmedConstructionFingerprint: 'CF', sceneEntityIds: ['GC'] } };
const part = { geometryPartId: 'G', sceneEntityId: 'G', componentId: 'P', role: 'primary',
  geometry: { kind: 'segment', start: p(0), end: p(100) }, nodeIds: ['NA', 'NB'],
  portIds: ['PA', 'PB'], sourceStrokeId: 'SP' };
const capPart = { geometryPartId: 'GC', sceneEntityId: 'GC', componentId: 'C', role: 'primary',
  geometry: { kind: 'point', position: p(100) }, nodeIds: ['NB'], portIds: ['PC'],
  sourceStrokeId: 'SC' };
const portA = { portId: 'PA', componentId: 'P', nodeId: 'NA', sourcePosition: p(0), position: p(0) };
const portB = { portId: 'PB', componentId: 'P', nodeId: 'NB', sourcePosition: p(100), position: p(100) };
const portC = { portId: 'PC', componentId: 'C', nodeId: 'NB', sourcePosition: p(100), position: p(100) };
const nodeA = { nodeId: 'NA', position: p(0), portIds: ['PA'], incidentComponentIds: ['P'],
  incidentGeometryPartIds: ['G'], incidentEdgeIds: ['E'], committedConnectionIds: [], degree: 1,
  boundaryClass: 'OPEN_TERMINAL', positionProvenance: 'CONFIRMED_PORT',
  positionAncestry: [{ portId: 'PA', componentId: 'P', sourcePosition: p(0), resolvedPosition: p(0) }] };
const nodeB = { nodeId: 'NB', position: p(100), portIds: ['PB', 'PC'],
  incidentComponentIds: ['C', 'P'], incidentGeometryPartIds: ['G', 'GC'], incidentEdgeIds: ['E'],
  committedConnectionIds: ['C1'], degree: 2, boundaryClass: 'CONNECTED',
  positionProvenance: 'CONFIRMED_PORT', positionAncestry: [
    { portId: 'PB', componentId: 'P', sourcePosition: p(100), resolvedPosition: p(100) },
    { portId: 'PC', componentId: 'C', sourcePosition: p(100), resolvedPosition: p(100) }] };
const edge = { edgeId: 'E', componentId: 'P', geometryPartId: 'G', order: 0,
  fromNodeId: 'NA', toNodeId: 'NB' };
const connection = { connectionId: 'C1', fromPortId: 'PB', toPortId: 'PC',
  fromPosition: p(100), toPosition: p(100), fromNodeId: 'NB', toNodeId: 'NB',
  nodeRelation: 'MERGED_BY_COMMITTED_IDENTITY', status: 'COMMITTED' };
const parentCut = { boundaryCutId: 'ssk:boundary-cut:P:C1', componentId: 'P', connectionId: 'C1',
  selectedPortId: 'PB', stationaryPortId: 'PC', stationaryComponentId: 'C',
  nodeRelation: 'MERGED_BY_COMMITTED_IDENTITY', status: 'COMMITTED', currentCoincidence: true,
  rigidTransformDisposition: 'BLOCKED_STATIONARY_TOPOLOGY_BOUNDARY' };
const capCut = { ...parentCut, boundaryCutId: 'ssk:boundary-cut:C:C1', componentId: 'C',
  selectedPortId: 'PC', stationaryPortId: 'PB', stationaryComponentId: 'P' };
const eligibility = ['P', 'G', 'NA', 'NB', 'C', 'GC'].map((targetId) => ({
  schema: 'SequentialEditEligibility.v1', targetKind: targetId.length === 1 ? 'COMPONENT' : 'NODE',
  targetId, capabilities: ['SPLIT_ELIGIBLE'], locks: [], evidence: {},
  eligibilityId: `EL-${targetId}`, editable: true }));
const topology = { schema: 'SequentialEditableTopologySnapshot.v1',
  authority: { confirmedConstructionFingerprint: 'CF' }, branch: { branchId: '/SPLIT/PROJECTION' },
  components: [parent, cap], geometryParts: [part, capPart], ports: [portA, portB, portC],
  nodes: [nodeA, nodeB], internalEdges: [edge], committedConnections: [connection],
  componentBoundaryCuts: [parentCut, capCut], selectionGroups: [
    { selectionGroupId: 'SG-P', componentId: 'P', geometryPartIds: ['G'],
      selectionCandidateIds: ['SEL-G'], boundaryCutIds: [parentCut.boundaryCutId], eligibilityId: 'EL-P' },
    { selectionGroupId: 'SG-C', componentId: 'C', geometryPartIds: ['GC'],
      selectionCandidateIds: ['SEL-GC'], boundaryCutIds: [capCut.boundaryCutId], eligibilityId: 'EL-C' }],
  selectionCandidates: [
    { selectionCandidateId: 'SEL-G', topologyEntityId: 'G', selectionGroupId: 'SG-P',
      resolvedComponentId: 'P', sceneEntityId: 'G', boundaryCutIds: [parentCut.boundaryCutId], eligibilityId: 'EL-G' },
    { selectionCandidateId: 'SEL-GC', topologyEntityId: 'GC', selectionGroupId: 'SG-C',
      resolvedComponentId: 'C', sceneEntityId: 'GC', boundaryCutIds: [capCut.boundaryCutId], eligibilityId: 'EL-GC' }],
  eligibility, supportCarriers: [
    { carrierId: 'P', componentId: 'P', supportAttachmentIds: [] },
    { carrierId: 'C', componentId: 'C', supportAttachmentIds: [] }],
  supportAttachments: [], repairs: [], topologyFingerprint: 'TF', geometryFingerprint: 'GF' };
const parentEntity = { id: 'G', visible: true, geometry: part.geometry,
  domainRef: { category: 'confirmed', componentId: 'P', geometryRole: 'primary' }, metadata: {} };
const capEntity = { id: 'GC', visible: true, geometry: capPart.geometry,
  domainRef: { category: 'confirmed', componentId: 'C', geometryRole: 'primary' }, metadata: {} };
const scene = createEngineeringScene({ sceneId: 'SPLIT-PROJECTION-SCENE',
  entities: [parentEntity, capEntity] });
const target = { schema: 'SequentialPipeSplitTarget.v1', authorityId: 'AUTH',
  sceneRevision: scene.revision, selectedObjectId: 'G', parentComponentId: 'P',
  parentGeometryPartId: 'G', canonicalType: 'PIPE', geometry: part.geometry,
  nodeIds: ['NA', 'NB'], portIds: ['PA', 'PB'], startNode: nodeA, endNode: nodeB,
  startPort: portA, endPort: portB, parentComponent: parent,
  parentGeometryPart: part, parentInternalEdge: edge, boundaryCuts: [parentCut],
  parentSceneEntity: parentEntity, snapshotFingerprint: 'SN', topologyFingerprint: 'TF',
  geometryFingerprint: 'GF', topologyEditJournalFingerprint: null, splitTargetId: 'TARGET' };
const store = createSequentialPipeSplitDraftStore();
const preview = store.stage({ target, mode: 'PARAMETER', parameter: 0.5,
  minimumEndDistance: 5, operationId: 'SPLIT-CONNECTED' });
const replacement = createSequentialPipeSplitReplacement({ preview, target, topology, scene });
let journal = createSequentialTopologyEditJournal({ branchId: '/SPLIT/PROJECTION',
  baseAuthorityId: 'AUTH', baseTopologyFingerprint: 'TF', baseGeometryJournalFingerprint: null });
journal = appendSequentialTopologyEdit(journal, { type: 'SPLIT_PIPE',
  operationId: preview.operationId, targetId: target.splitTargetId, parentComponentId: 'P',
  parentGeometryPartId: 'G', location: preview.location, identities: preview.identities,
  before: replacement.before, after: replacement.after, scene: replacement.scene,
  ancestry: {}, operator: { actorId: 'PROJECTION_TEST', reason: 'Connected split reviewed.',
    appliedAt: '2026-07-29T04:20:00.000Z' } }).journal;
const projected = applySequentialTopologyEditJournalToTopology(topology, journal);
assert.deepEqual(projected.components.slice(0, 2).map((row) => row.componentId),
  [preview.identities.upstreamComponentId, preview.identities.downstreamComponentId]);
assert(!projected.components.some((row) => row.componentId === 'P'));
assert.deepEqual(projected.components.find((row) => row.componentId === 'C').neighbourComponentIds,
  [preview.identities.downstreamComponentId]);
assert.equal(projected.componentBoundaryCuts.find((row) => row.componentId === 'C')
  .stationaryComponentId, preview.identities.downstreamComponentId);
assert.equal(projected.componentBoundaryCuts.filter((row) =>
  row.connectionId === preview.identities.splitConnectionId).length, 2);
assert(projected.nodes.some((row) => row.nodeId === preview.identities.splitNodeId));
assert(projected.ports.some((row) => row.portId === 'PA'));
assert(projected.ports.some((row) => row.portId === 'PC'));
assert.equal(projected.committedConnections.at(-1).connectionId,
  preview.identities.splitConnectionId);
const projectedScene = applySequentialTopologyEditJournalToScene(scene, journal);
assert.equal(projectedScene.entities.length, 3);
assert(projectedScene.entities.some((row) => row.id === 'GC'));
assert(!projectedScene.entities.some((row) => row.id === 'G'));
assert.throws(() => applySequentialTopologyEditJournalToTopology({ ...topology,
  components: topology.components.map((row) => row.componentId === 'P'
    ? { ...row, routeOrder: 99 } : row) }, journal),
(error) => error.code === SEQUENTIAL_TOPOLOGY_EDIT_PROJECTION_REJECTION.ENTRY_STALE);
store.destroy();
console.log('Sequential pipe split projection: ok');
