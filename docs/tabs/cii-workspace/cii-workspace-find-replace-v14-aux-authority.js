import { CII_SIX_FIELD_WIDTHS, decodeFixedFields, parseFortranNumber } from '../../parser/fixed-field.js';

/*
 * Read-only CAESAR II v14 auxiliary ownership authority.
 *
 * This module may read ELEMENT pointer fields, CONTROL counts and exact
 * auxiliary records. It never authorizes payload mutation, pointer changes,
 * CONTROL changes, record cloning or section insertion.
 */

const GENERIC = 'GENERIC';
const SPECIAL = 'SPECIAL';
const BLOCKED = 'BLOCKED';

function auxSpec(pointerIndex, section, rowsPerRecord, controlRow, controlField, strategy = GENERIC) {
  return Object.freeze({ pointerIndex, section, rowsPerRecord, controlRow, controlField, strategy });
}

export const V14_AUX_BLOCKS = Object.freeze({
  BEND: auxSpec(0, 'BEND', 3, 1, 0),
  RIGID: auxSpec(1, 'RIGID', 1, 1, 1),
  EXPJT: auxSpec(2, 'EXPJT', 1, 1, 2),
  RESTRANT: auxSpec(3, 'RESTRANT', 24, 1, 3),
  DISPLMNT: auxSpec(4, 'DISPLMNT', 20, 1, 4, SPECIAL),
  FORCMNT: auxSpec(5, 'FORCMNT', 20, 1, 5, BLOCKED),
  UNIFORM: auxSpec(6, 'UNIFORM', 6, 2, 0),
  WIND: auxSpec(7, 'WIND', 1, 2, 1),
  OFFSETS: auxSpec(8, 'OFFSETS', 1, 2, 2),
  ALLOWBLS: auxSpec(9, 'ALLOWBLS', 28, 2, 3),
  'SIF&TEES': auxSpec(10, 'SIF&TEES', 14, 2, 4),
  NODENAME: auxSpec(11, 'NODENAME', 1, 0, 3, SPECIAL),
  REDUCERS: auxSpec(12, 'REDUCERS', 2, 0, 4),
  FLANGES: auxSpec(13, 'FLANGES', 12, 0, 5),
  EQUIPMNT: auxSpec(14, 'EQUIPMNT', 6, 3, 0),
});

const BLOCK_ALIASES = Object.freeze({
  DISPLACEMENT: 'DISPLMNT',
  FORCE: 'FORCMNT',
  RESTRAINT: 'RESTRANT',
  EXPANSIONJOINT: 'EXPJT',
  UNIFORMLOAD: 'UNIFORM',
  WINDLOAD: 'WIND',
  ELEMENTOFFSET: 'OFFSETS',
  ALLOWABLESTRESS: 'ALLOWBLS',
  SIFTEES: 'SIF&TEES',
  REDUCER: 'REDUCERS',
  FLANGE: 'FLANGES',
  EQUIPMENT: 'EQUIPMNT',
  NODENAME: 'NODENAME',
});

function token(value) {
  return String(value || '').trim().toUpperCase().replace(/[\s_-]+/g, '');
}

export function canonicalAuxBlock(value) {
  const raw = token(value);
  if (V14_AUX_BLOCKS[raw]) return raw;
  return BLOCK_ALIASES[raw] || null;
}

function fixedInteger(ref, fieldIndex) {
  if (!ref) return null;
  const fields = decodeFixedFields(ref.body, CII_SIX_FIELD_WIDTHS);
  const value = parseFortranNumber(fields[fieldIndex]);
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return Math.abs(value - rounded) <= 1e-9 && rounded >= 0 ? rounded : null;
}

function pointerCoordinates(pointerIndex) {
  return Object.freeze({
    rowIndex: 12 + Math.floor(pointerIndex / 6),
    fieldIndex: pointerIndex % 6,
  });
}

export function readAuxPointer(elementBlock, spec) {
  const coordinates = pointerCoordinates(spec.pointerIndex);
  return fixedInteger(elementBlock?.refs?.[coordinates.rowIndex], coordinates.fieldIndex);
}

export function physicalSectionRefs(lines, wanted) {
  const marker = new RegExp(`^\\s*#\\$\\s*${wanted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i');
  const starts = [];
  for (let index = 0; index < lines.length; index += 1) if (marker.test(lines[index].body)) starts.push(index);
  if (!starts.length) return { status: 'BLOCKED', blockers: [`SECTION_NOT_FOUND:${wanted}`], refs: [] };
  if (starts.length !== 1) return { status: 'BLOCKED', blockers: [`SECTION_DUPLICATE:${wanted}:${starts.length}`], refs: [] };
  const refs = [];
  for (let index = starts[0] + 1; index < lines.length; index += 1) {
    if (/^\s*#\$\s*/.test(lines[index].body)) break;
    refs.push(Object.freeze({ ...lines[index], lineIndex: index }));
  }
  const comment = refs.find((ref) => ref.body.trim().startsWith('*'));
  if (comment) return { status: 'BLOCKED', blockers: [`SECTION_COMMENT_AMBIGUOUS:${wanted}:${comment.lineIndex}`], refs: [] };
  return { status: 'PASS', blockers: [], refs: Object.freeze(refs) };
}

export function readAuxControlCount(lines, spec) {
  const control = physicalSectionRefs(lines, 'CONTROL');
  if (control.status !== 'PASS') return control;
  if (control.refs.length !== 4) {
    return { status: 'BLOCKED', blockers: [`CONTROL_ROW_CARDINALITY_INVALID:${control.refs.length}:4`] };
  }
  const count = fixedInteger(control.refs[spec.controlRow], spec.controlField);
  if (count == null) {
    return { status: 'BLOCKED', blockers: [`CONTROL_COUNT_UNREADABLE:${spec.section}:${spec.controlRow}:${spec.controlField}`] };
  }
  return { status: 'PASS', blockers: [], count };
}

function addOwner(owners, pointer, block) {
  const list = owners.get(pointer) || [];
  list.push(Object.freeze({ elementIndex: block.index, from: block.from, to: block.to }));
  owners.set(pointer, list);
}

export function buildAuxPointerOwners(blocks, spec, controlCount) {
  const owners = new Map();
  const blockers = [];
  for (const block of blocks || []) {
    const pointer = readAuxPointer(block, spec);
    if (pointer == null) {
      blockers.push(`AUX_POINTER_UNREADABLE:${spec.section}:${block.index}`);
      continue;
    }
    if (pointer === 0) continue;
    if (pointer > controlCount) {
      blockers.push(`AUX_POINTER_OUT_OF_RANGE:${spec.section}:${pointer}:${controlCount}:${block.index}`);
      continue;
    }
    addOwner(owners, pointer, block);
  }
  return { owners, blockers };
}

function blocked(blockers, evidence = null) {
  return Object.freeze({ status: 'BLOCKED', blockers: Object.freeze(blockers), refs: Object.freeze([]), evidence });
}

function resolveSpec(operation) {
  const block = canonicalAuxBlock(operation?.block);
  if (!block) return { block: null, spec: null };
  return { block, spec: V14_AUX_BLOCKS[block] };
}

function validateSection(lines, spec, controlCount) {
  const section = physicalSectionRefs(lines, spec.section);
  if (section.status !== 'PASS') return section;
  const expected = controlCount * spec.rowsPerRecord;
  if (section.refs.length !== expected) {
    return blocked([`AUX_SECTION_CARDINALITY_MISMATCH:${spec.section}:${section.refs.length}:${expected}:${controlCount}:${spec.rowsPerRecord}`]);
  }
  return section;
}

function ownershipContext(lines, helpers, spec, controlCount) {
  const elements = helpers.elementBlocks(lines);
  if (elements.status !== 'PASS') return elements;
  const ownership = buildAuxPointerOwners(elements.blocks, spec, controlCount);
  if (ownership.blockers.length) return blocked(ownership.blockers);
  return { status: 'PASS', blocks: elements.blocks, owners: ownership.owners };
}

export function resolveV14AuxiliaryRecord(lines, operation, helpers) {
  const { block, spec } = resolveSpec(operation);
  if (!spec) return blocked([`AUX_BLOCK_UNSUPPORTED:${token(operation?.block) || 'UNKNOWN'}`]);
  if (spec.strategy === BLOCKED) return blocked(['FORCMNT_BLOCK_AUTHORITY_NOT_QUALIFIED']);
  if (block === 'NODENAME') return blocked(['AUX_SPECIAL_RESOLVER_REQUIRED:NODENAME']);

  const selected = helpers.exactElementBlock(lines, operation);
  if (selected.status !== 'PASS') return selected;
  const pointer = readAuxPointer(selected.block, spec);
  if (pointer == null) return blocked([`AUX_POINTER_UNREADABLE:${spec.section}:${selected.block.index}`]);
  if (pointer === 0) return blocked([`AUX_POINTER_REQUIRED:${spec.section}:${selected.block.from}:${selected.block.to}`]);

  const control = readAuxControlCount(lines, spec);
  if (control.status !== 'PASS') return control;
  if (pointer > control.count) return blocked([`AUX_POINTER_OUT_OF_RANGE:${spec.section}:${pointer}:${control.count}:${selected.block.index}`]);
  const section = validateSection(lines, spec, control.count);
  if (section.status !== 'PASS') return section;
  const ownership = ownershipContext(lines, helpers, spec, control.count);
  if (ownership.status !== 'PASS') return ownership;

  const owners = ownership.owners.get(pointer) || [];
  if (!owners.length) return blocked([`AUX_POINTER_OWNER_MISSING:${spec.section}:${pointer}`]);
  if (owners.length !== 1) return blocked([`AUX_POINTER_SHARED:${spec.section}:${pointer}:${owners.length}`], Object.freeze({ owners: Object.freeze(owners) }));
  if (owners[0].elementIndex !== selected.block.index) {
    return blocked([`AUX_POINTER_OWNER_MISMATCH:${spec.section}:${pointer}:${selected.block.index}:${owners[0].elementIndex}`]);
  }

  const recordIndex = pointer - 1;
  const start = recordIndex * spec.rowsPerRecord;
  const refs = Object.freeze(section.refs.slice(start, start + spec.rowsPerRecord));
  return Object.freeze({
    status: 'PASS', block, section: spec.section, refs,
    authority: 'CII_V14_ELEMENT_AUX_POINTER_CONTROL_OWNERSHIP',
    evidence: Object.freeze({
      from: selected.block.from, to: selected.block.to, elementIndex: selected.block.index,
      pointer, recordIndex, rowCount: spec.rowsPerRecord, controlCount: control.count, ownerCount: owners.length,
    }),
    blockers: Object.freeze([]),
  });
}

export const _test = Object.freeze({ fixedInteger, pointerCoordinates, token });
