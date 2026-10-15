import {
  WorkbenchViewportCapability,
  buildWorkbenchViewportShellModel,
  positionWorkbenchPalette,
} from '../../core/workbench-viewport/index.js';

const STYLE_ID = 'pipeline-3d-cad-viewport-shell-style';
const SOURCE = Object.freeze({
  namespace: 'pipeline-cad',
  surfaceId: 'table2x',
  modeId: 'pipeline-profile',
  capabilities: Object.freeze([
    WorkbenchViewportCapability.FIT,
    WorkbenchViewportCapability.RANGE,
    WorkbenchViewportCapability.SCALE_RATIO,
    WorkbenchViewportCapability.GRID,
    WorkbenchViewportCapability.MINOR_GRID,
    WorkbenchViewportCapability.CROSSHAIR,
    WorkbenchViewportCapability.LINK_X,
  ]),
  statusSegments: () => ['Pipeline CAD'],
});

export function pipelineCadViewportShellModel() {
  return buildWorkbenchViewportShellModel(SOURCE, {
    surfaces: [
      Object.freeze({ id: 'table2x', label: 'Table 2X' }),
      Object.freeze({ id: 'table3x', label: 'Table 3X' }),
    ],
    extensionActions: [
      Object.freeze({ id: 'grid-snap', label: 'Grid Snap' }),
      Object.freeze({ id: 'station-snap', label: 'Station Snap' }),
      Object.freeze({ id: 'snap', label: 'Snap Settings' }),
    ],
  });
}

export function ensurePipelineCadViewportShellStyle(doc = globalThis.document) {
  if (!doc?.head || doc.getElementById(STYLE_ID)) return false;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.p3d-cad-viewbar{position:relative;display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:6px 8px;margin:0 0 7px;border:1px solid #334155;background:#0b1220;color:#cbd5e1;font:11px ui-monospace,monospace}
.p3d-cad-viewbar button,.p3d-cad-viewbar select,.p3d-cad-viewbar input{border:1px solid #475569;border-radius:3px;background:#111c2e;color:#e2e8f0;padding:4px 6px;font:11px ui-monospace,monospace}.p3d-cad-viewbar input{width:68px}.p3d-cad-viewbar button[aria-pressed="true"]{background:#0ea5e9;color:#082f49;font-weight:700}.p3d-cad-viewbar button:disabled,.p3d-cad-viewbar input:disabled{opacity:.45}
.p3d-cad-ve{min-width:58px;color:#fbbf24}.p3d-cad-viewport-status{padding:4px 8px;border-top:1px solid #334155;background:#020617;color:#94a3b8;font:10px ui-monospace,monospace;white-space:nowrap;overflow:hidden}
.p3d-cad-crosshair{position:absolute;inset:0;z-index:2;pointer-events:none;display:none}.p3d-cad-crosshair[data-active="true"]{display:block}.p3d-cad-crosshair-v,.p3d-cad-crosshair-h{position:absolute;background:rgba(226,232,240,.5)}.p3d-cad-crosshair-v{top:0;bottom:0;width:1px}.p3d-cad-crosshair-h{left:0;right:0;height:1px}.p3d-cad-crosshair-hud{position:absolute;padding:3px 5px;background:rgba(2,6,23,.9);border:1px solid #475569;color:#f8fafc;font:10px ui-monospace,monospace;white-space:nowrap}
.p3d-cad-palette{position:fixed;z-index:2147483200;display:grid;grid-template-columns:max-content 92px;gap:6px 8px;min-width:230px;padding:10px;border:1px solid #475569;background:#0f172a;box-shadow:0 10px 28px #0008}.p3d-cad-palette[hidden]{display:none}.p3d-cad-palette footer{grid-column:1/-1;display:flex;gap:6px;justify-content:flex-end}
`;
  doc.head.appendChild(style);
  return true;
}

export function pipelineCadViewportShellHtml() {
  const options = pipelineCadViewportShellModel().surfaces
    .map((surface) => `<option value="${surface.id}">${surface.label}</option>`).join('');
  return `<div class="p3d-cad-viewbar" data-p3d-cad-viewbar>
<select data-p3d-cad-view-target aria-label="Active CAD viewport">${options}</select>
<button type="button" data-p3d-cad-view-action="fit">Auto Fit</button><button type="button" data-p3d-cad-view-action="range">Custom Range</button>
<label>H 1:<input data-p3d-cad-h-scale type="number" min="1" step="1"></label><label>V 1:<input data-p3d-cad-v-scale type="number" min="1" step="1"></label><span class="p3d-cad-ve" data-p3d-cad-ve>VE 1x</span>
<button type="button" data-p3d-cad-view-action="grid" aria-pressed="true">Display Grid</button><button type="button" data-p3d-cad-view-action="minor" aria-pressed="true">Minor Grid</button><button type="button" data-p3d-cad-view-action="grid-snap" aria-pressed="false">Grid Snap</button><button type="button" data-p3d-cad-view-action="station-snap" aria-pressed="false">Station Snap</button><button type="button" data-p3d-cad-view-action="snap">Snap Settings</button><button type="button" data-p3d-cad-view-action="link" aria-pressed="true">Link X</button>
<div class="p3d-cad-palette" data-p3d-cad-range-palette hidden><label>X min</label><input data-range="minX" type="number" step="any"><label>X max</label><input data-range="maxX" type="number" step="any"><label>Y min</label><input data-range="minY" type="number" step="any"><label>Y max</label><input data-range="maxY" type="number" step="any"><footer><button data-range-action="apply">Apply</button><button data-range-action="cancel">Cancel</button></footer></div>
<div class="p3d-cad-palette" data-p3d-cad-snap-palette hidden><label>Station/grid increment</label><input data-snap="stationStep" type="number" step="any"><label>Elevation increment</label><input data-snap="elevationStep" type="number" step="any"><label>Depth increment</label><input data-snap="depthStep" type="number" step="any"><label>Station tolerance</label><input data-snap="stationTolerance" type="number" step="any"><label>Above-ground Z</label><input data-snap="aboveGroundZ" type="number" step="any"><label>Above-ground tolerance</label><input data-snap="aboveGroundTolerance" type="number" step="any"><footer><button data-snap-action="apply">Apply</button><button data-snap-action="defaults">Defaults</button><button data-snap-action="cancel">Cancel</button></footer></div>
</div>`;
}

export function showPipelineCadPalette(palette, trigger, doc = globalThis.document) {
  return positionWorkbenchPalette(palette, trigger, doc);
}
