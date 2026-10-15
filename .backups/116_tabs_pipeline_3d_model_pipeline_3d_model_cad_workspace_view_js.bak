import { GraphTool } from './pipeline-3d-model-interactive-graph.js';

export const PIPELINE_CAD_CANVAS_STORAGE_KEY = 'pipeline3dCadCanvas';
const STYLE_ID = 'pipeline-3d-cad-workspace-style';

function truthy(value) {
  return ['1', 'true', 'enabled', 'on', 'yes'].includes(String(value ?? '').toLowerCase());
}

export function isPipelineCadCanvasEnabled(options = {}) {
  try {
    const params = new URLSearchParams((options.location ?? globalThis.location)?.search || '');
    if (truthy(params.get('pipelineCadCanvas'))) return true;
  } catch {
    // Invalid locations do not override persistence.
  }
  try {
    return truthy((options.storage ?? globalThis.localStorage)?.getItem?.(PIPELINE_CAD_CANVAS_STORAGE_KEY));
  } catch {
    return false;
  }
}

export function setPipelineCadCanvasEnabled(enabled, storage = globalThis.localStorage) {
  try {
    if (enabled) storage?.setItem?.(PIPELINE_CAD_CANVAS_STORAGE_KEY, '1');
    else storage?.removeItem?.(PIPELINE_CAD_CANVAS_STORAGE_KEY);
  } catch {
    // Renderer preference is best-effort only.
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
}

export function buildPipelineCadStageHtml(graphName) {
  const isTable3 = graphName === 'table3x';
  const tools = [
    [GraphTool.SELECT, 'Select'],
    [GraphTool.ADD_NODE, isTable3 ? 'Add Z' : 'Add V'],
    ...(isTable3 ? [[GraphTool.ADD_MARKER, 'Add Marker']] : []),
    [GraphTool.DELETE, 'Delete'],
    [GraphTool.PAN, 'Pan'],
  ];
  return `<div class="p3d-cad-stage" data-p3d-cad-stage="${escapeHtml(graphName)}">
  <svg data-p3d-cad-sentinel="1" aria-hidden="true" width="0" height="0" style="display:none"></svg>
  <div class="p3d-cad-toolbar" role="toolbar" aria-label="${isTable3 ? 'Table 3X' : 'Table 2X'} CAD tools">
    ${tools.map(([tool, label], index) => `<button type="button" data-p3d-cad-tool="${tool}" aria-pressed="${index === 0 ? 'true' : 'false'}">${label}</button>`).join('')}
    <span class="p3d-cad-toolbar-separator" aria-hidden="true"></span>
    <button type="button" data-p3d-cad-action="fit">Fit</button><button type="button" data-p3d-cad-action="reload">Reload Graph</button><button type="button" data-p3d-cad-action="undo" disabled>Undo</button><button type="button" data-p3d-cad-action="redo" disabled>Redo</button>
  </div>
  <canvas data-p3d-cad-canvas="${escapeHtml(graphName)}" tabindex="0" aria-label="${isTable3 ? 'Interactive Table 3X depth and marker graph' : 'Interactive Table 2X elevation graph'}"></canvas>
  <input class="p3d-cad-inline-editor" data-p3d-cad-inline-editor="${escapeHtml(graphName)}" hidden aria-label="Edit selected graph value">
  <div class="p3d-cad-status" data-p3d-cad-status="${escapeHtml(graphName)}">CAD Canvas</div>
</div>`;
}

export function ensurePipelineCadWorkspaceStyle(doc = globalThis.document) {
  if (!doc?.head || doc.getElementById(STYLE_ID)) return false;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.p3d-cad-stage{position:relative;width:100%;height:100%;min-height:340px;background:#0b1220;overflow:hidden}.p3d-cad-stage canvas{display:block;width:100%;height:100%;min-height:340px;outline:none;cursor:crosshair;touch-action:none}.p3d-cad-toolbar{position:absolute;z-index:3;left:12px;top:12px;display:flex;align-items:center;gap:5px;flex-wrap:wrap;max-width:calc(100% - 24px);padding:6px;border:1px solid rgba(148,163,184,.35);border-radius:8px;background:rgba(15,23,42,.92)}.p3d-cad-toolbar button{border:1px solid #475569;border-radius:6px;background:#1e293b;color:#e2e8f0;padding:5px 9px;font-size:11px}.p3d-cad-toolbar button[aria-pressed="true"]{background:#38bdf8;color:#082f49}.p3d-cad-toolbar button:disabled{opacity:.42}.p3d-cad-toolbar-separator{width:1px;height:22px;background:#475569}.p3d-cad-inline-editor{position:absolute;z-index:5;width:120px;border:1px solid #38bdf8;border-radius:5px;background:#020617;color:#f8fafc;padding:5px 7px;font:12px monospace}.p3d-cad-status{position:absolute;z-index:2;right:10px;bottom:8px;padding:3px 7px;background:rgba(2,6,23,.72);color:#94a3b8;font:10px monospace}.p3d-cad-status[data-state="error"]{color:#fecaca}
`;
  doc.head.appendChild(style);
  return true;
}

function sizeGraph(graph, holder) {
  const rect = holder?.getBoundingClientRect?.() || {};
  graph.setSize(
    Math.max(320, Math.round(rect.width || holder?.clientWidth || 1000)),
    Math.max(340, Math.round(rect.height || holder?.clientHeight || 500)),
  );
}

export function createPipelineCadWorkspaceView(dialog) {
  const table2Holder = dialog.querySelector('[data-p3d-split="table2x-preview"]');
  const table3Holder = dialog.querySelector('[data-p3d-split="table3x-preview"]');
  if (!table2Holder || !table3Holder) throw new Error('Pipeline CAD preview holders are missing.');
  ensurePipelineCadWorkspaceStyle(dialog.ownerDocument || globalThis.document);
  const originals = { table2x: table2Holder.innerHTML, table3x: table3Holder.innerHTML };
  table2Holder.innerHTML = buildPipelineCadStageHtml('table2x');
  table3Holder.innerHTML = buildPipelineCadStageHtml('table3x');
  const stages = {
    table2x: table2Holder.querySelector('[data-p3d-cad-stage="table2x"]'),
    table3x: table3Holder.querySelector('[data-p3d-cad-stage="table3x"]'),
  };
  const canvases = {
    table2x: stages.table2x.querySelector('[data-p3d-cad-canvas="table2x"]'),
    table3x: stages.table3x.querySelector('[data-p3d-cad-canvas="table3x"]'),
  };
  return Object.freeze({
    holders: { table2x: table2Holder, table3x: table3Holder },
    stages,
    canvases,
    resize(graphs) {
      sizeGraph(graphs.table2x, table2Holder);
      sizeGraph(graphs.table3x, table3Holder);
    },
    destroy() {
      table2Holder.innerHTML = originals.table2x;
      table3Holder.innerHTML = originals.table3x;
    },
  });
}
