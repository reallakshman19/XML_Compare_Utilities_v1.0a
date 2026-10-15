import { freezeJsonValue } from './engineering-json-value.js';

export const ENGINEERING_PROPERTY_FIELD_SCHEMA = 'EngineeringPropertyField.v1';
export const ENGINEERING_PROPERTY_AGGREGATE_SCHEMA = 'EngineeringPropertyAggregate.v1';
export const ENGINEERING_PROPERTY_SCOPE = Object.freeze({
  SCENE: 'SCENE',
  ENTITY: 'ENTITY',
  SELECTION: 'SELECTION',
  REFERENCE: 'REFERENCE',
});
export const ENGINEERING_PROPERTY_TYPE = Object.freeze({
  NUMBER: 'number',
  TEXT: 'text',
  ENUM: 'enum',
  BOOLEAN: 'boolean',
});
export const ENGINEERING_PROPERTY_AGGREGATE_STATE = Object.freeze({
  UNIFORM: 'uniform',
  MIXED: 'mixed',
  UNAVAILABLE: 'unavailable',
  NOT_APPLICABLE: 'not-applicable',
});

function owns(value, key) {
  return Object.prototype.hasOwnProperty.call(value || {}, key);
}

function requiredText(value, label) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`${label} is required.`);
  return result;
}

function optionalFinite(value, label) {
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${label} must be a finite number.`);
  return value;
}

function enumOptions(input, key) {
  if (input.type !== 'enum') return null;
  if (!Array.isArray(input.options) || input.options.length === 0) {
    throw new TypeError(`Property "${key}" is enum but declares no options.`);
  }
  const options = input.options.map((value, index) => requiredText(value, `Property "${key}" options[${index}]`));
  if (new Set(options).size !== options.length) throw new TypeError(`Property "${key}" enum options must be unique.`);
  return options;
}

function valueLabel(name) { return name === 'value' ? 'value' : 'previousValue'; }

function assertPropertyValue(type, value, input, name = 'value') {
  const label = valueLabel(name);
  if (value === undefined) throw new TypeError(`Property "${input.key}" ${label} cannot be undefined.`);
  if (value === null) return;
  if (type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) {
    throw new TypeError(`Property "${input.key}" ${label} requires a finite numeric value.`);
  }
  if (type === 'boolean' && typeof value !== 'boolean') throw new TypeError(`Property "${input.key}" ${label} requires a boolean value.`);
  if (['text', 'enum'].includes(type) && typeof value !== 'string') throw new TypeError(`Property "${input.key}" ${label} requires a string value.`);
  if (type === 'enum' && !input.options.includes(value)) throw new TypeError(`Property "${input.key}" ${label} must be one of its options.`);
  if (type === 'number' && input.min != null && value < input.min) throw new RangeError(`Property "${input.key}" ${label} is below its minimum.`);
  if (type === 'number' && input.max != null && value > input.max) throw new RangeError(`Property "${input.key}" ${label} is above its maximum.`);
}

function provenanceValue(input, key, name, optional) {
  if (!owns(input, name)) return optional ? { owned: false } : { owned: true, value: null };
  const value = input[name];
  if (value === undefined || (value !== null && typeof value !== 'string')) {
    throw new TypeError(`Property "${key}" ${name} must be a string or null.`);
  }
  return { owned: true, value };
}

export function createEngineeringPropertyField(input = {}) {
  const key = requiredText(input.key, 'Property key');
  const label = requiredText(input.label ?? key, `Property "${key}" label`);
  const type = input.type || 'text';
  const scope = input.scope || 'ENTITY';
  if (!Object.values(ENGINEERING_PROPERTY_TYPE).includes(type)) throw new TypeError(`Property "${key}" has unsupported type "${type}".`);
  if (!Object.values(ENGINEERING_PROPERTY_SCOPE).includes(scope)) throw new TypeError(`Property "${key}" has unsupported scope "${scope}".`);
  const options = enumOptions({ ...input, type }, key);
  const min = optionalFinite(input.min, `Property "${key}" min`);
  const max = optionalFinite(input.max, `Property "${key}" max`);
  if (min != null && max != null && min > max) throw new RangeError(`Property "${key}" min cannot exceed max.`);
  const value = input.value ?? null;
  assertPropertyValue(type, value, { key, options, min, max });
  const currentSource = provenanceValue(input, key, 'source', false);
  const previousSource = provenanceValue(input, key, 'previousSource', true);
  const editable = scope === 'REFERENCE' ? false : input.editable !== false;
  const field = {
    schema: ENGINEERING_PROPERTY_FIELD_SCHEMA,
    key,
    label,
    type,
    scope,
    unit: input.unit == null ? null : String(input.unit),
    value,
    options,
    min,
    max,
    editable,
    source: currentSource.value,
  };
  if (Object.prototype.hasOwnProperty.call(input, 'previousValue')) {
    assertPropertyValue(type, input.previousValue, { key, options, min, max }, 'previousValue');
    field.previousValue = input.previousValue;
  }
  if (previousSource.owned) field.previousSource = previousSource.value;
  return freezeJsonValue(field);
}

export function createEngineeringPropertyAggregate(input = {}) {
  const key = requiredText(input.key, 'Property aggregate key');
  const state = input.state || 'uniform';
  if (!Object.values(ENGINEERING_PROPERTY_AGGREGATE_STATE).includes(state)) {
    throw new TypeError(`Property aggregate has unsupported state "${state}".`);
  }
  if (state === 'uniform' && !owns(input, 'value')) {
    throw new TypeError(`Uniform property aggregate "${key}" requires a value.`);
  }
  if (input.selectedCount != null && (!Number.isInteger(input.selectedCount) || input.selectedCount < 0)) {
    throw new TypeError('Property aggregate selectedCount must be a non-negative integer.');
  }
  return freezeJsonValue({
    schema: ENGINEERING_PROPERTY_AGGREGATE_SCHEMA,
    key,
    state,
    value: state === 'uniform' ? input.value : null,
    selectedCount: input.selectedCount ?? 0,
  });
}
