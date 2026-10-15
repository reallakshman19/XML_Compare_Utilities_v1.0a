import { assertJsonValue, isPlainObject } from './engineering-json-value.js';
import {
  ENGINEERING_COORDINATE_SYSTEM_SCHEMA,
  ENGINEERING_GEOMETRY_KIND,
  ENGINEERING_GEOMETRY_SCHEMA,
  ENGINEERING_POINT_SCHEMA,
} from './engineering-geometry-contracts.js';
import {
  ENGINEERING_GEOMETRY_CONSTRAINT_KIND,
  ENGINEERING_GEOMETRY_CONSTRAINT_SCHEMA,
} from './engineering-constraint-contracts.js';
import { ENGINEERING_SCENE_ENTITY_SCHEMA, ENGINEERING_SCENE_PROJECTION, ENGINEERING_SCENE_SCHEMA } from './engineering-scene-contracts.js';
import { isEngineeringRevisionToken } from './engineering-revision-contracts.js';
import { ENGINEERING_EDIT_INTENT_SCHEMA, ENGINEERING_EDIT_INTENT_TYPE } from './engineering-edit-intent-contracts.js';
import { ENGINEERING_COMMAND_RESULT_SCHEMA, ENGINEERING_COMMAND_STATUS } from './engineering-command-result-contracts.js';
import {
  ENGINEERING_PROPERTY_AGGREGATE_SCHEMA,
  ENGINEERING_PROPERTY_AGGREGATE_STATE,
  ENGINEERING_PROPERTY_FIELD_SCHEMA,
  ENGINEERING_PROPERTY_SCOPE,
  ENGINEERING_PROPERTY_TYPE,
} from './engineering-property-contracts.js';
import { ENGINEERING_PROPERTY_SET_SCHEMA } from './engineering-property-set-contracts.js';

function owns(value, key) {
  return Object.prototype.hasOwnProperty.call(value || {}, key);
}

function pointErrors(point, path) {
  const errors = [];
  if (point?.schema !== ENGINEERING_POINT_SCHEMA) errors.push(`${path}.schema is invalid`);
  for (const axis of ['x', 'y', 'z']) {
    if (typeof point?.[axis] !== 'number' || !Number.isFinite(point[axis])) errors.push(`${path}.${axis} must be finite`);
  }
  return errors;
}

function geometryErrors(geometry, path) {
  if (geometry == null) return [];
  const errors = [];
  if (geometry.schema !== ENGINEERING_GEOMETRY_SCHEMA) errors.push(`${path}.schema is invalid`);
  if (geometry.kind === ENGINEERING_GEOMETRY_KIND.POINT) errors.push(...pointErrors(geometry.position, `${path}.position`));
  else if (geometry.kind === ENGINEERING_GEOMETRY_KIND.SEGMENT) {
    errors.push(...pointErrors(geometry.start, `${path}.start`), ...pointErrors(geometry.end, `${path}.end`));
  } else if (geometry.kind === ENGINEERING_GEOMETRY_KIND.POLYLINE) {
    if (!Array.isArray(geometry.points) || geometry.points.length < 2) errors.push(`${path}.points requires at least two points`);
    else geometry.points.forEach((point, index) => errors.push(...pointErrors(point, `${path}.points[${index}]`)));
  } else errors.push(`${path}.kind is unsupported`);
  return errors;
}

function uniqueStringArrayErrors(values, path, allowEmpty = true) {
  if (!Array.isArray(values)) return [`${path} must be an array`];
  const errors = [];
  if (!allowEmpty && values.length === 0) errors.push(`${path} cannot be empty`);
  values.forEach((value, index) => {
    if (!String(value || '').trim()) errors.push(`${path}[${index}] is required`);
  });
  if (new Set(values).size !== values.length) errors.push(`${path} must contain unique values`);
  return errors;
}

function entityErrors(entity, path) {
  const errors = [];
  if (entity?.schema !== ENGINEERING_SCENE_ENTITY_SCHEMA) errors.push(`${path}.schema is invalid`);
  if (!String(entity?.id || '').trim()) errors.push(`${path}.id is required`);
  if (!String(entity?.kind || '').trim()) errors.push(`${path}.kind is required`);
  if (!isPlainObject(entity?.domainRef)) errors.push(`${path}.domainRef must be a plain object`);
  if (typeof entity?.renderOrder !== 'number' || !Number.isFinite(entity.renderOrder)) errors.push(`${path}.renderOrder must be finite`);
  if (typeof entity?.contributesToFit !== 'boolean') errors.push(`${path}.contributesToFit must be boolean`);
  errors.push(...uniqueStringArrayErrors(entity?.propertySetIds, `${path}.propertySetIds`));
  errors.push(...uniqueStringArrayErrors(entity?.editCapabilities, `${path}.editCapabilities`));
  errors.push(...geometryErrors(entity?.geometry, `${path}.geometry`));
  return errors;
}

function coordinateSystemErrors(value) {
  const errors = [];
  if (value?.schema !== ENGINEERING_COORDINATE_SYSTEM_SCHEMA) errors.push('coordinateSystem.schema is invalid');
  if (!String(value?.unit || '').trim()) errors.push('coordinateSystem.unit is required');
  if (!String(value?.frame || '').trim()) errors.push('coordinateSystem.frame is required');
  if (!['X', 'Y', 'Z'].includes(value?.verticalAxis)) errors.push('coordinateSystem.verticalAxis is invalid');
  if (!['left', 'right'].includes(value?.handedness)) errors.push('coordinateSystem.handedness is invalid');
  return errors;
}

function constraintErrors(value, path) {
  const errors = [];
  if (value?.schema !== ENGINEERING_GEOMETRY_CONSTRAINT_SCHEMA) errors.push(`${path}.schema is invalid`);
  if (!Object.values(ENGINEERING_GEOMETRY_CONSTRAINT_KIND).includes(value?.kind)) errors.push(`${path}.kind is invalid`);
  if (value?.kind === 'axis' && !['X', 'Y', 'Z'].includes(value.axis)) errors.push(`${path}.axis is invalid`);
  if (value?.kind === 'plane') errors.push(...uniqueStringArrayErrors(value.axes, `${path}.axes`, false));
  if (['path', 'normal'].includes(value?.kind) && !String(value?.referenceId || '').trim()) errors.push(`${path}.referenceId is required`);
  return errors;
}

function propertyValueErrors(field, path, name) {
  if (name === 'previousValue' && !owns(field, name)) return [];
  const value = field?.[name];
  const key = String(field?.key || 'unknown');
  const target = `${path}.${name}`;
  const errors = [];
  if (value === undefined) {
    errors.push(`${target} cannot be undefined for property "${key}"`);
    return errors;
  }
  if (value === null) return errors;
  if (field?.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) errors.push(`${target} must be finite for property "${key}"`);
  if (field?.type === 'boolean' && typeof value !== 'boolean') errors.push(`${target} must be boolean for property "${key}"`);
  if (['text', 'enum'].includes(field?.type) && typeof value !== 'string') errors.push(`${target} must be text for property "${key}"`);
  if (field?.type === 'enum' && !field.options?.includes(value)) errors.push(`${target} must match an option for property "${key}"`);
  if (field?.type === 'number' && field.min != null && value < field.min) errors.push(`${target} is below minimum for property "${key}"`);
  if (field?.type === 'number' && field.max != null && value > field.max) errors.push(`${target} is above maximum for property "${key}"`);
  return errors;
}

function propertySourceErrors(field, path, name, optional) {
  const key = String(field?.key || 'unknown');
  const target = `${path}.${name}`;
  if (!owns(field, name)) return optional ? [] : [`${target} is required for property "${key}"`];
  const value = field[name];
  if (value === undefined) return [`${target} cannot be undefined for property "${key}"`];
  if (value !== null && typeof value !== 'string') return [`${target} must be a string or null for property "${key}"`];
  return [];
}

function propertyFieldErrors(field, path = 'field') {
  const errors = [];
  if (field?.schema !== ENGINEERING_PROPERTY_FIELD_SCHEMA) errors.push(`${path}.schema is invalid`);
  if (!String(field?.key || '').trim()) errors.push(`${path}.key is required`);
  if (!Object.values(ENGINEERING_PROPERTY_SCOPE).includes(field?.scope)) errors.push(`${path}.scope is invalid`);
  if (!Object.values(ENGINEERING_PROPERTY_TYPE).includes(field?.type)) errors.push(`${path}.type is invalid`);
  if (field?.scope === 'REFERENCE' && field?.editable !== false) errors.push(`${path}.editable must be false for REFERENCE scope`);
  if (field?.type === 'enum') errors.push(...uniqueStringArrayErrors(field.options, `${path}.options`, false));
  errors.push(...propertyValueErrors(field, path, 'value'));
  errors.push(...propertyValueErrors(field, path, 'previousValue'));
  errors.push(...propertySourceErrors(field, path, 'source', false));
  errors.push(...propertySourceErrors(field, path, 'previousSource', true));
  return errors;
}

function throwErrors(label, errors) {
  if (errors.length) throw new TypeError(`Invalid ${label}: ${errors.join('; ')}`);
}

export function validateEngineeringScene(scene) {
  assertJsonValue(scene);
  const errors = [];
  if (scene?.schema !== ENGINEERING_SCENE_SCHEMA) errors.push(`schema must be "${ENGINEERING_SCENE_SCHEMA}"`);
  if (!String(scene?.sceneId || '').trim()) errors.push('sceneId is required');
  if (!isEngineeringRevisionToken(scene?.revision)) errors.push('revision token is invalid');
  errors.push(...coordinateSystemErrors(scene?.coordinateSystem));
  errors.push(...uniqueStringArrayErrors(scene?.projections, 'projections', false));
  scene?.projections?.forEach((projection) => {
    if (!ENGINEERING_SCENE_PROJECTION.includes(projection)) errors.push(`projection "${projection}" is unsupported`);
  });
  if (!Array.isArray(scene?.entities)) errors.push('entities must be an array');
  else {
    const ids = new Set();
    scene.entities.forEach((entity, index) => {
      errors.push(...entityErrors(entity, `entities[${index}]`));
      if (ids.has(entity?.id)) errors.push(`entities[${index}].id duplicates "${entity.id}"`);
      ids.add(entity?.id);
    });
  }
  throwErrors('EngineeringScene', errors);
  return scene;
}

export function validateEngineeringPropertyField(field) {
  const errors = propertyFieldErrors(field);
  throwErrors('EngineeringPropertyField', errors);
  assertJsonValue(field);
  return field;
}

export function validateEngineeringPropertyAggregate(value) {
  assertJsonValue(value);
  const errors = [];
  if (value?.schema !== ENGINEERING_PROPERTY_AGGREGATE_SCHEMA) errors.push('schema is invalid');
  if (!Object.values(ENGINEERING_PROPERTY_AGGREGATE_STATE).includes(value?.state)) errors.push('state is invalid');
  if (!Number.isInteger(value?.selectedCount) || value.selectedCount < 0) errors.push('selectedCount is invalid');
  if (value?.state !== 'uniform' && value?.value !== null) errors.push('non-uniform aggregate value must be null');
  throwErrors('EngineeringPropertyAggregate', errors);
  return value;
}

export function validateEngineeringPropertySet(value) {
  const errors = [];
  if (value?.schema !== ENGINEERING_PROPERTY_SET_SCHEMA) errors.push('schema is invalid');
  if (!String(value?.id || '').trim()) errors.push('id is required');
  if (!isEngineeringRevisionToken(value?.revision)) errors.push('revision is invalid');
  errors.push(...uniqueStringArrayErrors(value?.ownerIds, 'ownerIds'));
  if (!Array.isArray(value?.fields)) errors.push('fields must be an array');
  else {
    const keys = new Set();
    value.fields.forEach((field, index) => {
      errors.push(...propertyFieldErrors(field, `fields[${index}]`));
      if (keys.has(field?.key)) errors.push(`fields[${index}].key duplicates "${field.key}"`);
      keys.add(field?.key);
    });
  }
  throwErrors('EngineeringPropertySet', errors);
  assertJsonValue(value);
  return value;
}

export function validateEngineeringEditIntent(intent) {
  assertJsonValue(intent);
  const errors = [];
  if (intent?.schema !== ENGINEERING_EDIT_INTENT_SCHEMA) errors.push('schema is invalid');
  if (!Object.values(ENGINEERING_EDIT_INTENT_TYPE).includes(intent?.type)) errors.push('type is invalid');
  if (!String(intent?.operationId || '').trim()) errors.push('operationId is required');
  if (!isEngineeringRevisionToken(intent?.baseRevision)) errors.push('baseRevision is invalid');
  errors.push(...uniqueStringArrayErrors(intent?.entityIds, 'entityIds', false));
  if (!isPlainObject(intent?.changes)) errors.push('changes must be a plain object');
  else {
    const geometry = intent.changes.geometry;
    const properties = intent.changes.properties;
    if (geometry == null && properties == null) errors.push('geometry or properties are required');
    if (properties != null && !isPlainObject(properties)) errors.push('properties must be a plain object');
    if (intent?.source?.interaction === 'pointer' && geometry != null) errors.push(...constraintErrors(geometry.constraint, 'changes.geometry.constraint'));
    if (intent?.type === 'MOVE_ENTITY' && (geometry == null || properties != null)) errors.push('MOVE_ENTITY requires geometry only');
    if (intent?.type === 'SET_PROPERTIES' && (properties == null || geometry != null)) errors.push('SET_PROPERTIES requires properties only');
  }
  throwErrors('EngineeringEditIntent', errors);
  return intent;
}

export function validateEngineeringCommandResult(result) {
  assertJsonValue(result);
  const errors = [];
  if (result?.schema !== ENGINEERING_COMMAND_RESULT_SCHEMA) errors.push('schema is invalid');
  if (!Object.values(ENGINEERING_COMMAND_STATUS).includes(result?.status)) errors.push('status is invalid');
  if (!String(result?.operationId || '').trim()) errors.push('operationId is required');
  if (result?.status === 'committed' && !isEngineeringRevisionToken(result?.resultingRevision)) errors.push('resultingRevision is invalid');
  if (result?.status === 'rejected' && !String(result?.code || '').trim()) errors.push('rejection code is required');
  if (result?.status === 'rejected' && !String(result?.message || '').trim()) errors.push('rejection message is required');
  throwErrors('EngineeringCommandResult', errors);
  return result;
}
