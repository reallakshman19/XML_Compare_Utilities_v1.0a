import {
  buildCiiSourceTargetBenchmarkOverlay,
  ciiSourceTargetBenchmarkOverlayToCsv,
  ciiSourceTargetBenchmarkOverlayToJson,
} from './cii-workspace-benchmark-overlay.js';

function h(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}
function dataHref(mime, payload) { return `data:${mime};charset=utf-8,${encodeURIComponent(payload)}`; }
function statusClass(status) { return String(status || '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-'); }
function expectedRowMarkup(row) {
  const sourceRows = (row.sourceRowKeys || []).length ? row.sourceRowKeys.join(' | ') : '—';
  return `<tr><td>${h(row.nodeId)}</td><td>${h(row.action)}</td><td>${h(row.oldValue || '∅')}</td><td>${h(row.newValue || '∅')}</td><td><span class="ciiw-confidence ${h(statusClass(row.status))}">${h(row.status)}</span></td><td>${h(sourceRows)}</td><td>${row.correspondenceRecovered ? 'YES' : 'NO'}</td><td>${row.mutationRecovered ? 'YES' : 'NO'}</td></tr>`;
}
function additionalRowMarkup(row) {
  return `<tr><td><b>${h(row.sourceId)}</b></td><td>${h(row.sourceNodeId)}</td><td>${h(row.targetNodeId)}</td><td>${h(row.targetNodeName || '∅')} → ${h(row.sourceNodeName || '∅')}</td><td>${h((row.writerActions || []).join(' | ') || '—')}</td><td>ADDITIONAL QUALIFIED</td></tr>`;
}

export function ciiBenchmarkAnnotationByRowKey(overlay) {
  return new Map((overlay?.censusAnnotations || []).map((row) => [String(row.rowKey || ''), row]));
}

export function ciiSourceTargetBenchmarkOverlayMarkup(audit, benchmark) {
  const overlay = buildCiiSourceTargetBenchmarkOverlay(audit, benchmark);
  if (!overlay) return '';
  const summary = overlay.summary;
  const csvHref = dataHref('text/csv', ciiSourceTargetBenchmarkOverlayToCsv(overlay));
  const jsonHref = dataHref('application/json', ciiSourceTargetBenchmarkOverlayToJson(overlay));
  const additional = (overlay.additionalQualifiedRows || []).length
    ? `<h4>Additional qualified mutations outside the partial benchmark</h4><p>These rows are <b>not automatically invalid</b>. TEXPECTED is a lower-bound positive oracle, not a complete output ceiling.</p><table class="ciiw-mini-grid"><thead><tr><th>Source</th><th>SOURCE node</th><th>TARGET node</th><th>Observed change</th><th>Writer</th><th>Interpretation</th></tr></thead><tbody>${overlay.additionalQualifiedRows.map(additionalRowMarkup).join('')}</tbody></table>`
    : '<p>No additional qualified mutation lies outside the supplied partial benchmark.</p>';
  return `<section class="ciiw-base-set" data-ciiw-benchmark-overlay="1"><header><div><h3>Known-positive benchmark overlay</h3><p>Derived dynamically from the supplied TARGET → partial expected TARGET pair. This is corroboration/lower-bound evidence only.</p></div><span class="ciiw-corroboration">LOWER BOUND</span></header><div class="ciiw-kpis"><div><b>${h(summary.expectedCount)}</b><span>Expected positives</span></div><div><b>${h(summary.correspondenceRecoveredCount)}</b><span>Correspondence recovered</span></div><div><b>${h(summary.mutationRecoveredCount)}</b><span>Mutation recovered</span></div><div><b>${h(summary.missingCount)}</b><span>Missing mutation recovery</span></div><div><b>${h(summary.additionalQualifiedCount)}</b><span>Additional qualified</span></div></div><p><b>Before:</b> ${h(overlay.benchmark.before?.fileName || '—')} · <b>Expected:</b> ${h(overlay.benchmark.expected?.fileName || '—')}</p><div class="ciiw-transfer-scope-actions"><a class="ciiw-ms-inline-action" download="cii-known-positive-benchmark-overlay.csv" href="${h(csvHref)}">Export benchmark CSV</a><a class="ciiw-ms-inline-action" download="cii-known-positive-benchmark-overlay.json" href="${h(jsonHref)}">Export benchmark JSON</a></div><table class="ciiw-grid" data-ciiw-benchmark-expected-table="1"><thead><tr><th>TARGET node</th><th>Expected action</th><th>Before</th><th>Expected</th><th>Status</th><th>SOURCE census row(s)</th><th>Correspondence</th><th>Mutation</th></tr></thead><tbody>${overlay.rows.map(expectedRowMarkup).join('')}</tbody></table>${additional}</section>`;
}

export const _test = Object.freeze({ dataHref, statusClass, expectedRowMarkup, additionalRowMarkup });
