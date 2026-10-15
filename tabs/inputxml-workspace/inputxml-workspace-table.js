/**
 * Small table parsing helpers shared by InputXML Workspace tabs.
 * Inputs: pasted TSV/CSV/pipe/whitespace text with optional headers.
 * Outputs: normalized row objects plus projected text exports.
 * Fallback: when headers are missing, callers can provide ordered column names.
 */

const clean = (value) => String(value ?? '').trim();
const normalKey = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '');

export function splitTableLine(line = '') {
  const raw = String(line ?? '').trim();
  if (!raw || raw.startsWith('#')) return [];
  if (raw.includes('\t')) return raw.split('\t').map(clean);
  if (raw.includes('|')) return raw.split('|').map(clean);
  if (raw.includes(',')) return raw.split(',').map(clean);
  return raw.split(/\s+/).map(clean);
}

function headerIndex(headers = [], aliases = []) {
  const keys = aliases.map(normalKey);
  return headers.findIndex((header) => keys.includes(normalKey(header)));
}

function looksLikeHeader(cells = [], columns = []) {
  return columns.some((column) => headerIndex(cells, column.aliases || [column.key]) >= 0);
}

export function parseLooseTable(text = '', columns = [], options = {}) {
  const rows = [];
  let headers = null;
  for (const line of String(text ?? '').split(/\r?\n/)) {
    let cells = splitTableLine(line);
    if (!cells.length) continue;
    if (!headers && looksLikeHeader(cells, columns)) {
      headers = cells;
      continue;
    }
    if (options.joinTail === true && cells.length > columns.length) {
      cells = [...cells.slice(0, columns.length - 1), cells.slice(columns.length - 1).join(' ')];
    }
    const row = {};
    columns.forEach((column, index) => {
      if (headers) {
        const sourceIndex = headerIndex(headers, column.aliases || [column.key]);
        row[column.key] = sourceIndex >= 0 ? clean(cells[sourceIndex]) : '';
      } else {
        row[column.key] = clean(cells[index]);
      }
    });
    if (Object.values(row).some((value) => clean(value))) rows.push(row);
  }
  return rows;
}

export function rowsToTabText(rows = [], columns = []) {
  const headers = columns.map((column) => column.label || column.key);
  const lines = [headers.join('\t')];
  for (const row of rows || []) lines.push(columns.map((column) => clean(rowValue(row, column))).join('\t'));
  return lines.join('\n');
}

export function projectRows(rows = [], columns = []) {
  return (rows || []).map((row) => Object.fromEntries(columns.map((column) => [column.key, clean(rowValue(row, column))])));
}

function rowValue(row = {}, column = {}) {
  const directKeys = [column.key, column.sourceKey, ...(column.aliases || [])].filter(Boolean);
  for (const key of directKeys) if (row[key] !== undefined && row[key] !== null) return row[key];
  const rowKeys = Object.keys(row || []);
  const normalized = new Map(rowKeys.map((key) => [normalKey(key), key]));
  for (const key of directKeys) {
    const source = normalized.get(normalKey(key));
    if (source && row[source] !== undefined && row[source] !== null) return row[source];
  }
  return '';
}

export const _test = Object.freeze({ clean, normalKey, looksLikeHeader, headerIndex, rowValue });
