import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const runtimePath = fileURLToPath(new URL(
  '../tabs/sequential-sketcher/construction/sequential-construction-runtime.js',
  import.meta.url,
));
const source = readFileSync(runtimePath, 'utf8');

assert.match(source, /function normalizeCommandEvidenceTimes\(previousSession, result, issuedAt\)/);
assert.match(source, /resolution: withIssuedAt\(decision\.resolution, issuedAt\)/);
assert.match(source, /componentTraversalOverrides = .*\.map/s);
assert.match(source, /result = normalizeCommandEvidenceTimes\(session, result, issuedAt\)/);
console.log('Sequential command-time normalization regression passed');
