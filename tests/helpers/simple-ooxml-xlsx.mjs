export function createOoxmlXlsxAdapter() {
  return {
    utils: {
      aoa_to_sheet(matrix) { return { __matrix: matrix.map((row) => [...row]) }; },
      book_new() { return { SheetNames: [], Sheets: {} }; },
      book_append_sheet(workbook, worksheet, name) {
        workbook.SheetNames.push(name);
        workbook.Sheets[name] = worksheet;
      },
    },
    write(workbook, options = {}) {
      if (options.bookType !== 'xlsx' || options.type !== 'array') {
        throw new Error('Test OOXML adapter supports XLSX array output only.');
      }
      return buildWorkbookBytes(workbook);
    },
  };
}

export function readSimpleXlsx(bytes) {
  const entries = unzipStored(bytes);
  const workbookXml = text(entries.get('xl/workbook.xml'));
  const sheetXml = text(entries.get('xl/worksheets/sheet1.xml'));
  const sheetName = decodeXml(workbookXml.match(/<sheet\b[^>]*name="([^"]*)"/u)?.[1] || '');
  const ref = sheetXml.match(/<dimension\s+ref="([^"]+)"/u)?.[1] || '';
  const autoFilter = sheetXml.match(/<autoFilter\s+ref="([^"]+)"/u)?.[1] || '';
  const cells = [...sheetXml.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/gu)];
  let maxRow = 0;
  let maxCol = 0;
  const values = new Map();
  for (const [, attrs, body] of cells) {
    const address = attrs.match(/\br="([A-Z]+\d+)"/u)?.[1];
    if (!address) continue;
    const { row, col } = parseCellAddress(address);
    maxRow = Math.max(maxRow, row);
    maxCol = Math.max(maxCol, col);
    const type = attrs.match(/\bt="([^"]+)"/u)?.[1] || '';
    const inline = body.match(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/u)?.[1];
    const numeric = body.match(/<v>([\s\S]*?)<\/v>/u)?.[1];
    const value = type === 'inlineStr'
      ? decodeXml(inline || '')
      : numeric == null ? '' : Number(numeric);
    values.set(`${row}:${col}`, value);
  }
  const matrix = Array.from({ length: maxRow }, (_, row) => (
    Array.from({ length: maxCol }, (_, col) => values.get(`${row + 1}:${col + 1}`) ?? '')
  ));
  return Object.freeze({
    sheetName,
    ref,
    autoFilter,
    matrix,
    formulaCount: (sheetXml.match(/<f(?:\s|>)/gu) || []).length,
    entries: Object.freeze([...entries.keys()].sort()),
  });
}

function buildWorkbookBytes(workbook) {
  const sheetName = workbook.SheetNames?.[0] || 'Support Report';
  const worksheet = workbook.Sheets?.[sheetName];
  if (!worksheet?.__matrix) throw new Error('Workbook has no test worksheet matrix.');
  const files = new Map([
    ['[Content_Types].xml', contentTypesXml()],
    ['_rels/.rels', rootRelsXml()],
    ['xl/workbook.xml', workbookXml(sheetName)],
    ['xl/_rels/workbook.xml.rels', workbookRelsXml()],
    ['xl/worksheets/sheet1.xml', worksheetXml(worksheet)],
  ]);
  return zipStored(files);
}

function worksheetXml(worksheet) {
  const matrix = worksheet.__matrix || [];
  const rowCount = matrix.length;
  const colCount = Math.max(0, ...matrix.map((row) => row.length));
  const rows = matrix.map((row, rowIndex) => {
    const cells = row.map((value, colIndex) => cellXml(value, rowIndex + 1, colIndex + 1)).join('');
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join('');
  const dimension = rowCount && colCount ? `A1:${columnName(colCount)}${rowCount}` : 'A1';
  const filter = worksheet['!autofilter']?.ref
    ? `<autoFilter ref="${escapeXml(worksheet['!autofilter'].ref)}"/>` : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
    + `<dimension ref="${dimension}"/><sheetData>${rows}</sheetData>${filter}</worksheet>`;
}

function cellXml(value, row, col) {
  const address = `${columnName(col)}${row}`;
  if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${address}"><v>${value}</v></c>`;
  const safe = escapeXml(value == null ? '' : String(value));
  return `<c r="${address}" t="inlineStr"><is><t xml:space="preserve">${safe}</t></is></c>`;
}

function contentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>`
    + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
    + `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`
    + `<Default Extension="xml" ContentType="application/xml"/>`
    + `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>`
    + `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    + `</Types>`;
}
function rootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>`
    + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
    + `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>`
    + `</Relationships>`;
}
function workbookXml(sheetName) {
  return `<?xml version="1.0" encoding="UTF-8"?>`
    + `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`
    + `<sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
}
function workbookRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>`
    + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
    + `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>`
    + `</Relationships>`;
}

function crc32Bytes(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStored(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const [name, value] of files) {
    const nameBytes = Buffer.from(name, 'utf8');
    const data = Buffer.from(value, 'utf8');
    const checksum = crc32Bytes(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    localParts.push(local, nameBytes, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.size, 8);
  eocd.writeUInt16LE(files.size, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...localParts, centralDirectory, eocd]));
}

function unzipStored(bytes) {
  const data = Buffer.from(bytes);
  const eocdOffset = data.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocdOffset < 0) throw new Error('XLSX ZIP end-of-central-directory not found.');
  const entryCount = data.readUInt16LE(eocdOffset + 10);
  let cursor = data.readUInt32LE(eocdOffset + 16);
  const entries = new Map();
  for (let index = 0; index < entryCount; index += 1) {
    if (data.readUInt32LE(cursor) !== 0x02014b50) throw new Error('Invalid XLSX central directory entry.');
    const method = data.readUInt16LE(cursor + 10);
    const compressedSize = data.readUInt32LE(cursor + 20);
    const nameLength = data.readUInt16LE(cursor + 28);
    const extraLength = data.readUInt16LE(cursor + 30);
    const commentLength = data.readUInt16LE(cursor + 32);
    const localOffset = data.readUInt32LE(cursor + 42);
    const name = data.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    if (method !== 0) throw new Error(`Unsupported XLSX ZIP compression method ${method}.`);
    const localNameLength = data.readUInt16LE(localOffset + 26);
    const localExtraLength = data.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    entries.set(name, data.subarray(start, start + compressedSize));
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function parseCellAddress(address) {
  const match = String(address).match(/^([A-Z]+)(\d+)$/u);
  if (!match) throw new Error(`Invalid cell address: ${address}`);
  let col = 0;
  for (const char of match[1]) col = col * 26 + char.charCodeAt(0) - 64;
  return { row: Number(match[2]), col };
}
function columnName(index) {
  let value = index;
  let name = '';
  while (value > 0) {
    value -= 1;
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26);
  }
  return name;
}
function escapeXml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
function decodeXml(value) {
  return String(value).replace(/&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
}
function text(value) {
  if (!value) throw new Error('Required XLSX package entry is missing.');
  return Buffer.from(value).toString('utf8');
}
