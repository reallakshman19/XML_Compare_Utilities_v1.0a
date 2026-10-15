/**
 * dashboard-panel.js — Dashboard view (W2, vision doc D1): KPI story strip,
 * review queue, group×status heatmap, top exception cards. UI-only; all
 * models come from dashboard-view-models.js and every click emits a
 * DrilldownContext through the tab's openDrilldown funnel.
 */

import { kpiStripModel, reviewQueueModel, heatmapModel, exceptionCardsModel, autoVisualMode } from './dashboard-view-models.js';

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

const STATUS_SHORT = Object.freeze({
  MATCHED_UNCHANGED: 'Unchanged', PROPERTY_CHANGED: 'Property Δ', GEOMETRY_CHANGED: 'Geometry Δ',
  MISSING_IN_TARGET: 'Deleted', NEW_IN_TARGET: 'Added', AMBIGUOUS: 'Ambiguous',
  SPLIT: 'Split', MERGE: 'Merge', CONSUMED: 'Consumed', CONFLICT: 'Conflict',
});

/**
 * Build models once per render; the tab caches them on state.dashboardModels
 * so click handlers can look filters up by index.
 */
export function buildDashboardModels(state) {
  return {
    kpis: kpiStripModel(state.audit),
    queue: reviewQueueModel(state.audit),
    heatmap: heatmapModel(state.audit, state.graphs, state.dashboardGroupBy),
    cards: exceptionCardsModel(state.audit, state.graphs),
    visualMode: autoVisualMode(state.audit, state.graphs),
  };
}

function kpiStripHtml(kpis) {
  return `<div class="wb3d-kpi-strip">${kpis.map((kpi, index) => `
    <button class="wb3d-kpi" data-action="dash-kpi" data-index="${index}">
      <strong>${kpi.value}</strong><span>${esc(kpi.label)}</span>
    </button>`).join('')}</div>`;
}

function reviewQueueHtml(queue) {
  if (!queue.length) return '<p class="wb3d-muted">No exceptions — clean compare.</p>';
  return `<ul class="wb3d-queue">${queue.map((entry, index) => `
    <li><button class="wb3d-queue-item wb3d-alert-${entry.severity}" data-action="dash-queue" data-index="${index}">
      <span>${esc(entry.label)}</span><strong>${entry.count}</strong>
    </button></li>`).join('')}</ul>`;
}

function heatmapHtml(heatmap, statusStyles) {
  if (!heatmap.groups.length) return '<p class="wb3d-muted">No grouped data.</p>';
  const shownGroups = heatmap.groups.slice(0, 30);
  const header = `<tr><th></th>${heatmap.statuses.map((s) => `<th title="${esc(s)}">${esc(STATUS_SHORT[s] ?? s)}</th>`).join('')}</tr>`;
  const body = shownGroups.map((group) => {
    const cells = heatmap.statuses.map((status) => {
      const cell = heatmap.cells.get(`${group}|${status}`);
      if (!cell) return '<td class="wb3d-heat-empty">·</td>';
      const alpha = 0.15 + 0.75 * (cell.count / heatmap.maxCount);
      const color = statusStyles?.[status]?.colorHex ?? '#38bdf8';
      return `<td><button class="wb3d-heat-cell" data-action="dash-cell" data-group="${esc(group)}" data-status="${esc(status)}" style="background:${color}${Math.round(alpha * 255).toString(16).padStart(2, '0')}">${cell.count}</button></td>`;
    }).join('');
    return `<tr><th title="${esc(group)}">${esc(String(group).slice(0, 26))}</th>${cells}</tr>`;
  }).join('');
  return `<div class="wb3d-table-wrap wb3d-heatmap"><table><thead>${header}</thead><tbody>${body}</tbody></table>
    ${heatmap.groups.length > shownGroups.length ? `<p class="wb3d-muted">Showing ${shownGroups.length} of ${heatmap.groups.length} groups.</p>` : ''}</div>`;
}

function exceptionCardsHtml(cards) {
  if (!cards.length) return '';
  return `<div class="wb3d-exception-cards">${cards.map((card) => `
    <button class="wb3d-exception-card" data-action="dash-card" data-diff="${esc(card.diffId)}" ${card.objectId ? `data-object="${esc(card.objectId)}"` : ''}>
      <div class="wb3d-exception-head"><strong>${esc(card.title)}</strong><span class="wb3d-badge">${esc(STATUS_SHORT[card.status] ?? card.status)}</span></div>
      <div>${card.badges.map((b) => `<span class="wb3d-badge">${esc(b)}</span>`).join(' ')}</div>
      ${card.detail ? `<div class="wb3d-muted">${esc(card.detail.slice(0, 90))}</div>` : ''}
    </button>`).join('')}</div>`;
}

export function dashboardViewHtml(state, models, statusStyles) {
  if (!state.audit) {
    return `<section class="wb3d-card"><h3>Dashboard</h3>
      <p class="wb3d-muted">Run a compare first (Compare view, or Table to XML → Generate Rev pair) — the dashboard reviews its results.</p></section>`;
  }
  return `
  <section class="wb3d-card">
    <h3>Dashboard — universal node review <span class="wb3d-muted">every click opens the drill-down drawer</span></h3>
    <div class="wb3d-toolbar">
      <label>Group by <select data-action="dash-groupby">
        ${['line', 'parent', 'tag'].map((g) => `<option value="${g}" ${state.dashboardGroupBy === g ? 'selected' : ''}>${g}</option>`).join('')}
      </select></label>
      <span class="wb3d-badge" title="${esc(models.visualMode.reason)}">Auto visual: ${esc(models.visualMode.mode)}</span>
    </div>
    ${kpiStripHtml(models.kpis)}
  </section>
  <div class="wb3d-dash-grid">
    <section class="wb3d-card">
      <h3>Review queue</h3>
      ${reviewQueueHtml(models.queue)}
    </section>
    <section class="wb3d-card">
      <h3>Heatmap <span class="wb3d-muted">${esc(state.dashboardGroupBy)} × status</span></h3>
      ${heatmapHtml(models.heatmap, statusStyles)}
    </section>
  </div>
  <section class="wb3d-card">
    <h3>Top exceptions</h3>
    ${exceptionCardsHtml(models.cards) || '<p class="wb3d-muted">No exceptions.</p>'}
  </section>`;
}
