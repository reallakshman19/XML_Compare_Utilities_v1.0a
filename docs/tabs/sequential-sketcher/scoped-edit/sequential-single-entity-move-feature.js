/** Lifecycle owner for component move previews, snap evidence and supervised apply. */
import { createSequentialMoveManipulatorController } from './sequential-move-manipulator-controller.js';
import { createSequentialMoveSnapFeature } from './sequential-move-snap-feature.js';
import { createSequentialSingleEntityMoveApplicationService } from './sequential-single-entity-move-application.js';
import { createSequentialSingleEntityMoveApplicationPanel } from './sequential-single-entity-move-application-panel.js';
import { createSequentialSingleEntityMoveDraftStore } from './sequential-single-entity-move-draft.js';
import { createSequentialSingleEntityMoveDragSession } from './sequential-single-entity-move-drag.js';
import { createSequentialSingleEntityMovePanel } from './sequential-single-entity-move-panel.js';
import { selectSequentialSingleEntityMoveTarget, validateSequentialSingleEntityMoveTarget }
  from './sequential-single-entity-move-target.js';
import { sequentialDraftEditRecoveryTargetMatches } from './sequential-draft-edit-recovery-contract.js';
export const SEQUENTIAL_SINGLE_ENTITY_MOVE_FEATURE_SCHEMA = 'SequentialSingleEntityMoveFeature.v1';
function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`); return value;
}
function requiredMethods(value, names, label) { names.forEach((name) =>
  requiredFunction(value?.[name], `${label}.${name}`)); return value; }
function targetInput(state) { return { readModel: state.readModel(), scene: state.readScene() }; }
function exactTarget(state) {
  if (!state.target) throw new RangeError('Select one confirmed pipe or fitting before move preview.');
  state.target = validateSequentialSingleEntityMoveTarget(state.target, targetInput(state));
  return state.target;
}
function currentTarget(state) { return state.target ? exactTarget(state) : null; }
function isManipulatorEvent(event) { return Boolean(event.target?.closest?.(
  '[data-ssk-move-manipulator]')); }
function recoveryEvidence(target) {
  return Object.freeze({
    targetId: target.moveTargetId, authorityId: target.authorityId,
    snapshotFingerprint: target.snapshotFingerprint, sceneRevision: target.sceneRevision,
    componentId: target.componentId, eligibilityId: target.eligibilityId,
    geometryFingerprint: target.geometryFingerprint,
  });
}
function recoveryDescriptor(preview) {
  return Object.freeze({
    selector: Object.freeze({ objectId: preview.target.objectId }),
    targetEvidence: recoveryEvidence(preview.target),
    input: Object.freeze({
      constraint: preview.constraint, rawDelta: preview.rawDelta, delta: preview.delta,
      interaction: preview.interaction, snapSelection: preview.snapSelection,
    }),
  });
}
function syncTransient(state) { state.readViewer()?.setTransient?.(
  state.snap.transient(state.draftStore.getPreview())); }
function snapChanged(state, value) { state.panel?.setSnapState(
  value.acquisition, value.review); syncTransient(state); }
function renderPreview(state, preview, notice = null) {
  state.panel.setPreview(preview, notice);
  state.applicationPanel.setPreview(preview);
  syncTransient(state); state.onDraftChanged(state.draftStore.getDraft());
  if (!state.restoring && !(preview.interaction.kind === 'pointer'
    && state.drag.getState().status === 'dragging')) state.onRecoveryDraft(recoveryDescriptor(preview));
  return preview;
}
function stagePreview(state, input = {}) {
  const preview = state.draftStore.stage({ ...input, target: exactTarget(state) });
  const notice = input.snapSelection
    ? 'Selected snap candidate applied to preview only. Nothing was published.'
    : input.interaction?.kind === 'pointer'
      ? 'Pointer draft updated. Release ends drag without publication.'
      : 'Exact numeric draft created. Nothing was published.';
  return renderPreview(state, preview, notice);
}
function acquireForPreview(state, preview, screenPoint = null) {
  const acquisition = state.snap.acquire(preview, screenPoint);
  state.panel.setSnapState(acquisition, state.snap.getState()); syncTransient(state); return acquisition;
}
function previewNumeric(state, input = {}) {
  state.snap.clear();
  const preview = stagePreview(state, { ...input, interaction: { kind: 'numeric', source: 'exact-xyz' } });
  acquireForPreview(state, preview); return preview;
}
function cancelPreview(state, reason = 'cancelled') {
  if (state.destroyed) return null;
  const hadPreview = Boolean(state.draftStore.getPreview());
  state.drag.cancel(reason); state.draftStore.cancel(reason); state.snap.clear();
  state.applicationPanel.invalidate(`Move application invalidated: ${reason}.`);
  state.readViewer()?.setTransient?.(null);
  state.panel.setPreview(null, `Move preview cleared: ${reason}.`);
  state.onDraftChanged(null);
  if (hadPreview && !state.restoring) state.onRecoveryClear(reason);
  return null;
}
function cancelFeaturePreview(state, reason = 'cancelled') { return state.manipulator?.getState().dragging ? state.manipulator.cancel(reason) : cancelPreview(state, reason); }
function selectTarget(state, objectId) {
  if (state.destroyed) throw new Error('Single-entity move feature is destroyed.');
  cancelFeaturePreview(state, 'target-change');
  state.target = selectSequentialSingleEntityMoveTarget({ objectId, ...targetInput(state) });
  state.panel.setTarget(state.target); state.manipulator?.refresh(); return state.target;
}
function clearTarget(state, reason = null) {
  if (state.destroyed) return null; const disposition = reason || 'target-cleared';
  if (state.manipulator?.getState().dragging) state.manipulator.clear(disposition); else {
    cancelPreview(state, disposition); state.manipulator?.clear(disposition);
  } state.target = null; state.panel.clearTarget(reason); return null;
}
function pointerDown(state, event) {
  if (isManipulatorEvent(event) || !state.active || !state.target
    || event.button !== 0 || state.draftStore.getPreview()) return;
  try {
    state.snap.clear(); state.drag.begin({
      target: exactTarget(state), constraint: state.panel.getConstraint(),
      pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY,
    });
    event.target?.setPointerCapture?.(event.pointerId);
    event.preventDefault(); event.stopImmediatePropagation();
  } catch (error) {
    state.panel.setNotice(`${error.code || error.name || 'ERROR'}: ${error.message || String(error)}`);
  }
}
function pointerMove(state, event) {
  if (isManipulatorEvent(event) || state.drag.getState().status !== 'dragging') return;
  try {
    const result = state.drag.update({
      pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY,
    });
    acquireForPreview(state, result.preview, { x: event.clientX, y: event.clientY });
    event.preventDefault(); event.stopImmediatePropagation();
  } catch (error) { cancelPreview(state, error.code || error.message || 'pointer-drag-failed'); }
}
function pointerEnd(state, event) {
  if (isManipulatorEvent(event) || state.drag.getState().status !== 'dragging') return;
  state.drag.end(event.pointerId); event.target?.releasePointerCapture?.(event.pointerId);
  const preview = state.draftStore.getPreview();
  if (preview && !state.restoring) state.onRecoveryDraft(recoveryDescriptor(preview));
  event.preventDefault(); event.stopImmediatePropagation();
}
function pointerCancel(state, event) {
  if (isManipulatorEvent(event) || state.drag.getState().status !== 'dragging') return;
  event.target?.releasePointerCapture?.(event.pointerId); cancelPreview(state, 'pointer-cancel');
  event.preventDefault(); event.stopImmediatePropagation();
}
function setFeatureActive(state, value) {
  state.active = value === true && !state.destroyed;
  if (!state.active) clearTarget(state, 'Move preview cleared because Draft Edit 3D closed.');
  state.panel.setActive(state.active); state.applicationPanel.setActive(state.active);
  state.manipulator?.setActive(state.active); return state.active;
}
function bindFeature(state) {
  for (const [type, handler] of [['pointerdown', state.handlers.down], ['pointermove', state.handlers.move],
    ['pointerup', state.handlers.end], ['pointercancel', state.handlers.cancel]])
    state.surface.addEventListener(type, handler, true);
  state.window?.addEventListener('keydown', state.handlers.key);
}
function unbindFeature(state) {
  for (const [type, handler] of [['pointerdown', state.handlers.down], ['pointermove', state.handlers.move],
    ['pointerup', state.handlers.end], ['pointercancel', state.handlers.cancel]])
    state.surface.removeEventListener(type, handler, true);
  state.window?.removeEventListener('keydown', state.handlers.key);
}
function destroyFeature(state) {
  if (state.destroyed) return false;
  unbindFeature(state); state.active = false;
  state.manipulator.destroy(); state.target = null; state.drag.destroy(); state.snap.destroy();
  state.applicationPanel.destroy(); state.panel.destroy(); state.draftStore.destroy();
  state.readViewer()?.setTransient?.(null); state.onDraftChanged(null);
  state.destroyed = true; return true;
}
function createSnap(state) {
  return createSequentialMoveSnapFeature({
    readScene: state.readScene, readModel: state.readModel, readViewer: state.readViewer,
    readTarget: () => exactTarget(state), readPreview: state.draftStore.getPreview,
    readProfile: () => state.panel.getSnapProfile(),
    stageRaw: (input) => stagePreview(state, input),
    stageSnapped: (input) => stagePreview(state, input),
    onChanged: (value) => snapChanged(state, value),
  });
}
function createPanel(state) {
  return createSequentialSingleEntityMovePanel({
    root: state.root, onPreview: (input) => previewNumeric(state, input),
    onCancel: (reason) => cancelFeaturePreview(state, reason),
    onSnapSelect: (id) => state.snap.select(id), onSnapPrevious: state.snap.previous,
    onSnapNext: state.snap.next, onSnapUse: state.snap.useSelected,
    onSnapClear: state.snap.clearSnap,
  });
}
function finishManipulatorDrag(state, pointerId) {
  const result = state.drag.end(pointerId);
  const preview = state.draftStore.getPreview();
  if (preview && !state.restoring) state.onRecoveryDraft(recoveryDescriptor(preview));
  return result;
}
function createManipulator(state) {
  return createSequentialMoveManipulatorController({
    host: state.surface, readViewer: state.readViewer, readTarget: () => currentTarget(state),
    constraintApi: {
      get: state.panel.getConstraint,
      set: state.panel.setConstraint,
      subscribe: state.panel.subscribeConstraintChanged,
    },
    beginDrag: (input) => {
      state.snap.clear(); return state.drag.begin({ ...input, target: exactTarget(state) });
    },
    updateDrag: (input) => {
      const result = state.drag.update(input);
      acquireForPreview(state, result.preview, { x: input.clientX, y: input.clientY });
      return result;
    },
    endDrag: (pointerId) => finishManipulatorDrag(state, pointerId),
    cancelDrag: (reason) => cancelPreview(state, reason),
    onError: (error, phase) => state.panel.setNotice(
      `${phase}: ${error.code || error.name || 'ERROR'}: ${error.message || String(error)}`),
  });
}
function createApplication(state) {
  const boundary = state.geometryEditBoundary;
  state.applicationService = createSequentialSingleEntityMoveApplicationService({
    readCurrentState: boundary.readCurrentState, readView: boundary.readView,
    readJournal: boundary.readJournal, publishCandidate: boundary.publishCandidate,
    now: state.applicationNow,
  });
  return createSequentialSingleEntityMoveApplicationPanel({
    root: state.root, onPrepare: state.applicationService.prepare,
    onAccept: state.applicationService.accept,
    onCommitted: () => clearTarget(state, 'accepted-geometry-move'),
  });
}
function restorePanelValues(state, record) {
  const constraint = record.input.constraint.kind === 'axis'
    ? record.input.constraint.axis : record.input.constraint.plane;
  state.panel.setConstraint(constraint, 'recovery');
  state.panel.setDelta(record.input.rawDelta);
}
function restoreRecovery(state, record) {
  if (record?.kind !== 'MOVE_COMPONENT') throw new TypeError('Move recovery kind is invalid.');
  state.restoring = true;
  try {
    const target = selectTarget(state, record.selector.objectId);
    if (!sequentialDraftEditRecoveryTargetMatches(record, recoveryEvidence(target))) {
      throw new RangeError('Move recovery target differs from current eligibility evidence.');
    }
    restorePanelValues(state, record); state.snap.clear();
    const preview = stagePreview(state, record.input);
    state.onRecoveryDraft(recoveryDescriptor(preview)); return preview;
  } finally { state.restoring = false; }
}
function initializeFeatureState(options) {
  const root = options.root;
  if (!root?.querySelector) throw new TypeError('Single-entity move feature requires a root.');
  const surface = root.querySelector('[data-ssk-draft-edit-3d-host]');
  if (!surface) throw new Error('Single-entity move pointer surface is missing.');
  const state = {
    root, surface, window: root.ownerDocument.defaultView,
    readScene: requiredFunction(options.readScene, 'readScene'),
    readModel: requiredFunction(options.readModel, 'readModel'),
    readViewer: requiredFunction(options.readViewer, 'readViewer'),
    onDraftChanged: requiredFunction(options.onDraftChanged, 'onDraftChanged'),
    onRecoveryDraft: requiredFunction(options.onRecoveryDraft || (() => {}), 'onRecoveryDraft'),
    onRecoveryClear: requiredFunction(options.onRecoveryClear || (() => {}), 'onRecoveryClear'),
    geometryEditBoundary: requiredMethods(options.geometryEditBoundary,
      ['readCurrentState', 'readView', 'readJournal', 'publishCandidate'], 'geometryEditBoundary'),
    applicationNow: requiredFunction(options.applicationNow, 'applicationNow'),
    draftStore: createSequentialSingleEntityMoveDraftStore(),
    target: null, active: false, destroyed: false, panel: null, snap: null,
    manipulator: null, restoring: false,
  };
  state.drag = createSequentialSingleEntityMoveDragSession({
    readViewer: state.readViewer, onPreview: (input) => stagePreview(state, input),
  });
  state.snap = createSnap(state); state.panel = createPanel(state);
  state.manipulator = createManipulator(state); state.applicationPanel = createApplication(state);
  state.handlers = {
    down: (event) => pointerDown(state, event), move: (event) => pointerMove(state, event),
    end: (event) => pointerEnd(state, event), cancel: (event) => pointerCancel(state, event),
    key: (event) => {
      if (event.key !== 'Escape' || (!state.target && !state.draftStore.getPreview())) return;
      if (state.manipulator.getState().dragging) state.manipulator.cancel('escape');
      else cancelPreview(state, 'escape');
    },
  };
  return state;
}
function featureStateSnapshot(state) {
  return Object.freeze({
    active: state.active, targetId: state.target?.moveTargetId || null,
    componentId: state.target?.componentId || null,
    operationId: state.draftStore.getPreview()?.operationId || null,
    drag: state.drag.getState(), snap: state.snap.getState(),
    panel: state.panel.getState(), manipulator: state.manipulator.getState(),
    application: state.applicationPanel.getState(), destroyed: state.destroyed,
  });
}
export function createSequentialSingleEntityMoveFeature(options = {}) {
  const state = initializeFeatureState(options); bindFeature(state);
  return Object.freeze({
    schema: SEQUENTIAL_SINGLE_ENTITY_MOVE_FEATURE_SCHEMA,
    setActive: (value) => setFeatureActive(state, value), select: (id) => selectTarget(state, id),
    clearTarget: (reason) => clearTarget(state, reason), cancel: (reason) => cancelFeaturePreview(state, reason),
    previewNumeric: (input) => previewNumeric(state, input),
    restoreRecovery: (record) => restoreRecovery(state, record),
    invalidate: (reason) => clearTarget(state, reason),
    getDraft: state.draftStore.getDraft, getPreview: state.draftStore.getPreview,
    getState: () => featureStateSnapshot(state), destroy: () => destroyFeature(state),
  });
}
export const _test = Object.freeze({ acquireForPreview, currentTarget, isManipulatorEvent,
  pointerCancel, pointerDown, pointerEnd, pointerMove, recoveryDescriptor, recoveryEvidence });