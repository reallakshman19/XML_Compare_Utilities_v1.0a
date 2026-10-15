import assert from 'node:assert/strict';
import { createCiiPhysicalFile, ciiPhysicalSectionRows } from '../tabs/cii-workspace/cii-workspace-physical-file.js';
import { extractCiiNodeNameEvidence } from '../tabs/cii-workspace/cii-workspace-nodename.js';
import { extractCiiWriter1CSifEvidence } from '../tabs/cii-workspace/cii-workspace-writer1c-sif-custody.js';
import { buildCiiHangerEvidence, CII_HANGER_LAYOUTS } from '../tabs/cii-workspace/cii-workspace-hanger.js';
import { CII_WRITER_2_NODENAME_RELOCATION_POLICY } from '../tabs/cii-workspace/cii-workspace-writer2-nodename-relocation.js';
import { CII_WRITER_2_SIF_DELETE_POLICY } from '../tabs/cii-workspace/cii-workspace-writer2-sif-delete.js';
import { CII_WRITER_2_HANGER_DELETE_POLICY } from '../tabs/cii-workspace/cii-workspace-writer2-hanger-delete.js';
import { sha256CiiByteString } from '../tabs/cii-workspace/cii-workspace-byte-sha256.js';
import { applyCiiWriter2CompositeWithHangerDeleteAll } from '../tabs/cii-workspace/cii-workspace-writer2-composite-hanger.js';
import { validateCiiWriter2CompositeWithPartialHangerRoundTrip } from '../tabs/cii-workspace/cii-workspace-writer2-composite-hanger-partial-validation.js';

const WIDTHS = [15, 13, 13, 13, 13, 13];
const SOURCE_SHA = 'SOURCE-SHA-PARTIAL-TRI';
function numericRow(values) { return values.map((value, index) => String(value ?? 0).padStart(WIDTHS[index], ' ')).join(''); }
function packed(values) { return `  ${values.map((value) => String(value).padStart(13, ' ')).join('')}`; }
function nameRow(fromName = '', toName = '') { return `  ${String(fromName).padEnd(26, ' ')}${String(toName).padEnd(25, ' ')}`; }
function stringCard(value) {
  const text = String(value || '');
  return `${' '.repeat(7)}${String(text.length).padStart(5, ' ')} ${text}`;
}
function elementBlock(from, to, sifPointer, nodePointer) {
  const rows = Array.from({ length: 15 }, () => numericRow([0, 0, 0, 0, 0, 0]));
  rows[0] = numericRow([from, to, 0, 0, 0, 100]);
  rows[13] = numericRow([0, 0, 0, 0, sifPointer, nodePointer]);
  return rows;
}
function sifBlock(pointer) {
  return Array.from({ length: 10 }, (_, row) => {
    const seed = pointer * 100 + row * 10;
    return numericRow([seed + 1, seed + 2, seed + 3, seed + 4, seed + 5, seed + 6]);
  });
}
function hangerPayload(nodes = [200, 210, 220]) {
  const tail = nodes.flatMap((node, zero) => [
    numericRow([101 + zero, 25, 0, 0, 0, 0]), numericRow([0, 9999, zero + 1, 0, 0]),
    stringCard(`H${node}`), stringCard(''),
  ]);
  const free = nodes.map((node, zero) => packed([node, 0, zero + 1, 0]));
  return [
    numericRow([106, 106, 106, 106]),
    numericRow([1, 25, 0, 9999, 1, 1]), packed([1, 0, 1, 1, 1]),
    packed(nodes), ...tail, ...free,
    packed([10, 11, 12]), packed([20, 21, 22]), packed([30, 31, 32]), packed([40, 41, 42]),
    numericRow([0, 0, 0, 2, 0, 1]), numericRow([0, 0, 21, 21, 0, 0]),
    numericRow([0, 0, 0, 0, 0, 3]), numericRow([3]),
  ];
}
function fixtureText() {
  const elements = [
    { from: 10, to: 20, sif: 1, name: 1 }, { from: 30, to: 40, sif: 2, name: 2 },
    { from: 50, to: 60, sif: 3, name: 3 }, { from: 70, to: 80, sif: 0, name: 0 },
  ];
  return [
    '#$ VERSION', numericRow([5, 11, 1256, 0, 0, 0]),
    '#$ CONTROL', numericRow([4, 0, 3, 3, 0, 0]), numericRow([0, 0, 0, 0, 0, 0]),
    numericRow([0, 0, 0, 0, 3, 0]), numericRow([0, 0, 0, 0, 0, 0]),
    '#$ ELEMENTS', ...elements.flatMap((item) => elementBlock(item.from, item.to, item.sif, item.name)),
    '#$ NODENAME', nameRow('A10', 'A20'), nameRow('', 'D40'), nameRow('', 'C60'),
    '#$ SIF&TEES', ...[1, 2, 3].flatMap(sifBlock),
    '#$ REDUCERS', 'UNCHANGED-REDUCERS-PAYLOAD',
    '#$ MISCEL_1', ...hangerPayload(),
    '#$ UNITS', 'UNITS-CUSTODY', '#$ RIGID',
  ].join('\r\n') + '\r\n';
}
function parsedModel() {
  const elements = [
    { index: 0, from: 10, to: 20 }, { index: 1, from: 30, to: 40 },
    { index: 2, from: 50, to: 60 }, { index: 3, from: 70, to: 80 },
  ];
  const allNodes = new Set([...elements.flatMap((item) => [item.from, item.to]), 200, 210, 220]);
  return Object.freeze({
    nodes: Object.freeze(Object.fromEntries([...allNodes].map((id) => [String(id), Object.freeze({})]))),
    elements: Object.freeze(elements.map((item) => Object.freeze(item))),
  });
}
function targetGraph() {
  return Object.freeze({ edges: Object.freeze(parsedModel().elements.map((item) => Object.freeze({
    elementId: `E${item.index + 1}`, parsedElementIndex: item.index, from: String(item.from), to: String(item.to),
  }))) });
}
function documentFrom(byteString, parsed = parsedModel()) {
  const bytes = new Uint8Array(byteString.length);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = byteString.charCodeAt(index) & 0xff;
  const physicalFile = createCiiPhysicalFile(bytes);
  const nodeNameEvidence = extractCiiNodeNameEvidence(physicalFile.text, parsed, { physicalFile });
  const sifWriter1CEvidence = extractCiiWriter1CSifEvidence(physicalFile.text, parsed, { physicalFile });
  const hangerEvidence = buildCiiHangerEvidence(physicalFile.text, parsed);
  return Object.freeze({
    contentSha256: sha256CiiByteString(byteString), physicalFile, writer1CByteEligible: physicalFile.writer1CByteEligible, parsed,
    nodeNameEvidence, nodeNames: nodeNameEvidence.names, sifWriter1CEvidence, hangerEvidence,
  });
}
function nodeCreate() {
  return Object.freeze({
    operationId: 'CREATE-N80', family: 'NODE_NAME', property: 'Node name / to-name', action: 'CREATE',
    status: 'PREVIEW_READY', scopeDecision: 'APPLY', policyAuthority: CII_WRITER_2_NODENAME_RELOCATION_POLICY,
    targetEvidence: Object.freeze({ identity: '80' }), before: '', proposed: 'N80', matchAuthority: Object.freeze({ status: 'REVIEWED' }),
  });
}
function sifDelete() {
  return Object.freeze({
    operationId: 'DELETE-SIF-E2', family: 'SIF_TEE', property: 'SIF/Tee record presence', action: 'DELETE',
    status: 'PREVIEW_READY', scopeDecision: 'APPLY', policyAuthority: CII_WRITER_2_SIF_DELETE_POLICY,
    evidenceAuthority: 'ELEMENT_POINTER_TO_SIF_TEES_RAW_RECORD',
    sourceEvidence: Object.freeze({ identity: 'SRC-E2', value: false, authority: 'ELEMENT_POINTER_TO_SIF_TEES_RAW_RECORD' }),
    targetEvidence: Object.freeze({ identity: 'E2', value: true }), before: true, proposed: false,
    matchAuthority: Object.freeze({ status: 'REVIEWED' }),
  });
}
function hangerDelete() {
  return Object.freeze({
    operationId: 'DELETE-HANGER-210', family: 'HANGER', property: 'Hanger presence', action: 'DELETE',
    status: 'PREVIEW_READY', scopeDecision: 'APPLY', policyAuthority: CII_WRITER_2_HANGER_DELETE_POLICY,
    evidenceAuthority: 'CONTROL_NOHGRS_PLUS_MISCEL_1_IHGRNODE',
    sourceEvidence: Object.freeze({ identity: 'SRC-210', value: false, authority: 'CONTROL_NOHGRS_PLUS_MISCEL_1_IHGRNODE' }),
    targetEvidence: Object.freeze({ identity: '210', value: true }), before: true, proposed: false,
    matchAuthority: Object.freeze({ status: 'REVIEWED' }),
  });
}
function transferPlan(before, operations = [nodeCreate(), sifDelete(), hangerDelete()]) {
  const appliedIds = operations.map((item) => item.operationId).sort();
  return Object.freeze({
    status: 'PREVIEW_READY', blockers: Object.freeze([]),
    sourceDocument: Object.freeze({ fileName: 'source.cii', contentSha256: SOURCE_SHA }),
    targetDocument: Object.freeze({ fileName: 'target.cii', contentSha256: before.contentSha256 }),
    operations: Object.freeze(operations), excludedOperations: Object.freeze([]),
    transferScope: Object.freeze({
      schema: 'CIIWorkspaceTransferScope.v1', mode: 'EXPLICIT_APPLY_EXCLUDE', status: 'BOUND', authority: 'USER_EXPLICIT_OPERATION_SCOPE',
      sourceSha256: SOURCE_SHA, targetSha256: before.contentSha256, scopeId: `transfer-scope:partial-tri:${appliedIds.join('|')}`,
      candidateOperationIds: Object.freeze(appliedIds), appliedOperationIds: Object.freeze(appliedIds), excludedOperationIds: Object.freeze([]),
    }),
  });
}

const before = documentFrom(fixtureText());
assert.equal(before.nodeNameEvidence.physicalCustody.status, 'QUALIFIED');
assert.equal(before.sifWriter1CEvidence.status, 'QUALIFIED');
assert.equal(before.hangerEvidence.status, 'QUALIFIED');
assert.equal(before.hangerEvidence.layout, CII_HANGER_LAYOUTS.SYNCHRONIZER);
assert.deepEqual(before.hangerEvidence.nodes, ['200', '210', '220']);
const graph = targetGraph(); const plan = transferPlan(before);
const writer = applyCiiWriter2CompositeWithHangerDeleteAll({ targetDocument: before, targetGraph: graph, transferPlan: plan });
assert.equal(writer.status, 'APPLIED');
assert.equal(writer.familyMutationCounts.nodeNameOperations, 1);
assert.equal(writer.familyMutationCounts.sifDeleteOperations, 1);
assert.equal(writer.familyMutationCounts.hangerDeleteOperations, 1);
assert.equal(writer.familyMutationCounts.hangerDeleteAllOperations, 0);
assert.equal(writer.familyMutationCounts.hangerPartialDeleteOperations, 1);
assert.equal(writer.components.hangerDeleteAll, null);
assert.ok(writer.components.hangerPartialDelete);
assert.deepEqual(writer.components.hangerPartialDelete.scopeCustody.appliedOperationIds, ['DELETE-HANGER-210']);
assert.deepEqual(writer.components.hangerPartialDelete.scopeCustody.excludedOperationIds.sort(), ['CREATE-N80', 'DELETE-SIF-E2']);
assert(writer.mutations.some((item) => item.authorityFamily === 'WRITER_2_NODENAME' && item.kind === 'NODENAME_SECTION_PAYLOAD'));
assert(writer.mutations.some((item) => item.authorityFamily === 'WRITER_2_SIF_DELETE' && item.kind === 'SIF_TEE_SECTION_PAYLOAD'));
assert(writer.mutations.some((item) => item.authorityFamily === 'WRITER_2_HANGER_PARTIAL_DELETE' && item.kind === 'MISCEL_1_HANGER_PARTIAL_COMPACT_PAYLOAD'));

const after = documentFrom(writer.byteString);
assert.equal(after.nodeNames['80'], 'N80');
assert.equal(after.sifWriter1CEvidence.controlBlockCount, 2);
assert.equal(after.hangerEvidence.count, 2);
assert.equal(after.hangerEvidence.layout, CII_HANGER_LAYOUTS.SYNCHRONIZER);
assert.deepEqual(after.hangerEvidence.nodes, ['200', '220']);
assert.equal(ciiPhysicalSectionRows(after.physicalFile, 'MISCEL_1').length, 22);
const validation = validateCiiWriter2CompositeWithPartialHangerRoundTrip(before, after, graph, plan, writer);
assert.equal(validation.status, 'PASS');
assert.equal(validation.nodeNameOperations, 1);
assert.equal(validation.sifDeleteOperations, 1);
assert.equal(validation.hangerPartialDeleteOperations, 1);

// Full-postimage authority catches unrelated byte drift after all three variable-length claims are combined.
const tampered = documentFrom(writer.byteString.replace('UNCHANGED-REDUCERS-PAYLOAD', 'XNCHANGED-REDUCERS-PAYLOAD'));
assert.throws(
  () => validateCiiWriter2CompositeWithPartialHangerRoundTrip(before, tampered, graph, plan, writer),
  /EXACT_PARTIAL_HANGER_COMPOSITE_POSTIMAGE_MISMATCH/,
);

// Parent scope remains authority: deleting a sibling ID from the parent scope cannot be repaired by a valid HANGER child scope.
const staleScope = Object.freeze({
  ...plan,
  transferScope: Object.freeze({ ...plan.transferScope, appliedOperationIds: Object.freeze(['CREATE-N80', 'DELETE-HANGER-210']) }),
});
assert.throws(
  () => validateCiiWriter2CompositeWithPartialHangerRoundTrip(before, after, graph, staleScope, writer),
  /PARENT_SCOPE:.*SCOPE_APPLY_SET_MISMATCH/,
);

// Correct final bytes do not excuse forged composite parent-scope testimony.
const forgedParentCustody = Object.freeze({
  ...writer,
  parentScopeCustody: Object.freeze({ ...writer.parentScopeCustody, targetSha256: 'forged-parent-target' }),
});
assert.throws(
  () => validateCiiWriter2CompositeWithPartialHangerRoundTrip(before, after, graph, plan, forgedParentCustody),
  /PARENT_SCOPE_TESTIMONY_MISMATCH/,
);

// Correct composite bytes do not excuse forged partial-component TARGET0 hash testimony.
const forgedTarget0 = Object.freeze({
  ...writer,
  components: Object.freeze({
    ...writer.components,
    hangerPartialDelete: Object.freeze({
      ...writer.components.hangerPartialDelete,
      target0HashCustody: Object.freeze({ ...writer.components.hangerPartialDelete.target0HashCustody, contentSha256: '0'.repeat(64) }),
    }),
  }),
});
assert.throws(
  () => validateCiiWriter2CompositeWithPartialHangerRoundTrip(before, after, graph, plan, forgedTarget0),
  /HANGER_PARTIAL_COMPONENT_TARGET0_HASH_TESTIMONY_MISMATCH/,
);

console.log('Writer2 NODENAME + SIF DELETE + partial HANGER one-TARGET0 composite qualification authored.');
