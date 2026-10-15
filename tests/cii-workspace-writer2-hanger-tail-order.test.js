import assert from 'assert';
import {
  CII_WRITER_2_HANGER_TAIL_ORDER_AUTHORITY,
  CII_WRITER_2_HANGER_TAIL_ORDERS,
  qualifyCiiWriter2HangerTailOrder,
  retainedCiiWriter2HangerTailRows,
} from '../tabs/cii-workspace/cii-workspace-writer2-hanger-tail-order.js';

function numeric(values) {
  const widths = [15, ...values.slice(1).map(() => 13)];
  return values.map((value, index) => String(value).padStart(widths[index])).join('');
}
function stringCard(value, compactEmpty = false) {
  const text = String(value || '').slice(0, 100);
  const prefix = `${''.padEnd(7)}${String(text.length).padStart(5)} `;
  if (!text && compactEmpty) return prefix;
  return prefix + text.padEnd(100);
}
function hgrdat(record) {
  return [
    numeric([record, 25, 0, 9999.99, 0, 0]),
    numeric([record + 0.5, 9999.99, 0, 0, 0]),
  ];
}
function interleaved(count) {
  const rows = [];
  for (let index = 1; index <= count; index += 1) {
    rows.push(...hgrdat(index), stringCard(`TAG-${index}`), stringCard(`GUID-${index}`));
  }
  return rows;
}
function grouped(count) {
  const numericRows = [];
  const stringRows = [];
  for (let index = 1; index <= count; index += 1) numericRows.push(...hgrdat(index));
  for (let index = 1; index <= count; index += 1) stringRows.push(stringCard(`TAG-${index}`), stringCard(`GUID-${index}`));
  return [...numericRows, ...stringRows];
}

const interleaved3 = qualifyCiiWriter2HangerTailOrder(interleaved(3), 3);
assert.strictEqual(interleaved3.status, 'QUALIFIED');
assert.strictEqual(interleaved3.order, CII_WRITER_2_HANGER_TAIL_ORDERS.INTERLEAVED);
assert.strictEqual(interleaved3.authority, CII_WRITER_2_HANGER_TAIL_ORDER_AUTHORITY);
assert.deepStrictEqual(interleaved3.records[1], {
  recordIndex: 2,
  hgrdatRowIndices: [5, 6],
  tagRowIndex: 7,
  guidRowIndex: 8,
});
assert.deepStrictEqual(retainedCiiWriter2HangerTailRows(interleaved3, [1, 3]), [1, 2, 3, 4, 9, 10, 11, 12]);

const grouped3 = qualifyCiiWriter2HangerTailOrder(grouped(3), 3);
assert.strictEqual(grouped3.status, 'QUALIFIED');
assert.strictEqual(grouped3.order, CII_WRITER_2_HANGER_TAIL_ORDERS.GROUPED);
assert.deepStrictEqual(grouped3.records[1], {
  recordIndex: 2,
  hgrdatRowIndices: [3, 4],
  tagRowIndex: 9,
  guidRowIndex: 10,
});
assert.deepStrictEqual(retainedCiiWriter2HangerTailRows(grouped3, [1, 3]), [1, 2, 5, 6, 7, 8, 11, 12]);

// H=1 is physically identical for both known emitter orders.
const single = qualifyCiiWriter2HangerTailOrder([
  ...hgrdat(1), stringCard('', true), stringCard('', false),
], 1);
assert.strictEqual(single.status, 'QUALIFIED');
assert.strictEqual(single.order, CII_WRITER_2_HANGER_TAIL_ORDERS.SINGLE_RECORD_EQUIVALENT);
assert.deepStrictEqual(single.records[0], {
  recordIndex: 1,
  hgrdatRowIndices: [1, 2],
  tagRowIndex: 3,
  guidRowIndex: 4,
});

// A mixed/forged envelope that matches neither known physical ordering fails closed.
const mixed = interleaved(3);
mixed[4] = stringCard('FORGED-IN-NUMERIC-SLOT');
const mixedResult = qualifyCiiWriter2HangerTailOrder(mixed, 3);
assert.strictEqual(mixedResult.status, 'BLOCKED');
assert(mixedResult.blockers.some((item) => item.code === 'WRITER_2_HANGER_TAIL_ROW_SHAPE_UNQUALIFIED'));
assert.deepStrictEqual(mixedResult.records, []);

// Cardinality is exact: 4 rows per hanger are required for this envelope.
const shortResult = qualifyCiiWriter2HangerTailOrder(interleaved(3).slice(0, 11), 3);
assert.strictEqual(shortResult.status, 'BLOCKED');
assert(shortResult.blockers.some((item) => item.code === 'WRITER_2_HANGER_TAIL_ROW_COUNT_REQUIRED'));

// A forged TAG/GUID length that exceeds the available body is not a valid string card.
const forgedString = grouped(2);
forgedString[4] = `${''.padEnd(7)}${String(100).padStart(5)} short`;
const forgedStringResult = qualifyCiiWriter2HangerTailOrder(forgedString, 2);
assert.strictEqual(forgedStringResult.status, 'BLOCKED');
assert(forgedStringResult.blockers.some((item) => item.code === 'WRITER_2_HANGER_TAIL_ROW_SHAPE_UNQUALIFIED'));

// Zero-hanger input is outside this tail classifier; delete-all uses the existing zero-count path.
const zero = qualifyCiiWriter2HangerTailOrder([], 0);
assert.strictEqual(zero.status, 'BLOCKED');
assert(zero.blockers.some((item) => item.code === 'WRITER_2_HANGER_TAIL_POSITIVE_COUNT_REQUIRED'));

console.log('CII Writer 2 HANGER tail-order qualification checks passed.');
