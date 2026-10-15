import { freezeJsonValue, isPlainObject } from './engineering-json-value.js';
import { createEngineeringGeometryConstraint } from './engineering-constraint-contracts.js';
import { assertEngineeringRevisionToken } from './engineering-revision-contracts.js';

export const ENGINEERING_EDIT_INTENT_SCHEMA = 'EngineeringEditIntent.v1';
export const ENGINEERING_EDIT_INTENT_TYPE = Object.freeze({
  MOVE_ENTITY: 'MOVE_ENTITY',
  SET_PROPERTIES: 'SET_PROPERTIES',
  APPLY_CHANGES: 'APPLY_CHANGES',
});

function requiredText(value, label) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`${label} is required.`);
  return result;
}

function entityIds(values) {
  if (!Array.isArray(values) || values.length === 0) throw new TypeError('Edit intent requires at least one entity id.');
  const result = values.map((value, index) => requiredText(value, `entityIds[${index}]`));
  if (new Set(result).size !== result.length) throw new TypeError('Edit intent entity ids must be unique.');
  return result;
}

function propertyChanges(value) {
  if (value == null) return null;
  if (!isPlainObject(value)) throw new TypeError('Property changes must be a plain object.');
  for (const key of Object.keys(value)) requiredText(key, 'Property-change key');
  return value;
}

function geometryChanges(value, source) {
  if (value == null) return null;
  if (!isPlainObject(value)) throw new TypeError('Geometry changes must be a plain object.');
  if (source.interaction !== 'pointer') return value;
  if (!value.constraint) throw new TypeError('Pointer-originated geometry changes require an explicit constraint.');
  return { ...value, constraint: createEngineeringGeometryConstraint(value.constraint) };
}

function normalizedChanges(type, changes, source) {
  if (!isPlainObject(changes)) throw new TypeError('Edit intent changes must be a plain object.');
  const geometry = geometryChanges(changes.geometry, source);
  const properties = propertyChanges(changes.properties);
  if (geometry == null && properties == null) throw new TypeError('Edit intent requires geometry or property changes.');
  if (type === 'MOVE_ENTITY' && (geometry == null || properties != null)) throw new TypeError('MOVE_ENTITY requires geometry changes only.');
  if (type === 'SET_PROPERTIES' && (properties == null || geometry != null)) throw new TypeError('SET_PROPERTIES requires property changes only.');
  return { geometry, properties };
}

export function createEngineeringEditIntent(input = {}) {
  const type = input.type || ENGINEERING_EDIT_INTENT_TYPE.APPLY_CHANGES;
  if (!Object.values(ENGINEERING_EDIT_INTENT_TYPE).includes(type)) throw new TypeError(`Unsupported edit-intent type "${type}".`);
  const baseRevision = assertEngineeringRevisionToken(input.baseRevision, 'baseRevision');
  const source = input.source ?? {};
  if (!isPlainObject(source)) throw new TypeError('Edit-intent source must be a plain object.');
  return freezeJsonValue({
    schema: ENGINEERING_EDIT_INTENT_SCHEMA,
    type,
    operationId: requiredText(input.operationId, 'operationId'),
    baseRevision,
    entityIds: entityIds(input.entityIds),
    changes: normalizedChanges(type, input.changes, source),
    source,
  });
}
