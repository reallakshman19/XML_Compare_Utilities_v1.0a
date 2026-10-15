import assert from 'node:assert/strict';
import {
  createEngineeringEditIntent,
  createEngineeringPropertySet,
  createEngineeringRevisionToken,
} from '../core/engineering-scene/index.js';
import {
  aggregateEngineeringSvgProperties,
  createEngineeringSvgPropertyProvider,
  validateEngineeringSvgPropertyChanges,
} from '../core/engineering-svg/edit-runtime.js';

const revision = createEngineeringRevisionToken({ geometry: 1, properties: 4 });
const setA = createEngineeringPropertySet({
  id: 'properties-a',
  revision,
  ownerIds: ['a'],
  fields: [
    { key: 'pressure', label: 'Pressure', type: 'number', value: 10, min: 0, max: 100, editable: true },
    { key: 'mode', label: 'Mode', type: 'enum', value: 'A', options: ['A', 'B'], editable: true },
  ],
});
const setB = createEngineeringPropertySet({
  id: 'properties-b',
  revision,
  ownerIds: ['b'],
  fields: [
    { key: 'pressure', label: 'Pressure', type: 'number', value: 20, min: 0, max: 100, editable: true },
    { key: 'mode', label: 'Mode', type: 'enum', value: 'A', options: ['A', 'B'], editable: true },
  ],
});
const sharedSet = createEngineeringPropertySet({
  id: 'shared-properties',
  revision,
  ownerIds: [],
  fields: [
    { key: 'material', label: 'Material', type: 'text', scope: 'REFERENCE', value: 'A106', editable: true },
    { key: 'reviewed', label: 'Reviewed', type: 'boolean', scope: 'SELECTION', value: true, editable: true },
  ],
});
const propertySets = [setA, setB, sharedSet];
let request = null;
const provider = createEngineeringSvgPropertyProvider({
  getPropertySets: async (value) => {
    request = value;
    return propertySets;
  },
});
const provided = await provider.getPropertySets(['a', 'b'], revision);
assert.deepEqual(request.selectedIds, ['a', 'b']);
assert.equal(provided.length, 3);

const views = aggregateEngineeringSvgProperties(['a', 'b'], provided);
const pressure = views.find((view) => view.field.key === 'pressure');
const mode = views.find((view) => view.field.key === 'mode');
const material = views.find((view) => view.field.key === 'material');
const reviewed = views.find((view) => view.field.key === 'reviewed');
assert.equal(pressure.aggregate.state, 'mixed');
assert.equal(pressure.aggregate.value, null);
assert.equal(mode.aggregate.state, 'uniform');
assert.equal(mode.aggregate.value, 'A');
assert.equal(material.aggregate.value, 'A106');
assert.equal(material.field.editable, false, 'REFERENCE properties must remain read-only');
assert.equal(reviewed.aggregate.value, true);
assert.deepEqual(JSON.parse(JSON.stringify(views)), views);

function propertyIntent(operationId, key, value) {
  return createEngineeringEditIntent({
    operationId,
    baseRevision: revision,
    entityIds: ['a', 'b'],
    changes: { properties: { [key]: value } },
    source: { interaction: 'property-inspector' },
  });
}

assert.equal(validateEngineeringSvgPropertyChanges(propertyIntent('valid', 'pressure', 15), provided).operationId, 'valid');
assert.throws(() => validateEngineeringSvgPropertyChanges(propertyIntent('readonly', 'material', 'B31'), provided), /read-only/);
assert.throws(() => validateEngineeringSvgPropertyChanges(propertyIntent('type', 'pressure', 'high'), provided), /finite numeric value/);
assert.throws(() => validateEngineeringSvgPropertyChanges(propertyIntent('range', 'pressure', 101), provided), /above its maximum/);
assert.throws(() => validateEngineeringSvgPropertyChanges(propertyIntent('missing', 'unknown', 1), provided), /unavailable/);

const duplicateProvider = createEngineeringSvgPropertyProvider({ getPropertySets: async () => [setA, setA] });
await assert.rejects(() => duplicateProvider.getPropertySets(['a'], revision), /duplicate property-set IDs/);

console.log('engineering SVG edit properties: ok');
