import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const qualification = await readFile(
  new URL('../docs/cii-writer2-restraint-cardinality-qualification.md', import.meta.url), 'utf8');
const fieldMap = await readFile(
  new URL('../docs/cii-writer2-restraint-cardinality-field-map.csv', import.meta.url), 'utf8');
const sourceLedger = await readFile(
  new URL('../docs/cii-writer2-restraint-cardinality-source-ledger.csv', import.meta.url), 'utf8');
const census = await readFile(
  new URL('../docs/cii-writer2-restraint-cardinality-real-source-census.csv', import.meta.url), 'utf8');
const writer1bSlots = await readFile(
  new URL('../tabs/cii-workspace/cii-workspace-restraint-slot-transfer.js', import.meta.url), 'utf8');
const writer2Composite = await readFile(
  new URL('../tabs/cii-workspace/cii-workspace-writer2-composite-routing.js', import.meta.url), 'utf8');

const blockers = [
  'RESTRAINT_GUID_SOFTWARE_ASSIGNED_CREATE_RULE_UNRESOLVED',
  'RESTRAINT_TYPE_DEPENDENT_CREATE_DEFAULTS_INCOMPLETE',
  'NEW_RESTRAINT_BLOCK_ALLOCATION_POLICY_NOT_VENDOR_QUALIFIED',
  'NATIVE_RESTRAINT_BLOCK_CREATE_TRANSITION_NOT_AVAILABLE',
  'SHARED_POINTER_ALIAS_SEMANTICS_NOT_SOURCE_QUALIFIED',
  'FULL_REPOSITORY_POINTER_ALIAS_CENSUS_NOT_EXECUTED',
];

assert.ok(qualification.includes('FINAL_VERDICT: NOT_READY_FOR_WRITER2_RESTRAINT_CARDINALITY_PLANNER'));
assert.ok(qualification.includes('QUALIFIED_DERIVED_FROM_DIRECT_FORMAT'));
for (const blocker of blockers) assert.ok(qualification.includes(blocker), `qualification blocker required: ${blocker}`);

assert.ok(fieldMap.includes('number of restraint auxiliary data blocks'));
assert.ok(fieldMap.includes('software-assigned restraint GUID'));
assert.ok(fieldMap.includes('new=p-count(deleted< p)'));
assert.ok(fieldMap.includes('REPOSITORY_CONVERTER_POLICY_ONLY'));

assert.ok(sourceLedger.includes('VENDOR_AUTHORED_MIRROR_EXACT_V11'));
assert.ok(sourceLedger.includes('OFFICIAL_HEXAGON_NEUTRAL_CONTROL'));
assert.ok(sourceLedger.includes('REPOSITORY_PROTECTED_CONVERTER_POLICY'));
assert.ok(sourceLedger.includes('NOT_RUN_ENVIRONMENT'));

for (const expected of [
  'BM_CII_SOURCE.CII,REAL_VENDOR_BENCHMARK,"5.00000 / 11.0000 / 1256",7',
  'BM_CII_TARGET1.CII,REAL_VENDOR_BENCHMARK,"5.00000 / 11.0000 / 1256",7',
  'BM_CII_TARGET2.CII,REAL_VENDOR_BENCHMARK,"5.00000 / 11.0000 / 1256",7',
  'SOURCE 3.CII",REAL_CAESAR_NEUTRAL,"5.00000 / 11.0000 / 1256; Neutral file interface Ver 11.00",132',
  'TARGET 3-1.CII",REAL_CAESAR_NEUTRAL,"5.00000 / 11.0000 / 1256; Neutral file interface Ver 11.00",135',
  'inputxml_profile_bm_cii_2019.cii,CONVERTER_PROFILE,"5.00000 / 11.0000 / 1256",8',
]) assert.ok(census.includes(expected), `census custody required: ${expected}`);

assert.ok(writer1bSlots.includes('RESTRAINT_TARGET_FREE_SLOT_REQUIRED'),
  'Writer1B free-slot boundary must remain fail-closed');
assert.ok(writer2Composite.includes("restraintCardinality: 'BLOCKED_WRITER_2_COMPOSITE'"),
  'Writer2 composite restraint-cardinality blocker must remain active');

function relocationMap(blockCount, deleted) {
  const deletedSet = new Set(deleted);
  const out = {};
  for (let oldIndex = 1; oldIndex <= blockCount; oldIndex += 1) {
    if (deletedSet.has(oldIndex)) {
      out[oldIndex] = 0;
      continue;
    }
    let deletedBefore = 0;
    for (const candidate of deletedSet) if (candidate < oldIndex) deletedBefore += 1;
    out[oldIndex] = oldIndex - deletedBefore;
  }
  return out;
}

assert.deepEqual(relocationMap(3, [2]), { 1: 1, 2: 0, 3: 2 });
assert.deepEqual(relocationMap(3, [1]), { 1: 0, 2: 1, 3: 2 });
assert.deepEqual(relocationMap(3, [3]), { 1: 1, 2: 2, 3: 0 });
assert.deepEqual(relocationMap(5, [2, 4]), { 1: 1, 2: 0, 3: 2, 4: 0, 5: 3 });
assert.equal(24 * (5 - 2), 72, 'five blocks deleting two leaves three 24-row blocks');

let plannerExists = true;
try {
  await access(new URL('../tabs/cii-workspace/cii-workspace-writer2-restraint-cardinality-plan.js', import.meta.url));
} catch {
  plannerExists = false;
}
assert.equal(plannerExists, false,
  'W2.9 NOT_READY verdict must not silently add a production restraint-cardinality planner');

console.log('Writer2 W2.9 restraint-cardinality qualification frozen: generic planner NOT_READY; delete relocation arithmetic retained only as source-qualified derivation.');
