import assert from 'node:assert/strict';
import {
  createPipelineProfileRefreshScheduler,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-profile-refresh-scheduler.js';

let nextId = 0;
const frames = new Map();
const requestFrame = (callback) => { const id = ++nextId; frames.set(id, callback); return id; };
const cancelFrame = (id) => frames.delete(id);
let runs = 0;
const scheduler = createPipelineProfileRefreshScheduler(() => { runs += 1; }, {
  requestFrame, cancelFrame,
});
assert.equal(scheduler.schedule(), true);
assert.equal(scheduler.schedule(), false, 'rapid edits must share one frame');
assert.equal(frames.size, 1);
assert.equal(scheduler.pending, true);
frames.get(1)();
assert.equal(runs, 1);
assert.equal(scheduler.pending, false);
assert.equal(scheduler.schedule(), true);
assert.equal(scheduler.cancel(), true);
assert.equal(frames.has(2), false);
assert.equal(runs, 1);
assert.equal(scheduler.schedule(), true);
assert.equal(scheduler.destroy(), true);
frames.get(3)?.();
assert.equal(runs, 1, 'destroyed scheduler must not execute stale work');
assert.equal(scheduler.schedule(), false);

let microtaskRuns = 0;
const fallback = createPipelineProfileRefreshScheduler(() => { microtaskRuns += 1; }, {
  requestFrame: null,
});
assert.equal(fallback.schedule(), true);
assert.equal(fallback.cancel(), true);
await Promise.resolve();
assert.equal(microtaskRuns, 0, 'cancel must invalidate fallback microtasks');

console.log('pipeline-3d-model profile refresh scheduler: PASS');
