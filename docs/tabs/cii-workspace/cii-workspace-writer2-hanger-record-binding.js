import { deepFreeze } from './cii-workspace-contracts.js';
import {
  CII_WRITER_2_HANGER_TAIL_ORDER_AUTHORITY,
  qualifyCiiWriter2HangerTailOrder,
} from './cii-workspace-writer2-hanger-tail-order.js';

export const CII_WRITER_2_HANGER_RECORD_BINDING_AUTHORITY =
  `${CII_WRITER_2_HANGER_TAIL_ORDER_AUTHORITY}+POSITIONAL_HANGER_ARRAY_RECORD_INDEX`;

const PACKED_PREFIX = 2;
const FIELD_WIDTH = 13;
const IHGRFREE_FIELD_COUNT = 4;
const PACKED_LABELS = Object.freeze(['IHGRNODE', 'IHGRNUM', 'IHGRTABLE', 'IHGRSHORT', 'IHGRCN']);

function codeOf(item) { return String(item?.code || item || '').trim(); }
function integerToken(rawField) {
  const token = String(rawField || '').trim();
  return /^[+-]?\d+$/.test(token) ? Number(token) : null;
}
function rowRef(row, relativeRowIndex) {
  return Object.freeze({
    relativeRowIndex,
    lineNumber: row?.lineNumber ?? null,
    byteStart: Number.isSafeInteger(Number(row?.byteStart)) ? Number(row.byteStart) : null,
    byteEnd: Number.isSafeInteger(Number(row?.byteEnd)) ? Number(row.byteEnd) : null,
  });
}
function ihgrfreeCustody(row, recordIndex, blockers) {
  const raw = String(row?.text || '');
  const expectedEnd = PACKED_PREFIX + IHGRFREE_FIELD_COUNT * FIELD_WIDTH;
  if (raw.slice(0, PACKED_PREFIX) !== '  ') blockers.push(`WRITER_2_HANGER_IHGRFREE_PREFIX_REQUIRED:${recordIndex}`);
  if (raw.length < expectedEnd) {
    blockers.push(`WRITER_2_HANGER_IHGRFREE_WIDTH_REQUIRED:${recordIndex}:${raw.length}:${expectedEnd}`);
    return null;
  }
  if (raw.slice(expectedEnd).trim()) blockers.push(`WRITER_2_HANGER_IHGRFREE_TRAILING_DATA:${recordIndex}`);
  const fields = [];
  for (let column = 0; column < IHGRFREE_FIELD_COUNT; column += 1) {
    const start = PACKED_PREFIX + column * FIELD_WIDTH;
    const end = start + FIELD_WIDTH;
    const rawField = raw.slice(start, end);
    const value = integerToken(rawField);
    if (!Number.isSafeInteger(value)) blockers.push(`WRITER_2_HANGER_IHGRFREE_INTEGER_REQUIRED:${recordIndex}:${column + 1}`);
    fields.push(Object.freeze({
      fieldIndex: column + 1,
      value,
      rawField,
      byteStart: Number.isSafeInteger(Number(row?.byteStart)) ? Number(row.byteStart) + start : null,
      byteEnd: Number.isSafeInteger(Number(row?.byteStart)) ? Number(row.byteStart) + end : null,
      width: FIELD_WIDTH,
    }));
  }
  return Object.freeze({ recordIndex, row: rowRef(row, recordIndex), fields: Object.freeze(fields) });
}
function tailCustody(rows, record, blockers) {
  const all = [...(record?.hgrdatRowIndices || []), record?.tagRowIndex, record?.guidRowIndex];
  if (all.length !== 4 || all.some((index) => !Number.isSafeInteger(Number(index)) || Number(index) < 1 || Number(index) > rows.length)) {
    blockers.push(`WRITER_2_HANGER_TAIL_RECORD_ROW_INDEX_REQUIRED:${record?.recordIndex || 'unknown'}`);
    return null;
  }
  const refs = all.map((index) => rowRef(rows[Number(index) - 1], Number(index)));
  return Object.freeze({
    recordIndex: Number(record.recordIndex),
    hgrdatRows: Object.freeze(refs.slice(0, 2)),
    tagRow: refs[2],
    guidRow: refs[3],
  });
}

export function qualifyCiiWriter2HangerRecordBindings({ count, tailRows, ihgrfreeRows, packed }) {
  const blockers = [];
  const hangerCount = Number(count);
  if (!Number.isSafeInteger(hangerCount) || hangerCount <= 0) blockers.push('WRITER_2_HANGER_RECORD_BINDING_POSITIVE_COUNT_REQUIRED');
  const tail = qualifyCiiWriter2HangerTailOrder(tailRows, hangerCount);
  if (tail.status !== 'QUALIFIED') {
    for (const item of tail.blockers || []) blockers.push(codeOf(item));
  }
  const freeRows = Array.isArray(ihgrfreeRows) ? ihgrfreeRows : [];
  if (Number.isSafeInteger(hangerCount) && freeRows.length !== hangerCount) {
    blockers.push(`WRITER_2_HANGER_IHGRFREE_ROW_COUNT_REQUIRED:${freeRows.length}:${hangerCount}`);
  }

  const records = [];
  if (tail.status === 'QUALIFIED' && Number.isSafeInteger(hangerCount) && hangerCount > 0) {
    for (let recordIndex = 1; recordIndex <= hangerCount; recordIndex += 1) {
      const tailRecord = (tail.records || []).find((record) => Number(record.recordIndex) === recordIndex);
      if (!tailRecord) blockers.push(`WRITER_2_HANGER_TAIL_RECORD_REQUIRED:${recordIndex}`);
      const tailRecordCustody = tailRecord ? tailCustody(tailRows || [], tailRecord, blockers) : null;
      const free = ihgrfreeCustody(freeRows[recordIndex - 1], recordIndex, blockers);
      const arrays = {};
      for (const label of PACKED_LABELS) {
        const field = packed?.[label]?.fields?.[recordIndex - 1] || null;
        const tokenValue = field ? integerToken(field.rawField) : null;
        if (!field || Number(field.valueIndex) !== recordIndex || !Number.isSafeInteger(tokenValue)
          || Number(field.value) !== tokenValue) {
          blockers.push(`WRITER_2_HANGER_POSITIONAL_FIELD_REQUIRED:${label}:${recordIndex}`);
        }
        arrays[label] = field;
      }
      records.push(Object.freeze({
        recordIndex,
        node: arrays.IHGRNODE ? String(arrays.IHGRNODE.value) : null,
        tail: tailRecordCustody,
        ihgrfree: free,
        packed: Object.freeze(arrays),
      }));
    }
  }

  const unique = Object.freeze([...new Set(blockers.filter(Boolean))]);
  return deepFreeze({
    schema: 'CIIWriter2HangerRecordBindingQualification.v1',
    status: unique.length ? 'BLOCKED' : 'QUALIFIED',
    count: hangerCount,
    authority: unique.length ? null : CII_WRITER_2_HANGER_RECORD_BINDING_AUTHORITY,
    tailOrder: unique.length ? null : tail.order,
    tailAuthority: unique.length ? null : tail.authority,
    tailQualification: tail,
    records: unique.length ? Object.freeze([]) : Object.freeze(records),
    blockers: unique,
    semanticAuthority: 'NONE_POSITIONAL_PHYSICAL_CUSTODY_ONLY',
  });
}

export const _test = Object.freeze({ ihgrfreeCustody, integerToken, tailCustody });
