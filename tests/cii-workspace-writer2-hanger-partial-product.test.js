import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { intakeCiiWorkspaceDocument } from '../tabs/cii-workspace/cii-workspace-intake.js';
import { adaptCiiDocumentToTopologyGraph } from '../tabs/cii-workspace/cii-workspace-topology-adapter.js';
import { applyCiiWorkspaceTargetWriter2 } from '../tabs/cii-workspace/cii-workspace-core.js';
import {
  applyCiiWriter2CompositePlanContract,
  ciiWriter2CompositeReadiness,
} from '../tabs/cii-workspace/cii-workspace-writer2-composite-routing.js';
import { applyCiiWriter2CompositeWithHangerDeleteAll } from '../tabs/cii-workspace/cii-workspace-writer2-composite-hanger.js';
import { validateCiiWriter2ProductRoundTrip } from '../tabs/cii-workspace/cii-workspace-writer2-product-validation.js';

const WIDTHS = [15, 13, 13, 13, 13, 13];
const SOURCE_SHA = '1'.repeat(64);
function numericRow(values) { return values.map((value, index) => String(value ?? 0).padStart(WIDTHS[index], ' ')).join(''); }
function packed(values) { return `  ${values.map((value) => String(value).padStart(13, ' ')).join('')}`; }
function stringCard(value) {
  const token = String(value || '');
  return `${' '.repeat(7)}${String(token.length).padStart(5, ' ')} ${token}`;
}
function elementBlock(from, to) {
  const rows = Array.from({ length: 15 }, () => numericRow([0, 0, 0, 0, 0, 0]));
  rows[0] = numericRow([from, to, 0, 0, 0, 100]);
  return rows;
}
function executionRows() {
  return [
    numericRow([0, 0, 0, 2, 0, 1]),
    numericRow([0, 0, 21, 21, 0, 0]),
    numericRow([0, 0, 0, 0, 0, 3]),
    numericRow([3]),
  ];
}
function fixtureText() {
  const nodes = [200, 210, 220];
  const tail = nodes.flatMap((node, zero) => [
    numericRow([101 + zero, 25, 0, 0, 0, 0]),
    numericRow([0, 9999, zero + 1, 0, 0]),
    stringCard(`H${node}`),
    stringCard(''),
  ]);
  const free = nodes.map((node, zero) => packed([node, 0, zero + 1, 0]));
  return [
    '#$ VERSION', numericRow([5, 11, 1256, 0, 0, 0]),
    '#$ CONTROL', numericRow([3, 0, 3, 0, 0, 0]), numericRow([0, 0, 0, 0, 0, 0]),
    numericRow([0, 0, 0, 0, 0, 0]), numericRow([0, 0, 0, 0, 0, 0]),
    '#$ ELEMENTS', ...elementBlock(1000, 200), ...elementBlock(200, 210), ...elementBlock(210, 220),
    '#$ NODENAME',
    '#$ SIF&TEES',
    '#$ MISCEL_1', numericRow([106, 106, 106]),
    numericRow([1, 25, 0, 9999, 1, 1]), packed([1, 0, 1, 1, 1]),
    packed(nodes), ...tail, ...free,
    packed([10, 11, 12]), packed([20, 21, 22]), packed([30, 31, 32]), packed([40, 41, 42]),
    ...executionRows(),
    '#$ UNITS', 'UNITS-CUSTODY', '#$ RIGID',
  ].join('\r\n') + '\r\n';
}
function fixtureBytes() { return new TextEncoder().encode(fixtureText()); }
function hangerDelete() {
  return Object.freeze({
    operationId: 'HANGER-DELETE-210', family: 'HANGER', property: 'Hanger presence', action: 'DELETE', status: 'BLOCKED',
    blockers: Object.freeze(['HANGER_CARDINALITY_REQUIRES_WRITER_2_QUALIFICATION']),
    evidenceAuthority: 'CONTROL_NOHGRS_PLUS_MISCEL_1_IHGRNODE',
    sourceEvidence: Object.freeze({ identity: 'SRC-210', value: false, authority: 'CONTROL_NOHGRS_PLUS_MISCEL_1_IHGRNODE' }),
    targetEvidence: Object.freeze({ identity: '210', value: true }), before: true, proposed: false,
    matchAuthority: Object.freeze({ status: 'REVIEWED' }),
  });
}
function rawPlan(targetSha) {
  return Object.freeze({
    status: 'BLOCKED', blockers: Object.freeze(['NO_TRANSFERABLE_PREVIEW_OPERATIONS']), mutationAuthority: 'WRITER_1B_CONDITIONAL',
    sourceDocument: Object.freeze({ contentSha256: SOURCE_SHA }), targetDocument: Object.freeze({ contentSha256: targetSha }),
    operations: Object.freeze([hangerDelete()]),
    policy: Object.freeze({ hangerMutation: 'BLOCKED' }),
  });
}
function bind(contracted) {
  const operations = Object.freeze(contracted.operations.map((operation) => Object.freeze({ ...operation, scopeDecision: 'APPLY' })));
  const ids = Object.freeze(operations.filter((item) => item.action !== 'KEEP').map((item) => item.operationId).sort());
  return Object.freeze({
    ...contracted, status: 'PREVIEW_READY', blockers: Object.freeze([]), operations, excludedOperations: Object.freeze([]),
    transferScope: Object.freeze({
      status: 'BOUND', mode: 'EXPLICIT_APPLY_EXCLUDE', authority: 'USER_EXPLICIT_OPERATION_SCOPE', scopeId: 'writer2-product-h3-partial',
      sourceSha256: contracted.sourceDocument.contentSha256, targetSha256: contracted.targetDocument.contentSha256,
      candidateOperationIds: ids, appliedOperationIds: ids, excludedOperationIds: Object.freeze([]),
    }),
  });
}

const bytes = fixtureBytes();
const before = await intakeCiiWorkspaceDocument(bytes, 'writer2-product-h3-partial.cii', { side: 'TARGET', cryptoRef: webcrypto });
assert.equal(before.hangerEvidence.status, 'QUALIFIED');
assert.equal(before.hangerEvidence.count, 3);
assert.deepEqual(before.hangerEvidence.nodes, ['200', '210', '220']);
const targetGraph = adaptCiiDocumentToTopologyGraph(before);
const routed = applyCiiWriter2CompositePlanContract(rawPlan(before.contentSha256));
assert.equal(routed.status, 'PREVIEW_READY');
assert.equal(routed.policy.hangerMutation, 'EXISTING_HANGER_DELETE_ALL_OR_QUALIFIED_PARTIAL');
assert.equal(routed.policy.hangerPartialMultiDelete, 'QUALIFIED_POSITIONAL_RECORD_COMPACTION_ONLY');
const transferPlan = bind(routed);
const readiness = ciiWriter2CompositeReadiness(transferPlan, before, targetGraph);
assert.equal(readiness.ready, true, readiness.blockers.join('|'));
assert.equal(readiness.hangerTransactionClass, 'PARTIAL_H_GT_1');
assert.equal(readiness.components.hangerDeleteAll, null);
assert.equal(readiness.components.hangerPartialDelete.countBefore, 3);
assert.equal(readiness.components.hangerPartialDelete.countAfter, 2);
assert.equal(readiness.components.hangerPartialDelete.compaction.plannerPartialRecordAuthority, true);
assert.equal(readiness.components.hangerPartialDelete.physicalCustody.recordBinding.status, 'QUALIFIED');
assert.equal(readiness.components.hangerPartialDelete.physicalCustody.recordBinding.semanticAuthority, 'NONE_POSITIONAL_PHYSICAL_CUSTODY_ONLY');

const preview = Object.freeze({ writerVersion: '2', targetDocument: before, transferPlan, correspondence: Object.freeze({}) });
const applied = await applyCiiWorkspaceTargetWriter2(preview, bytes, { cryptoRef: webcrypto });
assert.equal(applied.status, 'PASS');
assert.equal(applied.writer, 'WRITER_2');
assert.equal(applied.validation.status, 'PASS');
assert.equal(applied.validation.schema, 'CIIWorkspaceWriter2CompositePartialHangerValidation.v1');
assert.equal(applied.validation.productValidatorClass, 'PARTIAL_H_GT_1');
assert.equal(applied.validation.hangerPartialDeleteOperations, 1);
const after = await intakeCiiWorkspaceDocument(new TextEncoder().encode(applied.byteString), applied.fileName, { side: 'TARGET', cryptoRef: webcrypto });
assert.equal(after.hangerEvidence.count, 2);
assert.deepEqual(after.hangerEvidence.nodes, ['200', '220']);

await assert.rejects(
  () => applyCiiWorkspaceTargetWriter2(preview, new TextEncoder().encode(fixtureText().replace('UNITS-CUSTODY', 'XNITS-CUSTODY')), { cryptoRef: webcrypto }),
  /CII_WRITER_2_STALE_TARGET_HASH/,
);

const writerResult = applyCiiWriter2CompositeWithHangerDeleteAll({ targetDocument: before, targetGraph, transferPlan });
const modified = await intakeCiiWorkspaceDocument(writerResult.bytes, 'writer2-product-h3-partial.cii', { side: 'TARGET', cryptoRef: webcrypto });
assert.equal(validateCiiWriter2ProductRoundTrip(before, modified, targetGraph, transferPlan, writerResult).productValidatorClass, 'PARTIAL_H_GT_1');

const missingComponent = Object.freeze({
  ...writerResult,
  components: Object.freeze({ ...writerResult.components, hangerPartialDelete: null }),
});
assert.throws(
  () => validateCiiWriter2ProductRoundTrip(before, modified, targetGraph, transferPlan, missingComponent),
  /HANGER_PARTIAL_COMPONENT_TESTIMONY_MISMATCH/,
);

const ambiguous = Object.freeze({
  ...writerResult,
  familyMutationCounts: Object.freeze({ ...writerResult.familyMutationCounts, hangerDeleteAllOperations: 1 }),
  components: Object.freeze({ ...writerResult.components, hangerDeleteAll: writerResult.components.hangerPartialDelete }),
});
assert.throws(
  () => validateCiiWriter2ProductRoundTrip(before, modified, targetGraph, transferPlan, ambiguous),
  /HANGER_COMPONENT_CLASS_AMBIGUOUS/,
);

console.log('Writer2 product/core routing admits qualified H=3->2 partial HANGER with fail-closed independent validator dispatch.');
