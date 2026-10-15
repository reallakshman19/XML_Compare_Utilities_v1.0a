/**
 * table-normalizer.js — pre-parse cleanup for pasted engineering tables (pure).
 *
 * Real exports contain quoted cells with embedded newlines/tabs (multi-line
 * Excel headers) and mid-cell inch quotes (QHBF-1000-24"-P…). The shared
 * parseTableSource splits by newline FIRST, so a multi-line quoted header
 * breaks the header row. This normalizer applies CSV quote semantics —
 * a cell is quoted only when the quote is the FIRST character of the cell —
 * and rewrites the text so every logical row is one physical line:
 *   - newlines/tabs inside quoted cells → single space
 *   - escaped "" inside quoted cells → literal "
 *   - wrapping quotes removed (tab-delimited cells keep inch quotes intact)
 */

export function normalizeTableText(text) {
  const source = String(text ?? '').replace(/\r\n?/g, '\n').replace(/^﻿/, '');
  const delimiter = source.includes('\t') ? '\t' : ',';
  let out = '';
  let inQuote = false;
  let atCellStart = true;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (inQuote) {
      if (ch === '"') {
        if (source[i + 1] === '"') { out += '"'; i += 1; continue; }
        inQuote = false; // closing quote dropped (wrapping quotes removed)
        continue;
      }
      if (ch === '\n' || ch === '\t') { out += ' '; continue; }
      out += ch;
      continue;
    }
    if (ch === '"' && atCellStart) { inQuote = true; atCellStart = false; continue; }
    if (ch === delimiter || ch === '\n') { atCellStart = true; out += ch; continue; }
    atCellStart = false;
    out += ch;
  }
  return out;
}

/**
 * Drop columns that are empty in the header AND in every row (trailing filler
 * tabs from spreadsheet exports create dozens of nameless empty columns).
 * Operates on normalized single-line-per-row text.
 */
export function dropEmptyColumns(text) {
  const lines = String(text ?? '').split('\n').filter((l) => l.trim() !== '');
  if (!lines.length) return text;
  const delimiter = lines[0].includes('\t') ? '\t' : null;
  if (!delimiter) return String(text ?? ''); // comma CSV: leave to the parser
  const table = lines.map((l) => l.split(delimiter));
  const width = Math.max(...table.map((r) => r.length));
  const keep = [];
  for (let c = 0; c < width; c += 1) {
    const headerNamed = String(table[0][c] ?? '').trim() !== '';
    const hasData = table.slice(1).some((row) => String(row[c] ?? '').trim() !== '');
    if (headerNamed || hasData) keep.push(c);
  }
  return table.map((row) => keep.map((c) => row[c] ?? '').join(delimiter)).join('\n');
}

/** Full pre-parse pipeline used by the Table-to-XML loader. */
export function prepareTableText(text) {
  return dropEmptyColumns(normalizeTableText(text));
}
