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
import { createEngineeringSvgSnapProvider } from '../core/engineering-svg/snap-runtime.js';

const revisionA = createEngineeringRevisionToken('snap-interaction-r1');
const revisionB = createEngineeringRevisionToken('snap-interaction-r2');
const scene = createEngineeringScene({
  sceneId: 'snap-interaction',
  revision: revisionA,
  entities: [createEngineeringSceneEntity({
    id: 'moving-point', kind: 'point', geometry: createPointGeometry({ x: 0, y: 0, z: 0 }),
    domainRef: { owner: 'synthetic', id: 'moving-point' },
  })],
});
const fit = { scale: 2, offsetX: 0, offsetY: 0 };

function sessionWithProvider(provider) {
  const draftStore = createEngineeringSvgDraftStore();
  let calls = 0;
  let intent = null;
  const gateway = createEngineeringSvgCommandGateway({
    getCurrentRevision: () => revisionA,
    execute: async (value) => {
      calls += 1;
      intent = value;
      return createEngineeringCommandResult({
        operationId: value.operationId,
        status: 'committed',
        resultingRevision: revisionB,
      });
    },
  });
  const coordinator = createEngineeringSvgEditCoordinator({ commandGateway: gateway, draftStore });
  const session = createEngineeringSvgInteractionSession({
    getScene: () => scene,
    editCoordinator: coordinator,
    snapProviders: [provider],
    aperture: 12,
  });
  return { session, draftStore, calls: () => calls, intent: () => intent };
}

const axisProvider = createEngineeringSvgSnapProvider({
  id: 'axis-target-provider',
  provide: () => [{
    id: 'axis-target', mode: 'endpoint', sourceEntityIds: ['target-point'],
    worldPoint: { x: 12, y: 99, z: 99 }, screenPoint: { x: 20, y: 0 },
    screenDistance: 999, priority: 0, lockedAxes: { x: true },
  }],
});
const axis = sessionWithProvider(axisProvider);
axis.session.begin({
  operationId: 'snap-axis', entityId: 'moving-point', constraint: { kind: 'axis', axis: 'X' },
  projection: 'XY', fit, startScreenPoint: { x: 0, y: 0 },
});
const axisPreview = await axis.session.preview({ currentScreenPoint: { x: 20, y: 0 } });
assert.equal(axisPreview.acquisition.candidate.id, 'axis-target');
assert.deepEqual(axisPreview.solution.worldDelta, { x: 10, y: 0, z: 0 });
assert.deepEqual(axisPreview.draftGeometry.position, {
  schema: 'EngineeringPoint3D.v1', x: 12, y: 0, z: 0,
}, 'snap must replace only the candidate-locked X axis');
assert.equal(axis.calls(), 0);
const repeated = await axis.session.preview({ currentScreenPoint: { x: 20, y: 0 } });
assert.equal(JSON.stringify(repeated), JSON.stringify(axisPreview));
await axis.session.commit();
assert.equal(axis.calls(), 1);
assert.deepEqual(axis.intent().changes.geometry.draft, axisPreview.draftGeometry);
assert.equal(axis.intent().changes.geometry.acquisition.candidate.id, 'axis-target');

const disabled = sessionWithProvider(axisProvider);
disabled.session.begin({
  operationId: 'snap-disabled', entityId: 'moving-point', constraint: { kind: 'axis', axis: 'X' },
  projection: 'XY', fit, startScreenPoint: { x: 0, y: 0 },
});
const disabledPreview = await disabled.session.preview({
  currentScreenPoint: { x: 20, y: 0 }, snapEnabled: false,
});
assert.equal(disabledPreview.acquisition, null);
assert.equal(disabledPreview.draftGeometry.position.x, 10);
disabled.session.cancel();

const planeProvider = createEngineeringSvgSnapProvider({
  id: 'plane-target-provider',
  provide: () => [{
    id: 'plane-target', mode: 'intersection', sourceEntityIds: ['target-a', 'target-b'],
    worldPoint: { x: 999, y: 8, z: 999 }, screenPoint: { x: 20, y: -10 },
    screenDistance: 0, priority: 1, lockedAxes: { y: true },
  }],
});
const plane = sessionWithProvider(planeProvider);
plane.session.begin({
  operationId: 'snap-plane', entityId: 'moving-point', constraint: { kind: 'plane', axes: ['X', 'Y'] },
  projection: 'XY', fit, startScreenPoint: { x: 0, y: 0 },
});
const planePreview = await plane.session.preview({ currentScreenPoint: { x: 20, y: -10 } });
assert.deepEqual(planePreview.solution.worldDelta, { x: 10, y: 5, z: 0 });
assert.deepEqual(planePreview.draftGeometry.position, {
  schema: 'EngineeringPoint3D.v1', x: 10, y: 8, z: 0,
}, 'snap must preserve raw X/Z and replace only locked Y');
plane.session.cancel();

const selfProvider = createEngineeringSvgSnapProvider({
  id: 'self-provider',
  provide: () => [{
    id: 'self-target', mode: 'endpoint', sourceEntityIds: ['moving-point'],
    worldPoint: { x: 50, y: 0, z: 0 }, screenPoint: { x: 20, y: 0 },
    screenDistance: 0, priority: 0, lockedAxes: { x: true },
  }],
});
const self = sessionWithProvider(selfProvider);
self.session.begin({
  operationId: 'self-filter', entityId: 'moving-point', constraint: { kind: 'axis', axis: 'X' },
  projection: 'XY', fit, startScreenPoint: { x: 0, y: 0 },
});
const selfPreview = await self.session.preview({ currentScreenPoint: { x: 20, y: 0 } });
assert.equal(selfPreview.acquisition.candidate, null, 'moving entity must be excluded by default');
assert.equal(selfPreview.draftGeometry.position.x, 10);
self.session.cancel();

console.log('engineering SVG interaction snap: ok');
