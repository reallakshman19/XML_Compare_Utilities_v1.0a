const SECTION_RX = /^#\$\s+([A-Z0-9_&]+)\s*$/;
const I13_RX = /^[+-]?\d+$/;
const ELEMENT_ROWS = 15;
const RESTRAINT_ROWS = 24;
const RESTRAINT_SLOT_ROWS = 4;
const RESTRAINT_SLOTS = 6;

function asBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (typeof value === 'string') return new TextEncoder().encode(value);
  throw new Error('BM_W2_ORACLE_BYTES_REQUIRED');
}

function decodeCrlf(value) {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(asBytes(value));
  if (!text.endsWith('\r\n')) throw new Error('BM_W2_ORACLE_FINAL_CRLF_REQUIRED');
  const body = text.slice(0, -2);
  if (/(^|[^\r])\n|\r(?!\n)/.test(body)) throw new Error('BM_W2_ORACLE_CRLF_ONLY_REQUIRED');
  return Object.freeze({ text, lines: body ? body.split('\r\n') : [] });
}

function sectionRanges(lines) {
  const ranges = new Map();
  let current = null;
  for (let index = 0; index < lines.length; index += 1) {
    const match = SECTION_RX.exec(lines[index]);
    if (!match) continue;
    if (current) current.end = index;
    current = { name: match[1], header: index, start: index + 1, end: lines.length };
    if (ranges.has(current.name)) throw new Error(`BM_W2_ORACLE_DUPLICATE_SECTION:${current.name}`);
    ranges.set(current.name, current);
  }
  return ranges;
}

function requireSection(ranges, name) {
  const range = ranges.get(name);
  if (!range) throw new Error(`BM_W2_ORACLE_SECTION_REQUIRED:${name}`);
  return range;
}

function fixedFields(line) {
  if (line.length < 15 || (line.length - 15) % 13 !== 0) {
    throw new Error(`BM_W2_ORACLE_FIXED_ROW_REQUIRED:${line.length}`);
  }
  const fields = [line.slice(0, 15)];
  for (let start = 15; start < line.length; start += 13) fields.push(line.slice(start, start + 13));
  return fields;
}

function i13Value(line, fieldIndex, identity) {
  const fields = fixedFields(line);
  if (fieldIndex >= fields.length) throw new Error(`BM_W2_ORACLE_FIELD_REQUIRED:${identity}:${fieldIndex}`);
  const token = fields[fieldIndex].trim();
  if (!I13_RX.test(token)) throw new Error(`BM_W2_ORACLE_I13_REQUIRED:${identity}:${token}`);
  const value = Number(token);
  if (!Number.isSafeInteger(value)) throw new Error(`BM_W2_ORACLE_SAFE_I13_REQUIRED:${identity}:${token}`);
  return value;
}

function numericValue(line, fieldIndex, identity) {
  const fields = fixedFields(line);
  if (fieldIndex >= fields.length) throw new Error(`BM_W2_ORACLE_FIELD_REQUIRED:${identity}:${fieldIndex}`);
  const token = fields[fieldIndex].trim().replace(/[Dd]/g, 'E');
  const value = Number(token);
  if (!Number.isFinite(value)) throw new Error(`BM_W2_ORACLE_NUMERIC_REQUIRED:${identity}:${token}`);
  return value;
}

function replaceI13(line, fieldIndex, value, identity) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`BM_W2_ORACLE_NONNEGATIVE_I13_REQUIRED:${identity}:${value}`);
  const fields = fixedFields(line);
  if (fieldIndex >= fields.length) throw new Error(`BM_W2_ORACLE_FIELD_REQUIRED:${identity}:${fieldIndex}`);
  const width = fieldIndex === 0 ? 15 : 13;
  const token = String(value).padStart(width, ' ');
  if (token.length !== width) throw new Error(`BM_W2_ORACLE_I13_WIDTH_OVERFLOW:${identity}:${value}`);
  const start = fieldIndex === 0 ? 0 : 15 + (fieldIndex - 1) * 13;
  const next = `${line.slice(0, start)}${token}${line.slice(start + width)}`;
  if (!I13_RX.test(fixedFields(next)[fieldIndex].trim())) throw new Error(`BM_W2_ORACLE_I13_RENDER_FAILED:${identity}`);
  return next;
}

function prefixedText(row) {
  const match = String(row ?? '').match(/^\s*(\d+)\s?(.*)$/);
  if (!match) return null;
  return String(match[2] || '').slice(0, Number(match[1]));
}

function restraintSlotState(rows, slotIndex) {
  const start = slotIndex * RESTRAINT_SLOT_ROWS;
  const line1 = Array.from({ length: 6 }, (_, index) => numericValue(rows[start], index, `RESTRAINT_SLOT_${slotIndex + 1}_ROW1_F${index + 1}`));
  const line2 = Array.from({ length: 3 }, (_, index) => numericValue(rows[start + 1], index, `RESTRAINT_SLOT_${slotIndex + 1}_ROW2_F${index + 1}`));
  const tag = prefixedText(rows[start + 2]);
  const guid = prefixedText(rows[start + 3]);
  if (tag == null || guid == null) throw new Error(`BM_W2_ORACLE_RESTRAINT_TEXT_ENCODING_REQUIRED:SLOT_${slotIndex + 1}`);
  return Object.freeze({
    slot: slotIndex + 1,
    node: line1[0],
    typeCode: line1[1],
    line1: Object.freeze(line1),
    line2: Object.freeze(line2),
    tag,
    guid,
    occupied: !(Math.abs(line1[0]) <= 1e-12 && Math.abs(line1[1]) <= 1e-12),
  });
}

function elementDescriptor(rows, blockIndex) {
  const start = blockIndex * ELEMENT_ROWS;
  const first = rows[start];
  const pointerRow = rows[start + 12];
  return Object.freeze({
    blockIndex,
    from: numericValue(first, 0, `ELEMENT_${blockIndex}_FROM`),
    to: numericValue(first, 1, `ELEMENT_${blockIndex}_TO`),
    restraintPointer: i13Value(pointerRow, 3, `ELEMENT_${blockIndex}_RESTRAINT_POINTER`),
    pointerRowIndex: start + 12,
  });
}

function sameNode(value, expected) {
  return String(Math.round(Number(value))) === String(expected);
}

export function buildBmW204ExpectedPostimage(sourceBytes, benchmarkCase) {
  if (!benchmarkCase || benchmarkCase.id !== 'BM-W2-04') throw new Error('BM_W2_04_CASE_REQUIRED');
  const candidate = benchmarkCase.candidate || {};
  const expected = benchmarkCase.expected || {};
  const decoded = decodeCrlf(sourceBytes);
  const lines = [...decoded.lines];
  const ranges = sectionRanges(lines);
  const control = requireSection(ranges, 'CONTROL');
  const elements = requireSection(ranges, 'ELEMENTS');
  const restraint = requireSection(ranges, 'RESTRANT');

  const controlRows = lines.slice(control.start, control.end);
  if (controlRows.length < 2) throw new Error(`BM_W2_04_CONTROL_ROWS_REQUIRED:${controlRows.length}`);
  const restraintCountBefore = i13Value(controlRows[1], 3, 'CONTROL_RESTRAINT_BLOCK_COUNT');
  if (restraintCountBefore !== expected.blockCountBefore) {
    throw new Error(`BM_W2_04_CONTROL_RESTRAINT_COUNT_DRIFT:${restraintCountBefore}:${expected.blockCountBefore}`);
  }
  const nodeNameCountBefore = i13Value(controlRows[0], 3, 'CONTROL_NODENAME_COUNT');
  if (nodeNameCountBefore !== expected.controlNodeNameCountBefore) {
    throw new Error(`BM_W2_04_CONTROL_NODENAME_COUNT_DRIFT:${nodeNameCountBefore}:${expected.controlNodeNameCountBefore}`);
  }

  const elementRows = lines.slice(elements.start, elements.end);
  if (elementRows.length !== expected.elementCountBefore * ELEMENT_ROWS) {
    throw new Error(`BM_W2_04_ELEMENT_ROW_COUNT_DRIFT:${elementRows.length}:${expected.elementCountBefore * ELEMENT_ROWS}`);
  }
  const descriptors = Array.from({ length: expected.elementCountBefore }, (_, index) => elementDescriptor(elementRows, index));
  const owners = descriptors.filter((item) => item.restraintPointer === candidate.pointer);
  if (owners.length !== candidate.expectedOwnerCount) {
    throw new Error(`BM_W2_04_OWNER_COUNT_DRIFT:${owners.length}:${candidate.expectedOwnerCount}`);
  }
  const owner = owners[0];
  if (!owner || !sameNode(owner.from, candidate.ownerFrom) || !sameNode(owner.to, candidate.ownerTo)) {
    throw new Error(`BM_W2_04_OWNER_IDENTITY_DRIFT:${owner?.from ?? 'NONE'}:${owner?.to ?? 'NONE'}:${candidate.ownerFrom}:${candidate.ownerTo}`);
  }

  const restraintRows = lines.slice(restraint.start, restraint.end);
  if (restraintRows.length !== expected.rowsBefore) {
    throw new Error(`BM_W2_04_RESTRAINT_ROW_COUNT_DRIFT:${restraintRows.length}:${expected.rowsBefore}`);
  }
  if (restraintRows.length % RESTRAINT_ROWS !== 0) {
    throw new Error(`BM_W2_04_RESTRAINT_BLOCK_ALIGNMENT:${restraintRows.length}:${RESTRAINT_ROWS}`);
  }
  const blockStart = (candidate.pointer - 1) * RESTRAINT_ROWS;
  const block = restraintRows.slice(blockStart, blockStart + RESTRAINT_ROWS);
  if (block.length !== RESTRAINT_ROWS) throw new Error(`BM_W2_04_RESTRAINT_BLOCK_REQUIRED:${candidate.pointer}`);
  const slots = Array.from({ length: RESTRAINT_SLOTS }, (_, index) => restraintSlotState(block, index));
  const occupied = slots.filter((item) => item.occupied);
  if (occupied.length !== candidate.expectedOccupiedSlotCount) {
    throw new Error(`BM_W2_04_OCCUPIED_SLOT_COUNT_DRIFT:${occupied.length}:${candidate.expectedOccupiedSlotCount}`);
  }
  const selectedSlot = slots[candidate.slot - 1];
  if (!selectedSlot?.occupied || !sameNode(selectedSlot.node, candidate.node)) {
    throw new Error(`BM_W2_04_SELECTED_SLOT_DRIFT:${candidate.slot}:${selectedSlot?.node ?? 'NONE'}:${candidate.node}`);
  }
  if (selectedSlot.tag !== '' || selectedSlot.guid !== '') {
    throw new Error(`BM_W2_04_SELECTED_SLOT_TEXT_NOT_BLANK:${selectedSlot.tag}:${selectedSlot.guid}`);
  }

  let nodeRecordCount = 0;
  for (let blockIndex = 0; blockIndex < restraintRows.length / RESTRAINT_ROWS; blockIndex += 1) {
    const rows = restraintRows.slice(blockIndex * RESTRAINT_ROWS, (blockIndex + 1) * RESTRAINT_ROWS);
    for (let slotIndex = 0; slotIndex < RESTRAINT_SLOTS; slotIndex += 1) {
      const state = restraintSlotState(rows, slotIndex);
      if (state.occupied && sameNode(state.node, candidate.node)) nodeRecordCount += 1;
    }
  }
  if (nodeRecordCount !== candidate.expectedNodeRecordCount) {
    throw new Error(`BM_W2_04_NODE_RECORD_COUNT_DRIFT:${nodeRecordCount}:${candidate.expectedNodeRecordCount}`);
  }

  const pointerChanges = [];
  for (const descriptor of descriptors) {
    const before = descriptor.restraintPointer;
    const after = before === candidate.pointer ? 0 : before > candidate.pointer ? before - 1 : before;
    if (after === before) continue;
    const absoluteRow = elements.start + descriptor.pointerRowIndex;
    lines[absoluteRow] = replaceI13(lines[absoluteRow], 3, after, `ELEMENT_${descriptor.blockIndex}_RESTRAINT_POINTER`);
    pointerChanges.push(Object.freeze({
      blockIndex: descriptor.blockIndex,
      from: String(Math.round(descriptor.from)),
      to: String(Math.round(descriptor.to)),
      before,
      after,
    }));
  }
  if (!pointerChanges.some((item) => item.before === candidate.pointer && item.after === expected.deletedPointerAfter)) {
    throw new Error(`BM_W2_04_DELETED_POINTER_CHANGE_REQUIRED:${candidate.pointer}:${expected.deletedPointerAfter}`);
  }

  lines[control.start + 1] = replaceI13(
    lines[control.start + 1],
    3,
    expected.blockCountAfter,
    'CONTROL_RESTRAINT_BLOCK_COUNT',
  );

  const rangesAfterPointerEdits = sectionRanges(lines);
  const restraintAfterPointerEdits = requireSection(rangesAfterPointerEdits, 'RESTRANT');
  lines.splice(restraintAfterPointerEdits.start + blockStart, RESTRAINT_ROWS);

  const finalRanges = sectionRanges(lines);
  const finalRestraint = requireSection(finalRanges, 'RESTRANT');
  const finalRestraintRows = lines.slice(finalRestraint.start, finalRestraint.end);
  if (finalRestraintRows.length !== expected.rowsAfter) {
    throw new Error(`BM_W2_04_POST_RESTRAINT_ROW_COUNT:${finalRestraintRows.length}:${expected.rowsAfter}`);
  }
  const finalControl = requireSection(finalRanges, 'CONTROL');
  const finalControlRows = lines.slice(finalControl.start, finalControl.end);
  if (i13Value(finalControlRows[0], 3, 'CONTROL_NODENAME_COUNT_AFTER') !== expected.controlNodeNameCountAfter) {
    throw new Error('BM_W2_04_CONTROL_NODENAME_CHANGED');
  }
  if (i13Value(finalControlRows[1], 3, 'CONTROL_RESTRAINT_BLOCK_COUNT_AFTER') !== expected.blockCountAfter) {
    throw new Error('BM_W2_04_CONTROL_RESTRAINT_COUNT_NOT_UPDATED');
  }

  const outputText = `${lines.join('\r\n')}\r\n`;
  return Object.freeze({
    schema: 'CIIWriter2BenchmarkOracle.BM-W2-04.v1',
    bytes: new TextEncoder().encode(outputText),
    byteString: outputText,
    custody: Object.freeze({
      pointer: candidate.pointer,
      slot: candidate.slot,
      node: String(candidate.node),
      ownerFrom: String(candidate.ownerFrom),
      ownerTo: String(candidate.ownerTo),
      occupiedSlotCount: occupied.length,
      nodeRecordCount,
    }),
    pointerChanges: Object.freeze(pointerChanges),
    counts: Object.freeze({
      restraintBefore: restraintCountBefore,
      restraintAfter: expected.blockCountAfter,
      restraintRowsBefore: restraintRows.length,
      restraintRowsAfter: finalRestraintRows.length,
      nodeNameBefore: nodeNameCountBefore,
      nodeNameAfter: expected.controlNodeNameCountAfter,
    }),
  });
}

export const _test = Object.freeze({
  decodeCrlf,
  sectionRanges,
  fixedFields,
  i13Value,
  replaceI13,
  restraintSlotState,
  elementDescriptor,
});
