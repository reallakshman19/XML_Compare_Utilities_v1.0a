const UTF8_FATAL = new TextDecoder('utf-8', { fatal: true });
const UTF8 = new TextDecoder('utf-8');
const BYTE_CHUNK = 0x8000;

function copyBytes(input) {
  if (input instanceof Uint8Array) return new Uint8Array(input);
  if (input instanceof ArrayBuffer) return new Uint8Array(input.slice(0));
  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength));
  }
  return null;
}

function binaryStringFromBytes(bytes) {
  let out = '';
  for (let offset = 0; offset < bytes.length; offset += BYTE_CHUNK) {
    out += String.fromCharCode(...bytes.subarray(offset, Math.min(bytes.length, offset + BYTE_CHUNK)));
  }
  return out;
}

function bytesFromBinaryString(value) {
  const text = String(value ?? '');
  const out = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) out[index] = text.charCodeAt(index) & 0xff;
  return out;
}

function decodeUtf8(bytes) { return UTF8.decode(bytes); }
function decodedText(bytes) {
  try { return Object.freeze({ text: UTF8_FATAL.decode(bytes), authority: 'UTF8_STRICT' }); }
  catch { return Object.freeze({ text: UTF8.decode(bytes), authority: 'UTF8_REPLACEMENT_COMPATIBILITY' }); }
}

function scanLines(bytes) {
  const rows = [];
  let start = 0; let lineNumber = 1;
  for (let index = 0; index < bytes.length;) {
    const value = bytes[index];
    if (value !== 0x0d && value !== 0x0a) { index += 1; continue; }
    const bodyEnd = index; let lineEnding = value === 0x0d ? 'CR' : 'LF'; let end = index + 1;
    if (value === 0x0d && bytes[index + 1] === 0x0a) { lineEnding = 'CRLF'; end = index + 2; }
    rows.push(Object.freeze({
      lineNumber, byteStart: start, bodyByteEnd: bodyEnd, byteEnd: end, lineEnding,
      text: decodeUtf8(bytes.subarray(start, bodyEnd)),
    }));
    lineNumber += 1; start = end; index = end;
  }
  if (start < bytes.length || bytes.length === 0) {
    rows.push(Object.freeze({
      lineNumber, byteStart: start, bodyByteEnd: bytes.length, byteEnd: bytes.length, lineEnding: 'NONE',
      text: decodeUtf8(bytes.subarray(start)),
    }));
  }
  return Object.freeze(rows);
}

function lineEndingSummary(lines) {
  const sequence = lines.map((line) => line.lineEnding).filter((value) => value !== 'NONE');
  const kinds = [...new Set(sequence)];
  return Object.freeze({
    style: kinds.length === 0 ? 'NONE' : kinds.length === 1 ? kinds[0] : 'MIXED',
    sequence: Object.freeze(sequence),
    finalLineTerminated: lines.length ? lines[lines.length - 1].lineEnding !== 'NONE' : false,
  });
}

export function createCiiPhysicalFile(input) {
  const supplied = copyBytes(input);
  const originalBytes = supplied || new TextEncoder().encode(String(input ?? ''));
  const byteAuthority = supplied ? 'ORIGINAL_BYTES' : 'REENCODED_TEXT_COMPATIBILITY';
  const decoded = supplied ? decodedText(originalBytes) : Object.freeze({ text: String(input ?? ''), authority: 'CALLER_TEXT' });
  const lines = scanLines(originalBytes);
  return Object.freeze({
    schema: 'CIIWorkspacePhysicalFile.v1',
    byteAuthority,
    writer1CByteEligible: byteAuthority === 'ORIGINAL_BYTES',
    textEncodingAuthority: decoded.authority,
    byteLength: originalBytes.length,
    originalByteString: binaryStringFromBytes(originalBytes),
    text: decoded.text,
    lines,
    lineEndings: lineEndingSummary(lines),
  });
}

export function ciiPhysicalFileBytes(physicalFile) {
  return bytesFromBinaryString(physicalFile?.originalByteString);
}

export function ciiPhysicalByteString(physicalFile, start, end) {
  const bytes = String(physicalFile?.originalByteString ?? '');
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || end > bytes.length) {
    throw new Error('CII_PHYSICAL_BYTE_SPAN_INVALID');
  }
  return bytes.slice(start, end);
}

export function decodeCiiAsciiByteString(value) {
  const bytes = String(value ?? '');
  for (let index = 0; index < bytes.length; index += 1) {
    if (bytes.charCodeAt(index) > 0x7f) throw new Error('CII_WORKSPACE_FIXED_FIELD_NON_ASCII');
  }
  return bytes;
}

function markerName(text) {
  const match = String(text ?? '').match(/^\s*#\$\s*(.*?)\s*$/);
  return match ? match[1].toUpperCase() : null;
}

export function ciiPhysicalSectionRows(physicalFile, names, options = {}) {
  const wanted = new Set((Array.isArray(names) ? names : [names]).map((name) => String(name).trim().toUpperCase()));
  const lines = physicalFile?.lines || [];
  const markerIndex = lines.findIndex((line) => wanted.has(markerName(line.text)));
  if (markerIndex < 0) return Object.freeze([]);
  const rows = [];
  for (let index = markerIndex + 1; index < lines.length; index += 1) {
    if (markerName(lines[index].text) !== null) break;
    if (options.includeBlank !== true && !String(lines[index].text).trim()) continue;
    rows.push(lines[index]);
  }
  return Object.freeze(rows);
}
