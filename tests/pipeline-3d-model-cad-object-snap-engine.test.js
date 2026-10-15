import assert from 'node:assert/strict';
import { PipelineCadObjectSnapMode } from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-object-snap-contracts.js';
import { acquirePipelineCadObjectSnap, composePipelineCadSnapPoint } from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-object-snap-engine.js';
import { pipelineCadSnapPointPrimitive, pipelineCadSnapSegmentPrimitive } from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-object-snap-primitives.js';

function graph(scale = 10) {
  return {
    worldToScreen: ({ x, y }) => ({ x: x * scale, y: y * scale }),
    screenToWorld: ({ x, y }) => ({ x: x / scale, y: y / scale }),
  };
}
const point = (mode, id, x, y, locks = { x: true, y: true }) => pipelineCadSnapPointPrimitive({ id, mode, sourceIds: [id], worldPoint: { x, y }, lockedAxes: locks, label: mode });
const segment = pipelineCadSnapSegmentPrimitive({ id: 's1', sourceIds: ['a', 'b'], start: { x: 0, y: 0 }, end: { x: 10, y: 0 } });
const points = [
  point('endpoint', 'a', 0, 0), point('endpoint', 'a2', 0, 0), point('station', 'station-a', 0, 0, { x: true, y: false }),
  point('marker', 'm', 3, 2, { x: true, y: false }), point('intersection', 'i', 5, 0),
];
function acquire(mode, rawScreenPoint, scale = 10, extra = {}) {
  const g = graph(scale);
  return acquirePipelineCadObjectSnap({
    graphName: 'table2x', graph: g, rawScreenPoint, rawWorldPoint: g.screenToWorld(rawScreenPoint),
    primitives: { points, segments: [segment] }, settings: { objectEnabled: true, objectAperture: 12, enabledModes: [mode] }, ...extra,
  });
}
for (const mode of Object.values(PipelineCadObjectSnapMode)) {
  const target = mode === 'marker' ? { x: 30, y: 25 }
    : mode === 'intersection' ? { x: 50, y: 2 }
      : mode === 'endpoint' || mode === 'station' ? { x: 6, y: 4 }
        : { x: 50, y: 6 };
  const result = acquire(mode, target);
  assert.equal(result.candidate?.mode, mode, `${mode} must acquire`);
}
const ranked = acquirePipelineCadObjectSnap({
  graphName: 'table2x', graph: graph(), rawScreenPoint: { x: 2, y: 1 }, rawWorldPoint: { x: 0.2, y: 0.1 },
  primitives: { points, segments: [] }, settings: { objectEnabled: true, objectAperture: 12, enabledModes: ['endpoint', 'station'] },
});
assert.equal(ranked.candidate.mode, 'endpoint', 'priority must beat equivalent station point');
assert.equal(ranked.evidence.deduplicated, 1);
assert.equal(acquire('endpoint', { x: 13, y: 0 }).candidate, null, 'outside aperture must release');
for (const scale of [2, 20]) {
  const result = acquire('endpoint', { x: 8, y: 0 }, scale);
  assert.equal(result.candidate.screenDistance, 8, 'screen aperture must remain pixel based');
}
assert.equal(acquire('endpoint', { x: 2, y: 0 }, 10, { excludeIds: ['a', 'a2'] }).candidate, null, 'dragged entity must be excluded');
const station = acquire('station', { x: 6, y: 99 });
assert.equal(station.candidate.screenDistance, 6, 'x-only station distance must ignore unlocked Y');
const composed = composePipelineCadSnapPoint({ x: 1.13, y: 2.17 }, station, { x: (x) => Math.round(x), y: (y) => Math.round(y) });
assert.equal(composed.x, 0, 'locked X must use acquired coordinate');
assert.equal(composed.y, 2, 'unlocked Y must use scalar rule');
console.log('Pipeline CAD Object Snap engine tests passed');
