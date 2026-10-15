const SECTION_RX = /^#\$\s+([A-Z0-9_&]+)\s*$/;
const I13_RX = /^[+-]?\d+$/;
const FIELD_WIDTHS = Object.freeze([15, 13, 13, 13, 13, 13]);
const CONTROL_HANGER_FIELD = 2;
const EXECUTION_ROWS = 4;

function asBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (typeof value === 'string') return new TextEncoder().encode(value);
  throw new Error('BM_W2_03_ORACLE_BYTES_REQUIRED');
}

function decodeCrlf(value) {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(asBytes(value));
  if (!text.endsWith('\r\n')) throw new Error('BM_W2_03_ORACLE_FINAL_CRLF_REQUIRED');
  const body = text.slice(0, -2);
  if (/(^|[^\r])\n|\r(?!\n)/.test(body)) throw new Error('BM_W2_03_ORACLE_CRLF_ONLY_REQUIRED');
  return body ? body.split('\r\n') : [];
}

function sectionEnvelope(lines, name) {
  const markerIndex = lines.findIndex((line) => SECTION_RX.exec(line)?.[1] === name);
  if (markerIndex < 0) throw new Error(`BM_W2_03_ORACLE_SECTION_REQUIRED:${name}`);
  let nextMarkerIndex = markerIndex + 1;
  while (nextMarkerIndex < lines.length && !SECTION_RX.test(lines[nextMarkerIndex])) nextMarkerIndex += 1;
  if (nextMarkerIndex >= lines.length) throw new Error(`BM_W2_03_ORACLE_NEXT_SECTION_REQUIRED:${name}`);
  return Object.freeze({ markerIndex, nextMarkerIndex, rows: lines.slice(markerIndex + 1, nextMarkerIndex) });
}

function fieldSpan(fieldIndex) {
  const start = FIELD_WIDTHS.slice(0, fieldIndex).reduce((sum, width) => sum + width, 0);
  return Object.freeze({ start, end: start + FIELD_WIDTHS[fieldIndex], width: FIELD_WIDTHS[fieldIndex] });
}

function numericField(line, fieldIndex, label) {
  const span = fieldSpan(fieldIndex);
  if (String(line ?? '').length < span.end) throw new Error(`BM_W2_03_ORACLE_FIELD_WIDTH_REQUIRED:${label}`);
  const raw = line.slice(span.start, span.end);
  const token = raw.trim();
  if (!token) throw new Error(`BM_W2_03_ORACLE_NUMERIC_FIELD_REQUIRED:${label}`);
  const value = Number(token.replace(/[Dd]/g, 'E'));
  if (!Number.isFinite(value)) throw new Error(`BM_W2_03_ORACLE_NUMERIC_FIELD_INVALID:${label}:${token}`);
  return Object.freeze({ raw, token, value, span });
}

function integerI13(line, fieldIndex, label) {
  const field = numericField(line, fieldIndex, label);
  if (!I13_RX.test(field.token)) throw new Error(`BM_W2_03_ORACLE_LEXICAL_I13_REQUIRED:${label}:${field.token}`);
  if (!Number.isSafeInteger(field.value) || field.value < 0) throw new Error(`BM_W2_03_ORACLE_NONNEGATIVE_I13_REQUIRED:${label}:${field.token}`);
  return field;
}

function replaceI13(line, fieldIndex, value, label) {
  const span = fieldSpan(fieldIndex);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error(`BM_W2_03_ORACLE_I13_VALUE_REQUIRED:${label}:${value}`);
  const token = String(number);
  if (token.length > span.width) throw new Error(`BM_W2_03_ORACLE_I13_OVERFLOW:${label}`);
  return `${line.slice(0, span.start)}${token.padStart(span.width, ' ')}${line.slice(span.end)}`;
}

function ceilDiv(value, divisor) {
  return Math.floor(value / divisor) + (value % divisor ? 1 : 0);
}

function exactSingleIntegerRow(row, label) {
  const tokens = String(row ?? '').trim().split(/\s+/).filter(Boolean);
  if (tokens.length !== 1 || !I13_RX.test(tokens[0])) throw new Error(`BM_W2_03_ORACLE_SINGLE_INTEGER_ROW_REQUIRED:${label}`);
  const value = Number(tokens[0]);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`BM_W2_03_ORACLE_POSITIVE_INTEGER_REQUIRED:${label}:${tokens[0]}`);
  return value;
}

function sourceFacts(lines) {
  const control = sectionEnvelope(lines, 'CONTROL');
  if (control.rows.length < 4) throw new Error(`BM_W2_03_ORACLE_CONTROL_ROWS:${control.rows.length}`);
  const numelt = integerI13(control.rows[0], 0, 'CONTROL_NUMELT').value;
  const numnoz = integerI13(control.rows[0], 1, 'CONTROL_NUMNOZ').value;
  const nohgrs = integerI13(control.rows[0], CONTROL_HANGER_FIELD, 'CONTROL_NOHGRS').value;
  const miscel = sectionEnvelope(lines, 'MISCEL_1');
  const rrmatRows = ceilDiv(numelt, 6);
  const nozzleRows = numnoz * 4;
  const prefixRows = rrmatRows + nozzleRows;
  const packedRows = ceilDiv(nohgrs, 6);
  const synchronizerNodeStart = prefixRows + 2;
  const nodes = [];
  for (let index = 0; index < packedRows; index += 1) {
    nodes.push(exactSingleIntegerRow(miscel.rows[synchronizerNodeStart + index], `IHGRNODE_${index}`));
  }
  return Object.freeze({ control, numelt, numnoz, nohgrs, miscel, rrmatRows, nozzleRows, prefixRows, packedRows, synchronizerNodeStart, nodes: Object.freeze(nodes) });
}

function bytesFromLines(lines) {
  return new TextEncoder().encode(`${lines.join('\r\n')}\r\n`);
}

export function buildBmW203ExpectedPostimage(value, options = {}) {
  const expectedNode = Number(options.node ?? 205);
  const lines = decodeCrlf(value);
  const facts = sourceFacts(lines);
  if (facts.numelt !== 40) throw new Error(`BM_W2_03_ORACLE_NUMELT_DRIFT:${facts.numelt}`);
  if (facts.numnoz !== 0) throw new Error(`BM_W2_03_ORACLE_NUMNOZ_DRIFT:${facts.numnoz}`);
  if (facts.nohgrs !== 1) throw new Error(`BM_W2_03_ORACLE_NOHGRS_DRIFT:${facts.nohgrs}`);
  if (facts.miscel.rows.length !== 23) throw new Error(`BM_W2_03_ORACLE_MISCEL_ROWS_DRIFT:${facts.miscel.rows.length}`);
  if (facts.prefixRows !== 7) throw new Error(`BM_W2_03_ORACLE_PREFIX_ROWS_DRIFT:${facts.prefixRows}`);
  if (facts.packedRows !== 1) throw new Error(`BM_W2_03_ORACLE_PACKED_ROWS_DRIFT:${facts.packedRows}`);
  if (facts.nodes.length !== 1 || facts.nodes[0] !== expectedNode) {
    throw new Error(`BM_W2_03_ORACLE_HANGER_NODE_DRIFT:${facts.nodes.join(',')}`);
  }

  const retainedMiscelRows = [
    ...facts.miscel.rows.slice(0, facts.prefixRows),
    ...facts.miscel.rows.slice(facts.miscel.rows.length - EXECUTION_ROWS),
  ];
  if (retainedMiscelRows.length !== 11) throw new Error(`BM_W2_03_ORACLE_POST_MISCEL_ROWS:${retainedMiscelRows.length}`);

  const output = [...lines];
  const controlRowIndex = facts.control.markerIndex + 1;
  output[controlRowIndex] = replaceI13(output[controlRowIndex], CONTROL_HANGER_FIELD, 0, 'CONTROL_NOHGRS_AFTER');
  output.splice(facts.miscel.markerIndex + 1, facts.miscel.rows.length, ...retainedMiscelRows);

  const postFacts = sourceFacts(output);
  if (postFacts.nohgrs !== 0) throw new Error(`BM_W2_03_ORACLE_POST_NOHGRS:${postFacts.nohgrs}`);
  if (postFacts.miscel.rows.length !== 11) throw new Error(`BM_W2_03_ORACLE_POST_MISCEL_ROW_COUNT:${postFacts.miscel.rows.length}`);

  const bytes = bytesFromLines(output);
  return Object.freeze({
    schema: 'CIIWriter2BenchmarkBmW203Oracle.v1',
    status: 'PASS',
    bytes,
    byteString: new TextDecoder('utf-8').decode(bytes),
    before: Object.freeze({ hangerCount: facts.nohgrs, nodes: Object.freeze(facts.nodes.map(String)), miscelRows: facts.miscel.rows.length, prefixRows: facts.prefixRows, executionRows: EXECUTION_ROWS }),
    after: Object.freeze({ hangerCount: postFacts.nohgrs, nodes: Object.freeze([]), miscelRows: postFacts.miscel.rows.length, controlRaw: postFacts.control.rows[0].slice(fieldSpan(CONTROL_HANGER_FIELD).start, fieldSpan(CONTROL_HANGER_FIELD).end) }),
  });
}

export const _test = Object.freeze({ decodeCrlf, sectionEnvelope, fieldSpan, integerI13, ceilDiv, sourceFacts });
