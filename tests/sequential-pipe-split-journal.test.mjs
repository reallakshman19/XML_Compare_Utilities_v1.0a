import assert from 'node:assert/strict';
import { createEngineeringScene } from '../core/engineering-scene/index.js';
import { createSequentialPipeSplitDraftStore } from '../tabs/sequential-sketcher/scoped-edit/sequential-pipe-split-draft.js';
import { createSequentialPipeSplitReplacement } from '../tabs/sequential-sketcher/scoped-edit/sequential-pipe-split-identities.js';
import { appendSequentialTopologyEdit,
  assertSequentialTopologyEditJournal,
  createSequentialTopologyEditJournal,
  redoSequentialTopologyEdit,
  undoSequentialTopologyEdit,
  SEQUENTIAL_TOPOLOGY_EDIT_REJECTION } from '../tabs/sequential-sketcher/scoped-edit/sequential-topology-edit-journal.js';

const point = (x) => ({ x, y: 0, z: 0 });
const component = { componentId: 'P', canonicalType: 'PIPE', branchId: '/SPLIT/JOURNAL',
  routeOrder: 1, portIds: ['PA', 'PB'], nodeIds: ['NA', 'NB'], geometryPartIds: ['G'],
  geometryKinds: ['segment'], internalEdgeIds: ['E'], neighbourComponentIds: [],
  supportAttachmentIds: [], ancestry: { strokeId: 'S', sourceComponentId: 'SRC',
    sourceIndex: 0, sourceBranchId: '/SPLIT/JOURNAL', sessionFingerprint: 'SF',
    confirmedConstructionFingerprint: 'CF', sceneEntityIds: ['G'] } };
const part = { geometryPartId: 'G', sceneEntityId: 'G', componentId: 'P', role: 'primary',
  geometry: { kind: 'segment', start: point(0), end: point(100) },
  nodeIds: ['NA', 'NB'], portIds: ['PA', 'PB'], sourceStrokeId: 'S' };
const portA = { portId: 'PA', componentId: 'P', nodeId: 'NA',
  sourcePosition: point(0), position: point(0) };
const portB = { portId: 'PB', componentId: 'P', nodeId: 'NB',
  sourcePosition: point(100), position: point(100) };
function node(nodeId, position, port) {
  return { nodeId, position, portIds: [port.portId], incidentComponentIds: ['P'],
    incidentGeometryPartIds: ['G'], incidentEdgeIds: ['E'], committedConnectionIds: [],
    degree: 1, boundaryClass: 'OPEN_TERMINAL', positionProvenance: 'CONFIRMED_PORT',
    positionAncestry: [{ portId: port.portId, componentId: 'P',
      sourcePosition: position, resolvedPosition: position }] };
}
const nodeA = node('NA', point(0), portA); const nodeB = node('NB', point(100), portB);
const edge = { edgeId: 'E', componentId: 'P', geometryPartId: 'G', order: 0,
  fromNodeId: 'NA', toNodeId: 'NB' };
const eligibility = ['P', 'G', 'NA', 'NB'].map((targetId, index) => ({
  schema: 'SequentialEditEligibility.v1', targetKind: index < 1 ? 'COMPONENT'
    : index < 2 ? 'GEOMETRY_PART' : 'NODE', targetId,
  componentId: index < 2 ? 'P' : null, canonicalType: index < 2 ? 'PIPE' : null,
  capabilities: ['SPLIT_ELIGIBLE'], locks: [], evidence: {},
  eligibilityId: `EL-${targetId}`, editable: true,
}));
const topology = { schema: 'SequentialEditableTopologySnapshot.v1',
  authority: { confirmedConstructionFingerprint: 'CF' }, branch: { branchId: '/SPLIT/JOURNAL' },
  components: [component], geometryParts: [part], ports: [portA, portB], nodes: [nodeA, nodeB],
  internalEdges: [edge], committedConnections: [], componentBoundaryCuts: [],
  selectionGroups: [{ selectionGroupId: 'SG', componentId: 'P', geometryPartIds: ['G'],
    selectionCandidateIds: ['SC'], boundaryCutIds: [], eligibilityId: 'EL-P' }],
  selectionCandidates: [{ selectionCandidateId: 'SC', topologyEntityId: 'G',
    selectionGroupId: 'SG', resolvedComponentId: 'P', sceneEntityId: 'G',
    boundaryCutIds: [], eligibilityId: 'EL-G' }], eligibility,
  supportCarriers: [{ carrierId: 'P', componentId: 'P', supportAttachmentIds: [] }],
  supportAttachments: [], repairs: [], topologyFingerprint: 'TF', geometryFingerprint: 'GF' };
const entity = { id: 'G', visible: true, geometry: part.geometry,
  domainRef: { category: 'confirmed', componentId: 'P', geometryRole: 'primary' },
  metadata: { sequential: { component: { componentId: 'P', canonicalType: 'PIPE' } } } };
const scene = createEngineeringScene({ sceneId: 'SPLIT-JOURNAL-SCENE', entities: [entity] });
const target = { schema: 'SequentialPipeSplitTarget.v1', authorityId: 'AUTH',
  sceneRevision: scene.revision, selectedObjectId: 'G', parentComponentId: 'P',
  parentGeometryPartId: 'G', canonicalType: 'PIPE', geometry: part.geometry,
  nodeIds: ['NA', 'NB'], portIds: ['PA', 'PB'], startNode: nodeA, endNode: nodeB,
  startPort: portA, endPort: portB, parentComponent: component,
  parentGeometryPart: part, parentInternalEdge: edge, boundaryCuts: [],
  parentSceneEntity: entity, snapshotFingerprint: 'SN', topologyFingerprint: 'TF',
  geometryFingerprint: 'GF', topologyEditJournalFingerprint: null, splitTargetId: 'TARGET' };
function evidence(store, operationId, parameter) {
  const preview = store.stage({ target, mode: 'PARAMETER', parameter,
    minimumEndDistance: 5, operationId });
  const replacement = createSequentialPipeSplitReplacement({ preview, target, topology, scene });
  return { type: 'SPLIT_PIPE', operationId, targetId: target.splitTargetId,
    parentComponentId: 'P', parentGeometryPartId: 'G', location: preview.location,
    identities: preview.identities, before: replacement.before, after: replacement.after,
    scene: replacement.scene, ancestry: {}, operator: { actorId: 'JOURNAL_TEST',
      reason: 'Exact split reviewed.', appliedAt: '2026-07-29T04:10:00.000Z' } };
}
const store = createSequentialPipeSplitDraftStore();
const base = createSequentialTopologyEditJournal({ branchId: '/SPLIT/JOURNAL',
  baseAuthorityId: 'AUTH', baseTopologyFingerprint: 'TF', baseGeometryJournalFingerprint: null });
const first = appendSequentialTopologyEdit(base, evidence(store, 'OP-1', 0.4));
assert.equal(first.journal.cursor, 1);
assert.equal(first.journal.entries.length, 1);
assert.deepEqual(assertSequentialTopologyEditJournal(first.journal), first.journal);
const undone = undoSequentialTopologyEdit(first.journal);
assert.equal(undone.cursor, 0);
assert.equal(undone.entries.length, 1);
assert.equal(redoSequentialTopologyEdit(undone).cursor, 1);
assert.throws(() => appendSequentialTopologyEdit(undone, evidence(store, 'OP-1', 0.4)),
(error) => error.code === SEQUENTIAL_TOPOLOGY_EDIT_REJECTION.OPERATION_REPLAY);
const replacement = appendSequentialTopologyEdit(undone, evidence(store, 'OP-2', 0.6)).journal;
assert.equal(replacement.entries.length, 1, 'new acceptance after undo truncates redo tail');
assert.equal(replacement.entries[0].operationId, 'OP-2');
assert.equal(replacement.cursor, 1);
assert.throws(() => assertSequentialTopologyEditJournal({ ...replacement,
  activeHeadFingerprint: 'TAMPERED' }),
(error) => error.code === SEQUENTIAL_TOPOLOGY_EDIT_REJECTION.JOURNAL_INVALID);
assert.throws(() => undoSequentialTopologyEdit(base),
(error) => error.code === SEQUENTIAL_TOPOLOGY_EDIT_REJECTION.HISTORY_LIMIT);
store.destroy();
console.log('Sequential pipe split journal: ok');
