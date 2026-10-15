import {
  assertEngineeringRevisionToken,
  freezeJsonValue,
  validateEngineeringPropertySet,
} from '../engineering-scene/index.js';

export const ENGINEERING_SVG_PROPERTY_PROVIDER_SCHEMA = 'EngineeringSvgPropertyProvider.v1';

function entityIds(values) {
  if (!Array.isArray(values)) throw new TypeError('Property-provider entity IDs must be an array.');
  const result = values.map((value, index) => {
    const id = String(value ?? '').trim();
    if (!id) throw new TypeError(`entityIds[${index}] is required.`);
    return id;
  });
  if (new Set(result).size !== result.length) throw new TypeError('Property-provider entity IDs must be unique.');
  return result;
}

export function createEngineeringSvgPropertyProvider(options = {}) {
  if (typeof options.getPropertySets !== 'function') {
    throw new TypeError('Engineering SVG property provider requires getPropertySets.');
  }
  return Object.freeze({
    schema: ENGINEERING_SVG_PROPERTY_PROVIDER_SCHEMA,
    async getPropertySets(ids, revisionValue) {
      const selectedIds = entityIds(ids);
      const revision = assertEngineeringRevisionToken(revisionValue, 'propertyRequest.revision');
      const sets = await options.getPropertySets(Object.freeze({ selectedIds, revision }));
      if (!Array.isArray(sets)) throw new TypeError('Property provider must return an array.');
      const validated = sets.map(validateEngineeringPropertySet);
      const setIds = validated.map((set) => set.id);
      if (new Set(setIds).size !== setIds.length) throw new TypeError('Property provider returned duplicate property-set IDs.');
      return freezeJsonValue(validated);
    },
    subscribe(listener) {
      if (typeof options.subscribe !== 'function') return () => false;
      if (typeof listener !== 'function') throw new TypeError('Property-provider listener must be a function.');
      return options.subscribe(listener);
    },
  });
}
