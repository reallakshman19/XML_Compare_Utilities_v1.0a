/**
 * Adds supervised branch-continuation editing and constructed-source round-trip
 * export without changing the portable workspace-package persistence contract.
 */
import {
  buildSequentialContinuationDraft,
  continuationOverride,
} from './sequential-continuation-model.js';
import {
  constructSequentialGeometry,
  serializeSequentialConstructedSource,
  serializeSequentialSourceRecords,
} from './sequential-network-constructor.js';
import { renderSequentialConstructedNetwork } from './sequential-network-svg.js';

const EXTERNAL = '__EXTERNAL__';

function required(root, selector) {
  const element = root.querySelector(selector);
  if (!element) throw new Error(`Sequential continuity element missing: ${selector}`);
  return element;
}
function escape(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}
function timestamp() { return new Date().toISOString().replaceAll(':', '-').replace(/\.\d{3}Z$/u, 'Z'); }
function saveJson(documentRef, filename, content) {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = documentRef.createElement('a');
  anchor.href = url; anchor.download = filename;
  documentRef.body.appendChild(anchor); anchor.click(); anchor.remove();
  URL.revokeObjectURL(url);
}
function icon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h16M6 20V8l6-4 6 4v12M9 20v-6h6v6M3 8h18"/></svg>';
}
function panelMarkup() {
  return `<section class="ssk-continuity-panel">
    <header><div><h2>4. Continuation build queue</h2><p>Connector edits remain draft-only until Build entire geometry is selected.</p></div>
      <button type="button" data-ssk-continuity-refresh disabled>Refresh connectors</button></header>
    <div class="ssk-continuity-summary" data-ssk-continuity-summary>Build the blocked review queue to expose branch continuations.</div>
    <div class="ssk-continuity-list" data-ssk-continuity-list></div>
    <div class="ssk-continuity-actions">
      <button type="button" data-ssk-continuity-construct disabled>${icon()}<span>Build entire geometry</span></button>
      <button type="button" data-ssk-continuity-export disabled>Export constructed source JSON</button>
      <button type="button" data-ssk-continuity-active disabled>Show active branch</button>
    </div>
  </section>`;
}
function connectorSymbol(connector) {
  const external = connector.status === 'EXTERNAL_SHEET';
  return `<svg viewBox="0 0 48 24" aria-label="${external ? 'External continuation sheet' : 'Internal branch connector'}"><path d="${external ? 'M3 5h25l9 7-9 7H3z' : 'M8 12h11m10 0h11M19 7l5 5-5 5m10-10-5 5 5 5'}"/></svg>`;
}
function targetOptions(ids, selected) {
  const values = [{ value: EXTERNAL, label: 'External continuation sheet' },
    ...ids.map((id) => ({ value: id, label: id }))];
  return values.map((row) => `<option value="${escape(row.value)}"${row.value === (selected || EXTERNAL) ? ' selected' : ''}>${escape(row.label)}</option>`).join('');
}
function connectorRow(connector, branchIds) {
  const gap = Number.isFinite(connector.gapMm) ? `${connector.gapMm.toFixed(3)} mm` : 'external';
  return `<article class="ssk-continuity-row" data-ssk-continuity-row="${connector.connectorId}">
    <div class="ssk-continuity-symbol">${connectorSymbol(connector)}</div>
    <div class="ssk-continuity-identity"><strong>${escape(connector.role)}</strong><span title="${escape(connector.branchId)}">${escape(connector.branchId)}</span><small>${escape(connector.reviewStatus)} · ${escape(gap)}</small></div>
    <label>Continuation sheet<select data-ssk-continuity-target>${targetOptions(branchIds, connector.targetBranchId)}</select></label>
    <label>Target end<select data-ssk-continuity-end><option value="HEAD"${connector.targetEndpoint === 'HEAD' ? ' selected' : ''}>HEAD</option><option value="TAIL"${connector.targetEndpoint === 'TAIL' ? ' selected' : ''}>TAIL</option></select></label>
    <label class="ssk-continuity-reference">Sheet / reference<input type="text" data-ssk-continuity-reference value="${escape(connector.externalReference)}" placeholder="External sheet reference"></label>
    <label class="ssk-continuity-reason">Engineering reason<input type="text" data-ssk-continuity-reason value="${escape(connector.reason)}" placeholder="Required when connector is changed or has a gap"></label>
  </article>`;
}
function renameExistingControls(root) {
  const packageHeading = root.querySelector('.ssk-workspace-package h2');
  if (packageHeading) packageHeading.textContent = '5. Portable workspace package';
  const packageButton = root.querySelector('[data-ssk-workspace-export]');
  if (packageButton) packageButton.textContent = 'Export workspace package';
  const sourceSection = root.querySelector('[data-ssk-source]')?.closest('section');
  if (sourceSection && !sourceSection.querySelector('[data-ssk-source-export]')) {
    sourceSection.insertAdjacentHTML('beforeend', '<button type="button" data-ssk-source-export disabled>Export source JSON · same import format</button>');
  }
}
function currentMode(root) {
  return root.querySelector('[data-ssk-view].is-active')?.dataset?.sskView || 'ISO';
}

export function mountSequentialContinuityController(root, workspace, context = {}) {
  renameExistingControls(root);
  const review = required(root, '.ssk-review-queue');
  review.insertAdjacentHTML('afterend', panelMarkup());
  const elements = {
    summary: required(root, '[data-ssk-continuity-summary]'),
    list: required(root, '[data-ssk-continuity-list]'),
    refresh: required(root, '[data-ssk-continuity-refresh]'),
    construct: required(root, '[data-ssk-continuity-construct]'),
    export: required(root, '[data-ssk-continuity-export]'),
    active: required(root, '[data-ssk-continuity-active]'),
    sourceExport: required(root, '[data-ssk-source-export]'),
    canvas: required(root, '[data-ssk-canvas]'),
  };
  const state = { overrides: {}, draft: null, geometry: null };
  function setStatus(message, kind = 'info') {
    const status = root.querySelector('[data-ssk-status]');
    if (status) { status.textContent = message; status.dataset.state = kind; }
    context.showToast?.(message, kind === 'ok' ? 'success' : kind);
  }
  function reset() {
    state.overrides = {}; state.draft = null; state.geometry = null;
    if (workspace.getModel?.()) workspace.getModel().constructedGeometry = null;
    elements.list.innerHTML = ''; elements.refresh.disabled = true;
    elements.construct.disabled = true; elements.export.disabled = true;
    elements.active.disabled = true;
    elements.summary.textContent = 'Build the blocked review queue to expose branch continuations.';
    elements.sourceExport.disabled = !Array.isArray(workspace.getModel?.()?.records);
  }
  function refresh() {
    const model = workspace.getModel?.(); const queue = workspace.getReviewQueue?.();
    state.draft = buildSequentialContinuationDraft(model?.records, queue, state.overrides);
    elements.list.innerHTML = state.draft.connectors.map((row) => connectorRow(row, state.draft.branchIds)).join('');
    const value = state.draft.summary;
    elements.summary.textContent = `${value.connectorCount} connectors · ${value.internalCount} internal · ${value.externalCount} external sheets · ${value.editedCount} edited · maximum gap ${value.maximumGapMm.toFixed(3)} mm`;
    elements.refresh.disabled = false; elements.construct.disabled = false;
    elements.sourceExport.disabled = false;
    state.geometry = null; elements.export.disabled = true; elements.active.disabled = true;
    return state.draft;
  }
  function readOverride(row) {
    const connector = state.draft?.connectors.find((entry) => entry.connectorId === row.dataset.sskContinuityRow);
    if (!connector) return;
    state.overrides[connector.connectorId] = continuationOverride(connector, {
      targetBranchId: row.querySelector('[data-ssk-continuity-target]').value,
      targetEndpoint: row.querySelector('[data-ssk-continuity-end]').value,
      externalReference: row.querySelector('[data-ssk-continuity-reference]').value,
      reason: row.querySelector('[data-ssk-continuity-reason]').value,
    });
  }
  function construct() {
    const model = workspace.getModel?.(); const queue = workspace.getReviewQueue?.();
    state.draft = buildSequentialContinuationDraft(model.records, queue, state.overrides);
    state.geometry = constructSequentialGeometry(model.records, state.draft, queue, {
      exactToleranceMm: Number(root.querySelector('[data-ssk-exact-tolerance]')?.value) || 1,
    });
    model.constructedGeometry = state.geometry;
    renderSequentialConstructedNetwork(elements.canvas, state.geometry, { mode: currentMode(root) });
    elements.export.disabled = false; elements.active.disabled = false;
    const metrics = state.geometry.metrics;
    elements.summary.textContent = `Built ${metrics.branchCount} branches as one SVG network: ${metrics.internalConnectorCount} internal continuations, ${metrics.externalSheetCount} continuation sheets, ${metrics.generatedPipeCount} generated connector pipes.`;
    setStatus('Built entire geometry from the current Build queue continuity. Source evidence remains unchanged until the constructed JSON is exported.', 'ok');
    return state.geometry;
  }
  function showActiveBranch() {
    state.geometry = null; elements.active.disabled = true;
    const branch = root.querySelector('[data-ssk-branch]');
    if (branch?.value) branch.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function exportSource() {
    const records = workspace.getModel?.()?.records;
    saveJson(root.ownerDocument, `sequential-source-${timestamp()}.json`, serializeSequentialSourceRecords(records));
  }
  function exportConstructed() {
    saveJson(root.ownerDocument, `sequential-constructed-source-${timestamp()}.json`, serializeSequentialConstructedSource(state.geometry));
  }
  function onClick(event) {
    try {
      if (event.target?.closest?.('[data-ssk-review-build]')) { queueMicrotask(() => { try { refresh(); } catch (error) { reset(); setStatus(error.message, 'error'); } }); return; }
      if (event.target?.closest?.('[data-ssk-action="inspect"]')) { queueMicrotask(reset); return; }
      if (event.target?.closest?.('[data-ssk-continuity-refresh]')) { refresh(); return; }
      if (event.target?.closest?.('[data-ssk-continuity-construct]')) { construct(); return; }
      if (event.target?.closest?.('[data-ssk-continuity-export]')) { exportConstructed(); return; }
      if (event.target?.closest?.('[data-ssk-continuity-active]')) { showActiveBranch(); return; }
      if (event.target?.closest?.('[data-ssk-source-export]')) { exportSource(); return; }
      if (state.geometry && event.target?.closest?.('[data-ssk-view]')) {
        queueMicrotask(() => renderSequentialConstructedNetwork(elements.canvas, state.geometry, { mode: currentMode(root) }));
      }
      if (event.target?.closest?.('[data-ssk-workspace-apply]')) queueMicrotask(reset);
    } catch (error) { setStatus(error.message || String(error), 'error'); }
  }
  function stageRow(row) {
    readOverride(row);
    const model = workspace.getModel?.(); const queue = workspace.getReviewQueue?.();
    state.draft = buildSequentialContinuationDraft(model.records, queue, state.overrides);
    state.geometry = null; elements.export.disabled = true; elements.active.disabled = true;
    const value = state.draft.summary;
    elements.summary.textContent = `${value.connectorCount} connectors · ${value.internalCount} internal · ${value.externalCount} external sheets · ${value.editedCount} edited · staged for Build entire geometry`;
  }
  function onChange(event) {
    const row = event.target?.closest?.('[data-ssk-continuity-row]');
    if (row) { stageRow(row); return; }
    if (event.target?.dataset?.sskFile === 'source') queueMicrotask(reset);
  }
  function onInput(event) {
    const row = event.target?.closest?.('[data-ssk-continuity-row]');
    if (row) stageRow(row);
  }
  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);
  root.addEventListener('input', onInput);
  reset();
  return Object.freeze({
    refresh, construct, exportSource, exportConstructed,
    getDraft: () => state.draft, getGeometry: () => state.geometry,
    destroy() {
      root.removeEventListener('click', onClick); root.removeEventListener('change', onChange);
      root.removeEventListener('input', onInput);
      root.querySelector('.ssk-continuity-panel')?.remove();
    },
  });
}
