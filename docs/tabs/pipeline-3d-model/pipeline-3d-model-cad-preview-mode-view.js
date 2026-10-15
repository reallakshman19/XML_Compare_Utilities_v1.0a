import {
  PIPELINE_CAD_OVERLAY_FORMULA,
  PIPELINE_CAD_PREVIEW_MODE_OVERLAY,
  PIPELINE_CAD_PREVIEW_MODE_SIDE_BY_SIDE,
} from './pipeline-3d-model-cad-preview-mode-state.js';

const STYLE_ID = 'pipeline-3d-cad-preview-modes-style';

export function ensurePipelineCadPreviewModeStyle(doc = globalThis.document) {
  if (!doc?.head || doc.getElementById(STYLE_ID)) return false;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.p3d-cad-preview-body{position:relative;display:block;flex:1;min-height:0;overflow:hidden}
.p3d-cad-preview-body>.p3d-x-content{height:100%;min-height:0}
.p3d-cad-preview-body[data-preview-mode="side-by-side"]{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}
.p3d-cad-preview-body[data-preview-mode="side-by-side"]>.p3d-x-content[data-x-content="table2x"],.p3d-cad-preview-body[data-preview-mode="side-by-side"]>.p3d-x-content[data-x-content="table3x"]{display:block!important;border:1px solid rgba(148,163,184,.26);border-radius:8px;overflow:hidden}
.p3d-cad-preview-body[data-preview-mode="overlay"]>.p3d-x-content[data-x-content="overlay"]{display:block!important}
.p3d-cad-overlay-stage{position:relative;width:100%;height:100%;min-height:340px;background:#07111f;overflow:hidden}
.p3d-cad-overlay-stage canvas{display:block;width:100%;height:100%;outline:none;touch-action:none;cursor:crosshair}
.p3d-cad-overlay-controls{position:absolute;z-index:4;left:12px;top:12px;display:flex;align-items:center;gap:8px;max-width:calc(100% - 24px);padding:7px 9px;border:1px solid rgba(148,163,184,.36);border-radius:8px;background:rgba(15,23,42,.94);color:#e2e8f0;font:11px ui-monospace,monospace}
.p3d-cad-overlay-controls input{width:92px;border:1px solid #475569;border-radius:4px;background:#020617;color:#f8fafc;padding:4px 6px}
.p3d-cad-overlay-formula{color:#fdba74}.p3d-cad-overlay-status{position:absolute;right:12px;bottom:10px;padding:4px 7px;border-radius:5px;background:rgba(2,6,23,.76);color:#94a3b8;font:10px ui-monospace,monospace}
.p3d-cad-overlay-legend{position:absolute;left:14px;bottom:10px;display:flex;gap:12px;padding:5px 8px;background:rgba(2,6,23,.76);color:#cbd5e1;font:10px ui-monospace,monospace}
.p3d-cad-overlay-swatch{display:inline-block;width:20px;border-top:2px solid currentColor}.p3d-cad-overlay-swatch[data-kind="elevation"]{color:#38bdf8}.p3d-cad-overlay-swatch[data-kind="projected-z"]{color:#fb923c;border-top-style:dashed}
`;
  doc.head.appendChild(style);
  return true;
}

function addModeTab(tabs, mode, label) {
  let tab = tabs.querySelector(`[data-x-tab="${mode}"]`);
  if (tab) return { tab, created: false };
  tab = tabs.ownerDocument.createElement('button');
  tab.type = 'button';
  tab.className = 'p3d-x-tab';
  tab.dataset.xTab = mode;
  tab.dataset.active = 'false';
  tab.setAttribute('role', 'tab');
  tab.textContent = label;
  tabs.appendChild(tab);
  return { tab, created: true };
}

function overlayHtml() {
  return `<div class="p3d-cad-overlay-stage" data-p3d-cad-overlay-stage>
  <div class="p3d-cad-overlay-controls"><label>Z-origin elevation (m) <input type="number" step="0.1" data-p3d-cad-z-origin></label><button type="button" data-p3d-cad-z-origin-start>Use Table 2 start</button><span class="p3d-cad-overlay-formula">${PIPELINE_CAD_OVERLAY_FORMULA}</span></div>
  <canvas data-p3d-cad-overlay-canvas tabindex="0" aria-label="Review-only Pipeline CAD overlay"></canvas>
  <div class="p3d-cad-overlay-legend" aria-hidden="true"><span><i class="p3d-cad-overlay-swatch" data-kind="elevation"></i>Table 2X elevation</span><span><i class="p3d-cad-overlay-swatch" data-kind="projected-z"></i>Projected Z</span></div>
  <div class="p3d-cad-overlay-status" data-p3d-cad-overlay-status>Overlay waiting for model</div></div>`;
}

export function preparePipelineCadPreviewView(dialog) {
  const modal = dialog?.querySelector?.('[data-p3d-split="x-modal"]');
  const tabs = modal?.querySelector?.('.p3d-x-tabs');
  if (!modal || !tabs) throw new Error('Pipeline CAD preview modal is incomplete.');
  ensurePipelineCadPreviewModeStyle(dialog.ownerDocument || globalThis.document);
  tabs.setAttribute('role', 'tablist');
  const insertedTabs = [
    addModeTab(tabs, PIPELINE_CAD_PREVIEW_MODE_SIDE_BY_SIDE, 'Side by Side'),
    addModeTab(tabs, PIPELINE_CAD_PREVIEW_MODE_OVERLAY, 'Overlay'),
  ].filter((entry) => entry.created).map((entry) => entry.tab);
  const originalContents = Array.from(modal.querySelectorAll(':scope > .p3d-x-content'));
  const body = dialog.ownerDocument.createElement('div');
  body.className = 'p3d-cad-preview-body';
  body.dataset.p3dCadPreviewBody = '1';
  modal.insertBefore(body, originalContents[0]);
  originalContents.forEach((content) => body.appendChild(content));
  const overlayContent = dialog.ownerDocument.createElement('div');
  overlayContent.className = 'p3d-x-content';
  overlayContent.dataset.xContent = PIPELINE_CAD_PREVIEW_MODE_OVERLAY;
  overlayContent.dataset.active = 'false';
  overlayContent.innerHTML = overlayHtml();
  body.appendChild(overlayContent);
  return {
    modal,
    tabs,
    body,
    overlayContent,
    destroy() {
      originalContents.forEach((content) => modal.insertBefore(content, body));
      overlayContent.remove();
      body.remove();
      insertedTabs.forEach((tab) => tab.remove());
      delete modal.dataset.p3dCadPreviewMode;
    },
  };
}
