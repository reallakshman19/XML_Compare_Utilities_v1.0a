import assert from 'node:assert/strict';
import {
  SCOPED_EDIT_RUNTIME_STATUS,
  createScopedEditRuntime,
  isScopedEditDeeplyFrozen,
} from '../core/scoped-edit-runtime/index.js';
import { createScopedEditRuntimeFixture } from './fixtures/scoped-edit-runtime-fixture.js';

let commitSequences = 0, cancelSequences = 0, destroySequences = 0, inputMutations = 0;
const commitVariants = new Set(), orderVariants = new Set(), hostCallVariants = new Set();
const cancelVariants = new Set(), destroyVariants = new Set();

function runtimeFor(fixture) {
  return createScopedEditRuntime({
    host: fixture.host, scopeRequest: fixture.scopeRequest,
    reducerRegistry: fixture.reducerRegistry, journalProjection: fixture.journalProjection,
  });
}

function solve(fixture, runtime, entityId = 'E-01') {
  runtime.beginDrag({ entityId, dragRequest: fixture.dragRequest(entityId) });
  return runtime.solveDrag(fixture.validRay(entityId));
}

for (let index = 0; index < 1000; index += 1) {
  const fixture = createScopedEditRuntimeFixture(), runtime = runtimeFor(fixture);
  const dragRequest = fixture.dragRequest('E-01'), ray = fixture.validRay('E-01');
  const envelope = fixture.envelope(1, 'ENTITY_POSITION_SET', 'E-01', [110, 0, 0]);
  const snapshot = JSON.stringify({ scene: fixture.scene, scopeRequest: fixture.scopeRequest,
    projection: fixture.journalProjection, dragRequest, ray, envelope });
  runtime.beginDrag({ entityId: 'E-01', dragRequest });
  const dragResult = runtime.solveDrag(ray);
  assert.equal(dragResult.valid, true);
  const proposal = runtime.prepareCommit({ commandName: 'ENTITY_POSITION_SET', targetIds: ['E-01'], envelope });
  assert.equal(proposal.status, 'PREPARED');
  const result = runtime.commitPrepared();
  assert.equal(result.status, 'COMMITTED');
  assert.equal(runtime.getState().status, SCOPED_EDIT_RUNTIME_STATUS.COMMITTED);
  assert.equal(result.commandId, envelope.commandId);
  assert.deepEqual(result.dragResult.point, [110, 0, 0]);
  assert.equal(isScopedEditDeeplyFrozen(result), true);
  assert.equal(isScopedEditDeeplyFrozen(runtime.getState()), true);
  commitVariants.add(JSON.stringify(result));
  orderVariants.add(JSON.stringify(result.appliedCommandIds));
  hostCallVariants.add(JSON.stringify(fixture.readEvidence()));
  if (snapshot !== JSON.stringify({ scene: fixture.scene, scopeRequest: fixture.scopeRequest,
    projection: fixture.journalProjection, dragRequest, ray, envelope })) inputMutations += 1;
  commitSequences += 1;
}

assert.equal(commitVariants.size, 1);
assert.equal(orderVariants.size, 1);
assert.equal(hostCallVariants.size, 1);

for (let index = 0; index < 1000; index += 1) {
  const fixture = createScopedEditRuntimeFixture(), runtime = runtimeFor(fixture);
  const before = JSON.stringify({ scene: fixture.scene, request: fixture.scopeRequest, projection: fixture.journalProjection });
  solve(fixture, runtime);
  const cancelled = runtime.cancelDrag();
  assert.equal(cancelled.status, SCOPED_EDIT_RUNTIME_STATUS.CANCELLED);
  const result = runtime.prepareCommit({});
  assert.equal(result.status, 'REJECTED');
  assert.equal(result.rejectionCode, 'DRAG_CANCELLED');
  assert.deepEqual(result.journalProjection, fixture.journalProjection);
  assert.equal(fixture.readEvidence().appendCalls, 0);
  cancelVariants.add(JSON.stringify(result));
  if (before !== JSON.stringify({ scene: fixture.scene, request: fixture.scopeRequest, projection: fixture.journalProjection })) {
    inputMutations += 1;
  }
  cancelSequences += 1;
}
assert.equal(cancelVariants.size, 1);

{
  const fixture = createScopedEditRuntimeFixture(), runtime = runtimeFor(fixture);
  assert.throws(() => runtime.beginDrag({ entityId: 'B-01', dragRequest: fixture.dragRequest('B-01') }),
    (error) => error.code === 'ENTITY_BOUNDARY_ONLY');
  assert.equal(fixture.readEvidence().geometryCalls, 0);
  assert.equal(fixture.readEvidence().appendCalls, 0);
}

{
  const fixture = createScopedEditRuntimeFixture(), runtime = runtimeFor(fixture);
  const mismatch = { ...fixture.dragRequest('E-01'), start: [999, 0, 0] };
  assert.throws(() => runtime.beginDrag({ entityId: 'E-01', dragRequest: mismatch }),
    (error) => error.code === 'DRAG_START_MISMATCH');
  assert.equal(fixture.readEvidence().appendCalls, 0);
}

{
  const fixture = createScopedEditRuntimeFixture(), runtime = runtimeFor(fixture);
  runtime.beginDrag({ entityId: 'E-01', dragRequest: fixture.dragRequest('E-01') });
  const invalid = runtime.solveDrag(fixture.invalidRay('E-01'));
  assert.equal(invalid.valid, false);
  assert.equal(runtime.getState().status, SCOPED_EDIT_RUNTIME_STATUS.DRAGGING);
  const rejected = runtime.prepareCommit({});
  assert.equal(rejected.rejectionCode, 'DRAG_INVALID');
  assert.deepEqual(rejected.journalProjection, fixture.journalProjection);
  assert.equal(fixture.readEvidence().appendCalls, 0);
}

for (let index = 0; index < 100; index += 1) {
  const fixture = createScopedEditRuntimeFixture();
  const firstRuntime = runtimeFor(fixture), initial = firstRuntime.getState();
  const firstDestroy = firstRuntime.destroy(), repeatedDestroy = firstRuntime.destroy();
  assert.deepEqual(firstDestroy, repeatedDestroy);
  assert.equal(firstDestroy.status, SCOPED_EDIT_RUNTIME_STATUS.DESTROYED);
  assert.deepEqual(Object.keys(firstDestroy).sort(), ['sceneId', 'schema', 'sequence', 'status']);
  assert.throws(() => firstRuntime.solveDrag(fixture.validRay()), (error) => error.code === 'RUNTIME_DESTROYED');
  const remounted = runtimeFor(fixture).getState();
  assert.deepEqual(remounted, initial);
  destroyVariants.add(JSON.stringify({ destroyed: firstDestroy, remounted }));
  destroySequences += 1;
}
assert.equal(destroyVariants.size, 1);
assert.equal(inputMutations, 0);
assert.deepEqual({ commitSequences, cancelSequences, destroySequences }, {
  commitSequences: 1000, cancelSequences: 1000, destroySequences: 100,
});
console.log('[PASS] scoped-edit lifecycle: 1000 commits, 1000 cancel/reject, 100 destroy/remount; mutations=0; variants=1.');
