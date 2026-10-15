export const PIPELINE_DERIVED_TABLE_PREVIEW_HEAD_ROWS = 100;
export const PIPELINE_DERIVED_TABLE_PREVIEW_TAIL_ROWS = 100;

function text(value) {
  return String(value ?? '');
}

function escapeHtml(value) {
  return text(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
}

function visitNonBlankLines(value, visit) {
  const source = text(value);
  let start = 0;
  for (let index = 0; index <= source.length; index += 1) {
    if (index < source.length && source[index] !== '\n') continue;
    const end = index > start && source[index - 1] === '\r' ? index - 1 : index;
    const line = source.slice(start, end);
    if (line.trim()) visit(line);
    start = index + 1;
  }
}

export function buildPipelineDerivedTablePreview(value, options = {}) {
  const headLimit = Number.isInteger(options.headRows) && options.headRows >= 0
    ? options.headRows : PIPELINE_DERIVED_TABLE_PREVIEW_HEAD_ROWS;
  const tailLimit = Number.isInteger(options.tailRows) && options.tailRows >= 0
    ? options.tailRows : PIPELINE_DERIVED_TABLE_PREVIEW_TAIL_ROWS;
  let headers = null;
  const headRows = [];
  const tailRows = [];
  let totalRows = 0;
  visitNonBlankLines(value, (line) => {
    const cells = line.split('\t');
    if (!headers) { headers = cells; return; }
    totalRows += 1;
    if (headRows.length < headLimit) headRows.push(cells);
    else if (tailLimit) {
      tailRows.push(cells);
      if (tailRows.length > tailLimit) tailRows.shift();
    }
  });
  const omittedRows = Math.max(0, totalRows - headRows.length - tailRows.length);
  return Object.freeze({
    headers: Object.freeze(headers || []),
    headRows: Object.freeze(headRows.map((row) => Object.freeze(row))),
    tailRows: Object.freeze(tailRows.map((row) => Object.freeze(row))),
    totalRows,
    displayedRows: headRows.length + tailRows.length,
    omittedRows,
    truncated: omittedRows > 0,
  });
}

function rowHtml(headers, row) {
  return `<tr>${headers.map((_, index) => `<td>${escapeHtml(row[index] ?? '')}</td>`).join('')}</tr>`;
}

function previewSummary(preview) {
  if (!preview.truncated) return `Showing all ${preview.totalRows} row${preview.totalRows === 1 ? '' : 's'}.`;
  return `Showing first ${preview.headRows.length} and last ${preview.tailRows.length} of ${preview.totalRows} rows; ${preview.omittedRows} middle rows omitted from the browser preview.`;
}

export function buildPipelineDerivedTablePreviewHtml(value, options = {}) {
  const preview = buildPipelineDerivedTablePreview(value, options);
  const headers = preview.headers;
  const head = preview.headRows.map((row) => rowHtml(headers, row));
  const gap = preview.truncated
    ? [`<tr data-p3d-derived-preview-gap><td colspan="${Math.max(1, headers.length)}">${preview.omittedRows} rows omitted from preview</td></tr>`] : [];
  const tail = preview.tailRows.map((row) => rowHtml(headers, row));
  const header = headers.map((cell) => `<th>${escapeHtml(cell)}</th>`).join('');
  return `<div class="p3d-derived-grid"><p data-p3d-derived-preview-summary>${escapeHtml(previewSummary(preview))}</p><table><thead><tr>${header}</tr></thead><tbody>${[...head, ...gap, ...tail].join('')}</tbody></table></div>`;
}
