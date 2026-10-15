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
const revision = createEngineeringRevisionToken({ geometry: 1, properties: 9 });

const legacy = createEngineeringPropertyField({ key: 'legacy', type: 'text', value: 'Current' });
assert.equal(owns(legacy, 'previousValue'), false);
assert.equal(JSON.stringify(legacy).includes('previousValue'), false);

const explicitNull = createEngineeringPropertyField({
  key: 'comment', type: 'text', value: 'Current', previousValue: null,
});
assert.equal(owns(explicitNull, 'previousValue'), true);
assert.equal(explicitNull.previousValue, null);
const parsedLegacy = JSON.parse(JSON.stringify(legacy));
const parsedNull = JSON.parse(JSON.stringify(explicitNull));
assert.equal(owns(parsedLegacy, 'previousValue'), false);
assert.equal(owns(parsedNull, 'previousValue'), true);
assert.equal(parsedNull.previousValue, null);

for (const field of [
  createEngineeringPropertyField({ key: 'number', type: 'number', value: 2, previousValue: 1, min: 0, max: 5 }),
  createEngineeringPropertyField({ key: 'text', type: 'text', value: 'new', previousValue: 'old' }),
  createEngineeringPropertyField({ key: 'enum', type: 'enum', value: 'B', previousValue: 'A', options: ['A', 'B'] }),
  createEngineeringPropertyField({ key: 'boolean', type: 'boolean', value: true, previousValue: false }),
]) assert.equal(validateEngineeringPropertyField(field), field);

assert.throws(() => createEngineeringPropertyField({ key: 'n', type: 'number', previousValue: NaN }), /previousValue requires a finite/);
assert.throws(() => createEngineeringPropertyField({ key: 'n', type: 'number', previousValue: -1, min: 0 }), /previousValue is below/);
assert.throws(() => createEngineeringPropertyField({ key: 'n', type: 'number', previousValue: 6, max: 5 }), /previousValue is above/);
assert.throws(() => createEngineeringPropertyField({ key: 't', type: 'text', previousValue: true }), /previousValue requires a string/);
assert.throws(() => createEngineeringPropertyField({ key: 'b', type: 'boolean', previousValue: 'false' }), /previousValue requires a boolean/);
assert.throws(() => createEngineeringPropertyField({ key: 'e', type: 'enum', value: 'A', previousValue: 'C', options: ['A', 'B'] }), /previousValue must be one/);
assert.throws(() => createEngineeringPropertyField({ key: 'u', previousValue: undefined }), /previousValue cannot be undefined/);

const structurallyInvalid = JSON.parse(JSON.stringify(createEngineeringPropertyField({
  key: 'pressure', type: 'number', value: 12, previousValue: 10, min: 0, max: 20,
})));
structurallyInvalid.previousValue = 'high';
assert.throws(() => validateEngineeringPropertyField(structurallyInvalid), /previousValue must be finite.*pressure/);
const structurallyOutOfRange = { ...structurallyInvalid, previousValue: 21 };
assert.throws(() => validateEngineeringPropertyField(structurallyOutOfRange), /previousValue is above maximum.*pressure/);
const structurallyUndefined = { ...structurallyInvalid, previousValue: undefined };
assert.throws(
  () => validateEngineeringPropertyField(structurallyUndefined),
  /field\.previousValue cannot be undefined.*pressure/,
);

function set(id, ownerId, fields) {
  return createEngineeringPropertySet({ id, revision, ownerIds: [ownerId], fields });
}

const preservedSet = set('preserved', 'a', [explicitNull]);
assert.equal(validateEngineeringPropertySet(preservedSet), preservedSet);
assert.equal(owns(preservedSet.fields[0], 'previousValue'), true);
assert.equal(preservedSet.fields[0].previousValue, null);
const structurallyUndefinedSet = {
  ...preservedSet,
  fields: [{ ...preservedSet.fields[0], previousValue: undefined }],
};
assert.throws(
  () => validateEngineeringPropertySet(structurallyUndefinedSet),
  /fields\[0\]\.previousValue cannot be undefined.*comment/,
);

const conflictAbsent = set('conflict-absent', 'x', [{ key: 'pressure', type: 'number', value: 10 }]);
const conflictNull = set('conflict-null', 'x', [{ key: 'pressure', type: 'number', value: 10, previousValue: null }]);
assert.throws(
  () => resolveEngineeringSvgPropertyField([conflictAbsent, conflictNull], 'pressure', 'x'),
  /conflicting previous-value presence/,
);
const conflictOne = set('conflict-one', 'x', [{ key: 'pressure', type: 'number', value: 10, previousValue: 8 }]);
const conflictTwo = set('conflict-two', 'x', [{ key: 'pressure', type: 'number', value: 10, previousValue: 9 }]);
assert.throws(
  () => resolveEngineeringSvgPropertyField([conflictOne, conflictTwo], 'pressure', 'x'),
  /conflicting previous values/,
);

const sets = [
  set('a-properties', 'a', [
    { key: 'pressure', label: 'Pressure', type: 'number', unit: 'bar', value: 12, previousValue: 10, min: 0, max: 100 },
    { key: 'status', label: 'Status', type: 'text', value: 'Ready', previousValue: 'Ready' },
    { key: 'comment', label: 'Comment', type: 'text', value: 'Current', previousValue: null },
    { key: 'legacy', label: 'Legacy', type: 'text', value: 'Legacy' },
    { key: 'legacyPartial', label: 'Legacy Partial', type: 'text', value: 'A only' },
    { key: 'historyPartial', label: 'History Partial', type: 'number', value: 6, previousValue: 5 },
    { key: 'previousUniform', type: 'number', value: 6, previousValue: 5 },
    { key: 'previousMixed', type: 'number', value: 6, previousValue: 4 },
    { key: 'previousUnavailable', type: 'number', value: 6, previousValue: 5 },
  ]),
  set('b-properties', 'b', [
    { key: 'pressure', label: 'Pressure', type: 'number', unit: 'bar', value: 12, previousValue: 10, min: 0, max: 100 },
    { key: 'status', label: 'Status', type: 'text', value: 'Ready', previousValue: 'Ready' },
    { key: 'comment', label: 'Comment', type: 'text', value: 'Current', previousValue: null },
    { key: 'legacy', label: 'Legacy', type: 'text', value: 'Legacy' },
    { key: 'previousUniform', type: 'number', value: 6, previousValue: 5 },
    { key: 'previousMixed', type: 'number', value: 6, previousValue: 5 },
    { key: 'previousUnavailable', type: 'number', value: 6 },
  ]),
];
const views = aggregateEngineeringSvgProperties(['a', 'b'], sets);
const view = (key) => views.find((item) => item.field.key === key);
assert.equal(view('pressure').aggregate.state, 'uniform');
assert.equal(view('pressure').aggregate.value, 12);
assert.equal(view('legacy').aggregate.state, 'uniform');
assert.equal(view('legacy').previousAggregate.state, 'not-applicable');
assert.equal(view('legacy').previousEvidenceCount, 0);
assert.equal(view('legacyPartial').aggregate.state, 'unavailable');
assert.equal(view('legacyPartial').previousAggregate.state, 'unavailable');
assert.equal(view('legacyPartial').previousEvidenceCount, 0);
assert.equal(view('historyPartial').aggregate.state, 'unavailable');
assert.equal(view('historyPartial').previousAggregate.state, 'unavailable');
assert.equal(view('historyPartial').previousEvidenceCount, 1);
assert.equal(view('previousUnavailable').previousAggregate.state, 'unavailable');
assert.equal(view('previousUnavailable').previousEvidenceCount, 1);
assert.equal(view('previousUniform').previousAggregate.state, 'uniform');
assert.equal(view('previousUniform').previousAggregate.value, 5);
assert.equal(view('previousUniform').previousEvidenceCount, 2);
assert.equal(view('previousMixed').previousAggregate.state, 'mixed');
assert.equal(view('comment').previousAggregate.state, 'uniform');
assert.equal(view('comment').previousAggregate.value, null);
assert.equal(view('comment').previousEvidenceCount, 2);
for (const item of views) {
  assert.equal(item.field.value, null);
  assert.equal(owns(item.field, 'previousValue'), false);
}

const clean = buildEngineeringSvgInspectorModel({ selectedIds: ['a', 'b'], propertyViews: views, draft: {} });
const row = (model, key) => model.rows.find((item) => item.key === key);
assert.equal(row(clean, 'legacy').comparisonState, 'not-applicable');
assert.equal(row(clean, 'legacy').previousEvidenceCount, 0);
assert.equal(row(clean, 'legacyPartial').comparisonState, 'unavailable');
assert.equal(row(clean, 'legacyPartial').previousEvidenceCount, 0);
assert.equal(row(clean, 'historyPartial').comparisonState, 'unavailable');
assert.equal(row(clean, 'historyPartial').previousEvidenceCount, 1);
assert.equal(row(clean, 'previousUnavailable').comparisonState, 'unavailable');
assert.equal(row(clean, 'previousUnavailable').previousEvidenceCount, 1);
assert.equal(row(clean, 'previousMixed').comparisonState, 'mixed');
assert.equal(row(clean, 'status').comparisonState, 'unchanged');
assert.equal(row(clean, 'pressure').comparisonState, 'changed');
assert.equal(row(clean, 'pressure').authoritative.value, 12);
assert.equal(row(clean, 'pressure').previousAuthoritative.value, 10);
assert.equal(row(clean, 'comment').previousAuthoritative.value, null);

const drafts = createEngineeringSvgDraftStore();
drafts.begin({ operationId: 'history-stage', baseRevision: revision });
drafts.stageProperty('a', 'pressure', { original: 12, draft: 15 });
drafts.stageProperty('b', 'pressure', { original: 12, draft: 15 });
const staged = buildEngineeringSvgInspectorModel({
  selectedIds: ['a', 'b'], propertyViews: views, draft: drafts.getSnapshot(),
});
assert.deepEqual(row(staged, 'pressure').display, { state: 'uniform', value: 15 });
assert.equal(row(staged, 'pressure').previousAuthoritative.value, 10);
assert.equal(row(staged, 'pressure').previousEvidenceCount, 2);
assert.equal(row(staged, 'pressure').comparisonState, 'changed');
drafts.clear('cancel');
const cancelled = buildEngineeringSvgInspectorModel({
  selectedIds: ['a', 'b'], propertyViews: views, draft: drafts.getSnapshot(),
});
assert.equal(row(cancelled, 'pressure').display.value, 12);
assert.equal(row(cancelled, 'pressure').previousAuthoritative.value, 10);

const intent = createEngineeringEditIntent({
  type: 'SET_PROPERTIES', operationId: 'history-intent', baseRevision: revision,
  entityIds: ['a', 'b'], changes: { properties: { pressure: 15 } },
  source: { interaction: 'property-inspector' },
});
validateEngineeringSvgPropertyChanges(intent, sets);
assert.deepEqual(intent.changes.properties, { pressure: 15 });
assert.equal(JSON.stringify(intent).includes('previousValue'), false);
assert.deepEqual(JSON.parse(JSON.stringify(clean)), clean);
console.log('engineering SVG property history: ok');
