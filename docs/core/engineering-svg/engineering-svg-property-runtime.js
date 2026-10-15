import {
  createEngineeringPropertyAggregate,
  createEngineeringPropertyField,
  freezeJsonValue,
} from '../engineering-scene/index.js';

export const ENGINEERING_SVG_PROPERTY_VIEW_SCHEMA = 'EngineeringSvgPropertyView.v1';

function owns(value, key) {
  return Object.prototype.hasOwnProperty.call(value || {}, key);
}

function descriptorSignature(field) {
  return JSON.stringify({
    key: field.key,
    label: field.label,
    type: field.type,
    scope: field.scope,
    unit: field.unit,
    options: field.options,
    min: field.min,
    max: field.max,
    editable: field.editable,
  });
}

function ownsPrevious(field) { return owns(field, 'previousValue'); }
function ownsPreviousSource(field) { return owns(field, 'previousSource'); }

function fieldsForKey(propertySets, key, ownerId) {
  const owned = propertySets.flatMap((set) => (
    set.ownerIds.includes(ownerId) ? set.fields.filter((field) => field.key === key) : []
  ));
  if (owned.length) return owned;
  return propertySets.flatMap((set) => set.fields.filter((field) => (
    field.key === key && ['SCENE', 'SELECTION', 'REFERENCE'].includes(field.scope)
  )));
}

function assertValueEvidence(candidates, first, key, ownerId) {
  if (candidates.some((field) => !Object.is(field.value, first.value))) {
    throw new TypeError(`Property "${key}" has conflicting values for owner "${ownerId}".`);
  }
  if (candidates.some((field) => ownsPrevious(field) !== ownsPrevious(first))) {
    throw new TypeError(`Property "${key}" has conflicting previous-value presence for owner "${ownerId}".`);
  }
  if (ownsPrevious(first) && candidates.some((field) => !Object.is(field.previousValue, first.previousValue))) {
    throw new TypeError(`Property "${key}" has conflicting previous values for owner "${ownerId}".`);
  }
}

function assertProvenanceEvidence(candidates, first, key, ownerId) {
  if (candidates.some((field) => !Object.is(field.source, first.source))) {
    throw new TypeError(`Property "${key}" has conflicting current sources for owner "${ownerId}".`);
  }
  if (candidates.some((field) => ownsPreviousSource(field) !== ownsPreviousSource(first))) {
    throw new TypeError(`Property "${key}" has conflicting previous-source presence for owner "${ownerId}".`);
  }
  if (ownsPreviousSource(first)
    && candidates.some((field) => !Object.is(field.previousSource, first.previousSource))) {
    throw new TypeError(`Property "${key}" has conflicting previous sources for owner "${ownerId}".`);
  }
}

function assertResolvedEvidence(candidates, key, ownerId) {
  const first = candidates[0];
  assertValueEvidence(candidates, first, key, ownerId);
  assertProvenanceEvidence(candidates, first, key, ownerId);
}

function resolveField(propertySets, key, ownerId) {
  const candidates = fieldsForKey(propertySets, key, ownerId);
  if (!candidates.length) return null;
  const signature = descriptorSignature(candidates[0]);
  if (candidates.some((field) => descriptorSignature(field) !== signature)) {
    throw new TypeError(`Property "${key}" has conflicting descriptors for owner "${ownerId}".`);
  }
  assertResolvedEvidence(candidates, key, ownerId);
  return candidates[0];
}

export function resolveEngineeringSvgPropertyField(propertySets, key, ownerId) {
  if (!Array.isArray(propertySets)) throw new TypeError('Property field resolution requires property sets.');
  return resolveField(propertySets, String(key), String(ownerId));
}

function currentAggregateState(fields) {
  if (fields.every((field) => field == null)) return 'not-applicable';
  if (fields.some((field) => field == null)) return 'unavailable';
  return fields.every((field) => Object.is(field.value, fields[0].value)) ? 'uniform' : 'mixed';
}

function previousAggregateState(fields) {
  if (fields.every((field) => field != null && !ownsPrevious(field))) return 'not-applicable';
  if (fields.some((field) => field == null || !ownsPrevious(field))) return 'unavailable';
  return fields.every((field) => Object.is(field.previousValue, fields[0].previousValue)) ? 'uniform' : 'mixed';
}

function sourceAggregateState(fields, selectedCount) {
  if (!selectedCount) return 'not-applicable';
  if (fields.some((field) => field == null)) return 'unavailable';
  if (fields.every((field) => field.source === null)) return 'not-applicable';
  if (fields.some((field) => field.source === null)) return 'unavailable';
  return fields.every((field) => Object.is(field.source, fields[0].source)) ? 'uniform' : 'mixed';
}

function previousSourceAggregateState(fields, selectedCount) {
  if (!selectedCount) return 'not-applicable';
  if (fields.every((field) => field != null && !ownsPreviousSource(field))) return 'not-applicable';
  if (fields.some((field) => field == null || !ownsPreviousSource(field))) return 'unavailable';
  return fields.every((field) => Object.is(field.previousSource, fields[0].previousSource)) ? 'uniform' : 'mixed';
}

function evidenceCount(fields, predicate, selectedCount) {
  if (!selectedCount) return 0;
  return fields.filter((field) => field != null && predicate(field)).length;
}

function descriptorWithoutValues(field) {
  const {
    value: _value,
    previousValue: _previousValue,
    source: _source,
    previousSource: _previousSource,
    ...descriptor
  } = field;
  return createEngineeringPropertyField({ ...descriptor, value: null });
}

function propertyKeys(propertySets) {
  return [...new Set(propertySets.flatMap((set) => set.fields.map((field) => field.key)))].sort();
}

function aggregateFor(key, state, fields, selectedCount, valueName) {
  const input = { key, state, selectedCount };
  if (state === 'uniform') input.value = fields[0][valueName];
  return createEngineeringPropertyAggregate(input);
}

function buildPropertyView(key, fields, representative, selectedCount) {
  const currentState = currentAggregateState(fields);
  const previousState = previousAggregateState(fields);
  const sourceState = sourceAggregateState(fields, selectedCount);
  const previousSourceState = previousSourceAggregateState(fields, selectedCount);
  return {
    schema: ENGINEERING_SVG_PROPERTY_VIEW_SCHEMA,
    field: descriptorWithoutValues(representative),
    aggregate: aggregateFor(key, currentState, fields, selectedCount, 'value'),
    previousAggregate: aggregateFor(key, previousState, fields, selectedCount, 'previousValue'),
    previousEvidenceCount: evidenceCount(fields, ownsPrevious, selectedCount),
    sourceAggregate: aggregateFor(key, sourceState, fields, selectedCount, 'source'),
    previousSourceAggregate: aggregateFor(key, previousSourceState, fields, selectedCount, 'previousSource'),
    sourceEvidenceCount: evidenceCount(fields, (field) => field.source !== null, selectedCount),
    previousSourceEvidenceCount: evidenceCount(fields, ownsPreviousSource, selectedCount),
  };
}

export function aggregateEngineeringSvgProperties(selectedIds, propertySets) {
  if (!Array.isArray(selectedIds) || !Array.isArray(propertySets)) {
    throw new TypeError('Property aggregation requires selected IDs and property sets.');
  }
  const owners = selectedIds.length ? selectedIds : [''];
  return freezeJsonValue(propertyKeys(propertySets).map((key) => {
    const fields = owners.map((ownerId) => resolveField(propertySets, key, ownerId));
    const representative = fields.find(Boolean)
      || propertySets.flatMap((set) => set.fields).find((field) => field.key === key);
    return buildPropertyView(key, fields, representative, selectedIds.length);
  }));
}

export function validateEngineeringSvgPropertyChanges(intent, propertySets) {
  const changes = intent.changes.properties;
  if (changes == null) return intent;
  Object.entries(changes).forEach(([key, value]) => {
    intent.entityIds.forEach((ownerId) => {
      const field = resolveField(propertySets, key, ownerId);
      if (!field) throw new TypeError(`Property "${key}" is unavailable for entity "${ownerId}".`);
      if (!field.editable) throw new TypeError(`Property "${key}" is read-only for entity "${ownerId}".`);
      createEngineeringPropertyField({ ...field, value });
    });
  });
  return intent;
}
