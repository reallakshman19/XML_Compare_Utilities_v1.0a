import { decodeCiiNumericRow } from '../../parser/fixed-field.js';
import { deepFreeze, stableStringify } from './cii-workspace-contracts.js';

const ELEMENT_BLOCK_ROWS = 15;
const POINTER_ROW12 = 12;
const POINTER_ROW13 = 13;
const POINTER_ROW14 = 14;
const RESTRAINT_SLOTS = 6;
const RESTRAINT_ROWS_PER_SLOT = 4;
const RESTRAINT_BLOCK_ROWS = RESTRAINT_SLOTS * RESTRAINT_ROWS_PER_SLOT;
const SIF_TEE_BLOCK_ROWS = 10;

function escapeRegExp(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function sectionRows(rawText, names) {
  const wanted = (Array.isArray(names) ? names : [names]).map(String);
  const rows = String(rawText ?? '').split(/\r?\n/);
  const markers = wanted.map((name) => new RegExp(`^\\s*#\\$\\s*${escapeRegExp(name)}\\s*$`, 'i'));
  const start = rows.findIndex((row) => markers.some((marker) => marker.test(row)));
  if (start < 0) return [];
  const out = [];
  for (let index = start + 1; index < rows.length; index += 1) {
    if (/^\s*#\$\s*/.test(rows[index])) break;
    if (rows[index].trim()) out.push(rows[index]);
  }
  return out;
}
function numeric(row, minimum = 1) {
  const values = decodeCiiNumericRow(row);
  return Array.isArray(values) && values.length >= minimum && values.slice(0, minimum).every(Number.isFinite) ? values : null;
}
function integerPointer(values, index) {
  const value = Number(values?.[index]);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}
function elementEnds(row) {
  const values = numeric(row, 2); if (!values) return null;
  const from = Number(values[0]); const to = Number(values[1]);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return { from: String(Math.round(from)), to: String(Math.round(to)) };
}
function pushConflict(conflicts, code, details = {}) { conflicts.push(Object.freeze({ code, ...details })); }
function lengthPrefixedText(row) {
  const match = String(row ?? '').match(/^\s*(\d+)\s?(.*)$/);
  if (!match) return Object.freeze({ declaredLength: null, text: '', raw: String(row ?? '') });
  const declaredLength = Number(match[1]); const payload = match[2] || '';
  return Object.freeze({ declaredLength, text: payload.slice(0, declaredLength), raw: String(row ?? '') });
}
function rawElementBlocks(rawText, conflicts) {
  const rows = sectionRows(rawText, 'ELEMENTS'); const blocks = [];
  if (rows.length % ELEMENT_BLOCK_ROWS !== 0) {
    pushConflict(conflicts, 'AUX_ELEMENT_BLOCK_ROW_COUNT_NOT_MULTIPLE_OF_15', { rowCount: rows.length });
  }
  for (let offset = 0, blockIndex = 0; offset + ELEMENT_BLOCK_ROWS <= rows.length; offset += ELEMENT_BLOCK_ROWS, blockIndex += 1) {
    const ends = elementEnds(rows[offset]);
    if (!ends) { pushConflict(conflicts, 'AUX_ELEMENT_HEADER_UNREADABLE', { blockIndex }); continue; }
    const row12 = numeric(rows[offset + POINTER_ROW12], 6);
    const row13 = numeric(rows[offset + POINTER_ROW13], 6);
    const row14 = numeric(rows[offset + POINTER_ROW14], 3);
    if (!row12 || !row13 || !row14) {
      pushConflict(conflicts, 'AUX_ELEMENT_POINTER_ROW_UNREADABLE', { blockIndex, from: ends.from, to: ends.to });
      continue;
    }
    blocks.push(Object.freeze({
      blockIndex, ...ends,
      pointers: Object.freeze({
        bend: integerPointer(row12, 0), rigid: integerPointer(row12, 1), restraint: integerPointer(row12, 3),
        sifTee: integerPointer(row13, 4), nodeName: integerPointer(row13, 5), reducer: integerPointer(row14, 0),
      }),
      rawPointerRows: Object.freeze([rows[offset + POINTER_ROW12], rows[offset + POINTER_ROW13], rows[offset + POINTER_ROW14]]),
    }));
  }
  return { rows, blocks };
}
function matchBlocks(parsed, rawBlocks, conflicts) {
  const elements = Array.isArray(parsed?.elements) ? parsed.elements : []; const used = new Set(); const matched = [];
  for (const element of elements) {
    const from = String(Math.round(Number(element.from))); const to = String(Math.round(Number(element.to)));
    let rawIndex = rawBlocks.findIndex((block, index) => !used.has(index) && block.blockIndex === Number(element.index) && block.from === from && block.to === to);
    if (rawIndex < 0) rawIndex = rawBlocks.findIndex((block, index) => !used.has(index) && block.from === from && block.to === to);
    if (rawIndex < 0) {
      pushConflict(conflicts, 'AUX_PARSED_ELEMENT_BLOCK_NOT_FOUND', { parsedElementIndex: element.index, from, to });
      continue;
    }
    used.add(rawIndex);
    matched.push(Object.freeze({ parsedElementIndex: Number(element.index), from, to, raw: rawBlocks[rawIndex] }));
  }
  return matched;
}
function positivePointers(descriptors, key) {
  return [...new Set(descriptors.map((item) => item.raw.pointers[key]).filter((value) => Number.isSafeInteger(value) && value > 0))].sort((a, b) => a - b);
}
function fixedBlockByIndex(rows, pointer, blockRows, prefix, conflicts) {
  const start = (Number(pointer) - 1) * blockRows;
  const end = start + blockRows;
  if (!Number.isSafeInteger(pointer) || pointer < 1 || start < 0 || end > rows.length) {
    pushConflict(conflicts, `${prefix}_POINTER_OUT_OF_RANGE`, {
      pointer, rowCount: rows.length, rowsPerBlock: blockRows,
      availableBlockCount: Math.floor(rows.length / blockRows),
    });
    return null;
  }
  return rows.slice(start, end);
}
function restraintRecord(line1, line2, tagRow, guidRow, context, conflicts) {
  const first = numeric(line1, 6); const second = numeric(line2, 3);
  if (!first || !second) {
    pushConflict(conflicts, 'RESTRAINT_SLOT_NUMERIC_ROW_UNREADABLE', context); return null;
  }
  const node = Number(first[0]); const typeCode = Number(first[1]);
  if (node === 0 && typeCode === 0) return null;
  if (!(node > 0) || !Number.isInteger(typeCode) || typeCode < 1 || typeCode > 62) {
    pushConflict(conflicts, 'RESTRAINT_SLOT_IDENTITY_INVALID', { ...context, node, typeCode }); return null;
  }
  return deepFreeze({
    ...context,
    node: String(Math.round(node)), typeCode,
    stiffness: Number(first[2]), gap: Number(first[3]), friction: Number(first[4]), connectingNode: Number(first[5]),
    directionCosines: Object.freeze({ x: Number(second[0]), y: Number(second[1]), z: Number(second[2]) }),
    tag: lengthPrefixedText(tagRow), guid: lengthPrefixedText(guidRow),
    rawLine1Fields: Object.freeze(first.slice(0, 6)), rawLine2Fields: Object.freeze(second.slice(0, 3)),
    rawRows: Object.freeze([line1, line2, tagRow, guidRow]),
  });
}
function buildRestraintEvidence(rawText, descriptors, conflicts) {
  const rows = sectionRows(rawText, 'RESTRANT'); const pointers = positivePointers(descriptors, 'restraint');
  const byPointer = {}; const allRecords = []; const byNode = {};
  if (pointers.length && rows.length % RESTRAINT_BLOCK_ROWS !== 0) {
    pushConflict(conflicts, 'RESTRAINT_SECTION_ROW_COUNT_NOT_MULTIPLE_OF_24', { rowCount: rows.length, rowsPerBlock: RESTRAINT_BLOCK_ROWS });
  }
  for (const pointer of pointers) {
    // Protected writer authority: the IEL restraint pointer is a 1-based
    // 24-row auxiliary-block index, not a section-row index.
    const span = fixedBlockByIndex(rows, pointer, RESTRAINT_BLOCK_ROWS, 'RESTRAINT', conflicts);
    if (!span) continue;
    const records = [];
    for (let slot = 0; slot < RESTRAINT_SLOTS; slot += 1) {
      const base = slot * RESTRAINT_ROWS_PER_SLOT;
      const record = restraintRecord(span[base], span[base + 1], span[base + 2], span[base + 3], { pointer, slot: slot + 1 }, conflicts);
      if (!record) continue;
      records.push(record); allRecords.push(record);
      if (!byNode[record.node]) byNode[record.node] = [];
      byNode[record.node].push(record);
    }
    byPointer[pointer] = Object.freeze(records);
  }
  return deepFreeze({
    authority: 'PROTECTED_WRITER_RESTRANT_BLOCK_INDEX_24_ROWS', sectionRowCount: rows.length,
    blockRows: RESTRAINT_BLOCK_ROWS,
    records: Object.freeze(allRecords), byPointer: Object.freeze(byPointer),
    byNode: Object.freeze(Object.fromEntries(Object.entries(byNode).map(([node, records]) => [node, Object.freeze(records)]))),
  });
}
function buildRigidEvidence(rawText, descriptors, conflicts) {
  const rows = sectionRows(rawText, 'RIGID'); const pointers = positivePointers(descriptors, 'rigid'); const byPointer = {};
  for (const pointer of pointers) {
    // RIGID is one row per pointer, so its 1-based record index equals its
    // section-row index. This differs intentionally from RESTRANT/SIF blocks.
    if (pointer > rows.length) { pushConflict(conflicts, 'RIGID_POINTER_OUT_OF_RANGE', { pointer, rowCount: rows.length }); continue; }
    const values = numeric(rows[pointer - 1], 1);
    if (!values) { pushConflict(conflicts, 'RIGID_RECORD_UNREADABLE', { pointer }); continue; }
    byPointer[pointer] = deepFreeze({ pointer, weight: Number(values[0]), rawFields: Object.freeze([...values]), rawRow: rows[pointer - 1] });
  }
  return deepFreeze({ authority: 'PROTECTED_WRITER_RIGID_POINTER_WEIGHT', sectionRowCount: rows.length, byPointer: Object.freeze(byPointer) });
}
function buildSifEvidence(rawText, descriptors, conflicts) {
  const rows = sectionRows(rawText, ['SIF&TEES', 'SIF']); const pointers = positivePointers(descriptors, 'sifTee'); const byPointer = {};
  if (pointers.length && rows.length % SIF_TEE_BLOCK_ROWS !== 0) {
    pushConflict(conflicts, 'SIF_TEE_SECTION_ROW_COUNT_NOT_MULTIPLE_OF_10', { rowCount: rows.length, rowsPerBlock: SIF_TEE_BLOCK_ROWS });
  }
  for (const pointer of pointers) {
    // Protected writer authority: the IEL SIF&TEES pointer is a 1-based
    // 10-row record-block index, not a section-row index.
    const recordRows = fixedBlockByIndex(rows, pointer, SIF_TEE_BLOCK_ROWS, 'SIF_TEE', conflicts);
    if (!recordRows) continue;
    const first = numeric(recordRows[0], 2);
    if (!first) { pushConflict(conflicts, 'SIF_TEE_RECORD_UNREADABLE', { pointer }); continue; }
    const decodedRows = recordRows.map((row) => decodeCiiNumericRow(row));
    const normalizedFirst = [...first]; normalizedFirst[0] = null;
    byPointer[pointer] = deepFreeze({
      pointer, node: String(Math.round(Number(first[0]))), rawCode: Number(first[1]),
      firstRowFields: Object.freeze([...first]),
      normalizedPayload: Object.freeze([Object.freeze(normalizedFirst), ...decodedRows.slice(1).map((row) => row ? Object.freeze([...row]) : null)]),
      rawRows: Object.freeze(recordRows),
      authority: 'POINTER_BOUND_RAW_SIF_TEE_RECORD; FIELD_2_SEMANTICS_UNQUALIFIED',
    });
  }
  return deepFreeze({
    authority: 'PROTECTED_WRITER_SIF_TEE_BLOCK_INDEX_10_ROWS', sectionRowCount: rows.length,
    blockRows: SIF_TEE_BLOCK_ROWS, byPointer: Object.freeze(byPointer),
  });
}
function bindElementAuxiliary(descriptors, restraints, rigids, sifTee) {
  const byParsedElementIndex = {};
  for (const descriptor of descriptors) {
    const pointers = descriptor.raw.pointers;
    byParsedElementIndex[descriptor.parsedElementIndex] = deepFreeze({
      parsedElementIndex: descriptor.parsedElementIndex, from: descriptor.from, to: descriptor.to,
      pointers,
      restraintRecords: pointers.restraint > 0 ? (restraints.byPointer[pointers.restraint] || Object.freeze([])) : Object.freeze([]),
      rigidRecord: pointers.rigid > 0 ? (rigids.byPointer[pointers.rigid] || null) : null,
      sifTeeRecord: pointers.sifTee > 0 ? (sifTee.byPointer[pointers.sifTee] || null) : null,
    });
  }
  return Object.freeze(byParsedElementIndex);
}
function hasConflict(aux, prefixes) {
  const rows = aux?.conflicts || [];
  return rows.some((item) => prefixes.some((prefix) => String(item.code || '').startsWith(prefix)));
}
function parsedCapability(count, qualification, authority, rawRowCount, limitations = [], details = {}, parseError = false) {
  if (parseError) return deepFreeze({
    state: 'PARSE_ERROR', count: null, qualification: 'NONE', authority,
    raw: Object.freeze({ present: rawRowCount > 0, nonEmptyRowCount: rawRowCount }),
    details: Object.freeze(details),
    limitations: Object.freeze(['Qualified auxiliary custody encountered a parse/custody conflict; this family is fail-closed.', ...limitations]),
  });
  return deepFreeze({
    state: count > 0 ? 'PARSED' : 'EMPTY', count, qualification, authority,
    raw: Object.freeze({ present: rawRowCount > 0, nonEmptyRowCount: rawRowCount }),
    details: Object.freeze(details), limitations: Object.freeze(limitations),
  });
}

export function applyCiiAuxiliaryCapabilities(baseCapabilities, auxiliaryEvidence) {
  const base = baseCapabilities || {}; const families = base.families || {}; const aux = auxiliaryEvidence || {};
  const restraintRecords = aux.restraints?.records || [];
  const restraintNodes = new Set(restraintRecords.map((record) => String(record.node)));
  const rigidRecords = Object.values(aux.rigids?.byPointer || {});
  const sifRecords = Object.values(aux.sifTee?.byPointer || {});
  const commonConflict = hasConflict(aux, ['AUX_']);
  const restraintError = commonConflict || hasConflict(aux, ['RESTRAINT_']) || (Number(aux.restraints?.sectionRowCount || 0) > 0 && restraintRecords.length === 0);
  const rigidError = commonConflict || hasConflict(aux, ['RIGID_']) || (Number(aux.rigids?.sectionRowCount || 0) > 0 && rigidRecords.length === 0);
  const sifError = commonConflict || hasConflict(aux, ['SIF_TEE_']) || (Number(aux.sifTee?.sectionRowCount || 0) > 0 && sifRecords.length === 0);
  const miscelRows = Number(aux.miscel1SectionRowCount || 0);
  return deepFreeze({
    ...base,
    families: Object.freeze({
      ...families,
      restraints: parsedCapability(
        restraintRecords.length, 'PARTIAL', 'tabs/cii-workspace/cii-workspace-auxiliary.js#RESTRANT',
        Number(aux.restraints?.sectionRowCount || 0),
        ['Numeric node/type/stiffness/gap/friction/connecting-node and direction-cosine fields are source-qualified; semantic meaning of CAESAR restraint type codes is not mapped in this workspace.'],
        { nodeCount: restraintNodes.size, rawRecordCount: restraintRecords.length, gapFrictionQualified: true, pointerUnit: '24_ROW_BLOCK_INDEX' }, restraintError,
      ),
      rigidMass: parsedCapability(
        rigidRecords.length, 'QUALIFIED', 'tabs/cii-workspace/cii-workspace-auxiliary.js#RIGID_POINTER',
        Number(aux.rigids?.sectionRowCount || 0), [], { pointerBoundRecordCount: rigidRecords.length, pointerUnit: 'ROW_RECORD_INDEX' }, rigidError,
      ),
      sifTee: parsedCapability(
        sifRecords.length, 'PARTIAL', 'tabs/cii-workspace/cii-workspace-auxiliary.js#SIF_TEE_POINTER',
        Number(aux.sifTee?.sectionRowCount || 0),
        ['SIF&TEES record custody and raw payload are pointer-qualified by 10-row record block; the semantic meaning of the second numeric field/raw code is not asserted.'],
        { pointerBoundRecordCount: sifRecords.length, pointerUnit: '10_ROW_BLOCK_INDEX' }, sifError,
      ),
      hangers: deepFreeze({
        state: 'NOT_PARSED', count: null, qualification: 'NONE', authority: null,
        raw: Object.freeze({ present: miscelRows > 0, nonEmptyRowCount: miscelRows, section: 'MISCEL_1' }),
        limitations: Object.freeze(['MISCEL_1 raw data is present when indicated, but hanger group/node custody is not qualified in this phase; no hanger count or deletion claim is asserted.']),
      }),
    }),
  });
}

export function buildCiiWorkspaceAuxiliaryEvidence(rawText, parsed = {}) {
  const conflicts = []; const raw = rawElementBlocks(rawText, conflicts); const descriptors = matchBlocks(parsed, raw.blocks, conflicts);
  const restraints = buildRestraintEvidence(rawText, descriptors, conflicts);
  const rigids = buildRigidEvidence(rawText, descriptors, conflicts);
  const sifTee = buildSifEvidence(rawText, descriptors, conflicts);
  const elements = bindElementAuxiliary(descriptors, restraints, rigids, sifTee);
  const miscel1SectionRowCount = sectionRows(rawText, 'MISCEL_1').length;
  return deepFreeze({
    schema: 'CIIWorkspaceAuxiliaryEvidence.v1',
    sourceAuthority: '3D_Converters/inputxml_to_cii2019.py fixed rows + IEL block-index pointer order',
    elementBlockRows: ELEMENT_BLOCK_ROWS,
    rawElementBlockCount: raw.blocks.length,
    mappedElementCount: descriptors.length,
    elements,
    restraints, rigids, sifTee, miscel1SectionRowCount,
    conflicts: Object.freeze(conflicts),
    semanticHashBasis: stableStringify({
      elements: Object.values(elements).map((item) => ({ from: item.from, to: item.to, pointers: item.pointers })),
      restraints: restraints.records.map((record) => ({ node: record.node, typeCode: record.typeCode, gap: record.gap, friction: record.friction })),
      rigidPointers: Object.keys(rigids.byPointer), sifPointers: Object.keys(sifTee.byPointer),
    }),
  });
}
