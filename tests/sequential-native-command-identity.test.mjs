import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const preparationPath = fileURLToPath(new URL(
  '../tabs/sequential-sketcher/scoped-edit/sequential-command-preparation.js',
  import.meta.url,
));
const source = readFileSync(preparationPath, 'utf8');

assert.match(source, /const normalized = createSequentialNativeCommand\(value\)/);
assert.match(source, /sameSequentialContractValue\(normalized, value\)/);
assert.match(source, /const nativeCommand = verifiedNativeCommand\(input\.nativeCommand\)/);
assert.doesNotMatch(source, /executeNativeCommand\(input, input\.nativeCommand,/);
console.log('Sequential native command identity regression passed');
