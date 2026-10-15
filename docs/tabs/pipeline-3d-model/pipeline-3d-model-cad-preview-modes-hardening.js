export const PIPELINE_CAD_PREVIEW_MODE_HARDENING_BUILD = '2026.07.13-preview-modes-hardening-2';

const INSTALLED = Symbol.for('pipeline3d.cad.preview-modes.hardening.installed.v2');
const OVERLAY_MODE = 'overlay';
let activeOverlayCanvas = null;

function overlayModalFrom(target) {
  const modal = target?.closest?.('[data-p3d-split="x-modal"]');
  return modal?.dataset?.p3dCadPreviewMode === OVERLAY_MODE ? modal : null;
}

function promoteOriginInput(event) {
  const input = event.target?.closest?.('[data-p3d-cad-z-origin]');
  if (!input || !overlayModalFrom(input)) return;
  const value = Number(input.value);
  if (!Number.isFinite(value)) {
    input.setAttribute('aria-invalid', 'true');
    return;
  }
  input.removeAttribute('aria-invalid');
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function populatedOverlayInspector(modal) {
  const inspector = modal?.querySelector?.('[data-p3d-cad-coordinate-inspector]');
  const projected = inspector?.querySelector?.('[data-p3d-cad-inspector-field="projectedElevation"]');
  if (!inspector || String(projected?.textContent || '').trim() === '—') return null;
  return inspector;
}

function reassertOverlayInspector(event) {
  const canvas = event.target?.closest?.('[data-p3d-cad-overlay-canvas]');
  const modal = canvas ? overlayModalFrom(canvas) : null;
  if (!canvas || !modal) return;
  activeOverlayCanvas = canvas;
  const schedule = globalThis.requestAnimationFrame || ((callback) => globalThis.setTimeout?.(callback, 0));
  schedule(() => {
    if (activeOverlayCanvas !== canvas || modal.dataset.p3dCadPreviewMode !== OVERLAY_MODE) return;
    const inspector = populatedOverlayInspector(modal);
    if (inspector) inspector.dataset.active = 'true';
  });
}

function clearOverlayInspector(event) {
  const canvas = event.target?.closest?.('[data-p3d-cad-overlay-canvas]');
  const modal = canvas ? overlayModalFrom(canvas) : null;
  if (activeOverlayCanvas === canvas) activeOverlayCanvas = null;
  const inspector = modal?.querySelector?.('[data-p3d-cad-coordinate-inspector]');
  if (inspector) inspector.dataset.active = 'false';
}

function installInspectorOrderGuard(doc) {
  const MutationObserverCtor = globalThis.MutationObserver;
  if (typeof MutationObserverCtor !== 'function' || !doc.body) return null;
  const observer = new MutationObserverCtor((records) => {
    if (!activeOverlayCanvas) return;
    const modal = overlayModalFrom(activeOverlayCanvas);
    if (!modal) return;
    for (const record of records) {
      const inspector = record.target;
      if (!inspector?.matches?.('[data-p3d-cad-coordinate-inspector]')) continue;
      if (inspector.dataset.active !== 'false') continue;
      if (inspector !== modal.querySelector('[data-p3d-cad-coordinate-inspector]')) continue;
      if (populatedOverlayInspector(modal)) inspector.dataset.active = 'true';
    }
  });
  observer.observe(doc.body, {
    attributes: true,
    attributeFilter: ['data-active'],
    subtree: true,
  });
  return observer;
}

export function installPipelineCadPreviewModeHardening(doc = globalThis.document) {
  if (!doc?.addEventListener || doc[INSTALLED]) return false;
  const observer = installInspectorOrderGuard(doc);
  Object.defineProperty(doc, INSTALLED, {
    configurable: true,
    value: Object.freeze({ observer }),
  });
  doc.addEventListener('input', promoteOriginInput, true);
  doc.addEventListener('pointermove', reassertOverlayInspector, true);
  doc.addEventListener('pointerleave', clearOverlayInspector, true);
  return true;
}

if (globalThis.document) installPipelineCadPreviewModeHardening(globalThis.document);
