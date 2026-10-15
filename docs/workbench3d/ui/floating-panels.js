/**
 * floating-panels.js — movable, collapsible, always-on-top data panels.
 *
 * Three panels: Object diff, Conflicts, Approval override. Positions, column
 * choices, and filters persist in wb3d settings. Rendered inside .wb3d-root
 * (position:relative) so the tab's delegated click handler catches all
 * data-action buttons; drag writes position on pointerup only.
 */

import { PANEL_COLUMNS } from '../core/wb3d-settings.js';
import { distinctValues } from './panel-view-models.js';
import { roleMapAuditModel } from './role-map-audit.js';

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

const PANEL_TITLES = Object.freeze({
  objectDiff: 'Object diff',
  conflicts: 'Conflicts',
  approval: 'Approval override',
});

const STATUS_ICONS = Object.freeze({
  MATCHED_UNCHANGED: '✔', PROPERTY_CHANGED: '≠', GEOMETRY_CHANGED: '⤢',
  MISSING_IN_TARGET: '−', NEW_IN_TARGET: '+', AMBIGUOUS: '?',
  SPLIT: '⑃', MERGE: '⑂', CONSUMED: '◌', CONFLICT: '⚠',
});
const CONFIDENCE_ICONS = Object.freeze({ HIGH: '●', MEDIUM: '◐', LOW: '○', NONE: '◌' });
const KIND_ICONS = Object.freeze({
  EVIDENCE_CONFLICT: '⚖', AMBIGUOUS_MATCH: '?', AMBIGUOUS_PATH: '⑄', REGISTRATION_WARNING: '⌖',
});

function chip(panelId, filterKey, value, icon, active) {
  return `<button class="wb3d-chip ${active ? 'is-active' : ''}" data-action="panel-filter" data-panel="${panelId}" data-filter="${filterKey}" data-value="${esc(value)}" title="${esc(value)}">${icon ?? ''} ${esc(value)}</button>`;
}

function filterChipsHtml(panelId, panelCfg, rows) {
  const groups = [];
  if (panelId === 'objectDiff' || panelId === 'conflicts') {
    const statuses = distinctValues(rows, 'status');
    if (statuses.length) {
      groups.push(statuses.map((s) => chip(panelId, 'statusFilter', s, STATUS_ICONS[s] ?? '·', panelCfg.statusFilter.includes(s))).join(''));
    }
  }
  if (panelId === 'objectDiff') {
    const confidences = distinctValues(rows, 'confidence');
    if (confidences.length) {
      groups.push(confidences.map((c) => chip(panelId, 'confidenceFilter', c, CONFIDENCE_ICONS[c] ?? '·', panelCfg.confidenceFilter.includes(c))).join(''));
    }
  }
  if (panelId === 'conflicts') {
    const kinds = distinctValues(rows, 'kind');
    if (kinds.length) {
      groups.push(kinds.map((k) => chip(panelId, 'kindFilter', k, KIND_ICONS[k] ?? '·', panelCfg.kindFilter.includes(k))).join(''));
    }
  }
  if (!groups.length) return '';
  return `<div class="wb3d-float-chips">${groups.join('<span class="wb3d-chip-sep"></span>')}</div>`;
}

function columnPickerHtml(panelId, panelCfg) {
  const all = PANEL_COLUMNS[panelId] ?? [];
  return `
  <div class="wb3d-float-colpicker">
    <strong>Columns</strong>
    ${all.map(([key, label]) => `<label class="wb3d-check"><input type="checkbox" data-action="panel-column" data-panel="${panelId}" data-column="${key}" ${panelCfg.columns.includes(key) ? 'checked' : ''}> ${esc(label)}</label>`).join('')}
  </div>`;
}

function approvalActions(row) {
  if (row.approval === 'BLOCKED') return `<span class="wb3d-muted" title="${esc(row.blockedReason)}">blocked</span>`;
  return `<button class="wb3d-btn wb3d-btn-mini" data-action="approve-row" data-row="${esc(row.rowId)}" ${row.approval === 'APPROVED' ? 'disabled' : ''}>✔</button>
    <button class="wb3d-btn wb3d-btn-mini" data-action="reject-row" data-row="${esc(row.rowId)}" ${row.approval === 'REJECTED' ? 'disabled' : ''}>✖</button>
    <button class="wb3d-btn wb3d-btn-mini" data-action="approve-element" data-object="${esc(row.targetObjectId)}" data-approval="APPROVED" title="Approve all rows for this element">✔ all</button>`;
}

function rejectMatchAction(row) {
  if (!row.sourceObjectId || !row.targetObjectId) return '';
  return `<button class="wb3d-btn wb3d-btn-mini" data-action="manual-reject" data-source="${esc(row.sourceObjectId)}" data-target="${esc(row.targetObjectId)}" title="Reject this match and re-run the compare">✖</button>`;
}

function panelBodyHtml(panelId, panelCfg, rows) {
  const columnDefs = (PANEL_COLUMNS[panelId] ?? []).filter(([key]) => panelCfg.columns.includes(key));
  const header = columnDefs.map(([, label]) => `<th>${esc(label)}</th>`).join('')
    + (panelId === 'approval' ? '<th>Override</th>' : '')
    + (panelId === 'objectDiff' ? '<th>Reject</th>' : '');
  const body = rows.slice(0, 250).map((row) => {
    const cells = columnDefs.map(([key]) => `<td>${esc(row[key])}</td>`).join('');
    const extra = panelId === 'approval' ? `<td class="wb3d-float-actions">${approvalActions(row)}</td>`
      : panelId === 'objectDiff' ? `<td class="wb3d-float-actions">${rejectMatchAction(row)}</td>` : '';
    const clickable = row.objectId ? `class="wb3d-row-click" data-action="select-object" data-object="${esc(row.objectId)}"` : '';
    return `<tr ${clickable}>${cells}${extra}</tr>`;
  }).join('');
  return `<div class="wb3d-table-wrap wb3d-float-body"><table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>
    ${rows.length > 250 ? `<p class="wb3d-muted">Showing 250 of ${rows.length}.</p>` : ''}${rows.length === 0 ? '<p class="wb3d-muted">No rows (check filters / run compare).</p>' : ''}</div>`;
}

/** Role map audit as a compact checkbox list inside the Object diff panel. */
function roleAuditListHtml(state) {
  const model = roleMapAuditModel(state);
  if (!model.rows.length) return '';
  return `<div class="wb3d-float-roleaudit">
    <strong>Role map audit <span class="wb3d-muted">tick to exclude a field from change detection</span></strong>
    ${model.rows.map((r) => `<label class="wb3d-check ${r.ignored ? 'wb3d-role-ignored' : ''}" title="${esc(r.role)} · sample ${esc(r.sample)}">
      <input type="checkbox" data-action="role-ignore" data-field="${esc(r.field)}" ${r.ignored ? 'checked' : ''}> ${esc(r.field)} <span class="wb3d-muted">${esc(r.role)}</span>
    </label>`).join('')}
  </div>`;
}

/**
 * @param {object} state tab state
 * @param {object} rowsByPanel { objectDiff, conflicts, approval } FILTERED rows
 */
export function floatingPanelsHtml(state, rowsByPanel) {
  return ['objectDiff', 'conflicts', 'approval'].map((panelId) => {
    const cfg = state.settings.panels[panelId];
    if (!cfg.open) return '';
    const rows = rowsByPanel[panelId] ?? [];
    return `
    <div class="wb3d-float ${cfg.collapsed ? 'is-collapsed' : ''}" data-wb3d-float="${panelId}" style="left:${cfg.x}px;top:${cfg.y}px">
      <div class="wb3d-float-head" data-wb3d-float-head="${panelId}">
        <strong>${PANEL_TITLES[panelId]}</strong>
        <span class="wb3d-muted">${rows.length}</span>
        <span class="wb3d-float-spacer"></span>
        ${panelId === 'objectDiff' ? `<button class="wb3d-btn wb3d-btn-mini ${state.roleAuditOpen ? 'is-active' : ''}" data-action="panel-roleaudit" title="Role map audit — tick fields to exclude from change detection">☰</button>` : ''}
        <button class="wb3d-btn wb3d-btn-mini" data-action="panel-colpicker" data-panel="${panelId}" title="Choose columns">⚙</button>
        <button class="wb3d-btn wb3d-btn-mini" data-action="panel-collapse" data-panel="${panelId}" title="Collapse">${cfg.collapsed ? '▸' : '▾'}</button>
        <button class="wb3d-btn wb3d-btn-mini" data-action="toggle-panel" data-panel="${panelId}" title="Close">✕</button>
      </div>
      ${state.panelColumnPicker === panelId ? columnPickerHtml(panelId, cfg) : ''}
      ${panelId === 'objectDiff' && state.roleAuditOpen && !cfg.collapsed ? roleAuditListHtml(state) : ''}
      ${cfg.collapsed ? '' : filterChipsHtml(panelId, cfg, rowsByPanel[`${panelId}Unfiltered`] ?? rows)}
      ${cfg.collapsed ? '' : panelBodyHtml(panelId, cfg, rows)}
    </div>`;
  }).join('');
}

export function panelToggleButtonsHtml(state) {
  return ['objectDiff', 'conflicts', 'approval'].map((panelId) => {
    const open = state.settings.panels[panelId].open;
    return `<button class="wb3d-btn ${open ? 'is-active' : ''}" data-action="toggle-panel" data-panel="${panelId}">${PANEL_TITLES[panelId]}</button>`;
  }).join('');
}

/**
 * Delegated header drag for all floating panels. Moves the element live and
 * reports the final position on pointerup (caller persists + re-renders).
 */
export function attachFloatingPanelDrag(root, onMoved) {
  let drag = null;
  const onDown = (event) => {
    const head = event.target.closest?.('[data-wb3d-float-head]');
    if (!head || event.target.closest('button')) return;
    const panel = head.closest('[data-wb3d-float]');
    drag = {
      panelId: head.getAttribute('data-wb3d-float-head'),
      panel,
      startX: event.clientX,
      startY: event.clientY,
      baseX: parseFloat(panel.style.left) || 0,
      baseY: parseFloat(panel.style.top) || 0,
    };
    event.preventDefault();
  };
  const onMove = (event) => {
    if (!drag) return;
    const x = Math.max(0, drag.baseX + event.clientX - drag.startX);
    const y = Math.max(0, drag.baseY + event.clientY - drag.startY);
    drag.panel.style.left = `${x}px`;
    drag.panel.style.top = `${y}px`;
  };
  const onUp = () => {
    if (!drag) return;
    onMoved(drag.panelId, parseFloat(drag.panel.style.left) || 0, parseFloat(drag.panel.style.top) || 0);
    drag = null;
  };
  root.addEventListener('pointerdown', onDown);
  root.addEventListener('pointermove', onMove);
  root.addEventListener('pointerup', onUp);
  return () => {
    root.removeEventListener('pointerdown', onDown);
    root.removeEventListener('pointermove', onMove);
    root.removeEventListener('pointerup', onUp);
  };
}
