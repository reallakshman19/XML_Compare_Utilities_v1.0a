import assert from 'node:assert/strict';
import { createCiiPhysicalFile } from '../tabs/cii-workspace/cii-workspace-physical-file.js';
import { sha256CiiByteString } from '../tabs/cii-workspace/cii-workspace-byte-sha256.js';
import { extractCiiNodeNameEvidence } from '../tabs/cii-workspace/cii-workspace-nodename.js';
import { extractCiiWriter1CSifEvidence } from '../tabs/cii-workspace/cii-workspace-writer1c-sif-custody.js';
import { buildCiiHangerEvidence } from '../tabs/cii-workspace/cii-workspace-hanger.js';
import { CII_WRITER_2_NODENAME_RELOCATION_POLICY } from '../tabs/cii-workspace/cii-workspace-writer2-nodename-relocation.js';
import { CII_WRITER_2_SIF_DELETE_POLICY } from '../tabs/cii-workspace/cii-workspace-writer2-sif-delete.js';
import { CII_WRITER_2_HANGER_DELETE_POLICY } from '../tabs/cii-workspace/cii-workspace-writer2-hanger-delete.js';

const WIDTHS = [15, 13, 13, 13, 13, 13];
const SOURCE_SHA = '1'.repeat(64);

export function numericRow(values) {
  return values.map((value, index) => String(value ?? 0).padStart(WIDTHS[index], ' ')).join('');
}
export function textRow(value = '') { return `${String(value.length).padStart(12, ' ')} ${value}`; }
function nameRow(fromName = '', toName = '') { return `  ${String(fromName).padEnd(26, ' ')}${String(toName).padEnd(25, ' ')}`; }
function elementBlock(from, to, sifPointer, nodePointer, restraintPointer) {
  const rows = Array.from({ length: 15 }, () => numericRow([0, 0, 0, 0, 0, 0]));
  rows[0] = numericRow([from, to, 0, 0, 0, 100]);
  rows[12] = numericRow([0, 0, 0, restraintPointer, 0, 0]);
  rows[13] = numericRow([0, 0, 0, 0, sifPointer, nodePointer]);
  return rows;
}
function sifBlock(pointer) {
  return Array.from({ length: 10 }, (_, row) => {
    const seed = pointer * 100 + row * 10;
    return numericRow([seed + 1, seed + 2, seed + 3, seed + 4, seed + 5, seed + 6]);
  });
}
export function occupied(node, overrides = {}) {
  return Object.freeze({ node, type: 1, stiffness: 1751200000000, gap: 0, friction: 0, connectingNode: 0, cosines: [1, 0, 0], ...overrides });
}
function restraintSlotRows(spec = null) {
  if (!spec) return [numericRow([0, 0, 0, 0, 0, 0]), numericRow([0, 0, 0]), textRow(), textRow()];
  return [
    numericRow([spec.node, spec.type, spec.stiffness, spec.gap, spec.friction, spec.connectingNode]),
    numericRow(spec.cosines), textRow(spec.tag ?? ''), textRow(spec.guid ?? ''),
  ];
}
function restraintBlock(spec) {
  const rows = [];
  for (let slot = 1; slot <= 6; slot += 1) rows.push(...restraintSlotRows(slot === 1 ? spec : null));
  assert.equal(rows.length, 24); return rows;
}
function hangerPayload(node = 20) {
  return [
    numericRow([106, 106, 106, 106]),
    numericRow([1, 25, 0, 9999, 1, 1]),
    numericRow([1, 0, 0, 0, 0]),
    numericRow([node]),
    numericRow([100, 25, 0, 0, 0, 0]),
    numericRow([0, 9999, 0, 0, 0, 0]),
    '           0 ', '           0 ',
    numericRow([node, 0, 1, 0]), numericRow([1]), numericRow([1]), numericRow([0]), numericRow([0]),
    numericRow([0, 0, 0, 2, 0, 1]), numericRow([0, 0, 21, 21, 0, 0]), numericRow([0, 0, 0, 0, 0, 3]), numericRow([3]),
  ];
}
function parsedModel() {
  const elements = [
    { index: 0, from: 10, to: 20 }, { index: 1, from: 30, to: 40 },
    { index: 2, from: 50, to: 60 }, { index: 3, from: 70, to: 80 },
  ];
  const nodes = Object.fromEntries([...new Set(elements.flatMap((item) => [item.from, item.to]))]
    .map((id) => [String(id), Object.freeze({})]));
  return Object.freeze({ nodes: Object.freeze(nodes), elements: Object.freeze(elements.map((item) => Object.freeze(item))) });
}
export function targetGraph() {
  return Object.freeze({ edges: Object.freeze(parsedModel().elements.map((item) => Object.freeze({
    elementId: `E${item.index + 1}`, parsedElementIndex: item.index, from: String(item.from), to: String(item.to),
  }))) });
}
function buildRestraintSpecs(restraintPointers) {
  const parsed = parsedModel(); const blockCount = Math.max(0, ...restraintPointers.map(Number));
  const specs = {};
  for (let pointer = 1; pointer <= blockCount; pointer += 1) {
    const owner = restraintPointers.findIndex((value) => Number(value) === pointer);
    if (owner < 0) throw new Error(`FIXTURE_RESTRAINT_POINTER_OWNER_REQUIRED:${pointer}`);
    specs[pointer] = occupied(parsed.elements[owner].from);
  }
  return Object.freeze(specs);
}
function fixtureText({ restraintPointers, sifPointers, nodePointers, hangerCount }) {
  const parsed = parsedModel(); const restraintSpecs = buildRestraintSpecs(restraintPointers);
  const restraintCount = Object.keys(restraintSpecs).length;
  const elements = parsed.elements.map((item, index) => ({
    ...item, sif: sifPointers[index], name: nodePointers[index], restraint: restraintPointers[index],
  }));
  const rows = [
    '#$ VERSION', numericRow([5, 11, 1256, 0, 0, 0]),
    '#$ CONTROL', numericRow([4, 0, hangerCount, 3, 0, 0]),
    numericRow([0, 0, 0, restraintCount, 0, 0]),
    numericRow([0, 0, 0, 0, 3, 0]), numericRow([0, 0, 0, 0, 0, 0]),
    '#$ ELEMENTS', ...elements.flatMap((item) => elementBlock(item.from, item.to, item.sif, item.name, item.restraint)),
    '#$ NODENAME', nameRow('A10', 'A20'), nameRow('', 'D40'), nameRow('', 'C60'),
    '#$ SIF&TEES', ...[1, 2, 3].flatMap(sifBlock),
    '#$ RESTRANT', ...Object.keys(restraintSpecs).map(Number).sort((a, b) => a - b).flatMap((pointer) => restraintBlock(restraintSpecs[pointer])),
    '#$ REDUCERS', 'UNCHANGED-REDUCERS-PAYLOAD',
    '#$ MISCEL_1', ...(hangerCount === 1 ? hangerPayload(20) : [
      numericRow([106, 106, 106, 106]),
      numericRow([0, 0, 0, 0, 0, 1]), numericRow([0, 0, 0, 0, 0, 0]), numericRow([0, 0, 0, 0, 0, 0]), numericRow([0]),
    ]),
    '#$ UNITS', 'UNITS-CUSTODY', '#$ RIGID',
  ];
  return { text: rows.join('\r\n') + '\r\n', restraintSpecs };
}
function auxiliaryEvidence(restraintPointers, restraintSpecs) {
  const parsed = parsedModel();
  const elements = {};
  restraintPointers.forEach((pointer, index) => {
    elements[String(index)] = Object.freeze({
      parsedElementIndex: index, from: String(parsed.elements[index].from), to: String(parsed.elements[index].to),
      pointers: Object.freeze({ restraint: Number(pointer) }),
    });
  });
  return Object.freeze({
    restraints: Object.freeze({ authority: 'PROTECTED_WRITER_RESTRANT_BLOCK_INDEX_24_ROWS', blockRows: 24, sectionRowCount: Object.keys(restraintSpecs).length * 24 }),
    elements: Object.freeze(elements),
  });
}
export function buildFixture({
  restraintPointers = [1, 2, 3, 0], sifPointers = [1, 2, 3, 0], nodePointers = [1, 2, 3, 0], hangerCount = 1,
} = {}) {
  const built = fixtureText({ restraintPointers, sifPointers, nodePointers, hangerCount });
  const parsed = parsedModel(); const bytes = new TextEncoder().encode(built.text); const physicalFile = createCiiPhysicalFile(bytes);
  const contentSha256 = sha256CiiByteString(physicalFile.originalByteString);
  const nodeNameEvidence = extractCiiNodeNameEvidence(physicalFile.text, parsed, { physicalFile });
  const sifWriter1CEvidence = extractCiiWriter1CSifEvidence(physicalFile.text, parsed, { physicalFile });
  const hangerEvidence = buildCiiHangerEvidence(physicalFile.text, parsed);
  const targetDocument = Object.freeze({
    contentSha256, byteLength: physicalFile.byteLength, physicalFile,
    writer1CByteEligible: physicalFile.writer1CByteEligible, parsed,
    nodeNameEvidence, nodeNames: nodeNameEvidence.names, sifWriter1CEvidence, hangerEvidence,
    auxiliaryEvidence: auxiliaryEvidence(restraintPointers, built.restraintSpecs),
  });
  return Object.freeze({ targetDocument, restraintSpecs: built.restraintSpecs, restraintPointers: Object.freeze([...restraintPointers]), parsed });
}
function restraintSlotState(pointer, spec) {
  return Object.freeze({
    pointer, slot: 1,
    line1: Object.freeze([Number(spec.node), Number(spec.type), Number(spec.stiffness), Number(spec.gap), Number(spec.friction), Number(spec.connectingNode)]),
    line2: Object.freeze(spec.cosines.map(Number)), tag: spec.tag ?? '', guid: spec.guid ?? '', occupied: true,
  });
}
export function nodeCreate() {
  return Object.freeze({
    operationId: 'CREATE-N80', family: 'NODE_NAME', property: 'Node name / to-name', action: 'CREATE',
    status: 'PREVIEW_READY', scopeDecision: 'APPLY', policyAuthority: CII_WRITER_2_NODENAME_RELOCATION_POLICY,
    evidenceAuthority: 'CII_NODENAME_FIXED_LAYOUT',
    targetEvidence: Object.freeze({ identity: '80' }), before: '', proposed: 'N80', matchAuthority: Object.freeze({ status: 'REVIEWED' }),
  });
}
export function sifDelete() {
  return Object.freeze({
    operationId: 'DELETE-SIF-E2', family: 'SIF_TEE', property: 'SIF/Tee record presence', action: 'DELETE',
    status: 'PREVIEW_READY', scopeDecision: 'APPLY', policyAuthority: CII_WRITER_2_SIF_DELETE_POLICY,
    evidenceAuthority: 'ELEMENT_POINTER_TO_SIF_TEES_RAW_RECORD',
    sourceEvidence: Object.freeze({ identity: 'SRC-E2', value: false, authority: 'ELEMENT_POINTER_TO_SIF_TEES_RAW_RECORD' }),
    targetEvidence: Object.freeze({ identity: 'E2', value: true }), before: true, proposed: false,
    matchAuthority: Object.freeze({ status: 'REVIEWED' }),
  });
}
export function hangerDelete(node = 20, action = 'DELETE') {
  return Object.freeze({
    operationId: action === 'DELETE' ? `DELETE-HANGER-${node}` : `CREATE-HANGER-${node}`,
    family: 'HANGER', property: 'Hanger presence', action, status: 'PREVIEW_READY', scopeDecision: 'APPLY',
    policyAuthority: CII_WRITER_2_HANGER_DELETE_POLICY, evidenceAuthority: 'CONTROL_NOHGRS_PLUS_MISCEL_1_IHGRNODE',
    sourceEvidence: Object.freeze({ identity: `SRC-${node}`, value: action === 'DELETE' ? false : true, authority: 'CONTROL_NOHGRS_PLUS_MISCEL_1_IHGRNODE' }),
    targetEvidence: Object.freeze({ identity: String(node), value: action === 'DELETE' }), before: action === 'DELETE', proposed: action !== 'DELETE',
    matchAuthority: Object.freeze({ status: 'REVIEWED' }),
  });
}
export function restraintDelete(pointer, targetNode, spec, { id = `DELETE-RESTRAINT-${pointer}`, action = 'DELETE', scopeDecision = 'APPLY' } = {}) {
  const mutation = Object.freeze({
    schema: 'CIIWorkspaceRestraintSlotMutation.v1', status: 'QUALIFIED', mode: action === 'DELETE' ? 'CLEAR' : 'CREATE',
    authority: action === 'DELETE' ? 'PROTECTED_WRITER_EXISTING_24_ROW_BLOCK_EMPTY_SLOT_TEMPLATE' : 'PROTECTED_WRITER_EXISTING_24_ROW_BLOCK_FREE_SLOT',
    pointer, slot: 1, targetNode: String(targetNode), beforeSlot: action === 'DELETE' ? restraintSlotState(pointer, spec) : null,
  });
  return Object.freeze({
    operationId: id, family: 'RESTRAINT', property: 'Qualified restraint slot mutation', action,
    status: 'PREVIEW_READY', policyAuthority: 'CII_WRITER_1B_EXISTING_BLOCK_FIXED_SLOT',
    matchAuthority: Object.freeze({ status: 'REVIEWED' }), sourceEvidence: Object.freeze({ value: mutation }), proposed: mutation, scopeDecision,
  });
}
export function transferPlan(targetDocument, operations, excludedOperations = []) {
  const applied = operations.filter((item) => item.scopeDecision === 'APPLY' && item.action !== 'KEEP').map((item) => item.operationId).sort();
  const excluded = excludedOperations.filter((item) => item.scopeDecision === 'EXCLUDE' && item.action !== 'KEEP').map((item) => item.operationId).sort();
  return Object.freeze({
    status: 'PREVIEW_READY', blockers: Object.freeze([]),
    sourceDocument: Object.freeze({ fileName: 'source.cii', contentSha256: SOURCE_SHA }),
    targetDocument: Object.freeze({ fileName: 'target.cii', contentSha256: targetDocument.contentSha256 }),
    operations: Object.freeze(operations), excludedOperations: Object.freeze(excludedOperations),
    transferScope: Object.freeze({
      schema: 'CIIWorkspaceTransferScope.v1', mode: 'EXPLICIT_APPLY_EXCLUDE', status: 'BOUND', authority: 'USER_EXPLICIT_OPERATION_SCOPE',
      sourceSha256: SOURCE_SHA, targetSha256: targetDocument.contentSha256, scopeId: `transfer-scope:w212:${applied.join('|')}`,
      candidateOperationIds: Object.freeze([...applied, ...excluded].sort()), appliedOperationIds: Object.freeze(applied), excludedOperationIds: Object.freeze(excluded),
      appliedOperationCount: applied.length, excludedOperationCount: excluded.length,
    }),
  });
}
export function afterDocumentFromByteString(value) {
  const input = String(value); const bytes = new Uint8Array(input.length);
  for (let index = 0; index < input.length; index += 1) bytes[index] = input.charCodeAt(index) & 0xff;
  const physicalFile = createCiiPhysicalFile(bytes);
  return Object.freeze({
    contentSha256: sha256CiiByteString(physicalFile.originalByteString), byteLength: physicalFile.byteLength,
    writer1CByteEligible: physicalFile.writer1CByteEligible, physicalFile,
  });
}
