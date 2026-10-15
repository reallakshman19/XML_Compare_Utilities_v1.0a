import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseIndependentNodeNameState } from './cii-workspace-multisource-texpected-oracle.js';
import { reconcileCiiOwnerLexicalGolden, CII_OWNER_GOLDEN_STATUS, CII_OWNER_GOLDEN_SCHEMA, ciiOwnerLexicalGoldenToCsv } from './cii-workspace-owner-lexical-golden.js';

const expected = Object.freeze({
  S1:'9a9cb14db4c13f5aac41cc74a60e7e528722eb5003d09f07192762ab6bfb1a2b',
  S2:'7ec48b76b65eedfd5ecc9c8e8feca1a45dd8c83721a68b53aa0db3363e6d27fd',
  S3:'c2143b31c482158ac5514d2709406c14a9179e656277c654e932bb845d090caa',
  T:'abfa3ffc9281fe75d4170b2d885d554cb1f120dadedae7c7ab609548b63cc060',
  sourceSet:'5390166aab9504880bd4514af865c914ba8a41ce2922e7d473311d62b10723a3',
});
const sha256=(bytes)=>createHash('sha256').update(bytes).digest('hex');
const fixture=(name)=>readFileSync(fileURLToPath(new URL('../Benchmark/'+name+'.CII',import.meta.url)));
const benchmark=Object.fromEntries(['S1','S2','S3','T'].map((id)=>[id,fixture(id)]));
for (const [id,raw] of Object.entries(benchmark))
  assert.equal(sha256(raw),expected[id],id+': frozen original SHA-256 required');
const censusPath=fileURLToPath(new URL('../test-results/cii-method-a-qualification/source-target-census.json',import.meta.url));
const census=JSON.parse(readFileSync(censusPath,'utf8'));
assert.equal(census.summary.totalSourceNodes,150,'read exactly all 150 physical SOURCE nodes');
const keys=new Set(census.rows.map((row)=>row.rowKey));
assert.equal(keys.size,150,'no duplicate SOURCE physical identities');
for (const sourceId of ['S1','S2','S3']) {
  const independent=parseIndependentNodeNameState(benchmark[sourceId].toString('latin1'));
  assert.deepEqual(independent.conflicts,[],sourceId+': raw SOURCE lexical conflicts');
  const physicalIds=new Set(independent.elements.flatMap((edge)=>[edge.from,edge.to]));
  for (const id of physicalIds) {
    const row=census.rows.find((candidate)=>candidate.rowKey===sourceId+':'+id);
    assert(row,sourceId+':'+id+' missing from physical census');
    assert.equal(row.sourceNodeName,independent.names.get(id)||'',sourceId+':'+id+' original name drift');
  }
  assert.equal(census.rows.filter((row)=>row.sourceId===sourceId).length,physicalIds.size,
    sourceId+': physical NODE cardinality drift');
}
const targetState=parseIndependentNodeNameState(benchmark.T.toString('latin1'));
assert.deepEqual(targetState.conflicts,[],'original TARGET lexical conflicts');
const targetIds=[...new Set(targetState.elements.flatMap((edge)=>[edge.from,edge.to]))];
const targetNodes=targetIds.map((id)=>({id,nodeName:targetState.names.get(id)||''}));
const flags=process.argv.slice(2);
if (flags.length && (flags.length!==4
  || new Set([flags[0],flags[2]]).size!==2
  || !['--golden','--manifest'].includes(flags[0])
  || !['--golden','--manifest'].includes(flags[2])
  || !flags[1] || !flags[3])) {
  throw new Error('OWNER_GOLDEN_REQUIRES_EXACT_GOLDEN_PATH_AND_MANIFEST_PATH');
}
const value=(name)=>{
  const i=flags.indexOf(name);
  return i<0?null:flags[i+1];
};
const hasGolden=value('--golden')!=null;
const hasManifest=value('--manifest')!=null;
if (hasGolden !== hasManifest) throw new Error('OWNER_GOLDEN_PATH_AND_MANIFEST_MUST_BE_PAIRED');
const manifest=hasManifest?JSON.parse(readFileSync(value('--manifest'),'utf8')):null;
if (manifest && manifest.schema!==CII_OWNER_GOLDEN_SCHEMA) throw new Error('OWNER_GOLDEN_MANIFEST_SCHEMA_INVALID');
const goldenBytes=hasGolden?readFileSync(value('--golden')):null;
const result=reconcileCiiOwnerLexicalGolden({
  goldenBytes,declaredSha256:manifest?.rawSha256,declaredRowCount:manifest?.relationCount,
  ownerEvidenceRef:manifest?.ownerEvidenceRef,
  sourceRows:census.rows,targetNodes,
  sourceSetSha256:expected.sourceSet,requiredSourceSetSha256:manifest ? manifest.sourceSetSha256 : expected.sourceSet,
  targetOriginalSha256:expected.T,requiredTargetOriginalSha256:manifest ? manifest.targetOriginalSha256 : expected.T,
});
const report={
  ...result, evidenceContext:{
    sourceFixtureSha256:{S1:expected.S1,S2:expected.S2,S3:expected.S3},
    targetFixtureSha256:expected.T,sourceSetSha256:expected.sourceSet,
    physicalSourceRows:census.rows.length,physicalTargetNodes:targetNodes.length,
    partialTExpectedRowCount:36,bm001FrozenRows:329,
    completeOwnerTablePresent:hasGolden,
    partialOracleIsFullGolden:false,
  },
};
const dir=fileURLToPath(new URL('../test-results/cii-method-a-qualification/',import.meta.url));
mkdirSync(dir,{recursive:true});
writeFileSync(join(dir,'owner-golden-readiness.json'),JSON.stringify(report,null,2)+'\n','utf8');
writeFileSync(join(dir,'owner-golden-readiness.csv'),ciiOwnerLexicalGoldenToCsv(report)+'\n','utf8');
console.log(JSON.stringify({
 schema:report.schema,status:report.status,blockers:report.blockers,
 sourcePopulation:report.evidenceContext.physicalSourceRows,
 ownerRows:result.observedRowCount||0,summary:result.summary,qualificationSummary:result.qualificationSummary||null,
 evidenceStatus:hasGolden?'OWNER_FILE_SUPPLIED_UNATTESTED':'OWNER_FILE_NOT_SUPPLIED',
 ownerAccepted:false,writer2Authority:false,
},null,2));
if (!hasGolden) {
  assert.equal(result.status,CII_OWNER_GOLDEN_STATUS.MISSING,
    'absent full golden must remain blocked even when all technical tests pass');
  console.log('CII Owner full-golden readiness: BLOCKED_MISSING (EXPECTED, not acceptance).');
} else if (result.status!==CII_OWNER_GOLDEN_STATUS.ATTESTATION) {
  process.exitCode=2;
} else {
  console.log('CII lexical rows technically reconciled; independent Owner attestation still PENDING.');
}
