import assert from 'node:assert/strict';
import {
  createEngineeringRevisionToken,
  createEngineeringSnapCandidate,
  createSegmentGeometry,
} from '../core/engineering-scene/index.js';
import {
  SEQUENTIAL_MOVE_SNAP_MODE,
  createSequentialMoveSnapAcquisition,
  createSequentialMoveSnapProfile,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-move-snap-contracts.js';
import {
  createSequentialMoveSnapReviewStore,
  validateSequentialMoveSnapSelection,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-move-snap-review-store.js';
import { createSequentialSingleEntityMoveDraftStore } from '../tabs/sequential-sketcher/scoped-edit/sequential-single-entity-move-draft.js';
import { SEQUENTIAL_SINGLE_ENTITY_MOVE_TARGET_SCHEMA } from '../tabs/sequential-sketcher/scoped-edit/sequential-single-entity-move-target.js';

const profile = createSequentialMoveSnapProfile({
  enabledModes: [SEQUENTIAL_MOVE_SNAP_MODE.ENDPOINT], aperturePx: 20,
});
function candidate(id, x, distance) {
  return createEngineeringSnapCandidate({
    id, providerId: 'sequential:endpoint', mode: 'endpoint', sourceEntityIds: [`part-${id}`],
    worldPoint: { x, y: 0, z: 0 }, screenPoint: { x, y: 0 },
    screenDistance: distance, priority: 10, lockedAxes: { x: true, y: false, z: false },
    compatibleConstraintKinds: ['axis', 'plane'], compatibleReferenceIds: [], label: id,
  });
}
const candidates = [candidate('C1', 12, 2), candidate('C2', 15, 5)];
const acquisition = createSequentialMoveSnapAcquisition({
  profile, targetId: 'TARGET-1', topologyFingerprint: 'TOPO-1', geometryFingerprint: 'GEOM-1',
  sceneRevision: createEngineeringRevisionToken('R1'),
  constraint: { schema: 'SequentialMoveConstraint.v1', kind: 'axis', axis: 'X' },
  rawWorldPoint: { x: 11, y: 0, z: 0 }, rawScreenPoint: { x: 11, y: 0 },
  candidates, suggestedCandidateId: 'C1', rankingEvidence: { orderedIds: ['C1', 'C2'] },
  derivationEvidence: { anchorCount: 2 },
});
const review = createSequentialMoveSnapReviewStore();
assert.equal(review.setAcquisition(acquisition).selectedCandidateId, null,
  'suggestion must not auto-select');
assert.equal(review.next().selectedCandidateId, 'C1');
assert.equal(review.next().selectedCandidateId, 'C2');
assert.equal(review.previous().selectedCandidateId, 'C1');
const selection = review.getSelection();
assert.deepEqual(validateSequentialMoveSnapSelection(selection, acquisition), selection);
assert.throws(() => validateSequentialMoveSnapSelection({ ...selection,
  selectionFingerprint: 'tampered' }, acquisition),
(error) => error.code === 'SEQUENTIAL_MOVE_SNAP_CANDIDATE_TAMPERED');

const target = Object.freeze({
  schema: SEQUENTIAL_SINGLE_ENTITY_MOVE_TARGET_SCHEMA,
  moveTargetId: 'TARGET-1', componentId: 'COMP-1', geometryPartIds: ['part-selected'],
  geometryParts: [{ geometryPartId: 'part-selected', role: 'primary',
    geometry: createSegmentGeometry({ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }) }],
  boundaryCuts: [], sceneRevision: createEngineeringRevisionToken('R1'),
  snapshotFingerprint: 'SNAP-1',
});
const store = createSequentialSingleEntityMoveDraftStore();
const raw = store.stage({ target, constraint: 'X', delta: { x: 1, y: 0, z: 0 },
  interaction: { kind: 'numeric', source: 'exact-xyz' } });
const beforeSelection = raw.draftFingerprint;
review.select('C1');
assert.equal(store.getPreview().draftFingerprint, beforeSelection,
  'candidate selection alone must not modify the move draft');
const snapped = store.stage({ target, constraint: 'X', rawDelta: raw.rawDelta,
  delta: { x: 7, y: 0, z: 0 }, snapSelection: review.getSelection(),
  interaction: { kind: 'numeric', source: 'explicit-snap-selection' } });
assert.equal(snapped.snapApplied, true);
assert.deepEqual(snapped.rawDelta, raw.rawDelta);
assert.deepEqual(snapped.effectiveTargetPoint, { x: 12, y: 0, z: 0 });
const restored = store.stage({ target, constraint: 'X', rawDelta: raw.rawDelta,
  delta: raw.rawDelta, interaction: { kind: 'numeric', source: 'raw-preview-restored' } });
assert.equal(restored.snapApplied, false);
assert.deepEqual(restored.delta, raw.rawDelta);
review.clear();
assert.equal(review.getState().candidateCount, 0);
review.destroy(); store.destroy();

console.log('Sequential move snap review and draft use: ok');
