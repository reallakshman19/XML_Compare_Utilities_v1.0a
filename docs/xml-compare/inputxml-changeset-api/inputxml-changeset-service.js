import {
  INPUTXML_CHANGESET_APPLY_RESULT_SCHEMA,
  INPUTXML_CHANGESET_DERIVE_RESULT_SCHEMA,
  createCapabilities,
  normalizeApplyRequest,
} from './inputxml-changeset-contracts.js';
import { deriveInputXmlChangeSet } from './inputxml-changeset-derive.js';
import { validateReconciledInputXml } from './inputxml-changeset-output.js';
import { applyChangesToCategorizedSource } from './inputxml-changeset-tree.js';
import { validateInputXmlChangeSet } from './inputxml-changeset-validate.js';

const clean = (value) => String(value ?? '').trim();

function deriveResult(bundle = {}) {
  return Object.freeze({
    schema: INPUTXML_CHANGESET_DERIVE_RESULT_SCHEMA,
    requestId: bundle.normalized.requestId,
    success: bundle.inspection.success && bundle.changeSet.applyReady,
    source: bundle.changeSet.source,
    inspectionSummary: bundle.inspection.summary,
    changeSet: bundle.changeSet,
  });
}

export function deriveCategorizedInputXmlChangeSet(request = {}) {
  return deriveResult(deriveInputXmlChangeSet(request));
}

function receiptRow(change = {}, status = 'skipped', reason = '') {
  return Object.freeze({
    changeId: change.changeId || '',
    lineId: change.lineId || '',
    elementKey: change.elementKey || '',
    field: change.field || '',
    status,
    reason,
    beforeValue: change.beforeValue ?? null,
    afterValue: change.afterValue ?? null,
  });
}

function sameChangeDefinition(left = {}, right = {}) {
  const fields = [
    'changeId', 'lineId', 'elementKey', 'fromNode', 'toNode', 'field',
    'operation', 'beforeValue', 'afterValue', 'sourceElementFingerprint', 'risk',
  ];
  return fields.every((field) => clean(left[field]) === clean(right[field]));
}

function preconditionRows(request = {}, currentSet = {}) {
  const approved = new Set(request.approvedChangeIds), provided = new Map(), current = new Map();
  for (const change of request.changeSet?.changes || []) provided.set(change.changeId, change);
  for (const change of currentSet.changes || []) current.set(change.changeId, change);
  const rows = [];
  for (const change of request.changeSet?.changes || []) {
    if (!approved.has(change.changeId)) rows.push(receiptRow(change, 'skipped', 'not-approved'));
  }
  for (const changeId of approved) {
    const proposed = provided.get(changeId), actual = current.get(changeId);
    if (!proposed) rows.push(receiptRow({ changeId }, 'blocked', 'approved-change-not-in-change-set'));
    else if (!actual) rows.push(receiptRow(proposed, 'conflicted', 'stale-change-precondition'));
    else if (!sameChangeDefinition(proposed, actual)) rows.push(receiptRow(proposed, 'conflicted', 'change-definition-mismatch'));
    else rows.push(receiptRow(actual, 'approved', ''));
  }
  return Object.freeze(rows);
}

function approvedChanges(rows = [], currentSet = {}) {
  const ids = new Set(rows.filter((row) => row.status === 'approved').map((row) => row.changeId));
  return Object.freeze((currentSet.changes || []).filter((change) => ids.has(change.changeId)));
}

function baseName(filename = '') {
  return clean(filename || 'categorized.xml').replace(/\.(xml|txt)$/i, '');
}

function artifacts(filename = '', applied = {}, receipt = {}) {
  const base = baseName(filename);
  return Object.freeze([
    Object.freeze({
      id: 'reconciled-categorized-xml',
      role: 'categorized-source-evidence-synchronized',
      filename: `${base}_reconciled_categorized.xml`,
      mediaType: 'application/xml',
      text: applied.categorizedText,
    }),
    Object.freeze({
      id: 'reconciled-inputxml',
      role: 'approved-changes-applied',
      filename: `${base}_reconciled.input.xml`,
      mediaType: 'application/xml',
      text: applied.inputXmlText,
    }),
    Object.freeze({
      id: 'application-receipt',
      role: 'reconciliation-audit',
      filename: `${base}_inputxml_changeset_receipt.json`,
      mediaType: 'application/json',
      text: `${JSON.stringify(receipt, null, 2)}\n`,
    }),
  ]);
}

function failure(normalized, validation, current, rows, reason) {
  return Object.freeze({
    schema: INPUTXML_CHANGESET_APPLY_RESULT_SCHEMA,
    requestId: normalized.requestId,
    success: false,
    reason,
    source: Object.freeze({ filename: normalized.source.filename, fingerprint: normalized.source.fingerprint }),
    changeSetValidation: validation,
    currentChangeSet: current?.changeSet || null,
    receipt: Object.freeze({ rows: Object.freeze(rows), applied: 0, blocked: rows.filter(isBlocked).length }),
    outputValidation: null,
    artifacts: Object.freeze([]),
  });
}

function isBlocked(row = {}) {
  return ['blocked', 'conflicted'].includes(row.status);
}

function applyReceipt(rows = [], appliedRows = []) {
  const appliedById = new Map(appliedRows.map((row) => [row.changeId, row]));
  const merged = rows.map((row) => appliedById.get(row.changeId) || row);
  return Object.freeze({
    rows: Object.freeze(merged),
    applied: merged.filter((row) => row.status === 'applied').length,
    skipped: merged.filter((row) => row.status === 'skipped').length,
    blocked: merged.filter(isBlocked).length,
  });
}

function applySuccess(normalized, validation, current, receipt, outputValidation, builtArtifacts) {
  return Object.freeze({
    schema: INPUTXML_CHANGESET_APPLY_RESULT_SCHEMA,
    requestId: normalized.requestId,
    success: true,
    reason: '',
    source: Object.freeze({ filename: normalized.source.filename, fingerprint: normalized.source.fingerprint }),
    changeSetValidation: validation,
    currentChangeSet: current.changeSet,
    receipt,
    outputValidation,
    artifacts: builtArtifacts,
  });
}

export function applyCategorizedInputXmlChangeSet(request = {}) {
  const normalized = normalizeApplyRequest(request);
  const validation = validateInputXmlChangeSet(normalized.changeSet);
  if (!validation.success) return failure(normalized, validation, null, [], 'change-set-invalid');
  if (!normalized.changeSet.applyReady || normalized.changeSet.conflicts.length) {
    return failure(normalized, validation, null, [], 'change-set-has-blocking-conflicts');
  }
  const current = deriveInputXmlChangeSet({ source: normalized.source });
  if (!current.changeSet.applyReady) return failure(normalized, validation, current, [], 'current-source-has-blocking-conflicts');
  const rows = preconditionRows(normalized, current.changeSet);
  const selected = approvedChanges(rows, current.changeSet);
  if (rows.some(isBlocked)) return failure(normalized, validation, current, rows, 'approval-precondition-failed');
  if (!selected.length) return failure(normalized, validation, current, rows, 'no-current-approved-changes');
  const applied = applyChangesToCategorizedSource(normalized.source.content, selected);
  const receipt = applyReceipt(rows, applied.receiptRows);
  if (receipt.blocked) return failure(normalized, validation, current, receipt.rows, 'tree-application-failed');
  const outputValidation = validateReconciledInputXml(
    applied.inputXmlText, current.inspection.summary.elements, selected,
  );
  if (!outputValidation.success) return failure(normalized, validation, current, receipt.rows, 'output-validation-failed');
  const draftReceipt = Object.freeze({
    schema: 'InputXmlChangeSetApplicationReceipt.v1',
    changeSetId: current.changeSet.changeSetId,
    sourceFingerprint: normalized.source.fingerprint,
    ...receipt,
    outputValidation,
  });
  return applySuccess(
    normalized, validation, current, draftReceipt, outputValidation,
    artifacts(normalized.source.filename, applied, draftReceipt),
  );
}

export function getInputXmlChangeSetCapabilities() {
  return createCapabilities();
}

export function createInputXmlChangeSetService() {
  return Object.freeze({
    getCapabilities: getInputXmlChangeSetCapabilities,
    derive: deriveCategorizedInputXmlChangeSet,
    validateChangeSet: validateInputXmlChangeSet,
    apply: applyCategorizedInputXmlChangeSet,
  });
}

export const _test = Object.freeze({
  deriveResult,
  receiptRow,
  sameChangeDefinition,
  preconditionRows,
  approvedChanges,
  baseName,
  artifacts,
  failure,
  isBlocked,
  applyReceipt,
  applySuccess,
});
