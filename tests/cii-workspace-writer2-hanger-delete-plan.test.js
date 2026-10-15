import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createCiiPhysicalFile } from '../tabs/cii-workspace/cii-workspace-physical-file.js';
import { intakeCiiWorkspaceDocument } from '../tabs/cii-workspace/cii-workspace-intake.js';
import { buildCiiHangerEvidence, CII_HANGER_LAYOUTS } from '../tabs/cii-workspace/cii-workspace-hanger.js';
import {
  applyCiiWriter2HangerDeletePlanContract, buildCiiWriter2HangerDeletePlan,
  CII_WRITER_2_HANGER_CREATE_BLOCKER, CII_WRITER_2_HANGER_DELETE_POLICY,
  CII_WRITER_2_HANGER_PARTIAL_MULTI_DELETE_BLOCKER,
} from '../tabs/cii-workspace/cii-workspace-writer2-hanger-delete.js';
import { applyCiiWriter2HangerDeleteAll } from '../tabs/cii-workspace/cii-workspace-writer2-hanger-delete-all-write.js';
import { CII_WRITER_2_HANGER_RECORD_BINDING_AUTHORITY } from '../tabs/cii-workspace/cii-workspace-writer2-hanger-record-binding.js';

const WIDTHS = [15, 13, 13, 13, 13, 13];
function numericRow(values) { return values.map((value, index) => String(value ?? '').padStart(WIDTHS[index] || 13, ' ')).join(''); }
function packedIntegerRow(values) { return `  ${values.map((value) => String(value).padStart(13, ' ')).join('')}`; }
function control(numelt, nohgrs, numnoz = 0) {
  return [numericRow([numelt, numnoz, nohgrs, 0, 0, 0]), numericRow([0, 0, 0, 0, 0, 0]),
    numericRow([0, 0, 0, 0, 0, 0]), numericRow([0])];
}
function executionRows() { return [numericRow([0, 0, 0, 2, 0, 1]), numericRow([0, 0, 21, 21, 0, 0]), numericRow([0, 0, 0, 0, 0, 3]), numericRow([3])]; }
function hangerRows(node, index) {
  const hgrdat = [numericRow([100 + index, 25, 0, 0, 0, 0]), numericRow([0, 9999, index, 0, 0])];
  const tagGuid = [`       ${String(`H${node}`).length.toString().padStart(5, ' ')} H${node}`, '           0 '];
  return { hgrdat, tagGuid };
}
function canonicalTarget(nodes, tailOrder = 'INTERLEAVED', mutate = null) {
  const count = nodes.length; const elementCount = Math.max(1, count);
  const rrmat = [numericRow(Array.from({ length: elementCount }, () => 106))];
  const defaults = [numericRow([1, 25, 0, 9999, 1, 1]), packedIntegerRow([1, 0, 1, 1, 1])];
  const records = nodes.map((node, index) => hangerRows(node, index));
  const hgrdatTagGuid = tailOrder === 'INTERLEAVED'
    ? records.flatMap((record) => [...record.hgrdat, ...record.tagGuid])
    : [...records.flatMap((record) => record.hgrdat), ...records.flatMap((record) => record.tagGuid)];
  const free = nodes.map((node, index) => packedIntegerRow([node, 0, index + 1, 0]));
  const packed = [
    packedIntegerRow(nodes.map((_, index) => index + 10)),
    packedIntegerRow(nodes.map((_, index) => index + 20)),
    packedIntegerRow(nodes.map((_, index) => index + 30)),
    packedIntegerRow(nodes.map((_, index) => index + 40)),
  ];
  if (mutate === 'BAD_IHGRNUM_PREFIX') packed[0] = `X ${packed[0].slice(2)}`;
  if (mutate === 'BAD_TAIL_SHAPE') hgrdatTagGuid[4] = '       6 FORGED';
  if (mutate === 'BAD_IHGRFREE_PREFIX') free[1] = `X ${free[1].slice(2)}`;
  const body = ['#$ CONTROL', ...control(elementCount, count), '#$ MISCEL_1', ...rrmat, ...defaults,
    packedIntegerRow(nodes), ...hgrdatTagGuid, ...free, ...packed, ...executionRows()].join('\r\n') + '\r\n';
  const parsed = Object.freeze({
    elements: Object.freeze(Array.from({ length: elementCount }, (_, index) => Object.freeze({ index, from: 10 + index * 10, to: 20 + index * 10 }))),
    nodes: Object.freeze(Object.fromEntries([...new Set([10, 20, 30, 40, 50, ...nodes])].map((node) => [String(node), Object.freeze({})]))),
  });
  const physicalFile = createCiiPhysicalFile(new TextEncoder().encode(body));
  const hangerEvidence = buildCiiHangerEvidence(physicalFile.text, parsed);
  return Object.freeze({ physicalFile, writer1CByteEligible: true, hangerEvidence, parsed });
}
function inputXmlCurrentTarget(node = 20) {
  const body = ['#$ CONTROL', ...control(1, 1), '#$ MISCEL_1', numericRow([106]),
    numericRow([1, 25, 0, 9999, 1, 1]), packedIntegerRow([1, 0, 1, 1, 1]),
    numericRow([0, 25, 0, 0, 0, 0]), numericRow([0, 9999, 0, 0, 0]), '           0 ', '           0 ', packedIntegerRow([0, 0, 0, 0]),
    packedIntegerRow([node]), packedIntegerRow([0]), packedIntegerRow([1]), packedIntegerRow([0]), packedIntegerRow([0]), ...executionRows()].join('\r\n') + '\r\n';
  const parsed = Object.freeze({ elements: Object.freeze([Object.freeze({ index: 0, from: 10, to: 20 })]), nodes: Object.freeze({ 10: Object.freeze({}), 20: Object.freeze({}) }) });
  const physicalFile = createCiiPhysicalFile(new TextEncoder().encode(body));
  const hangerEvidence = buildCiiHangerEvidence(physicalFile.text, parsed);
  return Object.freeze({ physicalFile, writer1CByteEligible: true, hangerEvidence, parsed });
}
function hangerOperation(node, source, target, id = `HANGER-${node}`) {
  return Object.freeze({
    operationId: id, family: 'HANGER', property: 'Hanger presence', action: source ? 'CREATE' : 'DELETE', status: 'PREVIEW_READY', blockers: Object.freeze([]),
    evidenceAuthority: 'CONTROL_NOHGRS_PLUS_MISCEL_1_IHGRNODE',
    sourceEvidence: Object.freeze({ identity: `SRC-${node}`, value: source, authority: 'CONTROL_NOHGRS_PLUS_MISCEL_1_IHGRNODE' }),
    targetEvidence: Object.freeze({ identity: String(node), value: target }), before: target, proposed: source,
    matchAuthority: Object.freeze({ status: 'REVIEWED' }),
  });
}
function rawPlan(operations, blockers = ['NO_TRANSFERABLE_PREVIEW_OPERATIONS']) {
  return Object.freeze({ status: blockers.length ? 'BLOCKED' : 'PREVIEW_READY', blockers: Object.freeze(blockers),
    mutationAuthority: 'WRITER_1B_CONDITIONAL', sourceDocument: Object.freeze({ contentSha256: 'source' }), targetDocument: Object.freeze({ contentSha256: 'target' }),
    operations: Object.freeze(operations), policy: Object.freeze({ hangerMutation: 'BLOCKED' }) });
}
function bound(contracted, decisions = () => 'APPLY') {
  const operations = []; const excludedOperations = [];
  for (const operation of contracted.operations) {
    if (operation.action === 'KEEP') { operations.push(Object.freeze({ ...operation, scopeDecision: 'KEEP' })); continue; }
    if (decisions(operation) === 'APPLY') operations.push(Object.freeze({ ...operation, scopeDecision: 'APPLY' }));
    else excludedOperations.push(Object.freeze({ ...operation, scopeDecision: 'EXCLUDE' }));
  }
  return Object.freeze({ ...contracted, status: 'PREVIEW_READY', blockers: Object.freeze([]), operations: Object.freeze(operations), excludedOperations: Object.freeze(excludedOperations),
    transferScope: Object.freeze({ status: 'BOUND' }) });
}

// PR1024 + PR1025: both known H>1 tail layouts have exact per-record positional custody, so partial planner compaction is eligible.
for (const tailOrder of ['INTERLEAVED', 'GROUPED']) {
  const target = canonicalTarget([20, 30, 40], tailOrder);
  assert.equal(target.hangerEvidence.status, 'QUALIFIED');
  assert.equal(target.hangerEvidence.layout, CII_HANGER_LAYOUTS.SYNCHRONIZER);
  const contracted = applyCiiWriter2HangerDeletePlanContract(rawPlan([hangerOperation(30, false, true)]));
  const transferPlan = bound(contracted);
  const plan = buildCiiWriter2HangerDeletePlan({ targetDocument: target, transferPlan });
  assert.equal(plan.ready, true, plan.blockers.join('|'));
  assert(!plan.blockers.includes(CII_WRITER_2_HANGER_PARTIAL_MULTI_DELETE_BLOCKER));
  assert.equal(plan.compaction.partialRecordCompactionAuthorized, true);
  assert.equal(plan.compaction.plannerPartialRecordAuthority, true);
  assert.equal(plan.compaction.physicalPartialWriteAuthority, false);
  assert.equal(plan.compaction.physicalWriterScope, 'DELETE_ALL_ONLY_UNCHANGED');
  assert.equal(plan.compaction.tailOrderAuthority, CII_WRITER_2_HANGER_RECORD_BINDING_AUTHORITY);
  assert.deepEqual(plan.oldToNewRecordIndex, { 1: 1, 2: 0, 3: 2 });
  assert.deepEqual(plan.compaction.retainedOpaqueHgrdatTagGuidRecordIndices, [1, 3]);
  assert.deepEqual(plan.compaction.retainedIhgrfreeRecordIndices, [1, 3]);
  assert.deepEqual(plan.compaction.retainedHgrdatTagGuidRowIndices,
    tailOrder === 'INTERLEAVED' ? [1, 2, 3, 4, 9, 10, 11, 12] : [1, 2, 5, 6, 7, 8, 11, 12]);
  assert.equal(plan.physicalCustody.recordBinding.status, 'QUALIFIED');
  assert.equal(plan.physicalCustody.recordBinding.records[1].recordIndex, 2);
  assert.equal(plan.physicalCustody.recordBinding.records[1].node, '30');
  assert.equal(plan.physicalCustody.recordBinding.records[1].ihgrfree.recordIndex, 2);
  for (const field of Object.values(plan.physicalCustody.recordBinding.records[1].packed)) assert.equal(field.valueIndex, 2);
  assert.throws(() => applyCiiWriter2HangerDeleteAll({ targetDocument: target, transferPlan }), /CII_WRITER_2_HANGER_DELETE_ALL_SCOPE_REQUIRED/,
    'planner authority must not leak into the delete-all physical writer');
}

// A tail envelope that matches neither qualified physical order keeps the stable partial-H>1 blocker.
{
  const target = canonicalTarget([20, 30, 40], 'INTERLEAVED', 'BAD_TAIL_SHAPE');
  const contracted = applyCiiWriter2HangerDeletePlanContract(rawPlan([hangerOperation(30, false, true)]));
  const plan = buildCiiWriter2HangerDeletePlan({ targetDocument: target, transferPlan: bound(contracted) });
  assert.equal(plan.ready, false);
  assert(plan.blockers.includes(CII_WRITER_2_HANGER_PARTIAL_MULTI_DELETE_BLOCKER));
  assert(plan.blockers.some((item) => item.includes('WRITER_2_HANGER_TAIL_ROW_SHAPE_UNQUALIFIED')));
  assert.equal(plan.physicalCustody.recordBinding.status, 'BLOCKED');
  assert.equal(plan.compaction.partialRecordCompactionAuthorized, false);
}

// IHGRFREE is part of the same positional record binding; corrupting one retained/deleted row blocks partial authority.
{
  const target = canonicalTarget([20, 30, 40], 'INTERLEAVED', 'BAD_IHGRFREE_PREFIX');
  const contracted = applyCiiWriter2HangerDeletePlanContract(rawPlan([hangerOperation(30, false, true)]));
  const plan = buildCiiWriter2HangerDeletePlan({ targetDocument: target, transferPlan: bound(contracted) });
  assert.equal(plan.ready, false);
  assert(plan.blockers.includes(CII_WRITER_2_HANGER_PARTIAL_MULTI_DELETE_BLOCKER));
  assert(plan.blockers.some((item) => item.includes('WRITER_2_HANGER_IHGRFREE_PREFIX_REQUIRED:2')));
}

// Delete-all remains independent of per-record tail/IHGRFREE classification because no hanger record is retained.
for (const mutate of ['BAD_TAIL_SHAPE', 'BAD_IHGRFREE_PREFIX']) {
  const target = canonicalTarget([20, 30, 40], 'INTERLEAVED', mutate);
  const contracted = applyCiiWriter2HangerDeletePlanContract(rawPlan([
    hangerOperation(20, false, true), hangerOperation(30, false, true), hangerOperation(40, false, true),
  ]));
  const plan = buildCiiWriter2HangerDeletePlan({ targetDocument: target, transferPlan: bound(contracted) });
  assert.equal(plan.ready, true, plan.blockers.join('|'));
  assert.equal(plan.compaction.deleteAll, true);
  assert.equal(plan.countAfter, 0);
}

// Normal delete-all still does not require retained record ordering: complete hanger payload is removed.
for (const tailOrder of ['INTERLEAVED', 'GROUPED']) {
  const target = canonicalTarget([20, 30, 40], tailOrder);
  const contracted = applyCiiWriter2HangerDeletePlanContract(rawPlan([
    hangerOperation(20, false, true), hangerOperation(30, false, true), hangerOperation(40, false, true),
  ]));
  const plan = buildCiiWriter2HangerDeletePlan({ targetDocument: target, transferPlan: bound(contracted) });
  assert.equal(plan.ready, true, plan.blockers.join('|'));
  assert.equal(plan.countBefore, 3); assert.equal(plan.countAfter, 0);
  assert.deepEqual(plan.deletedRecordIndices, [1, 2, 3]);
  assert.deepEqual(plan.oldToNewRecordIndex, { 1: 0, 2: 0, 3: 0 });
  assert.equal(plan.compaction.deleteAll, true);
  assert.equal(plan.compaction.tailOrderAuthority, 'NOT_REQUIRED_FOR_AUTHORIZED_DELETE');
  assert.equal(plan.compaction.expectedMiscelRowsAfter, 5, '3 elements => one RRMAT row + four execution rows');
}

// Packed arrays are canonical 2X + 13-byte integer fields; a forged prefix blocks base physical custody.
{
  const target = canonicalTarget([20], 'INTERLEAVED', 'BAD_IHGRNUM_PREFIX');
  const contracted = applyCiiWriter2HangerDeletePlanContract(rawPlan([hangerOperation(20, false, true)]));
  const plan = buildCiiWriter2HangerDeletePlan({ targetDocument: target, transferPlan: bound(contracted) });
  assert.equal(plan.ready, false);
  assert(plan.blockers.some((item) => item.startsWith('WRITER_2_HANGER_PACKED_PREFIX_REQUIRED:IHGRNUM:')));
}

// CREATE remains blocked because complete hanger construction/default semantics are not qualified.
{
  const create = applyCiiWriter2HangerDeletePlanContract(rawPlan([hangerOperation(20, true, false)]));
  assert.equal(create.operations[0].action, 'CREATE');
  assert.equal(create.operations[0].status, 'BLOCKED');
  assert(create.operations[0].blockers.includes(CII_WRITER_2_HANGER_CREATE_BLOCKER));
}

// Alternate INPUTXML_CURRENT physical layout is read-compatible but not Writer2-delete-authorized.
{
  const target = inputXmlCurrentTarget(20);
  assert.equal(target.hangerEvidence.status, 'QUALIFIED');
  assert.equal(target.hangerEvidence.layout, CII_HANGER_LAYOUTS.INPUTXML_CURRENT);
  const contracted = applyCiiWriter2HangerDeletePlanContract(rawPlan([hangerOperation(20, false, true)]));
  const plan = buildCiiWriter2HangerDeletePlan({ targetDocument: target, transferPlan: bound(contracted) });
  assert.equal(plan.ready, false);
  assert(plan.blockers.some((item) => item.startsWith('WRITER_2_HANGER_CANONICAL_LAYOUT_REQUIRED:')));
}

// Real CAESAR benchmark custody: the one existing hanger at node 205 remains delete-all and unchanged by partial-H>1 authority.
{
  const bytes = new Uint8Array(await readFile(new URL('../Benchmark/CIICompare/BM_CII_SOURCE.CII', import.meta.url)));
  const target = await intakeCiiWorkspaceDocument(bytes, 'BM_CII_SOURCE.CII', { side: 'TARGET', cryptoRef: webcrypto });
  assert.equal(target.hangerEvidence.status, 'QUALIFIED');
  assert.equal(target.hangerEvidence.layout, CII_HANGER_LAYOUTS.SYNCHRONIZER);
  assert.equal(target.hangerEvidence.count, 1);
  assert.deepEqual(target.hangerEvidence.nodes, ['205']);
  const contracted = applyCiiWriter2HangerDeletePlanContract(rawPlan([hangerOperation(205, false, true)]));
  const plan = buildCiiWriter2HangerDeletePlan({ targetDocument: target, transferPlan: bound(contracted) });
  assert.equal(plan.ready, true, plan.blockers.join('|'));
  assert.equal(plan.countBefore, 1); assert.equal(plan.countAfter, 0);
  assert.deepEqual(plan.deletedRecordIndices, [1]);
  assert.deepEqual(plan.oldToNewRecordIndex, { 1: 0 });
  assert.equal(plan.physicalCustody.rrmatRows, 7);
  assert.equal(plan.physicalCustody.nozzleRows, 0);
  assert.equal(plan.physicalCustody.expectedRowCount, 23);
  assert.equal(plan.physicalCustody.tailOrderAuthority, 'ORDER_EQUIVALENT_FOR_SINGLE_RECORD');
  assert.equal(plan.compaction.expectedMiscelRowsAfter, 11);
  assert.equal(plan.compaction.hangerHeaderRowsRetained, false);
}

console.log('Writer2 HANGER DELETE planner qualifies partial H>1 record custody while physical delete-all authority stays unchanged.');
