import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { intakeCiiWorkspaceDocument } from '../tabs/cii-workspace/cii-workspace-intake.js';
import { ciiPhysicalSectionRows } from '../tabs/cii-workspace/cii-workspace-physical-file.js';
import { adaptCiiDocumentToTopologyGraph } from '../tabs/cii-workspace/cii-workspace-topology-adapter.js';
import { applyCiiWorkspaceTargetWriter2 } from '../tabs/cii-workspace/cii-workspace-core.js';
import { ciiWriter2CompositeReadiness } from '../tabs/cii-workspace/cii-workspace-writer2-composite-routing.js';
import { applyCiiWriter2CompositeWithHangerDeleteAll } from '../tabs/cii-workspace/cii-workspace-writer2-composite-hanger.js';
import { validateCiiWriter2CompositeWithHangerRoundTrip } from '../tabs/cii-workspace/cii-workspace-writer2-composite-hanger-validation.js';
import { CII_WRITER_2_NODENAME_RELOCATION_POLICY } from '../tabs/cii-workspace/cii-workspace-writer2-nodename-relocation.js';
import { CII_WRITER_2_SIF_DELETE_POLICY } from '../tabs/cii-workspace/cii-workspace-writer2-sif-delete.js';
import { CII_HANGER_LAYOUTS } from '../tabs/cii-workspace/cii-workspace-hanger.js';
import { CII_WRITER_2_HANGER_DELETE_POLICY } from '../tabs/cii-workspace/cii-workspace-writer2-hanger-delete.js';

const SOURCE_SHA = '2323232323232323232323232323232323232323232323232323232323232323';
const FIXTURE_ELEMENTS = 40;
const FIXTURE_NODENAME_ROWS = 4;
const FIXTURE_SIF_BLOCKS = 9;
const FIXTURE_HANGERS = 1;
const FIXTURE_HANGER_NODE = '205';
const FIXTURE_MISCEL_ROWS = 23;
const POST_MISCEL_ROWS = 11;

function byteStringToBytes(value) {
  const raw = String(value ?? '');
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index) & 0xff;
  return bytes;
}
function sortedIds(operations) {
  return operations.map((operation) => String(operation.operationId))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}
function connectivity(document) {
  return document.parsed.elements.map((element) => [Number(element.index), String(element.from), String(element.to)]);
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
  throw new Error('REAL_TRIFAMILY_BENCHMARK_SIF_POINTER_WITH_EXACT_OWNER_REQUIRED');
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
  throw new Error('REAL_TRIFAMILY_BENCHMARK_ZERO_POINTER_NODENAME_ENDPOINT_REQUIRED');
}
function nodeCreateOperation(candidate) {
  return Object.freeze({
    operationId: `QF3-NODENAME-CREATE-${candidate.nodeId}`,
    family: 'NODE_NAME', property: 'Node name / to-name', action: 'CREATE', status: 'PREVIEW_READY', scopeDecision: 'APPLY',
    policyAuthority: CII_WRITER_2_NODENAME_RELOCATION_POLICY, evidenceAuthority: 'CII_NODENAME_FIXED_LAYOUT', blockers: Object.freeze([]),
    sourceEvidence: Object.freeze({ identity: `CONTROLLED-SOURCE-${candidate.nodeId}`, value: 'QF_TRI', authority: 'CII_NODENAME_FIXED_LAYOUT' }),
    targetEvidence: Object.freeze({ identity: candidate.nodeId, value: '' }), before: '', proposed: 'QF_TRI',
    matchAuthority: Object.freeze({ status: 'REVIEWED' }),
  });
}
function sifDeleteOperations(selection) {
  return selection.owners.map((owner) => {
    const edge = selection.edges.get(Number(owner.parsedElementIndex));
    assert(edge, `Missing target graph edge for parsed element ${owner.parsedElementIndex}`);
    return Object.freeze({
      operationId: `QF3-SIF-DELETE-P${selection.pointer}-E${owner.parsedElementIndex}`,
      family: 'SIF_TEE', property: 'SIF/Tee record presence', action: 'DELETE', status: 'PREVIEW_READY', scopeDecision: 'APPLY',
      policyAuthority: CII_WRITER_2_SIF_DELETE_POLICY, evidenceAuthority: 'ELEMENT_POINTER_TO_SIF_TEES_RAW_RECORD', blockers: Object.freeze([]),
      sourceEvidence: Object.freeze({ identity: `CONTROLLED-SOURCE-${edge.elementId}`, value: false, authority: 'ELEMENT_POINTER_TO_SIF_TEES_RAW_RECORD' }),
      targetEvidence: Object.freeze({ identity: String(edge.elementId), value: true }), before: true, proposed: false,
      matchAuthority: Object.freeze({ status: 'REVIEWED' }),
    });
  });
}
function hangerDeleteOperation(nodeId) {
  return Object.freeze({
    operationId: `QF3-HANGER-DELETE-${nodeId}`,
    family: 'HANGER', property: 'Hanger presence', action: 'DELETE', status: 'PREVIEW_READY', scopeDecision: 'APPLY',
    policyAuthority: CII_WRITER_2_HANGER_DELETE_POLICY, evidenceAuthority: 'CONTROL_NOHGRS_PLUS_MISCEL_1_IHGRNODE', blockers: Object.freeze([]),
    sourceEvidence: Object.freeze({ identity: `CONTROLLED-SOURCE-${nodeId}`, value: false, authority: 'CONTROL_NOHGRS_PLUS_MISCEL_1_IHGRNODE' }),
    targetEvidence: Object.freeze({ identity: String(nodeId), value: true }), before: true, proposed: false,
    matchAuthority: Object.freeze({ status: 'REVIEWED' }),
  });
}
function boundTransferPlan(targetDocument, operations) {
  const ids = Object.freeze(sortedIds(operations));
  return Object.freeze({
    status: 'PREVIEW_READY', blockers: Object.freeze([]), mutationAuthority: 'WRITER_2_COMPOSITE_CARDINALITY_CONDITIONAL',
    sourceDocument: Object.freeze({ fileName: 'CONTROLLED_WRITER2_TRIFAMILY_QUALIFICATION_SOURCE', contentSha256: SOURCE_SHA }),
    targetDocument: Object.freeze({ fileName: targetDocument.fileName, contentSha256: targetDocument.contentSha256 }),
    operations: Object.freeze(operations), excludedOperations: Object.freeze([]),
    policy: Object.freeze({ mixedCardinalityMutation: 'ONE_ORIGINAL_PREIMAGE_COMPOSITE' }),
    transferScope: Object.freeze({
      schema: 'CIIWorkspaceTransferScope.v1', mode: 'EXPLICIT_APPLY_EXCLUDE', status: 'BOUND', authority: 'USER_EXPLICIT_OPERATION_SCOPE',
      scopeId: 'QF-WRITER2-TRIFAMILY-REAL-BENCHMARK-V1', sourceSha256: SOURCE_SHA, targetSha256: targetDocument.contentSha256,
      candidateOperationIds: ids, appliedOperationIds: ids, excludedOperationIds: Object.freeze([]),
      appliedOperationCount: ids.length, excludedOperationCount: 0,
    }),
  });
}

const fixture = new Uint8Array(await readFile(new URL('../Benchmark/CIICompare/BM_CII_SOURCE.CII', import.meta.url)));
const before = await intakeCiiWorkspaceDocument(fixture, 'BM_CII_SOURCE.CII', { side: 'TARGET', cryptoRef: webcrypto });
const graph = adaptCiiDocumentToTopologyGraph(before);

assert.equal(before.writer1CByteEligible, true, 'real benchmark must retain exact original-byte custody');
assert.equal(before.summary?.neutralVersionMajor, 11);
assert.equal(before.parsed?.elements?.length, FIXTURE_ELEMENTS);
assert.equal(before.nodeNameEvidence?.physicalCustody?.status, 'QUALIFIED');
assert.equal(before.nodeNameEvidence?.physicalCustody?.rowCount, FIXTURE_NODENAME_ROWS);
assert.equal(before.sifWriter1CEvidence?.status, 'QUALIFIED');
assert.equal(before.sifWriter1CEvidence?.controlBlockCount, FIXTURE_SIF_BLOCKS);
assert.equal(before.sifWriter1CEvidence?.blockRows, 10);
assert.equal(before.hangerEvidence?.status, 'QUALIFIED');
assert.equal(before.hangerEvidence?.layout, CII_HANGER_LAYOUTS.SYNCHRONIZER);
assert.equal(before.hangerEvidence?.count, FIXTURE_HANGERS);
assert.deepEqual(before.hangerEvidence?.nodes, [FIXTURE_HANGER_NODE]);
assert.equal(ciiPhysicalSectionRows(before.physicalFile, 'MISCEL_1').length, FIXTURE_MISCEL_ROWS);

const nodeCandidate = chooseNodeCreate(before);
const sifSelection = chooseSifPointer(before, graph);
const operations = Object.freeze([
  nodeCreateOperation(nodeCandidate),
  ...sifDeleteOperations(sifSelection),
  hangerDeleteOperation(FIXTURE_HANGER_NODE),
]);
const transferPlan = boundTransferPlan(before, operations);
const readiness = ciiWriter2CompositeReadiness(transferPlan, before, graph);
assert.equal(readiness.ready, true, readiness.blockers.join('|'));
assert.equal(readiness.familyMutationCounts.nodeName, 1);
assert(readiness.familyMutationCounts.sifDelete >= 1);
assert.equal(readiness.familyMutationCounts.hangerDelete, 1);
assert.equal(readiness.components.hangerDeleteAll?.compaction?.deleteAll, true);
assert.equal(readiness.components.hangerDeleteAll?.countAfter, 0);

const preview = Object.freeze({
  writerVersion: '2', targetDocument: before, transferPlan,
  correspondence: Object.freeze({ status: 'READY', authority: 'CONTROLLED_REAL_TRIFAMILY_BENCHMARK_QUALIFICATION' }),
});

const lowLevel = applyCiiWriter2CompositeWithHangerDeleteAll({ targetDocument: before, targetGraph: graph, transferPlan });
assert.equal(lowLevel.status, 'APPLIED');
assert.equal(lowLevel.schema, 'CIIWorkspaceWriter2CompositeHangerResult.v1');
assert.equal(lowLevel.mode, 'ONE_ORIGINAL_PREIMAGE_COMPOSITE');
assert.equal(lowLevel.familyMutationCounts.nodeNameOperations, 1);
assert(lowLevel.familyMutationCounts.sifDeleteOperations >= 1);
assert.equal(lowLevel.familyMutationCounts.hangerDeleteOperations, 1);
assert(lowLevel.mutations.some((item) => item.authorityFamily === 'WRITER_2_NODENAME' && item.kind === 'NODENAME_SECTION_PAYLOAD'));
assert(lowLevel.mutations.some((item) => item.authorityFamily === 'WRITER_2_SIF_DELETE' && item.kind === 'SIF_TEE_SECTION_PAYLOAD'));
assert(lowLevel.mutations.some((item) => item.authorityFamily === 'WRITER_2_HANGER_DELETE_ALL' && item.kind === 'MISCEL_1_HANGER_DELETE_ALL_PAYLOAD'));

const applied = await applyCiiWorkspaceTargetWriter2(preview, fixture, { cryptoRef: webcrypto });
assert.equal(applied.status, 'PASS');
assert.equal(applied.writer, 'WRITER_2');
assert.equal(applied.validation?.status, 'PASS');
assert.equal(applied.validation?.schema, 'CIIWorkspaceWriter2CompositeHangerValidation.v1');
assert.equal(applied.validation?.unexpectedSemanticDeltaCount, 0);
assert.equal(applied.byteString, lowLevel.byteString, 'public product output must equal the direct tri-family one-preimage writer output');
assert.notEqual(applied.modifiedTargetSha256, before.contentSha256);

const exportedBytes = byteStringToBytes(applied.byteString);
assert.equal(exportedBytes.byteLength, applied.byteLength);
const after = await intakeCiiWorkspaceDocument(exportedBytes, applied.fileName, { side: 'TARGET', cryptoRef: webcrypto });
assert.equal(after.writer1CByteEligible, true, 'exported Writer2 result must preserve exact-byte intake eligibility');
assert.equal(after.nodeNames?.[nodeCandidate.nodeId], 'QF_TRI');
assert.equal(after.nodeNameEvidence?.physicalCustody?.rowCount, FIXTURE_NODENAME_ROWS + 1);
assert.equal(after.sifWriter1CEvidence?.controlBlockCount, FIXTURE_SIF_BLOCKS - 1);
assert.equal(after.sifWriter1CEvidence?.sectionRowCount, (FIXTURE_SIF_BLOCKS - 1) * 10);
assert.equal(after.hangerEvidence?.status, 'QUALIFIED');
assert.equal(after.hangerEvidence?.count, 0);
assert.equal(after.hangerEvidence?.layout, CII_HANGER_LAYOUTS.NONE);
assert.deepEqual(after.hangerEvidence?.nodes, []);
assert.equal(ciiPhysicalSectionRows(after.physicalFile, 'MISCEL_1').length, POST_MISCEL_ROWS);
assert.deepEqual(connectivity(after), connectivity(before), 'tri-family Writer2 qualification must not alter element connectivity');

for (const owner of sifSelection.owners) {
  const post = after.sifWriter1CEvidence?.byParsedElementIndex?.[String(owner.parsedElementIndex)];
  assert.equal(Number(post?.pointer), 0, `selected SIF owner ${owner.parsedElementIndex} must be cleared`);
}

assert.equal(validateCiiWriter2CompositeWithHangerRoundTrip(before, after, graph, transferPlan, lowLevel).status, 'PASS');

await assert.rejects(
  () => applyCiiWorkspaceTargetWriter2(preview, exportedBytes, { cryptoRef: webcrypto }),
  /CII_WRITER_2_STALE_TARGET_HASH/,
  'replaying an old bound preview against its own modified export must fail stale-target custody',
);

const headerToken = 'Data generated by CAESAR II/CADWorx/PIPE interface';
const tamperIndex = lowLevel.byteString.indexOf(headerToken);
assert(tamperIndex >= 0, 'qualification fixture header token required for unrelated-byte falsifier');
const tamperedString = `${lowLevel.byteString.slice(0, tamperIndex)}X${lowLevel.byteString.slice(tamperIndex + 1)}`;
const tampered = await intakeCiiWorkspaceDocument(byteStringToBytes(tamperedString), 'Tampered_BM_CII_SOURCE.CII', { side: 'TARGET', cryptoRef: webcrypto });
assert.throws(
  () => validateCiiWriter2CompositeWithHangerRoundTrip(before, tampered, graph, transferPlan, lowLevel),
  /EXACT_TRI_FAMILY_POSTIMAGE_MISMATCH/,
  'one unrelated byte outside authorized Writer2 spans must fail independent complete-postimage validation',
);

const forgedLedger = Object.freeze({ ...lowLevel, mutations: Object.freeze(lowLevel.mutations.slice(1)) });
assert.throws(
  () => validateCiiWriter2CompositeWithHangerRoundTrip(before, after, graph, transferPlan, forgedLedger),
  /COMPOSITE_MUTATION_(COUNT|TESTIMONY)_MISMATCH/,
  'forged Writer2 mutation testimony must not authorize an otherwise correct postimage',
);

const duplicateScope = Object.freeze({
  ...transferPlan,
  transferScope: Object.freeze({
    ...transferPlan.transferScope,
    appliedOperationIds: Object.freeze([...transferPlan.transferScope.appliedOperationIds, transferPlan.transferScope.appliedOperationIds[0]]),
  }),
});
const duplicateReadiness = ciiWriter2CompositeReadiness(duplicateScope, before, graph);
assert.equal(duplicateReadiness.ready, false);
assert(duplicateReadiness.blockers.includes('WRITER_2_COMPOSITE_SCOPE_APPLY_IDS_DUPLICATE'));
assert.throws(
  () => applyCiiWriter2CompositeWithHangerDeleteAll({ targetDocument: before, targetGraph: graph, transferPlan: duplicateScope }),
  /CII_WRITER_2_COMPOSITE_HANGER_SCOPE_APPLY_DUPLICATE_ID/,
  'duplicate parent-scope operation testimony must fail before byte mutation',
);

console.log(`Writer2 tri-family real benchmark qualification authored: node ${nodeCandidate.nodeId} CREATE + SIF pointer ${sifSelection.pointer} DELETE + hanger ${FIXTURE_HANGER_NODE} DELETE-ALL on BM_CII_SOURCE.CII.`);
