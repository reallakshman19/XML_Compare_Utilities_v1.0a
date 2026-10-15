import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../tabs/pipeline-3d-model/', import.meta.url);
const runtime = fs.readFileSync(new URL('pipeline-3d-model-profile-propagation-runtime.js', root), 'utf8');
const scanner = fs.readFileSync(new URL('pipeline-3d-model-raw-table-readiness.js', root), 'utf8');

assert.match(runtime, /scanPipelineRawTableReadiness/);
assert.match(runtime, /tableReadiness\.table2a\.hasDataRow/);
assert.doesNotMatch(runtime, /split\(\/\\r\?\\n\/\)\.filter/);
assert.ok(scanner.split(/\r?\n/).length < 50);
assert.doesNotMatch(scanner, /export\s+default/);

console.log('pipeline-3d-model raw table readiness static: PASS');
