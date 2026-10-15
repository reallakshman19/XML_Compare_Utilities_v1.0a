/**
 * settings-panel.js — the workbench settings popup (UI-only).
 * All inputs carry data-setting-* attributes; the tab funnels every change
 * through applySettings() and persists via wb3d-settings.js.
 */

import { MARKER_PLACEMENTS } from '../core/wb3d-settings.js';

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

const PLACEMENT_LABELS = Object.freeze({
  from: 'From node',
  to: 'To node',
  mid: 'Mid point',
  text: 'Resolve based on Text (NODE attr)',
});

export function settingsButtonHtml() {
  return '<button class="wb3d-btn" data-action="toggle-settings" title="Workbench settings">⚙ Settings</button>';
}

/**
 * @param {object} state tab state (settings, graphs)
 * @param {string[]} packetKinds discovered packet kinds
 * @param {object} styles effectiveStatusStyles output
 */
export function settingsPanelHtml(state, packetKinds, styles) {
  if (!state.settingsOpen) return '';
  const s = state.settings;
  const allowAll = !Array.isArray(s.tooltipPacketKinds);
  const kindChecked = (kind) => allowAll || s.tooltipPacketKinds.includes(kind);
  const kindRows = (packetKinds.length ? packetKinds : ['RIGID', 'BEND', 'SIF', 'RESTRAINT'])
    .map((kind) => `<label class="wb3d-check"><input type="checkbox" data-setting-packet-kind="${esc(kind)}" ${kindChecked(kind) ? 'checked' : ''}> ${esc(kind)}</label>`)
    .join('');
  const styleRows = Object.entries(styles).map(([status, style]) => `
    <div class="wb3d-settings-style-row">
      <span>${esc(style.label)}</span>
      <input type="color" value="${esc(style.colorHex)}" data-setting-color="${esc(status)}">
      <input type="range" min="5" max="100" value="${Math.round(style.alpha * 100)}" data-setting-alpha="${esc(status)}" title="opacity">
      <span class="wb3d-muted">${Math.round(style.alpha * 100)}%</span>
    </div>`).join('');
  return `
  <div class="wb3d-settings-popup" data-wb3d-settings-popup>
    <div class="wb3d-settings-head">
      <strong>Workbench settings</strong>
      <span class="wb3d-muted">saved to this browser</span>
      <button class="wb3d-btn wb3d-btn-mini" data-action="reset-settings">Reset</button>
      <button class="wb3d-btn wb3d-btn-mini" data-action="toggle-settings">✕</button>
    </div>
    <div class="wb3d-settings-body">
      <section>
        <h5>Hover / tooltip & marker packet kinds</h5>
        <p class="wb3d-muted">Unchecked kinds are hidden from tooltips and 3D markers.</p>
        <label class="wb3d-check"><input type="checkbox" data-setting="packetKindsAll" ${allowAll ? 'checked' : ''}> show all packet kinds</label>
        <div class="wb3d-settings-kinds" ${allowAll ? 'style="opacity:.45;pointer-events:none"' : ''}>${kindRows}</div>
      </section>
      <section>
        <h5>Property packet marker placement</h5>
        <select data-setting="markerPlacement">
          ${MARKER_PLACEMENTS.map((p) => `<option value="${p}" ${s.markerPlacement === p ? 'selected' : ''}>${esc(PLACEMENT_LABELS[p])}</option>`).join('')}
        </select>
        <p class="wb3d-muted">"Resolve based on Text" reads each packet's NODE/CNODE attribute (e.g. NODE="1220.000000") and places the marker at that node via a global node lookup; unknown nodes fall back to midpoint and are flagged.</p>
      </section>
      <section>
        <h5>Nodes</h5>
        <label class="wb3d-check"><input type="checkbox" data-setting="showAllNodes" ${s.showAllNodes ? 'checked' : ''}> render all model nodes (click a node for node-wise info)</label>
        <label>Node marker size mm <input type="number" min="4" max="500" value="${s.nodeMarkerSizeMm}" data-setting="nodeMarkerSizeMm" style="width:70px"></label>
      </section>
      <section>
        <h5>Status colors & transparency</h5>
        <div class="wb3d-settings-styles">${styleRows}</div>
      </section>
      <section>
        <h5>Position heatmap (node compare)</h5>
        <label class="wb3d-check"><input type="checkbox" data-setting="heatmapEnabled" ${s.heatmap.enabled ? 'checked' : ''}> color matched nodes by position delta</label>
        <label>Full-red at Δ mm <input type="number" min="1" value="${s.heatmap.maxDeltaMm}" data-setting="heatmapMaxDeltaMm" style="width:80px"></label>
      </section>
    </div>
  </div>`;
}
