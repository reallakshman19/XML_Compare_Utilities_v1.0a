import assert from 'node:assert/strict';
import { sha256CiiByteString } from '../tabs/cii-workspace/cii-workspace-byte-sha256.js';
import { createCiiPhysicalFile } from '../tabs/cii-workspace/cii-workspace-physical-file.js';
import {
  buildCiiWriter2RestraintDeleteCompactionPlan,
  CII_WRITER_2_RESTRAINT_CREATE_BLOCKER,
  CII_WRITER_2_RESTRAINT_DELETE_COMPACTION_POLICY,
  _test,
} from '../tabs/cii-workspace/cii-workspace-writer2-restraint-delete-compaction-plan.js';
import { CII_WRITER_2_RESTRAINT_POINTER_CUSTODY_AUTHORITY } from '../tabs/cii-workspace/cii-workspace-writer2-restraint-delete-custody.js';

function numericRow(values) {
  return `  ${values.map((value) => String(value).padStart(13, ' ')).join('')}`;
}
function textRow(value = '') { return `${String(value.length).padStart(12, ' ')} ${value}`; }
function slotRows(spec = null) {
  if (!spec) return [numericRow([0, 0, 0, 0, 0, 0]), numericRow([0, 0, 0]), textRow(), textRow()];
  return [
    numericRow([spec.node, spec.type ?? 1, spec.stiffness ?? 1751200000000, spec.gap ?? 0, spec.friction ?? 0, spec.connectingNode ?? 0]),
    numericRow(spec.cosines ?? [1, 0, 0]),
    textRow(spec.tag ?? ''),
    textRow(spec.guid ?? ''),
  ];
}
function blockRows(slots = {}, residues = {}) {
  const rows = [];
  for (let slot = 1; slot <= 6; slot += 1) {
    const current = slotRows(slots[slot] || null);
    if (!slots[slot] && residues[slot]) {
      current[2] = textRow(residues[slot].tag ?? '');
      current[3] = textRow(residues[slot].guid ?? '');
    }
    rows.push(...current);
  }
  return rows;
}
function elementRows(pointer, from, to) {
  const rows = [numericRow([from, to, 0, 0, 0, 0])];
  for (let index = 1; index < 12; index += 1) rows.push(numericRow([0, 0, 0, 0, 0, 0]));
  rows.push(numericRow([0, 0, 0, pointer, 0, 0]));
  rows.push(numericRow([0, 0, 0, 0, 0, 0]));
  rows.push(numericRow([0, 0, 0]));
  assert.equal(rows.length, 15);
  return rows;
}
function rawCii(blocks, pointers, endpoints, { controlCount = blocks.length, extraRestraintRows = [] } = {}) {
  const rows = [
    '#$ VERSION',
    numericRow([5, 11, 1256]),
    '#$ CONTROL',
    numericRow([10, 0, 0, 0, 0, 0]),
    numericRow([0, 0, 0, controlCount, 0, 0]),
    numericRow([0, 0, 0, 1, 0, 0]),
    numericRow([0]),
    '#$ ELEMENTS',
  ];
  pointers.forEach((pointer, index) => {
    const pair = endpoints[index];
    rows.push(...elementRows(pointer, pair[0], pair[1]));
  });
  rows.push('#$ RESTRANT');
  for (const block of blocks) rows.push(...blockRows(block.slots || {}, block.residues || {}));
  rows.push(...extraRestraintRows, '#$ DISPLMNT', '');
  return rows.join('\n');
}
function slotStateFromSpec(pointer, slot, spec) {
  return Object.freeze({
    pointer, slot,
    line1: Object.freeze([Number(spec.node), Number(spec.type ?? 1), Number(spec.stiffness ?? 1751200000000),
      Number(spec.gap ?? 0), Number(spec.friction ?? 0), Number(spec.connectingNode ?? 0)]),
    line2: Object.freeze((spec.cosines ?? [1, 0, 0]).map(Number)),
    tag: spec.tag ?? '', guid: spec.guid ?? '', occupied: true,
  });
}
function targetDocument({
  blocks, pointers, endpoints = null, physicalEndpoints = null, parsedEndpoints = null,
  semanticPointers = null, semanticEndpoints = null,
  controlCount = blocks.length, extraRestraintRows = [], declaredHash = null,
} = {}) {
  const canonicalEndpoints = endpoints || pointers.map((_, index) => [String(index * 10 + 10), String(index * 10 + 20)]);
  const physicalPairs = physicalEndpoints || canonicalEndpoints;
  const parsedPairs = parsedEndpoints || canonicalEndpoints;
  const semanticPairs = semanticEndpoints || parsedPairs;
  const semantic = semanticPointers || pointers;
  const raw = rawCii(blocks, pointers, physicalPairs, { controlCount, extraRestraintRows });
  const physicalFile = createCiiPhysicalFile(new TextEncoder().encode(raw));
  const actual = sha256CiiByteString(physicalFile.originalByteString);
  const elements = {};
  const parsed = [];
  pointers.forEach((pointer, index) => {
    parsed.push(Object.freeze({ index, from: Number(parsedPairs[index][0]), to: Number(parsedPairs[index][1]) }));
    elements[String(index)] = Object.freeze({
      parsedElementIndex: index, from: semanticPairs[index][0], to: semanticPairs[index][1],
      pointers: Object.freeze({ restraint: semantic[index] }),
    });
  });
  return Object.freeze({
    contentSha256: declaredHash || actual,
    physicalFile,
    parsed: Object.freeze({ elements: Object.freeze(parsed) }),
    auxiliaryEvidence: Object.freeze({
      restraints: Object.freeze({
        authority: 'PROTECTED_WRITER_RESTRANT_BLOCK_INDEX_24_ROWS',
        blockRows: 24, sectionRowCount: blocks.length * 24 + extraRestraintRows.length,
      }),
      elements: Object.freeze(elements),
    }),
  });
}
function clearOperation({ id, pointer, slot = 1, targetNode, spec, action = 'DELETE', scopeDecision = 'APPLY' }) {
  const mutation = Object.freeze({
    schema: 'CIIWorkspaceRestraintSlotMutation.v1', status: 'QUALIFIED', mode: action === 'DELETE' ? 'CLEAR' : 'CREATE',
    authority: action === 'DELETE'
      ? 'PROTECTED_WRITER_EXISTING_24_ROW_BLOCK_EMPTY_SLOT_TEMPLATE'
      : 'PROTECTED_WRITER_EXISTING_24_ROW_BLOCK_FREE_SLOT',
    pointer, slot, targetNode: String(targetNode), beforeSlot: action === 'DELETE' ? slotStateFromSpec(pointer, slot, spec) : null,
  });
  return Object.freeze({
    operationId: id, family: 'RESTRAINT', property: 'Qualified restraint slot mutation', action,
    status: 'PREVIEW_READY', policyAuthority: 'CII_WRITER_1B_EXISTING_BLOCK_FIXED_SLOT',
    matchAuthority: Object.freeze({ status: 'REVIEWED' }),
    sourceEvidence: Object.freeze({ value: mutation }), proposed: mutation, scopeDecision,
  });
}
function transferPlan(target, operations, excludedOperations = []) {
  const applied = operations.filter((item) => item.scopeDecision === 'APPLY' && item.action !== 'KEEP').map((item) => item.operationId).sort();
  const excluded = excludedOperations.filter((item) => item.scopeDecision === 'EXCLUDE' && item.action !== 'KEEP').map((item) => item.operationId).sort();
  const sourceHash = '1'.repeat(64);
  return Object.freeze({
    status: 'PREVIEW_READY', blockers: Object.freeze([]),
    sourceDocument: Object.freeze({ contentSha256: sourceHash }),
    targetDocument: Object.freeze({ contentSha256: target.contentSha256 }),
    operations: Object.freeze(operations), excludedOperations: Object.freeze(excludedOperations),
    transferScope: Object.freeze({
      status: 'BOUND', mode: 'EXPLICIT_APPLY_EXCLUDE', authority: 'USER_EXPLICIT_OPERATION_SCOPE', scopeId: 'scope-1',
      sourceSha256: sourceHash, targetSha256: target.contentSha256,
      appliedOperationIds: Object.freeze(applied), excludedOperationIds: Object.freeze(excluded),
      candidateOperationIds: Object.freeze([...applied, ...excluded].sort()),
    }),
  });
}
function occupied(node, overrides = {}) { return Object.freeze({ node, type: 1, cosines: [1, 0, 0], ...overrides }); }
function plan(target, operations, excluded = []) {
  return buildCiiWriter2RestraintDeleteCompactionPlan({ targetDocument: target, transferPlan: transferPlan(target, operations, excluded) });
}
function expectBlocked(result, prefix) {
  assert.equal(result.ready, false);
  assert(result.blockers.some((item) => String(item).startsWith(prefix)), `${prefix}\n${result.blockers.join('\n')}`);
}
function three() {
  const specs = [occupied(10), occupied(30), occupied(50)];
  const endpoints = [['10','20'],['30','40'],['50','60']];
  return { specs, endpoints, target: targetDocument({ blocks: specs.map((spec) => ({ slots: { 1: spec } })), pointers: [1,2,3], endpoints }) };
}

{
  const spec = occupied(10);
  const target = targetDocument({ blocks: [{ slots: { 1: spec } }], pointers: [1], endpoints: [['10','20']] });
  const result = plan(target, [clearOperation({ id: 'D01', pointer: 1, targetNode: 10, spec })]);
  assert.equal(result.ready, true, result.blockers.join('|'));
  assert.equal(result.authority, CII_WRITER_2_RESTRAINT_DELETE_COMPACTION_POLICY);
  assert.equal(result.pointerCustody.status, 'QUALIFIED');
  assert.equal(result.pointerCustody.authority, CII_WRITER_2_RESTRAINT_POINTER_CUSTODY_AUTHORITY);
  assert.equal(result.pointerCustody.byParsedElementIndex['0'].pointerField.width, 13);
  assert.deepEqual(result.oldToNewPointer, { 1: 0 });
  assert.equal(result.controlCountAfter, 0);
}
{
  const { specs, target } = three();
  assert.deepEqual(plan(target, [clearOperation({ id:'D02', pointer:1, targetNode:10, spec:specs[0] })]).oldToNewPointer, {1:0,2:1,3:2});
}
{
  const { specs, target } = three();
  assert.deepEqual(plan(target, [clearOperation({ id:'D03', pointer:2, targetNode:30, spec:specs[1] })]).oldToNewPointer, {1:1,2:0,3:2});
}
{
  const { specs, target } = three();
  assert.deepEqual(plan(target, [clearOperation({ id:'D04', pointer:3, targetNode:50, spec:specs[2] })]).oldToNewPointer, {1:1,2:2,3:0});
}
{
  const specs = [10,30,50,70,90].map(occupied);
  const endpoints = [['10','20'],['30','40'],['50','60'],['70','80'],['90','100']];
  const target = targetDocument({ blocks: specs.map((spec)=>({slots:{1:spec}})), pointers:[1,2,3,4,5], endpoints });
  const result = plan(target, [
    clearOperation({ id:'D05-A', pointer:2, targetNode:30, spec:specs[1] }),
    clearOperation({ id:'D05-B', pointer:4, targetNode:70, spec:specs[3] }),
  ]);
  assert.equal(result.ready, true, result.blockers.join('|'));
  assert.deepEqual(result.oldToNewPointer, {1:1,2:0,3:2,4:0,5:3});
}
{
  const a=occupied(10); const b=occupied(20);
  const target=targetDocument({blocks:[{slots:{1:a,2:b}}],pointers:[1],endpoints:[['10','20']]});
  expectBlocked(plan(target,[clearOperation({id:'D06',pointer:1,targetNode:10,spec:a})]),'WRITER_2_RESTRAINT_BLOCK_STILL_OCCUPIED:1:2');
}
{
  const spec=occupied(10);
  const target=targetDocument({blocks:[{slots:{1:spec},residues:{2:{tag:'RESIDUE'}}}],pointers:[1],endpoints:[['10','20']]});
  expectBlocked(plan(target,[clearOperation({id:'D07',pointer:1,targetNode:10,spec})]),'WRITER_2_RESTRAINT_BLOCK_METADATA_RESIDUE:1:2');
}
{
  const spec=occupied(10); const target=targetDocument({blocks:[{slots:{1:spec}}],pointers:[1],endpoints:[['10','20']]});
  const result=plan(target,[clearOperation({id:'D08',pointer:1,targetNode:999,spec})]);
  expectBlocked(result,'WRITER_2_RESTRAINT_DELETE_OWNER_NODE_CUSTODY_REQUIRED:1:999'); assert.deepEqual(result.deletedPointers,[]);
}
{
  const spec=occupied(10); const target=targetDocument({blocks:[{slots:{1:spec}}],pointers:[1,1],endpoints:[['10','20'],['30','40']]});
  expectBlocked(plan(target,[clearOperation({id:'D09',pointer:1,targetNode:10,spec})]),'WRITER_2_RESTRAINT_SHARED_POINTER_ALIAS_UNQUALIFIED:1:0,1');
}
{
  const spec=occupied(10); const target=targetDocument({blocks:[{slots:{1:spec}}],pointers:[2],endpoints:[['10','20']]});
  expectBlocked(plan(target,[clearOperation({id:'D10',pointer:1,targetNode:10,spec})]),'WRITER_2_RESTRAINT_POINTER_OUT_OF_RANGE:2');
}
{
  const spec=occupied(10); const target=targetDocument({blocks:[{slots:{1:spec}}],pointers:[1],endpoints:[['10','20']],controlCount:2});
  expectBlocked(plan(target,[clearOperation({id:'D11',pointer:1,targetNode:10,spec})]),'WRITER_2_RESTRAINT_CONTROL_BLOCK_COUNT_MISMATCH');
}
{
  const spec=occupied(10); const target=targetDocument({blocks:[{slots:{1:spec}}],pointers:[1],endpoints:[['10','20']],extraRestraintRows:[numericRow([0,0,0])]});
  expectBlocked(plan(target,[clearOperation({id:'D12',pointer:1,targetNode:10,spec})]),'WRITER_2_RESTRAINT_SECTION_ROW_COUNT_NOT_MULTIPLE_OF_24');
}
{
  const spec=occupied(10); const target=targetDocument({blocks:[{slots:{1:spec}}],pointers:[1],endpoints:[['10','20']],declaredHash:'0'.repeat(64)});
  expectBlocked(plan(target,[clearOperation({id:'D13',pointer:1,targetNode:10,spec})]),'WRITER_2_RESTRAINT_TARGET0_SHA256_MISMATCH');
}
{
  const spec=occupied(10); const target=targetDocument({blocks:[{slots:{1:spec}}],pointers:[1],endpoints:[['10','20']]});
  const result=plan(target,[clearOperation({id:'D14-A',pointer:1,targetNode:10,spec}),clearOperation({id:'D14-B',pointer:1,targetNode:10,spec})]);
  expectBlocked(result,'WRITER_2_RESTRAINT_DUPLICATE_SLOT_DELETE_CLAIM:1:1'); assert.deepEqual(result.deletedPointers,[]);
}
{
  const spec=occupied(10); const target=targetDocument({blocks:[{slots:{1:spec}}],pointers:[1],endpoints:[['10','20']]});
  const result=plan(target,[clearOperation({id:'D15',pointer:1,targetNode:10,spec,action:'CREATE'})]);
  expectBlocked(result,CII_WRITER_2_RESTRAINT_CREATE_BLOCKER); assert.equal(result.createAuthority.ready,false);
}
{
  const spec=occupied(10); const target=targetDocument({blocks:[{slots:{1:spec}}],pointers:[1],endpoints:[['10','20']]});
  expectBlocked(plan(target,[clearOperation({id:'D16',pointer:1,targetNode:10,spec,action:'CREATE'})]),CII_WRITER_2_RESTRAINT_CREATE_BLOCKER);
}
{
  const specs=[occupied(30),occupied(50)];
  const target=targetDocument({blocks:specs.map((spec)=>({slots:{1:spec}})),pointers:[0,1,2],endpoints:[['10','20'],['30','40'],['50','60']]});
  const result=plan(target,[clearOperation({id:'D17',pointer:1,targetNode:30,spec:specs[0]})]);
  assert.equal(result.ready,true,result.blockers.join('|'));
  assert(!result.pointerChanges.some((item)=>item.parsedElementIndex===0));
  assert.deepEqual(result.pointerChanges.map((item)=>[item.parsedElementIndex,item.oldPointer,item.newPointer]),[[1,1,0],[2,2,1]]);
}
{
  const spec=occupied(10); const target=targetDocument({blocks:[{slots:{1:spec}}],pointers:[1],endpoints:[['10','20']]});
  const excluded=clearOperation({id:'D18',pointer:1,targetNode:10,spec,scopeDecision:'EXCLUDE'});
  expectBlocked(buildCiiWriter2RestraintDeleteCompactionPlan({targetDocument:target,transferPlan:transferPlan(target,[],[excluded])}),
    'WRITER_2_RESTRAINT_DELETE_NO_MUTATIONS');
}
{
  const deleted=new Set([2,4]); const expected={};
  for(let oldPointer=1;oldPointer<=5;oldPointer+=1) expected[oldPointer]=deleted.has(oldPointer)?0:oldPointer-[...deleted].filter((value)=>value<oldPointer).length;
  assert.deepEqual(_test.pointerMapping(5,deleted),expected);
}
{
  const spec=occupied(10); const target=targetDocument({blocks:[{slots:{1:spec}}],pointers:[1],endpoints:[['10','20']]});
  const op=clearOperation({id:'H01',pointer:1,targetNode:10,spec}); const base=transferPlan(target,[op]);
  const forged=Object.freeze({...base,transferScope:Object.freeze({...base.transferScope,sourceSha256:'0'.repeat(64)})});
  expectBlocked(buildCiiWriter2RestraintDeleteCompactionPlan({targetDocument:target,transferPlan:forged}),'WRITER_2_RESTRAINT_SCOPE_SOURCE_HASH_MISMATCH');
}
{
  const spec=occupied(10); const target=targetDocument({blocks:[{slots:{1:spec}}],pointers:[1],endpoints:[['10','20']]});
  const op=clearOperation({id:'H02',pointer:1,targetNode:10,spec,scopeDecision:'EXCLUDE'});
  const malformed=Object.freeze({
    status:'PREVIEW_READY',blockers:Object.freeze([]),
    sourceDocument:Object.freeze({contentSha256:'1'.repeat(64)}),targetDocument:Object.freeze({contentSha256:target.contentSha256}),
    operations:Object.freeze([op]),excludedOperations:Object.freeze([]),
    transferScope:Object.freeze({status:'BOUND',mode:'EXPLICIT_APPLY_EXCLUDE',authority:'USER_EXPLICIT_OPERATION_SCOPE',scopeId:'scope-H02',
      sourceSha256:'1'.repeat(64),targetSha256:target.contentSha256,appliedOperationIds:Object.freeze([]),excludedOperationIds:Object.freeze([]),candidateOperationIds:Object.freeze([])}),
  });
  expectBlocked(buildCiiWriter2RestraintDeleteCompactionPlan({targetDocument:target,transferPlan:malformed}),'WRITER_2_RESTRAINT_SCOPE_APPLY_DECISION_REQUIRED:H02');
}
{
  const actual=occupied(10); const stale=occupied(11);
  const target=targetDocument({blocks:[{slots:{1:actual}}],pointers:[1],endpoints:[['10','20']]});
  const result=plan(target,[clearOperation({id:'H03',pointer:1,targetNode:10,spec:stale})]);
  expectBlocked(result,'WRITER_2_RESTRAINT_SLOT_PREIMAGE_MISMATCH:1:1'); assert.deepEqual(result.deletedPointers,[]); assert.deepEqual(result.pointerChanges,[]);
}
{
  const spec=occupied(10);
  const target=targetDocument({blocks:[{slots:{1:spec}}],pointers:[1],semanticPointers:[2],endpoints:[['10','20']]});
  const result=plan(target,[clearOperation({id:'H04',pointer:1,targetNode:10,spec})]);
  expectBlocked(result,'WRITER_2_RESTRAINT_AUXILIARY_POINTER_CROSSCHECK_REQUIRED:0');
  assert.deepEqual(result.pointerChanges,[]);
}
{
  const spec=occupied(10);
  const target=targetDocument({blocks:[{slots:{1:spec}}],pointers:[1],physicalEndpoints:[['10','20']],parsedEndpoints:[['30','40']],semanticEndpoints:[['30','40']]});
  const result=plan(target,[clearOperation({id:'H05',pointer:1,targetNode:30,spec})]);
  expectBlocked(result,'WRITER_2_RESTRAINT_EXACT_ELEMENT_ENDPOINT_BINDING_REQUIRED:0');
  assert.deepEqual(result.pointerChanges,[]);
}

console.log('Writer2 RESTRAINT block DELETE/compaction planner D01-D18 + H01-H05 passed.');