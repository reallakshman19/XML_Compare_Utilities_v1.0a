import assert from 'node:assert/strict';
import { applyCiiWriter2RestraintDeleteCompaction, _test as writerTest } from '../tabs/cii-workspace/cii-workspace-writer2-restraint-delete-write.js';
import { validateCiiWriter2RestraintDeleteCompaction } from '../tabs/cii-workspace/cii-workspace-writer2-restraint-delete-validation.js';
import { afterDocumentFromByteString, clearOperation, expectThrows, occupied, targetDocument, three, transferPlan } from './cii-workspace-writer2-restraint-delete-fixture.js';

// P07 stale TARGET0 hash blocks Writer.
{
  const spec=occupied(10); const target=targetDocument({blocks:[{slots:{1:spec}}],pointers:[1],endpoints:[['10','20']],declaredHash:'0'.repeat(64)});
  const tp=transferPlan(target,[clearOperation({id:'P07',pointer:1,targetNode:10,spec})]);
  expectThrows(()=>applyCiiWriter2RestraintDeleteCompaction({targetDocument:target,transferPlan:tp}),'CII_WRITER_2_RESTRAINT_TARGET0_SHA256_MISMATCH');
}
// P08 forged Writer planner deletedPointers is rejected independently.
{
  const spec=occupied(10); const target=targetDocument({blocks:[{slots:{1:spec}}],pointers:[1],endpoints:[['10','20']]}); const tp=transferPlan(target,[clearOperation({id:'P08',pointer:1,targetNode:10,spec})]);
  const writer=applyCiiWriter2RestraintDeleteCompaction({targetDocument:target,transferPlan:tp}); const after=afterDocumentFromByteString(writer.byteString);
  const forged=Object.freeze({...writer,relocationPlan:Object.freeze({...writer.relocationPlan,deletedPointers:Object.freeze([999])})});
  expectThrows(()=>validateCiiWriter2RestraintDeleteCompaction({before:target,after,transferPlan:tp,writerResult:forged}),'CII_WRITER_2_RESTRAINT_VALIDATOR_WRITER_PLAN_TESTIMONY_MISMATCH');
}
// P09 forged oldToNewPointer is rejected independently.
{
  const {specs,target}=three(); const tp=transferPlan(target,[clearOperation({id:'P09',pointer:2,targetNode:30,spec:specs[1]})]);
  const writer=applyCiiWriter2RestraintDeleteCompaction({targetDocument:target,transferPlan:tp}); const after=afterDocumentFromByteString(writer.byteString);
  const forged=Object.freeze({...writer,relocationPlan:Object.freeze({...writer.relocationPlan,oldToNewPointer:Object.freeze({1:1,2:0,3:3})})});
  expectThrows(()=>validateCiiWriter2RestraintDeleteCompaction({before:target,after,transferPlan:tp,writerResult:forged}),'CII_WRITER_2_RESTRAINT_VALIDATOR_WRITER_PLAN_TESTIMONY_MISMATCH');
}
// P10 semantic pointer testimony stale against physical I13 blocks Writer.
{
  const spec=occupied(10); const target=targetDocument({blocks:[{slots:{1:spec}}],pointers:[1],semanticPointers:[2],endpoints:[['10','20']]});
  const tp=transferPlan(target,[clearOperation({id:'P10',pointer:1,targetNode:10,spec})]);
  expectThrows(()=>applyCiiWriter2RestraintDeleteCompaction({targetDocument:target,transferPlan:tp}),'CII_WRITER_2_RESTRAINT_DELETE_BLOCKED:');
}
// P11 stale CONTROL count field blocks Writer.
{
  const spec=occupied(10); const target=targetDocument({blocks:[{slots:{1:spec}}],pointers:[1],endpoints:[['10','20']],controlCount:2});
  const tp=transferPlan(target,[clearOperation({id:'P11',pointer:1,targetNode:10,spec})]);
  expectThrows(()=>applyCiiWriter2RestraintDeleteCompaction({targetDocument:target,transferPlan:tp}),'CII_WRITER_2_RESTRAINT_DELETE_BLOCKED:');
}
// P12 stale RESTRANT slot preimage blocks Writer.
{
  const actual=occupied(10); const stale=occupied(11); const target=targetDocument({blocks:[{slots:{1:actual}}],pointers:[1],endpoints:[['10','20']]});
  const tp=transferPlan(target,[clearOperation({id:'P12',pointer:1,targetNode:10,spec:stale})]);
  expectThrows(()=>applyCiiWriter2RestraintDeleteCompaction({targetDocument:target,transferPlan:tp}),'CII_WRITER_2_RESTRAINT_DELETE_BLOCKED:');
}
// P13 overlap guard blocks intersecting original-coordinate claims.
{
  expectThrows(()=>writerTest.assertDisjoint([Object.freeze({kind:'A',byteStart:10,byteEnd:20,beforeField:'x',afterField:'y'}),Object.freeze({kind:'B',byteStart:19,byteEnd:30,beforeField:'x',afterField:'y'})]),'CII_WRITER_2_RESTRAINT_REPLACEMENT_OVERLAP:A:B');
}
// P14 unrelated final-byte drift is rejected before Writer testimony.
{
  const spec=occupied(10); const target=targetDocument({blocks:[{slots:{1:spec}}],pointers:[1],endpoints:[['10','20']]}); const tp=transferPlan(target,[clearOperation({id:'P14',pointer:1,targetNode:10,spec})]);
  const writer=applyCiiWriter2RestraintDeleteCompaction({targetDocument:target,transferPlan:tp}); const after=afterDocumentFromByteString(`!${writer.byteString.slice(1)}`);
  expectThrows(()=>validateCiiWriter2RestraintDeleteCompaction({before:target,after,transferPlan:tp,writerResult:writer}),'CII_WRITER_2_RESTRAINT_VALIDATOR_FINAL_BYTE_MISMATCH');
}
// P15 forged mutation ledger is rejected with correct physical postimage.
{
  const spec=occupied(10); const target=targetDocument({blocks:[{slots:{1:spec}}],pointers:[1],endpoints:[['10','20']]}); const tp=transferPlan(target,[clearOperation({id:'P15',pointer:1,targetNode:10,spec})]);
  const writer=applyCiiWriter2RestraintDeleteCompaction({targetDocument:target,transferPlan:tp}); const after=afterDocumentFromByteString(writer.byteString);
  const forged=Object.freeze({...writer,mutations:Object.freeze(writer.mutations.slice(0,-1))});
  expectThrows(()=>validateCiiWriter2RestraintDeleteCompaction({before:target,after,transferPlan:tp,writerResult:forged}),'CII_WRITER_2_RESTRAINT_VALIDATOR_WRITER_MUTATION_LEDGER_MISMATCH');
}
// P16 forged postimage SHA custody is rejected.
{
  const spec=occupied(10); const target=targetDocument({blocks:[{slots:{1:spec}}],pointers:[1],endpoints:[['10','20']]}); const tp=transferPlan(target,[clearOperation({id:'P16',pointer:1,targetNode:10,spec})]);
  const writer=applyCiiWriter2RestraintDeleteCompaction({targetDocument:target,transferPlan:tp}); const after=afterDocumentFromByteString(writer.byteString);
  const forged=Object.freeze({...writer,postimageHashCustody:Object.freeze({...writer.postimageHashCustody,contentSha256:'0'.repeat(64)})});
  expectThrows(()=>validateCiiWriter2RestraintDeleteCompaction({before:target,after,transferPlan:tp,writerResult:forged}),'CII_WRITER_2_RESTRAINT_VALIDATOR_WRITER_POSTIMAGE_HASH_TESTIMONY_MISMATCH');
}
// P17 forged representation custody is rejected.
{
  const spec=occupied(10); const target=targetDocument({blocks:[{slots:{1:spec}}],pointers:[1],endpoints:[['10','20']]}); const tp=transferPlan(target,[clearOperation({id:'P17',pointer:1,targetNode:10,spec})]);
  const writer=applyCiiWriter2RestraintDeleteCompaction({targetDocument:target,transferPlan:tp}); const after=afterDocumentFromByteString(writer.byteString);
  const forged=Object.freeze({...writer,postimageRepresentationCustody:Object.freeze({...writer.postimageRepresentationCustody,lineCount:writer.postimageRepresentationCustody.lineCount+1})});
  expectThrows(()=>validateCiiWriter2RestraintDeleteCompaction({before:target,after,transferPlan:tp,writerResult:forged}),'CII_WRITER_2_RESTRAINT_VALIDATOR_WRITER_POSTIMAGE_REPRESENTATION_TESTIMONY_MISMATCH');
}
// P18 CREATE/new-block request remains blocked.
{
  const spec=occupied(10); const target=targetDocument({blocks:[{slots:{1:spec}}],pointers:[1],endpoints:[['10','20']]}); const tp=transferPlan(target,[clearOperation({id:'P18',pointer:1,targetNode:10,spec,action:'CREATE'})]);
  expectThrows(()=>applyCiiWriter2RestraintDeleteCompaction({targetDocument:target,transferPlan:tp}),'CII_WRITER_2_RESTRAINT_DELETE_BLOCKED:');
}

console.log('Writer2 RESTRAINT physical DELETE P07-P18 falsifiers passed.');
