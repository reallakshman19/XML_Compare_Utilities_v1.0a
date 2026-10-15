import { parseStagedJsonText } from './navis-tag-staged-tree.js';

const DEFAULT_SUPPORT_IDENTITY_HEADERS = Object.freeze([
  'Name of the element',
  'Name',
  'Support Name',
  'Support Identity',
  'PS/SL',
  'PS No',
  'SL No',
]);
const DEFAULT_SUPPORT_FIELD_HEADERS = Object.freeze([
  'Reference of the element',
  'Component spec reference',
  'PIPE',
  'PIPE OF COMPREF',
  'Position',
  'POS',
  'ISOMETRIC NOTES',
  'ISOMETRICNOTES',
  'RTEXT of detailing text',
  'P1BORE OF COMPREF',
]);

function text(value) { return String(value ?? '').trim(); }
function headerKey(value) { return text(value).toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim(); }
function isNonEmptyRow(row) { return Array.isArray(row) && row.some((cell) => text(cell)); }
function trimMatrix(input) {
  const rows = (Array.isArray(input) ? input : []).map((row) => Array.isArray(row) ? [...row] : [row]);
  while (rows.length && !isNonEmptyRow(rows[rows.length - 1])) rows.pop();
  let width = 0;
  for (const row of rows) {
    let last = row.length;
    while (last > 0 && !text(row[last - 1])) last -= 1;
    width = Math.max(width, last);
  }
  return rows.map((row) => row.slice(0, width));
}
function countDataRows(matrix, startIndex) {
  return matrix.slice(startIndex).filter(isNonEmptyRow).length;
}
function identityValueCount(matrix, startIndex, identityColumnIndexes) {
  if (!identityColumnIndexes.length) return 0;
  return matrix.slice(startIndex).filter((row) => identityColumnIndexes.some((index) => text(row[index]))).length;
}

export function evaluateSupportWorksheet(sheet = {}, options = {}) {
  const matrix = trimMatrix(sheet.matrix);
  const configuredIdentityKeys = new Set((options.identityColumns || []).map(headerKey).filter(Boolean));
  const defaultIdentityKeys = new Set(DEFAULT_SUPPORT_IDENTITY_HEADERS.map(headerKey));
  const supportFieldKeys = new Set([...DEFAULT_SUPPORT_FIELD_HEADERS, ...(options.referenceColumns || []), ...(options.pipeColumns || []), options.positionColumn].map(headerKey).filter(Boolean));
  const maxHeaderRows = Math.min(matrix.length, Math.max(1, Number(options.maxHeaderRows) || 50));
  let best = null;
  for (let rowIndex = 0; rowIndex < maxHeaderRows; rowIndex += 1) {
    const row = matrix[rowIndex] || [];
    const keys = row.map(headerKey);
    const nonEmptyHeaderCount = keys.filter(Boolean).length;
    if (!nonEmptyHeaderCount) continue;
    const configuredMatches = keys.filter((key) => configuredIdentityKeys.has(key)).length;
    const defaultIdentityMatches = keys.filter((key) => defaultIdentityKeys.has(key)).length;
    const identityColumnIndexes = keys.map((key, index) => (configuredIdentityKeys.has(key) || defaultIdentityKeys.has(key)) ? index : -1).filter((index) => index >= 0);
    const fieldMatches = keys.filter((key) => supportFieldKeys.has(key)).length;
    const dataRowCount = countDataRows(matrix, rowIndex + 1);
    const identityRows = identityValueCount(matrix, rowIndex + 1, identityColumnIndexes);
    const recognizedIdentity = configuredMatches > 0 || defaultIdentityMatches > 0;
    const score = configuredMatches * 1_000_000
      + defaultIdentityMatches * 500_000
      + identityRows * 10_000
      + fieldMatches * 1_000
      + dataRowCount * 10
      + nonEmptyHeaderCount
      - rowIndex;
    const candidate = {
      sheetName: text(sheet.name) || `Sheet ${Number(sheet.index || 0) + 1}`,
      sheetIndex: Number(sheet.index || 0),
      matrix,
      headerRowIndex: rowIndex,
      headerRowNumber: rowIndex + 1,
      dataRowCount,
      identityValueCount: identityRows,
      configuredIdentityHeaderMatches: configuredMatches,
      defaultIdentityHeaderMatches: defaultIdentityMatches,
      supportFieldHeaderMatches: fieldMatches,
      recognizedIdentity,
      score,
      headers: row.map(text),
    };
    if (!best || candidate.score > best.score || (candidate.score === best.score && candidate.headerRowIndex < best.headerRowIndex)) best = candidate;
  }
  return best || {
    sheetName: text(sheet.name) || `Sheet ${Number(sheet.index || 0) + 1}`,
    sheetIndex: Number(sheet.index || 0),
    matrix,
    headerRowIndex: 0,
    headerRowNumber: 1,
    dataRowCount: 0,
    identityValueCount: 0,
    configuredIdentityHeaderMatches: 0,
    defaultIdentityHeaderMatches: 0,
    supportFieldHeaderMatches: 0,
    recognizedIdentity: false,
    score: Number.NEGATIVE_INFINITY,
    headers: [],
  };
}

export function selectSupportWorksheetFromMatrices(sheets = [], options = {}) {
  const candidates = (Array.isArray(sheets) ? sheets : []).map((sheet, index) => evaluateSupportWorksheet({ ...sheet, index: sheet?.index ?? index }, options));
  const nonEmpty = candidates.filter((candidate) => candidate.matrix.length && candidate.matrix.some(isNonEmptyRow));
  const recognized = nonEmpty.filter((candidate) => candidate.recognizedIdentity && candidate.dataRowCount > 0);
  const pool = recognized.length ? recognized : nonEmpty;
  const selected = [...pool].sort((a, b) => b.score - a.score || a.sheetIndex - b.sheetIndex || a.headerRowIndex - b.headerRowIndex)[0] || null;
  const diagnostics = [];
  if (!selected) {
    diagnostics.push({ severity: 'ERROR', code: 'WORKBOOK_NO_NONEMPTY_WORKSHEET', message: 'Workbook contains no non-empty worksheet.' });
  } else if (!selected.recognizedIdentity) {
    diagnostics.push({ severity: 'WARN', code: 'WORKBOOK_SUPPORT_SHEET_FALLBACK', message: `No worksheet contained a configured or known support identity header. Selected the strongest non-empty worksheet "${selected.sheetName}" for manual mapping review.` });
  } else {
    diagnostics.push({ severity: 'INFO', code: 'WORKBOOK_SUPPORT_SHEET_SELECTED', message: `Selected worksheet "${selected.sheetName}" at header row ${selected.headerRowNumber} with ${selected.dataRowCount} candidate data rows.` });
  }
  return {
    selected,
    diagnostics,
    candidates: candidates.map(({ matrix, ...candidate }) => candidate),
    selectionMode: selected ? (selected.recognizedIdentity ? 'IDENTITY_HEADER' : 'FALLBACK_NON_EMPTY') : 'NONE',
  };
}

function quoteTsvCell(value) {
  const output = String(value ?? '');
  return /[\t"\n\r]/.test(output) ? `"${output.replace(/"/g, '""')}"` : output;
}
function matrixToTsv(matrix, headerRowIndex = 0) {
  return trimMatrix(matrix).slice(Math.max(0, headerRowIndex)).map((row) => row.map(quoteTsvCell).join('\t')).join('\n');
}

export async function readNavisTagTableFile(file, options = {}) {
  if (/\.(xlsx|xlsm|xlsb|xls|ods)$/i.test(file.name)) {
    const module = await import('https://esm.sh/xlsx@0.18.5');
    const XLSX = module.default || module;
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const sheets = workbook.SheetNames.map((name, index) => ({
      name,
      index,
      matrix: XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: false, defval: '', blankrows: false }),
    }));
    const selection = selectSupportWorksheetFromMatrices(sheets, options);
    const selected = selection.selected;
    const result = {
      text: selected ? matrixToTsv(selected.matrix, selected.headerRowIndex) : '',
      meta: {
        kind: 'workbook',
        fileName: file.name,
        sheetCount: workbook.SheetNames.length,
        selectedSheetName: selected?.sheetName || '',
        selectedSheetIndex: selected?.sheetIndex ?? -1,
        headerRowNumber: selected?.headerRowNumber || 0,
        candidateDataRowCount: selected?.dataRowCount || 0,
        identityValueCount: selected?.identityValueCount || 0,
        selectionMode: selection.selectionMode,
        candidates: selection.candidates,
        diagnostics: selection.diagnostics,
      },
    };
    return options.returnMetadata ? result : result.text;
  }
  const content = await file.text();
  const result = {
    text: content,
    meta: {
      kind: 'text',
      fileName: file.name,
      sheetCount: 0,
      selectedSheetName: '',
      selectedSheetIndex: -1,
      headerRowNumber: content ? 1 : 0,
      candidateDataRowCount: Math.max(0, content.split(/\r?\n/).filter((line) => text(line)).length - 1),
      identityValueCount: 0,
      selectionMode: 'TEXT_SOURCE',
      candidates: [],
      diagnostics: [],
    },
  };
  return options.returnMetadata ? result : result.text;
}

export async function readNavisTagStagedFile(file) {
  if (!/\.zip$/i.test(file.name)) {
    const parsed = parseStagedJsonText(await file.text(), file.name);
    if (!parsed.documents.length) throw new Error(parsed.diagnostics[0]?.message || 'JSON parse failed');
    return parsed.documents;
  }
  const module = await import('https://esm.sh/jszip@3.10.1');
  const JSZip = module.default || module;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const documents = [];
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir || !/\.json$/i.test(name)) continue;
    const parsed = parseStagedJsonText(await entry.async('text'), name);
    documents.push(...parsed.documents);
  }
  if (!documents.length) throw new Error('ZIP contains no parseable JSON documents.');
  return documents;
}
export function downloadNavisTagFile(name, content, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url);
}