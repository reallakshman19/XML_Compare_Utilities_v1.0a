/** Contained UI for previewing moves and supervising support-adjustment history. */
import {
  sequentialSupportHistorySummary,
  sequentialSupportPreparedReviewText,
} from './sequential-draft-edit-support-history-presentation.js';

export const SEQUENTIAL_DRAFT_EDIT_SUPPORT_MOVE_PANEL_SCHEMA =
  'SequentialDraftEditSupportMovePanel.v1';

function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
  return value;
}
function required(root, selector) {
  const value = root.querySelector(selector);
  if (!value) throw new Error(`Support move panel element missing: ${selector}`);
  return value;
}
function setHidden(element, hidden) {
  element.hidden = hidden;
  element.setAttribute('aria-hidden', hidden ? 'true' : 'false');
  if (hidden) element.setAttribute('inert', ''); else element.removeAttribute('inert');
}
function panelMarkup() {
  return `<section data-ssk-support-move-panel hidden aria-hidden="true" inert>
<header><strong>Support adjustment</strong><span>Exact same-carrier XYZ</span></header>
<output data-ssk-support-move-target>No confirmed support selected.</output>
<div data-ssk-support-move-coordinates>
<label>X<input type="number" step="any" data-ssk-support-move-coordinate="x"></label>
<label>Y<input type="number" step="any" data-ssk-support-move-coordinate="y"></label>
<label>Z<input type="number" step="any" data-ssk-support-move-coordinate="z"></label>
</div>
<div><button type="button" data-ssk-support-move-preview disabled>Preview move draft</button><button type="button" data-ssk-support-history-undo disabled>Prepare undo</button><button type="button" data-ssk-support-history-redo disabled>Prepare redo</button><button type="button" data-ssk-support-move-apply disabled>Apply prepared</button><button type="button" data-ssk-support-move-cancel disabled>Cancel</button></div>
<output data-ssk-support-history-state>Support adjustment history is unavailable.</output>
<pre data-ssk-support-move-review>No support operation is prepared.</pre>
<output data-ssk-support-move-status role="status" aria-live="polite">Preview and history preparation do not publish authority.</output>
</section>`;
}
function install(root) {
  const host = required(root, '[data-ssk-visual-stack]');
  if (!root.querySelector('[data-ssk-support-move-panel]')) {
    host.insertAdjacentHTML('beforeend', panelMarkup());
  }
  const panel = required(root, '[data-ssk-support-move-panel]');
  panel.style.cssText = [
    'position:absolute', 'left:12px', 'top:12px', 'z-index:8',
    'width:min(380px,calc(100% - 24px))', 'padding:12px',
    'border:1px solid rgba(250,204,21,.45)', 'border-radius:12px',
    'background:rgba(7,16,31,.96)', 'color:#e2e8f0',
    'box-shadow:0 18px 50px rgba(0,0,0,.38)',
  ].join(';');
  panel.querySelector('[data-ssk-support-move-coordinates]').style.cssText =
    'display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:8px 0';
  panel.querySelectorAll('input').forEach((input) => {
    input.style.cssText = 'box-sizing:border-box;width:100%;padding:6px;border:1px solid rgba(148,163,184,.35);border-radius:7px;background:#07101f;color:#e2e8f0';
  });
  panel.querySelectorAll('button').forEach((button) => {
    button.style.cssText = 'margin:0 6px 6px 0;padding:7px;border:1px solid rgba(148,163,184,.35);border-radius:7px;background:#172337;color:#dbeafe';
  });
  return panel;
}
function pointFromInputs(elements) {
  return Object.freeze(Object.fromEntries(['x', 'y', 'z'].map((axis) => [
    axis, elements.coordinates[axis].value,
  ])));
}
function evidenceInput(elements) {
  return Object.freeze({
    actorId: elements.actor.value,
    reason: elements.reason.value,
    evidenceNote: elements.evidence.value,
  });
}
function render(state) {
  setHidden(state.elements.panel, !state.active);
  state.elements.preview.disabled = !state.active || !state.target || state.destroyed;
  state.elements.undo.disabled = !state.active || !state.historyState?.canUndo || state.destroyed;
  state.elements.redo.disabled = !state.active || !state.historyState?.canRedo || state.destroyed;
  state.elements.apply.disabled = !state.active || !state.prepared || state.destroyed;
  state.elements.cancel.disabled = !state.preview && !state.prepared;
  state.elements.target.textContent = state.target
    ? `Support: ${state.target.supportId}\nFamily: ${state.target.familyId}\nCarrier: ${state.target.carrierId}\nEntity: ${state.target.entityId}`
    : 'No confirmed support selected.';
  state.elements.history.textContent = sequentialSupportHistorySummary(state.historyState);
  state.elements.review.textContent = sequentialSupportPreparedReviewText(state.prepared);
  state.elements.status.textContent = state.notice
    || (state.preview
      ? `Draft ${state.preview.operationId}\nDelta: ${state.preview.delta.magnitude}`
      : 'Preview and history preparation do not publish authority.');
}

export function createSequentialDraftEditSupportMovePanel(options = {}) {
  const root = options.root;
  if (!root?.querySelector) throw new TypeError('Support move panel requires a root.');
  const panel = install(root);
  const elements = {
    panel,
    target: required(root, '[data-ssk-support-move-target]'),
    history: required(root, '[data-ssk-support-history-state]'),
    status: required(root, '[data-ssk-support-move-status]'),
    review: required(root, '[data-ssk-support-move-review]'),
    preview: required(root, '[data-ssk-support-move-preview]'),
    undo: required(root, '[data-ssk-support-history-undo]'),
    redo: required(root, '[data-ssk-support-history-redo]'),
    apply: required(root, '[data-ssk-support-move-apply]'),
    cancel: required(root, '[data-ssk-support-move-cancel]'),
    actor: required(root, '[data-ssk-draft-edit-actor]'),
    reason: required(root, '[data-ssk-draft-edit-reason]'),
    evidence: required(root, '[data-ssk-draft-edit-evidence]'),
    coordinates: Object.fromEntries(['x', 'y', 'z'].map((axis) => [
      axis, required(root, `[data-ssk-support-move-coordinate="${axis}"]`),
    ])),
  };
  const state = {
    elements,
    onPreview: requiredFunction(options.onPreview, 'onPreview'),
    onPrepareHistory: requiredFunction(options.onPrepareHistory, 'onPrepareHistory'),
    onApply: requiredFunction(options.onApply, 'onApply'),
    onCancel: requiredFunction(options.onCancel, 'onCancel'),
    active: false, destroyed: false, target: null, preview: null,
    prepared: null, acceptance: null, historyState: null, notice: null,
  };
  async function preview() {
    try {
      const result = await state.onPreview({
        position: pointFromInputs(elements),
        ...evidenceInput(elements),
      });
      state.preview = result.preview; state.prepared = result.prepared;
      state.acceptance = null;
      state.notice = 'Move adjustment prepared for review. Nothing has been applied.';
    } catch (error) {
      state.prepared = null;
      state.notice = `${error.code || error.name || 'ERROR'}: ${error.message || String(error)}`;
    }
    render(state);
  }
  async function prepareHistory(action) {
    try {
      state.prepared = await state.onPrepareHistory({ action, ...evidenceInput(elements) });
      state.preview = null; state.acceptance = null;
      state.notice = `${action} prepared for review. Nothing has been applied.`;
    } catch (error) {
      state.prepared = null;
      state.notice = `${error.code || error.name || 'ERROR'}: ${error.message || String(error)}`;
    }
    render(state);
  }
  async function apply() {
    try {
      state.acceptance = await state.onApply();
      state.notice = state.acceptance.accepted
        ? `${state.acceptance.publication.action || 'Support adjustment'} applied.`
        : `${state.acceptance.reasonCode}: prepared support operation was not published.`;
      if (state.acceptance.accepted) {
        state.preview = null; state.prepared = null; state.target = null;
      }
    } catch (error) {
      state.notice = `${error.code || error.name || 'ERROR'}: ${error.message || String(error)}`;
    }
    render(state);
  }
  function cancel() {
    state.onCancel('operator-cancel');
    state.preview = null; state.prepared = null; state.acceptance = null;
    state.notice = 'Draft and prepared support operation cancelled without authority mutation.';
    render(state);
  }
  const undo = () => prepareHistory('UNDO_SUPPORT_ADJUSTMENT');
  const redo = () => prepareHistory('REDO_SUPPORT_ADJUSTMENT');
  elements.preview.addEventListener('click', preview);
  elements.undo.addEventListener('click', undo);
  elements.redo.addEventListener('click', redo);
  elements.apply.addEventListener('click', apply);
  elements.cancel.addEventListener('click', cancel);
  render(state);
  return Object.freeze({
    schema: SEQUENTIAL_DRAFT_EDIT_SUPPORT_MOVE_PANEL_SCHEMA,
    setActive(value) { state.active = value === true && !state.destroyed; render(state); },
    setTarget(target) {
      state.target = target; state.preview = null; state.prepared = null;
      state.acceptance = null; state.notice = null;
      for (const axis of ['x', 'y', 'z']) elements.coordinates[axis].value = String(target.originalPosition[axis]);
      render(state);
    },
    clearTarget(reason = null) {
      state.target = null; state.preview = null; state.prepared = null;
      state.acceptance = null; state.notice = reason; render(state);
    },
    setHistoryState(value) { state.historyState = value; render(state); },
    setPreview(value) { state.preview = value; render(state); },
    setPrepared(value) { state.prepared = value; render(state); },
    getState: () => Object.freeze({
      active: state.active, targetId: state.target?.supportMoveTargetId || null,
      supportId: state.target?.supportId || null,
      operationId: state.preview?.operationId || null,
      preparedId: state.prepared?.preparedId || null,
      canUndo: state.historyState?.canUndo === true,
      canRedo: state.historyState?.canRedo === true,
      accepted: state.acceptance?.accepted ?? null,
      destroyed: state.destroyed,
    }),
    destroy() {
      if (state.destroyed) return false;
      state.destroyed = true;
      elements.preview.removeEventListener('click', preview);
      elements.undo.removeEventListener('click', undo);
      elements.redo.removeEventListener('click', redo);
      elements.apply.removeEventListener('click', apply);
      elements.cancel.removeEventListener('click', cancel);
      panel.remove();
      return true;
    },
  });
}
