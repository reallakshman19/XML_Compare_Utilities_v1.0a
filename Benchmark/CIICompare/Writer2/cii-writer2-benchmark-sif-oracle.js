const SECTION_RX = /^#\$\s+([A-Z0-9_&]+)\s*$/;
const I13_RX = /^[+-]?\d+$/;
const ELEMENT_ROWS = 15;
const SIF_ROWS = 10;

function asBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (typeof value === 'string') return new TextEncoder().encode(value);
  throw new Error('BM_W2_SIF_ORACLE_BYTES_REQUIRED');
}

function decodeCrlf(value) {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(asBytes(value));
  if (!text.endsWith('\r\n')) throw new Error('BM_W2_SIF_ORACLE_FINAL_CRLF_REQUIRED');
  const body = text.slice(0, -2);
  if (/(^|[^\r])\n|\r(?!\n)/.test(body)) throw new Error('BM_W2_SIF_ORACLE_CRLF_ONLY_REQUIRED');
  return Object.freeze({ text, lines: body ? body.split('\r\n') : [] });
}

function sectionRanges(lines) {
  const ranges = new Map();
  let current = null;
  for (let index = 0; index < lines.length; index += 1) {
    const match = SECTION_RX.exec(lines[index]);
    if (!match) continue;
    if (current) current.end = index;
    current = { name: match[1], header: index, start: index + 1, end: lines.length };
    if (ranges.has(current.name)) throw new Error(`BM_W2_SIF_ORACLE_DUPLICATE_SECTION:${current.name}`);
    ranges.set(current.name, current);
  }
  return ranges;
}

function requireSection(ranges, name) {
  const range = ranges.get(name);
  if (!range) throw new Error(`BM_W2_SIF_ORACLE_SECTION_REQUIRED:${name}`);
  return range;
}

function fixedFields(line) {
  if (line.length < 15 || (line.length - 15) % 13 !== 0) {
    throw new Error(`BM_W2_SIF_ORACLE_FIXED_ROW_REQUIRED:${line.length}`);
  }
  const fields = [line.slice(0, 15)];
  for (let start = 15; start < line.length; start += 13) fields.push(line.slice(start, start + 13));
  return fields;
}

function numericValue(line, fieldIndex, identity) {
  const fields = fixedFields(line);
  if (fieldIndex >= fields.length) throw new Error(`BM_W2_SIF_ORACLE_FIELD_REQUIRED:${identity}:${fieldIndex}`);
  const token = fields[fieldIndex].trim().replace(/[Dd]/g, 'E');
  const value = Number(token);
  if (!Number.isFinite(value)) throw new Error(`BM_W2_SIF_ORACLE_NUMERIC_REQUIRED:${identity}:${token}`);
  return value;
}

function i13Value(line, fieldIndex, identity) {
  const fields = fixedFields(line);
  if (fieldIndex >= fields.length) throw new Error(`BM_W2_SIF_ORACLE_FIELD_REQUIRED:${identity}:${fieldIndex}`);
  const token = fields[fieldIndex].trim();
  if (!I13_RX.test(token)) throw new Error(`BM_W2_SIF_ORACLE_I13_REQUIRED:${identity}:${token}`);
  const value = Number(token);
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`BM_W2_SIF_ORACLE_SAFE_I13_REQUIRED:${identity}:${token}`);
  return value;
}

function replaceI13(line, fieldIndex, value, identity) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`BM_W2_SIF_ORACLE_NONNEGATIVE_I13_REQUIRED:${identity}:${value}`);
  const fields = fixedFields(line);
  if (fieldIndex >= fields.length) throw new Error(`BM_W2_SIF_ORACLE_FIELD_REQUIRED:${identity}:${fieldIndex}`);
  const width = fieldIndex === 0 ? 15 : 13;
  const token = String(value).padStart(width, ' ');
  if (token.length !== width) throw new Error(`BM_W2_SIF_ORACLE_I13_WIDTH_OVERFLOW:${identity}:${value}`);
  const start = fieldIndex === 0 ? 0 : 15 + (fieldIndex - 1) * 13;
  const next = `${line.slice(0, start)}${token}${line.slice(start + width)}`;
  if (!I13_RX.test(fixedFields(next)[fieldIndex].trim())) throw new Error(`BM_W2_SIF_ORACLE_I13_RENDER_FAILED:${identity}`);
  return next;
}

function elementDescriptor(rows, blockIndex) {
  const start = blockIndex * ELEMENT_ROWS;
  return Object.freeze({
    blockIndex,
    from: numericValue(rows[start], 0, `ELEMENT_${blockIndex}_FROM`),
    to: numericValue(rows[start], 1, `ELEMENT_${blockIndex}_TO`),
    sifPointer: i13Value(rows[start + 13], 4, `ELEMENT_${blockIndex}_SIF_POINTER`),
    pointerRowIndex: start + 13,
  });
}

function sameNode(value, expected) {
  return String(Math.round(Number(value))) === String(expected);
}

export function buildBmW202ExpectedPostimage(sourceBytes, benchmarkCase) {
  if (!benchmarkCase || benchmarkCase.id !== 'BM-W2-02') throw new Error('BM_W2_02_CASE_REQUIRED');
  const candidate = benchmarkCase.candidate || {};
  const expected = benchmarkCase.expected || {};
  const decoded = decodeCrlf(sourceBytes);
  const lines = [...decoded.lines];
  const ranges = sectionRanges(lines);
  const control = requireSection(ranges, 'CONTROL');
  const elements = requireSection(ranges, 'ELEMENTS');
  const sif = requireSection(ranges, 'SIF&TEES');

  const controlRows = lines.slice(control.start, control.end);
  if (controlRows.length < 3) throw new Error(`BM_W2_02_CONTROL_ROWS_REQUIRED:${controlRows.length}`);
  const sifCountBefore = i13Value(controlRows[2], 4, 'CONTROL_SIF_TEE_BLOCK_COUNT');
  if (sifCountBefore !== expected.blockCountBefore) {
    throw new Error(`BM_W2_02_CONTROL_SIF_COUNT_DRIFT:${sifCountBefore}:${expected.blockCountBefore}`);
  }

  const elementRows = lines.slice(elements.start, elements.end);
  const elementCount = elementRows.length / ELEMENT_ROWS;
  if (!Number.isSafeInteger(elementCount) || elementCount <= 0) {
    throw new Error(`BM_W2_02_ELEMENT_ROW_ALIGNMENT:${elementRows.length}:${ELEMENT_ROWS}`);
  }
  const descriptors = Array.from({ length: elementCount }, (_, index) => elementDescriptor(elementRows, index));
  const owners = descriptors.filter((item) => item.sifPointer === candidate.pointer);
  if (owners.length !== candidate.expectedOwnerCount) {
    throw new Error(`BM_W2_02_OWNER_COUNT_DRIFT:${owners.length}:${candidate.expectedOwnerCount}`);
  }
  const owner = owners[0];
  if (!owner || !sameNode(owner.from, candidate.ownerFrom) || !sameNode(owner.to, candidate.ownerTo)) {
    throw new Error(`BM_W2_02_OWNER_IDENTITY_DRIFT:${owner?.from ?? 'NONE'}:${owner?.to ?? 'NONE'}:${candidate.ownerFrom}:${candidate.ownerTo}`);
  }

  const sifRows = lines.slice(sif.start, sif.end);
  if (sifRows.length !== expected.rowsBefore || sifRows.length % SIF_ROWS !== 0) {
    throw new Error(`BM_W2_02_SIF_ROW_COUNT_DRIFT:${sifRows.length}:${expected.rowsBefore}`);
  }
  const blockStart = (candidate.pointer - 1) * SIF_ROWS;
  const block = sifRows.slice(blockStart, blockStart + SIF_ROWS);
  if (block.length !== SIF_ROWS) throw new Error(`BM_W2_02_SIF_BLOCK_REQUIRED:${candidate.pointer}`);
  const recordNode = numericValue(block[0], 0, 'BM_W2_02_RECORD_NODE');
  const rawCode = numericValue(block[0], 1, 'BM_W2_02_RAW_CODE');
  if (!sameNode(recordNode, candidate.recordNode)) {
    throw new Error(`BM_W2_02_RECORD_NODE_DRIFT:${recordNode}:${candidate.recordNode}`);
  }
  if (Number(rawCode) !== Number(candidate.sourceRawCode)) {
    throw new Error(`BM_W2_02_RAW_CODE_DRIFT:${rawCode}:${candidate.sourceRawCode}`);
  }

  const pointerChanges = [];
  for (const descriptor of descriptors) {
    const before = descriptor.sifPointer;
    const after = before === candidate.pointer ? 0 : before > candidate.pointer ? before - 1 : before;
    if (after === before) continue;
    const absoluteRow = elements.start + descriptor.pointerRowIndex;
    lines[absoluteRow] = replaceI13(lines[absoluteRow], 4, after, `ELEMENT_${descriptor.blockIndex}_SIF_POINTER`);
    pointerChanges.push(Object.freeze({
      blockIndex: descriptor.blockIndex,
      from: String(Math.round(descriptor.from)),
      to: String(Math.round(descriptor.to)),
      before,
      after,
    }));
  }
  if (!pointerChanges.some((item) => item.before === candidate.pointer && item.after === expected.deletedPointerAfter)) {
    throw new Error(`BM_W2_02_DELETED_POINTER_CHANGE_REQUIRED:${candidate.pointer}:${expected.deletedPointerAfter}`);
  }

  lines[control.start + 2] = replaceI13(lines[control.start + 2], 4, expected.blockCountAfter, 'CONTROL_SIF_TEE_BLOCK_COUNT');

  const afterPointerRanges = sectionRanges(lines);
  const sifAfterPointerEdits = requireSection(afterPointerRanges, 'SIF&TEES');
  lines.splice(sifAfterPointerEdits.start + blockStart, SIF_ROWS);

  const finalRanges = sectionRanges(lines);
  const finalControl = requireSection(finalRanges, 'CONTROL');
  const finalSif = requireSection(finalRanges, 'SIF&TEES');
  const finalControlRows = lines.slice(finalControl.start, finalControl.end);
  const finalSifRows = lines.slice(finalSif.start, finalSif.end);
  if (i13Value(finalControlRows[2], 4, 'CONTROL_SIF_TEE_BLOCK_COUNT_AFTER') !== expected.blockCountAfter) {
    throw new Error('BM_W2_02_CONTROL_SIF_COUNT_NOT_UPDATED');
  }
  if (finalSifRows.length !== expected.rowsAfter) {
    throw new Error(`BM_W2_02_POST_SIF_ROW_COUNT:${finalSifRows.length}:${expected.rowsAfter}`);
  }

  const outputText = `${lines.join('\r\n')}\r\n`;
  return Object.freeze({
    schema: 'CIIWriter2BenchmarkOracle.BM-W2-02.v1',
    bytes: new TextEncoder().encode(outputText),
    byteString: outputText,
    custody: Object.freeze({
      pointer: candidate.pointer,
      ownerFrom: String(candidate.ownerFrom),
      ownerTo: String(candidate.ownerTo),
      recordNode: String(candidate.recordNode),
      rawCode: Number(candidate.sourceRawCode),
      ownerCount: owners.length,
    }),
    pointerChanges: Object.freeze(pointerChanges),
    counts: Object.freeze({
      sifBefore: sifCountBefore,
      sifAfter: expected.blockCountAfter,
      sifRowsBefore: sifRows.length,
      sifRowsAfter: finalSifRows.length,
    }),
  });
}

export const _test = Object.freeze({ decodeCrlf, sectionRanges, fixedFields, numericValue, i13Value, replaceI13, elementDescriptor });
