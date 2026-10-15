import assert from 'node:assert/strict';
import { createCiiPhysicalFile, ciiPhysicalSectionRows } from '../tabs/cii-workspace/cii-workspace-physical-file.js';
import { extractCiiNodeNameEvidence } from '../tabs/cii-workspace/cii-workspace-nodename.js';
import { extractCiiWriter1CSifEvidence } from '../tabs/cii-workspace/cii-workspace-writer1c-sif-custody.js';
import { buildCiiHangerEvidence, CII_HANGER_LAYOUTS } from '../tabs/cii-workspace/cii-workspace-hanger.js';
import { CII_WRITER_2_NODENAME_RELOCATION_POLICY } from '../tabs/cii-workspace/cii-workspace-writer2-nodename-relocation.js';
import { CII_WRITER_2_SIF_DELETE_POLICY } from '../tabs/cii-workspace/cii-workspace-writer2-sif-delete.js';
import {
  CII_WRITER_2_HANGER_DELETE_POLICY, CII_WRITER_2_HANGER_PARTIAL_MULTI_DELETE_BLOCKER,
} from '../tabs/cii-workspace/cii-workspace-writer2-hanger-delete.js';
import {
  applyCiiWriter2CompositeWithHangerDeleteAll, _test as compositeTest,
} from '../tabs/cii-workspace/cii-workspace-writer2-composite-hanger.js';
import { validateCiiWriter2CompositeWithHangerRoundTrip } from '../tabs/cii-workspace/cii-workspace-writer2-composite-hanger-validation.js';

const WIDTHS = [15, 13, 13, 13, 13, 13];
const SOURCE_SHA = 'SOURCE-SHA-TRI';
const TARGET_SHA = 'TARGET-SHA-TRI';
function numericRow(values) { return values.map((value, index) => String(value ?? 0).padStart(WIDTHS[index], ' ')).join(''); }
function nameRow(fromName = '', toName = '') { return `  ${String(fromName).padEnd(26, ' ')}${String(toName).padEnd(25, ' ')}`; }
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
function hangerPayload(node = 20) {
  return [
    numericRow([106, 106, 106, 106]),
    numericRow([1, 25, 0, 9999, 1, 1]),
    numericRow([1, 0, 0, 0, 0]),
    numericRow([node]),
    numericRow([100, 25, 0, 0, 0, 0]),
    numericRow([0, 9999, 0, 0, 0, 0]),
    '           0 ',
    '           0 ',
    numericRow([node, 0, 1, 0]),
    numericRow([1]),
    numericRow([1]),
    numericRow([0]),
    numericRow([0]),
    numericRow([0, 0, 0, 2, 0, 1]),
    numericRow([0, 0, 21, 21, 0, 0]),
    numericRow([0, 0, 0, 0, 0, 3]),
    numericRow([3]),
  ];
}
function fixtureText() {
  const elements = [
    { from: 10, to: 20, sif: 1, name: 1 }, { from: 30, to: 40, sif: 2, name: 2 },
    { from: 50, to: 60, sif: 3, name: 3 }, { from: 70, to: 80, sif: 0, name: 0 },
  ];
  return [
    '#$ VERSION', numericRow([5, 11, 1256, 0, 0, 0]),
    '#$ CONTROL', numericRow([4, 0, 1, 3, 0, 0]), numericRow([0, 0, 0, 0, 0, 0]),
    numericRow([0, 0, 0, 0, 3, 0]), numericRow([0, 0, 0, 0, 0, 0]),
    '#$ ELEMENTS', ...elements.flatMap((item) => elementBlock(item.from, item.to, item.sif, item.name)),
    '#$ NODENAME', nameRow('A10', 'A20'), nameRow('', 'D40'), nameRow('', 'C60'),
    '#$ SIF&TEES', ...[1, 2, 3].flatMap(sifBlock),
    '#$ REDUCERS', 'UNCHANGED-REDUCERS-PAYLOAD',
    '#$ MISCEL_1', ...hangerPayload(20),
    '#$ UNITS', 'UNITS-CUSTODY', '#$ RIGID',
  ].join('\r\n') + '\r\n';
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
function targetGraph() {
  return Object.freeze({ edges: Object.freeze(parsedModel().elements.map((item) => Object.freeze({
    elementId: `E${item.index + 1}`, parsedElementIndex: item.index, from: String(item.from), to: String(item.to),
  }))) });
}
function documentFrom(bytes, parsed = parsedModel()) {
  const physicalFile = createCiiPhysicalFile(bytes);
  const nodeNameEvidence = extractCiiNodeNameEvidence(physicalFile.text, parsed, { physicalFile });
  const sifWriter1CEvidence = extractCiiWriter1CSifEvidence(physicalFile.text, parsed, { physicalFile });
  const hangerEvidence = buildCiiHangerEvidence(physicalFile.text, parsed);
  return Object.freeze({
    contentSha256: TARGET_SHA, physicalFile, writer1CByteEligible: physicalFile.writer1CByteEligible, parsed,
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
function hangerDelete(node = 20, id = `DELETE-HANGER-${node}`) {
  return Object.freeze({
    operationId: id, family: 'HANGER', property: 'Hanger presence', action: 'DELETE', status: 'PREVIEW_READY', scopeDecision: 'APPLY',
    policyAuthority: CII_WRITER_2_HANGER_DELETE_POLICY, evidenceAuthority: 'CONTROL_NOHGRS_PLUS_MISCEL_1_IHGRNODE',
    sourceEvidence: Object.freeze({ identity: `SRC-${node}`, value: false, authority: 'CONTROL_NOHGRS_PLUS_MISCEL_1_IHGRNODE' }),
    targetEvidence: Object.freeze({ identity: String(node), value: true }), before: true, proposed: false,
    matchAuthority: Object.freeze({ status: 'REVIEWED' }),
  });
}
function transferPlan(operations = [nodeCreate(), sifDelete(), hangerDelete()]) {
  const appliedIds = operations.filter((item) => item.scopeDecision === 'APPLY' && item.action !== 'KEEP').map((item) => item.operationId).sort();
  return Object.freeze({
    status: 'PREVIEW_READY', blockers: Object.freeze([]),
    sourceDocument: Object.freeze({ fileName: 'source.cii', contentSha256: SOURCE_SHA }),
    targetDocument: Object.freeze({ fileName: 'target.cii', contentSha256: TARGET_SHA }),
    operations: Object.freeze(operations), excludedOperations: Object.freeze([]),
    transferScope: Object.freeze({
      schema: 'CIIWorkspaceTransferScope.v1', mode: 'EXPLICIT_APPLY_EXCLUDE', status: 'BOUND', authority: 'USER_EXPLICIT_OPERATION_SCOPE',
      sourceSha256: SOURCE_SHA, targetSha256: TARGET_SHA, scopeId: `transfer-scope:tri:${appliedIds.join('|')}`,
      candidateOperationIds: Object.freeze(appliedIds), appliedOperationIds: Object.freeze(appliedIds), excludedOperationIds: Object.freeze([]),
      appliedOperationCount: appliedIds.length, excludedOperationCount: 0,
    }),
  });
}

// True tri-family variable-length transaction: NODENAME grows, SIF shrinks, MISCEL_1 shrinks later.
{
  const before = documentFrom(new TextEncoder().encode(fixtureText()));
  assert.equal(before.nodeNameEvidence.physicalCustody.status, 'QUALIFIED');
  assert.equal(before.sifWriter1CEvidence.status, 'QUALIFIED');
  assert.equal(before.hangerEvidence.status, 'QUALIFIED');
  assert.equal(before.hangerEvidence.layout, CII_HANGER_LAYOUTS.SYNCHRONIZER);
  assert.deepEqual(before.hangerEvidence.nodes, ['20']);
  const graph = targetGraph(); const plan = transferPlan();
  const parent = compositeTest.assertBoundScopeCustody(plan, before);
  const hangerProjection = compositeTest.projectTransferPlan(plan, compositeTest.isHangerDelete, 'WRITER_2_HANGER_DELETE_ALL', parent);
  assert.deepEqual(hangerProjection.familyProjection.projectedAppliedOperationIds, ['DELETE-HANGER-20']);
  assert.deepEqual(hangerProjection.familyProjection.siblingAppliedOperationIds.sort(), ['CREATE-N80', 'DELETE-SIF-E2']);

  const originalMiscel = ciiPhysicalSectionRows(before.physicalFile, 'MISCEL_1').map((row) => row.text);
  const writer = applyCiiWriter2CompositeWithHangerDeleteAll({ targetDocument: before, targetGraph: graph, transferPlan: plan });
  assert.equal(writer.status, 'APPLIED');
  assert.equal(writer.schema, 'CIIWorkspaceWriter2CompositeHangerResult.v1');
  assert.equal(writer.familyMutationCounts.nodeNameOperations, 1);
  assert.equal(writer.familyMutationCounts.sifDeleteOperations, 1);
  assert.equal(writer.familyMutationCounts.hangerDeleteOperations, 1);
  assert(writer.mutations.some((item) => item.authorityFamily === 'WRITER_2_NODENAME' && item.kind === 'NODENAME_SECTION_PAYLOAD'));
  assert(writer.mutations.some((item) => item.authorityFamily === 'WRITER_2_SIF_DELETE' && item.kind === 'SIF_TEE_SECTION_PAYLOAD'));
  assert(writer.mutations.some((item) => item.authorityFamily === 'WRITER_2_HANGER_DELETE_ALL' && item.kind === 'MISCEL_1_HANGER_DELETE_ALL_PAYLOAD'));

  const after = documentFrom(writer.bytes);
  assert.equal(after.nodeNames['80'], 'N80');
  assert.deepEqual(Object.values(after.nodeNameEvidence.physicalCustody.byElementIndex).map((item) => Number(item.pointer)), [1, 2, 3, 4]);
  assert.equal(after.sifWriter1CEvidence.controlBlockCount, 2);
  assert.deepEqual(Object.values(after.sifWriter1CEvidence.byParsedElementIndex).map((item) => Number(item.pointer)), [1, 0, 2, 0]);
  assert.equal(after.hangerEvidence.count, 0);
  assert.equal(after.hangerEvidence.layout, CII_HANGER_LAYOUTS.NONE);
  assert.deepEqual(ciiPhysicalSectionRows(after.physicalFile, 'MISCEL_1').map((row) => row.text),
    [originalMiscel[0], ...originalMiscel.slice(-4)], 'only RRMAT + four execution rows survive hanger delete-all');
  assert.equal(validateCiiWriter2CompositeWithHangerRoundTrip(before, after, graph, plan, writer).status, 'PASS');

  const tampered = documentFrom(new TextEncoder().encode(writer.byteString.replace('UNITS-CUSTODY', 'XNITS-CUSTODY')));
  assert.throws(() => validateCiiWriter2CompositeWithHangerRoundTrip(before, tampered, graph, plan, writer), /EXACT_TRI_FAMILY_POSTIMAGE_MISMATCH/);

  const forged = Object.freeze({ ...writer, mutations: Object.freeze(writer.mutations.slice(1)) });
  assert.throws(() => validateCiiWriter2CompositeWithHangerRoundTrip(before, after, graph, plan, forged), /COMPOSITE_MUTATION_(COUNT|TESTIMONY)_MISMATCH/);

  const forgedHanger = Object.freeze({ ...writer, components: Object.freeze({ ...writer.components,
    hangerDeleteAll: Object.freeze({ ...writer.components.hangerDeleteAll,
      deletePlan: Object.freeze({ ...writer.components.hangerDeleteAll.deletePlan, countAfter: 7 }) }) }) });
  assert.throws(() => validateCiiWriter2CompositeWithHangerRoundTrip(before, after, graph, plan, forgedHanger), /HANGER_COMPONENT_PLAN_TESTIMONY_MISMATCH/);
}

// CONTROL.NOHGRS and CONTROL.NONAM are adjacent but disjoint fixed-width claims.
{
  const original = ' '.repeat(100);
  const claims = compositeTest.arbitrateClaims([
    { authorityFamily: 'WRITER_2_HANGER_DELETE_ALL', claim: { kind: 'CONTROL_HANGER_COUNT', byteStart: 28, byteEnd: 41, beforeField: original.slice(28, 41), afterField: '0'.padStart(13, ' ') } },
    { authorityFamily: 'WRITER_2_NODENAME', claim: { kind: 'CONTROL_NONAM', byteStart: 41, byteEnd: 54, beforeField: original.slice(41, 54), afterField: '4'.padStart(13, ' ') } },
  ], original);
  assert.equal(claims.length, 2);
  assert.equal(claims[0].byteEnd, claims[1].byteStart);
}

// Any actual cross-family overlap is still fail-closed.
{
  const original = 'abcdefghij';
  assert.throws(() => compositeTest.arbitrateClaims([
    { authorityFamily: 'WRITER_2_HANGER_DELETE_ALL', claim: { kind: 'A', byteStart: 1, byteEnd: 5, beforeField: 'bcde', afterField: '1111' } },
    { authorityFamily: 'WRITER_2_SIF_DELETE', claim: { kind: 'B', byteStart: 4, byteEnd: 7, beforeField: 'efg', afterField: '222' } },
  ], original), /CII_WRITER_2_COMPOSITE_HANGER_ORIGINAL_SPAN_OVERLAP/);
}

// A partial H>1 hanger selection never reaches physical claim composition.
{
  const before = documentFrom(new TextEncoder().encode(fixtureText()));
  const bad = Object.freeze({ ...hangerDelete(20), operationId: 'DELETE-HANGER-20' });
  // The current fixture has H=1; force the inherited blocker through an unsupported forged policy row to prove no bypass is created here.
  const unsupported = Object.freeze({ ...bad, operationId: 'BAD-HANGER-PARTIAL', policyAuthority: CII_WRITER_2_HANGER_PARTIAL_MULTI_DELETE_BLOCKER });
  assert.throws(() => applyCiiWriter2CompositeWithHangerDeleteAll({ targetDocument: before, targetGraph: targetGraph(), transferPlan: transferPlan([unsupported]) }),
    /CII_WRITER_2_HANGER_DELETE_POLICY_REQUIRED|CII_WRITER_2_HANGER_DELETE_ALL_BLOCKED/);
}

console.log('Writer2 tri-family one-original-preimage composite covers NODENAME growth, SIF shrinkage, HANGER delete-all, overlap arbitration and independent full-postimage validation.');
