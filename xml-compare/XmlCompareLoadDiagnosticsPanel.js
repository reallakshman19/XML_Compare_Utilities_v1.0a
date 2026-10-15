export const XML_COMPARE_LOAD_DIAGNOSTICS_PANEL_SCHEMA = 'xml-compare-load-diagnostics-panel/v1';
export const XML_COMPARE_LOAD_DIAGNOSTICS_MAX_ROWS = 80;

const clean = (value) => String(value ?? '').trim();
const esc = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function sizeLabel(value) {
  const size = num(value);
  if (size <= 0) return '0 B';
  if (size < 1024) return `${size} B`;
  if (size < 1048576) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1048576).toFixed(2)} MB`;
}

export function createLoadDiagnosticsState(input = {}) {
  const rows = Array.isArray(input.rows) ? input.rows.slice(-XML_COMPARE_LOAD_DIAGNOSTICS_MAX_ROWS) : [];
  return Object.freeze({ seq: num(input.seq, rows.length), rows: Object.freeze(rows.map((row) => Object.freeze({ ...row }))) });
}

export function appendLoadDiagnosticRow(input = {}, row = {}) {
  const state = createLoadDiagnosticsState(input), seq = state.seq + 1;
  const next = Object.freeze({
    id: clean(row.id) || `load-diagnostic-${seq}`,
    ts: clean(row.ts) || new Date().toISOString(),
    side: clean(row.side),
    event: clean(row.event),
    level: clean(row.level || 'info'),
    fileName: clean(row.fileName),
    size: num(row.size),
    chars: row.chars == null ? null : num(row.chars),
    profile: clean(row.profile),
    workspaceRevision: num(row.workspaceRevision),
    message: clean(row.message),
  });
  return createLoadDiagnosticsState({ seq, rows: [...state.rows, next].slice(-XML_COMPARE_LOAD_DIAGNOSTICS_MAX_ROWS) });
}

export function clearLoadDiagnosticsState(input = {}) {
  return appendLoadDiagnosticRow({ seq: createLoadDiagnosticsState(input).seq, rows: [] }, { event: 'diagnostics-cleared', level: 'info', message: 'Load diagnostics cleared.' });
}

function sideLabel(side = '') {
  if (side === 'a') return 'Source A';
  if (side === 'b') return 'Target B';
  return '-';
}

function rowHtml(row = {}) {
  return `<tr><td>${esc(row.ts)}</td><td>${esc(sideLabel(row.side))}</td><td>${esc(row.event)}</td><td>${esc(row.fileName || '-')}</td><td>${esc(sizeLabel(row.size))}</td><td>${row.chars == null ? '-' : esc(row.chars)}</td><td>${esc(row.profile || '-')}</td><td>${esc(row.workspaceRevision)}</td><td>${esc(row.message || '-')}</td></tr>`;
}

export function renderXmlCompareLoadDiagnosticsPanelHtml(input = {}) {
  const state = createLoadDiagnosticsState(input), rows = state.rows;
  const body = rows.length ? rows.map(rowHtml).join('') : '<tr><td colspan="9">No load diagnostics yet. Select Source A or Target B XML to begin.</td></tr>';
  return `<section class="xml-compare-panel xml-compare-load-diagnostics-panel" data-xml-compare-load-diagnostics-panel><div class="xml-compare-panel-title">Load Diagnostics</div><div class="xml-compare-topology-actions"><button type="button" data-xml-compare-action="clear-load-diagnostics">Clear diagnostics</button><span>${esc(rows.length)} event(s)</span></div><div class="xml-compare-table-scroll"><table class="xml-compare-topology-table"><thead><tr><th>Time</th><th>Side</th><th>Event</th><th>File</th><th>Size</th><th>Chars</th><th>Profile</th><th>Revision</th><th>Message</th></tr></thead><tbody>${body}</tbody></table></div></section>`;
}

export const _test = Object.freeze({ clean, esc, num, sizeLabel, sideLabel, rowHtml });
