import {
  createXmlCompareSideloadDiagnostics,
  serializeXmlCompareSideloadDiagnostics,
  xmlCompareSideloadDiagnosticsFileName,
} from './XmlCompareSideloadDiagnostics.js';

const esc = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

function diagnosticsRows(records, limit) {
  return records.slice(0, limit).map((record) => `<tr>
    <td>${esc(record.severity)}</td>
    <td>${esc(record.code)}</td>
    <td>${esc(record.sourceRow ?? '—')}</td>
    <td>${esc(record.outputField || '—')}</td>
    <td>${esc(record.action || '—')}</td>
    <td>${esc(record.message)}</td>
  </tr>`).join('');
}

export function renderXmlCompareSideloadDiagnosticsHtml(report, options = {}) {
  if (!report) return '<small>No sideload diagnostics are available.</small>';
  const document = createXmlCompareSideloadDiagnostics(report);
  const limit = Math.max(1, Number(options.limit) || 100);
  const summary = document.summary;
  const shouldOpen = summary.warning > 0 || summary.error > 0;
  const rows = diagnosticsRows(document.records, limit);
  const remaining = Math.max(0, document.records.length - limit);
  const fileName = xmlCompareSideloadDiagnosticsFileName();
  const href = `data:application/json;charset=utf-8,${encodeURIComponent(
    serializeXmlCompareSideloadDiagnostics(document),
  )}`;
  return `<details class="xml-compare-sideload-diagnostics"${shouldOpen ? ' open' : ''}>
    <summary>Diagnostics — ${summary.error} error, ${summary.warning} warning, ${summary.info} info</summary>
    <div class="xml-compare-sideload-actions">
      <a href="${href}" download="${esc(fileName)}">Download ${esc(fileName)}</a>
    </div>
    <div class="xml-compare-table-scroll">
      <table class="xml-compare-linewise-table">
        <thead><tr><th>Severity</th><th>Code</th><th>Row</th><th>Output</th><th>Action</th><th>Message</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="6">No diagnostics.</td></tr>'}</tbody>
      </table>
    </div>
    ${remaining ? `<small>${remaining} additional record(s) are included in the JSON artifact.</small>` : ''}
  </details>`;
}

export function sideloadDiagnosticsDownloadPayload(report = {}) {
  return Object.freeze({
    fileName: xmlCompareSideloadDiagnosticsFileName(),
    text: serializeXmlCompareSideloadDiagnostics(report),
    mime: 'application/json;charset=utf-8',
  });
}

export const _test = Object.freeze({ esc, diagnosticsRows });
