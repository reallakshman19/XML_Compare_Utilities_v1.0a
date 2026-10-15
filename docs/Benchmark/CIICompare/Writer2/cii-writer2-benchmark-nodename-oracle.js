const SECTION_RX = /^#\$\s+([A-Z0-9_&]+)\s*$/;
const I13_RX = /^[+-]?\d+$/;
const FIELD_WIDTHS = Object.freeze([15, 13, 13, 13, 13, 13]);
const ELEMENT_ROWS = 15;
const NODENAME_POINTER_ROW = 13;
const NODENAME_POINTER_FIELD = 5;
const CONTROL_NONAM_ROW = 0;
const CONTROL_NONAM_FIELD = 3;
const FROM_START = 2;
const FROM_END = 28;
const TO_START = 28;
const TO_END = 53;

function asBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (typeof value === 'string') return new TextEncoder().encode(value);
  throw new Error('BM_W2_01_ORACLE_BYTES_REQUIRED');
}

function decodeCrlf(value) {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(asBytes(value));
  if (!text.endsWith('\r\n')) throw new Error('BM_W2_01_ORACLE_FINAL_CRLF_REQUIRED');
  const body = text.slice(0, -2);
  if (/(^|[^\r])\n|\r(?!\n)/.test(body)) throw new Error('BM_W2_01_ORACLE_CRLF_ONLY_REQUIRED');
  return body ? body.split('\r\n') : [];
}

function sectionEnvelope(lines, name) {
  const markerIndex = lines.findIndex((line) => SECTION_RX.exec(line)?.[1] === name);
  if (markerIndex < 0) throw new Error(`BM_W2_01_ORACLE_SECTION_REQUIRED:${name}`);
  let nextMarkerIndex = markerIndex + 1;
  while (nextMarkerIndex < lines.length && !SECTION_RX.test(lines[nextMarkerIndex])) nextMarkerIndex += 1;
  if (nextMarkerIndex >= lines.length) throw new Error(`BM_W2_01_ORACLE_NEXT_SECTION_REQUIRED:${name}`);
  return Object.freeze({ markerIndex, nextMarkerIndex, rows: lines.slice(markerIndex + 1, nextMarkerIndex) });
}

function fieldSpan(fieldIndex) {
  const start = FIELD_WIDTHS.slice(0, fieldIndex).reduce((sum, width) => sum + width, 0);
  return Object.freeze({ start, end: start + FIELD_WIDTHS[fieldIndex], width: FIELD_WIDTHS[fieldIndex] });
}

function numericField(line, fieldIndex, label) {
  const span = fieldSpan(fieldIndex);
  if (String(line ?? '').length < span.end) throw new Error(`BM_W2_01_ORACLE_FIELD_WIDTH_REQUIRED:${label}`);
  const raw = line.slice(span.start, span.end);
  const token = raw.trim();
  if (!token) throw new Error(`BM_W2_01_ORACLE_NUMERIC_FIELD_REQUIRED:${label}`);
  const value = Number(token.replace(/[Dd]/g, 'E'));
  if (!Number.isFinite(value)) throw new Error(`BM_W2_01_ORACLE_NUMERIC_FIELD_INVALID:${label}:${token}`);
  return Object.freeze({ raw, token, value, span });
}

function integerI13(line, fieldIndex, label) {
  const field = numericField(line, fieldIndex, label);
  if (!I13_RX.test(field.token)) throw new Error(`BM_W2_01_ORACLE_LEXICAL_I13_REQUIRED:${label}:${field.token}`);
  if (!Number.isSafeInteger(field.value) || field.value < 0) throw new Error(`BM_W2_01_ORACLE_NONNEGATIVE_I13_REQUIRED:${label}:${field.token}`);
  return field;
}

function replaceI13(line, fieldIndex, value, label) {
  const span = fieldSpan(fieldIndex);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error(`BM_W2_01_ORACLE_I13_VALUE_REQUIRED:${label}:${value}`);
  const token = String(number);
  if (token.length > span.width) throw new Error(`BM_W2_01_ORACLE_I13_OVERFLOW:${label}:${token.length}`);
  return `${line.slice(0, span.start)}${token.padStart(span.width, ' ')}${line.slice(span.end)}`;
}

function nodeNameRow(fromName = '', toName = '') {
  const from = String(fromName);
  const to = String(toName);
  if ([...from, ...to].some((char) => char.codePointAt(0) > 0x7f)) throw new Error('BM_W2_01_ORACLE_NODENAME_ASCII_REQUIRED');
  if (from.length > FROM_END - FROM_START) throw new Error('BM_W2_01_ORACLE_FROM_NAME_WIDTH');
  if (to.length > TO_END - TO_START) throw new Error('BM_W2_01_ORACLE_TO_NAME_WIDTH');
  const row = `  ${from.padEnd(FROM_END - FROM_START, ' ')}${to.padEnd(TO_END - TO_START, ' ')}`;
  if (row.length !== TO_END) throw new Error(`BM_W2_01_ORACLE_NODENAME_ROW_WIDTH:${row.length}`);
  return row;
}

function parsedNodeNameRow(row, pointer) {
  if (String(row ?? '').length !== TO_END) throw new Error(`BM_W2_01_ORACLE_NODENAME_ROW_WIDTH_REQUIRED:${pointer}`);
  return Object.freeze({
    pointer,
    fromName: row.slice(FROM_START, FROM_END).trim(),
    toName: row.slice(TO_START, TO_END).trim(),
  });
}

function elementFacts(lines) {
  const envelope = sectionEnvelope(lines, 'ELEMENTS');
  if (envelope.rows.length % ELEMENT_ROWS !== 0) throw new Error(`BM_W2_01_ORACLE_ELEMENT_ROWS:${envelope.rows.length}`);
  const blocks = [];
  for (let offset = 0; offset < envelope.rows.length; offset += ELEMENT_ROWS) {
    const blockIndex = offset / ELEMENT_ROWS;
    const header = envelope.rows[offset];
    const pointerRow = envelope.rows[offset + NODENAME_POINTER_ROW];
    const from = numericField(header, 0, `ELEMENT_${blockIndex}_FROM`).value;
    const to = numericField(header, 1, `ELEMENT_${blockIndex}_TO`).value;
    const pointer = integerI13(pointerRow, NODENAME_POINTER_FIELD, `ELEMENT_${blockIndex}_NODENAME_POINTER`);
    blocks.push(Object.freeze({
      blockIndex,
      from: String(Math.round(from)),
      to: String(Math.round(to)),
      pointer: pointer.value,
      pointerRaw: pointer.raw,
      pointerRowAbsoluteIndex: envelope.markerIndex + 1 + offset + NODENAME_POINTER_ROW,
    }));
  }
  return Object.freeze({ envelope, blocks: Object.freeze(blocks) });
}

function sourceFacts(lines) {
  const control = sectionEnvelope(lines, 'CONTROL');
  if (control.rows.length < 1) throw new Error('BM_W2_01_ORACLE_CONTROL_ROW_REQUIRED');
  const nonam = integerI13(control.rows[CONTROL_NONAM_ROW], CONTROL_NONAM_FIELD, 'CONTROL_NONAM');
  const elements = elementFacts(lines);
  const nodename = sectionEnvelope(lines, 'NODENAME');
  if (nonam.value !== nodename.rows.length) {
    throw new Error(`BM_W2_01_ORACLE_NONAM_ROW_COUNT_MISMATCH:${nonam.value}:${nodename.rows.length}`);
  }
  const nameRows = nodename.rows.map((row, index) => parsedNodeNameRow(row, index + 1));
  const namedNodes = new Set();
  for (const block of elements.blocks) {
    if (!block.pointer) continue;
    const row = nameRows[block.pointer - 1];
    if (!row) throw new Error(`BM_W2_01_ORACLE_POINTER_OUT_OF_RANGE:${block.blockIndex}:${block.pointer}`);
    if (row.fromName) namedNodes.add(block.from);
    if (row.toName) namedNodes.add(block.to);
  }
  return Object.freeze({ control, nonam, elements, nodename, nameRows: Object.freeze(nameRows), namedNodes });
}

function bytesFromLines(lines) {
  return new TextEncoder().encode(`${lines.join('\r\n')}\r\n`);
}

export function buildBmW201ExpectedPostimage(value, options = {}) {
  const candidateNode = String(options.node ?? '10');
  const expectedElementIndex = Number(options.elementIndex ?? 0);
  const expectedFrom = String(options.ownerFrom ?? '10');
  const expectedTo = String(options.ownerTo ?? '20');
  const expectedEnd = String(options.ownerEnd ?? 'FROM').toUpperCase();
  const newName = String(options.name ?? 'BM-N10');
  const lines = decodeCrlf(value);
  const facts = sourceFacts(lines);

  if (facts.elements.blocks.length !== 40) throw new Error(`BM_W2_01_ORACLE_ELEMENT_COUNT_DRIFT:${facts.elements.blocks.length}`);
  if (facts.nonam.value !== 4) throw new Error(`BM_W2_01_ORACLE_NONAM_DRIFT:${facts.nonam.value}`);
  const owner = facts.elements.blocks[expectedElementIndex];
  if (!owner || owner.from !== expectedFrom || owner.to !== expectedTo) {
    throw new Error(`BM_W2_01_ORACLE_OWNER_DRIFT:${expectedElementIndex}:${owner?.from || 'NONE'}:${owner?.to || 'NONE'}`);
  }
  if (owner.pointer !== 0) throw new Error(`BM_W2_01_ORACLE_OWNER_POINTER_NOT_ZERO:${owner.pointer}`);
  if (expectedEnd === 'FROM' && owner.from !== candidateNode) throw new Error('BM_W2_01_ORACLE_FROM_NODE_MISMATCH');
  if (expectedEnd === 'TO' && owner.to !== candidateNode) throw new Error('BM_W2_01_ORACLE_TO_NODE_MISMATCH');
  if (!['FROM', 'TO'].includes(expectedEnd)) throw new Error(`BM_W2_01_ORACLE_OWNER_END_INVALID:${expectedEnd}`);
  if (facts.namedNodes.has(candidateNode)) throw new Error(`BM_W2_01_ORACLE_CANDIDATE_ALREADY_PHYSICALLY_NAMED:${candidateNode}`);

  const incidentZeroOwners = facts.elements.blocks.filter((block) => block.pointer === 0 && (block.from === candidateNode || block.to === candidateNode));
  if (!incidentZeroOwners.length) throw new Error(`BM_W2_01_ORACLE_ZERO_POINTER_OWNER_REQUIRED:${candidateNode}`);
  if (incidentZeroOwners[0].blockIndex !== expectedElementIndex) {
    throw new Error(`BM_W2_01_ORACLE_LOWEST_OWNER_DRIFT:${incidentZeroOwners[0].blockIndex}:${expectedElementIndex}`);
  }

  const newPointer = facts.nodename.rows.length + 1;
  if (newPointer !== 5) throw new Error(`BM_W2_01_ORACLE_APPEND_POINTER_DRIFT:${newPointer}`);
  const output = [...lines];
  const controlRowIndex = facts.control.markerIndex + 1 + CONTROL_NONAM_ROW;
  output[controlRowIndex] = replaceI13(output[controlRowIndex], CONTROL_NONAM_FIELD, newPointer, 'CONTROL_NONAM_AFTER');
  output[owner.pointerRowAbsoluteIndex] = replaceI13(output[owner.pointerRowAbsoluteIndex], NODENAME_POINTER_FIELD, newPointer, 'ELEMENT_NODENAME_POINTER_AFTER');

  const currentNodename = sectionEnvelope(output, 'NODENAME');
  const appended = expectedEnd === 'FROM' ? nodeNameRow(newName, '') : nodeNameRow('', newName);
  output.splice(currentNodename.nextMarkerIndex, 0, appended);

  const postFacts = sourceFacts(output);
  const postOwner = postFacts.elements.blocks[expectedElementIndex];
  if (postFacts.nonam.value !== 5 || postFacts.nodename.rows.length !== 5) throw new Error('BM_W2_01_ORACLE_POST_CARDINALITY_MISMATCH');
  if (postOwner.pointer !== 5 || !I13_RX.test(postOwner.pointerRaw.trim())) throw new Error('BM_W2_01_ORACLE_POST_POINTER_I13_MISMATCH');
  const addedRow = postFacts.nameRows[4];
  const actualName = expectedEnd === 'FROM' ? addedRow.fromName : addedRow.toName;
  if (actualName !== newName) throw new Error(`BM_W2_01_ORACLE_POST_NAME_MISMATCH:${actualName}`);

  const bytes = bytesFromLines(output);
  return Object.freeze({
    schema: 'CIIWriter2BenchmarkBmW201Oracle.v1',
    status: 'PASS',
    bytes,
    byteString: new TextDecoder('utf-8').decode(bytes),
    candidate: Object.freeze({ node: candidateNode, elementIndex: expectedElementIndex, from: expectedFrom, to: expectedTo, end: expectedEnd }),
    before: Object.freeze({ nonam: facts.nonam.value, nodenameRows: facts.nodename.rows.length, pointer: owner.pointer, elementCount: facts.elements.blocks.length }),
    after: Object.freeze({
      nonam: postFacts.nonam.value,
      nodenameRows: postFacts.nodename.rows.length,
      pointer: postOwner.pointer,
      pointerRaw: postOwner.pointerRaw,
      pointerLexicalI13: I13_RX.test(postOwner.pointerRaw.trim()),
      elementCount: postFacts.elements.blocks.length,
      name: actualName,
    }),
  });
}

export const _test = Object.freeze({ decodeCrlf, sectionEnvelope, fieldSpan, integerI13, nodeNameRow, sourceFacts });
