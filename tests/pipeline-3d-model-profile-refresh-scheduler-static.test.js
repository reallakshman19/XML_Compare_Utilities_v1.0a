import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime = fs.readFileSync(new URL(
  '../tabs/pipeline-3d-model/pipeline-3d-model-profile-propagation-runtime.js',
  import.meta.url,
), 'utf8');
const scheduler = fs.readFileSync(new URL(
  '../tabs/pipeline-3d-model/pipeline-3d-model-profile-refresh-scheduler.js',
  import.meta.url,
), 'utf8');

assert.match(runtime, /createPipelineProfileRefreshScheduler/);
assert.match(runtime, /refreshScheduler\.schedule\(\)/);
assert.match(runtime, /refreshScheduler\.destroy\(\)/);
assert.doesNotMatch(runtime, /refreshQueued/);
assert.doesNotMatch(runtime, /hasAnyProfileRaw\(dialog\)\) scheduleRefresh/);
assert.match(runtime, /matches\('\[data-p3d-split\$="-raw"\]'\)\) scheduleRefresh/);
assert.ok(runtime.split(/\r?\n/).length < 300);
assert.ok(scheduler.split(/\r?\n/).length < 80);
assert.doesNotMatch(scheduler, /export\s+default|setTimeout|setInterval/);

console.log('pipeline-3d-model profile refresh scheduler static: PASS');
