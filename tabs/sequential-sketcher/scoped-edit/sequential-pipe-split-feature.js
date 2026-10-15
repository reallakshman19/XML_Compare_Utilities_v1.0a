/** Contained split-target, preview and supervised application lifecycle. */
import { createSequentialPipeSplitApplicationService } from './sequential-pipe-split-application.js';
import { createSequentialPipeSplitApplicationPanel } from './sequential-pipe-split-application-panel.js';
import { createSequentialPipeSplitDraftStore } from './sequential-pipe-split-draft.js';
import { createSequentialPipeSplitPanel } from './sequential-pipe-split-panel.js';
import { selectSequentialPipeSplitTarget } from './sequential-pipe-split-target.js';

export const SEQUENTIAL_PIPE_SPLIT_FEATURE_SCHEMA = 'SequentialPipeSplitFeature.v1';
function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
  return value;
}
function clear(state, reason = 'pipe-split-cleared') {
  state.store.cancel(reason); state.target = null;
  state.panel.clear(); state.applicationPanel.clear(); state.onDraftChanged(); return null;
}
function stage(state, input) {
  if (!state.target) throw new RangeError('Select one qualified PIPE before previewing a split.');
  const preview = state.store.stage({ target: state.target, ...input });
  state.panel.setPreview(preview); state.applicationPanel.setPreview(preview);
  state.onDraftChanged(); return preview;
}
function select(state, objectId) {
  clear(state, 'replace-pipe-split-target');
  state.target = selectSequentialPipeSplitTarget({ objectId,
    readModel: state.readModel(), scene: state.readScene() });
  state.panel.setTarget(state.target); return state.target;
}
function prepare(state, operator) {
  const preview = state.store.getDraft();
  if (!preview) throw new RangeError('Preview one split before preparation.');
  return state.service.prepare(preview, operator);
}
function apply(state, prepared) {
  const result = state.service.accept(prepared);
  if (result.accepted) clear(state, 'split-accepted');
  state.onAccepted(result); return result;
}
export function createSequentialPipeSplitFeature(options = {}) {
  const state = { readScene: requiredFunction(options.readScene, 'readScene'),
    readModel: requiredFunction(options.readModel, 'readModel'),
    onDraftChanged: requiredFunction(options.onDraftChanged, 'onDraftChanged'),
    onAccepted: requiredFunction(options.onAccepted || (() => {}), 'onAccepted'),
    target: null, active: false, destroyed: false,
    store: createSequentialPipeSplitDraftStore(), panel: null,
    applicationPanel: null, service: null };
  const boundary = options.topologyEditBoundary;
  if (!boundary?.readView || !boundary?.publishCandidate) {
    throw new TypeError('Pipe split feature requires SequentialTopologyEditBoundary.v1.');
  }
  state.service = createSequentialPipeSplitApplicationService({
    readCurrentState: boundary.readCurrentState, readView: boundary.readView,
    readJournal: boundary.readJournal, publishCandidate: boundary.publishCandidate,
    now: requiredFunction(options.applicationNow, 'applicationNow') });
  state.panel = createSequentialPipeSplitPanel({ root: options.root,
    onPreview: (input) => stage(state, input), onCancel: (reason) => clear(state, reason) });
  state.applicationPanel = createSequentialPipeSplitApplicationPanel({ root: options.root,
    onPrepare: (operator) => prepare(state, operator),
    onApply: (prepared) => apply(state, prepared),
    onDiscard: () => state.applicationPanel.clear() });
  return Object.freeze({ schema: SEQUENTIAL_PIPE_SPLIT_FEATURE_SCHEMA,
    setActive(value) { state.active = value === true && !state.destroyed;
      state.panel.setActive(state.active); state.applicationPanel.setActive(state.active); },
    select: (objectId) => select(state, objectId),
    clearTarget: (reason) => clear(state, reason), invalidate: (reason) => clear(state, reason),
    getDraft: () => state.store.getDraft(),
    getState: () => Object.freeze({ active: state.active,
      targetId: state.target?.splitTargetId || null,
      operationId: state.store.getDraft()?.operationId || null,
      panel: state.panel.getState(), application: state.applicationPanel.getState(),
      destroyed: state.destroyed }),
    destroy() { if (state.destroyed) return false; state.destroyed = true;
      state.panel.destroy(); state.applicationPanel.destroy(); state.store.destroy(); return true; } });
}
