import assert from 'node:assert/strict';
import {
  createEngineeringRevisionToken,
  createEngineeringScene,
  createEngineeringSceneEntity,
  createPointGeometry,
} from '../core/engineering-scene/index.js';
import {
  ENGINEERING_SVG_SNAP_ERROR_MODE,
  acquireEngineeringSvgSnap,
  composeEngineeringSvgSnapPoint,
  createEngineeringSvgSnapProvider,
} from '../core/engineering-svg/snap-runtime.js';

const scene = createEngineeringScene({
  sceneId: 'snap-scene',
  revision: createEngineeringRevisionToken('snap-r1'),
  entities: [createEngineeringSceneEntity({
    id: 'point-a', kind: 'point', geometry: createPointGeometry({ x: 5, y: 6, z: 7 }),
    domainRef: { owner: 'synthetic', id: 'point-a' },
  })],
});
const before = JSON.parse(JSON.stringify(scene));
const fit = { scale: 2, offsetX: 0, offsetY: 0 };
let requestWasFrozen = false;

function provider(id, candidates) {
  return createEngineeringSvgSnapProvider({
    id,
    provide(request) {
      requestWasFrozen = requestWasFrozen || Object.isFrozen(request) && Object.isFrozen(request.scene);
      assert.throws(() => request.scene.entities.push('mutation'), TypeError);
      return { candidates };
    },
  });
}

const endpointProvider = provider('endpoint-provider', [{
  id: 'endpoint:a', mode: 'endpoint', sourceEntityIds: ['point-a'],
  worldPoint: { x: 5, y: 6, z: 7 }, screenPoint: { x: 10, y: 10 },
  screenDistance: 999, priority: 0, lockedAxes: { x: true, y: true }, label: 'Endpoint',
}]);
const midpointProvider = provider('midpoint-provider', [{
  id: 'midpoint:a-b', mode: 'midpoint', sourceEntityIds: ['segment-a'],
  worldPoint: { x: 4, y: 5, z: 6 }, screenPoint: { x: 9, y: 10 },
  screenDistance: 0, priority: 3, lockedAxes: { x: true, y: true }, label: 'Midpoint',
}]);
const projectionProvider = provider('projection-provider', [{
  id: 'projection:a-b', mode: 'projection', sourceEntityIds: ['segment-a'],
  worldPoint: { x: 4.5, y: 5.5, z: 6.5 }, screenPoint: { x: 9.5, y: 10 },
  screenDistance: 0, priority: 5, lockedAxes: { x: true, y: true }, label: 'Projection',
}]);
const intersectionProvider = provider('intersection-provider', [{
  id: 'intersection:a-b', mode: 'intersection', sourceEntityIds: ['segment-a', 'segment-b'],
  worldPoint: { x: 6, y: 6, z: 7 }, screenPoint: { x: 11, y: 10 },
  screenDistance: 0, priority: 1, lockedAxes: { x: true, y: true }, label: 'Intersection',
}]);

const common = {
  scene,
  projection: 'XY',
  fit,
  rawScreenPoint: { x: 10, y: 10 },
  rawWorldPoint: { x: 1, y: 2, z: 3 },
  aperture: 4,
  constraint: { kind: 'plane', axes: ['X', 'Y'] },
};
const acquisition = await acquireEngineeringSvgSnap({
  ...common,
  providers: [projectionProvider, endpointProvider, intersectionProvider, midpointProvider],
});
assert.equal(requestWasFrozen, true);
assert.equal(acquisition.candidate.id, 'endpoint:a', 'endpoint priority must beat closer lower-priority modes');
assert.equal(acquisition.candidate.screenDistance, 0, 'core must recalculate provider screen distance');
assert.deepEqual(acquisition.acquiredWorldPoint, { schema: 'EngineeringPoint3D.v1', x: 5, y: 6, z: 7 });
assert.deepEqual(acquisition.evidence.providerCounts, {
  'endpoint-provider': 1,
  'intersection-provider': 1,
  'midpoint-provider': 1,
  'projection-provider': 1,
});
assert.deepEqual(JSON.parse(JSON.stringify(scene)), before, 'providers must not mutate the source scene');
assert.deepEqual(composeEngineeringSvgSnapPoint({ x: 100, y: 200, z: 300 }, acquisition), {
  schema: 'EngineeringPoint3D.v1', x: 5, y: 6, z: 300,
});

const reversed = await acquireEngineeringSvgSnap({
  ...common,
  providers: [midpointProvider, intersectionProvider, endpointProvider, projectionProvider],
});
assert.equal(JSON.stringify(reversed), JSON.stringify(acquisition), 'provider order must not affect acquisition');

const filtered = await acquireEngineeringSvgSnap({
  ...common,
  providers: [endpointProvider, midpointProvider],
  enabledModes: ['midpoint'],
});
assert.equal(filtered.candidate.id, 'midpoint:a-b');
const excluded = await acquireEngineeringSvgSnap({
  ...common,
  providers: [endpointProvider],
  excludeSourceEntityIds: ['point-a'],
});
assert.equal(excluded.candidate, null);
assert.deepEqual(excluded.acquiredWorldPoint, excluded.rawWorldPoint);

const failingProvider = createEngineeringSvgSnapProvider({
  id: 'failing-provider',
  provide() { throw new Error('synthetic provider failure'); },
});
await assert.rejects(() => acquireEngineeringSvgSnap({
  ...common, providers: [endpointProvider, failingProvider],
}), /synthetic provider failure/);
const isolated = await acquireEngineeringSvgSnap({
  ...common,
  providers: [failingProvider, endpointProvider],
  errorMode: ENGINEERING_SVG_SNAP_ERROR_MODE.ISOLATE,
});
assert.equal(isolated.candidate.id, 'endpoint:a');
assert.deepEqual(isolated.evidence.providerErrors, [{
  providerId: 'failing-provider', message: 'synthetic provider failure',
}]);

const pathProvider = provider('path-provider', [{
  id: 'path-projection', mode: 'projection', sourceEntityIds: ['route-1'],
  worldPoint: { x: 3, y: 4, z: 5 }, screenPoint: { x: 10, y: 10 },
  screenDistance: 0, priority: 5, lockedAxes: { x: true, y: true, z: true },
  compatibleConstraintKinds: ['path'], compatibleReferenceIds: ['route-1'],
}]);
const pathAcquisition = await acquireEngineeringSvgSnap({
  ...common,
  providers: [pathProvider],
  constraint: { kind: 'path', referenceId: 'route-1' },
});
assert.equal(pathAcquisition.candidate.id, 'path-projection');
const wrongPath = await acquireEngineeringSvgSnap({
  ...common,
  providers: [pathProvider],
  constraint: { kind: 'path', referenceId: 'route-2' },
});
assert.equal(wrongPath.candidate, null);

console.log('engineering SVG snap acquisition: ok');
