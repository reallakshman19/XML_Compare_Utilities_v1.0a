import assert from 'node:assert/strict';
import {
  applyCiiWriter2SifDeletePlanContract, buildCiiWriter2SifDeleteRelocationPlan,
  CII_WRITER_2_SIF_CREATE_BLOCKER, CII_WRITER_2_SIF_DELETE_POLICY,
} from '../tabs/cii-workspace/cii-workspace-writer2-sif-delete.js';

function operation({ id, elementId, source = false, target = true, action = 'DELETE', status = 'BLOCKED', blockers = ['SIF_TEE_DELETE_REQUIRES_WRITER_2'] }) {
  return Object.freeze({ operationId: id, family: 'SIF_TEE', property: 'SIF/Tee record presence', action, status,
    blockers: Object.freeze(blockers), evidenceAuthority: 'ELEMENT_POINTER_TO_SIF_TEES_RAW_RECORD',
    sourceEvidence: Object.freeze({ identity: `SRC-${elementId}`, value: source, authority: 'ELEMENT_POINTER_TO_SIF_TEES_RAW_RECORD' }),
    targetEvidence: Object.freeze({ identity: elementId, value: target }), before: target, proposed: source,
    matchAuthority: Object.freeze({ status: 'REVIEWED' }) });
}
function rawPlan(operations, blockers = ['NO_TRANSFERABLE_PREVIEW_OPERATIONS']) {
  return Object.freeze({ status: blockers.length ? 'BLOCKED' : 'PREVIEW_READY', blockers: Object.freeze(blockers),
    operations: Object.freeze(operations), policy: Object.freeze({ sifTeeMutation: 'BLOCKED_EXCEPT_WRITER_1C_V11_ITEM3_ITEM4' }) });
}
function pointerField(index, qualified = true) {
  return Object.freeze({ qualified, width: 13, byteStart: 1000 + index * 100, byteEnd: 1013 + index * 100,
    rawField: String(index + 1).padStart(13, ' ') });
}
function binding(index, pointer, qualified = true) {
  return Object.freeze({ parsedElementIndex: index, blockIndex: index, from: String(index * 10 + 10), to: String(index * 10 + 20),
    pointer, pointerField: pointerField(index, qualified), bindingAuthority: 'EXACT_PARSED_INDEX_AND_ENDPOINTS' });
}
function graph(count = 3) {
  return Object.freeze({ edges: Object.freeze(Array.from({ length: count }, (_, index) => Object.freeze({
    elementId: `E${index + 1}`, parsedElementIndex: index, from: String(index * 10 + 10), to: String(index * 10 + 20),
  }))) });
}
function targetDocument({ pointers = [1, 2, 3], sharedOwners = null, version = 11, qualifiedFields = {} } = {}) {
  const bindings = Object.fromEntries(pointers.map((pointer, index) => [String(index), binding(index, pointer, qualifiedFields[index] !== false)]));
  const byPointer = {};
  for (let pointer = 1; pointer <= Math.max(0, ...pointers); pointer += 1) {
    const ownerIndexes = sharedOwners?.[pointer] ?? pointers.map((value, index) => value === pointer ? index : null).filter((value) => value != null);
    byPointer[String(pointer)] = Object.freeze({ pointer, owners: Object.freeze(ownerIndexes.map((index) => bindings[String(index)])) });
  }
  return Object.freeze({ writer1CByteEligible: true, sifWriter1CEvidence: Object.freeze({
    status: 'QUALIFIED', neutralVersion: Object.freeze({ major: version }), blockRows: 10,
    controlBlockCount: Math.max(0, ...pointers), sectionRowCount: Math.max(0, ...pointers) * 10,
    byParsedElementIndex: Object.freeze(bindings), byPointer: Object.freeze(byPointer),
  }) });
}
function bound(plan, applyIds) {
  const selected = new Set(applyIds);
  return Object.freeze({ ...plan, status: 'PREVIEW_READY', blockers: Object.freeze([]), transferScope: Object.freeze({ status: 'BOUND' }),
    operations: Object.freeze(plan.operations.map((item) => Object.freeze({ ...item, scopeDecision: selected.has(item.operationId) ? 'APPLY' : 'EXCLUDE' }))) });
}

{
  const routed = applyCiiWriter2SifDeletePlanContract(rawPlan([operation({ id: 'DEL-E2', elementId: 'E2' })]));
  assert.equal(routed.status, 'PREVIEW_READY');
  assert.equal(routed.operations[0].action, 'DELETE');
  assert.equal(routed.operations[0].status, 'PREVIEW_READY');
  assert.equal(routed.operations[0].policyAuthority, CII_WRITER_2_SIF_DELETE_POLICY);
  assert.equal(routed.policy.sifTeeMutation, 'V11_EXISTING_BLOCK_DELETE_REINDEX_ONLY');
}

{
  const create = applyCiiWriter2SifDeletePlanContract(rawPlan([operation({ id: 'CREATE-E2', elementId: 'E2', source: true, target: false, action: 'CREATE' })]));
  assert.equal(create.status, 'BLOCKED');
  assert.equal(create.operations[0].action, 'CREATE');
  assert(create.operations[0].blockers.includes(CII_WRITER_2_SIF_CREATE_BLOCKER));
}

{
  const contracted = applyCiiWriter2SifDeletePlanContract(rawPlan([operation({ id: 'DEL-E2', elementId: 'E2' })]));
  const plan = buildCiiWriter2SifDeleteRelocationPlan({ targetDocument: targetDocument(), targetGraph: graph(), transferPlan: bound(contracted, ['DEL-E2']) });
  assert.equal(plan.ready, true, plan.blockers.join('|'));
  assert.deepEqual(plan.deletedPointers, [2]);
  assert.deepEqual(plan.oldToNewPointer, { 1: 1, 2: 0, 3: 2 });
  assert.deepEqual(plan.pointerChanges.map((item) => [item.parsedElementIndex, item.oldPointer, item.newPointer]), [[1, 2, 0], [2, 3, 2]]);
  assert.equal(plan.controlCountBefore, 3);
  assert.equal(plan.controlCountAfter, 2);
  assert.equal(plan.createAuthority.ready, false);
  assert.equal(plan.createAuthority.blocker, CII_WRITER_2_SIF_CREATE_BLOCKER);
}

{
  const contracted = applyCiiWriter2SifDeletePlanContract(rawPlan([operation({ id: 'DEL-E1', elementId: 'E1' })]));
  const shared = targetDocument({ pointers: [1, 1, 2], sharedOwners: { 1: [0, 1], 2: [2] } });
  const plan = buildCiiWriter2SifDeleteRelocationPlan({ targetDocument: shared, targetGraph: graph(), transferPlan: bound(contracted, ['DEL-E1']) });
  assert.equal(plan.ready, false);
  assert(plan.blockers.some((item) => item.startsWith('WRITER_2_SIF_DELETE_UNAPPROVED_SHARED_POINTER:1:1')));
}

{
  const contracted = applyCiiWriter2SifDeletePlanContract(rawPlan([
    operation({ id: 'DEL-E1', elementId: 'E1' }), operation({ id: 'DEL-E2', elementId: 'E2' }),
  ]));
  const shared = targetDocument({ pointers: [1, 1, 2], sharedOwners: { 1: [0, 1], 2: [2] } });
  const plan = buildCiiWriter2SifDeleteRelocationPlan({ targetDocument: shared, targetGraph: graph(), transferPlan: bound(contracted, ['DEL-E1', 'DEL-E2']) });
  assert.equal(plan.ready, true, plan.blockers.join('|'));
  assert.deepEqual(plan.deletedPointers, [1]);
  assert.deepEqual(plan.pointerChanges.map((item) => [item.parsedElementIndex, item.oldPointer, item.newPointer]), [[0, 1, 0], [1, 1, 0], [2, 2, 1]]);
}

{
  const contracted = applyCiiWriter2SifDeletePlanContract(rawPlan([operation({ id: 'DEL-E2', elementId: 'E2' })]));
  const plan = buildCiiWriter2SifDeleteRelocationPlan({ targetDocument: targetDocument({ qualifiedFields: { 2: false } }), targetGraph: graph(), transferPlan: bound(contracted, ['DEL-E2']) });
  assert.equal(plan.ready, false);
  assert(plan.blockers.includes('WRITER_2_SIF_POINTER_FIELD_CUSTODY_REQUIRED:2'));
}

{
  const contracted = applyCiiWriter2SifDeletePlanContract(rawPlan([operation({ id: 'DEL-E2', elementId: 'E2' })]));
  const plan = buildCiiWriter2SifDeleteRelocationPlan({ targetDocument: targetDocument({ version: 12 }), targetGraph: graph(), transferPlan: bound(contracted, ['DEL-E2']) });
  assert.equal(plan.ready, false);
  assert(plan.blockers.includes('WRITER_2_SIF_V11_10_ROW_BLOCK_REQUIRED'));
}

console.log('Writer 2 V11 SIF block DELETE relocation authority and CREATE fail-closed gates passed.');
