const XLSX_MODULE_URL = 'https://esm.sh/xlsx@0.18.5';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const HEADER_SCAN_LIMIT = 40;

export async function readSupportRevisionFile(file, options = {}) {
  if (!file) throw new Error('No revision file was selected.');
  if (!isXlsxFile(file)) {
    if (typeof file.text !== 'function') throw new Error('Selected text input cannot be read by this browser.');
    return Object.freeze({
      format: 'text',
      text: await file.text(),
      sheetName: '',
      rowCount: null,
      columnCount: null,
    });
  }

  if (typeof file.arrayBuffer !== 'function') throw new Error('Selected XLSX input cannot be read by this browser.');
  const XLSX = options.XLSX || await loadXlsx(options.importModule);
  assertXlsxReader(XLSX);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const workbook = XLSX.read(bytes, {
    type: 'array',
    cellFormula: true,
    cellText: true,
    cellDates: false,
  });
  const extracted = extractSupportReportTable(workbook, XLSX, options);
  return Object.freeze({
    format: 'xlsx',
    text: matrixToCsv(extracted.rows),
    sheetName: extracted.sheetName,
    rowCount: Math.max(extracted.rows.length - 1, 0),
    columnCount: extracted.rows[0]?.length || 0,
  });
}

export function isXlsxFile(file) {
  const name = String(file?.name || '').trim().toLowerCase();
  const type = String(file?.type || '').trim().toLowerCase();
  return name.endsWith('.xlsx') || type === XLSX_MIME;
}

export function extractSupportReportTable(workbook, XLSX, options = {}) {
  assertXlsxReader(XLSX);
  const sheetNames = Array.isArray(workbook?.SheetNames) ? workbook.SheetNames : [];
  const candidates = [];
  const scanLimit = Number.isFinite(options.headerScanLimit)
    ? Math.max(1, Math.floor(options.headerScanLimit))
    : HEADER_SCAN_LIMIT;

  for (const sheetName of sheetNames) {
    const sheet = workbook?.Sheets?.[sheetName];
    if (!sheet) continue;
    const rows = worksheetMatrix(sheet, XLSX);
    const limit = Math.min(rows.length, scanLimit);
    for (let index = 0; index < limit; index += 1) {
      const row = rows[index] || [];
      const normalized = row.map(normalizeHeader);
      const hasPipe = normalized.includes('PIPE');
      const hasCivil = normalized.some(isCivilSecondarySupportHeader);
      if (!hasPipe || !hasCivil) continue;

      const headerWidth = lastNonBlankIndex(row) + 1;
      if (headerWidth <= 0) continue;
      const table = rows.slice(index).map((current) => (
        Array.from({ length: headerWidth }, (_, column) => String(current?.[column] ?? ''))
      ));
      while (table.length && rowIsBlank(table[table.length - 1])) table.pop();
      candidates.push(Object.freeze({ sheetName, rows: Object.freeze(table.map((item) => Object.freeze(item))) }));
      break;
    }
  }

  if (!candidates.length) {
    throw new Error('No Support Report header row found in XLSX. Expected PIPE and CIVIL SECONDARY SUPPORT within the first 40 worksheet rows.');
  }

  return candidates.reduce((best, candidate) => (
    candidate.rows.length > best.rows.length ? candidate : best
  ));
}

export function matrixToCsv(rows) {
  return (rows || []).map((row) => (row || []).map(csvCell).join(',')).join('\r\n') + ((rows || []).length ? '\r\n' : '');
}

function worksheetMatrix(sheet, XLSX) {
  const ref = sheet?.['!ref'];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const rows = [];
  for (let r = range.s.r; r <= range.e.r; r += 1) {
    const row = [];
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      row.push(cellText(sheet[XLSX.utils.encode_cell({ r, c })]));
    }
    rows.push(row);
  }
  return rows;
}

function cellText(cell) {
  if (!cell) return '';
  if (cell.f != null && String(cell.f).trim()) return `=${cell.f}`;
  if (cell.v == null) return '';
  return String(cell.v);
}

function normalizeHeader(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
}

function isCivilSecondarySupportHeader(value) {
  if (value.includes('CIVIL SECONDARY SUPPORT')) return true;
  return value.replace(/[^A-Z0-9]/g, '').includes('CIVILSECONDARYSUPPORT');
}

function lastNonBlankIndex(row) {
  for (let index = row.length - 1; index >= 0; index -= 1) {
    if (String(row[index] ?? '').trim()) return index;
  }
  return -1;
}

function rowIsBlank(row) {
  return (row || []).every((value) => !String(value ?? '').trim());
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

async function loadXlsx(importModule = (url) => import(url)) {
  const module = await importModule(XLSX_MODULE_URL);
  return module?.default || module;
}

function assertXlsxReader(XLSX) {
  if (!XLSX?.read || !XLSX?.utils?.decode_range || !XLSX?.utils?.encode_cell) {
    throw new Error('SheetJS XLSX reader is unavailable.');
  }
}

export const _test = Object.freeze({
  XLSX_MODULE_URL,
  XLSX_MIME,
  HEADER_SCAN_LIMIT,
  worksheetMatrix,
  cellText,
  normalizeHeader,
  isCivilSecondarySupportHeader,
  csvCell,
  loadXlsx,
});
