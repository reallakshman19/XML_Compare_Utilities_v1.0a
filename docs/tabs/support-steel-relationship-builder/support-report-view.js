import {
  supportReportColumns,
  supportReportColumnValue,
} from './support-report-contract.js?v=20260910-support-report-typicality-columns-1';
import { supportReportCompleteness } from './support-report-ui-state.js?v=20260910-support-report-ui-completeness-16';

export const SUPPORT_REPORT_TABLE_PREVIEW_LIMIT = 500;
export const SUPPORT_REPORT_TRACE_PREVIEW_LIMIT = 500;

export function renderSupportReportWorkspace(report) {
  if (!report) return '<div class="ssrb-empty"><b>Support Report not built</b><span>Load Support Report clash XML, then build the report. Load staged JSON when native member/attribute evidence is available.</span></div>';
  const summary = report.summary || {};
  return `<div class="ssrb-report-summary">${summaryCard('Clash evidence', summary.clashEvidenceCount)}${summaryCard('Report rows', summary.reportRowCount)}${summaryCard('Secondary families', summary.secondarySupportFamilyCount)}${summaryCard('Enriched rows', summary.enrichedRowCount)}${summaryCard('XML-only rows', summary.xmlOnlyRowCount)}${summaryCard('Multi-location rows', summary.multiLocationRowCount)}</div>${renderTypicalitySummary(report)}${renderSupportReportCompleteness(report)}${renderSupportReportTable(report)}${renderSupportReportJsonTrace(report)}${renderSupportReportDiagnostics(report)}`;
}

export function renderSupportReportCompleteness(report) {
  const completeness = supportReportCompleteness(report);
  if (completeness.partial) {
    const rows = completeness.xmlOnlyRowCount === 1 ? 'row remains' : 'rows remain';
    return `<div class="ssrb-scope-note" data-ssr-completeness="partial"><b>Partial enrichment:</b> ${completeness.xmlOnlyRowCount} report ${rows} XML-only. Export is allowed for evidence review; unresolved native members or attributes are not complete engineering output.</div>`;
  }
  return '<div class="ssrb-scope-note" data-ssr-completeness="no-xml-only-rows"><b>Enrichment status:</b> no XML-only report rows remain in this bundle.</div>';
}

export function renderSupportReportTable(report) {
  const rows = report?.rows || [];
  if (!rows.length) return '<div class="ssrb-empty">No Support Report rows available.</div>';
  const columns = supportReportColumns(report);
  const visibleRows = rows.slice(0, SUPPORT_REPORT_TABLE_PREVIEW_LIMIT);
  const headers = columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('');
  const body = visibleRows.map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(displayValue(supportReportColumnValue(row, column)))}</td>`).join('')}</tr>`).join('');
  const notice = rows.length > visibleRows.length
    ? `<div class="ssrb-scope-note" data-ssr-preview-limited="report"><b>Large report preview:</b> showing the first ${visibleRows.length} of ${rows.length} rows. CSV, XLSX and Debug exports still contain the complete report.</div>`
    : '';
  return `${notice}<div class="ssrb-table-wrap"><table class="ssrb-table ssrb-report-table"><thead><tr>${headers}</tr></thead><tbody>${body}</tbody></table></div>`;
}

export function renderSupportReportJsonTrace(report) {
  const collected = collectTraceEntries(report?.rows || [], SUPPORT_REPORT_TRACE_PREVIEW_LIMIT);
  const entries = collected.entries;
  if (!entries.length) return '<div class="ssrb-scope-note"><b>Staged JSON trace:</b> no staged member trace is available for this report.</div>';
  const headers = [
    'Secondary / pipe', 'Report location', 'POS cluster', 'Native POS', 'Observed PS/SL',
    'Resolved JSON member(s)', 'Match basis', 'Support type', 'Reference', 'Description', 'INSU',
  ];
  const body = entries.map(({ row, cluster }) => `<tr>${[
    `${row.civilSecondarySupport || ''} · ${row.pipe || ''}`,
    reportLocationText(row), cluster.posClusterId || '', positionText(cluster.positionGlobal),
    joinValues(cluster.observedMemberIds), joinValues(cluster.resolvedMemberIds), joinValues(cluster.matchBases),
    clusterAttribute(cluster, 'supportType'), clusterAttribute(cluster, 'primarySupportReference'),
    clusterAttribute(cluster, 'description'), clusterAttribute(cluster, 'insulationThickness'),
  ].map((value) => `<td>${escapeHtml(value)}</td>`).join('')}</tr>`).join('');
  const previewNotice = collected.truncated
    ? `<div class="ssrb-scope-note" data-ssr-preview-limited="trace"><b>Large trace preview:</b> showing the first ${entries.length} trace rows. Trace CSV and Debug JSON still contain the complete decision trail.</div>`
    : '';
  return `<div class="ssrb-scope-note"><b>Staged JSON trace:</b> native members are grouped by exact staged POS evidence. POS clusters are audit/mapping evidence only; they do not merge separate Navisworks report locations and do not replace report E/W, N/S or BOP coordinates. Direct current PS/SL identity is preferred; PREV-NAME alias is explicit rename evidence. Coordinate/base-anchor identity matching remains inactive.</div>${previewNotice}<div class="ssrb-table-wrap"><table class="ssrb-table ssrb-report-trace-table"><thead><tr>${headers.map((value) => `<th>${escapeHtml(value)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>`;
}

export function renderSupportReportDiagnostics(report) {
  const diagnostics = report?.diagnostics || [];
  if (!diagnostics.length) return '<div class="ssrb-scope-note"><b>Support Report diagnostics:</b> no report-specific exceptions.</div>';
  const counts = diagnostics.reduce((acc, row) => {
    const key = String(row.severity || 'INFO').toUpperCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return `<div class="ssrb-scope-note"><b>Support Report diagnostics:</b> ${counts.ERROR || 0} error · ${counts.WARN || counts.WARNING || 0} warn · ${counts.INFO || 0} info</div><div class="ssrb-diagnostic-list">${diagnostics.slice(0, 40).map((row) => `<div><b>${escapeHtml(row.code || row.severity || 'INFO')}</b><span>${escapeHtml(row.message || '')}</span></div>`).join('')}</div>`;
}

function collectTraceEntries(rows, limit) {
  const entries = [];
  for (const row of rows || []) {
    for (const cluster of traceClusters(row)) {
      if (entries.length >= limit) return { entries, truncated: true };
      entries.push({ row, cluster });
    }
  }
  return { entries, truncated: false };
}
function traceClusters(row) {
  const trace = row?.evidence?.jsonTrace || {};
  if (trace.posClusters?.length) return trace.posClusters;
  return (trace.members || []).map((member, index) => ({
    posClusterId: member.positionGlobal ? `LEGACY_POS_${index + 1}` : 'UNRESOLVED_POS',
    positionGlobal: member.positionGlobal || null,
    observedMemberIds: member.observedMemberId ? [member.observedMemberId] : [],
    resolvedMemberIds: member.resolvedMemberId ? [member.resolvedMemberId] : [],
    matchBases: member.matchBasis ? [member.matchBasis] : [],
    members: [member],
  }));
}
function clusterAttribute(cluster, key) {
  return joinValues((cluster?.members || []).map((member) => member.attributeEvidence?.[key]).filter(Boolean));
}
function reportLocationText(row) {
  return [row?.eastWest, row?.northSouth, row?.bopElevation].filter(Boolean).join(' · ');
}
function joinValues(values) {
  if (!Array.isArray(values)) return values || '';
  return [...new Set(values.filter(Boolean))].join(', ');
}
function renderTypicalitySummary(report) {
  const audit = report?.typicalityAudit;
  if (!audit) return '';
  const matches = audit.matches || [];
  const typical = matches.filter((item) => item.result === 'TYPICAL').length;
  const review = matches.filter((item) => item.result === 'REVIEW').length;
  const ambiguous = matches.filter((item) => item.result === 'AMBIGUOUS').length;
  return `<div class="ssrb-scope-note" data-ssr-typicality-summary="1"><b>Typical-structure comparison:</b> ${typical} typical · ${review} review · ${ambiguous} ambiguous. Row decisions link to the exported Typicality Audit evidence.</div>`;
}
function positionText(point) {
  if (!point || ![point.x, point.y, point.z].every(Number.isFinite)) return '';
  return `E ${point.x}mm · ${point.y < 0 ? 'S' : 'N'} ${Math.abs(point.y)}mm · U ${point.z}mm`;
}
function summaryCard(label, value) {
  return `<div class="ssrb-summary-card"><span>${escapeHtml(label)}</span><strong>${Number(value || 0)}</strong></div>`;
}
function displayValue(value) {
  if (Array.isArray(value)) return value.join(', ');
  if (value && typeof value === 'object') return JSON.stringify(value);
  return value ?? '';
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

export const _test = Object.freeze({ collectTraceEntries });