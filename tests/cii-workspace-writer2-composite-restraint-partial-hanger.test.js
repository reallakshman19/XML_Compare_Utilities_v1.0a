import assert from 'node:assert/strict';
import { createCiiPhysicalFile } from '../tabs/cii-workspace/cii-workspace-physical-file.js';
import { sha256CiiByteString } from '../tabs/cii-workspace/cii-workspace-byte-sha256.js';
import { buildCiiHangerEvidence, CII_HANGER_LAYOUTS } from '../tabs/cii-workspace/cii-workspace-hanger.js';
import { applyCiiWriter2HangerDeletePlanContract } from '../tabs/cii-workspace/cii-workspace-writer2-hanger-delete.js';
import { applyCiiWriter2CompositeWithRestraintDelete } from '../tabs/cii-workspace/cii-workspace-writer2-composite-restraint.js';
import { validateCiiWriter2CompositeWithRestraintDelete } from '../tabs/cii-workspace/cii-workspace-writer2-composite-restraint-validation.js';

const WIDTHS = [15, 13, 13, 13, 13, 13];
const SOURCE_SHA = '2'.repeat(64);
function numericRow(values) { return values.map((value, index) => String(value ?? '').padStart(WIDTHS[index] || 13, ' ')).join(''); }
function packed(values) { return `  ${values.map((value) => String(value).padStart(13, ' ')).join('')}`; }
function stringCard(value) { const text = String(value || ''); return `${' '.repeat(7)}${String(text.length).padStart(5, ' ')} ${text}`; }
function textRow(value = '') { return `${String(value.length).padStart(12, ' ')} ${value}`; }
function occupied(node) { return Object.freeze({ node, type: 1, stiffness: 1751200000000, gap: 0, friction: 0, connectingNode: 0, cosines: [1,0,0] }); }
function restraintSlotRows(spec = null) {
  if (!spec) return [numericRow([0,0,0,0,0,0]), numericRow([0,0,0]), textRow(), textRow()];
  return [numericRow([spec.node,spec.type,spec.stiffness,spec.gap,spec.friction,spec.connectingNode]), numericRow(spec.cosines), textRow(), textRow()];
}
function restraintBlock(spec) { const rows=[]; for(let slot=1;slot<=6;slot+=1) rows.push(...restraintSlotRows(slot===1?spec:null)); return rows; }
function elementRows(pointer, from, to) {
  const rows=[numericRow([from,to,0,0,0,0])];
  for(let index=1;index<12;index+=1) rows.push(numericRow([0,0,0,0,0,0]));
  rows.push(numericRow([0,0,0,pointer,0,0]), numericRow([0,0,0,0,0,0]), numericRow([0,0,0]));
  assert.equal(rows.length,15); return rows;
}
function slotState(pointer,spec){return Object.freeze({pointer,slot:1,line1:Object.freeze([spec.node,spec.type,spec.stiffness,spec.gap,spec.friction,spec.connectingNode]),line2:Object.freeze(spec.cosines),tag:'',guid:'',occupied:true});}
function beforeDocument() {
  const hangerNodes=[200,210,220];
  const elements=[{index:0,from:1000,to:1010},{index:1,from:1020,to:1030},{index:2,from:1040,to:1050}];
  const parsed=Object.freeze({elements:Object.freeze(elements.map((item)=>Object.freeze(item))),nodes:Object.freeze(Object.fromEntries([...hangerNodes,...elements.flatMap((item)=>[item.from,item.to])].map((node)=>[String(node),Object.freeze({})])))});
  const specs=[occupied(1000),occupied(1020),occupied(1040)];
  const defaults=[numericRow([1,25,0,9999,1,1]),packed([1,0,1,1,1])];
  const tail=hangerNodes.flatMap((node,zero)=>[
    numericRow([101+zero,25,0,0,0,0]),numericRow([0,9999,zero+1,0,0]),stringCard(`H${node}`),stringCard(''),
  ]);
  const free=hangerNodes.map((node,zero)=>packed([node,0,zero+1,0]));
  const rows=[
    '#$ VERSION',numericRow([5,11,1256]),
    '#$ CONTROL',numericRow([3,0,3,0,0,0]),numericRow([0,0,0,3,0,0]),numericRow([0,0,0,0,0,0]),numericRow([0]),
    '#$ ELEMENTS',...elements.flatMap((item,index)=>elementRows(index+1,item.from,item.to)),
    '#$ RESTRANT',...specs.flatMap(restraintBlock),
    '#$ MISCEL_1',numericRow([106,106,106]),...defaults,packed(hangerNodes),...tail,...free,
    packed([10,11,12]),packed([20,21,22]),packed([30,31,32]),packed([40,41,42]),
    numericRow([0,0,0,2,0,1]),numericRow([0,0,21,21,0,0]),numericRow([0,0,0,0,0,3]),numericRow([3]),
    '#$ UNITS','UNITS-CUSTODY','#$ RIGID',
  ];
  const raw=rows.join('\r\n')+'\r\n'; const physicalFile=createCiiPhysicalFile(new TextEncoder().encode(raw)); const contentSha256=sha256CiiByteString(physicalFile.originalByteString);
  const hangerEvidence=buildCiiHangerEvidence(physicalFile.text,parsed);
  assert.equal(hangerEvidence.status,'QUALIFIED'); assert.equal(hangerEvidence.layout,CII_HANGER_LAYOUTS.SYNCHRONIZER); assert.deepEqual(hangerEvidence.nodes,['200','210','220']);
  const auxiliaryElements={}; elements.forEach((item,index)=>{auxiliaryElements[String(index)]=Object.freeze({parsedElementIndex:index,from:String(item.from),to:String(item.to),pointers:Object.freeze({restraint:index+1})});});
  const document=Object.freeze({contentSha256,byteLength:physicalFile.byteLength,physicalFile,writer1CByteEligible:physicalFile.writer1CByteEligible,parsed,hangerEvidence,
    auxiliaryEvidence:Object.freeze({restraints:Object.freeze({authority:'PROTECTED_WRITER_RESTRANT_BLOCK_INDEX_24_ROWS',blockRows:24,sectionRowCount:72}),elements:Object.freeze(auxiliaryElements)})});
  return {document,specs};
}
function rawHangerOperation(){return Object.freeze({operationId:'R05-HANGER-210',family:'HANGER',property:'Hanger presence',action:'DELETE',status:'PREVIEW_READY',blockers:Object.freeze([]),evidenceAuthority:'CONTROL_NOHGRS_PLUS_MISCEL_1_IHGRNODE',
  sourceEvidence:Object.freeze({identity:'SRC-210',value:false,authority:'CONTROL_NOHGRS_PLUS_MISCEL_1_IHGRNODE'}),targetEvidence:Object.freeze({identity:'210',value:true}),before:true,proposed:false,matchAuthority:Object.freeze({status:'REVIEWED'})});}
function restraintOperation(spec){const mutation=Object.freeze({schema:'CIIWorkspaceRestraintSlotMutation.v1',status:'QUALIFIED',mode:'CLEAR',authority:'PROTECTED_WRITER_EXISTING_24_ROW_BLOCK_EMPTY_SLOT_TEMPLATE',pointer:2,slot:1,targetNode:'1020',beforeSlot:slotState(2,spec)});
  return Object.freeze({operationId:'R05-RESTRAINT-2',family:'RESTRAINT',property:'Qualified restraint slot mutation',action:'DELETE',status:'PREVIEW_READY',policyAuthority:'CII_WRITER_1B_EXISTING_BLOCK_FIXED_SLOT',matchAuthority:Object.freeze({status:'REVIEWED'}),sourceEvidence:Object.freeze({value:mutation}),proposed:mutation,scopeDecision:'APPLY'});}
function plan(before,spec){
  const base=applyCiiWriter2HangerDeletePlanContract(Object.freeze({status:'BLOCKED',blockers:Object.freeze(['NO_TRANSFERABLE_PREVIEW_OPERATIONS']),sourceDocument:Object.freeze({contentSha256:SOURCE_SHA}),targetDocument:Object.freeze({contentSha256:before.contentSha256}),operations:Object.freeze([rawHangerOperation()]),policy:Object.freeze({hangerMutation:'BLOCKED'})}));
  const hanger=Object.freeze({...base.operations[0],scopeDecision:'APPLY'}); const restraint=restraintOperation(spec); const applied=[hanger.operationId,restraint.operationId].sort();
  return Object.freeze({...base,status:'PREVIEW_READY',blockers:Object.freeze([]),sourceDocument:Object.freeze({contentSha256:SOURCE_SHA}),targetDocument:Object.freeze({contentSha256:before.contentSha256}),operations:Object.freeze([hanger,restraint]),excludedOperations:Object.freeze([]),
    transferScope:Object.freeze({status:'BOUND',mode:'EXPLICIT_APPLY_EXCLUDE',authority:'USER_EXPLICIT_OPERATION_SCOPE',scopeId:'w212-r05',sourceSha256:SOURCE_SHA,targetSha256:before.contentSha256,candidateOperationIds:Object.freeze(applied),appliedOperationIds:Object.freeze(applied),excludedOperationIds:Object.freeze([])})});
}
function afterDocument(byteString){const bytes=new Uint8Array(byteString.length);for(let i=0;i<byteString.length;i+=1)bytes[i]=byteString.charCodeAt(i)&0xff;const physicalFile=createCiiPhysicalFile(bytes);return Object.freeze({contentSha256:sha256CiiByteString(physicalFile.originalByteString),byteLength:physicalFile.byteLength,writer1CByteEligible:physicalFile.writer1CByteEligible,physicalFile});}

// R05 qualified H>1 partial HANGER delete + RESTRAINT block delete share TARGET0 and splice once.
{
  const {document:before,specs}=beforeDocument(); const transferPlan=plan(before,specs[1]);
  const writer=applyCiiWriter2CompositeWithRestraintDelete({targetDocument:before,targetGraph:null,transferPlan});
  assert.equal(writer.status,'APPLIED'); assert.equal(writer.mode,'ONE_ORIGINAL_PREIMAGE_COMPOSITE');
  assert.equal(writer.familyMutationCounts.hangerDeleteOperations,1); assert.equal(writer.familyMutationCounts.restraintDeleteOperations,1);
  assert(writer.mutations.some((item)=>item.authorityFamily==='WRITER_2_HANGER_PARTIAL_DELETE'));
  assert(writer.mutations.some((item)=>item.authorityFamily==='WRITER_2_RESTRAINT_BLOCK_DELETE'));
  assert.ok(writer.components.existingComposite?.components?.hangerPartialDelete); assert.equal(writer.components.existingComposite?.components?.hangerDeleteAll,null);
  const after=afterDocument(writer.byteString);
  const validation=validateCiiWriter2CompositeWithRestraintDelete({before,after,targetGraph:null,transferPlan,writerResult:writer});
  assert.equal(validation.status,'PASS'); assert.deepEqual(validation.familyOperationCounts,{nodeName:0,sifDelete:0,hangerDelete:1,restraintDelete:1});
}

console.log('Writer2 W2.12 R05 partial HANGER + RESTRAINT composite qualification passed.');
