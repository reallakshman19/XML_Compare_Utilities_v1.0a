import { CII_SIX_FIELD_WIDTHS, decodeCiiNumericRow, decodeFixedFields, parseFortranNumber } from '../../parser/fixed-field.js';
import { resolveDocumentNodeNameScope, resolveNodeNameScope } from './cii-workspace-find-replace-nodename-scope.js';
import { buildAuxPointerOwners, physicalSectionRefs, readAuxControlCount, V14_AUX_BLOCKS, canonicalAuxBlock, readAuxPointer, resolveV14AuxiliaryRecord } from './cii-workspace-find-replace-v14-aux-authority.js';
import { auxiliaryMutableFieldSpans, elementMutableFieldSpans } from './cii-workspace-find-replace-v14-field-authority.js';

/*
 * CII v14 Find & Replace scope resolution.
 * Default calls preserve U1 behavior. Mutation validation opts into field-aware
 * spans, which protect Element identity/pointers and generic record boundaries.
 */

const ELEMENT_ROWS = 15;
const FORCMNT_ROWS = 20;
const ZERO_DISPLACEMENT_NODE = 0;
const MISSING_DISPLACEMENT_NODE = 9999.99;

function physicalLines(textInput) {
  const text = String(textInput ?? '');
  const matches = text.match(/[^\r\n]*(?:\r\n|\n|\r|$)/g) || [];
  const lines = [];
  let offset = 0;
  for (const raw of matches) {
    if (!raw) continue;
    const ending = raw.endsWith('\r\n') ? '\r\n' : raw.endsWith('\n') ? '\n' : raw.endsWith('\r') ? '\r' : '';
    const body = ending ? raw.slice(0, -ending.length) : raw;
    lines.push(Object.freeze({ body, ending, start: offset, bodyEnd: offset + body.length, end: offset + raw.length }));
    offset += raw.length;
  }
  return lines;
}

function sectionRefs(lines, wanted, options = {}) {
  const marker = new RegExp(`^\\s*#\\$\\s*${wanted}\\s*$`, 'i');
  const start = lines.findIndex((line) => marker.test(line.body));
  if (start < 0) return { status: 'BLOCKED', blockers: [`SECTION_NOT_FOUND:${wanted}`], refs: [] };
  const refs = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^\s*#\$\s*/.test(lines[index].body)) break;
    if (!options.keepBlank && !lines[index].body.trim()) continue;
    if (options.skipComments && lines[index].body.trim().startsWith('*')) continue;
    refs.push(Object.freeze({ ...lines[index], lineIndex: index }));
  }
  return { status: 'PASS', blockers: [], refs };
}

function lineSpans(refs, metadata = {}) {
  return Object.freeze((refs || []).map((ref) => Object.freeze({
    start: ref.start, end: ref.bodyEnd, lineIndex: ref.lineIndex, ...metadata,
  })));
}

function integerIdentity(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

function parseElementHeader(body) {
  const fields = decodeFixedFields(body, CII_SIX_FIELD_WIDTHS);
  const from = parseFortranNumber(fields[0]); const to = parseFortranNumber(fields[1]);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  const roundedFrom = Math.round(from); const roundedTo = Math.round(to);
  if (Math.abs(from - roundedFrom) > 1e-9 || Math.abs(to - roundedTo) > 1e-9) return null;
  return { from: roundedFrom, to: roundedTo };
}

function elementBlocks(lines) {
  const section = sectionRefs(lines, 'ELEMENTS');
  if (section.status !== 'PASS') return section;
  if (!section.refs.length || section.refs.length % ELEMENT_ROWS !== 0) {
    return { status: 'BLOCKED', blockers: [`ELEMENT_BLOCK_CARDINALITY_INVALID:${section.refs.length}`], blocks: [] };
  }
  const blocks = [];
  for (let offset = 0; offset < section.refs.length; offset += ELEMENT_ROWS) {
    const refs = section.refs.slice(offset, offset + ELEMENT_ROWS);
    const identity = parseElementHeader(refs[0].body);
    if (!identity) return { status: 'BLOCKED', blockers: [`ELEMENT_HEADER_INVALID:${offset / ELEMENT_ROWS}`], blocks: [] };
    blocks.push(Object.freeze({ index: offset / ELEMENT_ROWS, from: identity.from, to: identity.to, refs: Object.freeze(refs) }));
  }
  return { status: 'PASS', blockers: [], blocks: Object.freeze(blocks) };
}

function exactElementBlock(lines, operation) {
  const from = integerIdentity(operation?.from); const to = integerIdentity(operation?.to);
  if (from == null || to == null) return { status: 'BLOCKED', blockers: ['ELEMENT_FROM_TO_REQUIRED'] };
  const parsed = elementBlocks(lines);
  if (parsed.status !== 'PASS') return parsed;
  const matches = parsed.blocks.filter((block) => block.from === from && block.to === to);
  if (!matches.length) return { status: 'BLOCKED', blockers: [`ELEMENT_NOT_FOUND:${from}:${to}`] };
  if (matches.length !== 1) return { status: 'BLOCKED', blockers: [`ELEMENT_IDENTITY_AMBIGUOUS:${from}:${to}:${matches.length}`] };
  return { status: 'PASS', blockers: [], block: matches[0] };
}

function resolveElement(lines, operation, options = {}) {
  const resolved = exactElementBlock(lines, operation);
  if (resolved.status !== 'PASS') return resolved;
  if (!options.fieldAwareMutation) {
    return Object.freeze({
      status: 'PASS', scope: 'ELEMENT', authority: 'CII_V14_EXACT_15_ROW_ELEMENT_BLOCK',
      spans: lineSpans(resolved.block.refs, { section: 'ELEMENTS', elementIndex: resolved.block.index }),
      evidence: Object.freeze({ from: resolved.block.from, to: resolved.block.to, elementIndex: resolved.block.index, rowCount: ELEMENT_ROWS }),
      blockers: Object.freeze([]),
    });
  }
  const fields = elementMutableFieldSpans(resolved.block);
  if (fields.status !== 'PASS') return fields;
  return Object.freeze({
    status: 'PASS', scope: 'ELEMENT', authority: 'CII_V14_ELEMENT_MUTABLE_FIELD_AUTHORITY', fieldAware: true,
    spans: fields.spans,
    evidence: Object.freeze({
      from: resolved.block.from, to: resolved.block.to, elementIndex: resolved.block.index,
      rowCount: ELEMENT_ROWS, mutableFieldCount: fields.spans.length,
      protected: Object.freeze(['FROM', 'TO', 'IEL_POINTERS_1_15']),
    }),
    blockers: Object.freeze([]),
  });
}

function displacementPointer(block) {
  const pointer = readAuxPointer(block, V14_AUX_BLOCKS.DISPLMNT);
  return Number.isSafeInteger(pointer) && pointer > 0 ? pointer : null;
}

function isMissingDisplacementNode(value) {
  return Number.isFinite(value) && (Math.abs(value - ZERO_DISPLACEMENT_NODE) < 1e-9
    || Math.abs(value - MISSING_DISPLACEMENT_NODE) < 1e-6);
}

function displacementNode(ref) {
  const values = decodeCiiNumericRow(ref?.body || '');
  return Number.isFinite(values?.[0]) ? values[0] : null;
}

function validateDisplacementIdentity(refs, from, to) {
  const candidates = [displacementNode(refs[0]), displacementNode(refs[10])]
    .filter((value) => Number.isFinite(value) && !isMissingDisplacementNode(value))
    .map((value) => Math.round(value));
  if (!candidates.length) return ['DISPLMNT_BLOCK_HAS_NO_ENDPOINT_IDENTITY'];
  const allowed = new Set([from, to]);
  const outside = candidates.filter((value) => !allowed.has(value));
  return outside.length ? [`DISPLMNT_ENDPOINT_IDENTITY_MISMATCH:${outside.join(',')}`] : [];
}

function displacementBlockers(result, operation) {
  const from = integerIdentity(operation?.from); const to = integerIdentity(operation?.to);
  return (result?.blockers || []).map((blocker) => (
    blocker === `AUX_POINTER_REQUIRED:DISPLMNT:${from}:${to}` ? `DISPLMNT_POINTER_REQUIRED:${from}:${to}` : blocker
  ));
}

function resolveDisplacement(lines, operation, options = {}) {
  const owned = resolveV14AuxiliaryRecord(lines, { ...operation, block: 'DISPLMNT' }, { elementBlocks, exactElementBlock });
  if (owned.status !== 'PASS') return { ...owned, blockers: displacementBlockers(owned, operation) };
  const identityBlockers = validateDisplacementIdentity(owned.refs, owned.evidence.from, owned.evidence.to);
  if (identityBlockers.length) return { status: 'BLOCKED', blockers: identityBlockers };
  if (!options.fieldAwareMutation) {
    return Object.freeze({
      status: 'PASS', scope: 'BLOCK', block: 'DISPLACEMENT', authority: 'CII_V14_ELEMENT_DISPLMNT_POINTER_20_ROW_BLOCK',
      spans: lineSpans(owned.refs, { section: 'DISPLMNT', pointer: owned.evidence.pointer }), evidence: owned.evidence,
      blockers: Object.freeze([]),
    });
  }
  const fields = auxiliaryMutableFieldSpans('DISPLMNT', owned.refs);
  if (fields.status !== 'PASS') return fields;
  return Object.freeze({
    status: 'PASS', scope: 'BLOCK', block: 'DISPLACEMENT', authority: 'CII_V14_ELEMENT_DISPLMNT_POINTER_20_ROW_BLOCK',
    fieldAware: true, spans: fields.spans, evidence: Object.freeze({ ...owned.evidence, mutableFieldCount: fields.spans.length }),
    blockers: Object.freeze([]),
  });
}

function resolveGenericAuxiliary(lines, operation, block, options = {}) {
  const owned = resolveV14AuxiliaryRecord(lines, { ...operation, block }, { elementBlocks, exactElementBlock });
  if (owned.status !== 'PASS') return Object.freeze({ ...owned, scope: 'BLOCK', block, spans: Object.freeze([]) });
  if (!options.fieldAwareMutation) {
    return Object.freeze({
      status: 'BLOCKED', scope: 'BLOCK', block, authority: 'CII_V14_AUX_RECORD_OWNERSHIP_READ_ONLY',
      spans: Object.freeze([]), evidence: owned.evidence, blockers: Object.freeze([`BLOCK_MUTATION_NOT_QUALIFIED:${block}`]),
    });
  }
  const fields = auxiliaryMutableFieldSpans(block, owned.refs);
  if (fields.status !== 'PASS') return Object.freeze({ ...fields, scope: 'BLOCK', block });
  return Object.freeze({
    status: 'PASS', scope: 'BLOCK', block, authority: 'CII_V14_AUX_RECORD_FIELD_AUTHORITY', fieldAware: true,
    spans: fields.spans, evidence: Object.freeze({ ...owned.evidence, mutableFieldCount: fields.spans.length }), blockers: Object.freeze([]),
  });
}

function resolveForce() {
  return Object.freeze({
    status: 'BLOCKED', scope: 'BLOCK', block: 'FORCE',
    authority: 'CII_FORCMNT_20_ROW_BLOCK_AUTHORITY_PENDING_OWNERSHIP_MAP', spans: Object.freeze([]),
    evidence: Object.freeze({ rowsPerBlock: FORCMNT_ROWS }), blockers: Object.freeze(['FORCMNT_BLOCK_AUTHORITY_NOT_QUALIFIED']),
  });
}

function smartSpan(span, metadata = {}) {
  return Object.freeze({ ...span, ...metadata });
}

function documentQualifiedFieldScope(lines) {
  const parsedElements = elementBlocks(lines);
  if (parsedElements.status !== 'PASS') return parsedElements;
  const spans = [];
  const skipped = [];

  for (const element of parsedElements.blocks) {
    const fields = elementMutableFieldSpans(element);
    if (fields.status !== 'PASS') return fields;
    for (const span of fields.spans) {
      if (span.fieldKind !== 'NUMERIC') continue;
      spans.push(smartSpan(span, {
        block: 'ELEMENTS', smartKind: 'NUMERIC',
        smartGroup: `ELEMENTS:${span.fieldIdentity || 'UNKNOWN'}`,
      }));
    }
  }

  const nodeNames = resolveDocumentNodeNameScope(lines, { sectionRefs, elementBlocks, exactElementBlock });
  if (nodeNames.status === 'PASS') {
    for (const span of nodeNames.spans) spans.push(smartSpan(span, {
      block: 'NODENAME', smartKind: 'NODENAME', smartGroup: 'NODENAME',
    }));
  } else {
    skipped.push(...(nodeNames.blockers || []).map((value) => `NODENAME:${value}`));
  }

  for (const [block, spec] of Object.entries(V14_AUX_BLOCKS)) {
    if (block === 'NODENAME' || block === 'FORCMNT') continue;
    const control = readAuxControlCount(lines, spec);
    if (control.status !== 'PASS') {
      skipped.push(...(control.blockers || []).map((value) => `${block}:${value}`));
      continue;
    }
    if (control.count === 0) continue;
    const section = physicalSectionRefs(lines, spec.section);
    if (section.status !== 'PASS') {
      skipped.push(...(section.blockers || []).map((value) => `${block}:${value}`));
      continue;
    }
    const expectedRows = control.count * spec.rowsPerRecord;
    if (section.refs.length !== expectedRows) {
      skipped.push(`${block}:AUX_SECTION_CARDINALITY_MISMATCH:${section.refs.length}:${expectedRows}`);
      continue;
    }
    const ownership = buildAuxPointerOwners(parsedElements.blocks, spec, control.count);
    if (ownership.blockers.length) {
      skipped.push(...ownership.blockers.map((value) => `${block}:${value}`));
      continue;
    }
    for (let pointer = 1; pointer <= control.count; pointer += 1) {
      const owners = ownership.owners.get(pointer) || [];
      if (owners.length !== 1) {
        if (owners.length > 1) skipped.push(`${block}:AUX_POINTER_SHARED:${pointer}:${owners.length}`);
        continue;
      }
      const start = (pointer - 1) * spec.rowsPerRecord;
      const refs = section.refs.slice(start, start + spec.rowsPerRecord);
      const fields = auxiliaryMutableFieldSpans(block, refs);
      if (fields.status !== 'PASS') {
        skipped.push(...(fields.blockers || []).map((value) => `${block}:${pointer}:${value}`));
        continue;
      }
      for (const span of fields.spans) {
        if (span.fieldKind !== 'NUMERIC') continue;
        spans.push(smartSpan(span, {
          block, pointer, ownerElementIndex: owners[0].elementIndex,
          smartKind: 'NUMERIC', smartGroup: `${block}:${span.fieldIdentity || 'UNKNOWN'}`,
        }));
      }
    }
  }

  return Object.freeze({
    status: 'PASS', scope: 'DOCUMENT', fieldAware: true, smartFieldAware: true,
    authority: 'CII_V14_DOCUMENT_QUALIFIED_MUTABLE_FIELD_INDEX',
    spans: Object.freeze(spans), blockers: Object.freeze([]),
    evidence: Object.freeze({
      elementCount: parsedElements.blocks.length,
      mutableSmartFieldCount: spans.length,
      skippedAuthorityCount: skipped.length,
      skippedAuthority: Object.freeze(skipped),
      excluded: Object.freeze(['FORCMNT', 'VARIABLE_LENGTH_TEXT']),
    }),
  });
}

function documentSpans(lines) {
  return Object.freeze(lines.filter((line) => line.body.length > 0).map((line) => Object.freeze({
    start: line.start, end: line.bodyEnd, lineIndex: lines.indexOf(line), section: 'DOCUMENT',
  })));
}

function blockToken(value) { return String(value || '').trim().toUpperCase().replace(/[\s_-]+/g, ''); }

export function resolveFindReplaceScope(target0Input, operation = {}, options = {}) {
  const lines = physicalLines(target0Input);
  const scope = String(operation?.scope || 'DOCUMENT').trim().toUpperCase();
  if (scope === 'DOCUMENT') {
    if (options.smartFixedWidth === 'QUALIFIED_FIELDS') return documentQualifiedFieldScope(lines);
    if (options.smartFixedWidth === 'NODENAME') {
      return resolveDocumentNodeNameScope(lines, { sectionRefs, elementBlocks, exactElementBlock });
    }
    return Object.freeze({ status: 'PASS', scope, authority: 'TARGET0_PHYSICAL_LINE_BODIES', spans: documentSpans(lines), evidence: Object.freeze({ lineCount: lines.length }), blockers: Object.freeze([]) });
  }
  if (scope === 'ELEMENT') return resolveElement(lines, operation, options);
  if (scope === 'BLOCK') {
    const block = blockToken(operation?.block);
    if (block === 'NODENAME') return resolveNodeNameScope(lines, operation, { sectionRefs, elementBlocks, exactElementBlock });
    if (block === 'DISPLACEMENT' || block === 'DISPLMNT') return resolveDisplacement(lines, operation, options);
    if (block === 'FORCE' || block === 'FORCMNT') return resolveForce();
    const auxiliary = canonicalAuxBlock(operation?.block);
    if (auxiliary) return resolveGenericAuxiliary(lines, operation, auxiliary, options);
    return Object.freeze({ status: 'BLOCKED', scope, block, spans: Object.freeze([]), blockers: Object.freeze([`BLOCK_SCOPE_UNSUPPORTED:${block || 'UNKNOWN'}`]) });
  }
  return Object.freeze({ status: 'BLOCKED', scope, spans: Object.freeze([]), blockers: Object.freeze([`SCOPE_UNSUPPORTED:${scope || 'UNKNOWN'}`]) });
}

export const _test = Object.freeze({ physicalLines, sectionRefs, elementBlocks, exactElementBlock, displacementPointer });
