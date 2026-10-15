const ELEMENT_ROWS = 15;
const POINTER_ROW = 13;
const FIELD_PREFIX = 2;
const FIELD_WIDTH = 13;
const POINTER_FIELD = 5;
const NODENAME_FROM_START = 2;
const NODENAME_TO_START = 28;
const NODENAME_END = 53;

function cleanLine(line) { return String(line ?? '').replace(/\r$/, ''); }
function lines(text) { return String(text ?? '').split('\n').map(cleanLine); }
function headerName(line) {
  const match = cleanLine(line).match(/^\s*#\$\s+([^\s]+)/);
  return match ? match[1].toUpperCase() : null;
}
function sectionRows(text, wanted) {
  const all = lines(text); const target = String(wanted).toUpperCase(); let active = false; const rows = [];
  for (const line of all) {
    const header = headerName(line);
    if (header) { active = header === target; continue; }
    if (active) rows.push(line);
  }
  return rows;
}
function numericToken(value) { return String(value ?? '').trim().replace(/[dD]/g, 'E'); }
function numericField(row, index) {
  const start = FIELD_PREFIX + (index * FIELD_WIDTH);
  return numericToken(String(row ?? '').padEnd(start + FIELD_WIDTH, ' ').slice(start, start + FIELD_WIDTH));
}
function finiteField(row, index) {
  const value = Number(numericField(row, index));
  return Number.isFinite(value) ? value : null;
}
function integerField(row, index) {
  const value = finiteField(row, index);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}
function nodeId(value) { return String(Math.round(Number(value))); }
function namePair(row) {
  const padded = String(row ?? '').padEnd(NODENAME_END, ' ');
  return Object.freeze({
    fromName: padded.slice(NODENAME_FROM_START, NODENAME_TO_START).trim(),
    toName: padded.slice(NODENAME_TO_START, NODENAME_END).trim(),
  });
}
function assignName(names, conflicts, id, name, evidence) {
  if (!name) return;
  const previous = names.get(id);
  if (previous && previous !== name) {
    conflicts.push(Object.freeze({ nodeId: id, previous, next: name, ...evidence }));
    return;
  }
  names.set(id, name);
}
function controlNodeNameCount(text) {
  const rows = sectionRows(text, 'CONTROL');
  return rows.length ? integerField(rows[0], 3) : null;
}

export function parseIndependentNodeNameState(text) {
  const elementRows = sectionRows(text, 'ELEMENTS');
  const nodeNameRows = sectionRows(text, 'NODENAME');
  const names = new Map(); const conflicts = []; const elements = [];
  if (elementRows.length % ELEMENT_ROWS !== 0) throw new Error('ORACLE_ELEMENT_ROW_COUNT_NOT_MULTIPLE_OF_15');
  for (let offset = 0, index = 0; offset < elementRows.length; offset += ELEMENT_ROWS, index += 1) {
    const fromValue = finiteField(elementRows[offset], 0); const toValue = finiteField(elementRows[offset], 1);
    const pointer = integerField(elementRows[offset + POINTER_ROW], POINTER_FIELD);
    if (fromValue === null || toValue === null || pointer === null) throw new Error(`ORACLE_ELEMENT_PARSE_FAILED:${index}`);
    const from = nodeId(fromValue); const to = nodeId(toValue);
    if (pointer > nodeNameRows.length) throw new Error(`ORACLE_NODENAME_POINTER_OUT_OF_RANGE:${index}:${pointer}`);
    const pair = pointer ? namePair(nodeNameRows[pointer - 1]) : { fromName: '', toName: '' };
    elements.push(Object.freeze({ index, from, to, pointer, fromName: pair.fromName, toName: pair.toName }));
    assignName(names, conflicts, from, pair.fromName, { elementIndex: index, end: 'FROM', pointer });
    assignName(names, conflicts, to, pair.toName, { elementIndex: index, end: 'TO', pointer });
  }
  return Object.freeze({
    names,
    conflicts: Object.freeze(conflicts),
    elements: Object.freeze(elements),
    physicalNodeNameRowCount: nodeNameRows.length,
    controlNodeNameCount: controlNodeNameCount(text),
  });
}

export function deriveExpectedNodeNameDelta(beforeText, expectedText) {
  const before = parseIndependentNodeNameState(beforeText);
  const expected = parseIndependentNodeNameState(expectedText);
  const ids = [...new Set([...before.names.keys(), ...expected.names.keys()])]
    .sort((a, b) => Number(a) - Number(b));
  const rows = ids.flatMap((id) => {
    const oldValue = before.names.get(id) || ''; const newValue = expected.names.get(id) || '';
    if (oldValue === newValue) return [];
    const action = !oldValue && newValue ? 'CREATE' : (oldValue && !newValue ? 'DELETE' : 'REPLACE');
    return [Object.freeze({ nodeId: id, action, oldValue, newValue })];
  });
  return Object.freeze({ before, expected, rows: Object.freeze(rows) });
}

export function deriveExactNameRelocations(deltaRows) {
  const deleted = new Map(); const created = new Map();
  for (const row of deltaRows || []) {
    const value = row.action === 'DELETE' ? row.oldValue : (row.action === 'CREATE' ? row.newValue : '');
    if (!value) continue;
    const bucket = row.action === 'DELETE' ? deleted : created;
    if (!bucket.has(value)) bucket.set(value, []);
    bucket.get(value).push(row.nodeId);
  }
  const rows = [];
  for (const [name, fromIds] of deleted) {
    const toIds = created.get(name) || [];
    if (fromIds.length === 1 && toIds.length === 1) rows.push(Object.freeze({ name, fromNodeId: fromIds[0], toNodeId: toIds[0] }));
  }
  return Object.freeze(rows.sort((a, b) => Number(a.fromNodeId) - Number(b.fromNodeId)));
}

export function expectedTransferKeys(deltaRows) {
  return Object.freeze((deltaRows || []).filter((row) => ['CREATE', 'DELETE'].includes(row.action))
    .map((row) => `${row.action}|${row.nodeId}|${row.action === 'CREATE' ? row.newValue : row.oldValue}`)
    .sort());
}

function suffixOnlyValue(actual, expected) {
  const match = String(expected || '').match(/^(.*)\.(\d+)$/);
  return Boolean(match && String(actual || '') === match[1]);
}
function compareNameField(actual, expected, lineIndex, end, result) {
  if (actual === expected) return;
  if (suffixOnlyValue(actual, expected)) result.suffixOnly.push(Object.freeze({ lineIndex, end, actual, expected }));
  else result.nonSuffix.push(Object.freeze({ lineIndex, end, actual, expected }));
}
function isNodeNameHeader(line) { return headerName(line) === 'NODENAME'; }

export function comparePostimageAllowingOnlySuffix(actualText, expectedText) {
  const actual = lines(actualText); const expected = lines(expectedText);
  const result = { suffixOnly: [], nonSuffix: [], lineCountMatch: actual.length === expected.length };
  if (!result.lineCountMatch) return Object.freeze({ ...result, suffixOnly: Object.freeze([]), nonSuffix: Object.freeze([{ code: 'LINE_COUNT_MISMATCH', actual: actual.length, expected: expected.length }]) });
  let inNodeName = false;
  for (let index = 0; index < expected.length; index += 1) {
    const expectedHeader = headerName(expected[index]); const actualHeader = headerName(actual[index]);
    if (expectedHeader || actualHeader) {
      if (actual[index] !== expected[index]) result.nonSuffix.push(Object.freeze({ lineIndex: index, actual: actual[index], expected: expected[index] }));
      inNodeName = isNodeNameHeader(expected[index]) && isNodeNameHeader(actual[index]);
      continue;
    }
    if (!inNodeName) {
      if (actual[index] !== expected[index]) result.nonSuffix.push(Object.freeze({ lineIndex: index, actual: actual[index], expected: expected[index] }));
      continue;
    }
    const a = namePair(actual[index]); const e = namePair(expected[index]);
    compareNameField(a.fromName, e.fromName, index, 'FROM', result);
    compareNameField(a.toName, e.toName, index, 'TO', result);
    const aOutside = `${actual[index].slice(0, NODENAME_FROM_START)}${actual[index].slice(NODENAME_END)}`;
    const eOutside = `${expected[index].slice(0, NODENAME_FROM_START)}${expected[index].slice(NODENAME_END)}`;
    if (aOutside !== eOutside) result.nonSuffix.push(Object.freeze({ lineIndex: index, code: 'NODENAME_OUTSIDE_FIELD_MISMATCH', actual: aOutside, expected: eOutside }));
  }
  return Object.freeze({ lineCountMatch: true, suffixOnly: Object.freeze(result.suffixOnly), nonSuffix: Object.freeze(result.nonSuffix) });
}

function compareNodeNameStates(actual, expected, allowSuffixOnly = false) {
  const suffixOnly = []; const nonSuffix = [];
  if (actual.conflicts.length) nonSuffix.push(Object.freeze({ code: 'ACTUAL_NODENAME_CONFLICTS', count: actual.conflicts.length }));
  if (expected.conflicts.length) nonSuffix.push(Object.freeze({ code: 'EXPECTED_NODENAME_CONFLICTS', count: expected.conflicts.length }));
  if (actual.controlNodeNameCount !== expected.controlNodeNameCount) {
    nonSuffix.push(Object.freeze({ code: 'CONTROL_NONAM_MISMATCH', actual: actual.controlNodeNameCount, expected: expected.controlNodeNameCount }));
  }
  if (actual.physicalNodeNameRowCount !== expected.physicalNodeNameRowCount) {
    nonSuffix.push(Object.freeze({ code: 'PHYSICAL_NODENAME_ROW_COUNT_MISMATCH', actual: actual.physicalNodeNameRowCount, expected: expected.physicalNodeNameRowCount }));
  }
  const ids = [...new Set([...actual.names.keys(), ...expected.names.keys()])]
    .sort((a, b) => Number(a) - Number(b));
  for (const id of ids) {
    const actualName = actual.names.get(id) || ''; const expectedName = expected.names.get(id) || '';
    if (actualName === expectedName) continue;
    const row = Object.freeze({ nodeId: id, actual: actualName, expected: expectedName });
    if (allowSuffixOnly && suffixOnlyValue(actualName, expectedName)) suffixOnly.push(row);
    else nonSuffix.push(row);
  }
  return Object.freeze({ suffixOnly: Object.freeze(suffixOnly), nonSuffix: Object.freeze(nonSuffix) });
}

export function compareWriter2NodeNameSemantics(actualText, expectedText, options = {}) {
  const actual = parseIndependentNodeNameState(actualText);
  const expected = parseIndependentNodeNameState(expectedText);
  const result = compareNodeNameStates(actual, expected, options.allowSuffixOnly === true);
  return Object.freeze({ ...result, actual, expected });
}

function sectionModel(text) {
  const preamble = []; const sections = []; let active = null;
  for (const line of lines(text)) {
    const name = headerName(line);
    if (name) {
      active = { name, header: line, rows: [] };
      sections.push(active);
    } else if (active) active.rows.push(line);
    else preamble.push(line);
  }
  return { preamble, sections };
}
function maskNumericField(row, index) {
  const start = FIELD_PREFIX + (index * FIELD_WIDTH); const end = start + FIELD_WIDTH;
  const padded = String(row ?? '').padEnd(end, ' ');
  return `${padded.slice(0, start)}${' '.repeat(FIELD_WIDTH)}${padded.slice(end)}`;
}
function compareRowsExact(section, beforeRows, actualRows, differences) {
  if (beforeRows.length !== actualRows.length) {
    differences.push(Object.freeze({ section, code: 'ROW_COUNT_MISMATCH', before: beforeRows.length, actual: actualRows.length }));
    return;
  }
  for (let index = 0; index < beforeRows.length; index += 1) if (beforeRows[index] !== actualRows[index]) {
    differences.push(Object.freeze({ section, rowIndex: index, before: beforeRows[index], actual: actualRows[index] }));
  }
}
function compareControlOutsideAuthority(beforeRows, actualRows, differences) {
  if (beforeRows.length !== actualRows.length) {
    differences.push(Object.freeze({ section: 'CONTROL', code: 'ROW_COUNT_MISMATCH', before: beforeRows.length, actual: actualRows.length }));
    return;
  }
  for (let index = 0; index < beforeRows.length; index += 1) {
    const before = index === 0 ? maskNumericField(beforeRows[index], 3) : beforeRows[index];
    const actual = index === 0 ? maskNumericField(actualRows[index], 3) : actualRows[index];
    if (before !== actual) differences.push(Object.freeze({ section: 'CONTROL', rowIndex: index, before: beforeRows[index], actual: actualRows[index] }));
  }
}
function compareElementsOutsideAuthority(beforeRows, actualRows, differences) {
  if (beforeRows.length !== actualRows.length) {
    differences.push(Object.freeze({ section: 'ELEMENTS', code: 'ROW_COUNT_MISMATCH', before: beforeRows.length, actual: actualRows.length }));
    return;
  }
  if (beforeRows.length % ELEMENT_ROWS !== 0) {
    differences.push(Object.freeze({ section: 'ELEMENTS', code: 'ROW_COUNT_NOT_MULTIPLE_OF_15', count: beforeRows.length }));
    return;
  }
  for (let index = 0; index < beforeRows.length; index += 1) {
    const pointerRow = index % ELEMENT_ROWS === POINTER_ROW;
    const before = pointerRow ? maskNumericField(beforeRows[index], POINTER_FIELD) : beforeRows[index];
    const actual = pointerRow ? maskNumericField(actualRows[index], POINTER_FIELD) : actualRows[index];
    if (before !== actual) differences.push(Object.freeze({ section: 'ELEMENTS', rowIndex: index, before: beforeRows[index], actual: actualRows[index] }));
  }
}

function fixedField(row, index) {
  const start = FIELD_PREFIX + (index * FIELD_WIDTH); const end = start + FIELD_WIDTH;
  return String(row ?? '').padEnd(end, ' ').slice(start, end);
}
function singleSection(model, name, side, differences) {
  const rows = model.sections.filter((section) => section.name === name);
  if (rows.length !== 1) {
    differences.push(Object.freeze({ code: 'AUTHORIZED_SECTION_CARDINALITY', side, section: name, count: rows.length }));
    return null;
  }
  return rows[0];
}
function compareEncodedNameField(actualRow, expectedRow, start, end, rowIndex, fieldName, allowSuffixOnly, result) {
  const actualField = String(actualRow ?? '').padEnd(end, ' ').slice(start, end);
  const expectedField = String(expectedRow ?? '').padEnd(end, ' ').slice(start, end);
  const actual = actualField.trim(); const expected = expectedField.trim();
  if (actual === expected) {
    if (actualField !== expectedField) result.nonSuffix.push(Object.freeze({
      code: 'NODENAME_FIELD_ENCODING_MISMATCH', rowIndex, field: fieldName, actual: actualField, expected: expectedField,
    }));
    return;
  }
  const row = Object.freeze({ rowIndex, field: fieldName, actual, expected });
  if (allowSuffixOnly && suffixOnlyValue(actual, expected)) result.suffixOnly.push(row);
  else result.nonSuffix.push(row);
}

export function compareWriter2NodeNameEncoding(actualText, expectedText, options = {}) {
  const actual = sectionModel(actualText); const expected = sectionModel(expectedText);
  const result = { suffixOnly: [], nonSuffix: [] }; const allowSuffixOnly = options.allowSuffixOnly === true;
  const actualControl = singleSection(actual, 'CONTROL', 'ACTUAL', result.nonSuffix);
  const expectedControl = singleSection(expected, 'CONTROL', 'EXPECTED', result.nonSuffix);
  const actualElements = singleSection(actual, 'ELEMENTS', 'ACTUAL', result.nonSuffix);
  const expectedElements = singleSection(expected, 'ELEMENTS', 'EXPECTED', result.nonSuffix);
  const actualNames = singleSection(actual, 'NODENAME', 'ACTUAL', result.nonSuffix);
  const expectedNames = singleSection(expected, 'NODENAME', 'EXPECTED', result.nonSuffix);

  if (actualControl && expectedControl) {
    const actualField = fixedField(actualControl.rows[0], 3); const expectedField = fixedField(expectedControl.rows[0], 3);
    if (actualField !== expectedField) result.nonSuffix.push(Object.freeze({
      code: 'CONTROL_NONAM_ENCODING_MISMATCH', actual: actualField.trim(), expected: expectedField.trim(),
    }));
  }
  if (actualElements && expectedElements) {
    if (actualElements.rows.length !== expectedElements.rows.length) {
      result.nonSuffix.push(Object.freeze({
        code: 'ELEMENT_ROW_COUNT_MISMATCH', actual: actualElements.rows.length, expected: expectedElements.rows.length,
      }));
    } else if (actualElements.rows.length % ELEMENT_ROWS !== 0) {
      result.nonSuffix.push(Object.freeze({ code: 'ELEMENT_ROW_COUNT_NOT_MULTIPLE_OF_15', count: actualElements.rows.length }));
    } else {
      for (let offset = POINTER_ROW; offset < actualElements.rows.length; offset += ELEMENT_ROWS) {
        const actualField = fixedField(actualElements.rows[offset], POINTER_FIELD);
        const expectedField = fixedField(expectedElements.rows[offset], POINTER_FIELD);
        if (actualField !== expectedField) result.nonSuffix.push(Object.freeze({
          code: 'ELEMENT_NODENAME_POINTER_MISMATCH', elementIndex: Math.floor(offset / ELEMENT_ROWS),
          actual: actualField.trim(), expected: expectedField.trim(),
        }));
      }
    }
  }
  if (actualNames && expectedNames) {
    if (actualNames.rows.length !== expectedNames.rows.length) {
      result.nonSuffix.push(Object.freeze({
        code: 'NODENAME_ROW_COUNT_MISMATCH', actual: actualNames.rows.length, expected: expectedNames.rows.length,
      }));
    } else {
      for (let index = 0; index < actualNames.rows.length; index += 1) {
        const actualRow = actualNames.rows[index]; const expectedRow = expectedNames.rows[index];
        compareEncodedNameField(actualRow, expectedRow, NODENAME_FROM_START, NODENAME_TO_START, index, 'FROM', allowSuffixOnly, result);
        compareEncodedNameField(actualRow, expectedRow, NODENAME_TO_START, NODENAME_END, index, 'TO', allowSuffixOnly, result);
        const actualOutside = `${actualRow.slice(0, NODENAME_FROM_START)}${actualRow.slice(NODENAME_END)}`;
        const expectedOutside = `${expectedRow.slice(0, NODENAME_FROM_START)}${expectedRow.slice(NODENAME_END)}`;
        if (actualOutside !== expectedOutside) result.nonSuffix.push(Object.freeze({
          code: 'NODENAME_OUTSIDE_FIELD_MISMATCH', rowIndex: index, actual: actualOutside, expected: expectedOutside,
        }));
      }
    }
  }
  return Object.freeze({ suffixOnly: Object.freeze(result.suffixOnly), nonSuffix: Object.freeze(result.nonSuffix) });
}

export function compareOutsideWriter2NodeNameAuthority(beforeText, actualText) {
  const before = sectionModel(beforeText); const actual = sectionModel(actualText); const differences = [];
  if (before.preamble.length !== actual.preamble.length || before.preamble.some((line, index) => line !== actual.preamble[index])) {
    differences.push(Object.freeze({ section: 'PREAMBLE', code: 'MISMATCH' }));
  }
  const beforeNames = before.sections.map((section) => section.name); const actualNames = actual.sections.map((section) => section.name);
  if (beforeNames.length !== actualNames.length || beforeNames.some((name, index) => name !== actualNames[index])) {
    differences.push(Object.freeze({ section: 'SECTIONS', code: 'ORDER_OR_SET_MISMATCH', before: beforeNames, actual: actualNames }));
    return Object.freeze({ status: 'BLOCKED', differences: Object.freeze(differences) });
  }
  for (let index = 0; index < before.sections.length; index += 1) {
    const left = before.sections[index]; const right = actual.sections[index];
    if (left.header !== right.header) differences.push(Object.freeze({ section: left.name, code: 'HEADER_MISMATCH', before: left.header, actual: right.header }));
    if (left.name === 'NODENAME') continue;
    if (left.name === 'CONTROL') compareControlOutsideAuthority(left.rows, right.rows, differences);
    else if (left.name === 'ELEMENTS') compareElementsOutsideAuthority(left.rows, right.rows, differences);
    else compareRowsExact(left.name, left.rows, right.rows, differences);
  }
  return Object.freeze({ status: differences.length ? 'BLOCKED' : 'READY', differences: Object.freeze(differences) });
}

export function evaluateWriter2BenchmarkPostimage(beforeText, actualText, expectedText, options = {}) {
  const benchmark = compareWriter2NodeNameEncoding(actualText, expectedText, options);
  const semantics = compareWriter2NodeNameSemantics(actualText, expectedText, options);
  const preservation = compareOutsideWriter2NodeNameAuthority(beforeText, actualText);
  return Object.freeze({
    status: benchmark.nonSuffix.length === 0 && semantics.nonSuffix.length === 0 && preservation.status === 'READY' ? 'READY' : 'BLOCKED',
    benchmark, semantics, preservation,
  });
}

export const _test = Object.freeze({
  sectionRows, numericField, namePair, suffixOnlyValue, controlNodeNameCount,
  sectionModel, maskNumericField, compareNodeNameStates, fixedField, singleSection,
});
