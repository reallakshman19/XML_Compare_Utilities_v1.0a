/** Explicit operation-mode owner for confirmed-component geometry and topology workflows. */
import { createSequentialAddStraightRequestFeature } from './sequential-add-straight-request-feature.js';
import { createSequentialBridgeGapRequestFeature } from './sequential-bridge-gap-request-feature.js';
import { createSequentialComponentRetirementRequestFeature } from './sequential-component-retirement-request-feature.js';
import { createSequentialDisconnectEndpointRequestFeature } from './sequential-disconnect-endpoint-request-feature.js';
import { createSequentialGeometryEditHistoryFeature } from './sequential-geometry-edit-history-feature.js';
import { createSequentialMergeNodesRequestFeature } from './sequential-merge-nodes-request-feature.js';
import { createSequentialNodeStretchFeature } from './sequential-node-stretch-feature.js';
import { createSequentialPipeSplitFeature } from './sequential-pipe-split-feature.js';
import { createSequentialRotationFeature } from './sequential-rotation-feature.js';
import { createSequentialSingleEntityMoveFeature } from './sequential-single-entity-move-feature.js';
import { createSequentialSplitPipeRequestFeature } from './sequential-split-pipe-request-feature.js';

export const SEQUENTIAL_COMPONENT_EDIT_OPERATIONS_SCHEMA =
  'SequentialComponentEditOperations.v1';
export const SEQUENTIAL_COMPONENT_EDIT_MODE = Object.freeze({
  MOVE_COMPONENT: 'MOVE_COMPONENT',
  STRETCH_NODE: 'STRETCH_NODE',
  ROTATE_SUBGRAPH: 'ROTATE_SUBGRAPH',
  SPLIT_PIPE: 'SPLIT_PIPE',
});

function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
  return value;
}
function required(root, selector) {
  const value = root.querySelector(selector);
  if (!value) throw new Error(`Component edit operation element missing: ${selector}`);
  return value;
}
function markup() {
  return `<section data-ssk-component-edit-mode>
<span>Component operation</span>
<button type="button" data-ssk-component-edit-mode-value="MOVE_COMPONENT">Move component</button>
<button type="button" data-ssk-component-edit-mode-value="STRETCH_NODE">Stretch node</button>
<button type="button" data-ssk-component-edit-mode-value="ROTATE_SUBGRAPH">Rotate</button>
<button type="button" data-ssk-component-edit-mode-value="SPLIT_PIPE">Split pipe</button>
</section>`;
}
function install(root) {
  const host = required(root, '[data-ssk-visual-stack]');
  if (!root.querySelector('[data-ssk-component-edit-mode]')) host.insertAdjacentHTML('beforeend', markup());
  const panel = required(root, '[data-ssk-component-edit-mode]');
  panel.style.cssText = [
    'position:absolute', 'top:12px', 'left:50%', 'transform:translateX(-50%)',
    'z-index:12', 'display:flex', 'align-items:center', 'gap:6px', 'padding:7px',
    'border:1px solid rgba(148,163,184,.4)', 'border-radius:10px',
    'background:rgba(7,16,31,.94)', 'color:#e2e8f0',
  ].join(';');
  panel.querySelectorAll('button').forEach((button) => {
    button.style.cssText = 'padding:6px 8px;border:1px solid rgba(148,163,184,.35);border-radius:7px;background:#172337;color:#dbeafe';
  });
  return panel;
}
function modeValue(value) {
  const mode = String(value || '').trim().toUpperCase();
  if (!Object.values(SEQUENTIAL_COMPONENT_EDIT_MODE).includes(mode)) {
    throw new TypeError(`Unsupported component edit mode: ${value}`);
  }
  return mode;
}
function render(state) {
  state.panel.hidden = !state.active;
  state.panel.setAttribute('aria-hidden', state.active ? 'false' : 'true');
  state.panel.querySelectorAll('[data-ssk-component-edit-mode-value]').forEach((button) => {
    const selected = button.dataset.sskComponentEditModeValue === state.mode;
    button.setAttribute('aria-pressed', selected ? 'true' : 'false');
    button.style.outline = selected ? '2px solid #38bdf8' : 'none';
  });
}
function childActive(state, mode) { return state.active && state.mode === mode; }
function syncActivity(state) {
  state.move.setActive(childActive(state, SEQUENTIAL_COMPONENT_EDIT_MODE.MOVE_COMPONENT));
  state.stretch.setActive(childActive(state, SEQUENTIAL_COMPONENT_EDIT_MODE.STRETCH_NODE));
  state.rotation.setActive(childActive(state, SEQUENTIAL_COMPONENT_EDIT_MODE.ROTATE_SUBGRAPH));
  state.split.setActive(childActive(state, SEQUENTIAL_COMPONENT_EDIT_MODE.SPLIT_PIPE));
  state.history.setActive(state.active);
  state.mergePreview.setActive(state.active); state.bridgePreview.setActive(state.active);
  state.addStraightPreview.setActive(state.active); state.disconnectPreview.setActive(state.active);
  state.splitPreview.setActive(state.active); state.retirementPreview.setActive(state.active); render(state);
}
function clear(state, reason = 'component-edit-cleared') {
  state.move.clearTarget(reason); state.stretch.clearTarget(reason);
  state.rotation.clearTarget(reason); state.split.clearTarget(reason);
  state.mergePreview.clear(reason); state.bridgePreview.clear(reason);
  state.addStraightPreview.clear(reason); state.disconnectPreview.clear(reason);
  state.splitPreview.clear(reason); state.retirementPreview.clear(reason);
  state.history?.refresh(); return null;
}
function setMode(state, value) {
  if (state.destroyed) throw new Error('Component edit operations are destroyed.');
  const mode = modeValue(value);
  if (mode === state.mode) return mode;
  clear(state, 'component-operation-mode-change'); state.mode = mode;
  syncActivity(state); state.onModeChanged(mode); return mode;
}
function assertGeometryModeAvailable(state) {
  if (state.topologyEditBoundary.readJournal().cursor > 0) {
    throw new RangeError('Undo all active pipe splits before using move, stretch or rotate.');
  }
}
function select(state, objectId) {
  if (state.mode === SEQUENTIAL_COMPONENT_EDIT_MODE.SPLIT_PIPE) {
    return { mode: state.mode, target: state.split.select(objectId) };
  }
  assertGeometryModeAvailable(state);
  if (state.mode === SEQUENTIAL_COMPONENT_EDIT_MODE.STRETCH_NODE) {
    return { mode: state.mode, target: state.stretch.select(objectId) };
  }
  if (state.mode === SEQUENTIAL_COMPONENT_EDIT_MODE.ROTATE_SUBGRAPH) {
    return { mode: state.mode, target: state.rotation.select(objectId) };
  }
  return { mode: state.mode, target: state.move.select(objectId) };
}
function restoreRecovery(state, record) {
  const mode = modeValue(record?.kind);
  if (mode === SEQUENTIAL_COMPONENT_EDIT_MODE.SPLIT_PIPE) {
    throw new TypeError('Pipe split pending-draft recovery is not part of SSK-TS-3Q.');
  }
  setMode(state, mode);
  if (mode === SEQUENTIAL_COMPONENT_EDIT_MODE.STRETCH_NODE) return state.stretch.restoreRecovery(record);
  if (mode === SEQUENTIAL_COMPONENT_EDIT_MODE.ROTATE_SUBGRAPH) return state.rotation.restoreRecovery(record);
  return state.move.restoreRecovery(record);
}
function bind(state) {
  state.onClick = (event) => {
    const button = event.target?.closest?.('[data-ssk-component-edit-mode-value]');
    if (!button) return;
    event.preventDefault(); event.stopImmediatePropagation();
    setMode(state, button.dataset.sskComponentEditModeValue);
  };
  state.panel.addEventListener('click', state.onClick, true);
}
function destroy(state) {
  if (state.destroyed) return false;
  state.destroyed = true; state.panel.removeEventListener('click', state.onClick, true);
  state.move.destroy(); state.stretch.destroy(); state.rotation.destroy(); state.split.destroy();
  state.history.destroy(); state.mergePreview.destroy(); state.bridgePreview.destroy();
  state.addStraightPreview.destroy(); state.disconnectPreview.destroy();
  state.splitPreview.destroy(); state.retirementPreview.destroy();
  state.panel.remove(); return true;
}
function recoveryCallbacks(options, kind) {
  return {
    onRecoveryDraft: (descriptor) => options.onRecoveryDraft(kind, descriptor),
    onRecoveryClear: (reason) => options.onRecoveryClear(kind, reason),
  };
}
function createMove(options) {
  return createSequentialSingleEntityMoveFeature({
    root: options.root, readScene: options.readScene, readModel: options.readModel,
    readViewer: options.readViewer, onDraftChanged: options.onDraftChanged,
    geometryEditBoundary: options.geometryEditBoundary, applicationNow: options.applicationNow,
    ...recoveryCallbacks(options, 'MOVE_COMPONENT'),
  });
}
function createStretch(options) {
  return createSequentialNodeStretchFeature({
    root: options.root, readScene: options.readScene, readModel: options.readModel,
    onDraftChanged: options.onDraftChanged, geometryEditBoundary: options.geometryEditBoundary,
    applicationNow: options.applicationNow, ...recoveryCallbacks(options, 'STRETCH_NODE'),
  });
}
function createRotation(options) {
  return createSequentialRotationFeature({
    root: options.root, readScene: options.readScene, readModel: options.readModel,
    readViewer: options.readViewer, onDraftChanged: options.onDraftChanged,
    geometryEditBoundary: options.geometryEditBoundary,
    applicationNow: options.applicationNow, ...recoveryCallbacks(options, 'ROTATE_SUBGRAPH'),
  });
}
function createSplit(options) {
  return createSequentialPipeSplitFeature({
    root: options.root, readScene: options.readScene, readModel: options.readModel,
    onDraftChanged: options.onDraftChanged, topologyEditBoundary: options.topologyEditBoundary,
    applicationNow: options.applicationNow, onAccepted: options.onTopologyAccepted,
  });
}
function createHistory(options, state) {
  return createSequentialGeometryEditHistoryFeature({
    root: options.root, geometryEditBoundary: options.geometryEditBoundary,
    now: options.applicationNow,
    onApplied: () => {
      clear(state, 'Geometry draft invalidated because history authority changed.');
      options.onDraftChanged(null);
    },
  });
}
function createMergePreview(options) {
  return createSequentialMergeNodesRequestFeature({ root: options.root, readModel: options.readModel });
}
function createBridgePreview(options) {
  return createSequentialBridgeGapRequestFeature({ root: options.root, readModel: options.readModel });
}
function createAddStraightPreview(options) {
  return createSequentialAddStraightRequestFeature({ root: options.root, readModel: options.readModel });
}
function createDisconnectPreview(options) {
  return createSequentialDisconnectEndpointRequestFeature({ root: options.root, readModel: options.readModel });
}
function createSplitPreview(options) {
  return createSequentialSplitPipeRequestFeature({ root: options.root, readModel: options.readModel });
}
function createRetirementPreview(options) {
  return createSequentialComponentRetirementRequestFeature({ root: options.root, readModel: options.readModel });
}
export function createSequentialComponentEditOperations(options = {}) {
  const root = options.root; if (!root?.querySelector) throw new TypeError(
    'Component edit operations require a root.');
  if (!options.topologyEditBoundary?.readJournal) throw new TypeError(
    'Component edit operations require topology edit boundary.');
  const state = { panel: install(root), mode: SEQUENTIAL_COMPONENT_EDIT_MODE.MOVE_COMPONENT,
    active: false, destroyed: false, move: null, stretch: null, rotation: null, split: null,
    history: null, topologyEditBoundary: options.topologyEditBoundary, mergePreview: null,
    bridgePreview: null, addStraightPreview: null, disconnectPreview: null, splitPreview: null,
    retirementPreview: null, onClick: null,
    onModeChanged: requiredFunction(options.onModeChanged || (() => {}), 'onModeChanged') };
  const shared = { ...options, onDraftChanged: requiredFunction(options.onDraftChanged, 'onDraftChanged'),
    onRecoveryDraft: requiredFunction(options.onRecoveryDraft || (() => {}), 'onRecoveryDraft'),
    onRecoveryClear: requiredFunction(options.onRecoveryClear || (() => {}), 'onRecoveryClear') };
  state.move = createMove(shared); state.stretch = createStretch(shared); state.rotation = createRotation(shared);
  state.split = createSplit(shared);
  state.history = createHistory(shared, state); state.mergePreview = createMergePreview(shared);
  state.bridgePreview = createBridgePreview(shared); state.addStraightPreview = createAddStraightPreview(shared);
  state.disconnectPreview = createDisconnectPreview(shared); state.splitPreview = createSplitPreview(shared);
  state.retirementPreview = createRetirementPreview(shared); bind(state); syncActivity(state);
  return Object.freeze({ schema: SEQUENTIAL_COMPONENT_EDIT_OPERATIONS_SCHEMA,
    setActive(value) { state.active = value === true && !state.destroyed; syncActivity(state); },
    setMode: (value) => setMode(state, value), select: (objectId) => select(state, objectId),
    restoreRecovery: (record) => restoreRecovery(state, record),
    clear: (reason) => clear(state, reason), invalidate: (reason) => clear(state, reason || 'authority-change'),
    getMoveDraft: state.move.getDraft, getStretchDraft: state.stretch.getDraft,
    getRotationDraft: state.rotation.getDraft, getSplitDraft: state.split.getDraft,
    getMergePreview: state.mergePreview.getPreview, getBridgePreview: state.bridgePreview.getPreview,
    getAddStraightPreview: state.addStraightPreview.getPreview,
    getDisconnectPreview: state.disconnectPreview.getPreview, getSplitPreview: state.splitPreview.getPreview,
    getRetirementPreview: state.retirementPreview.getPreview,
    getState: () => Object.freeze({ active: state.active, mode: state.mode,
      move: state.move.getState(), stretch: state.stretch.getState(), rotation: state.rotation.getState(),
      split: state.split.getState(), history: state.history.getState(),
      mergePreview: state.mergePreview.getState(), bridgePreview: state.bridgePreview.getState(),
      addStraightPreview: state.addStraightPreview.getState(),
      disconnectPreview: state.disconnectPreview.getState(), splitPreview: state.splitPreview.getState(),
      retirementPreview: state.retirementPreview.getState(), destroyed: state.destroyed }),
    destroy: () => destroy(state) });
}
