import assert from 'node:assert/strict';
import { CII_WRITER_2_RESTRAINT_DELETE_PHYSICAL_AUTHORITY } from '../tabs/cii-workspace/cii-workspace-writer2-restraint-delete-write.js';
import { applyAndValidate, clearOperation, occupied, targetDocument, three } from './cii-workspace-writer2-restraint-delete-fixture.js';

// P01 sole block -> zero.
{
  const spec=occupied(10); const target=targetDocument({blocks:[{slots:{1:spec}}],pointers:[1],endpoints:[['10','20']]});
  const {writer,validation}=applyAndValidate(target,[clearOperation({id:'P01',pointer:1,targetNode:10,spec})]);
  assert.equal(writer.authority,CII_WRITER_2_RESTRAINT_DELETE_PHYSICAL_AUTHORITY);
  assert.equal(writer.blockCountAfter,0); assert.equal(validation.blockCountAfter,0); assert.equal(writer.mutationCount,3);
  assert.equal(writer.target0HashCustody.contentSha256,target.contentSha256); assert.equal(writer.postimageHashCustody.contentSha256,validation.expectedSha256);
}
// P02 first of 3.
{
  const {specs,target}=three(); const {writer}=applyAndValidate(target,[clearOperation({id:'P02',pointer:1,targetNode:10,spec:specs[0]})]);
  assert.deepEqual(writer.relocationPlan.oldToNewPointer,{1:0,2:1,3:2}); assert.equal(writer.mutationCount,5);
}
// P03 middle of 3.
{
  const {specs,target}=three(); const {writer}=applyAndValidate(target,[clearOperation({id:'P03',pointer:2,targetNode:30,spec:specs[1]})]);
  assert.deepEqual(writer.relocationPlan.oldToNewPointer,{1:1,2:0,3:2}); assert.equal(writer.mutationCount,4);
}
// P04 last of 3.
{
  const {specs,target}=three(); const {writer}=applyAndValidate(target,[clearOperation({id:'P04',pointer:3,targetNode:50,spec:specs[2]})]);
  assert.deepEqual(writer.relocationPlan.oldToNewPointer,{1:1,2:2,3:0}); assert.equal(writer.mutationCount,3);
}
// P05 delete {2,4} of 5.
{
  const specs=[10,30,50,70,90].map(occupied); const endpoints=[['10','20'],['30','40'],['50','60'],['70','80'],['90','100']];
  const target=targetDocument({blocks:specs.map((spec)=>({slots:{1:spec}})),pointers:[1,2,3,4,5],endpoints});
  const {writer}=applyAndValidate(target,[clearOperation({id:'P05-A',pointer:2,targetNode:30,spec:specs[1]}),clearOperation({id:'P05-B',pointer:4,targetNode:70,spec:specs[3]})]);
  assert.deepEqual(writer.relocationPlan.oldToNewPointer,{1:1,2:0,3:2,4:0,5:3}); assert.equal(writer.blockCountAfter,3); assert.equal(writer.mutationCount,6);
}
// P06 pointer zero remains unchanged.
{
  const specs=[occupied(30),occupied(50)]; const endpoints=[['10','20'],['30','40'],['50','60']];
  const target=targetDocument({blocks:specs.map((spec)=>({slots:{1:spec}})),pointers:[0,1,2],endpoints});
  const {writer}=applyAndValidate(target,[clearOperation({id:'P06',pointer:1,targetNode:30,spec:specs[0]})]);
  assert(!writer.relocationPlan.pointerChanges.some((item)=>item.parsedElementIndex===0));
}
// P19 CONTROL custody regression: row1 NONAM is unchanged; row2 RESTRAINT count is the only CONTROL row changed.
{
  const {specs,target}=three();
  const {after}=applyAndValidate(target,[clearOperation({id:'P19',pointer:2,targetNode:30,spec:specs[1]})]);
  const beforeMarker=target.physicalFile.lines.findIndex((line)=>String(line.text).trim().toUpperCase()==='#$ CONTROL');
  const afterMarker=after.physicalFile.lines.findIndex((line)=>String(line.text).trim().toUpperCase()==='#$ CONTROL');
  assert(beforeMarker>=0&&afterMarker>=0);
  assert.equal(after.physicalFile.lines[afterMarker+1].text,target.physicalFile.lines[beforeMarker+1].text,'CONTROL row1/NONAM must remain byte-identical');
  assert.notEqual(after.physicalFile.lines[afterMarker+2].text,target.physicalFile.lines[beforeMarker+2].text,'CONTROL row2 restraint-count field must change');
}

console.log('Writer2 RESTRAINT physical DELETE P01-P06 and CONTROL-custody P19 passed.');