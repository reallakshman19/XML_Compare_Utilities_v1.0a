import assert from 'node:assert/strict';
import { runEngineeringSvgAdapterConformance } from '../core/engineering-svg/engineering-svg-adapter-conformance.js';
import { createRevisionCompareEngineeringSvgAdapter } from '../tabs/revision-compare/revision-compare-engineering-svg-adapter.js';

function model(side, count = 2) {
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

function differenceRow(differenceId, sourceObjectId, targetObjectId, propertyKey, revAValue, revBValue) {
  return {
    differenceId,
    visualRefs: { sourceObjectId, targetObjectId },
    changedProperties: [{
      propertyKey,
      revAValue, revBValue,
      revAEvidencePath: sourceObjectId ? `revA:${sourceObjectId}:${propertyKey}` : null,
      revBEvidencePath: targetObjectId ? `revB:${targetObjectId}:${propertyKey}` : null,
    }],
  };
}

function buildAudit() {
  return {
    visualModels: {
      revA: model('A'),
      revB: model('B'),
      statusByObjectId: {
        'A:segment:0': 'MATCHED_UNCHANGED', 'A:segment:1': 'PROPERTY_CHANGED', 'A:marker': 'AMBIGUOUS',
        'B:segment:0': 'GEOMETRY_CHANGED', 'B:segment:1': 'NEW_IN_TARGET', 'B:marker': 'MISSING_IN_TARGET',
      },
    },
    differenceRows: [
      differenceRow('diff:segment:0', 'A:segment:0', 'B:segment:0', 'diameter', 10, 12),
      differenceRow('diff:segment:1', 'A:segment:1', 'B:segment:1', 'length', 5, 5.5),
      differenceRow('diff:marker', 'A:marker', 'B:marker', 'elevation', 100, 105),
    ],
  };
}

let audit = buildAudit();
const listeners = new Set();

function getAudit() { return audit; }
function subscribeAudit(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const source = createRevisionCompareEngineeringSvgAdapter({ adapterId: 'revision-compare-overlay-fixture', getAudit, subscribeAudit });

const firstScene = await source.adapter.getScene();
assert.equal(firstScene.entities.length, 6);
assert.equal(firstScene.capabilities.editable, false);
assert(firstScene.entities.every((entity) => entity.selectable));

let received = null;
const unsubscribe = source.adapter.subscribeScene((event) => { received = event; });
audit = buildAudit();
listeners.forEach((listener) => listener({ reason: 'test-refresh' }));
assert.equal(received.type, 'sceneChanged');
assert.equal(received.reason, 'test-refresh');
unsubscribe();

const propertySets = await source.adapter.propertyProvider.getPropertySets(
  firstScene.entities.map((entity) => entity.id),
  firstScene.revision,
);
assert.equal(propertySets.length, 3);
assert.deepEqual(
  propertySets.flatMap((set) => set.ownerIds).sort(),
  ['A:marker', 'A:segment:0', 'A:segment:1', 'B:marker', 'B:segment:0', 'B:segment:1'],
);
const diameterField = propertySets.find((set) => set.id.includes('diff:segment:0')).fields[0];
assert.equal(diameterField.key, 'diameter');
assert.equal(diameterField.previousValue, 10);
assert.equal(diameterField.value, 12);

const conformance = await runEngineeringSvgAdapterConformance(source.adapter);
assert.equal(conformance.passed, true, JSON.stringify(conformance.checks.filter((check) => check.status === 'fail')));

console.log('revision-compare-engineering-svg-adapter.test.js passed');
