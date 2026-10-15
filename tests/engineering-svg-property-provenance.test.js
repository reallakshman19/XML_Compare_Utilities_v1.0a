import assert from 'node:assert/strict';
import {
  createEngineeringEditIntent,
  createEngineeringPropertyField,
  createEngineeringPropertySet,
  createEngineeringRevisionToken,
  validateEngineeringPropertyField,
  validateEngineeringPropertySet,
} from '../core/engineering-scene/index.js';
import {
  aggregateEngineeringSvgProperties,
  createEngineeringSvgDraftStore,
  resolveEngineeringSvgPropertyField,
  validateEngineeringSvgPropertyChanges,
} from '../core/engineering-svg/edit-runtime.js';
import { buildEngineeringSvgInspectorModel } from '../core/engineering-svg/overlay-runtime.js';

const owns = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const revision = createEngineeringRevisionToken({ geometry: 2, properties: 10 });

function set(id, ownerId, fields) {
  return createEngineeringPropertySet({ id, revision, ownerIds: [ownerId], fields });
}

function view(views, key) {
  return views.find((item) => item.field.key === key);
}

function row(model, key) {
  return model.rows.find((item) => item.key === key);
}

assert.equal(createEngineeringPropertyField({ key: 'schema' }).schema, 'EngineeringPropertyField.v1');
const legacy = createEngineeringPropertyField({ key: 'legacy', type: 'text', value: 'Current' });
assert.equal(legacy.source, null);
assert.equal(owns(legacy, 'previousSource'), false);
assert.equal(JSON.stringify(legacy).includes('previousSource'), false);

const exactSource = '  file:///Plant A/Model.xml#/PIPE-1  ';
const previousExactSource = String.raw`Rev A \\server\share\model.xml`;
const sourced = createEngineeringPropertyField({
  key: 'pressure', type: 'number', value: 12, previousValue: 10,
  source: exactSource, previousSource: previousExactSource,
});
assert.equal(sourced.source, exactSource);
assert.equal(sourced.previousSource, previousExactSource);

const explicitNull = createEngineeringPropertyField({
  key: 'comment', value: 'Current', source: null, previousSource: null,
});
assert.equal(owns(explicitNull, 'previousSource'), true);
assert.equal(explicitNull.previousSource, null);
const parsedLegacy = JSON.parse(JSON.stringify(legacy));
const parsedNull = JSON.parse(JSON.stringify(explicitNull));
assert.equal(owns(parsedLegacy, 'previousSource'), false);
assert.equal(owns(parsedNull, 'previousSource'), true);
assert.equal(parsedNull.previousSource, null);

for (const [name, value] of [
  ['undefined', undefined], ['number', 1], ['boolean', true], ['array', []],
  ['object', {}], ['function', () => null], ['symbol', Symbol('source')],
]) {
  assert.throws(
    () => createEngineeringPropertyField({ key: `source-${name}`, source: value }),
    new RegExp(`source-${name}.*source must be a string or null`),
  );
  assert.throws(
    () => createEngineeringPropertyField({ key: `previous-${name}`, previousSource: value }),
    new RegExp(`previous-${name}.*previousSource must be a string or null`),
  );
}

assert.equal(validateEngineeringPropertyField(sourced), sourced);
const missingSource = { ...sourced };
delete missingSource.source;
assert.throws(
  () => validateEngineeringPropertyField(missingSource),
  /field\.source is required.*pressure/,
);
assert.throws(
  () => validateEngineeringPropertyField({ ...sourced, source: [] }),
  /field\.source must be a string or null.*pressure/,
);
assert.throws(
  () => validateEngineeringPropertyField({ ...sourced, previousSource: undefined }),
  /field\.previousSource cannot be undefined.*pressure/,
);
assert.throws(
  () => validateEngineeringPropertyField({ ...sourced, previousSource: false }),
  /field\.previousSource must be a string or null.*pressure/,
);

const preservedSet = set('preserved', 'a', [sourced, explicitNull]);
assert.equal(validateEngineeringPropertySet(preservedSet), preservedSet);
assert.equal(preservedSet.fields[0].source, exactSource);
assert.equal(preservedSet.fields[1].previousSource, null);
assert(Object.isFrozen(preservedSet.fields[0]));
assert.throws(() => {
  preservedSet.fields[0].source = 'mutated';
}, TypeError);

const invalidSet = {
  ...preservedSet,
  fields: [{ ...preservedSet.fields[0], previousSource: undefined }, preservedSet.fields[1]],
};
assert.throws(
  () => validateEngineeringPropertySet(invalidSet),
  /fields\[0\]\.previousSource cannot be undefined.*pressure/,
);

const sourceOne = set('source-one', 'x', [{ key: 'p', value: 'v', source: 'one' }]);
const sourceTwo = set('source-two', 'x', [{ key: 'p', value: 'v', source: 'two' }]);
assert.throws(
  () => resolveEngineeringSvgPropertyField([sourceOne, sourceTwo], 'p', 'x'),
  /conflicting current sources/,
);
const previousAbsent = set('previous-absent', 'x', [{ key: 'p', value: 'v', source: 'one' }]);
const previousNull = set('previous-null', 'x', [{
  key: 'p', value: 'v', source: 'one', previousSource: null,
}]);
assert.throws(
  () => resolveEngineeringSvgPropertyField([previousAbsent, previousNull], 'p', 'x'),
  /conflicting previous-source presence/,
);
const previousOne = set('previous-one', 'x', [{
  key: 'p', value: 'v', source: 'one', previousSource: 'A',
}]);
const previousTwo = set('previous-two', 'x', [{
  key: 'p', value: 'v', source: 'one', previousSource: 'B',
}]);
assert.throws(
  () => resolveEngineeringSvgPropertyField([previousOne, previousTwo], 'p', 'x'),
  /conflicting previous sources/,
);

const sets = [
  set('a-properties', 'a', [
    { key: 'none', value: 'same' },
    { key: 'uniform', value: 'same', source: 'Current/common', previousSource: 'Previous/common' },
    { key: 'mixed', value: 'same', source: 'Current/A', previousSource: 'Previous/A' },
    { key: 'unavailable', value: 'same', source: 'Current/A', previousSource: 'Previous/A' },
    { key: 'missing', value: 'same', source: 'Current/A', previousSource: 'Previous/A' },
    { key: 'previousNull', value: 'same', previousSource: null },
    { key: 'valueHistory', type: 'number', value: 12, previousValue: 10, source: 'Current/A', previousSource: 'Previous/A' },
  ]),
  set('b-properties', 'b', [
    { key: 'none', value: 'same' },
    { key: 'uniform', value: 'same', source: 'Current/common', previousSource: 'Previous/common' },
    { key: 'mixed', value: 'same', source: 'Current/B', previousSource: 'Previous/B' },
    { key: 'unavailable', value: 'same', source: null },
    { key: 'previousNull', value: 'same', previousSource: null },
    { key: 'valueHistory', type: 'number', value: 12, previousValue: 10, source: 'Current/A', previousSource: 'Previous/A' },
  ]),
];

const views = aggregateEngineeringSvgProperties(['a', 'b'], sets);
assert.equal(view(views, 'none').sourceAggregate.state, 'not-applicable');
assert.equal(view(views, 'none').sourceEvidenceCount, 0);
assert.equal(view(views, 'none').previousSourceAggregate.state, 'not-applicable');
assert.equal(view(views, 'none').previousSourceEvidenceCount, 0);
assert.equal(view(views, 'uniform').sourceAggregate.state, 'uniform');
assert.equal(view(views, 'uniform').sourceAggregate.value, 'Current/common');
assert.equal(view(views, 'uniform').sourceEvidenceCount, 2);
assert.equal(view(views, 'uniform').previousSourceAggregate.state, 'uniform');
assert.equal(view(views, 'uniform').previousSourceAggregate.value, 'Previous/common');
assert.equal(view(views, 'uniform').previousSourceEvidenceCount, 2);
assert.equal(view(views, 'mixed').sourceAggregate.state, 'mixed');
assert.equal(view(views, 'mixed').previousSourceAggregate.state, 'mixed');
assert.equal(view(views, 'unavailable').sourceAggregate.state, 'unavailable');
assert.equal(view(views, 'unavailable').sourceEvidenceCount, 1);
assert.equal(view(views, 'unavailable').previousSourceAggregate.state, 'unavailable');
assert.equal(view(views, 'unavailable').previousSourceEvidenceCount, 1);
assert.equal(view(views, 'missing').sourceAggregate.state, 'unavailable');
assert.equal(view(views, 'missing').previousSourceAggregate.state, 'unavailable');
assert.equal(view(views, 'previousNull').previousSourceAggregate.state, 'uniform');
assert.equal(view(views, 'previousNull').previousSourceAggregate.value, null);
assert.equal(view(views, 'previousNull').previousSourceEvidenceCount, 2);
assert.equal(view(views, 'valueHistory').aggregate.state, 'uniform');
assert.equal(view(views, 'valueHistory').aggregate.value, 12);
assert.equal(view(views, 'valueHistory').previousAggregate.state, 'uniform');
assert.equal(view(views, 'valueHistory').previousAggregate.value, 10);

for (const item of views) {
  assert.equal(item.field.source, null);
  assert.equal(owns(item.field, 'previousSource'), false);
  assert.equal(item.field.value, null);
  assert.equal(owns(item.field, 'previousValue'), false);
}

const clean = buildEngineeringSvgInspectorModel({ selectedIds: ['a', 'b'], propertyViews: views });
const uniformRow = row(clean, 'uniform');
assert.equal(uniformRow.schema, 'EngineeringSvgInspectorRow.v1');
assert.equal(uniformRow.sourceAuthoritative.value, 'Current/common');
assert.equal(uniformRow.previousSourceAuthoritative.value, 'Previous/common');
assert.equal(uniformRow.sourceEvidenceCount, 2);
assert.equal(uniformRow.previousSourceEvidenceCount, 2);
const nullRow = row(clean, 'previousNull');
assert.equal(nullRow.previousSourceAuthoritative.state, 'uniform');
assert.equal(nullRow.previousSourceAuthoritative.value, null);

const drafts = createEngineeringSvgDraftStore();
drafts.begin({ operationId: 'provenance-stage', baseRevision: revision });
drafts.stageProperty('a', 'valueHistory', { original: 12, draft: 15 });
drafts.stageProperty('b', 'valueHistory', { original: 12, draft: 15 });
const staged = buildEngineeringSvgInspectorModel({
  selectedIds: ['a', 'b'], propertyViews: views, draft: drafts.getSnapshot(),
});
const stagedRow = row(staged, 'valueHistory');
assert.deepEqual(stagedRow.display, { state: 'uniform', value: 15 });
assert.equal(stagedRow.sourceAuthoritative.value, 'Current/A');
assert.equal(stagedRow.previousSourceAuthoritative.value, 'Previous/A');
drafts.clear('cancel');

const intent = createEngineeringEditIntent({
  type: 'SET_PROPERTIES', operationId: 'provenance-intent', baseRevision: revision,
  entityIds: ['a', 'b'], changes: { properties: { valueHistory: 15 } },
  source: { interaction: 'property-inspector' },
});
validateEngineeringSvgPropertyChanges(intent, sets);
assert.deepEqual(intent.changes.properties, { valueHistory: 15 });
assert.equal(JSON.stringify(intent).includes('previousSource'), false);
assert.equal(JSON.stringify(intent).includes('sourceAggregate'), false);
assert.deepEqual(JSON.parse(JSON.stringify(clean)), clean);
assert(Object.isFrozen(clean));
assert(Object.isFrozen(uniformRow.sourceAuthoritative));

console.log('engineering SVG property provenance: ok');
