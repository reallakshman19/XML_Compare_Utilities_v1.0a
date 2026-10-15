import {
  PIPELINE_CAD_PREVIEW_MODE_OVERLAY,
  PIPELINE_CAD_PREVIEW_MODE_SIDE_BY_SIDE,
  PIPELINE_CAD_PREVIEW_MODE_TABLE2,
  PIPELINE_CAD_PREVIEW_MODE_TABLE3,
  normalizePipelineCadPreviewMode,
  readPipelineCadPreviewMode,
  writePipelineCadPreviewMode,
} from './pipeline-3d-model-cad-preview-mode-state.js';
import { mountPipelineCadOverlay } from './pipeline-3d-model-cad-preview-mode-overlay.js';
import { preparePipelineCadPreviewView } from './pipeline-3d-model-cad-preview-mode-view.js';

export * from './pipeline-3d-model-cad-preview-mode-state.js';
export { buildPipelineCadOverlayModel } from './pipeline-3d-model-cad-preview-mode-overlay.js';

function setContentActive(body, name, active) {
  const content = body.querySelector(`[data-x-content="${name}"]`);
  if (content) content.dataset.active = active ? 'true' : 'false';
}

function applyModeDom(lifecycle, mode) {
  const { view } = lifecycle;
  view.modal.dataset.p3dCadPreviewMode = mode;
  view.body.dataset.previewMode = mode;
  view.tabs.querySelectorAll('[data-x-tab]').forEach((tab) => {
    const active = tab.dataset.xTab === mode;
    tab.dataset.active = active ? 'true' : 'false';
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  setContentActive(view.body, PIPELINE_CAD_PREVIEW_MODE_TABLE2,
    mode === PIPELINE_CAD_PREVIEW_MODE_TABLE2 || mode === PIPELINE_CAD_PREVIEW_MODE_SIDE_BY_SIDE);
  setContentActive(view.body, PIPELINE_CAD_PREVIEW_MODE_TABLE3,
    mode === PIPELINE_CAD_PREVIEW_MODE_TABLE3 || mode === PIPELINE_CAD_PREVIEW_MODE_SIDE_BY_SIDE);
  setContentActive(view.body, PIPELINE_CAD_PREVIEW_MODE_OVERLAY,
    mode === PIPELINE_CAD_PREVIEW_MODE_OVERLAY);
}

function dispatchMode(lifecycle) {
  const CustomEventCtor = lifecycle.view.modal.ownerDocument?.defaultView?.CustomEvent || globalThis.CustomEvent;
  lifecycle.view.modal.dispatchEvent(new CustomEventCtor('pipelineCadPreviewModeChanged', {
    detail: { mode: lifecycle.state.mode },
  }));
}

function persist(lifecycle) {
  lifecycle.state = writePipelineCadPreviewMode({
    mode: lifecycle.state.mode,
    zOriginElevation: lifecycle.overlay.origin,
  }, lifecycle.storage);
}

function setMode(lifecycle, requested, options = {}) {
  const next = normalizePipelineCadPreviewMode({ mode: requested }).mode;
  lifecycle.state = normalizePipelineCadPreviewMode({
    mode: next,
    zOriginElevation: lifecycle.overlay.origin,
  });
  applyModeDom(lifecycle, next);
  lifecycle.overlay.setActive(next === PIPELINE_CAD_PREVIEW_MODE_OVERLAY);
  if (options.persist !== false) persist(lifecycle);
  lifecycle.resize?.();
  dispatchMode(lifecycle);
  return next;
}

export function mountPipelineCadPreviewModes(options = {}) {
  const { dialog, controller, resize } = options;
  if (!dialog || !controller) throw new TypeError('Pipeline CAD preview lifecycle requires dialog and controller.');
  const storage = options.storage ?? globalThis.localStorage;
  const view = options.view || preparePipelineCadPreviewView(dialog);
  const saved = readPipelineCadPreviewMode(storage);
  let lifecycle = null;
  const overlay = mountPipelineCadOverlay({
    modal: view.modal,
    overlayContent: view.overlayContent,
    controller,
    initialOrigin: saved.zOriginElevation,
    onOriginChange: () => { if (lifecycle) persist(lifecycle); },
  });
  lifecycle = { dialog, controller, resize, storage, view, overlay, state: saved, cleanup: [], destroyed: false };

  const onTab = (event) => {
    const tab = event.target?.closest?.('.p3d-x-tab[data-x-tab]');
    if (!tab || !view.tabs.contains(tab)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    setMode(lifecycle, tab.dataset.xTab);
  };
  const onController = () => overlay.render();
  view.modal.addEventListener('click', onTab, true);
  ['modelChanged', 'commandCommitted', 'historyApplied', 'graphsReloaded']
    .forEach((type) => controller.addEventListener(type, onController));
  lifecycle.cleanup.push(() => view.modal.removeEventListener('click', onTab, true));
  lifecycle.cleanup.push(() => ['modelChanged', 'commandCommitted', 'historyApplied', 'graphsReloaded']
    .forEach((type) => controller.removeEventListener(type, onController)));
  setMode(lifecycle, saved.mode, { persist: false });

  return Object.freeze({
    get mode() { return lifecycle.state.mode; },
    get zOriginElevation() { return lifecycle.overlay.origin; },
    setMode: (mode) => setMode(lifecycle, mode),
    renderOverlay: () => overlay.render(),
    destroy() {
      if (lifecycle.destroyed) return false;
      lifecycle.destroyed = true;
      lifecycle.cleanup.splice(0).forEach((dispose) => dispose());
      overlay.destroy();
      if (!options.view) view.destroy();
      return true;
    },
  });
}
