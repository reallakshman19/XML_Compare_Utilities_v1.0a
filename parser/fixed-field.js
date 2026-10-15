/**
 * Fixed-field helpers for CAESAR II neutral records.
 *
 * CAESAR II neutral rows are Fortran-style fixed-width records. Adjacent
 * numeric fields are therefore valid even when there is no whitespace
 * delimiter (for example: "0.000000-0.488281E-03"). Do not use whitespace
 * tokenisation as the primary decoder for canonical rows.
 */

export const CII_SIX_FIELD_WIDTHS = Object.freeze([15, 13, 13, 13, 13, 13]);

export function parseFortranNumber(field) {
  const text = String(field ?? '').trim();
  if (!text) return null;
  const value = Number(text.replace(/[dD]/g, 'E'));
  return Number.isFinite(value) ? value : Number.NaN;
}

export function decodeFixedFields(rawLine, widths = CII_SIX_FIELD_WIDTHS) {
  const line = String(rawLine ?? '');
  const fields = [];
  let offset = 0;

  for (const width of widths) {
    fields.push(line.slice(offset, offset + width));
    offset += width;
  }

  return fields;
}

function trimTrailingNulls(values) {
  let end = values.length;
  while (end > 0 && values[end - 1] === null) end -= 1;
  return values.slice(0, end);
}

/**
 * Decode one numeric CAESAR II row.
 *
 * Canonical rows use the fixed-width decoder first. Whitespace tokenisation
 * remains only as a compatibility fallback for shorter/non-canonical numeric
 * rows in legacy exports.
 *
 * Returns null when the row is non-numeric or contains an invalid numeric
 * field. Empty fixed columns are preserved as null so downstream callers do
 * not silently shift engineering columns.
 */
export function decodeCiiNumericRow(rawLine, widths = CII_SIX_FIELD_WIDTHS) {
  const line = String(rawLine ?? '');
  if (!line.trim()) return null;

  const totalWidth = widths.reduce((sum, width) => sum + width, 0);
  if (line.length >= totalWidth) {
    const fields = decodeFixedFields(line, widths);
    const values = fields.map(parseFortranNumber);
    const hasNumericField = fields.some((field) => field.trim());
    const invalid = values.some((value, index) => fields[index].trim() && !Number.isFinite(value));

    if (hasNumericField && !invalid) return trimTrailingNulls(values);
  }

  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;
  const values = tokens.map(parseFortranNumber);
  if (values.some((value) => !Number.isFinite(value))) return null;
  return values;
}
