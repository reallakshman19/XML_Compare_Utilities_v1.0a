import assert from 'node:assert/strict';
import {
  ENGINEERING_PROPERTY_SCOPE,
  createEngineeringCommandResult,
  createEngineeringEditIntent,
  createEngineeringPropertyAggregate,
  createEngineeringPropertyField,
  createEngineeringPropertySet,
  createEngineeringRevisionToken,
  createEngineeringScene,
  createEngineeringSceneEntity,
  createSegmentGeometry,
  validateEngineeringCommandResult,
  validateEngineeringEditIntent,
  validateEngineeringPropertyAggregate,
  validateEngineeringPropertyField,
  validateEngineeringPropertySet,
  validateEngineeringScene,
} from '../core/engineering-scene/index.js';

function roundTrip(value) {
  return JSON.parse(JSON.stringify(value));
}

const domainRef = { application: 'synthetic', rowId: 'row-1' };
const revision = createEngineeringRevisionToken({ geometry: 4, properties: 2, sourceHash: 'abc' });
const entity = createEngineeringSceneEntity({
  id: 'segment-1',
  kind: 'segment',
  domainType: 'PIPE',
  geometry: createSegmentGeometry({ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }),
  domainRef,
  propertySetIds: ['segment-1:engineering'],
  editCapabilities: ['move-axis', 'edit-properties'],
});
const scene = createEngineeringScene({
  sceneId: 'synthetic-scene',
  revision,
  coordinateSystem: { unit: 'mm', verticalAxis: 'Z', frame: 'GLOBAL', handedness: 'right' },
  entities: [entity],
  capabilities: { editable: false },
});

assert.deepEqual(validateEngineeringScene(roundTrip(scene)), scene);
assert.equal(Object.isFrozen(scene), true);
assert.equal(Object.isFrozen(scene.entities[0]), true);
assert.equal(Object.isFrozen(domainRef), false, 'constructors must not freeze caller-owned inputs');

const field = createEngineeringPropertyField({
  key: 'designPressure',
  label: 'Design Pressure',
  type: 'number',
  scope: ENGINEERING_PROPERTY_SCOPE.SCENE,
  unit: 'bar',
  value: 12.5,
  min: 0,
  max: 500,
  editable: true,
});
assert.deepEqual(validateEngineeringPropertyField(roundTrip(field)), field);
assert.equal(field.scope, 'SCENE');

const referenceField = createEngineeringPropertyField({
  key: 'materialRating',
  type: 'enum',
  scope: ENGINEERING_PROPERTY_SCOPE.REFERENCE,
  value: '300',
  options: ['150', '300', '600'],
  editable: true,
});
assert.equal(referenceField.editable, false, 'REFERENCE properties are always read-only');

const propertySet = createEngineeringPropertySet({
  id: 'segment-1:engineering',
  revision,
  ownerIds: ['segment-1'],
  fields: [field, referenceField],
});
assert.deepEqual(validateEngineeringPropertySet(roundTrip(propertySet)), propertySet);

const mixed = createEngineeringPropertyAggregate({
  key: 'designPressure',
  state: 'mixed',
  selectedCount: 2,
});
assert.deepEqual(validateEngineeringPropertyAggregate(roundTrip(mixed)), mixed);
assert.equal(mixed.value, null);

const intent = createEngineeringEditIntent({
  type: 'APPLY_CHANGES',
  operationId: 'operation-1',
  baseRevision: revision,
  entityIds: ['segment-1'],
  changes: {
    geometry: { delta: { x: 0, y: 0, z: 25 }, constraint: { kind: 'axis', axis: 'z' } },
    properties: { designPressure: 13 },
  },
  source: { interaction: 'pointer', surfaceId: 'synthetic' },
});
assert.deepEqual(validateEngineeringEditIntent(roundTrip(intent)), intent);
assert.equal(intent.changes.geometry.constraint.axis, 'Z');
assert.equal(intent.changes.geometry.constraint.schema, 'EngineeringGeometryConstraint.v1');

const result = createEngineeringCommandResult({
  operationId: intent.operationId,
  status: 'committed',
  resultingRevision: createEngineeringRevisionToken({ geometry: 5, properties: 3, sourceHash: 'def' }),
  commandReason: 'synthetic-combined-edit',
});
assert.deepEqual(validateEngineeringCommandResult(roundTrip(result)), result);

assert.throws(() => createEngineeringPropertyField({ key: 'rating', type: 'enum' }), /declares no options/);
assert.throws(() => createEngineeringPropertyField({ key: 'rating', type: 'enum', value: '900', options: ['150', '300'] }), /must be one of its options/);
assert.throws(() => createEngineeringPropertyAggregate({ key: 'pressure', state: 'uniform' }), /requires a value/);
assert.throws(() => createEngineeringSceneEntity({ id: 'bad', kind: 'point' }), /domainRef must be a plain object/);
assert.throws(() => createEngineeringEditIntent({
  operationId: 'bad-pointer',
  baseRevision: revision,
  entityIds: ['segment-1'],
  changes: { geometry: { delta: { x: 1, y: 0, z: 0 } } },
  source: { interaction: 'pointer' },
}), /explicit constraint/);
assert.throws(() => createEngineeringEditIntent({
  type: 'SET_PROPERTIES',
  operationId: 'wrong-shape',
  baseRevision: revision,
  entityIds: ['segment-1'],
  changes: { geometry: { delta: { x: 1, y: 0, z: 0 } } },
  source: { interaction: 'typed' },
}), /SET_PROPERTIES requires property changes only/);

console.log('engineering scene contracts: ok');
