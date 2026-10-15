import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

function csvRows(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(',');
  return lines.slice(1).map((line) => {
    // Qualification map fields are deliberately comma-free except quoted labels are not used.
    const values = line.split(',');
    return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  });
}

const fieldMap = csvRows(read('docs/cii-writer2-sif-create-field-map.csv'));
assert.equal(fieldMap.length, 60, 'V11 qualification must map exactly 60 physical SIF positions');

for (const slot of ['1', '2']) {
  const rows = fieldMap.filter((row) => row.tee_slot === slot);
  assert.equal(rows.length, 30, `tee slot ${slot} must contain exactly 30 items`);
  assert.deepEqual(rows.map((row) => Number(row.neutral_item)), Array.from({ length: 30 }, (_, i) => i + 1));
  for (const row of rows) {
    const item = Number(row.neutral_item) - 1;
    const expectedBaseRow = slot === '1' ? 0 : 5;
    assert.equal(Number(row.block_relative_row), expectedBaseRow + Math.floor(item / 6));
    assert.equal(Number(row.field_index), item % 6);
  }
}

const unresolved2730 = fieldMap.filter((row) => Number(row.neutral_item) >= 27 && Number(row.neutral_item) <= 30);
assert.equal(unresolved2730.length, 8, 'items 27..30 must remain unresolved in both tee slots');
assert.ok(unresolved2730.every((row) => row.position_semantic_authority === 'UNRESOLVED'));
assert.ok(unresolved2730.every((row) => row.create_writable === 'NO'));
assert.equal(fieldMap.filter((row) => row.create_writable === 'YES').length, 0,
  'W2.1 must not authorize any CREATE field while complete default construction remains unresolved');

const qualification = read('docs/cii-writer2-sif-create-qualification.md');
assert.match(qualification, /VERDICT: NOT_READY_FOR_WRITER2_SIF_CREATE_IMPLEMENTATION/);
assert.match(qualification, /V11_ITEM_27: UNRESOLVED/);
assert.match(qualification, /V11_UNUSED_SECOND_SLOT_ENCODING: UNRESOLVED/);
assert.match(qualification, /V11_GENERAL_UNSPECIFIED_FIELD_ENCODING: UNRESOLVED/);

const ledger = read('docs/cii-writer2-sif-create-source-ledger.csv');
assert.match(ledger, /V11 neutral item list,V11,items27\.\.30/);
assert.match(ledger, /Version 13.*B31J support introduced in Version 13/i);
assert.match(ledger, /42 items per tee\/14 rows/);
assert.match(ledger, /DO_NOT_BACKPORT_TO_V11/);

const productionSif = read('tabs/cii-workspace/cii-workspace-writer2-sif-delete.js');
assert.match(productionSif, /WRITER_2_SIF_CREATE_PAYLOAD_SEMANTICS_UNQUALIFIED_ITEMS_27_30/,
  'existing production SIF CREATE blocker must remain present');

const composite = read('tabs/cii-workspace/cii-workspace-writer2-composite-routing.js');
assert.match(composite, /sifTeeCreate:\s*'BLOCKED_ITEMS_27_30_UNRESOLVED'/,
  'Writer2 composite must continue to expose SIF CREATE as blocked');

const census = csvRows(read('docs/cii-writer2-sif-create-real-source-census.csv'));
const realV11 = census.filter((row) => row.origin_class === 'OBSERVED_REAL_REPOSITORY_SOURCE' && row.neutral_version === '11.0000');
assert.ok(realV11.length >= 5, 'qualification census must retain the known real/interface V11 sources');
assert.ok(realV11.some((row) => row.path.includes('SOURCE 3.CII') && row.control_sif_blocks === '14'));
assert.ok(realV11.some((row) => row.path.includes('TARGET 3-1.CII') && row.control_sif_blocks === '14'));

console.log('PASS cii-workspace-writer2-sif-create-qualification');
