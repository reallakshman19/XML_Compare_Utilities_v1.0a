import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const QUALIFICATION_URL = new URL('../docs/cii-writer2-hanger-create-qualification.md', import.meta.url);
const FIELD_MAP_URL = new URL('../docs/cii-writer2-hanger-create-field-map.csv', import.meta.url);
const SOURCE_LEDGER_URL = new URL('../docs/cii-writer2-hanger-create-source-ledger.csv', import.meta.url);
const CENSUS_URL = new URL('../docs/cii-writer2-hanger-create-real-source-census.csv', import.meta.url);
const PRODUCTION_BLOCKER_URL = new URL('../tabs/cii-workspace/cii-workspace-writer2-hanger-delete.js', import.meta.url);

const [qualification, fieldMap, sourceLedger, census, productionBlockerSource] = await Promise.all([
  readFile(QUALIFICATION_URL, 'utf8'),
  readFile(FIELD_MAP_URL, 'utf8'),
  readFile(SOURCE_LEDGER_URL, 'utf8'),
  readFile(CENSUS_URL, 'utf8'),
  readFile(PRODUCTION_BLOCKER_URL, 'utf8'),
]);

function hangerRows(hangerCount) {
  if (hangerCount <= 0) return 0;
  return 2 + 5 * hangerCount + 5 * Math.ceil(hangerCount / 6);
}

assert.match(
  qualification,
  /NOT_READY_FOR_WRITER2_HANGER_CREATE_IMPLEMENTATION/,
  'W2.5 must remain fail-closed until every CREATE construction gate is source-qualified',
);

for (const blocker of [
  'GUID_SOFTWARE_ASSIGNED_CREATE_RULE_UNRESOLVED',
  'FIRST_HANGER_HEADER_DEFAULTS_UNRESOLVED',
  'REPOSITORY_FALLBACK_DEFAULT_CONFLICT',
  'NEW_HANGER_RECORD_INSERTION_POLICY_UNRESOLVED',
  'OMITTED_PER_HANGER_DEFAULTS_NOT_COMPLETE',
  'REAL_NATIVE_CREATE_TRANSITION_NOT_AVAILABLE',
]) {
  assert.ok(qualification.includes(blocker), `Qualification blocker required: ${blocker}`);
  assert.ok(fieldMap.includes(blocker) || blocker === 'REAL_NATIVE_CREATE_TRANSITION_NOT_AVAILABLE',
    `Field-map blocker coverage required: ${blocker}`);
}

for (const family of [
  'HEADER_1',
  'HEADER_2',
  'IHGRNODE',
  'HGRDAT',
  'TAG',
  'GUID',
  'IHGRFREE',
  'IHGRNUM',
  'IHGRTABLE',
  'IHGRSHORT',
  'IHGRCN',
  'TAIL_ORDER',
  'PACKED_ARRAYS',
  'CONTROL',
  'MISCEL_1',
  'RECORD_IDENTITY',
]) {
  assert.ok(fieldMap.includes(`${family},`), `HANGER CREATE field family must be mapped: ${family}`);
}

assert.ok(sourceLedger.includes('VENDOR_AUTHORED_MIRROR_EXACT_V11'),
  'Exact CAESAR II 2019 / Version 11 vendor-authored source must be in custody');
assert.ok(sourceLedger.includes('OFFICIAL_HEXAGON_V12_CORROBORATION'),
  'Official Hexagon Version 12 corroboration must be retained without edition substitution');
assert.ok(sourceLedger.includes('REPOSITORY_POLICY_CONFLICT'),
  'Conflicting repository fallback defaults must remain explicit non-authority');

assert.equal(hangerRows(1), 12, 'First HANGER region has 12 hanger-owned physical rows');
assert.equal(hangerRows(6), 37, 'H=6 hanger row count');
assert.equal(hangerRows(7), 47, 'H=7 hanger row count');
assert.equal(hangerRows(7) - hangerRows(6), 10, 'H=6->7 packed boundary adds 10 rows');
assert.equal(hangerRows(12), 72, 'H=12 hanger row count');
assert.equal(hangerRows(13), 82, 'H=13 hanger row count');
assert.equal(hangerRows(13) - hangerRows(12), 10, 'H=12->13 packed boundary adds 10 rows');

const censusLines = census.trim().split(/\r?\n/).slice(1);
assert.equal(censusLines.length, 9, 'W2.5 repository HANGER census must retain the nine known CII candidates');
assert.equal(censusLines.filter((line) => line.includes(',H1,SINGLE_RECORD_ORDER_EQUIVALENT,')).length, 2,
  'Exactly two known repository sources have H=1');
assert.equal(censusLines.filter((line) => line.includes(',H0,NOT_APPLICABLE,')).length, 7,
  'Exactly seven known repository sources have H=0');
assert.ok(!censusLines.some((line) => /,H(?:[2-9]|[1-9]\d+),/.test(line)),
  'No repository H>1 CII source may be claimed by the frozen census');

assert.ok(census.includes('TAG blank length0; GUID blank length0'),
  'The two observed H=1 payloads record blank TAG/GUID rows as observation only');
assert.ok(qualification.includes('blank GUID on neutral-file import'),
  'Blank-string syntax must not be upgraded into a qualified GUID assignment rule');

assert.ok(
  productionBlockerSource.includes('WRITER_2_HANGER_CREATE_PAYLOAD_SEMANTICS_NOT_QUALIFIED'),
  'Production HANGER CREATE blocker must remain present',
);

console.log(
  'Writer2 W2.5 HANGER CREATE qualification frozen: V11 field dictionary qualified; generic CREATE remains NOT_READY.',
);
