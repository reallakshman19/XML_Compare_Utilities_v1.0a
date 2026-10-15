import { decodeCiiNumericRow } from '../../parser/fixed-field.js';
import { deepFreeze } from './cii-workspace-contracts.js';

export const CII_WRITER_2_HANGER_TAIL_ORDERS = Object.freeze({
  SINGLE_RECORD_EQUIVALENT: 'SINGLE_RECORD_ORDER_EQUIVALENT',
  INTERLEAVED: 'HGRDAT_TAG_GUID_INTERLEAVED_PER_RECORD',
  GROUPED: 'HGRDAT_ALL_THEN_TAG_GUID_ALL',
});

export const CII_WRITER_2_HANGER_TAIL_ORDER_AUTHORITY =
  'PHYSICAL_ROW_SHAPE_PLUS_DUAL_EMITTER_ORDER';

const STRING_PREFIX = 7;
const STRING_LENGTH_WIDTH = 5;
const STRING_SEPARATOR_INDEX = STRING_PREFIX + STRING_LENGTH_WIDTH;
const STRING_BODY_INDEX = STRING_SEPARATOR_INDEX + 1;
const STRING_BODY_WIDTH = 100;

function rowText(row) {
  return String(row?.text ?? row ?? '');
}

function blocker(code, details = {}) {
  return Object.freeze({ code, ...details });
}

function stringCard(row) {
  const raw = rowText(row);
  if (raw.length < STRING_BODY_INDEX) return null;
  if (raw.slice(0, STRING_PREFIX) !== ' '.repeat(STRING_PREFIX)) return null;
  if (raw[STRING_SEPARATOR_INDEX] !== ' ') return null;
  const lengthField = raw.slice(STRING_PREFIX, STRING_SEPARATOR_INDEX);
  if (!/^\s*\d+$/.test(lengthField)) return null;
  const declaredLength = Number(lengthField.trim());
  if (!Number.isSafeInteger(declaredLength) || declaredLength < 0 || declaredLength > STRING_BODY_WIDTH) return null;
  const body = raw.slice(STRING_BODY_INDEX);
  if (declaredLength > body.length) return null;
  if (body.length > STRING_BODY_WIDTH && body.slice(STRING_BODY_WIDTH).trim()) return null;
  return Object.freeze({ declaredLength, body: body.slice(0, STRING_BODY_WIDTH) });
}

function numericCard(row, expectedValueCount) {
  const raw = rowText(row);
  if (!raw.startsWith('  ') || stringCard(row)) return null;
  const values = decodeCiiNumericRow(raw);
  if (!Array.isArray(values) || values.length !== expectedValueCount || values.some((value) => !Number.isFinite(value))) return null;
  return Object.freeze({ valueCount: values.length, values: Object.freeze([...values]) });
}

function recordMap(order, count) {
  const records = [];
  for (let zero = 0; zero < count; zero += 1) {
    if (order === CII_WRITER_2_HANGER_TAIL_ORDERS.GROUPED) {
      records.push(Object.freeze({
        recordIndex: zero + 1,
        hgrdatRowIndices: Object.freeze([zero * 2 + 1, zero * 2 + 2]),
        tagRowIndex: count * 2 + zero * 2 + 1,
        guidRowIndex: count * 2 + zero * 2 + 2,
      }));
    } else {
      const start = zero * 4;
      records.push(Object.freeze({
        recordIndex: zero + 1,
        hgrdatRowIndices: Object.freeze([start + 1, start + 2]),
        tagRowIndex: start + 3,
        guidRowIndex: start + 4,
      }));
    }
  }
  return Object.freeze(records);
}

function matchesInterleaved(rows, count) {
  for (let record = 0; record < count; record += 1) {
    const start = record * 4;
    if (!numericCard(rows[start], 6) || !numericCard(rows[start + 1], 5)) return false;
    if (!stringCard(rows[start + 2]) || !stringCard(rows[start + 3])) return false;
  }
  return true;
}

function matchesGrouped(rows, count) {
  for (let record = 0; record < count; record += 1) {
    const start = record * 2;
    if (!numericCard(rows[start], 6) || !numericCard(rows[start + 1], 5)) return false;
  }
  const stringBase = count * 2;
  for (let record = 0; record < count; record += 1) {
    const start = stringBase + record * 2;
    if (!stringCard(rows[start]) || !stringCard(rows[start + 1])) return false;
  }
  return true;
}

export function qualifyCiiWriter2HangerTailOrder(rows, count) {
  const blockers = [];
  const hangerCount = Number(count);
  if (!Number.isSafeInteger(hangerCount) || hangerCount <= 0) {
    blockers.push(blocker('WRITER_2_HANGER_TAIL_POSITIVE_COUNT_REQUIRED', { count }));
    return deepFreeze({
      schema: 'CIIWriter2HangerTailOrderQualification.v1', status: 'BLOCKED', count: hangerCount,
      order: null, authority: null, records: Object.freeze([]), blockers: Object.freeze(blockers),
    });
  }
  const physicalRows = Array.isArray(rows) ? rows : [];
  const expectedRows = hangerCount * 4;
  if (physicalRows.length !== expectedRows) {
    blockers.push(blocker('WRITER_2_HANGER_TAIL_ROW_COUNT_REQUIRED', {
      actual: physicalRows.length, expected: expectedRows,
    }));
  }
  if (blockers.length) {
    return deepFreeze({
      schema: 'CIIWriter2HangerTailOrderQualification.v1', status: 'BLOCKED', count: hangerCount,
      order: null, authority: null, records: Object.freeze([]), blockers: Object.freeze(blockers),
    });
  }

  const interleaved = matchesInterleaved(physicalRows, hangerCount);
  const grouped = matchesGrouped(physicalRows, hangerCount);
  let order = null;
  if (hangerCount === 1 && interleaved && grouped) {
    order = CII_WRITER_2_HANGER_TAIL_ORDERS.SINGLE_RECORD_EQUIVALENT;
  } else if (interleaved && !grouped) {
    order = CII_WRITER_2_HANGER_TAIL_ORDERS.INTERLEAVED;
  } else if (grouped && !interleaved) {
    order = CII_WRITER_2_HANGER_TAIL_ORDERS.GROUPED;
  } else if (interleaved && grouped) {
    blockers.push(blocker('WRITER_2_HANGER_TAIL_ORDER_AMBIGUOUS'));
  } else {
    blockers.push(blocker('WRITER_2_HANGER_TAIL_ROW_SHAPE_UNQUALIFIED'));
  }

  const mappingOrder = order === CII_WRITER_2_HANGER_TAIL_ORDERS.GROUPED
    ? CII_WRITER_2_HANGER_TAIL_ORDERS.GROUPED
    : CII_WRITER_2_HANGER_TAIL_ORDERS.INTERLEAVED;
  return deepFreeze({
    schema: 'CIIWriter2HangerTailOrderQualification.v1',
    status: blockers.length ? 'BLOCKED' : 'QUALIFIED',
    count: hangerCount,
    order: blockers.length ? null : order,
    authority: blockers.length ? null : CII_WRITER_2_HANGER_TAIL_ORDER_AUTHORITY,
    records: blockers.length ? Object.freeze([]) : recordMap(mappingOrder, hangerCount),
    blockers: Object.freeze(blockers),
    sourceBoundary: Object.freeze({
      interleavedEmitter: '3D_Converters/converters/scripts/cii2019_hanger_miscel_control.py',
      groupedEmitter: '3D_Converters/converters/scripts/cii2019_miscel_hardener.py',
      mutationAuthority: 'NONE_CLASSIFICATION_ONLY',
    }),
  });
}

export function retainedCiiWriter2HangerTailRows(qualification, retainedRecordIndices) {
  if (qualification?.status !== 'QUALIFIED') return Object.freeze([]);
  const retained = new Set((retainedRecordIndices || []).map(Number));
  const records = (qualification.records || []).filter((record) => retained.has(Number(record.recordIndex)));
  const indices = [];
  if (qualification.order === CII_WRITER_2_HANGER_TAIL_ORDERS.GROUPED) {
    for (const record of records) indices.push(...record.hgrdatRowIndices);
    for (const record of records) indices.push(record.tagRowIndex, record.guidRowIndex);
  } else {
    for (const record of records) indices.push(...record.hgrdatRowIndices, record.tagRowIndex, record.guidRowIndex);
  }
  return Object.freeze(indices);
}
