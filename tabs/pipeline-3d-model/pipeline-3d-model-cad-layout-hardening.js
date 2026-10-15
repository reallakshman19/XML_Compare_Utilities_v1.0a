import { InteractiveGraph } from './pipeline-3d-model-interactive-graph.js';

const STYLE_ID = 'pipeline-3d-cad-layout-hardening-style';
const HOST_SELECTOR = '[data-p3d-split="table2x-preview"], [data-p3d-split="table3x-preview"]';
const SIZE_PATCH = Symbol.for('pipeline3d.cad.visible-size.patch.v1');

function ensureStyle(doc = globalThis.document) {
  if (!doc?.head || doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.p3d-cad-host{position:relative!important;min-height:340px;overflow:hidden;contain:layout paint}
.p3d-cad-host>.p3d-cad-stage{position:absolute!important;inset:0;width:auto!important;height:auto!important;min-height:0!important}
.p3d-cad-host>.p3d-cad-stage>canvas{width:100%!important;height:100%!important;min-height:0!important}
`;
  doc.head.appendChild(style);
}

function visibleHostSize(graph) {
  const holder = graph?.canvas?.closest?.(HOST_SELECTOR);
  const rect = holder?.getBoundingClientRect?.() || {};
  // Canvas CSS width:100% resolves against the holder's content box. Prefer
  // client dimensions so the logical/backing-store size does not include borders.
  const width = Math.round(Number(holder?.clientWidth || rect.width || 0));
  const height = Math.round(Number(holder?.clientHeight || rect.height || 0));
  return {
    width: Number.isFinite(width) && width > 0 ? width : null,
    height: Number.isFinite(height) && height > 0 ? height : null,
  };
}

function toolbarSafeTopPadding(graph) {
  const stage = graph?.canvas?.closest?.('[data-p3d-cad-stage]');
  const toolbar = stage?.querySelector?.('.p3d-cad-toolbar');
  if (!stage || !toolbar) return Math.max(40, Number(graph?.padding?.top) || 0);
  const stageRect = stage.getBoundingClientRect?.() || {};
  const toolbarRect = toolbar.getBoundingClientRect?.() || {};
  const occupied = Number(toolbarRect.bottom) - Number(stageRect.top);
  return Number.isFinite(occupied) && occupied > 0 ? Math.max(40, Math.ceil(occupied + 12)) : 40;
}

export function installPipelineCadVisibleSizePatch() {
  const prototype = InteractiveGraph.prototype;
  if (prototype[SIZE_PATCH]) return false;
  const originalSetSize = prototype.setSize;
  Object.defineProperty(prototype, SIZE_PATCH, { value: true });
  prototype.setSize = function setVisiblePipelineCadSize(width, height) {
    const visible = visibleHostSize(this);
    this.padding = { ...this.padding, top: toolbarSafeTopPadding(this) };
    return originalSetSize.call(this, visible.width ?? width, visible.height ?? height);
  };
  return true;
}

export function stabilizePipelineCadHosts(doc = globalThis.document) {
  if (!doc?.querySelectorAll) return 0;
  ensureStyle(doc);
  let changed = 0;
  doc.querySelectorAll(HOST_SELECTOR).forEach((holder) => {
    if (!holder.querySelector(':scope > [data-p3d-cad-stage]')) return;
    if (!holder.classList.contains('p3d-cad-host')) {
      holder.classList.add('p3d-cad-host');
      changed += 1;
    }
    const graph = holder.querySelector('[data-p3d-cad-canvas]')?.__pipelineCadGraph;
    if (graph) {
      const visible = visibleHostSize(graph);
      if (visible.width && visible.height) graph.setSize(visible.width, visible.height);
    }
  });
  return changed;
}

export function installPipelineCadLayoutHardening(doc = globalThis.document) {
  installPipelineCadVisibleSizePatch();
  if (!doc?.body) return null;
  ensureStyle(doc);
  stabilizePipelineCadHosts(doc);
  if (doc.body.dataset.p3dCadLayoutObserver === '1') return null;
  doc.body.dataset.p3dCadLayoutObserver = '1';
  const MutationObserverCtor = globalThis.MutationObserver;
  if (typeof MutationObserverCtor !== 'function') return null;
  const observer = new MutationObserverCtor(() => stabilizePipelineCadHosts(doc));
  observer.observe(doc.body, { childList: true, subtree: true });
  return observer;
}

installPipelineCadVisibleSizePatch();
if (globalThis.document?.body) installPipelineCadLayoutHardening(globalThis.document);
else globalThis.document?.addEventListener?.('DOMContentLoaded', () => installPipelineCadLayoutHardening(globalThis.document), { once: true });
