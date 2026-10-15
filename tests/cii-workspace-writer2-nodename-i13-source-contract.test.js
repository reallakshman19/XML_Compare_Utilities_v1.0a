import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../tabs/cii-workspace/cii-workspace-writer2-nodename-write.js', import.meta.url), 'utf8');

const pointerFunction = source.match(/function pointerReplacements\([\s\S]*?\n}\nfunction assertDisjoint/);
assert(pointerFunction, 'pointerReplacements() source boundary must remain identifiable');

assert.doesNotMatch(
  pointerFunction[0],
  /afterField:\s*numericField\(/,
  'ELEMENT NODENAME pointer must not be formatted through the REAL numericField/formatCiiWriterSig6 path',
);
assert.match(
  pointerFunction[0],
  /afterField:\s*integerField\(/,
  'ELEMENT NODENAME pointer must be formatted through lexical integerField I13 authority',
);

console.log('Writer2 NODENAME pointer source contract requires lexical I13 formatter: PASS');
