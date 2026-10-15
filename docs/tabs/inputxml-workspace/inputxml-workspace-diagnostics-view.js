import { createInputXmlWorkspaceDiagnostics, serializeInputXmlWorkspaceDiagnostics } from './inputxml-workspace-diagnostics.js';

const esc = (value) => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

function diagnosticsHref(document) {
  return `data:application/json;charset=utf-8,${encodeURIComponent(serializeInputXmlWorkspaceDiagnostics(document))}`;
}

function recordRow(record) {
  return `<tr><td>${esc(record.severity)}</td><td>${esc(record.code)}</td><td>${esc(record.stage)}</td><td>${esc(record.action)}</td><td>${esc(record.message)}</td></tr>`;
}

export function renderInputXmlWorkspaceDiagnosticsHtml(input = {}) {
  const document = createInputXmlWorkspaceDiagnostics(input);
  const open = document.summary.error > 0 || document.summary.warning > 0;
  const rows = document.records.slice(-100).map(recordRow).join('');
  const empty = '<tr><td colspan="5">No workspace diagnostics yet.</td></tr>';
  return `<details class="ixw-panel ixw-diagnostics" ${open ? 'open' : ''}>
    <summary><strong>Workspace diagnostics</strong> · ${document.summary.total} event(s) · ${document.summary.error} error(s) · ${document.summary.warning} warning(s)</summary>
    <div class="ixw-toolbar"><a class="ixw-btn" download="inputxml_workspace_diagnostics.json" href="${diagnosticsHref(document)}">Download diagnostics JSON</a></div>
    <div style="overflow:auto;max-height:280px;"><table class="ixw-table"><thead><tr><th>Severity</th><th>Code</th><th>Stage</th><th>Action</th><th>Message</th></tr></thead><tbody>${rows || empty}</tbody></table></div>
  </details>`;
}

export const _test = Object.freeze({ esc, diagnosticsHref, recordRow });
