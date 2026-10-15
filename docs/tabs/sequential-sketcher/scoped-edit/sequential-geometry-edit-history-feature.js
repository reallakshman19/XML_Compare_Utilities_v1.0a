/** Visible Draft Edit 3D controls for deterministic geometry history transitions. */
import { createSequentialGeometryEditHistoryService } from './sequential-geometry-edit-history-service.js';
import { sequentialGeometryEditHistoryCapabilities } from './sequential-geometry-edit-history.js';

export const SEQUENTIAL_GEOMETRY_EDIT_HISTORY_FEATURE_SCHEMA =
  'SequentialGeometryEditHistoryFeature.v1';

function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
  return value;
}
function required(root, selector) {
  const value = root.querySelector(selector);
  if (!value) throw new Error(`Geometry history element missing: ${selector}`);
  return value;
}
function markup() {
  return `<section data-ssk-geometry-history hidden aria-hidden="true" inert>
<header><strong>Geometry history</strong><span data-ssk-geometry-history-position>0 / 0</span></header>
<div><button type="button" data-ssk-geometry-history-undo disabled>Undo geometry</button><button type="button" data-ssk-geometry-history-redo disabled>Redo geometry</button></div>
<label>Actor<input data-ssk-geometry-history-actor autocomplete="off"></label>
<label>Reason<input data-ssk-geometry-history-reason autocomplete="off"></label>
<label>Evidence<textarea data-ssk-geometry-history-evidence rows="2"></textarea></label>
<output data-ssk-geometry-history-detail>No accepted geometry edits.</output>
<output data-ssk-geometry-history-status role="status" aria-live="polite">History controls publish cursor transitions only.</output>
</section>`;
}
function install(root) {
  const host = required(root, '[data-ssk-visual-stack]');
  if (!root.querySelector('[data-ssk-geometry-history]')) host.insertAdjacentHTML('beforeend', markup());
  const panel = required(root, '[data-ssk-geometry-history]');
  panel.style.cssText = [
    'position:absolute', 'right:12px', 'top:12px', 'z-index:11',
    'width:min(340px,calc(100% - 24px))', 'padding:10px',
    'border:1px solid rgba(56,189,248,.45)', 'border-radius:12px',
    'background:rgba(7,16,31,.96)', 'color:#e2e8f0',
  ].join(';');
  panel.querySelectorAll('button').forEach((button) => {
    button.style.cssText = 'margin:8px 6px 6px 0;padding:7px;border:1px solid rgba(148,163,184,.35);border-radius:7px;background:#172337;color:#dbeafe';
  });
  return panel;
}
function evidence(root, action) {
  return {
    action,
    actorId: required(root, '[data-ssk-geometry-history-actor]').value,
    reason: required(root, '[data-ssk-geometry-history-reason]').value,
    evidenceNote: required(root, '[data-ssk-geometry-history-evidence]').value,
  };
}
function entryText(entry) {
  return entry ? `${entry.type} · ${entry.operationId}` : 'none';
}
function unavailableCapability(error) {
  const reason = error?.message || 'Geometry history authority is unavailable.';
  return Object.freeze({
    canUndo: false, canRedo: false, cursor: 0, totalCount: 0, activeCount: 0, redoCount: 0,
    undoEntry: null, redoEntry: null, undoBlockedReason: reason, redoBlockedReason: reason,
  });
}
function readCapability(state) {
  try {
    return sequentialGeometryEditHistoryCapabilities(state.boundary.readHistory());
  } catch (error) {
    return unavailableCapability(error);
  }
}
function render(state) {
  const capability = readCapability(state);
  state.capability = capability;
  state.panel.hidden = !state.active;
  state.panel.setAttribute('aria-hidden', state.active ? 'false' : 'true');
  if (state.active) state.panel.removeAttribute('inert'); else state.panel.setAttribute('inert', '');
  state.position.textContent = `${capability.cursor} / ${capability.totalCount}`;
  state.undo.disabled = !state.active || !capability.canUndo || state.destroyed;
  state.redo.disabled = !state.active || !capability.canRedo || state.destroyed;
  state.undo.title = capability.undoBlockedReason || `Undo ${entryText(capability.undoEntry)}`;
  state.redo.title = capability.redoBlockedReason || `Redo ${entryText(capability.redoEntry)}`;
  state.detail.textContent = `Undo: ${entryText(capability.undoEntry)}\nRedo: ${entryText(capability.redoEntry)}\nActive: ${capability.activeCount}; redo tail: ${capability.redoCount}`;
  state.status.textContent = state.notice || 'History controls publish cursor transitions only.';
}
function execute(state, action) {
  if (state.destroyed) throw new Error('Geometry history feature is destroyed.');
  try {
    const prepared = state.service.prepare(evidence(state.root, action));
    const acceptance = state.service.accept(prepared);
    state.notice = acceptance.accepted
      ? `${acceptance.publication.action}: ${entryText(acceptance.publication.affectedEntry)}.`
      : `${acceptance.reasonCode}: geometry history was not published.`;
    if (acceptance.accepted) state.onApplied(acceptance);
    render(state);
    return acceptance;
  } catch (error) {
    state.notice = `${error.code || error.name || 'ERROR'}: ${error.message || String(error)}`;
    render(state);
    return null;
  }
}

export function createSequentialGeometryEditHistoryFeature(options = {}) {
  const root = options.root;
  if (!root?.querySelector) throw new TypeError('Geometry history feature requires a root.');
  const boundary = options.geometryEditBoundary;
  ['readCurrentState', 'readHistory', 'publishHistoryCandidate'].forEach((name) =>
    requiredFunction(boundary?.[name], `geometryEditBoundary.${name}`));
  const panel = install(root);
  const state = {
    root, boundary, panel, active: false, destroyed: false, notice: null, capability: null,
    undo: required(root, '[data-ssk-geometry-history-undo]'),
    redo: required(root, '[data-ssk-geometry-history-redo]'),
    position: required(root, '[data-ssk-geometry-history-position]'),
    detail: required(root, '[data-ssk-geometry-history-detail]'),
    status: required(root, '[data-ssk-geometry-history-status]'),
    onApplied: requiredFunction(options.onApplied || (() => {}), 'onApplied'),
    service: createSequentialGeometryEditHistoryService({
      readCurrentState: boundary.readCurrentState,
      readHistory: boundary.readHistory,
      publishHistoryCandidate: boundary.publishHistoryCandidate,
      now: requiredFunction(options.now, 'geometry history now'),
    }),
  };
  const undo = () => execute(state, 'UNDO_GEOMETRY_EDIT');
  const redo = () => execute(state, 'REDO_GEOMETRY_EDIT');
  state.undo.addEventListener('click', undo);
  state.redo.addEventListener('click', redo);
  render(state);
  return Object.freeze({
    schema: SEQUENTIAL_GEOMETRY_EDIT_HISTORY_FEATURE_SCHEMA,
    setActive(value) { state.active = value === true && !state.destroyed; render(state); },
    refresh() { render(state); return state.capability; },
    undo, redo,
    getState: () => Object.freeze({ active: state.active,
      canUndo: state.capability?.canUndo === true, canRedo: state.capability?.canRedo === true,
      cursor: state.capability?.cursor ?? 0, totalCount: state.capability?.totalCount ?? 0,
      notice: state.notice, destroyed: state.destroyed }),
    destroy() {
      if (state.destroyed) return false;
      state.destroyed = true; state.undo.removeEventListener('click', undo);
      state.redo.removeEventListener('click', redo); state.panel.remove(); return true;
    },
  });
}