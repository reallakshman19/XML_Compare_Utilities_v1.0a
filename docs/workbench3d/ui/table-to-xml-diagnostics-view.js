import { serializeTableXmlDiagnostics, tableXmlDiagnosticsFilename } from '../tablexml/tablexml-diagnostics.js';

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[ch]);
}

export function tableXmlDiagnosticsPanelHtml(document, side = 'table') {
  if (!document) return '';
  const summary = document.summary ?? {};
  const records = Array.isArray(document.records) ? document.records : [];
  const errorCount = Number(summary.error ?? 0);
  const warningCount = Number(summary.warning ?? 0);
  const open = errorCount > 0 || warningCount > 0 ? ' open' : '';
  const rows = records.slice(0, 300).map((record) => `
    <tr>
      <td>${esc(record.severity)}</td>
      <td><code>${esc(record.code)}</code></td>
      <td>${esc(record.stage)}</td>
      <td>${esc(record.sourceRowId || record.sourceColumnId)}</td>
      <td>${esc(record.action)}</td>
      <td>${esc(record.message)}</td>
    </tr>`).join('');
  return `
  <details class="wb3d-card" data-tablexml-diagnostics${open}>
    <summary>NodeSet diagnostics — ${Number(summary.total ?? records.length)} events, ${errorCount} errors, ${warningCount} warnings</summary>
    <div class="wb3d-toolbar" style="margin-top:8px">
      <span class="wb3d-badge">${esc(document.schema)}</span>
      <span class="wb3d-badge">purpose: ${esc(document.purpose)}</span>
      <span class="wb3d-badge">coordinates: ${esc(document.metadata?.coordinateMode)}</span>
      <button class="wb3d-btn" data-action="txml-download-diagnostics">Download diagnostics JSON</button>
    </div>
    <div class="wb3d-table-wrap" style="max-height:360px;overflow:auto">
      <table>
        <thead><tr><th>Severity</th><th>Code</th><th>Stage</th><th>Source</th><th>Action</th><th>Message</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${records.length > 300 ? `<p class="wb3d-muted">Showing 300 of ${records.length} records. Download the JSON for the complete ledger.</p>` : ''}
  </details>`;
}

export function tableXmlDiagnosticsDownload(document, side = 'table') {
  return {
    name: tableXmlDiagnosticsFilename(side),
    text: serializeTableXmlDiagnostics(document),
    mime: 'application/json;charset=utf-8',
  };
}
