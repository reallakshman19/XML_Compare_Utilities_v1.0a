import {
  compareOutsideWriter2NodeNameAuthority,
  deriveExpectedNodeNameDelta,
  parseIndependentNodeNameState,
} from './cii-workspace-multisource-texpected-oracle.js';

const ELEMENT_ROWS = 15;
const POINTER_ROW = 13;
const FIELD_PREFIX = 2;
const FIELD_WIDTH = 13;
const POINTER_FIELD = 5;
const NODENAME_FROM_START = 2;
const NODENAME_TO_START = 28;
const NODENAME_END = 53;
const SMART_NAME = /^(?:\/)?\s*(SL|PS)[\s._-]*(\d+[A-Z]*)(?:\.(\d+))?\s*(?:\/)?$/i;

function text(value) { return String(value ?? '').trim(); }
function cleanLine(line) { return String(line ?? '').replace(/\r$/, ''); }
function lines(value) { return String(value ?? '').split('\n').map(cleanLine); }
function headerName(line) {
  const match = cleanLine(line).match(/^\s*#\$\s+([^\s]+)/);
  return match ? match[1].toUpperCase() : null;
}
function sectionRows(value, wanted) {
  const target = String(wanted).toUpperCase(); let active = false; const rows = [];
  for (const line of lines(value)) {
    const header = headerName(line);
    if (header) { active = header === target; continue; }
    if (active) rows.push(line);
  }
  return rows;
}
function fixedField(row, index) {
  const start = FIELD_PREFIX + (index * FIELD_WIDTH); const end = start + FIELD_WIDTH;
  return String(row ?? '').padEnd(end, ' ').slice(start, end);
}
function normalizeDigits(value) { return String(value || '').replace(/^0+(?=\d)/, '') || '0'; }

export function partialExpectedFamilyKey(value) {
  const match = text(value).match(SMART_NAME);
  return match ? `${String(match[1]).toUpperCase()}-${normalizeDigits(match[2])}` : null;
}
function isFamilyOnly(value) {
  const match = text(value).match(SMART_NAME);
  return Boolean(match && !match[3]);
}
export function partialExpectedNameMatch(actualValue, expectedValue) {
  const actual = text(actualValue); const expected = text(expectedValue);
  if (actual === expected) return Object.freeze({ match: true, kind: 'EXACT', actual, expected });
  const actualFamily = partialExpectedFamilyKey(actual);
  const expectedFamily = partialExpectedFamilyKey(expected);
  const familyMatch = isFamilyOnly(expected) && actualFamily && expectedFamily && actualFamily === expectedFamily;
  return Object.freeze({ match: Boolean(familyMatch), kind: familyMatch ? 'PARTIAL_EXPECTED_FAMILY' : 'NONE', actual, expected });
}

export function structuralTransferKey(action, target) {
  return `${text(action)}|${text(target)}`;
}
export function expectedStructuralTransferKeys(deltaRows = []) {
  return Object.freeze((deltaRows || []).filter((row) => ['CREATE', 'DELETE'].includes(row.action))
    .map((row) => structuralTransferKey(row.action, row.nodeId)).sort());
}
export function expectedNodeNameTransferKeys(deltaRows = []) {
  return Object.freeze((deltaRows || []).map((row) => structuralTransferKey(row.action === 'REPLACE' ? 'COPY' : row.action, row.nodeId)).sort());
}

function unslash(value) { return text(value).replace(/^\//, ''); }
function sourceNameSet(sourceText) { return new Set(parseIndependentNodeNameState(sourceText).names.values()); }
function operationTarget(operation) { return text(operation?.targetEvidence?.identity || operation?.targetEvidence?.nodeId); }
function operationValue(operation) {
  const action = text(operation?.action);
  return text(['CREATE', 'COPY'].includes(action)
    ? (operation?.proposed ?? operation?.sourceEvidence?.value)
    : (operation?.before ?? operation?.targetEvidence?.value));
}
function operationBefore(operation) { return text(operation?.before ?? operation?.targetEvidence?.value); }
function bmTargetName(operation) {
  return text(operation?.bm001Acceptance?.targetName ?? operation?.targetEvidence?.value ?? operation?.before);
}
function bmRowsForSourceAlias(sourceName, bmRows) {
  const wanted = unslash(sourceName);
  return (bmRows || []).filter((row) => (row?.sourceNames || []).some((name) => unslash(name) === wanted));
}
function liveTargetNameSet(targetState) {
  return new Set([...(targetState?.names?.values?.() || [])].map(text).filter(Boolean));
}
function liveBmRowsForSourceAlias(sourceName, bmRows, targetNames) {
  const live = targetNames instanceof Set ? targetNames : new Set(targetNames || []);
  return bmRowsForSourceAlias(sourceName, bmRows).filter((row) => live.has(text(row?.targetName)));
}
function bmExactAliasMatch(operation, bmRows, targetNames = null) {
  const sourceName = operationValue(operation); const targetName = bmTargetName(operation);
  if (!sourceName || !targetName) return false;
  const rows = targetNames == null
    ? bmRowsForSourceAlias(sourceName, bmRows)
    : liveBmRowsForSourceAlias(sourceName, bmRows, targetNames);
  return rows.some((row) => text(row?.targetName) === targetName);
}

export function validateRawMutationIdentity(operations, sourceTextsById, targetText, bmRows = []) {
  const sourceSets = new Map(Object.entries(sourceTextsById || {}).map(([id, value]) => [id, sourceNameSet(value)]));
  const target = parseIndependentNodeNameState(targetText); const errors = []; const sourceOnlyCreateOperationIds = [];
  const nonApplicableBmAliasOperationIds = []; const targetNames = liveTargetNameSet(target);
  for (const operation of operations || []) {
    const action = text(operation?.action); const sourceId = text(operation?.sourceId);
    const targetId = operationTarget(operation); const value = operationValue(operation); const before = operationBefore(operation);
    if (['CREATE', 'COPY'].includes(action)) {
      if (!sourceSets.get(sourceId)?.has(value)) errors.push(Object.freeze({ code: `${action}_VALUE_NOT_EXACT_SOURCE_NAME`, operationId: operation?.operationId, sourceId, targetId, value }));
      if (action === 'CREATE' && text(target.names.get(targetId))) {
        errors.push(Object.freeze({ code: 'CREATE_TARGET_PREIMAGE_NOT_BLANK', operationId: operation?.operationId, targetId, actual: target.names.get(targetId) }));
      }
      if (action === 'COPY' && target.names.get(targetId) !== before) {
        errors.push(Object.freeze({ code: 'COPY_VALUE_NOT_EXACT_TARGET_PREIMAGE', operationId: operation?.operationId, targetId, before, expected: target.names.get(targetId) || '' }));
      }
      const aliasRows = bmRowsForSourceAlias(value, bmRows);
      const liveAliasRows = liveBmRowsForSourceAlias(value, bmRows, targetNames);
      if (liveAliasRows.length && !bmExactAliasMatch(operation, bmRows, targetNames)) {
        errors.push(Object.freeze({ code: `${action}_VALUE_NOT_EXACT_BM_ALIAS_FOR_TARGET`, operationId: operation?.operationId, sourceId, targetId, value, targetName: bmTargetName(operation) }));
      } else if (aliasRows.length && !liveAliasRows.length) {
        nonApplicableBmAliasOperationIds.push(text(operation?.operationId));
      } else if (action === 'CREATE' && !aliasRows.length) sourceOnlyCreateOperationIds.push(text(operation?.operationId));
    } else if (action === 'DELETE' && target.names.get(targetId) !== value) {
      errors.push(Object.freeze({ code: 'DELETE_VALUE_NOT_EXACT_TARGET_PREIMAGE', operationId: operation?.operationId, targetId, value, expected: target.names.get(targetId) || '' }));
    }
  }
  return Object.freeze({
    status: errors.length ? 'BLOCKED' : 'READY', errors: Object.freeze(errors),
    sourceOnlyCreateOperationIds: Object.freeze(sourceOnlyCreateOperationIds.filter(Boolean).sort()),
    nonApplicableBmAliasOperationIds: Object.freeze(nonApplicableBmAliasOperationIds.filter(Boolean).sort()),
  });
}
export function validateAppliedRawIdentity(actualText, operations) {
  const actual = parseIndependentNodeNameState(actualText); const errors = [];
  for (const operation of operations || []) {
    const action = text(operation?.action); const targetId = operationTarget(operation); const value = operationValue(operation);
    if (['CREATE', 'COPY'].includes(action) && actual.names.get(targetId) !== value) {
      errors.push(Object.freeze({ code: `${action}_RAW_NAME_NOT_EMITTED_EXACTLY`, operationId: operation?.operationId, targetId, value, actual: actual.names.get(targetId) || '' }));
    }
    if (action === 'DELETE' && text(actual.names.get(targetId))) errors.push(Object.freeze({ code: 'DELETE_TARGET_NOT_EMPTY', operationId: operation?.operationId, targetId, value, actual: actual.names.get(targetId) || '' }));
  }
  return Object.freeze({ status: errors.length ? 'BLOCKED' : 'READY', errors: Object.freeze(errors) });
}
export function validateKnownPositiveNodeNames(actualText, deltaRows = [], operations = []) {
  const actual = parseIndependentNodeNameState(actualText); const differences = []; const explanations = [];
  for (const row of deltaRows || []) {
    const nodeId = text(row.nodeId); const expected = text(row.newValue); const observed = text(actual.names.get(nodeId));
    if (partialExpectedNameMatch(observed, expected).match) continue;
    const expectedAction = row.action === 'REPLACE' ? 'COPY' : text(row.action);
    const operation = (operations || []).find((item) => operationTarget(item) === nodeId
      && text(item?.action) === expectedAction && operationValue(item) === observed);
    if (operation) {
      explanations.push(Object.freeze({
        code: 'KNOWN_POSITIVE_EXPLAINED_BY_SELECTED_RAW_SOURCE_IDENTITY',
        nodeId, action: row.action, partialExpected: expected, selectedRawPostimage: observed, operationId: operation?.operationId || null,
      }));
      continue;
    }
    differences.push(Object.freeze({
      code: 'KNOWN_POSITIVE_NODENAME_MISMATCH', nodeId, action: row.action, expected, actual: observed,
    }));
  }
  return Object.freeze({
    status: differences.length ? 'BLOCKED' : 'READY',
    differences: Object.freeze(differences),
    explanations: Object.freeze(explanations),
  });
}
export function validateUnselectedNodeNamePayloadPreservation(beforeText, actualText, operations = []) {
  const before = parseIndependentNodeNameState(beforeText); const actual = parseIndependentNodeNameState(actualText);
  const selectedTargets = new Set((operations || []).map(operationTarget).filter(Boolean)); const differences = [];
  for (const [nodeId, beforeName] of before.names) {
    if (selectedTargets.has(String(nodeId))) continue;
    const actualName = actual.names.get(String(nodeId)) || '';
    if (actualName !== beforeName) differences.push(Object.freeze({ code: 'UNSELECTED_NODENAME_PAYLOAD_CHANGED', nodeId: String(nodeId), before: beforeName, actual: actualName }));
  }
  for (const [nodeId, actualName] of actual.names) {
    if (selectedTargets.has(String(nodeId)) || before.names.has(String(nodeId)) || !text(actualName)) continue;
    differences.push(Object.freeze({ code: 'UNSELECTED_NODENAME_CREATED', nodeId: String(nodeId), actual: actualName }));
  }
  return Object.freeze({ status: differences.length ? 'BLOCKED' : 'READY', differences: Object.freeze(differences) });
}

function integerField(row, index) {
  const raw = fixedField(row, index).trim().replace(/[dD]/g, 'E'); const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}
function validateActualNodeNameEncoding(actualText) {
  const differences = []; const control = sectionRows(actualText, 'CONTROL'); const elements = sectionRows(actualText, 'ELEMENTS'); const names = sectionRows(actualText, 'NODENAME');
  const count = integerField(control[0], 3);
  if (count === null || count !== names.length) differences.push(Object.freeze({ code: 'CONTROL_NONAM_SELF_INCONSISTENT', controlCount: count, physicalRows: names.length }));
  if (elements.length % ELEMENT_ROWS !== 0) differences.push(Object.freeze({ code: 'ELEMENT_ROW_COUNT_NOT_MULTIPLE_OF_15', count: elements.length }));
  else for (let row = POINTER_ROW; row < elements.length; row += ELEMENT_ROWS) {
    const pointer = integerField(elements[row], POINTER_FIELD);
    if (pointer === null || pointer > names.length) differences.push(Object.freeze({ code: 'ELEMENT_NODENAME_POINTER_INVALID', elementIndex: Math.floor(row / ELEMENT_ROWS), pointer, rowCount: names.length }));
  }
  for (let index = 0; index < names.length; index += 1) {
    const row = String(names[index] ?? '');
    if (row.length !== NODENAME_END) differences.push(Object.freeze({ code: 'NODENAME_ROW_WIDTH_INVALID', rowIndex: index, width: row.length }));
    for (const [field, start, end] of [['FROM', NODENAME_FROM_START, NODENAME_TO_START], ['TO', NODENAME_TO_START, NODENAME_END]]) {
      const raw = row.padEnd(end, ' ').slice(start, end); const trimmed = raw.trim();
      if (raw !== trimmed.padEnd(end - start, ' ')) differences.push(Object.freeze({ code: 'NODENAME_FIELD_ENCODING_MISMATCH', rowIndex: index, field }));
    }
  }
  return Object.freeze({ differences: Object.freeze(differences), familyExpansions: Object.freeze([]) });
}

export function evaluatePartialTExpectedPostimage(beforeText, actualText, partialExpectedText, operations = []) {
  const requiredDelta = deriveExpectedNodeNameDelta(beforeText, partialExpectedText);
  const encoding = validateActualNodeNameEncoding(actualText);
  const knownPositive = validateKnownPositiveNodeNames(actualText, requiredDelta.rows, operations);
  const semantics = Object.freeze({
    differences: knownPositive.differences,
    familyExpansions: Object.freeze([]),
    explanations: knownPositive.explanations,
    requiredDeltaCount: requiredDelta.rows.length,
    actual: parseIndependentNodeNameState(actualText),
    expected: parseIndependentNodeNameState(partialExpectedText),
  });
  const preservation = compareOutsideWriter2NodeNameAuthority(beforeText, actualText);
  const nodeNamePayloadPreservation = validateUnselectedNodeNamePayloadPreservation(beforeText, actualText, operations);
  const status = !encoding.differences.length && knownPositive.status === 'READY'
    && preservation.status === 'READY' && nodeNamePayloadPreservation.status === 'READY' ? 'READY' : 'BLOCKED';
  return Object.freeze({ status, encoding, semantics, preservation, nodeNamePayloadPreservation, knownPositive });
}

export const _test = Object.freeze({
  sectionRows, fixedField, isFamilyOnly, bmTargetName, bmExactAliasMatch, bmRowsForSourceAlias,
  liveTargetNameSet, liveBmRowsForSourceAlias,
  operationValue, operationBefore, integerField, validateActualNodeNameEncoding,
});
