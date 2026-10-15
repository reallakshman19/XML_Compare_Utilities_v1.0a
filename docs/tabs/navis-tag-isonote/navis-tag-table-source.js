import { coordinateProfileOptions, normalizeConfig, normalizeReference, normalizeSupportIdentity, parseCoordinate, supportRoot, text } from './navis-tag-isonote-contracts.js';

function parseLine(line, delimiter) {
  const cells = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && quoted && line[index + 1] === '"') { cell += '"'; index += 1; }
    else if (char === '"' && (quoted || cell === '')) quoted = !quoted;
    else if (char === '"') cell += char;
    else if (char === delimiter && !quoted) { cells.push(cell); cell = ''; }
    else cell += char;
  }
  cells.push(cell);
  return cells.map((value) => text(value));
}
function detectDelimiter(lines) {
  const sample = lines.find((line) => text(line)) || '';
  return ['\t', ',', ';', '|'].map((delimiter) => ({ delimiter, count: parseLine(sample, delimiter).length })).sort((a, b) => b.count - a.count)[0]?.delimiter || '\t';
}
function uniqueHeaders(values) {
  const used = new Set();
  return values.map((raw, index) => {
    const base = text(raw) || `Column ${index + 1}`;
    let value = base;
    let suffix = 2;
    while (used.has(value)) value = `${base}_${suffix++}`;
    used.add(value);
    return value;
  });
}
export function parseSupportTableText(rawText) {
  const lines = String(rawText ?? '').replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => text(line));
  if (!lines.length) return { delimiter: '\t', headers: [], rows: [], diagnostics: [{ severity: 'ERROR', code: 'EMPTY_SUPPORT_TABLE', message: 'Support table is empty.' }] };
  const delimiter = detectDelimiter(lines);
  const headers = uniqueHeaders(parseLine(lines[0], delimiter));
  const rows = lines.slice(1).map((line, index) => {
    const cells = parseLine(line, delimiter);
    const row = { _rowIndex: index + 2 };
    headers.forEach((header, cellIndex) => { row[header] = cells[cellIndex] ?? ''; });
    return row;
  }).filter((row) => headers.some((header) => text(row[header])));
  return { delimiter, headers, rows, diagnostics: [] };
}
function tableIdentity(row, config) {
  const values = config.tableIdentityColumns.map((column) => ({ column, value: text(row[column]) })).filter((item) => item.value);
  if (!values.length) return { raw: '', canonical: '', column: '', all: [] };
  if (config.tableIdentityMode === 'concatenate') {
    const raw = values.map((item) => item.value).join('|');
    return { raw, canonical: normalizeSupportIdentity(raw), column: values.map((item) => item.column).join('|'), all: values };
  }
  return { raw: values[0].value, canonical: normalizeSupportIdentity(values[0].value), column: values[0].column, all: values };
}
function tablePosition(row, config) {
  if (config.tablePositionMode === 'separate') {
    const raw = { x: row[config.tableEastingColumn], y: row[config.tableNorthingColumn], z: row[config.tableElevationColumn] };
    return { point: parseCoordinate(raw, config.tableUnits, coordinateProfileOptions(config, 'table')), sourceColumn: [config.tableEastingColumn, config.tableNorthingColumn, config.tableElevationColumn].filter(Boolean).join('|'), raw };
  }
  const raw = row[config.tablePositionColumn];
  return { point: parseCoordinate(raw, config.tableUnits, coordinateProfileOptions(config, 'table')), sourceColumn: config.tablePositionColumn, raw };
}
function firstColumnValue(row, columns) {
  for (const column of columns || []) {
    const value = text(row[column]);
    if (value) return { column, value };
  }
  return { column: '', value: '' };
}
export function buildSupportTableRecords(parsed, inputConfig = {}) {
  const config = normalizeConfig(inputConfig);
  const diagnostics = [...(parsed?.diagnostics || [])];
  const headers = parsed?.headers || [];
  for (const column of config.tableIdentityColumns) if (!headers.includes(column)) diagnostics.push({ severity: 'WARN', code: 'TABLE_IDENTITY_COLUMN_NOT_FOUND', column, message: `Configured identity column "${column}" is not present in the imported table.` });
  const records = (parsed?.rows || []).map((rawRow, index) => {
    const identity = tableIdentity(rawRow, config);
    const position = tablePosition(rawRow, config);
    const pipe = firstColumnValue(rawRow, config.tablePipeColumns);
    const reference = firstColumnValue(rawRow, config.tableReferenceColumns);
    if (!identity.canonical) diagnostics.push({ severity: 'WARN', code: 'TABLE_IDENTITY_MISSING', rowIndex: rawRow._rowIndex, message: 'Configured support identity columns are empty.' });
    return {
      rowId: `TABLE-${index + 1}`,
      rowIndex: rawRow._rowIndex || index + 2,
      rawRow,
      identityRaw: identity.raw,
      identity: identity.canonical,
      supportRoot: supportRoot(identity.canonical),
      identityColumn: identity.column,
      identityValues: identity.all,
      inputReferenceRaw: reference.value,
      inputReference: normalizeReference(reference.value),
      inputReferenceColumn: reference.column,
      position: position.point,
      positionRaw: position.raw,
      positionColumn: position.sourceColumn,
      inputPipe: pipe.value,
      inputPipeColumn: pipe.column,
      existingIsometricNotes: text(rawRow['ISOMETRIC NOTES'] ?? rawRow.ISONOTE ?? ''),
    };
  });
  return {
    config,
    headers,
    records,
    diagnostics,
    summary: {
      rowCount: records.length,
      identityCount: records.filter((row) => row.identity).length,
      referenceCount: records.filter((row) => row.inputReference).length,
      positionedRowCount: records.filter((row) => row.position).length,
      pipeCount: records.filter((row) => row.inputPipe).length,
    },
  };
}
export function rowsToCsv(rows, preferredHeaders = []) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const headers = [...preferredHeaders];
  for (const row of safeRows) for (const key of Object.keys(row || {})) if (!headers.includes(key)) headers.push(key);
  const quote = (value) => {
    const output = value && typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
    return /[",\n\r]/.test(output) ? `"${output.replace(/"/g, '""')}"` : output;
  };
  return [headers.join(','), ...safeRows.map((row) => headers.map((header) => quote(row?.[header])).join(','))].join('\n');
}
