import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { CII_OWNER_GOLDEN_STATUS, reconcileCiiOwnerLexicalGolden, ciiOwnerLexicalGoldenToCsv } from './cii-workspace-owner-lexical-golden.js';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const retainedSourceSet = '5390166aab9504880bd4514af865c914ba8a41ce2922e7d473311d62b10723a3';
const retainedTarget = 'abfa3ffc9281fe75d4170b2d885d554cb1f120dadedae7c7ab609548b63cc060';
const ownerRef = 'https://github.com/example/owner/issues/69#issuecomment-123';
const sourceRows = [
  ['S1','100','PS-A','10',true], ['S1','101','PS-R','',false],
  ['S1','102','PS-SUFFIX','15',true], ['S2','103','PS-DUP','22',true],
  ['S3','104','PS-DUP','23',true], ['S1','105','PS02687.1','',false],
  ['S1','106','PS027','16',true],
].map(([sourceId,sourceNodeId,sourceNodeName,targetNodeId,identityBound])=>({
  rowKey: sourceId+':'+sourceNodeId,sourceId,sourceNodeId,sourceNodeName,
  targetNodeIds: targetNodeId ? [targetNodeId] : [],
  identityBound,confidence:identityBound?'MEDIUM':'UNRESOLVED',
}));
const targetNodes = [
  ['10','SL-A'], ['11','SL-B'], ['12','SL-C'], ['15','SL-263..5'],
  ['16','SL-275-A.8'], ['17','SL-1'], ['18','SL-2'],
  ['22','SL-X'], ['23','SL-Y'],
].map(([id,nodeName])=>({id,nodeName}));
const raw = [
  'S1\tPS-A\tSL-A',                 // independent 1:1 physical BOUND
  'S1\tPS-R\tSL-B',                 // distinct labels; no physical binding
  'S1\tPS-GONE\tSL-C',              // missing SOURCE physical label
  'PS-DUP → SL-A',                    // SOURCE label spans two SOURCE members
  'S1\tPS-A\tSL-A',                 // exact duplicate: retained, not discarded
  'S1\tPS-SUFFIX\tSL-263..5',      // lexically anomalous; never corrected
  'S1\tPS027\tSL-275-A.8',         // original suffix byte preserved
  'S1\tPS02687.1\tSL-1',           // owner label maps to multiple TARGET labels
  'S1\tPS02687.1\tSL-2',
  'line with no valid owner delimiter', // explicit INVALID
].join('\r\n')+'\r\n';
const bytes = Buffer.from(raw,'utf8');
const call = (overrides={}) => reconcileCiiOwnerLexicalGolden({
  goldenBytes:bytes,declaredSha256:digest(bytes),declaredRowCount:10,ownerEvidenceRef:ownerRef,
  sourceRows,targetNodes,
  sourceSetSha256:retainedSourceSet,requiredSourceSetSha256:retainedSourceSet,
  targetOriginalSha256:retainedTarget,requiredTargetOriginalSha256:retainedTarget,
  ...overrides,
});
const missing=call({goldenBytes:null});
assert.equal(missing.status,CII_OWNER_GOLDEN_STATUS.MISSING);
assert.equal(missing.canAuthorizeWriter2,false);
assert.equal(call({declaredSha256:'0'.repeat(64)}).status,CII_OWNER_GOLDEN_STATUS.CUSTODY);
assert.equal(call({declaredRowCount:9}).status,CII_OWNER_GOLDEN_STATUS.PARSE);
assert.equal(call({declaredRowCount:11}).status,CII_OWNER_GOLDEN_STATUS.PARSE);
assert.equal(call({requiredSourceSetSha256:'1'.repeat(64)}).status,CII_OWNER_GOLDEN_STATUS.CUSTODY);
assert.equal(call({requiredTargetOriginalSha256:'1'.repeat(64)}).status,CII_OWNER_GOLDEN_STATUS.CUSTODY);
assert.equal(call({ownerEvidenceRef:'not-an-owner-evidence-url'}).status,CII_OWNER_GOLDEN_STATUS.CUSTODY);
assert.equal(call({goldenBytes:raw}).status,CII_OWNER_GOLDEN_STATUS.CUSTODY,
  'raw text must not replace the original Owner bytes');
const badUtf8=Buffer.from([0xc3,0x28]);
assert.equal(call({goldenBytes:badUtf8,declaredSha256:digest(badUtf8),declaredRowCount:1}).status,
  CII_OWNER_GOLDEN_STATUS.PARSE);
const result=call();
assert.equal(result.status,CII_OWNER_GOLDEN_STATUS.EXCEPTIONS);
assert.equal(result.rows.length,10);
assert.equal(result.qualificationSummary.total,10);
assert.equal(result.qualificationSummary.resolved,3);
assert.equal(result.qualificationSummary.review,1);
assert.equal(result.qualificationSummary.ambiguous,4);
assert.equal(result.qualificationSummary.missing,1);
assert.equal(result.qualificationSummary.invalid,1);
assert.equal(result.qualificationSummary.duplicates,1);
assert.equal(result.qualificationSummary.byMember.reduce((sum,row)=>sum+row.total,0),10);
assert(result.qualificationSummary.byMember.some((row)=>row.sourceId==='UNSPECIFIED' && row.total===2 && row.AMBIGUOUS===1 && row.INVALID===1),
  'both memberless lexical relation and invalid raw line must remain counted, not silently dropped');
const csv=ciiOwnerLexicalGoldenToCsv(result);
assert.equal(csv.split('\n').length,11,'every input row needs an independent CSV record');
assert.equal(ciiOwnerLexicalGoldenToCsv(result),csv,'golden CSV output must be deterministic');
assert(csv.includes('SL-263..5') && csv.includes('SL-275-A.8'));
assert(csv.includes('DUPLICATE_OWNER_RELATION_PRESERVED'));

assert.deepEqual(result.summary,{MATCHED:3,REVIEWABLE:1,AMBIGUOUS:4,MISSING:1,INVALID:1});
assert.equal(result.rows[0].disposition,'MATCHED');
assert.equal(result.rows[1].disposition,'REVIEWABLE');
assert.equal(result.rows[2].disposition,'MISSING');
assert.equal(result.rows[3].disposition,'AMBIGUOUS');
assert.deepEqual(result.rows[3].sourcePhysicalNodeKeys,['S2:103','S3:104']);
assert.equal(result.rows[4].disposition,'AMBIGUOUS');
assert(result.rows[4].reasons.includes('DUPLICATE_OWNER_RELATION_PRESERVED'));
assert.equal(result.rows[5].targetLabel,'SL-263..5');
assert(result.rows[5].lexicalAnomalies.includes('REPEATED_DOT_PUNCTUATION'));
assert.equal(result.rows[6].targetLabel,'SL-275-A.8');
assert(result.rows[6].ownerAdjudicationRequired);
assert.equal(result.rows[7].disposition,'AMBIGUOUS');
assert.equal(result.rows[8].disposition,'AMBIGUOUS');
assert(result.rows[8].reasons.includes('ONE_SOURCE_LABEL_MULTIPLE_EXPECTED_TARGET_LABELS'));
assert.equal(result.rows[9].disposition,'INVALID');
assert.equal(result.rows[9].rawLine,'line with no valid owner delimiter');
assert.deepEqual(result.rows.map((row)=>row.ordinal),Array.from({length:10},(_,i)=>i+1));
assert.equal(result.custody.actualSha256,digest(bytes));
assert.equal(result.ownerAccepted,false);
assert.equal(result.canAuthorizeWriter2,false);
const goodLines='S1\tPS-A\tSL-A\n';
const goodBytes=Buffer.from(goodLines,'utf8');
const good=call({goldenBytes:goodBytes,declaredSha256:digest(goodBytes),declaredRowCount:1});
assert.equal(good.status,CII_OWNER_GOLDEN_STATUS.ATTESTATION);
assert.equal(good.ownerAccepted,false,'even fully matched lexical rows require genuine Owner attestation');
assert.equal(good.rows[0].disposition,'MATCHED');
console.log('CII Owner golden test-only byte custody, duplicate lexical ambiguity and missing-gate controls: PASS');
