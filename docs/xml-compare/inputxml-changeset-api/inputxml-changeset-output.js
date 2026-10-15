import { attrsOfOpenTag } from '../categorized-inputxml-api/categorized-inputxml-api-model.js';

const clean = (value) => String(value ?? '').trim();

function sameValue(left, right) {
  const a = clean(left), b = clean(right);
  if (a === b) return true;
  const an = Number(a), bn = Number(b);
  return Number.isFinite(an) && Number.isFinite(bn) && Math.abs(an - bn) < 1e-9;
}

export function pipingElementRows(text = '') {
  const rows = [], pattern = /<PIPINGELEMENT\b[^>]*>/gi;
  let match;
  while ((match = pattern.exec(String(text ?? '')))) rows.push(Object.freeze({
    openTag: match[0],
    attrs: attrsOfOpenTag(match[0], 'PIPINGELEMENT'),
  }));
  return Object.freeze(rows);
}

function expectedLine(change = {}, approvedChanges = []) {
  const lineChange = approvedChanges.find((item) => item.elementKey === change.elementKey
    && item.lineId === change.lineId && item.field === 'LINE_ID');
  return clean(lineChange?.afterValue || change.lineId);
}

function rowForChange(rows = [], change = {}, approvedChanges = []) {
  const line = expectedLine(change, approvedChanges);
  return rows.find((row) => sameValue(row.attrs.FROM_NODE, change.fromNode)
    && sameValue(row.attrs.TO_NODE, change.toNode)
    && clean(row.attrs.LINE_ID) === line) || null;
}

function finding(code, message, change = {}, details = {}) {
  return Object.freeze({
    code,
    message,
    changeId: change.changeId || '',
    lineId: change.lineId || '',
    elementKey: change.elementKey || '',
    field: change.field || '',
    expectedValue: details.expectedValue ?? null,
    actualValue: details.actualValue ?? null,
  });
}

function validateAppliedChange(rows = [], change = {}, approvedChanges = []) {
  const row = rowForChange(rows, change, approvedChanges);
  if (!row) return finding('OUTPUT_ELEMENT_NOT_FOUND', 'Applied element was not found in reconciled InputXML.', change);
  const actual = row.attrs[change.field];
  if (!sameValue(actual, change.afterValue)) return finding(
    'OUTPUT_VALUE_MISMATCH', 'Reconciled InputXML does not contain the approved value.',
    change, { expectedValue: change.afterValue, actualValue: actual ?? null },
  );
  return null;
}

export function validateReconciledInputXml(text = '', expectedElements = 0, approvedChanges = []) {
  const findings = [], body = String(text ?? ''), rows = pipingElementRows(body);
  if (!/<CAESARII\b[^>]*XML_TYPE=["']Input["']/i.test(body)) findings.push(finding(
    'INPUTXML_ROOT_INVALID', 'Reconciled artifact is not CAESAR II InputXML.',
  ));
  if (!/<PIPINGMODEL\b/i.test(body)) findings.push(finding(
    'PIPINGMODEL_MISSING', 'Reconciled artifact has no PIPINGMODEL.',
  ));
  if (rows.length !== expectedElements) findings.push(finding(
    'ELEMENT_COUNT_MISMATCH', 'Reconciled PIPINGELEMENT count differs from the categorized source.',
    {}, { expectedValue: expectedElements, actualValue: rows.length },
  ));
  for (const change of approvedChanges) {
    const result = validateAppliedChange(rows, change, approvedChanges);
    if (result) findings.push(result);
  }
  return Object.freeze({
    success: findings.length === 0,
    elementCount: rows.length,
    findings: Object.freeze(findings),
  });
}

export const _test = Object.freeze({
  sameValue,
  expectedLine,
  rowForChange,
  finding,
  validateAppliedChange,
});
