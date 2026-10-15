import {
  buildCiiSourceTargetAudit,
  ciiSourceTargetAuditToCsv,
  ciiSourceTargetAuditToJson,
} from './cii-workspace-source-target-audit.js';
import { buildCiiSourceTargetBenchmarkOverlay } from './cii-workspace-benchmark-overlay.js';
import {
  ciiBenchmarkAnnotationByRowKey,
  ciiSourceTargetBenchmarkOverlayMarkup,
} from './cii-workspace-benchmark-overlay-ui.js';
import { ciiBenchmarkOverlayHostMarkup } from './cii-workspace-benchmark-overlay-host.js';

function h(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}
function dataHref(mime, payload) { return `data:${mime};charset=utf-8,${encodeURIComponent(payload)}`; }
function list(values) { return (values || []).length ? values.join(' | ') : '—'; }
function populationWarning(summary) {
  const mismatched = (summary?.bySource || []).filter((row) => row.populationStatus === 'MISMATCH');
  if (!mismatched.length) return '';
  return `<p class="ciiw-method-empty"><b>Population audit mismatch:</b> ${h(mismatched.map((row) => `${row.sourceId} declared ${row.declaredNodeCount}, enumerated ${row.enumeratedNodeCount}`).join('; '))}</p>`;
}
function sourceBreakdown(summary) {
  return (summary?.bySource || []).map((row) => `<tr><td><b>${h(row.sourceId)}</b></td><td>${h(row.enumeratedNodeCount)}</td><td>${h(row.BOUND)}</td><td>${h(row.UNRESOLVED)}</td><td>${h(row.AMBIGUOUS)}</td><td>${h(row.UNEMITTED)}</td><td>${h(row.qualifiedNodeNameChangeCount)}</td><td>${h(row.populationStatus)}</td></tr>`).join('');
}
function stateLabel(row) {
  return `<span class="ciiw-confidence ${String(row?.state || '').toLowerCase()}">${h(row?.state || '—')}</span>`;
}
function targetLabel(row) {
  if (!(row?.targetNodeIds || []).length) return '—';
  return (row.targetNodeIds || []).map((id, index) => `${h(id)}${row.targetNodeNames?.[index] ? ` <small>${h(row.targetNodeNames[index])}</small>` : ''}`).join('<br>');
}
function benchmarkLabel(annotation) {
  if (!annotation || annotation.status === 'NOT_COVERED_BY_PARTIAL_BENCHMARK') return '—';
  const note = annotation.benchmarkAction ? `${annotation.benchmarkAction} @ ${annotation.benchmarkTargetNodeId}` : 'not in partial benchmark';
  return `<b>${h(annotation.status)}</b><small>${h(note)}</small>`;
}
function rowMarkup(row, annotation = null) {
  const nameDelta = row.qualifiedNodeNameChange ? '<b>QUALIFIED CHANGE</b>' : (row.nodeNameDifferent ? 'different' : '—');
  return `<tr data-ciiw-source-target-row="${h(row.rowKey)}"><td><b>${h(row.sourceId)}</b></td><td>${h(row.sourceNodeId)}${row.sourceNodeName ? `<small>${h(row.sourceNodeName)}</small>` : ''}</td><td>${stateLabel(row)}<small>${h(row.confidence)}</small></td><td>${targetLabel(row)}</td><td>${nameDelta}</td><td data-ciiw-benchmark-cell="${h(row.rowKey)}">${benchmarkLabel(annotation)}</td><td>${h(list(row.evidenceBases))}<small>${h(list(row.authorities))}</small></td><td>${h(list(row.reviewDecisions))}</td><td>${h(list(row.writerActions))}<small>${h(list(row.writerStatuses))}</small></td><td>${h(list(row.reasons))}</td></tr>`;
}

export function ciiMultiSourceSourceTargetAuditMarkup(preview, reviewDecisionOverrides = null, benchmark = null) {
  if (!(preview?.memberPreviews || []).length) return '';
  const audit = buildCiiSourceTargetAudit({ ...preview, reviewDecisionOverrides }); const summary = audit.summary;
  const overlay = benchmark ? buildCiiSourceTargetBenchmarkOverlay(audit, benchmark) : null;
  const annotations = ciiBenchmarkAnnotationByRowKey(overlay);
  const csvHref = dataHref('text/csv', ciiSourceTargetAuditToCsv(audit));
  const jsonHref = dataHref('application/json', ciiSourceTargetAuditToJson(audit));
  const benchmarkMarkup = benchmark
    ? ciiSourceTargetBenchmarkOverlayMarkup(audit, benchmark)
    : ciiBenchmarkOverlayHostMarkup(audit, preview.targetDocument);
  return `<section class="ciiw-base-set" data-ciiw-source-target-audit="1"><header><div><h3>Correspondence → Source vs Target</h3><p>Complete SOURCE-node census. Unemitted nodes remain visible; this view never invents a TARGET identity.</p></div><span class="ciiw-corroboration">AUDIT</span></header><div class="ciiw-kpis"><div><b>${h(summary.totalSourceNodes)}</b><span>SOURCE nodes</span></div><div><b>${h(summary.BOUND)}</b><span>Bound</span></div><div><b>${h(summary.UNRESOLVED)}</b><span>Unresolved</span></div><div><b>${h(summary.AMBIGUOUS)}</b><span>Ambiguous</span></div><div><b>${h(summary.UNEMITTED)}</b><span>Unemitted</span></div><div><b>${h(summary.qualifiedNodeNameChangeCount)}</b><span>Qualified name changes</span></div></div>${populationWarning(summary)}<div class="ciiw-transfer-scope-actions"><a class="ciiw-ms-inline-action" download="cii-source-target-audit.csv" href="${h(csvHref)}">Export census CSV</a><a class="ciiw-ms-inline-action" download="cii-source-target-audit.json" href="${h(jsonHref)}">Export census JSON</a></div><table class="ciiw-mini-grid" data-ciiw-source-target-summary="1"><thead><tr><th>Source</th><th>Nodes</th><th>Bound</th><th>Unresolved</th><th>Ambiguous</th><th>Unemitted</th><th>Name changes</th><th>Population</th></tr></thead><tbody>${sourceBreakdown(summary)}</tbody></table><table class="ciiw-grid" data-ciiw-source-target-table="1"><thead><tr><th>Source</th><th>SOURCE node</th><th>State</th><th>TARGET node</th><th>NodeName</th><th>Benchmark</th><th>Evidence / authority</th><th>Review</th><th>Writer</th><th>Reason</th></tr></thead><tbody>${(audit.rows || []).map((row) => rowMarkup(row, annotations.get(row.rowKey))).join('')}</tbody></table></section>${benchmarkMarkup}`;
}

export const _test = Object.freeze({ dataHref, populationWarning, sourceBreakdown, stateLabel, targetLabel, benchmarkLabel });
