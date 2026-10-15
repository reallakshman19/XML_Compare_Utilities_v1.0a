import assert from 'node:assert/strict';
import {
  createEngineeringRevisionToken,
  createEngineeringScene,
  createEngineeringSceneEntity,
  createPointGeometry,
  createSegmentGeometry,
} from '../core/engineering-scene/index.js';
import {
  createEngineeringSvgSceneSource,
  exportEngineeringSvg,
} from '../core/engineering-svg/index.js';

function scene(revisionValue, includePoint = true) {
  const entities = [createEngineeringSceneEntity({
    id: 'segment-1',
    kind: 'segment',
    geometry: createSegmentGeometry({ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }),
    domainRef: { owner: 'synthetic', id: 'segment-1' },
  })];
  if (includePoint) entities.push(createEngineeringSceneEntity({
    id: 'point-1',
    kind: 'point',
    renderOrder: 5,
    geometry: createPointGeometry({ x: 50, y: 0, z: 25 }),
    domainRef: { owner: 'synthetic', id: 'point-1' },
  }));
  return createEngineeringScene({
    sceneId: 'synthetic-export',
    revision: createEngineeringRevisionToken(revisionValue),
    entities,
  });
}

const first = scene('r1');
const second = scene('r2', false);
const source = createEngineeringSvgSceneSource(first);
let event = null;
const unsubscribe = source.subscribe((next) => { event = next; });
assert.equal(source.listenerCount(), 1);
source.setSnapshot(second, 'remove-point');
assert.equal(event.reason, 'remove-point');
assert.equal(event.scene, second);
unsubscribe();
assert.equal(source.listenerCount(), 0);

const options = { projection: 'ISO', viewport: { width: 600, height: 360 }, padding: 20 };
const exportedA = exportEngineeringSvg(first, options);
const exportedB = exportEngineeringSvg(first, options);
assert.equal(exportedA, exportedB);
assert.match(exportedA, /data-engineering-svg-scene-id="synthetic-export"/);
assert.match(exportedA, /data-engineering-svg-projection="ISO"/);
assert.match(exportedA, /data-engineering-svg-entity-id="segment-1"/);
assert.match(exportedA, /data-engineering-svg-entity-id="point-1"/);

assert.equal(source.dispose(), true);
assert.equal(source.dispose(), false);
assert.throws(() => source.getSnapshot(), /disposed/);

console.log('engineering SVG source and export: ok');
