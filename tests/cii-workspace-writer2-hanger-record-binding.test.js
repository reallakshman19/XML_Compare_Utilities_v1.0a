import assert from 'node:assert/strict';
import {
  CII_WRITER_2_HANGER_RECORD_BINDING_AUTHORITY,
  qualifyCiiWriter2HangerRecordBindings,
} from '../tabs/cii-workspace/cii-workspace-writer2-hanger-record-binding.js';

const WIDTHS = [15, 13, 13, 13, 13, 13];
function numeric(values) { return values.map((value, index) => String(value).padStart(WIDTHS[index] || 13)).join(''); }
function stringCard(value) {
  const text = String(value || '').slice(0, 100);
  return `${''.padEnd(7)}${String(text.length).padStart(5)} ${text.padEnd(100)}`;
}
function row(text, index) { return Object.freeze({ text, lineNumber: index + 1, byteStart: index * 200, byteEnd: index * 200 + text.length }); }
function tailRows(count) {
  const rows = [];
  for (let index = 1; index <= count; index += 1) {
    rows.push(numeric([index, 25, 0, 9999, 0, 0]), numeric([index + 0.5, 9999, 0, 0, 0]), stringCard(`TAG-${index}`), stringCard(`GUID-${index}`));
  }
  return rows.map(row);
}
function freeRows(count) {
  return Array.from({ length: count }, (_, index) => row(`  ${[100 + index, 0, index + 1, 0].map((value) => String(value).padStart(13)).join('')}`, 100 + index));
}
function field(recordIndex, value) {
  const rawField = String(value).padStart(13);
  return Object.freeze({ valueIndex: recordIndex, value, rawField, byteStart: recordIndex * 1000, byteEnd: recordIndex * 1000 + 13, width: 13 });
}
function packed(count) {
  return Object.freeze(Object.fromEntries(['IHGRNODE', 'IHGRNUM', 'IHGRTABLE', 'IHGRSHORT', 'IHGRCN'].map((label, family) => [label,
    Object.freeze({ fields: Object.freeze(Array.from({ length: count }, (_, index) => field(index + 1, (family + 1) * 100 + index + 1))) })])));
}

{
  const result = qualifyCiiWriter2HangerRecordBindings({ count: 3, tailRows: tailRows(3), ihgrfreeRows: freeRows(3), packed: packed(3) });
  assert.equal(result.status, 'QUALIFIED');
  assert.equal(result.authority, CII_WRITER_2_HANGER_RECORD_BINDING_AUTHORITY);
  assert.equal(result.records.length, 3);
  assert.equal(result.records[1].recordIndex, 2);
  assert.equal(result.records[1].tail.hgrdatRows.length, 2);
  assert.equal(result.records[1].ihgrfree.recordIndex, 2);
  assert.equal(result.records[1].packed.IHGRNUM.valueIndex, 2);
  assert.equal(result.semanticAuthority, 'NONE_POSITIONAL_PHYSICAL_CUSTODY_ONLY');
}

// Blank fixed-width packed fields must not silently become numeric zero for partial-record custody.
{
  const base = packed(3);
  const badFields = [...base.IHGRNUM.fields];
  badFields[1] = Object.freeze({ ...badFields[1], value: 0, rawField: ' '.repeat(13) });
  const badPacked = Object.freeze({ ...base, IHGRNUM: Object.freeze({ fields: Object.freeze(badFields) }) });
  const result = qualifyCiiWriter2HangerRecordBindings({ count: 3, tailRows: tailRows(3), ihgrfreeRows: freeRows(3), packed: badPacked });
  assert.equal(result.status, 'BLOCKED');
  assert(result.blockers.includes('WRITER_2_HANGER_POSITIONAL_FIELD_REQUIRED:IHGRNUM:2'));
}

// A positional-index mismatch cannot be canonicalized by equal field value.
{
  const base = packed(3);
  const badFields = [...base.IHGRTABLE.fields];
  badFields[1] = Object.freeze({ ...badFields[1], valueIndex: 3 });
  const badPacked = Object.freeze({ ...base, IHGRTABLE: Object.freeze({ fields: Object.freeze(badFields) }) });
  const result = qualifyCiiWriter2HangerRecordBindings({ count: 3, tailRows: tailRows(3), ihgrfreeRows: freeRows(3), packed: badPacked });
  assert.equal(result.status, 'BLOCKED');
  assert(result.blockers.includes('WRITER_2_HANGER_POSITIONAL_FIELD_REQUIRED:IHGRTABLE:2'));
}

// IHGRFREE is exactly one 2X + four-I13 row per hanger record.
{
  const badFree = [...freeRows(3)];
  badFree[1] = row(`X ${badFree[1].text.slice(2)}`, 101);
  const result = qualifyCiiWriter2HangerRecordBindings({ count: 3, tailRows: tailRows(3), ihgrfreeRows: badFree, packed: packed(3) });
  assert.equal(result.status, 'BLOCKED');
  assert(result.blockers.includes('WRITER_2_HANGER_IHGRFREE_PREFIX_REQUIRED:2'));
}

console.log('Writer2 HANGER record-binding authority preserves exact positional custody without adding HGRDAT semantic authority.');
