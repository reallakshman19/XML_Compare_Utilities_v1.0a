import assert from 'node:assert/strict';
import { createPipelineCompletedOutputSession, PIPELINE_COMPLETED_OUTPUT_EMPTY,
  PIPELINE_COMPLETED_OUTPUT_BUILT, PIPELINE_COMPLETED_OUTPUT_REUSED,
  PIPELINE_COMPLETED_OUTPUT_FAILED } from '../tabs/pipeline-3d-model/pipeline-3d-model-completed-output-session.js';
let builds = 0;
const session = createPipelineCompletedOutputSession((input) => {
  builds += 1;
  if (input.fail) throw new Error('fail');
  return { value: input.value, nested: [{ build: builds }] };
});
assert.deepEqual(session.snapshot(), { disposition: PIPELINE_COMPLETED_OUTPUT_EMPTY,
  buildCount: 0, reuseCount: 0, failureCount: 0, hasOutput: false });
const first = session.resolve({ value: 'A' });
assert.equal(Object.isFrozen(session.snapshot()), true);
assert.deepEqual(session.snapshot(), { disposition: PIPELINE_COMPLETED_OUTPUT_BUILT,
  buildCount: 1, reuseCount: 0, failureCount: 0, hasOutput: true });
assert.equal(session.resolve({ value: 'A' }), first);
assert.deepEqual(session.snapshot(), { disposition: PIPELINE_COMPLETED_OUTPUT_REUSED,
  buildCount: 1, reuseCount: 1, failureCount: 0, hasOutput: true });
assert.notEqual(session.resolve({ value: 'B' }), first);
assert.deepEqual(session.snapshot(), { disposition: PIPELINE_COMPLETED_OUTPUT_BUILT,
  buildCount: 2, reuseCount: 1, failureCount: 0, hasOutput: true });
assert.throws(() => session.resolve({ fail: true }), /fail/);
assert.deepEqual(session.snapshot(), { disposition: PIPELINE_COMPLETED_OUTPUT_FAILED,
  buildCount: 2, reuseCount: 1, failureCount: 1, hasOutput: true });
session.reset();
assert.deepEqual(session.snapshot(), { disposition: PIPELINE_COMPLETED_OUTPUT_EMPTY,
  buildCount: 2, reuseCount: 1, failureCount: 1, hasOutput: false });
console.log('completed output resolution metrics: PASS');
