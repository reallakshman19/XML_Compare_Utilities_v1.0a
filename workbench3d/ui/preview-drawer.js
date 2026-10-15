/**
 * preview-drawer.js — Level-2 drill-down drawer (UI-only, vision doc D3).
 * Renders the rows resolved from a DrilldownContext.v1; row clicks reuse the
 * tab's existing select-object action, footer offers isolate + filtered export.
 */

const STATUS_ICONS = Object.freeze({
  MATCHED_UNCHANGED: '✔', PROPERTY_CHANGED: '≠', GEOMETRY_CHANGED: '⤢',
  MISSING_IN_TARGET: '−', NEW_IN_TARGET: '+', AMBIGUOUS: '?',
  SPLIT: '⑃', MERGE: '⑂', CONSUMED: '◌', CONFLICT: '⚠',
});

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

export function previewDrawerHtml(state) {
  const drill = state.drilldown;
  if (!drill) return '';
  const { context, rows } = drill;
  const shown = rows.slice(0, 100);
  const rowHtml = shown.map((row) => `
    <div class="wb3d-drawer-row ${row.objectId ? 'wb3d-row-click' : ''}" ${row.objectId ? `data-action="select-object" data-object="${esc(row.objectId)}"` : ''}>
      <span class="wb3d-drawer-icon" title="${esc(row.status)}">${STATUS_ICONS[row.status] ?? '·'}</span>
      <span class="wb3d-drawer-ids">${esc(row.source || '—')}${row.target ? ` ↔ ${esc(row.target)}` : ''}</span>
      ${row.confidence && row.confidence !== 'NONE' ? `<span class="wb3d-badge">${esc(row.confidence)}</span>` : ''}
      ${row.positionDeltaMm !== null ? `<span class="wb3d-badge">Δ ${row.positionDeltaMm.toFixed(1)}mm</span>` : ''}
      ${row.loadDeltaPct !== null ? `<span class="wb3d-badge">load Δ ${row.loadDeltaPct.toFixed(0)}%</span>` : ''}
      ${row.measureDeltaPct !== null ? `<span class="wb3d-badge">measure Δ ${row.measureDeltaPct.toFixed(0)}%</span>` : ''}
      <span class="wb3d-muted wb3d-drawer-detail">${esc(row.detail)}</span>
      <button class="wb3d-btn wb3d-btn-mini" data-action="open-evidence" data-diff="${esc(row.diffId)}">Evidence</button>
    </div>`).join('');
  return `
  <div class="wb3d-drawer" data-wb3d-drawer-panel>
    <div class="wb3d-drawer-head">
      <strong>${esc(context.title)}</strong>
      <span class="wb3d-muted">${rows.length} item(s) · from ${esc(context.sourceWidgetId)}</span>
      <span class="wb3d-float-spacer"></span>
      <button class="wb3d-btn wb3d-btn-mini" data-action="drilldown-isolate">Isolate all in 3D</button>
      <button class="wb3d-btn wb3d-btn-mini" data-action="drilldown-export">Export filtered CSV</button>
      <button class="wb3d-btn wb3d-btn-mini" data-action="drilldown-close">✕</button>
    </div>
    <div class="wb3d-drawer-body">
      ${rowHtml || '<p class="wb3d-muted">No items match this selection.</p>'}
      ${rows.length > shown.length ? `<p class="wb3d-muted">Showing ${shown.length} of ${rows.length} — export for the full set.</p>` : ''}
    </div>
  </div>`;
}
