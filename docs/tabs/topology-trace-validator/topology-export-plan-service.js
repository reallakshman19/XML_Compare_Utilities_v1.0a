/** Async prepared-export cache and DOM adapter for the Data & Export Inspector. */

import { prepareTopologyExportSnapshot, topologyExportStateKey } from './topology-export-snapshot.js';
import {
  buildExportPlanRowsMarkup, exportPlanInspectorRows, filterExportPlanInspectorRows, virtualExportPlanWindow,
} from './topology-export-inspector-model.js';
import { escapeMarkup } from './topology-validator-values.js';
import { topologyExportAuditStateKey } from './topology-export-audit-log.js';

function summaryMarkup(plan, rowCount) {
  const gate = plan.gate.status;
  return `<header class="ttv-export-header"><div><b>Data & Export Inspector</b><span>${escapeMarkup(plan.planId)}</span></div><output data-export-gate="${gate}">${gate}</output><span>${plan.files.length} files</span><span>${rowCount} state rows</span><input type="search" placeholder="Filter state paths" aria-label="Filter export state" data-ttv-export-filter></header>`;
}

function tableMarkup(plan, rows) {
  return `${summaryMarkup(plan, rows.length)}<div class="ttv-export-viewport" data-ttv-export-viewport tabindex="0"><table><thead><tr><th>Section</th><th>Hierarchy path</th><th>Type</th><th>Calculated / export value</th></tr></thead><tbody data-ttv-export-rows></tbody></table></div>`;
}

/** Create one controller-owned export preparation and inspector authority. */
export function createTopologyExportPlanService(input) {
  if (!input.host || !input.exportButton) throw new TypeError('Export plan service requires inspector host and export button.');
  let snapshot = null, rows = Object.freeze([]), query = '', token = 0, pendingKey = '', pending = null, destroyed = false;

  function renderRows() {
    const viewport = input.host.querySelector('[data-ttv-export-viewport]'), body = input.host.querySelector('[data-ttv-export-rows]');
    if (!viewport || !body) return;
    const filtered = filterExportPlanInspectorRows(rows, query);
    body.innerHTML = buildExportPlanRowsMarkup(virtualExportPlanWindow(filtered, viewport.scrollTop, viewport.clientHeight || 180));
  }

  function renderPlan() {
    input.host.innerHTML = tableMarkup(snapshot.plan, rows);
    const viewport = input.host.querySelector('[data-ttv-export-viewport]');
    const filter = input.host.querySelector('[data-ttv-export-filter]');
    viewport?.addEventListener('scroll', renderRows, { passive: true });
    filter?.addEventListener('input', (event) => { query = event.target.value; if (viewport) viewport.scrollTop = 0; renderRows(); });
    renderRows(); input.exportButton.disabled = false;
  }

  function renderPending() {
    input.exportButton.disabled = true;
    input.host.innerHTML = '<div class="ttv-export-pending">Preparing exact export bytes, hashes, hierarchy and calculations…</div>';
  }

  async function prepare(planInput) {
    const key = topologyExportStateKey(planInput.draft, planInput.commandJournal, topologyExportAuditStateKey(planInput));
    if (snapshot?.stateKey === key) return snapshot;
    if (pendingKey === key && pending) return pending;
    const request = ++token; pendingKey = key; renderPending();
    pending = prepareTopologyExportSnapshot(planInput);
    try {
      const prepared = await pending;
      if (request === token && !destroyed) { snapshot = prepared; rows = exportPlanInspectorRows(prepared.plan); renderPlan(); }
      return prepared;
    } finally { if (request === token) { pending = null; pendingKey = ''; } }
  }

  function fail(error) {
    if (destroyed) return;
    input.exportButton.disabled = true;
    input.host.innerHTML = `<div class="ttv-export-error">Export plan failed: ${escapeMarkup(error?.message || String(error))}</div>`;
  }

  return Object.freeze({
    refresh: (planInput) => prepare(planInput).catch((error) => { fail(error); throw error; }),
    prepare, evidence: () => Object.freeze({ plan: snapshot?.plan ?? null, stateKey: snapshot?.stateKey ?? '' }),
    destroy: () => { destroyed = true; token += 1; input.host.replaceChildren(); },
  });
}
