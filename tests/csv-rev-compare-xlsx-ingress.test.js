import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractSupportReportTable,
  isXlsxFile,
  matrixToCsv,
  readSupportRevisionFile,
} from '../tabs/csv-rev-compare/support-revision-xlsx-ingress.js';

function cellRef({ r, c }) {
  let value = c + 1;
  let letters = '';
  while (value > 0) {
    value -= 1;
    letters = String.fromCharCode(65 + (value % 26)) + letters;
    value = Math.floor(value / 26);
  }
  return `${letters}${r + 1}`;
}

function decodeRef(ref) {
  const [start, end] = ref.split(':');
  const decode = (token) => {
    const match = /^([A-Z]+)(\d+)$/.exec(token);
    let column = 0;
    for (const char of match[1]) column = column * 26 + char.charCodeAt(0) - 64;
    return { r: Number(match[2]) - 1, c: column - 1 };
  };
  return { s: decode(start), e: decode(end || start) };
}

function fakeXlsx(workbook) {
  const calls = [];
  return {
    calls,
    read(bytes, options) {
      calls.push({ bytes: [...bytes], options });
      return workbook;
    },
    utils: {
      decode_range: decodeRef,
      encode_cell: cellRef,
    },
  };
}

function sheet(rows) {
  const width = Math.max(...rows.map((row) => row.length));
  const out = { '!ref': `A1:${cellRef({ r: rows.length - 1, c: width - 1 })}` };
  rows.forEach((row, r) => row.forEach((value, c) => {
    if (value == null) return;
    out[cellRef({ r, c })] = typeof value === 'object' ? value : { v: value };
  }));
  return out;
}

function supportWorkbook() {
  return {
    SheetNames: ['Read Me', 'Load Data-Rev 2'],
    Sheets: {
      'Read Me': sheet([['notes'], ['not a support table']]),
      'Load Data-Rev 2': sheet([
        ['generated report'],
        [
          'CIVIL SECONDARY SUPPORT (Tag provided by Civil)',
          'PIPE',
          'PIPING PRIMARY SUPPORT',
          'SUPPORT TYPE',
          'PIPING PRIMARY SUPPORT REFERENCE',
        ],
        ['SL-1', 'LINE-1', '/SL-1.1', 'REST-100', { f: '1006649755/3641', v: 275931.36 }],
        ['SL-2', 'LINE-2', '/SL-2.1', 'SHOE-100', '=literal'],
        ['', '', '', '', ''],
      ]),
    },
  };
}

test('xlsx detection is extension or MIME based and text files remain text inputs', () => {
  assert.equal(isXlsxFile({ name: 'R2.xlsx', type: '' }), true);
  assert.equal(isXlsxFile({ name: 'revision.bin', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), true);
  assert.equal(isXlsxFile({ name: 'revision.csv', type: 'text/csv' }), false);
});

test('extracts the Support Report sheet by PIPE + civil-support header and preserves formulas', () => {
  const workbook = supportWorkbook();
  const XLSX = fakeXlsx(workbook);
  const result = extractSupportReportTable(workbook, XLSX);
  assert.equal(result.sheetName, 'Load Data-Rev 2');
  assert.equal(result.rows.length, 3);
  assert.equal(result.rows[0].length, 5);
  assert.equal(result.rows[1][4], '=1006649755/3641');
  assert.equal(result.rows[2][4], '=literal');
});

test('xlsx file loading uses arrayBuffer, never file.text, and produces governed CSV table text', async () => {
  const workbook = supportWorkbook();
  const XLSX = fakeXlsx(workbook);
  let textCalled = false;
  const loaded = await readSupportRevisionFile({
    name: 'R2.xlsx',
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    async arrayBuffer() { return Uint8Array.from([80, 75, 3, 4]).buffer; },
    async text() { textCalled = true; throw new Error('must not read XLSX as text'); },
  }, { XLSX });

  assert.equal(textCalled, false);
  assert.equal(XLSX.calls.length, 1);
  assert.equal(XLSX.calls[0].options.type, 'array');
  assert.equal(loaded.format, 'xlsx');
  assert.equal(loaded.sheetName, 'Load Data-Rev 2');
  assert.equal(loaded.rowCount, 2);
  assert.equal(loaded.columnCount, 5);
  assert.match(loaded.text, /^CIVIL SECONDARY SUPPORT/);
  assert.match(loaded.text, /=1006649755\/3641/);
  assert.doesNotMatch(loaded.text, /^PK/);
});

test('csv/tsv/txt loading retains the existing text path', async () => {
  let arrayBufferCalled = false;
  const loaded = await readSupportRevisionFile({
    name: 'revision.csv',
    type: 'text/csv',
    async text() { return 'PIPE,CIVIL SECONDARY SUPPORT\r\nP1,SL-1\r\n'; },
    async arrayBuffer() { arrayBufferCalled = true; return new ArrayBuffer(0); },
  });
  assert.equal(arrayBufferCalled, false);
  assert.equal(loaded.format, 'text');
  assert.match(loaded.text, /^PIPE,CIVIL/);
});

test('missing Support Report header fails explicitly instead of passing workbook bytes downstream', async () => {
  const workbook = { SheetNames: ['Sheet1'], Sheets: { Sheet1: sheet([['A', 'B'], ['1', '2']]) } };
  const XLSX = fakeXlsx(workbook);
  await assert.rejects(
    readSupportRevisionFile({
      name: 'bad.xlsx',
      async arrayBuffer() { return new ArrayBuffer(4); },
    }, { XLSX }),
    /No Support Report header row found in XLSX/,
  );
});

test('CSV serialization preserves commas, quotes and newlines', () => {
  assert.equal(matrixToCsv([['A', 'B'], ['x,y', 'a"b'], ['multi\nline', 'z']]), 'A,B\r\n"x,y","a""b"\r\n"multi\nline",z\r\n');
});
