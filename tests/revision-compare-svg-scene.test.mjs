import assert from 'node:assert/strict';
import {
  createRevisionCompareEngineeringSvgScene,
  createRevisionCompareSvgFitScene,
  createRevisionCompareSvgPaneScene,
  revisionCompareSvgSceneCompatibilityKey,
} from '../tabs/revision-compare/revision-compare-engineering-svg-scene.js';
import { REVISION_COMPARE_SVG_STATUS_STYLES } from '../tabs/revision-compare/revision-compare-svg-styles.js';

function model(side, count = 1) {
  return {
    modelId: `model:${side}`,
    revisionId: `revision:${side}`,
    documentId: `document:${side}`,
    unit: 'mm', coordinateFrame: 'PLANT', verticalAxis: 'Z',
    segments: Array.from({ length: count }, (_, index) => ({
      objectId: `${side}:segment:${index}`,
      start: [index, 0, 0], end: [index + 1, 0, 0],
    })),
    markers: [{ objectId: `${side}:marker`, position: [0, 1, 0] }],
  };
}

const models = { source: model('A', 2), target: model('B', 2) };
const statuses = {
  'A:segment:0': 'MATCHED_UNCHANGED', 'A:segment:1': 'PROPERTY_CHANGED', 'A:marker': 'AMBIGUOUS',
  'B:segment:0': 'GEOMETRY_CHANGED', 'B:segment:1': 'NEW_IN_TARGET', 'B:marker': 'MISSING_IN_TARGET',
};
const first = createRevisionCompareEngineeringSvgScene({ models, statusByObjectId: statuses });
const second = createRevisionCompareEngineeringSvgScene({ models: structuredClone(models), statusByObjectId: statuses });
assert.deepEqual(first, second, 'projection must be deterministic');
assert(Object.isFrozen(first));
assert(Object.isFrozen(first.scene));
assert.doesNotThrow(() => JSON.stringify(first));
assert.equal(first.scene.entities.length, 6);
assert.deepEqual(first.scene.entities.map((entity) => entity.id), [
  'A:segment:0', 'A:segment:1', 'A:marker', 'B:segment:0', 'B:segment:1', 'B:marker',
]);
assert.equal(first.scene.entities[0].domainRef.side, 'A');
assert.equal(first.scene.entities.at(-1).domainRef.side, 'B');
assert.deepEqual(first.scene.entities[0].geometry.start, { schema: 'EngineeringPoint3D.v1', x: 0, y: 0, z: 0 });
assert.match(revisionCompareSvgSceneCompatibilityKey(first.scene), /^revision-compare:model:A:model:B:/);

const selectedFit = createRevisionCompareSvgFitScene(first.scene, ['B:segment:1']);
assert.equal(selectedFit.entities.find((entity) => entity.id === 'B:segment:1').contributesToFit, true);
assert.equal(selectedFit.entities.find((entity) => entity.id === 'A:segment:0').contributesToFit, false);

const sourcePane = createRevisionCompareSvgPaneScene(first.scene, 'A');
const targetPane = createRevisionCompareSvgPaneScene(first.scene, 'B');
assert.equal(sourcePane.entities.length, first.scene.entities.length);
assert.equal(targetPane.entities.length, first.scene.entities.length);
for (const entity of first.scene.entities) {
  const sourceEntity = sourcePane.entities.find((item) => item.id === entity.id);
  const targetEntity = targetPane.entities.find((item) => item.id === entity.id);
  assert.deepEqual(sourceEntity.geometry, entity.geometry, 'source pane must preserve engineering coordinates');
  assert.deepEqual(targetEntity.geometry, entity.geometry, 'target pane must preserve engineering coordinates');
  assert.equal(sourceEntity.selectable, entity.domainRef.side === 'A');
  assert.equal(targetEntity.selectable, entity.domainRef.side === 'B');
  assert.equal(Boolean(sourceEntity.metadata.revisionCompare.hiddenFitAuthority), entity.domainRef.side === 'B');
  assert.equal(Boolean(targetEntity.metadata.revisionCompare.hiddenFitAuthority), entity.domainRef.side === 'A');
}

const missing = createRevisionCompareEngineeringSvgScene({
  models: { source: { ...model('A'), segments: [{ objectId: 'bad', start: null, end: [1, 2, 3] }] }, target: model('B') },
});
assert.equal(missing.omissions.length, 1);
assert.equal(missing.scene.entities.some((entity) => entity.id === 'bad'), false);

const signatures = Object.values(REVISION_COMPARE_SVG_STATUS_STYLES).map((style) =>
  [style.dash, style.opacity, style.lineWeight, style.markerTreatment].join('|'));
assert.equal(Object.keys(REVISION_COMPARE_SVG_STATUS_STYLES).length, 10);
assert.equal(new Set(signatures.slice(0, 6)).size, 6, 'six production statuses must be non-color distinguishable');

const large = createRevisionCompareEngineeringSvgScene({
  models: { source: { ...model('A', 2500), markers: [] }, target: { ...model('B', 2500), markers: [] } },
});
assert.equal(large.scene.entities.length, 5000);
const largeA = createRevisionCompareSvgPaneScene(large.scene, 'A');
const largeB = createRevisionCompareSvgPaneScene(large.scene, 'B');
assert.equal(largeA.entities.filter((entity) => entity.selectable).length, 2500);
assert.equal(largeB.entities.filter((entity) => entity.selectable).length, 2500);
assert.equal(largeA.entities.filter((entity) => entity.metadata.revisionCompare.hiddenFitAuthority).length, 2500);
assert.equal(largeB.entities.filter((entity) => entity.metadata.revisionCompare.hiddenFitAuthority).length, 2500);
assert.equal(large.scene.revision.value.sourceModelId, 'model:A');
assert.equal(JSON.stringify(large.scene.revision).includes('milliseconds'), false);
console.log('revision-compare-svg-scene.test.mjs passed');
