export function renderPsFamilyOfflineValidation(benchmark) {
  if (!benchmark) return '<div class="psmap-help-text">Run offline validation to compare the XML-free evidence graph with historical XML reference edges.</div>';
  return `<div class="psfa-validation-workspace">${renderCaution(benchmark)}${renderMetricCards(benchmark)}${renderDisagreements(benchmark)}${renderDiagnostics(benchmark)}</div>`;
}

export function renderPsFamilyValidationPanel() {
  return `<section class="psmap-card psfa-panel" aria-label="Offline validation benchmark"><div class="psmap-card-head"><b>7 Offline Validation Benchmark</b></div><div class="psmap-card-body"><div class="psfa-section-intro">Development and QA only. Compare the XML-free relationship bundle against historical clash XML references without making XML a production dependency.</div><div class="psfa-validation-thresholds"><label>Structural precision threshold<input data-psfa="validation-structural-precision" type="number" min="0" max="1" step="0.01" value="0.98"></label><label>Structural recall threshold<input data-psfa="validation-structural-recall" type="number" min="0" max="1" step="0.01" value="0.95"></label><label>Chain precision threshold<input data-psfa="validation-chain-precision" type="number" min="0" max="1" step="0.01" value="0.97"></label><label>Chain recall threshold<input data-psfa="validation-chain-recall" type="number" min="0" max="1" step="0.01" value="0.95"></label></div><div class="psmap-actions"><button type="button" data-psfa="run-offline-validation">Run Offline Validation</button><button type="button" data-psfa="download-validation-metrics">Download Metrics CSV</button><button type="button" data-psfa="download-validation-disagreements">Download Disagreements CSV</button><button type="button" data-psfa="download-validation-json">Download Validation JSON</button></div><div data-psfa="offline-validation-results" aria-live="polite"></div></div></section>`;
}

function renderCaution(benchmark) {
  return `<div class="psfa-validation-caution"><b>${h(benchmark.summary.status)}</b><span>${h(benchmark.referenceCaution)}</span><small>Validation only: ${benchmark.validationOnly ? 'Yes' : 'No'} · Production dependency: ${benchmark.productionDependency ? 'Yes' : 'No'}</small></div>`;
}

function renderMetricCards(benchmark) {
  return `<div class="psfa-validation-metrics">${metricCard('Structural relationships', benchmark.structural.metrics)}${metricCard('Support-member chain', benchmark.chain.metrics)}</div>`;
}

function metricCard(label, metrics = {}) {
  return `<article class="psfa-validation-metric"><b>${h(label)}</b><span>${h(metrics.status || '')}</span><dl><dt>Matches</dt><dd>${metrics.matchCount ?? 0}</dd><dt>Graph accepted</dt><dd>${metrics.graphAcceptedCount ?? 0}</dd><dt>XML reference</dt><dd>${metrics.xmlReferenceCount ?? 0}</dd><dt>Precision</dt><dd>${percent(metrics.precision)}</dd><dt>Recall</dt><dd>${percent(metrics.recall)}</dd><dt>Thresholds</dt><dd>${percent(metrics.precisionThreshold)} / ${percent(metrics.recallThreshold)}</dd></dl></article>`;
}

function renderDisagreements(benchmark) {
  const rows = [
    ...(benchmark.structural.disagreements || []).map((row) => ({ area: 'Structural', ...row })),
    ...(benchmark.chain.disagreements || []).map((row) => ({ area: 'Support chain', ...row })),
  ];
  if (!rows.length) return '<div class="psfa-validation-empty">No graph/XML reference disagreements.</div>';
  return `<div class="psmap-table-wrap" role="region" tabindex="0" aria-label="Offline validation disagreements"><table class="psmap-table"><thead><tr><th>Area</th><th>Classification</th><th>Support family</th><th>Graph evidence</th><th>XML reference</th><th>Distance / tolerance</th></tr></thead><tbody>${rows.map(disagreementRow).join('')}</tbody></table></div>`;
}

function disagreementRow(row) {
  return `<tr><td>${h(row.area)}</td><td>${h(row.classification)}</td><td>${h(row.supportFamilyId || '')}</td><td>${h(graphEvidence(row))}</td><td>${h(xmlEvidence(row))}</td><td>${row.distanceMm ?? '—'} / ${row.toleranceMm ?? '—'}</td></tr>`;
}

function graphEvidence(row) {
  if (row.graphSteelGroupIds?.length) return row.graphSteelGroupIds.join(', ');
  if (row.graphPairs?.length) return row.graphPairs.map(pairText).join(' | ');
  if (row.steelGroupId) return row.steelGroupId;
  if (row.supportA || row.supportB) return pairText(row);
  return (row.evidenceIds || []).join(', ');
}

function xmlEvidence(row) {
  if (row.xmlSteelGroupIds?.length) return row.xmlSteelGroupIds.join(', ');
  if (row.xmlPairs?.length) return row.xmlPairs.map(pairText).join(' | ');
  return (row.referenceIds || []).join(', ');
}

function pairText(row) {
  return `${row.supportA || ''} ↔ ${row.supportB || ''}`;
}

function renderDiagnostics(benchmark) {
  const rows = benchmark.diagnostics || [];
  if (!rows.length) return '';
  return `<div class="psfa-validation-diagnostics">${rows.map((row) => `<article><b>${h(row.code)}</b><span>${h(row.level)}</span><p>${h(row.message)}</p></article>`).join('')}</div>`;
}

function percent(value) {
  return `${((Number(value) || 0) * 100).toFixed(2)}%`;
}

function h(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
}
