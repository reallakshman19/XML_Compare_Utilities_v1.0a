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
  ENGINEERING_SVG_OVERLAY_MODE,
  composeEngineeringSvgDraftScene,
  engineeringGeometryCentroid,
  engineeringSvgOverlayEntityId,
} from '../core/engineering-svg/overlay-runtime.js';
import { buildEngineeringSvgProjectedScene } from '../core/engineering-svg/index.js';

const revision = createEngineeringRevisionToken({ geometry: 7, properties: 2 });
function entity(id, geometry, renderOrder = 0) {
  return createEngineeringSceneEntity({
    id,
    kind: geometry.kind,
    domainType: `SYNTHETIC_${geometry.kind.toUpperCase()}`,
    geometry,
    domainRef: { owner: 'synthetic', id },
    propertySetIds: [],
    editCapabilities: ['move'],
    renderOrder,
  });
}

const pointGeometry = createPointGeometry({ x: 0, y: 0, z: 0 });
const segmentGeometry = createSegmentGeometry({ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 });
const polylineGeometry = createPolylineGeometry([
  { x: 0, y: 0, z: 0 },
  { x: 0, y: 6, z: 0 },
  { x: 0, y: 6, z: 3 },
]);
const removedGeometry = createPointGeometry({ x: 20, y: 0, z: 0 });
const unchangedGeometry = createPointGeometry({ x: 30, y: 0, z: 0 });
const sourceScene = createEngineeringScene({
  sceneId: 'overlay-scene',
  revision,
  entities: [
    entity('point-1', pointGeometry, 1),
    entity('segment-1', segmentGeometry, 2),
    entity('polyline-1', polylineGeometry, 3),
    entity('removed-1', removedGeometry, 4),
    entity('unchanged-1', unchangedGeometry, 5),
  ],
});
const sourceBefore = JSON.parse(JSON.stringify(sourceScene));

assert.deepEqual(engineeringGeometryCentroid(segmentGeometry), {
  schema: 'EngineeringPoint3D.v1', x: 5, y: 0, z: 0,
});
assert.deepEqual(engineeringGeometryCentroid(polylineGeometry), {
  schema: 'EngineeringPoint3D.v1', x: 0, y: 4, z: 1,
});

const draftStore = createEngineeringSvgDraftStore();
draftStore.begin({ operationId: 'overlay-1', baseRevision: revision });
draftStore.stageGeometry('point-1', {
  original: pointGeometry,
  draft: createPointGeometry({ x: 10, y: 0, z: 0 }),
});
draftStore.stageGeometry('segment-1', {
  original: segmentGeometry,
  draft: createSegmentGeometry({ x: 0, y: 5, z: 0 }, { x: 10, y: 5, z: 0 }),
});
draftStore.stageGeometry('polyline-1', {
  original: polylineGeometry,
  draft: polylineGeometry,
});
draftStore.stageGeometry('removed-1', { original: removedGeometry, draft: null });
draftStore.stageGeometry('added-1', {
  original: null,
  draft: createPointGeometry({ x: 40, y: 0, z: 0 }),
  entity: entity('added-1', createPointGeometry({ x: 40, y: 0, z: 0 }), 6),
});
const draft = draftStore.getSnapshot();
const draftBefore = JSON.parse(JSON.stringify(draft));

function byId(scene, id) {
  return scene.entities.find((value) => value.id === id) || null;
}

const comparison = composeEngineeringSvgDraftScene(
  sourceScene,
  draft,
  ENGINEERING_SVG_OVERLAY_MODE.ORIGINAL_AND_DRAFT,
);
const pointGhostId = engineeringSvgOverlayEntityId('ghost', 'point-1');
const pointDraftId = engineeringSvgOverlayEntityId('draft', 'point-1');
const pointDifferenceId = engineeringSvgOverlayEntityId('difference', 'point-1');
assert.equal(byId(comparison, 'point-1').visible, false);
assert.equal(byId(comparison, 'unchanged-1').visible, true);
assert.equal(byId(comparison, pointGhostId).layer, 'ghost');
assert.equal(byId(comparison, pointDraftId).layer, 'draft');
assert.equal(byId(comparison, pointDifferenceId).layer, 'difference');
assert.deepEqual(byId(comparison, pointDifferenceId).metadata.engineeringSvgOverlay.delta, { x: 10, y: 0, z: 0 });
assert.equal(byId(comparison, pointDifferenceId).metadata.engineeringSvgOverlay.magnitude, 10);
assert.ok(byId(comparison, engineeringSvgOverlayEntityId('ghost', 'removed-1')));
assert.equal(byId(comparison, engineeringSvgOverlayEntityId('draft', 'removed-1')), null);
assert.ok(byId(comparison, engineeringSvgOverlayEntityId('draft', 'added-1')));
assert.equal(byId(comparison, engineeringSvgOverlayEntityId('difference', 'polyline-1')), null);
assert.deepEqual(JSON.parse(JSON.stringify(sourceScene)), sourceBefore, 'source scene must remain immutable');
assert.deepEqual(JSON.parse(JSON.stringify(draft)), draftBefore, 'draft snapshot must remain immutable');
assert.equal(
  JSON.stringify(composeEngineeringSvgDraftScene(sourceScene, draft, 'original-and-draft')),
  JSON.stringify(comparison),
  'repeated composition must be deterministic',
);

const draftOnly = composeEngineeringSvgDraftScene(sourceScene, draft, 'draft-only');
assert.equal(byId(draftOnly, 'point-1').visible, false);
assert.ok(byId(draftOnly, pointDraftId));
assert.equal(byId(draftOnly, pointGhostId), null);
assert.equal(byId(draftOnly, pointDifferenceId), null);
assert.equal(byId(draftOnly, 'removed-1').visible, false);
assert.equal(byId(draftOnly, 'unchanged-1').visible, true);

const differencesOnly = composeEngineeringSvgDraftScene(sourceScene, draft, 'differences-only');
assert.equal(byId(differencesOnly, 'unchanged-1').visible, false);
assert.ok(byId(differencesOnly, pointGhostId));
assert.ok(byId(differencesOnly, pointDraftId));
assert.ok(byId(differencesOnly, pointDifferenceId));

const authoritativeOnly = composeEngineeringSvgDraftScene(sourceScene, draft, 'authoritative-only');
assert.equal(authoritativeOnly.entities.filter((value) => value.id.startsWith('@esvg/overlay/')).length, 0);
assert.equal(authoritativeOnly.entities.every((value) => value.visible), true);

const projected = buildEngineeringSvgProjectedScene(comparison, {
  projection: 'XY', viewport: { width: 800, height: 400 }, padding: 20,
});
const visiblePointLayers = projected.entities
  .filter((value) => value.id.includes(encodeURIComponent('point-1')))
  .map((value) => value.layer);
assert.deepEqual(visiblePointLayers, ['ghost', 'draft', 'difference']);

const staleDraft = { ...draft, baseRevision: createEngineeringRevisionToken('stale') };
assert.throws(() => composeEngineeringSvgDraftScene(sourceScene, staleDraft), /base revision/);
const collisionScene = createEngineeringScene({
  sceneId: 'collision', revision,
  entities: [entity('point-1', pointGeometry), entity(pointDraftId, unchangedGeometry)],
});
const collisionDraft = {
  ...draft,
  geometry: { 'point-1': draft.geometry['point-1'] },
};
assert.throws(() => composeEngineeringSvgDraftScene(collisionScene, collisionDraft), /ID collision/);

console.log('engineering SVG overlay scene: ok');
