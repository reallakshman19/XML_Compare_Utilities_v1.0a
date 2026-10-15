/**
 * evidence-panel.js — Level-3 full evidence overlay + connector ledger (W5).
 * UI-only; models come from evidence-view-models.js. Actions reuse the tab's
 * existing manual-link/reject + select flows.
 */

import { buildEvidenceModel, connectorLedgerModel } from './evidence-view-models.js';
import { bendDiagnosticsPanelHtml } from './bend-diagnostics-panel.js';

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

function kvTable(pairs, className = '') {
  return `<table class="wb3d-evi-kv ${className}"><tbody>${pairs
    .map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</tbody></table>`;
}

/** Full evidence overlay for state.evidenceDiffId (null → nothing). */
export function evidencePanelHtml(state) {
  if (!state.evidenceDiffId) return '';
  const model = buildEvidenceModel(state.audit, state.graphs, state.evidenceDiffId);
  if (!model) return '';
  const fieldRows = model.fields.map((f) => `
    <tr class="${f.changed ? 'is-changed' : ''}">
      <td class="wb3d-evi-label">${esc(f.label)}</td>
      <td>${esc(f.a) || '<span class="wb3d-muted">—</span>'}</td>
      <td>${esc(f.b) || '<span class="wb3d-muted">—</span>'}</td>
    </tr>`).join('');
  const candidateBtns = model.actions.candidates.map((c) => `
    <button class="wb3d-btn wb3d-btn-mini" data-action="manual-link" data-source="${esc(model.actions.sourceObjectId)}" data-target="${esc(c.id)}">Link ${esc(c.label)}</button>`).join('');
  return `
  <div class="wb3d-evi-backdrop" data-action="evidence-close"></div>
  <div class="wb3d-evi-panel" data-wb3d-evidence>
    <div class="wb3d-evi-head">
      <strong>Full evidence — ${esc(model.title)}</strong>
      <span class="wb3d-badge">${esc(model.status.replaceAll('_', ' '))}</span>
      ${model.confidence && model.confidence !== 'NONE' ? `<span class="wb3d-badge">${esc(model.confidence)}</span>` : ''}
      <span class="wb3d-muted">${esc(model.domain.replace('_', ' '))} template</span>
      <span class="wb3d-float-spacer"></span>
      ${model.actions.objectId ? `<button class="wb3d-btn wb3d-btn-mini" data-action="select-object" data-object="${esc(model.actions.objectId)}">Show in 3D</button>` : ''}
      <button class="wb3d-btn wb3d-btn-mini" data-action="evidence-close">✕</button>
    </div>
    <div class="wb3d-evi-body">
      <table class="wb3d-evi-fields">
        <thead><tr><th></th><th>Source A</th><th>Target B</th></tr></thead>
        <tbody>${fieldRows}</tbody>
      </table>
      <div class="wb3d-evi-cols">
        <div><h5>Delta / decision</h5>${kvTable(model.delta)}</div>
        <div><h5>Relationship basis</h5>${model.basis.length ? `<ul class="wb3d-list">${model.basis.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : '<p class="wb3d-muted">—</p>'}
          ${model.conflicts.length ? `<h5>Conflicts</h5><ul class="wb3d-list">${model.conflicts.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}</div>
        <div><h5>Raw traceability</h5>${kvTable(model.traceability)}</div>
      </div>
    </div>
    <div class="wb3d-evi-actions">
      ${model.actions.canReject ? `<button class="wb3d-btn wb3d-btn-mini" data-action="manual-reject" data-source="${esc(model.actions.sourceObjectId)}" data-target="${esc(model.actions.targetObjectId)}">Reject match</button>` : ''}
      ${candidateBtns}
      <span class="wb3d-float-spacer"></span>
      <button class="wb3d-btn wb3d-btn-mini" data-action="evidence-export" data-diff="${esc(model.diffId)}">Export evidence</button>
    </div>
  </div>`;
}

/** Connector + InputXML bend diagnostic cards with existing Show-in-3D actions. */
export function connectorLedgerHtml(state) {
  if (!state.audit) return '';
  const rows = connectorLedgerModel(state.audit, state.graphs);
  const body = rows.slice(0, 400).map((r) => `
    <tr class="wb3d-row-click" data-action="open-evidence" data-diff="${esc(r.diffId)}">
      <td title="${esc(r.status)}">${esc(r.symbol)} ${esc(r.status.replaceAll('_', ' '))}</td>
      <td>${esc(r.source)}</td><td>${esc(r.target)}</td>
      <td>${esc(r.confidence)}</td><td class="wb3d-muted">${esc(r.basis)}</td>
    </tr>`).join('');
  return `${bendDiagnosticsPanelHtml(state)}
  <details class="wb3d-card">
    <summary><h3>Connector ledger <span class="wb3d-muted">${rows.length} relationship(s) — click a row for full evidence</span></h3></summary>
    <div class="wb3d-toolbar"><button class="wb3d-btn wb3d-btn-mini" data-action="export-connector-ledger">Export connector CSV</button></div>
    <div class="wb3d-table-wrap"><table><thead><tr><th>Status</th><th>Source</th><th>Target</th><th>Conf.</th><th>Basis</th></tr></thead>
      <tbody>${body}</tbody></table>${rows.length > 400 ? `<p class="wb3d-muted">Showing 400 of ${rows.length}.</p>` : ''}</div>
  </details>`;
}
