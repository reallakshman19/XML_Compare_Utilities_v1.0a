import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { intakeCiiWorkspaceDocument } from '../tabs/cii-workspace/cii-workspace-intake.js';
import { adaptCiiDocumentToTopologyGraph } from '../tabs/cii-workspace/cii-workspace-topology-adapter.js';
import { applyCiiWorkspaceTargetWriter2 } from '../tabs/cii-workspace/cii-workspace-core.js';
import { ciiWriter2CompositeReadiness } from '../tabs/cii-workspace/cii-workspace-writer2-composite-routing.js';
import { CII_WRITER_2_NODENAME_RELOCATION_POLICY } from '../tabs/cii-workspace/cii-workspace-writer2-nodename-relocation.js';
import { CII_WRITER_2_SIF_DELETE_POLICY } from '../tabs/cii-workspace/cii-workspace-writer2-sif-delete.js';
import { CII_WRITER_2_HANGER_DELETE_POLICY } from '../tabs/cii-workspace/cii-workspace-writer2-hanger-delete.js';

const WIDTHS = [15, 13, 13, 13, 13, 13];
const SOURCE_SHA = '2'.repeat(64);
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
    { from: 10, to: 200, sif: 1, name: 1 }, { from: 200, to: 210, sif: 2, name: 2 },
    { from: 210, to: 220, sif: 3, name: 3 }, { from: 220, to: 80, sif: 0, name: 0 },
  ];
  return [
    '#$ VERSION', numericRow([5, 11, 1256, 0, 0, 0]),
    '#$ CONTROL', numericRow([4, 0, 3, 3, 0, 0]), numericRow([0, 0, 0, 0, 0, 0]),
    numericRow([0, 0, 0, 0, 3, 0]), numericRow([0, 0, 0, 0, 0, 0]),
    '#$ ELEMENTS', ...elements.flatMap((item) => elementBlock(item.from, item.to, item.sif, item.name)),
    '#$ NODENAME', nameRow('A10', 'A200'), nameRow('', 'D210'), nameRow('', 'C220'),
    '#$ SIF&TEES', ...[1, 2, 3].flatMap(sifBlock),
    '#$ REDUCERS', 'UNCHANGED-REDUCERS-PAYLOAD',
    '#$ MISCEL_1', ...hangerPayload(),
    '#$ UNITS', 'UNITS-CUSTODY', '#$ RIGID',
  ].join('\r\n') + '\r\n';
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
function transferPlan(before) {
  const operations = Object.freeze([nodeCreate(), sifDelete(), hangerDelete()]);
  const appliedOperationIds = Object.freeze(operations.map((item) => item.operationId).sort());
  return Object.freeze({
    status: 'PREVIEW_READY', blockers: Object.freeze([]),
    sourceDocument: Object.freeze({ fileName: 'source.cii', contentSha256: SOURCE_SHA }),
    targetDocument: Object.freeze({ fileName: before.fileName, contentSha256: before.contentSha256 }),
    operations, excludedOperations: Object.freeze([]),
    transferScope: Object.freeze({
      schema: 'CIIWorkspaceTransferScope.v1', mode: 'EXPLICIT_APPLY_EXCLUDE', status: 'BOUND', authority: 'USER_EXPLICIT_OPERATION_SCOPE',
      sourceSha256: SOURCE_SHA, targetSha256: before.contentSha256, scopeId: 'writer2-product-partial-trifamily',
      candidateOperationIds: appliedOperationIds, appliedOperationIds, excludedOperationIds: Object.freeze([]),
    }),
  });
}

const bytes = new TextEncoder().encode(fixtureText());
const before = await intakeCiiWorkspaceDocument(bytes, 'writer2-product-partial-trifamily.cii', { side: 'TARGET', cryptoRef: webcrypto });
assert.equal(before.nodeNameEvidence.physicalCustody.status, 'QUALIFIED');
assert.equal(before.sifWriter1CEvidence.status, 'QUALIFIED');
assert.equal(before.hangerEvidence.status, 'QUALIFIED');
assert.equal(before.hangerEvidence.count, 3);
assert.deepEqual(before.hangerEvidence.nodes, ['200', '210', '220']);
const targetGraph = adaptCiiDocumentToTopologyGraph(before);
const plan = transferPlan(before);
const readiness = ciiWriter2CompositeReadiness(plan, before, targetGraph);
assert.equal(readiness.ready, true, readiness.blockers.join('|'));
assert.equal(readiness.hangerTransactionClass, 'PARTIAL_H_GT_1');
assert.deepEqual(readiness.familyMutationCounts, { nodeName: 1, sifDelete: 1, hangerDelete: 1 });
assert.equal(readiness.components.hangerDeleteAll, null);
assert.equal(readiness.components.hangerPartialDelete.countAfter, 2);

const preview = Object.freeze({ writerVersion: '2', targetDocument: before, transferPlan: plan, correspondence: Object.freeze({}) });
const applied = await applyCiiWorkspaceTargetWriter2(preview, bytes, { cryptoRef: webcrypto });
assert.equal(applied.status, 'PASS');
assert.equal(applied.writer, 'WRITER_2');
assert.equal(applied.validation.status, 'PASS');
assert.equal(applied.validation.schema, 'CIIWorkspaceWriter2CompositePartialHangerValidation.v1');
assert.equal(applied.validation.productValidatorClass, 'PARTIAL_H_GT_1');
assert.equal(applied.validation.nodeNameOperations, 1);
assert.equal(applied.validation.sifDeleteOperations, 1);
assert.equal(applied.validation.hangerPartialDeleteOperations, 1);

const after = await intakeCiiWorkspaceDocument(new TextEncoder().encode(applied.byteString), applied.fileName, { side: 'TARGET', cryptoRef: webcrypto });
assert.equal(after.nodeNames['80'], 'N80');
assert.equal(after.sifWriter1CEvidence.controlBlockCount, 2);
assert.equal(after.hangerEvidence.count, 2);
assert.deepEqual(after.hangerEvidence.nodes, ['200', '220']);

console.log('Writer2 product route qualifies NODENAME CREATE + SIF DELETE + H=3->2 partial HANGER from one TARGET0.');
