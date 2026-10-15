import assert from 'node:assert/strict';
import {
  assertJsonValue,
  createEngineeringEditIntent,
  createEngineeringPropertyField,
  createEngineeringRevisionToken,
  createEngineeringScene,
  createEngineeringSceneEntity,
  createPointGeometry,
  validateEngineeringEditIntent,
  validateEngineeringPropertyField,
  validateEngineeringScene,
} from '../core/engineering-scene/index.js';

const revision = createEngineeringRevisionToken('revision-1');
const point = createEngineeringSceneEntity({
  id: 'point-1',
  kind: 'point',
  geometry: createPointGeometry({ x: 1, y: 2, z: 3 }),
  domainRef: { owner: 'synthetic' },
});
const scene = createEngineeringScene({
  sceneId: 'validation-scene',
  revision,
  coordinateSystem: { unit: 'mm', frame: 'GLOBAL', verticalAxis: 'Z', handedness: 'right' },
  entities: [point],
});
assert.equal(validateEngineeringScene(scene), scene);

const duplicate = JSON.parse(JSON.stringify(scene));
duplicate.entities.push({ ...duplicate.entities[0] });
assert.throws(() => validateEngineeringScene(duplicate), /duplicates "point-1"/);

const nonFinite = JSON.parse(JSON.stringify(scene));
nonFinite.entities[0].geometry.position.x = Infinity;
assert.throws(() => validateEngineeringScene(nonFinite), /finite number/);

const invalidProjection = JSON.parse(JSON.stringify(scene));
invalidProjection.projections = ['ISO', 'PERSPECTIVE'];
assert.throws(() => validateEngineeringScene(invalidProjection), /unsupported/);

assert.throws(() => assertJsonValue({ when: new Date() }), /arrays and plain objects/);
assert.throws(() => assertJsonValue({ values: new Set([1]) }), /arrays and plain objects/);
assert.throws(() => assertJsonValue({ value: undefined }), /unsupported JSON type "undefined"/);
assert.throws(() => assertJsonValue({ value: Symbol('mixed') }), /unsupported JSON type "symbol"/);
assert.throws(() => assertJsonValue({ value: NaN }), /finite number/);

const circular = {};
circular.self = circular;
assert.throws(() => assertJsonValue(circular), /circular reference/);

const invalidDomainRef = JSON.parse(JSON.stringify(scene));
invalidDomainRef.entities[0].domainRef = [];
assert.throws(() => validateEngineeringScene(invalidDomainRef), /domainRef must be a plain object/);

const parsedReferenceField = JSON.parse(JSON.stringify(createEngineeringPropertyField({
  key: 'rating',
  scope: 'REFERENCE',
  value: '300',
})));
parsedReferenceField.editable = true;
assert.throws(() => validateEngineeringPropertyField(parsedReferenceField), /must be false for REFERENCE/);

const parsedIntent = JSON.parse(JSON.stringify(createEngineeringEditIntent({
  operationId: 'pointer-1',
  baseRevision: revision,
  entityIds: ['point-1'],
  changes: { geometry: { delta: { x: 0, y: 0, z: 1 }, constraint: { kind: 'axis', axis: 'Z' } } },
  source: { interaction: 'pointer' },
})));
parsedIntent.changes.geometry.constraint.axis = 'Q';
assert.throws(() => validateEngineeringEditIntent(parsedIntent), /constraint.axis is invalid/);

console.log('engineering scene validation: ok');
