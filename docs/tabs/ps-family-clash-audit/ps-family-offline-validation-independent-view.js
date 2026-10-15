export function renderPsFamilyIndependentBenchmarkPanel() {
  return `<section class="psmap-card psfa-panel" aria-label="Independent combined model benchmark"><div class="psmap-card-head"><b>Independent Model Benchmark</b></div><div class="psmap-card-body"><div class="psfa-section-intro">Uses the single combined staged JSON already loaded in Native Pipeline. Historical structure/support clash XML remains optional validation-only reference evidence.</div><div class="psfa-independent-caution"><b>No second JSON input</b><span>Load or paste the model once in Native Pipeline, then run this benchmark.</span></div><div class="psmap-actions"><button type="button" data-psfa="run-independent-benchmark">Run Independent Benchmark</button><button type="button" data-psfa="download-independent-metrics">Metrics CSV</button><button type="button" data-psfa="download-independent-coverage">Coverage CSV</button><button type="button" data-psfa="download-independent-gaps">Gap Ledger CSV</button><button type="button" data-psfa="download-independent-json">Benchmark JSON</button></div><div data-psfa="independent-benchmark-results" aria-live="polite"><div class="psfa-validation-empty">Load one combined staged model in Native Pipeline. Optional clash XML can remain in the standard Audit Input fields.</div></div></div></section>`;
}

export function renderPsFamilyIndependentBenchmark(result) {
  return `<div class="psfa-independent-workspace">${summary(result)}${metrics(result)}${coverage(result.coverage || [])}${gaps(result.gaps || [])}</div>`;
}

function summary(result) {
  return `<div class="psfa-validation-caution"><b>${h(result.summary?.status)}</b><span>${h(result.referenceCaution)}</span><small>Combined model: production evidence · XML: optional validation reference · Gaps: ${result.summary?.gapCount ?? 0}</small></div>`;
}

function metrics(result) {
  return `<div class="psfa-validation-metrics">${metric('Family to steel', result.reference?.structural?.metrics)}${metric('Support-member chain', result.reference?.chain?.metrics)}${metric('Member to steel terminal', result.memberTerminal?.metrics)}</div>`;
}

function metric(label, row = {}) {
  return `<article class="psfa-validation-metric"><b>${h(label)}</b><span>${h(row.status)}</span><dl><dt>Matches</dt><dd>${row.matchCount ?? 0}</dd><dt>Model evidence</dt><dd>${row.graphAcceptedCount ?? 0}</dd><dt>XML reference</dt><dd>${row.xmlReferenceCount ?? 0}</dd><dt>Precision</dt><dd>${percent(row.precision)}</dd><dt>Recall</dt><dd>${percent(row.recall)}</dd></dl></article>`;
}

function coverage(rows) {
  return `<div class="psmap-table-wrap" role="region" tabindex="0" aria-label="Independent benchmark coverage"><table class="psmap-table"><thead><tr><th>Audit layer</th><th>Coverage</th><th>Model</th><th>XML</th><th>Claim boundary</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${h(row.layer)}</td><td>${h(row.coverageStatus)}</td><td>${row.modelEvidenceCount ?? 0}</td><td>${row.referenceEvidenceCount ?? 0}</td><td>${h(row.claimBoundary)}</td></tr>`).join('')}</tbody></table></div>`;
}

function gaps(rows) {
  if (!rows.length) return '<div class="psfa-validation-empty">No benchmark gaps detected within available coverage.</div>';
  return `<div class="psfa-validation-diagnostics">${rows.map((row) => `<article><b>${h(row.code)}</b><span>${h(row.severity)}</span><p>${h(row.message)}</p></article>`).join('')}</div>`;
}

function percent(value) { return `${((Number(value) || 0) * 100).toFixed(2)}%`; }
function h(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
