import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { applyCiiWorkspaceTargetWriter2 } from '../tabs/cii-workspace/cii-workspace-core.js';
import { intakeCiiWorkspaceDocument } from '../tabs/cii-workspace/cii-workspace-intake.js';
import { ciiPhysicalSectionRows } from '../tabs/cii-workspace/cii-workspace-physical-file.js';
import { adaptCiiDocumentToTopologyGraph } from '../tabs/cii-workspace/cii-workspace-topology-adapter.js';
import { CII_HANGER_LAYOUTS } from '../tabs/cii-workspace/cii-workspace-hanger.js';
import { CII_WRITER_2_HANGER_DELETE_POLICY } from '../tabs/cii-workspace/cii-workspace-writer2-hanger-delete.js';
import { applyCiiWriter2CompositeWithHangerDeleteAll } from '../tabs/cii-workspace/cii-workspace-writer2-composite-hanger.js';
import { validateCiiWriter2CompositeWithHangerRoundTrip } from '../tabs/cii-workspace/cii-workspace-writer2-composite-hanger-validation.js';
import { ciiWriter2CompositeReadiness } from '../tabs/cii-workspace/cii-workspace-writer2-composite-routing.js';
import { CII_WRITER_2_NODENAME_RELOCATION_POLICY } from '../tabs/cii-workspace/cii-workspace-writer2-nodename-relocation.js';
import { CII_WRITER_2_SIF_DELETE_POLICY } from '../tabs/cii-workspace/cii-workspace-writer2-sif-delete.js';

const SOURCE_GIT_BLOB = 'e41cd05603b56837cbb6e31b9d4074ef6106fe9b';
const SOURCE_SHA = '5'.repeat(64);
const NODE = '10';
const NODE_NAME = 'BM-N10';
const NODE_ELEMENT_INDEX = 0;
const NODE_FROM = '10';
const NODE_TO = '20';
const SIF_OWNER_FROM = '70';
const SIF_OWNER_TO = '250';
const SIF_POINTER = 1;
const HANGER_NODE = '205';

function gitBlobSha1(bytes) {
  const buffer = Buffer.from(bytes);
  return createHash('sha1')
    .update(Buffer.from(`blob ${buffer.byteLength}\0`, 'utf8'))
    .update(buffer)
    .digest('hex');
}

function bytes(value) {
  const input = String(value ?? '');
  const out = new Uint8Array(input.length);
  for (let index = 0; index < input.length; index += 1) out[index] = input.charCodeAt(index) & 0xff;
  return out;
}

function connectivity(document) {
  return document.parsed.elements.map((element) => [Number(element.index), String(element.from), String(element.to)]);
}

function frozenEdge(graph, from, to) {
  const matches = (graph?.edges || []).filter((edge) => String(edge.from) === String(from) && String(edge.to) === String(to));
  assert.equal(matches.length, 1, `BM-W2-05 frozen edge ${from}->${to} must be unique`);
  return matches[0];
}

function nodeOperation() {
  return Object.freeze({
    operationId: 'BM-W2-05-NODENAME-CREATE-N10',
    family: 'NODE_NAME', property: 'Node name / to-name', action: 'CREATE', status: 'PREVIEW_READY', scopeDecision: 'APPLY',
    policyAuthority: CII_WRITER_2_NODENAME_RELOCATION_POLICY, evidenceAuthority: 'CII_NODENAME_FIXED_LAYOUT', blockers: Object.freeze([]),
    sourceEvidence: Object.freeze({ identity: 'BM-W2-05-SOURCE-N10', value: NODE_NAME, authority: 'CII_NODENAME_FIXED_LAYOUT' }),
    targetEvidence: Object.freeze({ identity: NODE, value: '' }), before: '', proposed: NODE_NAME,
    matchAuthority: Object.freeze({ status: 'REVIEWED' }),
  });
}

function sifOperation(edge) {
  return Object.freeze({
    operationId: `BM-W2-05-SIF-DELETE-${edge.elementId}`,
    family: 'SIF_TEE', property: 'SIF/Tee record presence', action: 'DELETE', status: 'PREVIEW_READY', scopeDecision: 'APPLY',
    policyAuthority: CII_WRITER_2_SIF_DELETE_POLICY, evidenceAuthority: 'ELEMENT_POINTER_TO_SIF_TEES_RAW_RECORD', blockers: Object.freeze([]),
    sourceEvidence: Object.freeze({ identity: `BM-W2-05-SOURCE-${edge.elementId}`, value: false, authority: 'ELEMENT_POINTER_TO_SIF_TEES_RAW_RECORD' }),
    targetEvidence: Object.freeze({ identity: String(edge.elementId), value: true }), before: true, proposed: false,
    matchAuthority: Object.freeze({ status: 'REVIEWED' }),
  });
}

function hangerOperation() {
  return Object.freeze({
    operationId: `BM-W2-05-HANGER-DELETE-${HANGER_NODE}`,
    family: 'HANGER', property: 'Hanger presence', action: 'DELETE', status: 'PREVIEW_READY', scopeDecision: 'APPLY',
    policyAuthority: CII_WRITER_2_HANGER_DELETE_POLICY, evidenceAuthority: 'CONTROL_NOHGRS_PLUS_MISCEL_1_IHGRNODE', blockers: Object.freeze([]),
    sourceEvidence: Object.freeze({ identity: `BM-W2-05-SOURCE-${HANGER_NODE}`, value: false, authority: 'CONTROL_NOHGRS_PLUS_MISCEL_1_IHGRNODE' }),
    targetEvidence: Object.freeze({ identity: HANGER_NODE, value: true }), before: true, proposed: false,
    matchAuthority: Object.freeze({ status: 'REVIEWED' }),
  });
}

function boundPlan(targetDocument, operations) {
  const ids = Object.freeze(operations.map((operation) => operation.operationId).sort());
  return Object.freeze({
    status: 'PREVIEW_READY', blockers: Object.freeze([]), mutationAuthority: 'WRITER_2_COMPOSITE_CARDINALITY_CONDITIONAL',
    sourceDocument: Object.freeze({ fileName: 'BM_W2_05_CONTROLLED_SOURCE', contentSha256: SOURCE_SHA }),
    targetDocument: Object.freeze({ fileName: targetDocument.fileName, contentSha256: targetDocument.contentSha256 }),
    operations: Object.freeze(operations), excludedOperations: Object.freeze([]),
    policy: Object.freeze({ mixedCardinalityMutation: 'ONE_ORIGINAL_PREIMAGE_COMPOSITE' }),
    transferScope: Object.freeze({
      schema: 'CIIWorkspaceTransferScope.v1', mode: 'EXPLICIT_APPLY_EXCLUDE', status: 'BOUND', authority: 'USER_EXPLICIT_OPERATION_SCOPE',
      scopeId: 'BM-W2-05-TRIFAMILY-ONE-PREIMAGE', sourceSha256: SOURCE_SHA, targetSha256: targetDocument.contentSha256,
      candidateOperationIds: ids, appliedOperationIds: ids, excludedOperationIds: Object.freeze([]),
      appliedOperationCount: ids.length, excludedOperationCount: 0,
    }),
  });
}

const fixture = new Uint8Array(await readFile(new URL('../Benchmark/CIICompare/BM_CII_SOURCE.CII', import.meta.url)));
assert.equal(gitBlobSha1(fixture), SOURCE_GIT_BLOB, 'BM-W2-05 frozen source Git blob drifted');

const before = await intakeCiiWorkspaceDocument(fixture, 'BM_CII_SOURCE.CII', { side: 'TARGET', cryptoRef: webcrypto });
const graph = adaptCiiDocumentToTopologyGraph(before);
assert.equal(before.writer1CByteEligible, true);
assert.equal(before.summary?.neutralVersionMajor, 11);
assert.equal(before.parsed?.elements?.length, 40);
assert.equal(before.nodeNameEvidence?.physicalCustody?.status, 'QUALIFIED');
assert.equal(before.nodeNameEvidence?.physicalCustody?.rowCount, 4);
assert.equal(String(before.nodeNames?.[NODE] || '').trim(), '');
assert.equal(before.sifWriter1CEvidence?.status, 'QUALIFIED');
assert.equal(before.sifWriter1CEvidence?.controlBlockCount, 9);
assert.equal(before.sifWriter1CEvidence?.sectionRowCount, 90);
assert.equal(before.hangerEvidence?.status, 'QUALIFIED');
assert.equal(before.hangerEvidence?.layout, CII_HANGER_LAYOUTS.SYNCHRONIZER);
assert.equal(before.hangerEvidence?.count, 1);
assert.deepEqual(before.hangerEvidence?.nodes, [HANGER_NODE]);
assert.equal(ciiPhysicalSectionRows(before.physicalFile, 'MISCEL_1').length, 23);

const nodeBinding = before.nodeNameEvidence.physicalCustody.byElementIndex?.[String(NODE_ELEMENT_INDEX)];
assert(nodeBinding, 'BM-W2-05 exact node-10 element binding required');
assert.equal(nodeBinding.bindingAuthority, 'EXACT_PARSED_INDEX_AND_ENDPOINTS');
assert.equal(String(nodeBinding.from), NODE_FROM);
assert.equal(String(nodeBinding.to), NODE_TO);
assert.equal(Number(nodeBinding.pointer), 0);

const sifEdge = frozenEdge(graph, SIF_OWNER_FROM, SIF_OWNER_TO);
const sifBinding = before.sifWriter1CEvidence?.byParsedElementIndex?.[String(sifEdge.parsedElementIndex)];
assert(sifBinding, 'BM-W2-05 exact SIF owner binding required');
assert.equal(Number(sifBinding.pointer), SIF_POINTER);
const sifOwners = before.sifWriter1CEvidence?.byPointer?.[String(SIF_POINTER)]?.owners || [];
assert.equal(sifOwners.length, 1, 'BM-W2-05 SIF pointer 1 must have exactly one owner');
assert.equal(String(sifOwners[0].from), SIF_OWNER_FROM);
assert.equal(String(sifOwners[0].to), SIF_OWNER_TO);

const operations = Object.freeze([nodeOperation(), sifOperation(sifEdge), hangerOperation()]);
const transferPlan = boundPlan(before, operations);
const readiness = ciiWriter2CompositeReadiness(transferPlan, before, graph);
assert.equal(readiness.ready, true, readiness.blockers.join('|'));
assert.equal(readiness.familyMutationCounts.nodeName, 1);
assert.equal(readiness.familyMutationCounts.sifDelete, 1);
assert.equal(readiness.familyMutationCounts.hangerDelete, 1);
assert.equal(readiness.familyMutationCounts.restraintDelete, 0);
assert.equal(readiness.components.hangerDeleteAll?.compaction?.deleteAll, true);

const lowLevel = applyCiiWriter2CompositeWithHangerDeleteAll({ targetDocument: before, targetGraph: graph, transferPlan });
assert.equal(lowLevel.status, 'APPLIED');
assert.equal(lowLevel.schema, 'CIIWorkspaceWriter2CompositeHangerResult.v1');
assert.equal(lowLevel.mode, 'ONE_ORIGINAL_PREIMAGE_COMPOSITE');
assert.equal(lowLevel.familyMutationCounts.nodeNameOperations, 1);
assert.equal(lowLevel.familyMutationCounts.sifDeleteOperations, 1);
assert.equal(lowLevel.familyMutationCounts.hangerDeleteOperations, 1);
assert.equal(lowLevel.familyMutationCounts.restraintDeleteOperations ?? 0, 0);
assert(lowLevel.mutations.some((item) => item.authorityFamily === 'WRITER_2_NODENAME' && item.kind === 'NODENAME_SECTION_PAYLOAD'));
assert(lowLevel.mutations.some((item) => item.authorityFamily === 'WRITER_2_SIF_DELETE' && item.kind === 'SIF_TEE_SECTION_PAYLOAD'));
assert(lowLevel.mutations.some((item) => item.authorityFamily === 'WRITER_2_HANGER_DELETE_ALL' && item.kind === 'MISCEL_1_HANGER_DELETE_ALL_PAYLOAD'));
for (const mutation of lowLevel.mutations.filter((item) => /POINTER|CONTROL/.test(String(item.kind)))) {
  if (String(mutation.afterField ?? '').trim()) assert.match(String(mutation.afterField).trim(), /^[+-]?\d+$/, `${mutation.kind} must remain lexical integer`);
}

const preview = Object.freeze({
  writerVersion: '2', targetDocument: before, transferPlan,
  correspondence: Object.freeze({ status: 'READY', authority: 'BM_W2_05_RETAINED_REAL_EXACT' }),
});
const applied = await applyCiiWorkspaceTargetWriter2(preview, fixture, { cryptoRef: webcrypto });
assert.equal(applied.status, 'PASS');
assert.equal(applied.writer, 'WRITER_2');
assert.equal(applied.validation?.status, 'PASS');
assert.equal(applied.validation?.unexpectedSemanticDeltaCount, 0);
assert.equal(applied.byteString, lowLevel.byteString, 'BM-W2-05 public product output must equal direct one-preimage composite output');

const after = await intakeCiiWorkspaceDocument(bytes(applied.byteString), applied.fileName, { side: 'TARGET', cryptoRef: webcrypto });
assert.equal(after.nodeNames?.[NODE], NODE_NAME);
assert.equal(after.nodeNameEvidence?.physicalCustody?.rowCount, 5);
assert.equal(after.sifWriter1CEvidence?.controlBlockCount, 8);
assert.equal(after.sifWriter1CEvidence?.sectionRowCount, 80);
assert.equal(Number(after.sifWriter1CEvidence?.byParsedElementIndex?.[String(sifEdge.parsedElementIndex)]?.pointer), 0);
assert.equal(after.hangerEvidence?.status, 'QUALIFIED');
assert.equal(after.hangerEvidence?.count, 0);
assert.equal(after.hangerEvidence?.layout, CII_HANGER_LAYOUTS.NONE);
assert.deepEqual(after.hangerEvidence?.nodes, []);
assert.equal(ciiPhysicalSectionRows(after.physicalFile, 'MISCEL_1').length, 11);
assert.equal(after.parsed?.elements?.length, 40);
assert.deepEqual(connectivity(after), connectivity(before), 'BM-W2-05 must preserve element topology');
assert.equal(validateCiiWriter2CompositeWithHangerRoundTrip(before, after, graph, transferPlan, lowLevel).status, 'PASS');

await assert.rejects(
  () => applyCiiWorkspaceTargetWriter2(preview, bytes(applied.byteString), { cryptoRef: webcrypto }),
  /CII_WRITER_2_STALE_TARGET_HASH/,
  'replaying BM-W2-05 against its postimage must fail stale-target custody',
);

const headerToken = 'Data generated by CAESAR II/CADWorx/PIPE interface';
const tamperIndex = lowLevel.byteString.indexOf(headerToken);
assert(tamperIndex >= 0, 'BM-W2-05 unrelated-byte falsifier header token required');
const tamperedString = `${lowLevel.byteString.slice(0, tamperIndex)}X${lowLevel.byteString.slice(tamperIndex + 1)}`;
const tampered = await intakeCiiWorkspaceDocument(bytes(tamperedString), 'BM_W2_05_TAMPERED.CII', { side: 'TARGET', cryptoRef: webcrypto });
assert.throws(
  () => validateCiiWriter2CompositeWithHangerRoundTrip(before, tampered, graph, transferPlan, lowLevel),
  /EXACT_TRI_FAMILY_POSTIMAGE_MISMATCH/,
  'one unrelated byte outside BM-W2-05 authority must fail complete-postimage validation',
);

console.log('BM-W2-05 retained-real tri-family one-preimage composite passed.');
