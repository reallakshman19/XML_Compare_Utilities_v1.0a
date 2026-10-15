import { freezeJsonValue } from './engineering-json-value.js';

export const ENGINEERING_REVISION_TOKEN_SCHEMA = 'EngineeringRevisionToken.v1';

export function createEngineeringRevisionToken(value) {
  if (value === undefined) throw new TypeError('Engineering revision value is required.');
  return freezeJsonValue({
    schema: ENGINEERING_REVISION_TOKEN_SCHEMA,
    value,
  });
}

export function isEngineeringRevisionToken(value) {
  return value?.schema === ENGINEERING_REVISION_TOKEN_SCHEMA
    && Object.prototype.hasOwnProperty.call(value, 'value');
}

export function assertEngineeringRevisionToken(value, path = 'revision') {
  if (!isEngineeringRevisionToken(value)) {
    throw new TypeError(`${path} must use schema "${ENGINEERING_REVISION_TOKEN_SCHEMA}".`);
  }
  freezeJsonValue(value);
  return value;
}
