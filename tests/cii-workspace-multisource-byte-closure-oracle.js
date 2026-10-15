const CONTROL_NONAM_START = 41;
const CONTROL_NONAM_END = 54;
const ELEMENT_BLOCK_ROWS = 15;
const ELEMENT_POINTER_ROW = 13;
const ELEMENT_POINTER_START = 67;
const ELEMENT_POINTER_END = 80;
const FIELD_PREFIX = 2;
const FIELD_WIDTH = 13;
const NODENAME_FROM_START = 2;
const NODENAME_TO_START = 28;
const NODENAME_ROW_END = 53;

function text(value) { return String(value ?? '').trim(); }
function markerName(body) {
  const match = String(body ?? '').match(/^\s*#\$\s*(.*?)\s*$/);
  return match ? match[1].trim().toUpperCase() : null;
}
function physicalLines(rawValue) {
  const raw = String(rawValue ?? ''); const rows = []; let start = 0;
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (char !== '\r' && char !== '\n') continue;
    let end = index + 1; let ending = char;
    if (char === '\r' && raw[index + 1] === '\n') { end = index + 2; ending = '\r\n'; index += 1; }
    const bodyEnd = end - ending.length;
    rows.push(Object.freeze({ body: raw.slice(start, bodyEnd), ending, byteStart: start, bodyByteEnd: bodyEnd, byteEnd: end }));
    start = end;
  }
  if (start < raw.length) rows.push(Object.freeze({ body: raw.slice(start), ending: '', byteStart: start, bodyByteEnd: raw.length, byteEnd: raw.length }));
  return Object.freeze(rows);
}
function sectionEnvelope(rawValue, wanted) {
  const rows = physicalLines(rawValue); const target = String(wanted).toUpperCase();
  const markerIndex = rows.findIndex((row) => markerName(row.body) === target);
  if (markerIndex < 0) throw new Error(`BYTE_ORACLE_SECTION_NOT_FOUND:${target}`);
  let nextIndex = markerIndex + 1;
  while (nextIndex < rows.length && markerName(rows[nextIndex].body) === null) nextIndex += 1;
  if (nextIndex >= rows.length) throw new Error(`BYTE_ORACLE_NEXT_SECTION_REQUIRED:${target}`);
  return Object.freeze({ rows, markerIndex, nextIndex, marker: rows[markerIndex], nextMarker: rows[nextIndex], payloadRows: rows.slice(markerIndex + 1, nextIndex) });
}
function numericField(body, index) {
  const start = FIELD_PREFIX + (index * FIELD_WIDTH); const end = start + FIELD_WIDTH;
  return String(body ?? '').padEnd(end, ' ').slice(start, end);
}
function integerField(body, index) {
  const value = Number(numericField(body, index).trim().replace(/[dD]/g, 'E'));
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}
function nodeId(body, index) {
  const value = Number(numericField(body, index).trim().replace(/[dD]/g, 'E'));
  return Number.isFinite(value) ? String(Math.round(value)) : null;
}
function paddedName(value, width) {
  const name = text(value);
  for (const char of name) if (char.codePointAt(0) > 0x7f) throw new Error('BYTE_ORACLE_NODENAME_NON_ASCII');
  if (name.length > width) throw new Error(`BYTE_ORACLE_NODENAME_OVERFLOW:${name.length}:${width}`);
  return name.padEnd(width, ' ');
}
function integerToken(value) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error(`BYTE_ORACLE_INTEGER_INVALID:${value}`);
  const token = String(number);
  if (token.length > FIELD_WIDTH) throw new Error(`BYTE_ORACLE_INTEGER_OVERFLOW:${token}`);
  return token.padStart(FIELD_WIDTH, ' ');
}
function custody(rawValue) {
  const raw = String(rawValue ?? '');
  const elements = sectionEnvelope(raw, 'ELEMENTS'); const names = sectionEnvelope(raw, 'NODENAME');
  if (elements.payloadRows.length % ELEMENT_BLOCK_ROWS !== 0) throw new Error('BYTE_ORACLE_ELEMENT_BLOCK_ROWS_INVALID');
  const nodeFields = new Map(); const elementRows = [];
  function addNodeField(id, field) {
    if (!id) return;
    if (!nodeFields.has(id)) nodeFields.set(id, []);
    nodeFields.get(id).push(Object.freeze(field));
  }
  for (let offset = 0, elementIndex = 0; offset < elements.payloadRows.length; offset += ELEMENT_BLOCK_ROWS, elementIndex += 1) {
    const header = elements.payloadRows[offset]; const pointerRow = elements.payloadRows[offset + ELEMENT_POINTER_ROW];
    const from = nodeId(header?.body, 0); const to = nodeId(header?.body, 1); const pointer = integerField(pointerRow?.body, 5);
    if (!from || !to || pointer === null) throw new Error(`BYTE_ORACLE_ELEMENT_PARSE_FAILED:${elementIndex}`);
    if (pointer > names.payloadRows.length) throw new Error(`BYTE_ORACLE_NODENAME_POINTER_OUT_OF_RANGE:${elementIndex}:${pointer}`);
    const element = Object.freeze({
      elementIndex, from, to, pointer,
      pointerStart: pointerRow.byteStart + ELEMENT_POINTER_START,
      pointerEnd: pointerRow.byteStart + ELEMENT_POINTER_END,
      pointerRaw: raw.slice(pointerRow.byteStart + ELEMENT_POINTER_START, pointerRow.byteStart + ELEMENT_POINTER_END),
    });
    elementRows.push(element);
    if (!pointer) continue;
    const rowIndex = pointer - 1; const row = names.payloadRows[rowIndex];
    addNodeField(from, { rowIndex, field: 'FROM', start: NODENAME_FROM_START, end: NODENAME_TO_START, raw: row.body.slice(NODENAME_FROM_START, NODENAME_TO_START) });
    addNodeField(to, { rowIndex, field: 'TO', start: NODENAME_TO_START, end: NODENAME_ROW_END, raw: row.body.slice(NODENAME_TO_START, NODENAME_ROW_END) });
  }
  return Object.freeze({ elements, names, nodeFields, elementRows: Object.freeze(elementRows) });
}
function canonicalCreateGroups(beforeCustody, deltas, postimageByNode, differences) {
  const groups = new Map();
  for (const delta of deltas.filter((row) => row.action === 'CREATE')) {
    const node = String(delta.nodeId); const candidates = beforeCustody.elementRows
      .filter((element) => element.pointer === 0 && (element.from === node || element.to === node))
      .sort((a, b) => a.elementIndex - b.elementIndex);
    if (!candidates.length) {
      differences.push(Object.freeze({ code: 'CREATE_ZERO_POINTER_OWNER_REQUIRED', nodeId: node }));
      continue;
    }
    const selected = candidates[0];
    const group = groups.get(selected.elementIndex) || { element: selected, fromName: '', toName: '', nodeIds: [] };
    const name = text(postimageByNode.get(node) ?? delta.newValue);
    if (selected.from === node) {
      if (group.fromName && group.fromName !== name) differences.push(Object.freeze({ code: 'CREATE_FROM_CONFLICT', elementIndex: selected.elementIndex }));
      group.fromName = name;
    } else {
      if (group.toName && group.toName !== name) differences.push(Object.freeze({ code: 'CREATE_TO_CONFLICT', elementIndex: selected.elementIndex }));
      group.toName = name;
    }
    group.nodeIds.push(node); groups.set(selected.elementIndex, group);
  }
  return [...groups.values()].sort((a, b) => a.element.elementIndex - b.element.elementIndex);
}
function maskedString(rawValue, spans) {
  const chars = String(rawValue ?? '').split('');
  for (const span of spans) for (let index = span.start; index < span.end; index += 1) chars[index] = '\u0000';
  return chars.join('');
}
function endingCounts(rows) {
  const counts = new Map();
  for (const row of rows) counts.set(row.ending, (counts.get(row.ending) || 0) + 1);
  return Object.freeze(Object.fromEntries([...counts.entries()].sort()));
}

export function validateIndependentMixedNodeNameByteClosure(beforeRaw, afterRaw, options = {}) {
  const before = String(beforeRaw ?? ''); const after = String(afterRaw ?? ''); const differences = [];
  const expectedDeltas = Array.isArray(options.expectedDeltas) ? options.expectedDeltas.map((row) => Object.freeze({
    nodeId: String(row.nodeId), action: String(row.action), oldValue: text(row.oldValue), newValue: text(row.newValue),
  })) : [];
  const selectedOperations = Array.isArray(options.selectedOperations) ? options.selectedOperations : [];
  const selectedByTarget = new Map();
  for (const operation of selectedOperations) {
    const target = text(operation?.targetEvidence?.identity || operation?.targetEvidence?.nodeId);
    if (!target) continue;
    if (selectedByTarget.has(target)) differences.push(Object.freeze({ code: 'SELECTED_OPERATION_TARGET_CONFLICT', nodeId: target }));
    else selectedByTarget.set(target, operation);
  }
  const postimageByNode = new Map();
  for (const delta of expectedDeltas) {
    let postimage = text(delta.newValue);
    if (selectedOperations.length) {
      const operation = selectedByTarget.get(delta.nodeId);
      const expectedAction = delta.action === 'REPLACE' ? 'COPY' : delta.action;
      if (!operation || text(operation?.action) !== expectedAction) {
        differences.push(Object.freeze({ code: 'SELECTED_OPERATION_REQUIRED_FOR_EXPECTED_DELTA', nodeId: delta.nodeId, action: delta.action }));
      } else {
        postimage = expectedAction === 'DELETE' ? '' : text(operation?.proposed ?? operation?.sourceEvidence?.value);
      }
    }
    postimageByNode.set(delta.nodeId, postimage);
  }
  const deleteCount = expectedDeltas.filter((row) => row.action === 'DELETE').length;
  const expectedRowDelta = Number(options.expectedRowDelta ?? (expectedDeltas.filter((row) => row.action === 'CREATE').length - deleteCount));
  if (!expectedDeltas.length) differences.push(Object.freeze({ code: 'EXPECTED_NODENAME_DELTAS_REQUIRED' }));
  if (deleteCount) differences.push(Object.freeze({ code: 'DELETE_BYTE_CLOSURE_REQUIRES_DEDICATED_COMPACTION_ORACLE', deleteCount }));

  const beforeCustody = custody(before); const afterCustody = custody(after);
  const beforeNames = beforeCustody.names; const afterNames = afterCustody.names;
  if (beforeNames.marker.body !== afterNames.marker.body || beforeNames.marker.ending !== afterNames.marker.ending) {
    differences.push(Object.freeze({ code: 'NODENAME_MARKER_BYTES_CHANGED' }));
  }
  if (afterNames.payloadRows.length !== beforeNames.payloadRows.length + expectedRowDelta) {
    differences.push(Object.freeze({ code: 'NODENAME_PHYSICAL_ROW_DELTA_MISMATCH', before: beforeNames.payloadRows.length, after: afterNames.payloadRows.length, expectedDelta: expectedRowDelta }));
  }

  const deltaByNode = new Map(expectedDeltas.map((row) => [row.nodeId, row]));
  const createGroups = deleteCount ? [] : canonicalCreateGroups(beforeCustody, expectedDeltas, postimageByNode, differences);
  if (!deleteCount && createGroups.length !== expectedRowDelta) {
    differences.push(Object.freeze({ code: 'CREATE_GROUP_ROW_DELTA_MISMATCH', groups: createGroups.length, expectedRowDelta }));
  }

  const authorizedPrefixSpans = [];
  const beforeControl = sectionEnvelope(before, 'CONTROL'); const afterControl = sectionEnvelope(after, 'CONTROL');
  const beforeControlRow = beforeControl.payloadRows[0]; const afterControlRow = afterControl.payloadRows[0];
  if (!beforeControlRow || !afterControlRow || beforeControlRow.body.length < CONTROL_NONAM_END || afterControlRow.body.length < CONTROL_NONAM_END) {
    differences.push(Object.freeze({ code: 'CONTROL_FIXED_ROW_REQUIRED' }));
  } else if (expectedRowDelta !== 0) {
    const beforeCountRaw = before.slice(beforeControlRow.byteStart + CONTROL_NONAM_START, beforeControlRow.byteStart + CONTROL_NONAM_END);
    const afterCountRaw = after.slice(afterControlRow.byteStart + CONTROL_NONAM_START, afterControlRow.byteStart + CONTROL_NONAM_END);
    const beforeCount = Number(beforeCountRaw.trim());
    if (!Number.isSafeInteger(beforeCount) || afterCountRaw !== integerToken(beforeCount + expectedRowDelta)) {
      differences.push(Object.freeze({ code: 'CONTROL_NONAM_POSTIMAGE_MISMATCH', before: beforeCountRaw, after: afterCountRaw, expectedDelta: expectedRowDelta }));
    }
    authorizedPrefixSpans.push(Object.freeze({ start: beforeControlRow.byteStart + CONTROL_NONAM_START, end: beforeControlRow.byteStart + CONTROL_NONAM_END }));
  }

  const createByElement = new Map(createGroups.map((group, index) => [group.element.elementIndex, { ...group, newPointer: beforeNames.payloadRows.length + index + 1 }]));
  if (beforeCustody.elementRows.length !== afterCustody.elementRows.length) {
    differences.push(Object.freeze({ code: 'ELEMENT_COUNT_CHANGED', before: beforeCustody.elementRows.length, after: afterCustody.elementRows.length }));
  }
  for (const beforeElement of beforeCustody.elementRows) {
    const afterElement = afterCustody.elementRows[beforeElement.elementIndex];
    if (!afterElement || afterElement.from !== beforeElement.from || afterElement.to !== beforeElement.to) {
      differences.push(Object.freeze({ code: 'ELEMENT_ENDPOINTS_CHANGED', elementIndex: beforeElement.elementIndex }));
      continue;
    }
    const group = createByElement.get(beforeElement.elementIndex);
    if (group) {
      if (beforeElement.pointer !== 0 || afterElement.pointer !== group.newPointer || afterElement.pointerRaw !== integerToken(group.newPointer)) {
        differences.push(Object.freeze({ code: 'CREATE_POINTER_POSTIMAGE_MISMATCH', elementIndex: beforeElement.elementIndex, beforePointer: beforeElement.pointer, afterPointer: afterElement.pointer, expected: group.newPointer }));
      }
      authorizedPrefixSpans.push(Object.freeze({ start: beforeElement.pointerStart, end: beforeElement.pointerEnd }));
    } else if (beforeElement.pointerRaw !== afterElement.pointerRaw) {
      differences.push(Object.freeze({ code: 'UNAUTHORIZED_ELEMENT_POINTER_CHANGED', elementIndex: beforeElement.elementIndex, before: beforeElement.pointerRaw, after: afterElement.pointerRaw }));
    }
  }

  const beforePrefix = before.slice(0, beforeNames.marker.byteEnd); const afterPrefix = after.slice(0, afterNames.marker.byteEnd);
  if (maskedString(beforePrefix, authorizedPrefixSpans) !== maskedString(afterPrefix, authorizedPrefixSpans)) {
    differences.push(Object.freeze({ code: 'BYTES_CHANGED_OUTSIDE_EXACT_CONTROL_POINTER_AUTHORITY' }));
  }
  if (before.slice(beforeNames.nextMarker.byteStart) !== after.slice(afterNames.nextMarker.byteStart)) {
    differences.push(Object.freeze({ code: 'BYTES_CHANGED_AFTER_NODENAME_SECTION' }));
  }

  const authorizedFieldsByRow = new Map();
  for (const delta of expectedDeltas.filter((row) => ['REPLACE', 'CREATE'].includes(row.action))) {
    for (const field of beforeCustody.nodeFields.get(delta.nodeId) || []) {
      if (!authorizedFieldsByRow.has(field.rowIndex)) authorizedFieldsByRow.set(field.rowIndex, []);
      authorizedFieldsByRow.get(field.rowIndex).push(Object.freeze({
        ...field, nodeId: delta.nodeId, expected: postimageByNode.get(delta.nodeId) ?? delta.newValue,
      }));
    }
  }
  for (let rowIndex = 0; rowIndex < beforeNames.payloadRows.length; rowIndex += 1) {
    const beforeRow = beforeNames.payloadRows[rowIndex]; const afterRow = afterNames.payloadRows[rowIndex];
    if (!afterRow) continue;
    if (beforeRow.ending !== afterRow.ending) differences.push(Object.freeze({ code: 'EXISTING_NODENAME_LINE_ENDING_CHANGED', rowIndex }));
    if (beforeRow.body.length !== NODENAME_ROW_END || afterRow.body.length !== NODENAME_ROW_END) {
      differences.push(Object.freeze({ code: 'NODENAME_ROW_WIDTH_CHANGED', rowIndex, beforeWidth: beforeRow.body.length, afterWidth: afterRow.body.length }));
      continue;
    }
    const fields = authorizedFieldsByRow.get(rowIndex) || [];
    const beforeMasked = beforeRow.body.split(''); const afterMasked = afterRow.body.split('');
    for (const field of fields) {
      const actual = afterRow.body.slice(field.start, field.end);
      if (actual !== paddedName(field.expected, field.end - field.start)) differences.push(Object.freeze({ code: 'AUTHORIZED_NODENAME_FIELD_POSTIMAGE_MISMATCH', rowIndex, field: field.field, nodeId: field.nodeId, actual, expected: field.expected }));
      for (let index = field.start; index < field.end; index += 1) { beforeMasked[index] = '\u0000'; afterMasked[index] = '\u0000'; }
    }
    if (beforeMasked.join('') !== afterMasked.join('')) differences.push(Object.freeze({ code: 'UNAUTHORIZED_EXISTING_NODENAME_BYTES_CHANGED', rowIndex }));
  }

  if (!deleteCount) {
    const appendEnding = beforeNames.payloadRows.at(-1)?.ending || beforeNames.marker.ending;
    for (let index = 0; index < createGroups.length; index += 1) {
      const rowIndex = beforeNames.payloadRows.length + index; const row = afterNames.payloadRows[rowIndex]; const group = createGroups[index];
      const expectedBody = `  ${paddedName(group.fromName, NODENAME_TO_START - NODENAME_FROM_START)}${paddedName(group.toName, NODENAME_ROW_END - NODENAME_TO_START)}`;
      if (!row || row.body !== expectedBody) differences.push(Object.freeze({ code: 'APPENDED_NODENAME_ROW_MISMATCH', rowIndex, actual: row?.body ?? null, expected: expectedBody }));
      if (!row || row.ending !== appendEnding) differences.push(Object.freeze({ code: 'APPENDED_NODENAME_LINE_ENDING_CHANGED', rowIndex, actual: row?.ending ?? null, expected: appendEnding }));
    }
  }

  for (const delta of expectedDeltas.filter((row) => row.action === 'REPLACE')) {
    if (!(beforeCustody.nodeFields.get(delta.nodeId) || []).length) differences.push(Object.freeze({ code: 'REPLACE_PHYSICAL_FIELD_REQUIRED', nodeId: delta.nodeId }));
  }
  for (const delta of expectedDeltas.filter((row) => row.action === 'CREATE')) {
    if (text(delta.oldValue)) differences.push(Object.freeze({ code: 'CREATE_PREIMAGE_MUST_BE_BLANK', nodeId: delta.nodeId, oldValue: delta.oldValue }));
  }

  return Object.freeze({
    status: differences.length ? 'BLOCKED' : 'READY', differences: Object.freeze(differences),
    beforeByteLength: before.length, afterByteLength: after.length,
    rowCountBefore: beforeNames.payloadRows.length, rowCountAfter: afterNames.payloadRows.length,
    authorizedReplacementOrCreateNodeIds: Object.freeze([...deltaByNode.keys()].sort((a, b) => Number(a) - Number(b))),
    authorizedPointerElementIndexes: Object.freeze([...createByElement.keys()].sort((a, b) => a - b)),
    beforeLineEndings: endingCounts(beforeNames.payloadRows), afterLineEndings: endingCounts(afterNames.payloadRows),
  });
}

export const _test = Object.freeze({ physicalLines, sectionEnvelope, numericField, integerField, nodeId, custody, canonicalCreateGroups, maskedString, endingCounts });