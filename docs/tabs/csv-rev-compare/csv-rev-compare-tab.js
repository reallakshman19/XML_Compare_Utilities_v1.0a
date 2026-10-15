import { runSupportRevisionCompare } from './support-revision-engine.js';
import { supportRevisionToXlsxBytes } from './support-revision-export.js';
import { readSupportRevisionFile } from './support-revision-xlsx-ingress.js';
import {
  artifactDescriptor,
  buildWorkflowState,
  comparisonSummary,
  unresolvedReviewRows,
} from './csv-rev-compare-ui-model.js';

const STYLE_ID = 'csv-rev-compare-style';
const STYLE_URL = './csv-rev-compare.css?v=20260910-issue1181-remediation';

export function installCsvRevCompareTile(container, context = {}) {
  ensureStylesheet(container.ownerDocument);
  if (container.querySelector('[data-csv-rev-compare-open]')) return () => {};
  const doc = container.ownerDocument;
  const tile = doc.createElement('button');
  tile.type = 'button';
  tile.className = 'psmap-card psmap-tile';
  tile.setAttribute('data-csv-rev-compare-open', '1');
  tile.innerHTML = '<span class="csvrc-launcher-icon">CSV↔XML</span><b>CSV Rev Compare (XML Based)</b><span>Compare Support Report revisions through governed categorized XML</span>';
  container.appendChild(tile);
  let destroyWorkspace = null;
  const open = () => {
    if (destroyWorkspace) return;
    destroyWorkspace = mountWorkspace(doc, context, () => {
      destroyWorkspace?.();
      destroyWorkspace = null;
    });
  };
  tile.addEventListener('click', open);
  return () => {
    tile.removeEventListener('click', open);
    destroyWorkspace?.();
    destroyWorkspace = null;
    tile.remove();
  };
}

function ensureStylesheet(doc) {
  if (doc.getElementById(STYLE_ID)) return;
  const link = doc.createElement('link');
  link.id = STYLE_ID;
  link.rel = 'stylesheet';
  link.href = new URL(STYLE_URL, import.meta.url).href;
  doc.head.appendChild(link);
}

function mountWorkspace(doc, context, close) {
  const overlay = doc.createElement('div');
  overlay.className = 'csvrc-backdrop';
  overlay.setAttribute('data-csv-rev-compare-workspace', '1');
  overlay.innerHTML = workspaceHtml();
  doc.body.appendChild(overlay);
  const state = { result: null, reviewDecisions: [] };
  const q = (selector) => overlay.querySelector(selector);
  const rev1 = q('[data-csvrc-rev="1"]');
  const rev2 = q('[data-csvrc-rev="2"]');

  const render = () => renderWorkspace(overlay, state, rev1.value, rev2.value);
  const execute = (resetReview = false) => {
    if (resetReview) state.reviewDecisions = [];
    try {
      state.result = runSupportRevisionCompare(rev1.value, rev2.value, { reviewDecisions: state.reviewDecisions });
      render();
      const summary = comparisonSummary(state.result);
      context.showToast?.(summary.message);
    } catch (error) {
      state.result = null;
      renderRuntimeError(overlay, error);
      context.showToast?.(`CSV Rev Compare failed: ${error?.message || error}`);
    }
  };

  bindFileInput(q('[data-csvrc-file="1"]'), rev1, { state, render, root: overlay, context });
  bindFileInput(q('[data-csvrc-file="2"]'), rev2, { state, render, root: overlay, context });
  q('[data-csvrc-close]').addEventListener('click', close);
  q('[data-csvrc-run]').addEventListener('click', () => execute(true));
  overlay.addEventListener('click', (event) => handleWorkspaceClick(event, { doc, state, execute, context }));
  render();
  return () => overlay.remove();
}

function bindFileInput(input, textarea, runtime) {
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const loaded = await readSupportRevisionFile(file);
      textarea.value = loaded.text;
      runtime.state.result = null;
      runtime.state.reviewDecisions = [];
      runtime.render();
      if (loaded.format === 'xlsx') {
        runtime.context.showToast?.(`Loaded ${file.name}: ${loaded.sheetName}, ${loaded.rowCount} row(s) × ${loaded.columnCount} column(s).`);
      }
    } catch (error) {
      textarea.value = '';
      runtime.state.result = null;
      runtime.state.reviewDecisions = [];
      runtime.render();
      renderFileError(runtime.root, file, error);
      runtime.context.showToast?.(`Revision file load failed: ${error?.message || error}`);
    }
  });
}

async function handleWorkspaceClick(event, runtime) {
  const reviewButton = event.target.closest('[data-csvrc-review-action]');
  if (reviewButton) {
    runtime.state.reviewDecisions = nextReviewDecisions(runtime.state.reviewDecisions, reviewButton.dataset);
    runtime.execute(false);
    return;
  }
  const button = event.target.closest('[data-csvrc-download]');
  if (!button || !runtime.state.result) return;
  const kind = button.dataset.csvrcDownload;
  try {
    if (kind === 'xlsx') {
      if (!runtime.state.result.exportReady) return;
      const bytes = await supportRevisionToXlsxBytes(runtime.state.result);
      downloadBlob(runtime.doc, 'support-revision-compare.xlsx', bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return;
    }
    const artifact = artifactDescriptor(runtime.state.result, kind);
    if (artifact) downloadBlob(runtime.doc, artifact.name, artifact.content, artifact.type);
  } catch (error) {
    runtime.context.showToast?.(`Export failed: ${error?.message || error}`);
  }
}

function nextReviewDecisions(existing, dataset) {
  const kind = dataset.reviewKind || 'candidate';
  if (kind === 'structural') {
    const decision = { kind, edgeId: dataset.edgeId, action: dataset.csvrcReviewAction };
    return [...existing.filter((item) => item.edgeId !== decision.edgeId), decision];
  }
  const decision = {
    kind: 'candidate',
    sourceNodeId: dataset.sourceNodeId,
    targetNodeId: dataset.targetNodeId,
    action: dataset.csvrcReviewAction,
  };
  if (decision.action === 'approve') return [...existing.filter((item) => item.sourceNodeId !== decision.sourceNodeId), decision];
  return [...existing.filter((item) => !(item.sourceNodeId === decision.sourceNodeId && item.targetNodeId === decision.targetNodeId)), decision];
}

function workspaceHtml() {
  return `<section class="csvrc-shell" role="dialog" aria-modal="true" aria-labelledby="csvrc-title">
<header class="csvrc-header"><div><p class="csvrc-kicker">Utilities · XML comparison authority</p><h2 id="csvrc-title">CSV Rev Compare (XML Based)</h2><p>CSV is ingress/egress. Categorized XML and its graph establish revision lineage and engineering changes.</p></div><button type="button" data-csvrc-close>Close</button></header>
<div class="csvrc-input-grid">${revisionInputHtml(1, 'REVISION 1 / EARLIER', 'Source revision')}${revisionInputHtml(2, 'REVISION 2 / LATER', 'Target revision')}</div>
<section class="csvrc-workflow-card"><div class="csvrc-toolbar"><button type="button" class="csvrc-primary" data-csvrc-run>Analyze through categorized XML</button><strong data-csvrc-status>Load both revisions to begin.</strong></div><ol class="csvrc-stage-grid" data-csvrc-stages></ol></section>
<div class="csvrc-review-grid">
<section class="csvrc-panel"><h3>Conversion diagnostics</h3><pre data-csvrc-diagnostics>No comparison run yet.</pre></section>
<section class="csvrc-panel"><h3>Ambiguous lineage review</h3><div data-csvrc-review><p>No candidate review available yet.</p></div></section>
</div>
<div class="csvrc-review-grid">
<section class="csvrc-panel"><h3>XML lineage / structural evidence</h3><div data-csvrc-structure><p>Run the comparison to inspect lineage.</p></div></section>
<section class="csvrc-panel"><h3>Structured event ledger</h3><div data-csvrc-events><p>Run the comparison to inspect engineering events.</p></div></section>
</div>
<section class="csvrc-panel"><h3>Revision output preview</h3><div class="csvrc-table-wrap" data-csvrc-preview><p>No output yet.</p></div></section>
<section class="csvrc-panel"><h3>Exports</h3><p class="csvrc-muted">CSV/XLSX remain disabled while lineage review is unresolved. XML/graph/profile/audit artifacts remain available after successful conversion.</p><div class="csvrc-export-row">${exportButtonsHtml()}</div></section>
</section>`;
}

function revisionInputHtml(number, label, subtitle) {
  return `<section class="csvrc-input-card"><div><p class="csvrc-kicker">${subtitle}</p><h3>${label}</h3></div><input type="file" accept=".csv,.tsv,.txt,.xlsx,text/csv,text/tab-separated-values,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" data-csvrc-file="${number}"><textarea data-csvrc-rev="${number}" rows="12" spellcheck="false" placeholder="Choose CSV/TSV/XLSX Support Report or paste CSV, TSV, or table text"></textarea></section>`;
}

function exportButtonsHtml() {
  return [
    ['csv', 'CSV'], ['xlsx', 'XLSX'], ['audit', 'Comparison audit JSON'],
    ['rev1xml', 'REV1 XML'], ['rev2xml', 'REV2 XML'], ['rev1graph', 'REV1 graph'],
    ['rev2graph', 'REV2 graph'], ['profile', 'Profile JSON'],
  ].map(([kind, label]) => `<button type="button" data-csvrc-download="${kind}" disabled>${label}</button>`).join('');
}

function renderWorkspace(root, state, rev1Text, rev2Text) {
  const workflow = buildWorkflowState({ rev1Loaded: Boolean(rev1Text.trim()), rev2Loaded: Boolean(rev2Text.trim()), result: state.result });
  root.querySelector('[data-csvrc-stages]').innerHTML = workflow.map(stageHtml).join('');
  const summary = comparisonSummary(state.result);
  root.querySelector('[data-csvrc-status]').textContent = summary.message;
  renderDiagnostics(root, state.result);
  root.querySelector('[data-csvrc-review]').innerHTML = reviewHtml(unresolvedReviewRows(state.result));
  root.querySelector('[data-csvrc-structure]').innerHTML = structuralSummaryHtml(state.result);
  root.querySelector('[data-csvrc-events]').innerHTML = eventSummaryHtml(state.result);
  root.querySelector('[data-csvrc-preview]').innerHTML = outputPreviewHtml(state.result?.output, state.result);
  setDownloadState(root, state.result);
}

function renderDiagnostics(root, result) {
  const diagnostics = result?.diagnostics || result?.pair?.diagnostics || [];
  root.querySelector('[data-csvrc-diagnostics]').textContent = result ? JSON.stringify(diagnostics, null, 2) : 'No comparison run yet.';
}

function reviewHtml(rows) {
  if (!rows.length) return '<p>No unresolved ambiguous lineage.</p>';
  return `<p><b>No candidate is silently selected.</b> Review family, PIPE, bore, persistent references, coordinates, and scoring evidence before deciding.</p><div class="csvrc-review-list">${rows.map(reviewRowHtml).join('')}</div>`;
}

function reviewRowHtml(row) {
  if (row.kind === 'structural') {
    return `<article class="csvrc-review-item"><b>${h(row.cardinality || 'N→M')} structural transition · ${h(row.id)}</b>${reviewSideHtml('Source', row.sources)}${reviewSideHtml('Target', row.targets)}<small>${h(row.matchingMethod)} · ${h(row.reasonCodes.join(', '))}</small><div><button type="button" data-csvrc-review-action="accept" data-review-kind="structural" data-edge-id="${h(row.id)}">Accept structural lineage</button><button type="button" data-csvrc-review-action="reject" data-review-kind="structural" data-edge-id="${h(row.id)}">Reject lineage</button></div></article>`;
  }
  const signals = (row.activeSignals || []).map((item) => `${item.signal} +${item.contribution}`).join(', ');
  return `<article class="csvrc-review-item"><b>Candidate · ${h(row.id)} · score ${h(row.score)}</b>${reviewSideHtml('Source', [row.source])}${reviewSideHtml('Target', [row.target])}<small>${h(row.matchingMethod)} · ${h(row.reasonCodes.join(', '))}${signals ? ` · ${h(signals)}` : ''}</small><div><button type="button" data-csvrc-review-action="approve" data-review-kind="candidate" data-source-node-id="${h(row.sourceNodeId)}" data-target-node-id="${h(row.targetNodeId)}">Approve</button><button type="button" data-csvrc-review-action="reject" data-review-kind="candidate" data-source-node-id="${h(row.sourceNodeId)}" data-target-node-id="${h(row.targetNodeId)}">Reject</button></div></article>`;
}

function reviewSideHtml(label, locations = []) {
  const rows = locations.filter(Boolean).map((location) => {
    const refs = (location.references || []).join(', ') || 'none';
    const pos = Object.entries(location.position || {}).filter(([, value]) => value).map(([axis, value]) => `${axis.toUpperCase()}=${value}`).join(', ') || 'none';
    return `<li><code>${h(location.nodeId)}</code> · family ${h(location.family)} · PIPE ${h(location.pipe)} · bore ${h(location.size || 'unknown')} · refs ${h(refs)} · coord ${h(pos)}</li>`;
  }).join('');
  return `<p><b>${h(label)} evidence</b></p><ul>${rows || '<li>none</li>'}</ul>`;
}

function structuralSummaryHtml(result) {
  if (!result?.lineage) return '<p>Run the comparison to inspect lineage.</p>';
  return `<dl class="csvrc-metrics"><div><dt>Candidate pairs</dt><dd>${result.lineage.candidates.length}</dd></div><div><dt>Lineage edges</dt><dd>${result.lineage.edges.length}</dd></div><div><dt>Common-support clusters</dt><dd>${result.lineage.sourceClusters.length + result.lineage.targetClusters.length}</dd></div><div><dt>Coordinate frame</dt><dd>${h(result.lineage.coordinateFrame?.status || 'UNKNOWN')}</dd></div></dl>`;
}

function eventSummaryHtml(result) {
  if (!result?.ledger) return '<p>Run the comparison to inspect events.</p>';
  const types = Object.entries(result.ledger.summary?.byType || {}).map(([type, count]) => `<li><code>${h(type)}</code><span>${count}</span></li>`).join('');
  const prefix = result.reviewBlocked ? '<p><b>Review-only audit ledger.</b> Operational engineering events are withheld until lineage is resolved.</p>' : '';
  return `${prefix}<p><b>${result.ledger.events.length}</b> event(s), <b>${result.ledger.summary?.remarkEligible || 0}</b> remark-eligible.</p><ul class="csvrc-event-list">${types || '<li>No engineering state changes.</li>'}</ul>`;
}

function outputPreviewHtml(output, result = null) {
  if (result?.stage === 'REVIEW_REQUIRED') return '<p><b>Revision output is blocked.</b> Resolve ambiguous lineage before remarks, tombstones, or REV2 output are generated.</p>';
  if (!output?.rows?.length) return '<p>No revision output rows available.</p>';
  const rows = output.rows.slice(0, 80);
  const table = `<table><thead><tr><th>Disposition</th>${output.headers.map((header) => `<th>${h(header)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr><td>${h(row.disposition)}</td>${row.values.map((value) => `<td>${h(value)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  return `${table}${output.rows.length > rows.length ? `<p>Previewing ${rows.length} of ${output.rows.length} rows.</p>` : ''}`;
}

function stageHtml(item) {
  return `<li data-status="${item.status}"><span>${item.number}</span><div><b>${h(item.label)}</b>${item.detail ? `<small>${h(item.detail)}</small>` : ''}</div><em>${h(item.status.replaceAll('_', ' '))}</em></li>`;
}

function setDownloadState(root, result) {
  const conversionReady = Boolean(result?.pair?.ok);
  root.querySelectorAll('[data-csvrc-download]').forEach((button) => {
    const primary = ['csv', 'xlsx'].includes(button.dataset.csvrcDownload);
    button.disabled = primary ? !result?.exportReady : !conversionReady;
  });
}

function renderFileError(root, file, error) {
  root.querySelector('[data-csvrc-status]').textContent = `File load failed: ${file?.name || 'revision input'}`;
  root.querySelector('[data-csvrc-diagnostics]').textContent = error?.stack || String(error);
  setDownloadState(root, null);
}

function renderRuntimeError(root, error) {
  root.querySelector('[data-csvrc-status]').textContent = `Comparison failed: ${error?.message || error}`;
  root.querySelector('[data-csvrc-diagnostics]').textContent = error?.stack || String(error);
  setDownloadState(root, null);
}

function downloadBlob(doc, name, content, type) {
  const blob = content instanceof Uint8Array ? new Blob([content], { type }) : new Blob([String(content ?? '')], { type });
  const url = URL.createObjectURL(blob);
  const anchor = doc.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.hidden = true;
  doc.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function h(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

export const _test = Object.freeze({ nextReviewDecisions, reviewHtml, reviewSideHtml, outputPreviewHtml, setDownloadState, stageHtml, ensureStylesheet, renderFileError });
