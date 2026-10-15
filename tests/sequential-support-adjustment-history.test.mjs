import assert from 'node:assert/strict';
import {
  appendSequentialSupportAdjustment,
  createSequentialSupportAdjustmentRegister,
} from '../tabs/sequential-sketcher/support/sequential-support-adjustment-register.js';
import {
  assertSequentialSupportAdjustmentHistory,
  createSequentialSupportAdjustmentHistory,
  recordSequentialSupportAdjustmentRegister,
  sequentialSupportAdjustmentHistoryCapabilities,
  transitionSequentialSupportAdjustmentHistory,
} from '../tabs/sequential-sketcher/support/sequential-support-adjustment-history.js';

const CONSTRUCTION = 'CONSTRUCTION-3J';
const BASE = 'BASE-PROJECTION-3J';
const AT = '2026-07-28T08:20:00.000Z';
function input(fromX, toX, suffix) {
  const point = (x) => Object.freeze({ x, y: 0, z: 0 });
  return {
    supportId: 'SUPPORT-3J', familyId: 'FAMILY-3J', carrierId: 'PIPE-3J',
    fromPosition: point(fromX), toPosition: point(toX),
    resolvedPosition: {
      supportPosGlobal: point(toX), centerlinePointGlobal: point(toX),
      carrierStationMm: toX, carrierFraction: toX / 1000,
      distanceToCarrierMm: 0, offsetFromCenterline: point(0),
      positionStatus: 'ON_CENTERLINE', localFrame: null, fittingLocation: null,
    },
    targetId: `TARGET-${suffix}`, operationId: `OP-${suffix}`,
    actorId: 'operator-3j', reason: `Adjustment ${suffix}`,
    evidenceNote: `Evidence ${suffix}`, appliedAt: AT,
  };
}

const empty = createSequentialSupportAdjustmentRegister({ constructionFingerprint: CONSTRUCTION });
const first = appendSequentialSupportAdjustment(empty, input(250, 300, 'A')).register;
const second = appendSequentialSupportAdjustment(first, input(300, 350, 'B')).register;
const alternate = appendSequentialSupportAdjustment(first, input(300, 325, 'C')).register;

const initialA = createSequentialSupportAdjustmentHistory({
  constructionFingerprint: CONSTRUCTION,
  baseProjectionFingerprint: BASE,
});
const initialB = createSequentialSupportAdjustmentHistory({
  constructionFingerprint: CONSTRUCTION,
  baseProjectionFingerprint: BASE,
});
assert.deepEqual(initialA, initialB, 'empty support history must be deterministic');
assert(Object.isFrozen(initialA));
assert.deepEqual(sequentialSupportAdjustmentHistoryCapabilities(initialA), {
  canUndo: false, canRedo: false, undoCount: 0, redoCount: 0,
  currentAdjustmentCount: 0,
  currentRegisterHeadFingerprint: empty.headFingerprint,
  historyFingerprint: initialA.historyFingerprint,
});
assert.throws(() => transitionSequentialSupportAdjustmentHistory(initialA, 'UNDO_SUPPORT_ADJUSTMENT'),
  /No support adjustment is available to undo/);
assert.throws(() => transitionSequentialSupportAdjustmentHistory(initialA, 'REDO_SUPPORT_ADJUSTMENT'),
  /No support adjustment is available to redo/);

const recordedFirst = recordSequentialSupportAdjustmentRegister(initialA, first);
assert.equal(recordedFirst.currentRegister.headFingerprint, first.headFingerprint);
assert.equal(recordedFirst.undoStack.length, 1);
assert.equal(recordedFirst.redoStack.length, 0);
const recordedSecond = recordSequentialSupportAdjustmentRegister(recordedFirst, second);
assert.equal(recordedSecond.undoStack.length, 2);
assert.equal(recordedSecond.redoStack.length, 0);

const undoSecond = transitionSequentialSupportAdjustmentHistory(
  recordedSecond,
  'UNDO_SUPPORT_ADJUSTMENT',
);
assert.equal(undoSecond.affectedEntry.adjustmentId, second.entries.at(-1).adjustmentId);
assert.equal(undoSecond.history.currentRegister.headFingerprint, first.headFingerprint);
assert.equal(undoSecond.history.undoStack.length, 1);
assert.equal(undoSecond.history.redoStack.length, 1);
const undoFirst = transitionSequentialSupportAdjustmentHistory(
  undoSecond.history,
  'UNDO_SUPPORT_ADJUSTMENT',
);
assert.equal(undoFirst.history.currentRegister.headFingerprint, empty.headFingerprint);
assert.equal(undoFirst.history.undoStack.length, 0);
assert.equal(undoFirst.history.redoStack.length, 2);

const redoFirst = transitionSequentialSupportAdjustmentHistory(
  undoFirst.history,
  'REDO_SUPPORT_ADJUSTMENT',
);
assert.equal(redoFirst.affectedEntry.adjustmentId, first.entries.at(-1).adjustmentId);
assert.equal(redoFirst.history.currentRegister.headFingerprint, first.headFingerprint);
const redoSecond = transitionSequentialSupportAdjustmentHistory(
  redoFirst.history,
  'REDO_SUPPORT_ADJUSTMENT',
);
assert.equal(redoSecond.affectedEntry.adjustmentId, second.entries.at(-1).adjustmentId);
assert.equal(redoSecond.history.currentRegister.headFingerprint, second.headFingerprint);
assert.equal(redoSecond.history.redoStack.length, 0);

const alternateHistory = recordSequentialSupportAdjustmentRegister(undoSecond.history, alternate);
assert.equal(alternateHistory.currentRegister.headFingerprint, alternate.headFingerprint);
assert.equal(alternateHistory.redoStack.length, 0,
  'new accepted adjustment after undo must clear support redo history');
assert.throws(() => recordSequentialSupportAdjustmentRegister(initialA, second),
  /append exactly one canonical register entry/);
assert.throws(() => assertSequentialSupportAdjustmentHistory({
  ...recordedFirst,
  historyFingerprint: 'TAMPERED',
}), /canonical regeneration/);

console.log('Sequential SSK-TS-3J immutable support adjustment history: ok');
