import assert from 'node:assert/strict';
import {
  createEngineeringRevisionToken,
  createEngineeringScene,
  createEngineeringSceneEntity,
  createSegmentGeometry,
} from '../core/engineering-scene/index.js';
import { createEngineeringSvgDraftStore } from '../core/engineering-svg/edit-runtime.js';
import {
  composeEngineeringSvgDraftScene,
  engineeringSvgOverlayEntityId,
} from '../core/engineering-svg/overlay-runtime.js';

const revision = createEngineeringRevisionToken('rotation-r1');
const original = createSegmentGeometry(
  { x: -5, y: 0, z: 0 },
  { x: 5, y: 0, z: 0 },
);
const rotated = createSegmentGeometry(
  { x: 0, y: -5, z: 0 },
  { x: 0, y: 5, z: 0 },
);
const scene = createEngineeringScene({
  sceneId: 'same-centroid-shape-change',
  revision,
  entities: [createEngineeringSceneEntity({
    id: 'segment-1',
    kind: 'segment',
    geometry: original,
    domainRef: { owner: 'synthetic', id: 'segment-1' },
  })],
});
const draftStore = createEngineeringSvgDraftStore();
draftStore.begin({ operationId: 'rotate-1', baseRevision: revision });
draftStore.stageGeometry('segment-1', { original, draft: rotated });
const composed = composeEngineeringSvgDraftScene(scene, draftStore.getSnapshot());
const find = (type) => composed.entities.find((entity) => (
  entity.id === engineeringSvgOverlayEntityId(type, 'segment-1')
));
assert.ok(find('ghost'), 'shape change must retain original ghost geometry');
assert.ok(find('draft'), 'shape change must expose draft geometry');
assert.equal(find('difference'), undefined, 'equal centroids must not create a zero-length displacement vector');

console.log('engineering SVG overlay zero-centroid shape change: ok');
