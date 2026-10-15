import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const authorityPath = fileURLToPath(new URL(
  '../tabs/sequential-sketcher/scoped-edit/sequential-edit-authority.js',
  import.meta.url,
));
const source = readFileSync(authorityPath, 'utf8');
const redoHeadReads = source.match(/redoStack\?\.at\(-1\)/g) || [];

assert.equal(redoHeadReads.length, 2, 'branch and active-session authority must use the native redo stack head');
assert.doesNotMatch(source, /redoStack\?\.at\(0\)/, 'redo authority must not bind the oldest redo entry');
console.log('Sequential redo-head authority regression passed');
