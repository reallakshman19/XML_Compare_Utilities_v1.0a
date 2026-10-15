import assert from 'node:assert/strict';
import { createCiiPhysicalFile } from '../tabs/cii-workspace/cii-workspace-physical-file.js';
import { sha256CiiByteString } from '../tabs/cii-workspace/cii-workspace-byte-sha256.js';
import { applyCiiWriter2RestraintDeleteCompaction } from '../tabs/cii-workspace/cii-workspace-writer2-restraint-delete-write.js';
import { validateCiiWriter2RestraintDeleteCompaction } from '../tabs/cii-workspace/cii-workspace-writer2-restraint-delete-validation.js';

export function numericRow(values) { return `  ${values.map((value) => String(value).padStart(13, ' ')).join('')}`; }
export function textRow(value = '') { return `${String(value.length).padStart(12, ' ')} ${value}`; }
function slotRows(spec = null) {
  if (!spec) return [numericRow([0,0,0,0,0,0]), numericRow([0,0,0]), textRow(), textRow()];
  return [numericRow([spec.node, spec.type ?? 1, spec.stiffness ?? 1751200000000, spec.gap ?? 0, spec.friction ?? 0, spec.connectingNode ?? 0]),
    numericRow(spec.cosines ?? [1,0,0]), textRow(spec.tag ?? ''), textRow(spec.guid ?? '')];
}
function blockRows(slots = {}, residues = {}) {
  const rows = [];
  for (let slot = 1; slot <= 6; slot += 1) {
    const current = slotRows(slots[slot] || null);
    if (!slots[slot] && residues[slot]) { current[2] = textRow(residues[slot].tag ?? ''); current[3] = textRow(residues[slot].guid ?? ''); }
    rows.push(...current);
  }
  return rows;
}
function elementRows(pointer, from, to) {
  const rows = [numericRow([from,to,0,0,0,0])];
  for (let index = 1; index < 12; index += 1) rows.push(numericRow([0,0,0,0,0,0]));
  rows.push(numericRow([0,0,0,pointer,0,0]), numericRow([0,0,0,0,0,0]), numericRow([0,0,0]));
  assert.equal(rows.length, 15); return rows;
}
function rawCii(blocks, pointers, endpoints, { controlCount = blocks.length } = {}) {
  const rows = ['#$ VERSION', numericRow([5,11,1256]), '#$ CONTROL',
    numericRow([10,0,0,0,0,0]),
    numericRow([0,0,0,controlCount,0,0]),
    numericRow([0,0,0,1,0,0]), numericRow([0]), '#$ ELEMENTS'];
  pointers.forEach((pointer, index) => rows.push(...elementRows(pointer, endpoints[index][0], endpoints[index][1])));
  rows.push('#$ RESTRANT');
  for (const block of blocks) rows.push(...blockRows(block.slots || {}, block.residues || {}));
  rows.push('#$ DISPLMNT', ''); return rows.join('\n');
}
function slotState(pointer, slot, spec) {
  return Object.freeze({ pointer, slot,
    line1:Object.freeze([Number(spec.node),Number(spec.type ?? 1),Number(spec.stiffness ?? 1751200000000),Number(spec.gap ?? 0),Number(spec.friction ?? 0),Number(spec.connectingNode ?? 0)]),
    line2:Object.freeze((spec.cosines ?? [1,0,0]).map(Number)), tag:spec.tag ?? '', guid:spec.guid ?? '', occupied:true });
}
export function occupied(node, overrides={}) { return Object.freeze({node,type:1,cosines:[1,0,0],...overrides}); }
export function targetDocument({ blocks, pointers, endpoints, semanticPointers = null, controlCount = blocks.length, declaredHash = null } = {}) {
  const raw=rawCii(blocks,pointers,endpoints,{controlCount}); const physicalFile=createCiiPhysicalFile(new TextEncoder().encode(raw));
  const actual=sha256CiiByteString(physicalFile.originalByteString); const parsed=[]; const elements={};
  pointers.forEach((pointer,index)=>{ parsed.push(Object.freeze({index,from:Number(endpoints[index][0]),to:Number(endpoints[index][1])}));
    elements[String(index)]=Object.freeze({parsedElementIndex:index,from:endpoints[index][0],to:endpoints[index][1],pointers:Object.freeze({restraint:(semanticPointers || pointers)[index]})}); });
  return Object.freeze({contentSha256:declaredHash || actual,byteLength:physicalFile.byteLength,physicalFile,parsed:Object.freeze({elements:Object.freeze(parsed)}),
    auxiliaryEvidence:Object.freeze({restraints:Object.freeze({authority:'PROTECTED_WRITER_RESTRANT_BLOCK_INDEX_24_ROWS',blockRows:24,sectionRowCount:blocks.length*24}),elements:Object.freeze(elements)})});
}
export function clearOperation({ id, pointer, targetNode, spec, slot = 1, action = 'DELETE', scopeDecision = 'APPLY' }) {
  const mutation=Object.freeze({schema:'CIIWorkspaceRestraintSlotMutation.v1',status:'QUALIFIED',mode:action==='DELETE'?'CLEAR':'CREATE',
    authority:action==='DELETE'?'PROTECTED_WRITER_EXISTING_24_ROW_BLOCK_EMPTY_SLOT_TEMPLATE':'PROTECTED_WRITER_EXISTING_24_ROW_BLOCK_FREE_SLOT',
    pointer,slot,targetNode:String(targetNode),beforeSlot:action==='DELETE'?slotState(pointer,slot,spec):null});
  return Object.freeze({operationId:id,family:'RESTRAINT',property:'Qualified restraint slot mutation',action,status:'PREVIEW_READY',policyAuthority:'CII_WRITER_1B_EXISTING_BLOCK_FIXED_SLOT',
    matchAuthority:Object.freeze({status:'REVIEWED'}),sourceEvidence:Object.freeze({value:mutation}),proposed:mutation,scopeDecision});
}
export function transferPlan(target, operations, excludedOperations = []) {
  const applied=operations.filter((item)=>item.scopeDecision==='APPLY'&&item.action!=='KEEP').map((item)=>item.operationId).sort();
  const excluded=excludedOperations.filter((item)=>item.scopeDecision==='EXCLUDE'&&item.action!=='KEEP').map((item)=>item.operationId).sort(); const sourceHash='1'.repeat(64);
  return Object.freeze({status:'PREVIEW_READY',blockers:Object.freeze([]),sourceDocument:Object.freeze({contentSha256:sourceHash}),targetDocument:Object.freeze({contentSha256:target.contentSha256}),
    operations:Object.freeze(operations),excludedOperations:Object.freeze(excludedOperations),transferScope:Object.freeze({status:'BOUND',mode:'EXPLICIT_APPLY_EXCLUDE',authority:'USER_EXPLICIT_OPERATION_SCOPE',scopeId:'scope-w211',sourceSha256:sourceHash,targetSha256:target.contentSha256,
      appliedOperationIds:Object.freeze(applied),excludedOperationIds:Object.freeze(excluded),candidateOperationIds:Object.freeze([...applied,...excluded].sort())})});
}
function bytesFromByteString(value){const out=new Uint8Array(value.length);for(let i=0;i<value.length;i+=1)out[i]=value.charCodeAt(i)&0xff;return out;}
export function afterDocumentFromByteString(value){const physicalFile=createCiiPhysicalFile(bytesFromByteString(value));return Object.freeze({contentSha256:sha256CiiByteString(physicalFile.originalByteString),byteLength:physicalFile.byteLength,textLength:physicalFile.text.length,physicalFile});}
export function applyAndValidate(target,operations,excluded=[]){const tp=transferPlan(target,operations,excluded);const writer=applyCiiWriter2RestraintDeleteCompaction({targetDocument:target,transferPlan:tp});const after=afterDocumentFromByteString(writer.byteString);const validation=validateCiiWriter2RestraintDeleteCompaction({before:target,after,transferPlan:tp,writerResult:writer});assert.equal(validation.status,'PASS');return{tp,writer,after,validation};}
export function expectThrows(fn,prefix){assert.throws(fn,(error)=>String(error?.message||error).startsWith(prefix),prefix);}
export function three(){const specs=[occupied(10),occupied(30),occupied(50)];const endpoints=[['10','20'],['30','40'],['50','60']];return{specs,endpoints,target:targetDocument({blocks:specs.map((spec)=>({slots:{1:spec}})),pointers:[1,2,3],endpoints})};}