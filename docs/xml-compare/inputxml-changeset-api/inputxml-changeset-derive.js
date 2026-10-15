import { inspectCategorizedInputXml } from '../categorized-inputxml-api/categorized-inputxml-api-service.js';
import {
  INPUTXML_CHANGE_CONFLICT_SCHEMA,
  INPUTXML_CHANGE_SCHEMA,
  INPUTXML_CHANGESET_SCHEMA,
  RECONCILABLE_FIELDS,
  changeSetSummary,
  normalizeDeriveRequest,
  stableId,
} from './inputxml-changeset-contracts.js';

const clean = (value) => String(value ?? '').trim();
const FIELD_ORDER = Object.freeze(Object.keys(RECONCILABLE_FIELDS));

function sameValue(left, right) {
  const a = clean(left), b = clean(right);
  if (a === b) return true;
  const an = Number(a), bn = Number(b);
  return Number.isFinite(an) && Number.isFinite(bn) && Math.abs(an - bn) < 1e-9;
}

function conflict(code, message, location = {}, details = {}) {
  return Object.freeze({
    schema: INPUTXML_CHANGE_CONFLICT_SCHEMA,
    conflictId: stableId('conflict', [code, location.lineId, location.elementKey, message]),
    code,
    message,
    blocking: details.blocking !== false,
    location: Object.freeze({ ...location }),
    expectedValue: details.expectedValue ?? null,
    actualValue: details.actualValue ?? null,
    action: details.action || 'resolve-before-apply',
  });
}

function change(line, element, field, beforeValue, afterValue) {
  const policy = RECONCILABLE_FIELDS[field];
  const operation = clean(beforeValue) ? 'replace' : 'add';
  const parts = [line.lineId, element.elementKey, field, beforeValue, afterValue, element.original.xml];
  return Object.freeze({
    schema: INPUTXML_CHANGE_SCHEMA,
    changeId: stableId('change', parts),
    lineId: line.lineId,
    elementKey: element.elementKey,
    fromNode: element.fromNode,
    toNode: element.toNode,
    field,
    operation,
    beforeValue: clean(beforeValue) || null,
    afterValue: clean(afterValue),
    sourceElementFingerprint: stableId('element', [element.original.xml]),
    risk: policy.risk,
    approvalRequired: true,
    status: 'proposed',
  });
}

function duplicateValues(values = []) {
  const counts = new Map();
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value);
}

function duplicateConflicts(model = {}) {
  const rows = [];
  for (const lineId of duplicateValues((model.lines || []).map((line) => line.lineId))) rows.push(conflict(
    'LINE_ID_DUPLICATE', 'Line identity is ambiguous.', { lineId }, { actualValue: lineId },
  ));
  for (const line of model.lines || []) {
    for (const key of duplicateValues((line.elements || []).map((element) => element.elementKey))) rows.push(conflict(
      'ELEMENT_KEY_DUPLICATE', 'Element identity is ambiguous within the line.',
      { lineId: line.lineId, elementKey: key }, { actualValue: key },
    ));
  }
  return rows;
}

function evidenceConflict(line, element) {
  const at = { lineId: line.lineId, elementKey: element.elementKey };
  if (element.original.count === 0) return conflict('ORIGINAL_ELEMENT_MISSING', 'OriginalElement source evidence is missing.', at);
  if (element.original.count > 1) return conflict('ORIGINAL_ELEMENT_DUPLICATE', 'OriginalElement source evidence is duplicated.', at);
  if (!element.original.usable) return conflict('ORIGINAL_ELEMENT_INVALID', 'OriginalElement does not contain PIPINGELEMENT.', at);
  return null;
}

function identityConflicts(line, element) {
  const rows = [], attrs = element.original.attrs || {};
  const checks = [['FROM_NODE', element.fromNode], ['TO_NODE', element.toNode]];
  for (const [field, expected] of checks) {
    const actual = clean(attrs[field]);
    if (!sameValue(actual, expected)) rows.push(conflict(
      'NODE_IDENTITY_CONFLICT', `${field} differs between hierarchy and source evidence.`,
      { lineId: line.lineId, elementKey: element.elementKey, field },
      { expectedValue: expected, actualValue: actual },
    ));
  }
  return rows;
}

function lineValueConflict(line, element) {
  const blockValue = clean(element.normalizedFields?.LINE_ID);
  if (!blockValue || sameValue(blockValue, line.lineId)) return null;
  return conflict(
    'LINE_VALUE_CONFLICT', 'Line hierarchy and normalized LINE_ID disagree.',
    { lineId: line.lineId, elementKey: element.elementKey, field: 'LINE_ID' },
    { expectedValue: line.lineId, actualValue: blockValue },
  );
}

function targetValue(line, element, field) {
  if (field === 'LINE_ID') return clean(element.normalizedFields?.LINE_ID || line.lineId);
  return clean(element.normalizedFields?.[field]);
}

function changesForElement(line, element) {
  const rows = [], attrs = element.original.attrs || {};
  for (const field of FIELD_ORDER) {
    const after = targetValue(line, element, field);
    if (!after) continue;
    const before = clean(attrs[field]);
    if (sameValue(before, after)) continue;
    if (!before && !RECONCILABLE_FIELDS[field].allowAdd) continue;
    rows.push(change(line, element, field, before, after));
  }
  return rows;
}

function deriveElement(line, element) {
  const conflicts = [], evidence = evidenceConflict(line, element);
  if (evidence) conflicts.push(evidence);
  conflicts.push(...identityConflicts(line, element));
  const lineConflict = lineValueConflict(line, element);
  if (lineConflict) conflicts.push(lineConflict);
  return Object.freeze({
    changes: conflicts.length ? Object.freeze([]) : Object.freeze(changesForElement(line, element)),
    conflicts: Object.freeze(conflicts),
  });
}

function documentConflicts(inspection = {}) {
  const rows = duplicateConflicts(inspection.document);
  if (inspection.document.rootName !== 'CategorizedInputXML') rows.push(conflict(
    'ROOT_INVALID', 'Root element must be CategorizedInputXML.', {}, { actualValue: inspection.document.rootName },
  ));
  if (inspection.document.documentSchema !== 'categorized-inputxml/v3') rows.push(conflict(
    'SCHEMA_INVALID', 'Reconciliation requires categorized-inputxml/v3.', {},
    { actualValue: inspection.document.documentSchema || null },
  ));
  return rows;
}

export function deriveInputXmlChangeSet(request = {}) {
  const normalized = normalizeDeriveRequest(request);
  const inspection = inspectCategorizedInputXml({
    requestId: normalized.requestId,
    source: normalized.source,
    options: { schemaPolicy: 'require-v3', diagnosticsLevel: 'full' },
  });
  const changes = [], conflicts = documentConflicts(inspection);
  for (const line of inspection.document.lines || []) {
    for (const element of line.elements || []) {
      const derived = deriveElement(line, element);
      changes.push(...derived.changes);
      conflicts.push(...derived.conflicts);
    }
  }
  const changeSet = Object.freeze({
    schema: INPUTXML_CHANGESET_SCHEMA,
    changeSetId: stableId('changeset', [normalized.source.fingerprint, ...changes.map((item) => item.changeId)]),
    source: Object.freeze({ filename: normalized.source.filename, fingerprint: normalized.source.fingerprint }),
    createdFromSchema: inspection.document.documentSchema,
    applyReady: !conflicts.some((item) => item.blocking),
    changes: Object.freeze(changes),
    conflicts: Object.freeze(conflicts),
    summary: changeSetSummary(changes, conflicts),
  });
  return Object.freeze({ normalized, inspection, changeSet });
}

export const _test = Object.freeze({
  sameValue,
  conflict,
  change,
  duplicateValues,
  duplicateConflicts,
  evidenceConflict,
  identityConflicts,
  lineValueConflict,
  targetValue,
  changesForElement,
  deriveElement,
  documentConflicts,
});
