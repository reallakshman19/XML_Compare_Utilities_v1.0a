import {
  createEngineeringPropertyAggregate,
  createEngineeringPropertyField,
  freezeJsonValue,
} from '../engineering-scene/index.js';

export const ENGINEERING_SVG_INSPECTOR_SCHEMA = 'EngineeringSvgInspectorModel.v1';
export const ENGINEERING_SVG_INSPECTOR_ROW_SCHEMA = 'EngineeringSvgInspectorRow.v1';

function selectedIds(values) {
  if (!Array.isArray(values)) throw new TypeError('Inspector selectedIds must be an array.');
  const ids = values.map((value, index) => {
    const id = String(value ?? '').trim();
    if (!id) throw new TypeError(`selectedIds[${index}] is required.`);
    return id;
  });
  if (new Set(ids).size !== ids.length) throw new TypeError('Inspector selectedIds must be unique.');
  return ids;
}

function stagedEntries(ids, key, draft) {
  return ids.map((id) => ({ id, value: draft?.properties?.[id]?.[key] ?? null }));
}

function changedEntry(entry) {
  return entry.value && !Object.is(entry.value.original, entry.value.draft);
}

function displayValue(view, changed, selectionCount) {
  if (!changed.length) return { state: view.aggregate.state, value: view.aggregate.value };
  if (changed.length !== selectionCount) return { state: 'mixed', value: null };
  const [first, ...rest] = changed.map((entry) => entry.value.draft);
  return rest.every((value) => Object.is(value, first))
    ? { state: 'uniform', value: first }
    : { state: 'mixed', value: null };
}

function validateDraftValues(field, changed, selectionCount) {
  const messages = [];
  if (!changed.length) return messages;
  if (!field.editable) messages.push(`Property "${field.key}" is read-only.`);
  if (changed.length !== selectionCount) messages.push(`Property "${field.key}" is staged for only part of the selection.`);
  changed.forEach((entry) => {
    try {
      createEngineeringPropertyField({ ...field, value: entry.value.draft });
    } catch (error) {
      messages.push(error.message);
    }
  });
  return [...new Set(messages)].sort();
}

function fallbackAggregate(view, name) {
  if (view[name]) return view[name];
  return createEngineeringPropertyAggregate({
    key: view.field.key,
    state: 'not-applicable',
    selectedCount: view.aggregate.selectedCount,
  });
}

function evidenceCount(view, name, aggregate, selectionCount) {
  if (!Object.prototype.hasOwnProperty.call(view, name)) {
    return aggregate.state === 'not-applicable' ? 0 : selectionCount;
  }
  const count = view[name];
  if (!Number.isInteger(count) || count < 0 || count > selectionCount) {
    throw new TypeError(`Inspector ${name} must be a valid selection count.`);
  }
  return count;
}

function comparisonState(current, previous) {
  if (previous.state === 'not-applicable') return 'not-applicable';
  if (current.state === 'unavailable' || previous.state === 'unavailable') return 'unavailable';
  if (current.state === 'not-applicable') return 'unavailable';
  if (current.state === 'mixed' || previous.state === 'mixed') return 'mixed';
  if (current.state !== 'uniform' || previous.state !== 'uniform') return 'unavailable';
  return Object.is(current.value, previous.value) ? 'unchanged' : 'changed';
}

function authoritativeEvidence(view, selectionCount) {
  const previous = fallbackAggregate(view, 'previousAggregate');
  const source = fallbackAggregate(view, 'sourceAggregate');
  const previousSource = fallbackAggregate(view, 'previousSourceAggregate');
  return {
    previous,
    source,
    previousSource,
    previousCount: evidenceCount(view, 'previousEvidenceCount', previous, selectionCount),
    sourceCount: evidenceCount(view, 'sourceEvidenceCount', source, selectionCount),
    previousSourceCount: evidenceCount(
      view,
      'previousSourceEvidenceCount',
      previousSource,
      selectionCount,
    ),
  };
}

function inspectorRow(view, ids, draft) {
  if (!view?.field?.key || !view?.aggregate?.state) throw new TypeError('Inspector property view is invalid.');
  const entries = stagedEntries(ids, view.field.key, draft);
  const changed = entries.filter(changedEntry);
  const messages = validateDraftValues(view.field, changed, ids.length);
  const dirty = changed.length > 0;
  const display = displayValue(view, changed, ids.length);
  const evidence = authoritativeEvidence(view, ids.length);
  return {
    schema: ENGINEERING_SVG_INSPECTOR_ROW_SCHEMA,
    key: view.field.key,
    field: view.field,
    authoritative: view.aggregate,
    previousAuthoritative: evidence.previous,
    sourceAuthoritative: evidence.source,
    previousSourceAuthoritative: evidence.previousSource,
    previousEvidenceCount: evidence.previousCount,
    sourceEvidenceCount: evidence.sourceCount,
    previousSourceEvidenceCount: evidence.previousSourceCount,
    comparisonState: comparisonState(view.aggregate, evidence.previous),
    display,
    dirty,
    valid: messages.length === 0,
    applyEligible: dirty && messages.length === 0 && view.field.editable,
    stagedCount: changed.length,
    messages,
  };
}

export function buildEngineeringSvgInspectorModel(input = {}) {
  const ids = selectedIds(input.selectedIds || []);
  if (!Array.isArray(input.propertyViews)) throw new TypeError('Inspector propertyViews must be an array.');
  const rows = input.propertyViews.map((view) => inspectorRow(view, ids, input.draft || {}));
  const dirtyRows = rows.filter((row) => row.dirty);
  const invalidRows = dirtyRows.filter((row) => !row.valid);
  return freezeJsonValue({
    schema: ENGINEERING_SVG_INSPECTOR_SCHEMA,
    selectedIds: ids,
    rows,
    dirtyCount: dirtyRows.length,
    invalidCount: invalidRows.length,
    applyEligible: dirtyRows.length > 0
      && invalidRows.length === 0
      && dirtyRows.every((row) => row.applyEligible),
  });
}
