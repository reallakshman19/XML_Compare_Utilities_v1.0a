import {
  INPUTXML_CHANGE_SCHEMA,
  INPUTXML_CHANGESET_SCHEMA,
  INPUTXML_CHANGESET_VALIDATION_SCHEMA,
  isSupportedField,
} from './inputxml-changeset-contracts.js';

const clean = (value) => String(value ?? '').trim();

function issue(code, message, location = {}) {
  return Object.freeze({ code, message, location: Object.freeze({ ...location }) });
}

function validateChange(change = {}, index = 0) {
  const rows = [], at = { index, changeId: clean(change.changeId) };
  if (change.schema !== INPUTXML_CHANGE_SCHEMA) rows.push(issue('CHANGE_SCHEMA_INVALID', 'Change schema must be InputXmlChange.v1.', at));
  if (!clean(change.changeId)) rows.push(issue('CHANGE_ID_MISSING', 'Change ID is required.', at));
  if (!clean(change.lineId)) rows.push(issue('LINE_ID_MISSING', 'Change line identity is required.', at));
  if (!clean(change.elementKey)) rows.push(issue('ELEMENT_KEY_MISSING', 'Change element identity is required.', at));
  if (!isSupportedField(change.field)) rows.push(issue('FIELD_UNSUPPORTED', 'Change field is not supported.', { ...at, field: change.field }));
  if (!['add', 'replace'].includes(change.operation)) rows.push(issue('OPERATION_INVALID', 'Operation must be add or replace.', at));
  if (!clean(change.afterValue)) rows.push(issue('AFTER_VALUE_MISSING', 'After value is required.', at));
  if (!clean(change.sourceElementFingerprint)) rows.push(issue('ELEMENT_FINGERPRINT_MISSING', 'Source element fingerprint is required.', at));
  if (change.approvalRequired !== true) rows.push(issue('APPROVAL_POLICY_INVALID', 'Every v1 change must require explicit approval.', at));
  return rows;
}

function duplicateIssues(changes = []) {
  const rows = [], ids = new Map(), targets = new Map();
  for (const change of changes) {
    const id = clean(change.changeId);
    const target = [change.lineId, change.elementKey, change.field].map(clean).join('|');
    if (id) ids.set(id, (ids.get(id) || 0) + 1);
    if (target !== '||') targets.set(target, (targets.get(target) || 0) + 1);
  }
  for (const [changeId, count] of ids) if (count > 1) rows.push(issue('CHANGE_ID_DUPLICATE', 'Change ID must be unique.', { changeId }));
  for (const [target, count] of targets) if (count > 1) rows.push(issue('CHANGE_TARGET_DUPLICATE', 'Only one change may target an element field.', { target }));
  return rows;
}

function conflictIssues(conflicts = []) {
  const rows = [];
  for (const [index, conflict] of conflicts.entries()) {
    if (!clean(conflict.conflictId)) rows.push(issue('CONFLICT_ID_MISSING', 'Conflict ID is required.', { index }));
    if (!clean(conflict.code)) rows.push(issue('CONFLICT_CODE_MISSING', 'Conflict code is required.', { index }));
    if (conflict.blocking !== true) rows.push(issue('CONFLICT_POLICY_INVALID', 'v1 conflicts must be explicitly blocking.', { index }));
  }
  return rows;
}

export function validateInputXmlChangeSet(changeSet = null) {
  const issues = [];
  if (!changeSet || typeof changeSet !== 'object') issues.push(issue('CHANGESET_REQUIRED', 'Change set object is required.'));
  else {
    if (changeSet.schema !== INPUTXML_CHANGESET_SCHEMA) issues.push(issue('CHANGESET_SCHEMA_INVALID', 'Change-set schema must be InputXmlChangeSet.v1.'));
    if (!clean(changeSet.changeSetId)) issues.push(issue('CHANGESET_ID_MISSING', 'Change-set ID is required.'));
    if (!clean(changeSet.source?.fingerprint)) issues.push(issue('SOURCE_FINGERPRINT_MISSING', 'Source fingerprint is required.'));
    const changes = Array.isArray(changeSet.changes) ? changeSet.changes : [];
    const conflicts = Array.isArray(changeSet.conflicts) ? changeSet.conflicts : [];
    if (!Array.isArray(changeSet.changes)) issues.push(issue('CHANGES_INVALID', 'Changes must be an array.'));
    if (!Array.isArray(changeSet.conflicts)) issues.push(issue('CONFLICTS_INVALID', 'Conflicts must be an array.'));
    changes.forEach((change, index) => issues.push(...validateChange(change, index)));
    issues.push(...duplicateIssues(changes));
    issues.push(...conflictIssues(conflicts));
  }
  return Object.freeze({
    schema: INPUTXML_CHANGESET_VALIDATION_SCHEMA,
    success: issues.length === 0,
    issues: Object.freeze(issues),
  });
}

export const _test = Object.freeze({ issue, validateChange, duplicateIssues, conflictIssues });
