import assert from 'node:assert/strict';
import {
  createEngineeringRevisionToken,
  createEngineeringScene,
  createEngineeringSceneEntity,
  createPointGeometry,
  createPolylineGeometry,
  createSegmentGeometry,
} from '../core/engineering-scene/index.js';
import { createEngineeringSvgDraftStore } from '../core/engineering-svg/edit-runtime.js';
import {
  composeEngineeringSvgDraftScene,
  engineeringGeometryCentroid,
  engineeringSvgOverlayEntityId,
} from '../core/engineering-svg/overlay-runtime.js';
import {
  applyEngineeringPrecisionExpression,
  createEngineeringSvgPrecisionMovement,
  parseEngineeringPrecisionExpression,
} from '../core/engineering-svg/precision-runtime.js';

const absolutePoint = applyEngineeringPrecisionExpression(
  { x: 1, y: 2, z: 3 },
  ['X', 'Y', 'Z'],
  parseEngineeringPrecisionExpression('10.125,-20.25,30.5', { unit: 'mm' }),
);
assert.deepEqual(absolutePoint, {
  schema: 'EngineeringPoint3D.v1', x: 10.125, y: -20.25, z: 30.5,
});
const relativePoint = applyEngineeringPrecisionExpression(
  { x: 1, y: 2, z: 3 },
  ['Y', 'Z'],
  parseEngineeringPrecisionExpression('@0.125,-0.25'),
);
assert.deepEqual(relativePoint, {
  schema: 'EngineeringPoint3D.v1', x: 1, y: 2.125, z: 2.75,
});

const segment = createSegmentGeometry(
  { x: 0, y: 0, z: 0 },
  { x: 10, y: 0, z: 0 },
);
const segmentMove = createEngineeringSvgPrecisionMovement({
  geometry: segment,
  axes: ['X'],
  expression: parseEngineeringPrecisionExpression('25', { unit: 'mm' }),
  unit: 'mm',
});
assert.deepEqual(segmentMove.beforeCentroid, {
  schema: 'EngineeringPoint3D.v1', x: 5, y: 0, z: 0,
});
assert.deepEqual(segmentMove.targetCentroid, {
  schema: 'EngineeringPoint3D.v1', x: 25, y: 0, z: 0,
});
assert.deepEqual(segmentMove.delta, { x: 20, y: 0, z: 0 });
assert.deepEqual(segmentMove.draftGeometry.start, {
  schema: 'EngineeringPoint3D.v1', x: 20, y: 0, z: 0,
});
assert.deepEqual(segmentMove.draftGeometry.end, {
  schema: 'EngineeringPoint3D.v1', x: 30, y: 0, z: 0,
});
assert.equal(segmentMove.draftGeometry.end.x - segmentMove.draftGeometry.start.x, 10, 'segment shape must be preserved');

const polyline = createPolylineGeometry([
  { x: 0, y: 0, z: 0 },
  { x: 5, y: 0, z: 0 },
  { x: 5, y: 5, z: 0 },
]);
const polylineMove = createEngineeringSvgPrecisionMovement({
  geometry: polyline,
  axes: ['Y', 'Z'],
  expression: parseEngineeringPrecisionExpression('@2.5,-1.25', { unit: 'mm' }),
  unit: 'mm',
});
assert.deepEqual(polylineMove.delta, { x: 0, y: 2.5, z: -1.25 });
assert.deepEqual(polylineMove.draftGeometry.points.map(({ x, y, z }) => ({ x, y, z })), [
  { x: 0, y: 2.5, z: -1.25 },
  { x: 5, y: 2.5, z: -1.25 },
  { x: 5, y: 7.5, z: -1.25 },
]);
assert.deepEqual(engineeringGeometryCentroid(polylineMove.draftGeometry), polylineMove.targetCentroid);
assert.deepEqual(JSON.parse(JSON.stringify(polylineMove)), polylineMove);

assert.throws(() => createEngineeringSvgPrecisionMovement({
  geometry: segment,
  axes: ['X'],
  expression: parseEngineeringPrecisionExpression('1', { unit: 'm' }),
  unit: 'mm',
}), /does not match geometry unit/);
assert.throws(() => applyEngineeringPrecisionExpression(
  { x: 0, y: 0, z: 0 }, ['X', 'X'], parseEngineeringPrecisionExpression('1,2'),
), /axes must be unique/);

const revision = createEngineeringRevisionToken('precision-r1');
const scene = createEngineeringScene({
  sceneId: 'precision-overlay',
  revision,
  entities: [createEngineeringSceneEntity({
    id: 'segment-1', kind: 'segment', geometry: segment,
    domainRef: { owner: 'synthetic', id: 'segment-1' },
  })],
});
const draftStore = createEngineeringSvgDraftStore();
draftStore.begin({ operationId: 'precision-stage', baseRevision: revision });
draftStore.stageGeometry('segment-1', {
  original: segmentMove.originalGeometry,
  draft: segmentMove.draftGeometry,
  constraint: { kind: 'axis', axis: 'X' },
});
const overlay = composeEngineeringSvgDraftScene(scene, draftStore.getSnapshot());
const overlayDraft = overlay.entities.find((entity) => (
  entity.id === engineeringSvgOverlayEntityId('draft', 'segment-1')
));
assert.deepEqual(overlayDraft.geometry, segmentMove.draftGeometry);
assert.deepEqual(scene.entities[0].geometry, segment, 'precision staging must not mutate authoritative geometry');

console.log('engineering SVG precision geometry: ok');
