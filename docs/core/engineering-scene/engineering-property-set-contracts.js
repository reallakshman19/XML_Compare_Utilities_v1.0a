import { freezeJsonValue } from './engineering-json-value.js';
import { createEngineeringPropertyField } from './engineering-property-contracts.js';
import { assertEngineeringRevisionToken } from './engineering-revision-contracts.js';

export const ENGINEERING_PROPERTY_SET_SCHEMA = 'EngineeringPropertySet.v1';

function requiredText(value, label) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`${label} is required.`);
  return result;
}

function uniqueTexts(values, label) {
  if (!Array.isArray(values)) throw new TypeError(`${label} must be an array.`);
  const result = values.map((value, index) => requiredText(value, `${label}[${index}]`));
  if (new Set(result).size !== result.length) throw new TypeError(`${label} must contain unique values.`);
  return result;
}

export function createEngineeringPropertySet(input = {}) {
  const revision = assertEngineeringRevisionToken(input.revision, 'propertySet.revision');
  const fields = (input.fields || []).map(createEngineeringPropertyField);
  const fieldKeys = fields.map((field) => field.key);
  if (new Set(fieldKeys).size !== fieldKeys.length) throw new TypeError('Property-set field keys must be unique.');
  return freezeJsonValue({
    schema: ENGINEERING_PROPERTY_SET_SCHEMA,
    id: requiredText(input.id, 'Property-set id'),
    revision,
    ownerIds: uniqueTexts(input.ownerIds || [], 'ownerIds'),
    fields,
    metadata: input.metadata ?? {},
  });
}
