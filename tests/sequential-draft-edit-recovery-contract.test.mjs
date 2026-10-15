import assert from 'node:assert/strict';
import {
  assertSequentialDraftEditRecoveryRecord,
  createSequentialDraftEditRecoveryRecord,
  sequentialDraftEditRecoveryContextMatches,
  sequentialDraftEditRecoveryRecordKey,
  sequentialDraftEditRecoveryTargetMatches,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-draft-edit-recovery-contract.js';

const authority = Object.freeze({
  authorityId: 'AUTH-1', sourceFingerprint: 'SOURCE-1', branchId: '/A',
  branchSetFingerprint: 'BRANCHES-1', journalHeadFingerprint: 'JOURNAL-1',
  confirmedConstructionFingerprint: 'CONSTRUCTION-1', supportProjectionFingerprint: 'SUPPORT-1',
  ownerRevisionFingerprint: 'OWNER-1',
});
const context = Object.freeze({ authority, editBaseFingerprint: 'EDIT-BASE-1' });
const target = (id) => Object.freeze({
  targetId: id, authorityId: authority.authorityId, sceneRevision: 'REV-1',
  snapshotFingerprint: 'SNAP-1', eligibilityId: 'ELIGIBLE-1',
});
function record(kind, selector, input, targetEvidence = target(`${kind}-TARGET`)) {
  return createSequentialDraftEditRecoveryRecord({ kind, authority,
    editBaseFingerprint: context.editBaseFingerprint, selector, targetEvidence, input,
    savedAt: '2026-07-30T16:00:00.000Z' });
}

const move = record('MOVE_COMPONENT', { objectId: 'ENTITY-1' }, {
  constraint: { schema: 'SequentialMoveConstraint.v1', kind: 'axis', axis: 'X' },
  rawDelta: { x: 5, y: 0, z: 0, magnitude: 5 },
  delta: { x: 5, y: 0, z: 0, magnitude: 5 },
  interaction: { kind: 'numeric', source: 'exact-xyz' },
  snapSelection: { candidate: { id: 'SNAP-1', worldPoint: { x: 5, y: 0, z: 0 } } },
});
const stretch = record('STRETCH_NODE', { objectId: 'ENTITY-2', nodeId: 'NODE-2' }, {
  targetPosition: { x: 2, y: 3, z: 4 },
  profile: { minimumLengthMm: 1, zeroLengthToleranceMm: 1e-9, collinearityTolerance: 1e-9 },
});
const rotate = record('ROTATE_SUBGRAPH', { objectId: 'ENTITY-3', scope: 'COMPONENT_ONLY' }, {
  pivot: { x: 0, y: 0, z: 0 }, axis: { x: 0, y: 0, z: 1 }, angleDegrees: 30,
  profile: { schema: 'SequentialRotationProfile.v1', precisionDigits: 12, boundaryTolerance: 1e-9 },
});
const support = record('MOVE_SUPPORT_SAME_CARRIER', { objectId: 'SUPPORT-ENTITY' }, {
  position: { x: 1, y: 2, z: 3 }, actorId: 'OPERATOR',
  reason: 'Restore reviewed pending support position.', evidenceNote: 'Same carrier retained.',
}, { targetId: 'SUPPORT-TARGET', authorityId: authority.authorityId,
  sceneRevision: 'REV-1', supportId: 'SUP-1', carrierId: 'PIPE-1' });

for (const value of [move, stretch, rotate, support]) {
  assert.deepEqual(assertSequentialDraftEditRecoveryRecord(value), value);
  assert.equal(JSON.stringify(assertSequentialDraftEditRecoveryRecord(value)), JSON.stringify(value));
  assert.equal(sequentialDraftEditRecoveryContextMatches(value, context), true);
  assert.equal(sequentialDraftEditRecoveryTargetMatches(value, value.targetEvidence), true);
}
const reorderedMove = createSequentialDraftEditRecoveryRecord({
  savedAt: move.savedAt,
  input: { snapSelection: move.input.snapSelection,
    interaction: { source: move.input.interaction.source, kind: move.input.interaction.kind },
    delta: { z: 0, x: 5, magnitude: 5, y: 0 },
    rawDelta: { y: 0, magnitude: 5, z: 0, x: 5 },
    constraint: { axis: 'X', kind: 'axis', schema: 'SequentialMoveConstraint.v1' } },
  targetEvidence: { eligibilityId: 'ELIGIBLE-1', sceneRevision: 'REV-1',
    authorityId: 'AUTH-1', targetId: 'MOVE_COMPONENT-TARGET', snapshotFingerprint: 'SNAP-1' },
  selector: { objectId: 'ENTITY-1' }, editBaseFingerprint: context.editBaseFingerprint,
  authority: { ownerRevisionFingerprint: 'OWNER-1', supportProjectionFingerprint: 'SUPPORT-1',
    confirmedConstructionFingerprint: 'CONSTRUCTION-1', journalHeadFingerprint: 'JOURNAL-1',
    branchSetFingerprint: 'BRANCHES-1', branchId: '/A', sourceFingerprint: 'SOURCE-1',
    authorityId: 'AUTH-1' }, kind: 'MOVE_COMPONENT',
});
assert.equal(JSON.stringify(reorderedMove), JSON.stringify(move));

assert.equal(sequentialDraftEditRecoveryRecordKey(move), '/A|MOVE_COMPONENT');
assert.equal(move.input.snapSelection.candidate.id, 'SNAP-1');
assert.equal(sequentialDraftEditRecoveryContextMatches(move,
  { ...context, editBaseFingerprint: 'CHANGED' }), false);
assert.equal(sequentialDraftEditRecoveryTargetMatches(move,
  { ...move.targetEvidence, eligibilityId: 'CHANGED' }), false);
assert.throws(() => record('DELETE_COMPONENT', { objectId: 'X' }, {}), /Unsupported pending draft kind/);
assert.throws(() => createSequentialDraftEditRecoveryRecord({ ...move,
  input: { ...move.input, preparedId: 'FORBIDDEN' } }), /forbidden|not allowed/i);
assert.throws(() => createSequentialDraftEditRecoveryRecord({ ...support,
  input: { ...support.input, position: { x: Number.NaN, y: 0, z: 0 } } }), /finite/);
assert.throws(() => createSequentialDraftEditRecoveryRecord({ ...move,
  input: { ...move.input, delta: { x: Number.NaN, y: 0, z: 0 } } }), /finite/);
assert.throws(() => createSequentialDraftEditRecoveryRecord({ ...move,
  targetEvidence: { ...move.targetEvidence, custom: new Date() } }), /plain objects/);
assert.throws(() => assertSequentialDraftEditRecoveryRecord({ ...move,
  recordFingerprint: 'tampered' }), /canonical/);
console.log('Sequential pending draft recovery contract: ok');
