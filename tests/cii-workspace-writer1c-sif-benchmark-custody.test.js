import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { intakeCiiWorkspaceDocument } from '../tabs/cii-workspace/cii-workspace-intake.js';

const file = 'Benchmark/CIICompare/BM_CII_TARGET1.CII';
const source = readFileSync(file);
const document = await intakeCiiWorkspaceDocument(new Uint8Array(source), 'BM_CII_TARGET1.CII', { side: 'TARGET', cryptoRef: webcrypto });
const custody = document.sifWriter1CEvidence;

assert.equal(document.writer1CByteEligible, true);
assert.equal(custody.status, 'QUALIFIED');
assert.equal(custody.semanticStatus, 'QUALIFIED');
assert.equal(custody.neutralVersion.major, 11);
assert.equal(custody.blockRows, 10);
assert.equal(custody.controlBlockCount, 9);
assert.equal(custody.sectionRowCount, 90);
assert.equal(Object.keys(custody.byPointer).length, 9);

for (const block of Object.values(custody.byPointer)) {
  assert.equal(block.slots[1].ii.item, 3);
  assert.equal(block.slots[1].io.item, 4);
  assert.equal(block.slots[1].ii.width, 13);
  assert.equal(block.slots[1].io.width, 13);
  assert.equal(block.slots[2].ii.item, 3);
  assert.equal(block.slots[2].io.item, 4);
  assert.equal(block.slots[2].ii.width, 13);
  assert.equal(block.slots[2].io.width, 13);
}

assert(Object.values(custody.byParsedElementIndex).some((binding) => Number(binding.pointer) > 0), 'benchmark must expose at least one exact ELEMENT -> SIF block binding');
assert.equal(custody.blockers.length, 0);

console.log('Canonical TARGET1 Version-11 Writer 1C SIF physical custody checks passed.');
