import assert from 'node:assert/strict';
import {
  createEngineeringRevisionToken,
  createEngineeringSnapCandidate,
  createSegmentGeometry,
} from '../core/engineering-scene/index.js';
import { sequentialSemanticFingerprint } from '../tabs/sequential-sketcher/scoped-edit/sequential-command-contracts.js';
import {
  SEQUENTIAL_PREPARED_GEOMETRY_MOVE_SCHEMA,
  _test,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-single-entity-move-application.js';
import {
  SEQUENTIAL_MOVE_SNAP_MODE,
  createSequentialMoveSnapAcquisition,
  createSequentialMoveSnapProfile,
  createSequentialMoveSnapSelection,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-move-snap-contracts.js';
import { createSequentialSingleEntityMoveDraftStore } from '../tabs/sequential-sketcher/scoped-edit/sequential-single-entity-move-draft.js';
import { SEQUENTIAL_SINGLE_ENTITY_MOVE_TARGET_SCHEMA } from '../tabs/sequential-sketcher/scoped-edit/sequential-single-entity-move-target.js';

const geometry = createSegmentGeometry({ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 });
const target = Object.freeze({
  schema: SEQUENTIAL_SINGLE_ENTITY_MOVE_TARGET_SCHEMA,
  moveTargetId: 'TARGET-APPLICATION', componentId: 'COMP-1', canonicalType: 'PIPE',
  eligibilityId: 'ELIGIBLE-1', authorityId: 'AUTH-1', rigidMoveEligible: true,
  geometryPartIds: ['PART-1'], componentPortIds: ['PORT-1', 'PORT-2'],
  componentNodeIds: ['NODE-1', 'NODE-2'], supportAttachmentIds: [],
  geometryParts: [{ geometryPartId: 'PART-1', role: 'primary', geometry }],
  boundaryCuts: [], sceneRevision: createEngineeringRevisionToken('R1'),
  snapshotFingerprint: 'SNAP-1', topologyFingerprint: 'TOPO-1', geometryFingerprint: 'GEOM-1',
});
const topology = Object.freeze({
  components: [{ componentId: 'COMP-1', geometryPartIds: ['PART-1'],
    portIds: ['PORT-1', 'PORT-2'], nodeIds: ['NODE-1', 'NODE-2'], supportAttachmentIds: [] }],
  geometryParts: [{ geometryPartId: 'PART-1', componentId: 'COMP-1', geometry }],
  ports: [{ portId: 'PORT-1', componentId: 'COMP-1', position: { x: 0, y: 0, z: 0 } },
    { portId: 'PORT-2', componentId: 'COMP-1', position: { x: 10, y: 0, z: 0 } }],
  nodes: [{ nodeId: 'NODE-1', incidentComponentIds: ['COMP-1'], position: { x: 0, y: 0, z: 0 } },
    { nodeId: 'NODE-2', incidentComponentIds: ['COMP-1'], position: { x: 10, y: 0, z: 0 } }],
});
const store = createSequentialSingleEntityMoveDraftStore();
const raw = store.stage({
  target, constraint: 'X', delta: { x: 2, y: 0, z: 0 },
  interaction: { kind: 'numeric', source: 'exact-xyz' },
});
assert.deepEqual(_test.validatePreview(raw, target), raw);
assert.equal(_test.assertEligible(raw, target, topology).componentId, 'COMP-1');
const profile = createSequentialMoveSnapProfile({
  enabledModes: [SEQUENTIAL_MOVE_SNAP_MODE.ENDPOINT], aperturePx: 20,
});
const candidate = createEngineeringSnapCandidate({
  id: 'SNAP-C1', providerId: 'sequential:endpoint', mode: 'endpoint',
  sourceEntityIds: ['STATIONARY-PART'], worldPoint: { x: 15, y: 0, z: 0 },
  screenPoint: { x: 15, y: 0 }, screenDistance: 1, priority: 10,
  lockedAxes: { x: true, y: false, z: false },
  compatibleConstraintKinds: ['axis', 'plane'], compatibleReferenceIds: [], label: 'Endpoint',
});
const acquisition = createSequentialMoveSnapAcquisition({
  profile, targetId: target.moveTargetId, topologyFingerprint: target.topologyFingerprint,
  geometryFingerprint: target.geometryFingerprint, sceneRevision: target.sceneRevision,
  constraint: { schema: 'SequentialMoveConstraint.v1', kind: 'axis', axis: 'X' },
  rawWorldPoint: { x: 7, y: 0, z: 0 }, rawScreenPoint: { x: 7, y: 0 },
  candidates: [candidate], suggestedCandidateId: candidate.id,
  rankingEvidence: { orderedIds: [candidate.id] }, derivationEvidence: {},
});
const snapSelection = createSequentialMoveSnapSelection({ acquisition, candidateId: candidate.id });
const snapped = store.stage({
  target, constraint: 'X', rawDelta: raw.rawDelta, delta: { x: 10, y: 0, z: 0 },
  snapSelection, interaction: { kind: 'numeric', source: 'explicit-snap-selection' },
});
assert.deepEqual(_test.validatePreview(snapped, target), snapped);
const evidence = _test.entryEvidence(snapped, target, topology, topology.components[0], {
  actorId: 'OPERATOR', reason: 'Exact move reviewed.', evidenceNote: null,
  appliedAt: '2026-07-28T19:00:00.000Z',
});
assert.deepEqual(evidence.after.ports.map((row) => row.position.x), [10, 20]);
assert.equal(evidence.snapSelection.selectionFingerprint, snapSelection.selectionFingerprint);
for (const [label, changedTarget, changedTopology] of [
  ['connected', { ...target, rigidMoveEligible: false, boundaryCuts: [{ boundaryCutId: 'CUT-1' }] }, topology],
  ['support-bearing', target, { ...topology, components: [{ ...topology.components[0], supportAttachmentIds: ['SUP-1'] }] }],
  ['repair-locked', { ...target, rigidMoveEligible: false }, topology],
]) assert.throws(() => _test.assertEligible(raw, changedTarget, changedTopology),
  /isolated unsupported rigid component/, label);
const material = {
  schema: SEQUENTIAL_PREPARED_GEOMETRY_MOVE_SCHEMA,
  preview: snapped, expectedAuthority: { authorityId: 'AUTHORITY' },
  candidate: { schema: 'SequentialPreparedGeometryMoveCandidate.v1' },
};
const prepared = Object.freeze({
  ...material,
  preparedId: sequentialSemanticFingerprint('SSKGEOMETRYMOVEPREP', material),
  publicationState: 'NOT_PUBLISHED',
});
assert.deepEqual(_test.validatePrepared(prepared), prepared);
assert.throws(() => _test.validatePrepared({ ...prepared, preparedId: 'TAMPERED' }),
  /differs from canonical evidence regeneration/);
store.destroy();
console.log('Sequential single-entity move application: ok');
