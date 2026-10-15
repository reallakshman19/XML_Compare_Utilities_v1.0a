import assert from 'node:assert/strict';
import { createSequentialDraftEditSupportMovePanel } from '../tabs/sequential-sketcher/scoped-edit/sequential-draft-edit-support-move-panel.js';

class Element {
  constructor() {
    this.hidden = false; this.disabled = false; this.value = ''; this.textContent = '';
    this.style = { cssText: '' }; this.attributes = new Map(); this.listeners = new Map();
    this.removed = false; this.children = new Map(); this.inputs = []; this.buttons = [];
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener(name, listener) { this.listeners.set(name, listener); }
  removeEventListener(name, listener) { if (this.listeners.get(name) === listener) this.listeners.delete(name); }
  click() { return this.listeners.get('click')?.({ preventDefault() {} }); }
  querySelector(selector) { return this.children.get(selector) || null; }
  querySelectorAll(selector) {
    if (selector === 'input') return this.inputs;
    if (selector === 'button') return this.buttons;
    return [];
  }
  remove() { this.removed = true; }
  insertAdjacentHTML() { throw new Error('Panel should already exist in this focused fixture.'); }
}
function fixture(options = {}) {
  const panel = new Element(); const host = new Element();
  const target = new Element(); const history = new Element();
  const status = new Element(); const review = new Element();
  const preview = new Element(); const undo = new Element(); const redo = new Element();
  const apply = new Element(); const cancel = new Element(); const coordinates = new Element();
  const actor = new Element(); const reason = new Element(); const evidence = new Element();
  const xyz = Object.fromEntries(['x', 'y', 'z'].map((axis) => [axis, new Element()]));
  panel.children.set('[data-ssk-support-move-coordinates]', coordinates);
  panel.inputs = Object.values(xyz); panel.buttons = [preview, undo, redo, apply, cancel];
  const selectors = new Map([
    ['[data-ssk-visual-stack]', host], ['[data-ssk-support-move-panel]', panel],
    ['[data-ssk-support-move-target]', target], ['[data-ssk-support-history-state]', history],
    ['[data-ssk-support-move-status]', status], ['[data-ssk-support-move-review]', review],
    ['[data-ssk-support-move-preview]', preview], ['[data-ssk-support-history-undo]', undo],
    ['[data-ssk-support-history-redo]', redo], ['[data-ssk-support-move-apply]', apply],
    ['[data-ssk-support-move-cancel]', cancel], ['[data-ssk-draft-edit-actor]', actor],
    ['[data-ssk-draft-edit-reason]', reason], ['[data-ssk-draft-edit-evidence]', evidence],
    ...['x', 'y', 'z'].map((axis) => [`[data-ssk-support-move-coordinate="${axis}"]`, xyz[axis]]),
  ]);
  const root = { querySelector: (selector) => selectors.get(selector) || null };
  let previews = 0; let historyPrepares = 0; let applies = 0; let cancels = 0;
  const previewInputs = []; const historyInputs = [];
  const movePrepared = Object.freeze({
    schema: 'SequentialPreparedSupportAdjustment.v1',
    preparedId: 'SUPPORT-PREPARED-3J',
    expectedAuthority: Object.freeze({ authorityId: 'SAUTH-3J' }),
    candidate: Object.freeze({
      register: Object.freeze({ headFingerprint: 'REGISTER-3J' }),
      entry: Object.freeze({
        adjustmentId: 'ADJUSTMENT-3J', supportId: 'SUPPORT-3J', carrierId: 'PIPE-3J',
        fromPosition: Object.freeze({ x: 250, y: 0, z: 0 }),
        toPosition: Object.freeze({ x: 275, y: 0, z: 0 }),
        resolvedPosition: Object.freeze({ positionStatus: 'ON_CENTERLINE' }),
      }),
    }),
  });
  function historyPrepared(action) {
    const undoAction = action === 'UNDO_SUPPORT_ADJUSTMENT';
    return Object.freeze({
      schema: 'SequentialPreparedSupportAdjustmentHistory.v1',
      preparedId: `HISTORY-PREPARED-${historyPrepares}`,
      expectedAuthority: Object.freeze({ authorityId: 'SAUTH-3J' }),
      candidate: Object.freeze({
        action,
        expectedCurrentRegisterHeadFingerprint: undoAction ? 'REGISTER-3J' : 'REGISTER-EMPTY',
        expectedHistoryFingerprint: undoAction ? 'HISTORY-AFTER' : 'HISTORY-UNDO',
        provenance: Object.freeze({ issuedAt: '2026-07-28T08:30:00.000Z' }),
        history: Object.freeze({
          historyFingerprint: undoAction ? 'HISTORY-UNDO' : 'HISTORY-REDO',
          currentRegister: Object.freeze({ headFingerprint: undoAction ? 'REGISTER-EMPTY' : 'REGISTER-3J' }),
        }),
        affectedEntry: Object.freeze({
          adjustmentId: 'ADJUSTMENT-3J', supportId: 'SUPPORT-3J', carrierId: 'PIPE-3J',
          fromPosition: Object.freeze({ x: 250, y: 0, z: 0 }),
          toPosition: Object.freeze({ x: 275, y: 0, z: 0 }),
        }),
      }),
    });
  }
  let currentPrepared = null;
  const controller = createSequentialDraftEditSupportMovePanel({
    root,
    onPreview: (input) => {
      previews += 1; previewInputs.push(input); currentPrepared = movePrepared;
      return Object.freeze({
        preview: Object.freeze({ operationId: `DRAFT-${previews}`, delta: Object.freeze({ magnitude: 25 }) }),
        prepared: movePrepared,
      });
    },
    onPrepareHistory: (input) => {
      historyPrepares += 1; historyInputs.push(input);
      currentPrepared = historyPrepared(input.action); return currentPrepared;
    },
    onApply: () => {
      applies += 1;
      if (options.stale) return Object.freeze({ accepted: false,
        reasonCode: 'SUPPORT_HISTORY_AUTHORITY_STALE', publication: null });
      const action = currentPrepared?.candidate?.action || null;
      return Object.freeze({ accepted: true, reasonCode: null,
        publication: Object.freeze({ action, adjustmentId: 'ADJUSTMENT-3J' }) });
    },
    onCancel: () => { cancels += 1; currentPrepared = null; },
  });
  return { controller, panel, target, history, status, review, preview, undo, redo,
    apply, cancel, actor, reason, evidence, xyz, previews: () => previews,
    historyPrepares: () => historyPrepares, applies: () => applies,
    cancels: () => cancels, previewInputs, historyInputs };
}
const TARGET = Object.freeze({
  supportMoveTargetId: 'TARGET-3J', supportId: 'SUPPORT-3J', familyId: 'FAMILY-3J',
  carrierId: 'PIPE-3J', entityId: 'ssk:support:SUPPORT-3J',
  originalPosition: Object.freeze({ x: 250, y: 0, z: 0 }),
});
const EMPTY_HISTORY = Object.freeze({
  canUndo: false, canRedo: false, undoCount: 0, redoCount: 0,
  currentAdjustmentCount: 0,
});
const UNDO_HISTORY = Object.freeze({
  canUndo: true, canRedo: false, undoCount: 1, redoCount: 0,
  currentAdjustmentCount: 1,
});
const REDO_HISTORY = Object.freeze({
  canUndo: false, canRedo: true, undoCount: 0, redoCount: 1,
  currentAdjustmentCount: 0,
});

{
  const test = fixture();
  test.controller.setHistoryState(EMPTY_HISTORY); test.controller.setActive(true);
  assert.equal(test.preview.disabled, true); assert.equal(test.undo.disabled, true);
  assert.equal(test.redo.disabled, true); assert.equal(test.apply.disabled, true);
  test.controller.setTarget(TARGET);
  test.xyz.x.value = '275'; test.xyz.y.value = '0'; test.xyz.z.value = '0';
  test.actor.value = 'operator-3j'; test.reason.value = 'Apply exact support operation.';
  test.evidence.value = 'Support history and carrier verified.';
  await test.preview.click();
  assert.equal(test.previews(), 1); assert.equal(test.applies(), 0);
  assert.equal(test.apply.disabled, false);
  assert.match(test.review.textContent, /Adjustment ID: ADJUSTMENT-3J/);
  assert.match(test.status.textContent, /Nothing has been applied/);
  test.cancel.click();
  assert.equal(test.cancels(), 1); assert.equal(test.controller.getState().preparedId, null);

  test.controller.setHistoryState(UNDO_HISTORY);
  assert.equal(test.undo.disabled, false); assert.equal(test.redo.disabled, true);
  await test.undo.click();
  assert.equal(test.historyPrepares(), 1);
  assert.deepEqual(test.historyInputs[0], {
    action: 'UNDO_SUPPORT_ADJUSTMENT', actorId: 'operator-3j',
    reason: 'Apply exact support operation.', evidenceNote: 'Support history and carrier verified.',
  });
  assert.match(test.review.textContent, /Action: UNDO_SUPPORT_ADJUSTMENT/);
  assert.match(test.review.textContent, /Effective from: \(275, 0, 0\)/);
  assert.match(test.review.textContent, /Effective to: \(250, 0, 0\)/);
  assert.equal(test.apply.disabled, false);
  await test.apply.click();
  assert.equal(test.applies(), 1); assert.equal(test.controller.getState().accepted, true);
  assert.equal(test.controller.getState().preparedId, null);
  assert.match(test.status.textContent, /UNDO_SUPPORT_ADJUSTMENT applied/);

  test.controller.setHistoryState(REDO_HISTORY);
  assert.equal(test.undo.disabled, true); assert.equal(test.redo.disabled, false);
  await test.redo.click();
  assert.match(test.review.textContent, /Action: REDO_SUPPORT_ADJUSTMENT/);
  assert.match(test.review.textContent, /Effective from: \(250, 0, 0\)/);
  assert.match(test.review.textContent, /Effective to: \(275, 0, 0\)/);
  test.controller.destroy(); assert.equal(test.panel.removed, true);
}

{
  const test = fixture({ stale: true });
  test.controller.setHistoryState(UNDO_HISTORY); test.controller.setActive(true);
  test.actor.value = 'operator-3j'; test.reason.value = 'Undo reviewed adjustment.';
  test.evidence.value = 'History evidence checked.';
  await test.undo.click(); await test.apply.click();
  assert.equal(test.controller.getState().accepted, false);
  assert.notEqual(test.controller.getState().preparedId, null);
  assert.match(test.status.textContent, /AUTHORITY_STALE/);
  test.cancel.click();
  assert.equal(test.controller.getState().preparedId, null);
  assert.match(test.status.textContent, /without authority mutation/);
  test.controller.destroy();
}

console.log('Sequential SSK-TS-3J support move and history panel: ok');
