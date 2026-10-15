import {
  persistPipelineCadFloatingPreviewRect,
  readPipelineCadFloatingPreviewRect,
} from './pipeline-3d-model-cad-floating-preview.js';

const PANEL_SELECTOR = '[data-p3d-split="x-modal"]';
const FLOATING_SELECTOR = '[data-p3d-floating-preview="1"]';
const INSTALL_STATE = Symbol.for('pipeline3d.cad.floating-preview.hardening.install-state.v1');

export function hardenPipelineCadFloatingPreviewHosts(doc = globalThis.document) {
  if (!doc?.querySelectorAll) return Object.freeze({ restored: 0, repaired: 0 });
  const target = doc.defaultView || globalThis;
  const storage = target.localStorage || globalThis.localStorage;
  let restored = 0;
  let repaired = 0;

  doc.querySelectorAll(`${PANEL_SELECTOR}${FLOATING_SELECTOR}`).forEach((panel) => {
    if (!panel.querySelector('.p3d-x-modal-head')) {
      delete panel.dataset.p3dFloatingPreview;
      delete panel.dataset.p3dFloatingPreviewBuild;
      restored += 1;
      return;
    }
    if (panel.dataset.p3dFloatingPreviewGeometryHardened === '1') return;
    const rect = readPipelineCadFloatingPreviewRect(storage, target);
    persistPipelineCadFloatingPreviewRect(rect, storage, target);
    panel.dataset.p3dFloatingPreviewGeometryHardened = '1';
    repaired += 1;
  });

  return Object.freeze({ restored, repaired });
}

export function restoreNonWindowPipelineCadHosts(doc = globalThis.document) {
  return hardenPipelineCadFloatingPreviewHosts(doc).restored;
}

export function installPipelineCadFloatingPreviewHardening(doc = globalThis.document) {
  if (!doc?.body) return null;
  const target = doc.defaultView || globalThis;
  const state = target[INSTALL_STATE] || { observer: null };
  if (!target[INSTALL_STATE]) {
    Object.defineProperty(target, INSTALL_STATE, { configurable: true, value: state });
  }
  const harden = () => hardenPipelineCadFloatingPreviewHosts(doc);
  harden();
  if (state.observer) return state.observer;
  const MutationObserverCtor = target.MutationObserver || globalThis.MutationObserver;
  if (typeof MutationObserverCtor !== 'function') return null;
  state.observer = new MutationObserverCtor(harden);
  state.observer.observe(doc.body, { childList: true, subtree: true });
  return state.observer;
}

if (globalThis.document?.body) installPipelineCadFloatingPreviewHardening(globalThis.document);
else globalThis.document?.addEventListener?.('DOMContentLoaded', () => installPipelineCadFloatingPreviewHardening(globalThis.document), { once: true });
