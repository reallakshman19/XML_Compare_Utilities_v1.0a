import assert from 'node:assert/strict';
import { _test as relocationTest } from '../tabs/cii-workspace/cii-workspace-writer2-nodename-relocation.js';

const FROM_START = 2;
const FROM_END = 28;
const TO_START = 28;
const TO_END = 53;

for (const [fromName, toName] of [
  ['SL-106.3', 'PS02494.1'],
  ['SL-121.14', 'PS02525.1'],
  ['SL-106', 'PS02482.1'],
]) {
  const row = relocationTest.canonicalRow(fromName, toName);
  assert.equal(row.length, TO_END, `${fromName} / ${toName} must retain the exact fixed-column row width`);
  assert.equal(row.slice(FROM_START, FROM_END).trim(), fromName, `${fromName} must survive FROM-field serialization exactly`);
  assert.equal(row.slice(TO_START, TO_END).trim(), toName, `${toName} must survive TO-field serialization exactly`);
}

const baseline = relocationTest.canonicalRow('SL-106.3', 'PS02494.1');
const replacedFrom = relocationTest.replaceRowField(baseline, 'FROM', 'SL-121.14');
assert.equal(replacedFrom.slice(FROM_START, FROM_END).trim(), 'SL-121.14');
assert.equal(replacedFrom.slice(TO_START, TO_END).trim(), 'PS02494.1', 'changing FROM must not shift or corrupt TO');
assert.equal(replacedFrom.length, baseline.length);

const replacedTo = relocationTest.replaceRowField(baseline, 'TO', 'PS02482.1');
assert.equal(replacedTo.slice(FROM_START, FROM_END).trim(), 'SL-106.3', 'changing TO must not truncate the dotted FROM alias');
assert.equal(replacedTo.slice(TO_START, TO_END).trim(), 'PS02482.1');
assert.equal(replacedTo.length, baseline.length);

console.log('Writer2 dotted NODENAME fixed-column serialization checks passed.');
