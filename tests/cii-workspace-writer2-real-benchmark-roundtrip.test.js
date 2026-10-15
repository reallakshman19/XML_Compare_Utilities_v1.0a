import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { intakeCiiWorkspaceDocument } from '../tabs/cii-workspace/cii-workspace-intake.js';
import { adaptCiiDocumentToTopologyGraph } from '../tabs/cii-workspace/cii-workspace-topology-adapter.js';
import { applyCiiWorkspaceTargetWriter2 } from '../tabs/cii-workspace/cii-workspace-core.js';
import { applyCiiWriter2Composite } from '../tabs/cii-workspace/cii-workspace-writer2-composite.js';
import { validateCiiWriter2CompositeRoundTrip } from '../tabs/cii-workspace/cii-workspace-writer2-composite-validation.js';
import { CII_WRITER_2_NODENAME_RELOCATION_POLICY } from '../tabs/cii-workspace/cii-workspace-writer2-nodename-relocation.js';
import { CII_WRITER_2_SIF_DELETE_POLICY } from '../tabs/cii-workspace/cii-workspace-writer2-sif-delete.js';

const SOURCE_SHA = '1111111111111111111111111111111111111111111111111111111111111111';
const FIXTURE_BYTES = 64462;
const FIXTURE_ELEMENTS = 40;
const FIXTURE_NODENAME_ROWS = 2;
const FIXTURE_SIF_BLOCKS = 9;

function byteStringToBytes(value) {
  const raw = String(value ?? ''); const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index) & 0xff;
  return bytes;
}
function sortedIds(operations) {
  return operations.map((operation) => String(operation.operationId)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}
function edgeByParsedIndex(graph) {
  return new Map((graph?.edges || []).map((edge) => [Number(edge.parsedElementIndex), edge]));
}
function chooseSifPointer(document, graph) {
  const edges = edgeByParsedIndex(graph);
  for (const [pointerText, record] of Object.entries(document?.sifWriter1CEvidence?.byPointer || {})
    .sort(([a], [b]) => Number(a) - Number(b))) {
    const owners = [...(record?.owners || [])].sort((a, b) => Number(a.parsedElementIndex) - Number(b.parsedElementIndex));
    if (owners.length && owners.every((owner) => edges.has(Number(owner.parsedElementIndex)))) {
      return Object.freeze({ pointer: Number(pointerText), owners: Object.freeze(owners), edges });
    }
  }
  throw new Error('REAL_BENCHMARK_SIF_POINTER_WITH_EXACT_OWNER_REQUIRED');
}
function chooseNodeCreate(document) {
  const custody = document?.nodeNameEvidence?.physicalCustody;
  const physicallyNamed = new Set();
  for (const span of Object.values(custody?.bySpan || {})) {
    for (const owner of span?.owners || []) physicallyNamed.add(String(owner.nodeId));
  }
  const bindings = Object.values(custody?.byElementIndex || {})
    .filter((binding) => binding?.bindingAuthority === 'EXACT_PARSED_INDEX_AND_ENDPOINTS' && Number(binding.pointer) === 0)
    .sort((a, b) => Number(a.parsedElementIndex) - Number(b.parsedElementIndex));
  for (const binding of bindings) {
    for (const end of ['FROM', 'TO']) {
      const nodeId = String(end === 'FROM' ? binding.from : binding.to);
      if (!nodeId || physicallyNamed.has(nodeId) || String(document?.nodeNames?.[nodeId] || '').trim()) continue;
      return Object.freeze({ nodeId, parsedElementIndex: Number(binding.parsedElementIndex), end });
    }
  }
  throw new Error('REAL_BENCHMARK_ZERO_POINTER_NODENAME_ENDPOINT_REQUIRED');
}
function nodeCreateOperation(candidate) {
  return Object.freeze({
    operationId: `QF-NODENAME-CREATE-${candidate.nodeId}`,
    family: 'NODE_NAME', property: 'Node name / to-name', action: 'CREATE', status: 'PREVIEW_READY', scopeDecision: 'APPLY',
    policyAuthority: CII_WRITER_2_NODENAME_RELOCATION_POLICY, evidenceAuthority: 'CII_NODENAME_FIXED_LAYOUT', blockers: Object.freeze([]),
    sourceEvidence: Object.freeze({ identity: `CONTROLLED-SOURCE-${candidate.nodeId}`, value: 'QF_REAL', authority: 'CII_NODENAME_FIXED_LAYOUT' }),
    targetEvidence: Object.freeze({ identity: candidate.nodeId, value: '' }), before: '', proposed: 'QF_REAL',
    matchAuthority: Object.freeze({ status: 'REVIEWED' }),
  });
}
function sifDeleteOperations(selection) {
  return selection.owners.map((owner) => {
    const edge = selection.edges.get(Number(owner.parsedElementIndex));
    assert(edge, `Missing target graph edge for parsed element ${owner.parsedElementIndex}`);
    return Object.freeze({
      operationId: `QF-SIF-DELETE-P${selection.pointer}-E${owner.parsedElementIndex}`,
      family: 'SIF_TEE', property: 'SIF/Tee record presence', action: 'DELETE', status: 'PREVIEW_READY', scopeDecision: 'APPLY',
      policyAuthority: CII_WRITER_2_SIF_DELETE_POLICY, evidenceAuthority: 'ELEMENT_POINTER_TO_SIF_TEES_RAW_RECORD', blockers: Object.freeze([]),
      sourceEvidence: Object.freeze({ identity: `CONTROLLED-SOURCE-${edge.elementId}`, value: false, authority: 'ELEMENT_POINTER_TO_SIF_TEES_RAW_RECORD' }),
      targetEvidence: Object.freeze({ identity: String(edge.elementId), value: true }), before: true, proposed: false,
      matchAuthority: Object.freeze({ status: 'REVIEWED' }),
    });
  });
}
function boundTransferPlan(targetDocument, operations) {
  const ids = Object.freeze(sortedIds(operations));
  return Object.freeze({
    status: 'PREVIEW_READY', blockers: Object.freeze([]), mutationAuthority: 'WRITER_2_COMPOSITE_CONDITIONAL',
    sourceDocument: Object.freeze({ fileName: 'CONTROLLED_WRITER2_QUALIFICATION_SOURCE', contentSha256: SOURCE_SHA }),
    targetDocument: Object.freeze({ fileName: targetDocument.fileName, contentSha256: targetDocument.contentSha256 }),
    operations: Object.freeze(operations), excludedOperations: Object.freeze([]),
    policy: Object.freeze({ mixedCardinalityMutation: 'ONE_ORIGINAL_PREIMAGE_COMPOSITE' }),
    transferScope: Object.freeze({
      schema: 'CIIWorkspaceTransferScope.v1', mode: 'EXPLICIT_APPLY_EXCLUDE', status: 'BOUND', authority: 'USER_EXPLICIT_OPERATION_SCOPE',
      scopeId: 'QF-WRITER2-REAL-BENCHMARK-V1', sourceSha256: SOURCE_SHA, targetSha256: targetDocument.contentSha256,
      candidateOperationIds: ids, appliedOperationIds: ids, excludedOperationIds: Object.freeze([]),
      appliedOperationCount: ids.length, excludedOperationCount: 0,
    }),
  });
}

const fixture = new Uint8Array(await readFile(new URL('../Benchmark/CIICompare/BM_CII_TARGET1.CII', import.meta.url)));
assert.equal(fixture.byteLength, FIXTURE_BYTES, 'qualification fixture byte size drifted');
const before = await intakeCiiWorkspaceDocument(fixture, 'BM_CII_TARGET1.CII', { side: 'TARGET', cryptoRef: webcrypto });
const graph = adaptCiiDocumentToTopologyGraph(before);
assert.equal(before.writer1CByteEligible, true, 'real benchmark must retain exact original-byte custody');
assert.equal(before.parsed?.elements?.length, FIXTURE_ELEMENTS);
assert.equal(before.nodeNameEvidence?.physicalCustody?.status, 'QUALIFIED');
assert.equal(before.nodeNameEvidence?.physicalCustody?.rowCount, FIXTURE_NODENAME_ROWS);
assert.equal(before.sifWriter1CEvidence?.status, 'QUALIFIED');
assert.equal(before.sifWriter1CEvidence?.controlBlockCount, FIXTURE_SIF_BLOCKS);
assert.equal(before.sifWriter1CEvidence?.neutralVersion?.major, 11);
assert.equal(before.sifWriter1CEvidence?.blockRows, 10);

const nodeCandidate = chooseNodeCreate(before);
const sifSelection = chooseSifPointer(before, graph);
const operations = Object.freeze([nodeCreateOperation(nodeCandidate), ...sifDeleteOperations(sifSelection)]);
const transferPlan = boundTransferPlan(before, operations);
const preview = Object.freeze({
  writerVersion: '2', targetDocument: before, transferPlan,
  correspondence: Object.freeze({ status: 'READY', authority: 'CONTROLLED_REAL_BENCHMARK_QUALIFICATION' }),
});

const lowLevel = applyCiiWriter2Composite({ targetDocument: before, targetGraph: graph, transferPlan });
assert.equal(lowLevel.status, 'APPLIED');
assert.equal(lowLevel.mode, 'ONE_ORIGINAL_PREIMAGE_COMPOSITE');
assert(lowLevel.familyMutationCounts.nodeNameOperations >= 1);
assert(lowLevel.familyMutationCounts.sifDeleteOperations >= 1);

const applied = await applyCiiWorkspaceTargetWriter2(preview, fixture, { cryptoRef: webcrypto });
assert.equal(applied.status, 'PASS');
assert.equal(applied.writer, 'WRITER_2');
assert.equal(applied.validation?.status, 'PASS');
assert.equal(applied.validation?.unexpectedSemanticDeltaCount, 0);
assert.equal(applied.byteString, lowLevel.byteString, 'public product Writer2 output must equal the qualified low-level composite output');
assert.notEqual(applied.modifiedTargetSha256, before.contentSha256);

const exportedBytes = byteStringToBytes(applied.byteString);
assert.equal(exportedBytes.byteLength, applied.byteLength);
const after = await intakeCiiWorkspaceDocument(exportedBytes, applied.fileName, { side: 'TARGET', cryptoRef: webcrypto });
assert.equal(after.writer1CByteEligible, true, 'exported Writer2 result must preserve exact-byte intake eligibility');
assert.equal(after.nodeNames?.[nodeCandidate.nodeId], 'QF_REAL');
assert.equal(after.nodeNameEvidence?.physicalCustody?.rowCount, FIXTURE_NODENAME_ROWS + 1);
assert.equal(after.sifWriter1CEvidence?.controlBlockCount, FIXTURE_SIF_BLOCKS - 1);
assert.equal(after.sifWriter1CEvidence?.sectionRowCount, (FIXTURE_SIF_BLOCKS - 1) * 10);
assert.deepEqual(
  after.parsed.elements.map((element) => [Number(element.index), String(element.from), String(element.to)]),
  before.parsed.elements.map((element) => [Number(element.index), String(element.from), String(element.to)]),
  'Writer2 cardinality qualification must not alter element connectivity',
);

for (const owner of sifSelection.owners) {
  const post = after.sifWriter1CEvidence?.byParsedElementIndex?.[String(owner.parsedElementIndex)];
  assert.equal(Number(post?.pointer), 0, `selected SIF owner ${owner.parsedElementIndex} must be cleared`);
}

await assert.rejects(
  () => applyCiiWorkspaceTargetWriter2(preview, exportedBytes, { cryptoRef: webcrypto }),
  /CII_WRITER_2_STALE_TARGET_HASH/,
  'replaying an old bound preview against its own modified export must fail stale-target custody',
);

const headerToken = 'Data generated by CAESAR II/CADWorx/PIPE interface';
const tamperIndex = lowLevel.byteString.indexOf(headerToken);
assert(tamperIndex >= 0, 'qualification fixture header token required for unrelated-byte falsifier');
const tamperedString = `${lowLevel.byteString.slice(0, tamperIndex)}X${lowLevel.byteString.slice(tamperIndex + 1)}`;
const tampered = await intakeCiiWorkspaceDocument(byteStringToBytes(tamperedString), 'Tampered_BM_CII_TARGET1.CII', { side: 'TARGET', cryptoRef: webcrypto });
assert.throws(
  () => validateCiiWriter2CompositeRoundTrip(before, tampered, graph, transferPlan, lowLevel),
  /EXACT_COMPOSITE_POSTIMAGE_MISMATCH/,
  'one unrelated byte outside authorized Writer2 spans must fail independent full-postimage validation',
);

console.log(`Writer2 real benchmark qualification passed: node ${nodeCandidate.nodeId} CREATE + SIF pointer ${sifSelection.pointer} DELETE on BM_CII_TARGET1.CII.`);
