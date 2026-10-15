import assert from 'node:assert/strict';
import {
  createEngineeringCommandResult,
  createEngineeringRevisionToken,
  createEngineeringScene,
  createEngineeringSceneEntity,
  createPointGeometry,
} from '../core/engineering-scene/index.js';
import {
  createEngineeringSvgCommandGateway,
  createEngineeringSvgDraftStore,
  createEngineeringSvgEditCoordinator,
} from '../core/engineering-svg/edit-runtime.js';
import { createEngineeringSvgInteractionSession } from '../core/engineering-svg/interaction-runtime.js';

const revisionA = createEngineeringRevisionToken('interaction-r1');
const revisionB = createEngineeringRevisionToken('interaction-r2');
const originalGeometry = createPointGeometry({ x: 0, y: 0, z: 0 });
const scene = createEngineeringScene({
  sceneId: 'interaction-scene',
  revision: revisionA,
  entities: [createEngineeringSceneEntity({
    id: 'point-1', kind: 'point', geometry: originalGeometry,
    domainRef: { owner: 'synthetic', id: 'point-1' },
  })],
});
const sceneBefore = JSON.parse(JSON.stringify(scene));
const fit = { scale: 2, offsetX: 100, offsetY: 100 };

function environment(currentRevision = revisionA) {
  const draftStore = createEngineeringSvgDraftStore();
  let domainCalls = 0;
  let committedIntent = null;
  let revision = currentRevision;
  const gateway = createEngineeringSvgCommandGateway({
    getCurrentRevision: () => revision,
    execute: async (intent) => {
      domainCalls += 1;
      committedIntent = intent;
      revision = revisionB;
      return createEngineeringCommandResult({
        operationId: intent.operationId,
        status: 'committed',
        resultingRevision: revisionB,
        commandReason: 'synthetic-pointer-commit',
      });
    },
  });
  const coordinator = createEngineeringSvgEditCoordinator({ commandGateway: gateway, draftStore });
  const session = createEngineeringSvgInteractionSession({ getScene: () => scene, editCoordinator: coordinator });
  return {
    draftStore, session,
    domainCalls: () => domainCalls,
    committedIntent: () => committedIntent,
  };
}

const axisEnv = environment();
axisEnv.session.begin({
  operationId: 'axis-1', entityId: 'point-1', baseRevision: revisionA,
  constraint: { kind: 'axis', axis: 'X' }, projection: 'XY', fit,
  startScreenPoint: { x: 0, y: 0 },
});
const firstPreview = await axisEnv.session.preview({ currentScreenPoint: { x: 20, y: 6 }, snapEnabled: false });
assert.equal(firstPreview.status, 'dragging');
assert.deepEqual(firstPreview.solution.worldDelta, { x: 10, y: 0, z: 0 });
assert.deepEqual(firstPreview.draftGeometry.position, {
  schema: 'EngineeringPoint3D.v1', x: 10, y: 0, z: 0,
});
assert.equal(axisEnv.domainCalls(), 0, 'pointer preview must not execute a domain command');
assert.deepEqual(axisEnv.draftStore.getSnapshot().geometry['point-1'].draft, firstPreview.draftGeometry);
const repeated = await axisEnv.session.preview({ currentScreenPoint: { x: 20, y: 6 }, snapEnabled: false });
assert.equal(JSON.stringify(repeated), JSON.stringify(firstPreview), 'identical preview input must be deterministic');
const committed = await axisEnv.session.commit();
assert.equal(committed.status, 'committed');
assert.equal(axisEnv.domainCalls(), 1);
assert.deepEqual(axisEnv.committedIntent().changes.geometry.draft, firstPreview.draftGeometry);
assert.deepEqual(axisEnv.committedIntent().changes.geometry.constraint, firstPreview.constraint);
assert.equal(axisEnv.draftStore.getSnapshot().operationId, null);
assert.equal(axisEnv.session.getState().status, 'committed');
await assert.rejects(() => axisEnv.session.commit(), /requires an active dragging interaction/);
assert.deepEqual(JSON.parse(JSON.stringify(scene)), sceneBefore, 'interaction must not mutate the source scene');

const planeEnv = environment();
planeEnv.session.begin({
  operationId: 'plane-1', entityId: 'point-1', constraint: { kind: 'plane', axes: ['X', 'Y'] },
  projection: 'XY', fit, startScreenPoint: { x: 0, y: 0 },
});
const planePreview = await planeEnv.session.preview({ currentScreenPoint: { x: 20, y: -10 }, snapEnabled: false });
assert.deepEqual(planePreview.solution.worldDelta, { x: 10, y: 5, z: 0 });
assert.deepEqual(planePreview.draftGeometry.position, {
  schema: 'EngineeringPoint3D.v1', x: 10, y: 5, z: 0,
});
planeEnv.session.cancel('test-complete');
assert.equal(planeEnv.domainCalls(), 0);
assert.equal(planeEnv.draftStore.getSnapshot().operationId, null);

const zeroEnv = environment();
zeroEnv.session.begin({
  operationId: 'zero-1', entityId: 'point-1', constraint: { kind: 'axis', axis: 'X' },
  projection: 'XY', fit, startScreenPoint: { x: 0, y: 0 },
});
const zeroPreview = await zeroEnv.session.preview({ currentScreenPoint: { x: 0, y: 8 }, snapEnabled: false });
assert.equal(zeroPreview.noChange, true);
const noChange = await zeroEnv.session.commit();
assert.equal(noChange.status, 'cancelled');
assert.equal(noChange.code, 'NO_CHANGE');
assert.equal(zeroEnv.domainCalls(), 0);
assert.equal(zeroEnv.draftStore.getSnapshot().operationId, null);

const cancelEnv = environment();
cancelEnv.session.begin({
  operationId: 'cancel-1', entityId: 'point-1', constraint: { kind: 'axis', axis: 'X' },
  projection: 'XY', fit, startScreenPoint: { x: 0, y: 0 },
});
await cancelEnv.session.preview({ currentScreenPoint: { x: 10, y: 0 }, snapEnabled: false });
cancelEnv.session.cancel('escape');
assert.equal(cancelEnv.session.getState().status, 'cancelled');
assert.equal(cancelEnv.domainCalls(), 0);
assert.equal(cancelEnv.draftStore.getSnapshot().operationId, null);

const staleEnv = environment(revisionB);
staleEnv.session.begin({
  operationId: 'stale-1', entityId: 'point-1', constraint: { kind: 'axis', axis: 'X' },
  projection: 'XY', fit, startScreenPoint: { x: 0, y: 0 },
});
await staleEnv.session.preview({ currentScreenPoint: { x: 10, y: 0 }, snapEnabled: false });
const stale = await staleEnv.session.commit();
assert.equal(stale.status, 'rejected');
assert.equal(stale.code, 'STALE_BASE_REVISION');
assert.equal(staleEnv.domainCalls(), 0);
assert.equal(staleEnv.session.getState().status, 'rejected');
assert.equal(staleEnv.draftStore.getSnapshot().operationId, null);

const isolatedA = environment();
const isolatedB = environment();
isolatedA.session.begin({
  operationId: 'isolation-a', entityId: 'point-1', constraint: { kind: 'axis', axis: 'X' },
  projection: 'XY', fit, startScreenPoint: { x: 0, y: 0 },
});
assert.equal(isolatedB.session.getState().status, 'idle');
assert.equal(isolatedB.draftStore.getSnapshot().operationId, null);
isolatedA.session.cancel();

assert.throws(() => environment().session.begin({
  operationId: 'bad-fit', entityId: 'point-1', constraint: { kind: 'axis', axis: 'X' },
  projection: 'XY', fit: { scale: 0 }, startScreenPoint: { x: 0, y: 0 },
}), /positive scale/);
assert.throws(() => environment().session.begin({
  operationId: 'bad-projection', entityId: 'point-1', constraint: { kind: 'axis', axis: 'X' },
  projection: 'PERSPECTIVE', fit, startScreenPoint: { x: 0, y: 0 },
}), /does not support/);

console.log('engineering SVG interaction session: ok');
