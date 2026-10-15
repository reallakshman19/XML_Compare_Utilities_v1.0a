import assert from 'node:assert/strict';
import { createCiiPhysicalFile, ciiPhysicalSectionRows } from '../tabs/cii-workspace/cii-workspace-physical-file.js';
import { extractCiiNodeNameEvidence } from '../tabs/cii-workspace/cii-workspace-nodename.js';
import { extractCiiWriter1CSifEvidence } from '../tabs/cii-workspace/cii-workspace-writer1c-sif-custody.js';
import { CII_WRITER_2_NODENAME_RELOCATION_POLICY } from '../tabs/cii-workspace/cii-workspace-writer2-nodename-relocation.js';
import { CII_WRITER_2_SIF_CREATE_BLOCKER, CII_WRITER_2_SIF_DELETE_POLICY } from '../tabs/cii-workspace/cii-workspace-writer2-sif-delete.js';
import { applyCiiWriter2Composite, _test as compositeTest } from '../tabs/cii-workspace/cii-workspace-writer2-composite.js';
import { validateCiiWriter2CompositeRoundTrip } from '../tabs/cii-workspace/cii-workspace-writer2-composite-validation.js';

const WIDTHS = [15, 13, 13, 13, 13, 13];
const SOURCE_SHA = 'SOURCE-SHA-TEST';
const TARGET_SHA = 'TARGET-SHA-TEST';
function numericRow(values) { return values.map((value, index) => String(value ?? 0).padStart(WIDTHS[index], ' ')).join(''); }
function nameRow(fromName = '', toName = '') { return `  ${String(fromName).padEnd(26, ' ')}${String(toName).padEnd(25, ' ')}`; }
function elementBlock(from, to, sifPointer, nodePointer) {
  const rows = Array.from({ length: 15 }, () => numericRow([0, 0, 0, 0, 0, 0]));
  rows[0] = numericRow([from, to, 0, 0, 0, 100]); rows[13] = numericRow([0, 0, 0, 0, sifPointer, nodePointer]); return rows;
}
function sifBlock(pointer) {
  return Array.from({ length: 10 }, (_, row) => {
    const seed = pointer * 100 + row * 10; return numericRow([seed + 1, seed + 2, seed + 3, seed + 4, seed + 5, seed + 6]);
  });
}
function fixtureText() {
  const elements = [
    { from: 10, to: 20, sif: 1, name: 1 }, { from: 30, to: 40, sif: 2, name: 2 },
    { from: 50, to: 60, sif: 3, name: 3 }, { from: 70, to: 80, sif: 0, name: 0 },
  ];
  return [
    '#$ VERSION', numericRow([5, 11, 1256, 0, 0, 0]),
    '#$ CONTROL', numericRow([4, 0, 0, 3, 0, 0]), numericRow([0, 0, 0, 0, 0, 0]), numericRow([0, 0, 0, 0, 3, 0]), numericRow([0, 0, 0, 0, 0, 0]),
    '#$ ELEMENTS', ...elements.flatMap((item) => elementBlock(item.from, item.to, item.sif, item.name)),
    '#$ NODENAME', nameRow('A10', 'A20'), nameRow('', 'D40'), nameRow('', 'C60'),
    '#$ SIF&TEES', ...[1, 2, 3].flatMap(sifBlock),
    '#$ REDUCERS', 'UNCHANGED-REDUCERS-PAYLOAD', '#$ RIGID',
  ].join('\r\n') + '\r\n';
}
function parsedModel() {
  const elements = [
    { index: 0, from: 10, to: 20 }, { index: 1, from: 30, to: 40 }, { index: 2, from: 50, to: 60 }, { index: 3, from: 70, to: 80 },
  ];
  const nodes = Object.fromEntries([...new Set(elements.flatMap((item) => [item.from, item.to]))].map((id) => [String(id), Object.freeze({})]));
  return Object.freeze({ nodes: Object.freeze(nodes), elements: Object.freeze(elements.map((item) => Object.freeze(item))) });
}
function targetGraph() {
  return Object.freeze({ edges: Object.freeze(parsedModel().elements.map((item) => Object.freeze({
    elementId: `E${item.index + 1}`, parsedElementIndex: item.index, from: String(item.from), to: String(item.to),
  }))) });
}
function documentFrom(bytes, parsed = parsedModel()) {
  const physicalFile = createCiiPhysicalFile(bytes); const nodeNameEvidence = extractCiiNodeNameEvidence(physicalFile.text, parsed, { physicalFile });
  const sifWriter1CEvidence = extractCiiWriter1CSifEvidence(physicalFile.text, parsed, { physicalFile });
  return Object.freeze({ contentSha256: TARGET_SHA, physicalFile, writer1CByteEligible: physicalFile.writer1CByteEligible, parsed, nodeNameEvidence,
    nodeNames: nodeNameEvidence.names, sifWriter1CEvidence });
}
function nodeCreate() {
  return Object.freeze({ operationId: 'CREATE-N80', family: 'NODE_NAME', property: 'Node name / to-name', action: 'CREATE', status: 'PREVIEW_READY', scopeDecision: 'APPLY',
    policyAuthority: CII_WRITER_2_NODENAME_RELOCATION_POLICY, targetEvidence: Object.freeze({ identity: '80' }), before: '', proposed: 'N80',
    matchAuthority: Object.freeze({ status: 'REVIEWED' }) });
}
function sifDelete() {
  return Object.freeze({ operationId: 'DELETE-SIF-E2', family: 'SIF_TEE', property: 'SIF/Tee record presence', action: 'DELETE', status: 'PREVIEW_READY', scopeDecision: 'APPLY',
    policyAuthority: CII_WRITER_2_SIF_DELETE_POLICY, evidenceAuthority: 'ELEMENT_POINTER_TO_SIF_TEES_RAW_RECORD',
    sourceEvidence: Object.freeze({ identity: 'SRC-E2', value: false, authority: 'ELEMENT_POINTER_TO_SIF_TEES_RAW_RECORD' }),
    targetEvidence: Object.freeze({ identity: 'E2', value: true }), before: true, proposed: false, matchAuthority: Object.freeze({ status: 'REVIEWED' }) });
}
function sifCreate() {
  return Object.freeze({ operationId: 'CREATE-SIF-E4', family: 'SIF_TEE', property: 'SIF/Tee record presence', action: 'CREATE', status: 'BLOCKED', scopeDecision: 'APPLY',
    policyAuthority: CII_WRITER_2_SIF_DELETE_POLICY, evidenceAuthority: 'ELEMENT_POINTER_TO_SIF_TEES_RAW_RECORD',
    sourceEvidence: Object.freeze({ identity: 'SRC-E4', value: true, authority: 'ELEMENT_POINTER_TO_SIF_TEES_RAW_RECORD' }),
    targetEvidence: Object.freeze({ identity: 'E4', value: false }), before: false, proposed: true, matchAuthority: Object.freeze({ status: 'REVIEWED' }) });
}
function transferPlan(extra = [], excluded = []) {
  const operations = [nodeCreate(), sifDelete(), ...extra];
  const appliedIds = operations.filter((item) => item.scopeDecision === 'APPLY' && item.action !== 'KEEP').map((item) => item.operationId).sort();
  const excludedRows = excluded.map((item) => Object.freeze({ ...item, scopeDecision: 'EXCLUDE' }));
  const excludedIds = excludedRows.filter((item) => item.action !== 'KEEP').map((item) => item.operationId).sort();
  const candidateIds = [...appliedIds, ...excludedIds].sort();
  return Object.freeze({
    status: 'PREVIEW_READY', blockers: Object.freeze([]),
    sourceDocument: Object.freeze({ fileName: 'source.cii', contentSha256: SOURCE_SHA }),
    targetDocument: Object.freeze({ fileName: 'target.cii', contentSha256: TARGET_SHA }),
    operations: Object.freeze(operations), excludedOperations: Object.freeze(excludedRows),
    transferScope: Object.freeze({ schema: 'CIIWorkspaceTransferScope.v1', mode: 'EXPLICIT_APPLY_EXCLUDE', status: 'BOUND', authority: 'USER_EXPLICIT_OPERATION_SCOPE',
      sourceSha256: SOURCE_SHA, targetSha256: TARGET_SHA, scopeId: `transfer-scope:test:${candidateIds.join('|')}`,
      candidateOperationIds: Object.freeze(candidateIds), appliedOperationIds: Object.freeze(appliedIds), excludedOperationIds: Object.freeze(excludedIds),
      appliedOperationCount: appliedIds.length, excludedOperationCount: excludedIds.length }),
  });
}

{
  const before = documentFrom(new TextEncoder().encode(fixtureText())); const graph = targetGraph(); const plan = transferPlan();
  assert.equal(before.nodeNameEvidence.physicalCustody.status, 'QUALIFIED'); assert.equal(before.sifWriter1CEvidence.status, 'QUALIFIED');
  const parentCustody = compositeTest.assertBoundScopeCustody(plan, before);
  const nodeProjection = compositeTest.projectTransferPlan(plan, compositeTest.isNodeMutation, 'WRITER_2_NODENAME', parentCustody);
  assert.equal(nodeProjection.transferScope, plan.transferScope);
  assert.equal(nodeProjection.familyProjection.status, 'DERIVED_BOUND_SUBSET');
  assert.deepEqual(nodeProjection.familyProjection.projectedAppliedOperationIds, ['CREATE-N80']);
  assert.deepEqual(nodeProjection.familyProjection.siblingAppliedOperationIds, ['DELETE-SIF-E2']);
  assert.deepEqual(nodeProjection.excludedOperations.map((item) => item.operationId), ['DELETE-SIF-E2']);

  const beforeSifRows = ciiPhysicalSectionRows(before.physicalFile, ['SIF&TEES', 'SIF']).map((row) => row.text);
  const writer = applyCiiWriter2Composite({ targetDocument: before, targetGraph: graph, transferPlan: plan });
  assert.equal(writer.status, 'APPLIED'); assert.equal(writer.mode, 'ONE_ORIGINAL_PREIMAGE_COMPOSITE');
  assert.notEqual(writer.byteLengthAfter, writer.byteLengthBefore);
  assert.equal(writer.parentScopeCustody.parentScopeId, plan.transferScope.scopeId);
  assert.equal(writer.familyMutationCounts.nodeNameOperations, 1); assert.equal(writer.familyMutationCounts.sifDeleteOperations, 1);
  assert(writer.mutations.some((item) => item.authorityFamily === 'WRITER_2_NODENAME' && item.kind === 'NODENAME_SECTION_PAYLOAD'));
  assert(writer.mutations.some((item) => item.authorityFamily === 'WRITER_2_SIF_DELETE' && item.kind === 'SIF_TEE_SECTION_PAYLOAD'));

  const after = documentFrom(writer.bytes);
  assert.equal(after.nodeNames['80'], 'N80');
  assert.deepEqual(Object.values(after.nodeNameEvidence.physicalCustody.byElementIndex).map((item) => Number(item.pointer)), [1, 2, 3, 4]);
  assert.equal(after.sifWriter1CEvidence.controlBlockCount, 2);
  assert.deepEqual(Object.values(after.sifWriter1CEvidence.byParsedElementIndex).map((item) => Number(item.pointer)), [1, 0, 2, 0]);
  assert.deepEqual(ciiPhysicalSectionRows(after.physicalFile, ['SIF&TEES', 'SIF']).map((row) => row.text), [...beforeSifRows.slice(0, 10), ...beforeSifRows.slice(20, 30)]);
  assert.equal(validateCiiWriter2CompositeRoundTrip(before, after, graph, plan, writer).status, 'PASS');

  const tamperedBytes = new TextEncoder().encode(writer.byteString.replace('UNCHANGED-REDUCERS-PAYLOAD', 'XNCHANGED-REDUCERS-PAYLOAD'));
  const tampered = documentFrom(tamperedBytes);
  assert.throws(() => validateCiiWriter2CompositeRoundTrip(before, tampered, graph, plan, writer), /EXACT_COMPOSITE_POSTIMAGE_MISMATCH/);

  const forged = Object.freeze({ ...writer, mutations: Object.freeze(writer.mutations.slice(1)) });
  assert.throws(() => validateCiiWriter2CompositeRoundTrip(before, after, graph, plan, forged), /COMPOSITE_MUTATION_(COUNT|TESTIMONY)_MISMATCH/);

  const forgedComponent = Object.freeze({ ...writer, components: Object.freeze({ ...writer.components,
    sifDelete: Object.freeze({ ...writer.components.sifDelete, relocationPlan: Object.freeze({ ...writer.components.sifDelete.relocationPlan, blockCountAfter: 99 }) }) }) });
  assert.throws(() => validateCiiWriter2CompositeRoundTrip(before, after, graph, plan, forgedComponent), /SIF_COMPONENT_RELOCATION_TESTIMONY_MISMATCH/);

  const forgedScope = Object.freeze({ ...plan, transferScope: Object.freeze({ ...plan.transferScope, appliedOperationIds: Object.freeze(['CREATE-N80']) }) });
  assert.throws(() => applyCiiWriter2Composite({ targetDocument: before, targetGraph: graph, transferPlan: forgedScope }), /CII_WRITER_2_COMPOSITE_SCOPE_APPLY_SET_MISMATCH/);
  assert.throws(() => validateCiiWriter2CompositeRoundTrip(before, after, graph, forgedScope, writer), /SCOPE_APPLY_SET_MISMATCH/);
}

{
  const overlapOriginal = 'abcdefghij';
  assert.throws(() => compositeTest.arbitrateClaims([
    { authorityFamily: 'WRITER_2_NODENAME', claim: { kind: 'A', byteStart: 1, byteEnd: 5, beforeField: 'bcde', afterField: '1111' } },
    { authorityFamily: 'WRITER_2_SIF_DELETE', claim: { kind: 'B', byteStart: 4, byteEnd: 7, beforeField: 'efg', afterField: '222' } },
  ], overlapOriginal), /CII_WRITER_2_COMPOSITE_ORIGINAL_SPAN_OVERLAP/);
}

{
  const before = documentFrom(new TextEncoder().encode(fixtureText())); const unsupported = Object.freeze({ operationId: 'BAD', family: 'PROCESS', property: 'P1', action: 'COPY',
    status: 'PREVIEW_READY', scopeDecision: 'APPLY', before: 1, proposed: 2, matchAuthority: Object.freeze({ status: 'REVIEWED' }) });
  assert.throws(() => applyCiiWriter2Composite({ targetDocument: before, targetGraph: targetGraph(), transferPlan: transferPlan([unsupported]) }),
    /CII_WRITER_2_COMPOSITE_UNSUPPORTED_APPLY:BAD/);
}

{
  const before = documentFrom(new TextEncoder().encode(fixtureText()));
  assert.throws(() => applyCiiWriter2Composite({ targetDocument: before, targetGraph: targetGraph(), transferPlan: transferPlan([sifCreate()]) }),
    new RegExp(`CII_WRITER_2_COMPOSITE_${CII_WRITER_2_SIF_CREATE_BLOCKER}`));
}

console.log('Writer 2 one-original-preimage composite covers canonical scope custody, mixed NODENAME+SIF DELETE, overlap, semantic blockers and independent postimage validation.');
