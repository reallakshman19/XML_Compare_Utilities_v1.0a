import assert from 'node:assert/strict';
import { createEngineeringSnapCandidate } from '../core/engineering-scene/index.js';
import {
  SEQUENTIAL_MOVE_SNAP_MODE,
  SEQUENTIAL_MOVE_SNAP_REJECTION,
  assertSequentialMoveSnapSelection,
  createSequentialMoveSnapAcquisition,
  createSequentialMoveSnapProfile,
  createSequentialMoveSnapSelection,
  normalizeSequentialSnapPoint,
  sequentialMoveSnapCandidateId,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-move-snap-contracts.js';

const profile = createSequentialMoveSnapProfile({
  enabledModes: [SEQUENTIAL_MOVE_SNAP_MODE.GRID, SEQUENTIAL_MOVE_SNAP_MODE.ENDPOINT],
  aperturePx: 18,
  precisionDigits: 6,
  grid: { enabled: true, spacing: 100, origin: { x: 0, y: 0, z: 0 } },
});
assert.deepEqual(profile.enabledModes, ['endpoint', 'sequential:grid']);
assert.equal(profile.grid.spacing, 100);
assert.equal(normalizeSequentialSnapPoint({ x: -0, y: 1 / 3, z: 2 }, profile).x, 0);
assert.throws(() => createSequentialMoveSnapProfile({ enabledModes: [], aperturePx: 10 }),
  (error) => error.code === SEQUENTIAL_MOVE_SNAP_REJECTION.PROFILE_INVALID);

const candidateMaterial = {
  mode: SEQUENTIAL_MOVE_SNAP_MODE.ENDPOINT,
  sourceKey: 'NODE-1', worldPoint: { x: 10, y: 20, z: 0 },
  lockedAxes: { x: true, y: true, z: false },
};
const id = sequentialMoveSnapCandidateId(candidateMaterial);
const candidate = createEngineeringSnapCandidate({
  id, providerId: 'sequential:endpoint', mode: 'endpoint',
  sourceEntityIds: ['part-2'], worldPoint: { x: 10, y: 20, z: 0 },
  screenPoint: { x: 10, y: 20 }, screenDistance: 2, priority: 10,
  lockedAxes: { x: true, y: true, z: false },
  compatibleConstraintKinds: ['axis', 'plane'], compatibleReferenceIds: [],
  label: 'Endpoint NODE-1', metadata: { nodeId: 'NODE-1' },
});
const acquisition = createSequentialMoveSnapAcquisition({
  profile, targetId: 'TARGET-1', topologyFingerprint: 'TOPO-1',
  geometryFingerprint: 'GEOM-1', sceneRevision: { schema: 'EngineeringRevisionToken.v1', value: 'R1' },
  constraint: { schema: 'SequentialMoveConstraint.v1', kind: 'plane', plane: 'XY', axes: ['X', 'Y'] },
  rawWorldPoint: { x: 11, y: 21, z: 0 }, rawScreenPoint: { x: 11, y: 21 },
  candidates: [candidate], suggestedCandidateId: candidate.id,
  rankingEvidence: { orderedIds: [candidate.id] }, derivationEvidence: { anchorCount: 1 },
});
assert.equal(acquisition.selectedCandidateId, null, 'suggestion must not become selection');
assert.equal(acquisition.suggestedCandidateId, candidate.id);
assert(Object.isFrozen(acquisition));
const selection = createSequentialMoveSnapSelection({ acquisition, candidateId: candidate.id });
assert.deepEqual(assertSequentialMoveSnapSelection(selection), selection);
assert.throws(() => assertSequentialMoveSnapSelection({ ...selection, selectionFingerprint: 'tampered' }),
  (error) => error.code === SEQUENTIAL_MOVE_SNAP_REJECTION.CANDIDATE_TAMPERED);
assert.throws(() => createSequentialMoveSnapSelection({ acquisition, candidateId: 'missing' }),
  (error) => error.code === SEQUENTIAL_MOVE_SNAP_REJECTION.CANDIDATE_MISSING);

console.log('Sequential move snap contracts: ok');
