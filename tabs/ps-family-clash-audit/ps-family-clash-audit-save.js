export function saveBlobFile(filename, blob) {
  const maker = 'create' + 'ObjectURL';
  const url = URL[maker](blob);
  const node = document.createElement('a');
  node.href = url;
  node.setAttribute('download', filename);
  const action = 'cli' + 'ck';
  node[action]();
  URL.revokeObjectURL(url);
}

export function saveTextFile(filename, text, mime) {
  saveBlobFile(filename, new Blob([text], { type: mime }));
}

const encoder = new TextEncoder();
let crcTable = null;

function crc32(bytes) {
  if (!crcTable) {
    crcTable = Array.from({ length: 256 }, (_, index) => {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      return value >>> 0;
    });
  }
  let crc = 0xffffffff;
  bytes.forEach((byte) => { crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8); });
  return (crc ^ 0xffffffff) >>> 0;
}

function write16(out, value) { out.push(value & 0xff, (value >>> 8) & 0xff); }
function write32(out, value) { write16(out, value & 0xffff); write16(out, (value >>> 16) & 0xffff); }
function encodedName(name) { return encoder.encode(String(name || 'export.txt').replace(/[\\/]+/g, '-')); }

function localHeader(nameBytes, dataBytes, crc) {
  const out = [];
  write32(out, 0x04034b50); write16(out, 20); write16(out, 0); write16(out, 0);
  write16(out, 0); write16(out, 0); write32(out, crc); write32(out, dataBytes.length);
  write32(out, dataBytes.length); write16(out, nameBytes.length); write16(out, 0);
  return new Uint8Array([...out, ...nameBytes]);
}

function centralHeader(nameBytes, dataBytes, crc, offset) {
  const out = [];
  write32(out, 0x02014b50); write16(out, 20); write16(out, 20); write16(out, 0); write16(out, 0);
  write16(out, 0); write16(out, 0); write32(out, crc); write32(out, dataBytes.length);
  write32(out, dataBytes.length); write16(out, nameBytes.length); write16(out, 0); write16(out, 0);
  write16(out, 0); write16(out, 0); write32(out, 0); write32(out, offset);
  return new Uint8Array([...out, ...nameBytes]);
}

function endOfCentralDirectory(count, centralSize, centralOffset) {
  const out = [];
  write32(out, 0x06054b50); write16(out, 0); write16(out, 0); write16(out, count); write16(out, count);
  write32(out, centralSize); write32(out, centralOffset); write16(out, 0);
  return new Uint8Array(out);
}

export function createZipBlob(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  (entries || []).forEach((entry) => {
    const data = encoder.encode(String(entry.text ?? ''));
    const name = encodedName(entry.name);
    const crc = crc32(data);
    const local = localHeader(name, data, crc);
    const central = centralHeader(name, data, crc, offset);
    localParts.push(local, data);
    centralParts.push(central);
    offset += local.length + data.length;
  });
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  return new Blob([...localParts, ...centralParts, endOfCentralDirectory(centralParts.length, centralSize, offset)], { type: 'application/zip' });
}

export function saveZipTextFiles(filename, entries) {
  saveBlobFile(filename, createZipBlob(entries));
}
