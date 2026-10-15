import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../test-results/cii-method-a-qualification/', import.meta.url));
const read = (name) => JSON.parse(readFileSync(join(dir,name),'utf8'));
const digest = (name) => createHash('sha256').update(readFileSync(join(dir,name))).digest('hex');
const before = read('source-target-census.json');
const after = read('source-target-census-optin.json');
const terminals = read('terminal-tail-forensics.json');
const golden = read('owner-golden-readiness.json');
const expected = Object.freeze([
  ['S1:3830','860','MEDIUM'], ['S1:4960','1060','MEDIUM'],
  ['S2:50','40040','HIGH'], ['S2:80','40050','HIGH'],
  ['S2:620','10460','HIGH'], ['S3:1920','21920','MEDIUM'],
]);
const unresolved = Object.freeze([
  'S1:3970','S1:4020','S1:4050','S1:4060',
  'S2:210','S2:220','S2:230',
  'S3:1800','S3:1810','S3:1820','S3:1840',
]);
const expectedPopulation = Object.freeze({S1:57,S2:47,S3:46});
const byKey = (audit) => new Map(audit.rows.map((row) => [row.rowKey,row]));
const a=byKey(before), b=byKey(after);
const assertions = [];
function verify(name,action) {
  action();assertions.push({name,status:'PASS'});
}
verify('FROZEN_SOURCE_SET_AND_TARGET_DIGEST',()=>{
  assert.equal(before.sourceSetSha256,'5390166aab9504880bd4514af865c914ba8a41ce2922e7d473311d62b10723a3');
  assert.equal(after.sourceSetSha256,before.sourceSetSha256);
  assert.equal(golden.evidenceContext?.targetFixtureSha256,
    'abfa3ffc9281fe75d4170b2d885d554cb1f120dadedae7c7ab609548b63cc060');
});
verify('INDEPENDENT_150_PHYSICAL_SOURCE_CARDINALITY',()=>{
  for(const audit of [before,after]) {
    assert.equal(audit.summary.totalSourceNodes,150);
    assert.equal(audit.rows.length,150);
    assert.equal(new Set(audit.rows.map((row)=>row.rowKey)).size,150);
    assert.equal(Object.values(expectedPopulation).reduce((x,y)=>x+y,0),150);
    for (const [sourceId,size] of Object.entries(expectedPopulation)) {
      const rows=audit.rows.filter((row)=>row.sourceId===sourceId);
      assert.equal(rows.length,size);
      assert.equal(audit.summary.bySource.find((row)=>row.sourceId===sourceId).populationStatus,'MATCH');
    }
  }
});
verify('DEFAULT_RETAINED_BASELINE',()=>{
  assert.deepEqual([before.summary.BOUND,before.summary.UNRESOLVED,before.summary.UNEMITTED,before.summary.AMBIGUOUS],
    [105,11,34,0]);
  assert.equal(digest('source-target-census.json'),
    '486118725ea744000ac0efb2474fe15bb2ef2856972562108b2fd56051ae9bb1');
});
verify('OPT_IN_SIX_PHYSICAL_RECOVERIES_ONLY',()=>{
  assert.deepEqual([after.summary.BOUND,after.summary.UNRESOLVED,after.summary.UNEMITTED,after.summary.AMBIGUOUS],
    [111,11,28,0]);
  assert.equal(digest('source-target-census-optin.json'),
    '974cc9e62723bc985e724f4f012912d7159e8a477ab16dc715f1cceb08ff7f06');
  assert.deepEqual([...a.keys()].sort(),[...b.keys()].sort());
  const changed = [...a.keys()].filter((id)=>JSON.stringify(a.get(id))!==JSON.stringify(b.get(id))).sort();
  assert.deepEqual(changed,expected.map((row)=>row[0]).sort());
  for(const [rowKey,targetNodeId,confidence] of expected) {
    assert.equal(a.get(rowKey).state,'UNEMITTED');
    const row=b.get(rowKey);
    assert.equal(row.state,'BOUND');assert.equal(row.targetNodeId,targetNodeId);
    assert.equal(row.confidence,confidence);assert.equal(row.identityBound,true);
  }
});
verify('PRESERVE_105_EXISTING_BINDINGS_AND_111_UNIQUE_TARGETS',()=>{
  for(const row of before.rows.filter((x)=>x.state==='BOUND')){
    const next=b.get(row.rowKey);
    assert.deepEqual(next,row);
  }
  for(const audit of [before,after]) {
    const bound=audit.rows.filter((row)=>row.identityBound===true);
    assert.equal(bound.length,audit.summary.BOUND);
    assert.equal(new Set(bound.map((row)=>row.targetNodeId)).size,bound.length);
  }
});
verify('ELEVEN_BOUNDARY_ROWS_FAIL_REGISTERED_M1_NOT_M2_OR_OD',()=>{
  for(const rowKey of unresolved){
    for(const audit of [before,after]){
      const row=byKey(audit).get(rowKey);
      assert.equal(row.state,'UNRESOLVED',rowKey);
      const d=row.methodABoundaryDiagnostics;
      assert.equal(d.length,1);
      assert.equal(d[0].custodyVeto?.blocker,'ADJACENT_ELEMENT_CANDIDATE_AMBIGUITY');
      const checks=d[0].localBoundary?.endpointChecks||[];
      assert.equal(checks.length,2,rowKey);
      assert.deepEqual(checks.map((c)=>c.endpoint).sort(),['FROM','TO']);
      for(const check of checks){
        assert.equal(check.identitySupported,false);
        assert.equal(check.m1Available,true);
        assert.equal(check.m1Basis,'REGISTERED');
        assert.equal(check.m1Orientation,'DIRECT');
        assert.equal(check.m1Pass,false);
        assert(check.endpointDistanceMm>check.toleranceMm);
        assert.equal(check.m2Pass,true);assert.equal(check.odPass,true);
        assert.equal(check.hardFail,false);
        assert.deepEqual(check.failedPredicates,['M1_ENDPOINT_TOLERANCE_EXCEEDED']);
      }
    }
  }
});
verify('EXTERIOR_33_NODE_GRAPH_DENOMINATOR_AND_SIX_STOPPED_PREFIXES',()=>{
  assert.equal(terminals.groupedRegionCount,6);
  assert.equal(terminals.actualExteriorUnemittedRowCount,33);
  const out=terminals.regions.flatMap((region)=>region.unemittedExteriorRowKeys);
  assert.equal(out.length,33);
  assert.equal(new Set(out).size,33);
  const qualified=terminals.regions.flatMap((region)=>
    region.qualifiedPrefix.qualifiedNodePairs.map((p)=>region.sourceId+':'+p.sourceNodeId+'>'+p.targetNodeId));
  assert.deepEqual(qualified.sort(),expected.map(([k,t])=>k+'>'+t).sort());
  for(const region of terminals.regions) {
    assert.equal(region.qualifiedPrefix.status,'PREFIX_HALTED');
    assert(region.qualifiedPrefix.edgeChecks.some((check)=>check.supported===false));
  }
});
verify('SOURCE_ONLY_S3_1750_NEVER_SPECULATIVELY_BOUND',()=>{
  assert.equal(a.get('S3:1750').state,'UNEMITTED');
  assert.equal(b.get('S3:1750').state,'UNEMITTED');
});
verify('ORIGINAL_OWNER_GOLDEN_STILL_EXPLICITLY_BLOCKED',()=>{
  assert.equal(golden.schema,'CiiOwnerLexicalReconciliation.v1');
  assert.equal(golden.status,'BLOCKED_AUTHENTIC_OWNER_GOLDEN_MISSING');
  assert.deepEqual(golden.blockers,['COMPLETE_ORIGINAL_OWNER_LEXICAL_TEXT_REQUIRED']);
  assert.equal(golden.ownerAccepted,false);
  assert.equal(golden.canAuthorizeWriter2,false);
  assert.equal(golden.evidenceContext?.completeOwnerTablePresent,false);
  assert.equal(golden.evidenceContext?.partialOracleIsFullGolden,false);
});
const report={
  schema:'CiiMethodATechnicalQualification.v1',headBasis:'EXACT_HEAD_ARTIFACTS_FROM_NATIVE_RETAINED_TEST_RUN',
  status:'TECHNICAL_SOURCE_CENSUS_AND_GATING_PASS_OWNER_ACCEPTANCE_BLOCKED',
  ownerAccepted:false,mergeAuthorized:false,defaultTerminalOptInEnabled:false,
  population:150,defaultCounts:{BOUND:105,UNRESOLVED:11,UNEMITTED:34,AMBIGUOUS:0},
  optedInCounts:{BOUND:111,UNRESOLVED:11,UNEMITTED:28,AMBIGUOUS:0},
  qualifiedExteriorPairs:expected,
  remainingOptInNonBound:39,
  checks:assertions,
  evidenceDigests:{
    defaultCensus:digest('source-target-census.json'),
    optedInCensus:digest('source-target-census-optin.json'),
    exteriorTrace:digest('terminal-tail-forensics.json'),
    blockedGoldenReceipt:digest('owner-golden-readiness.json'),
  },
  caveat:'HOSTED_BROWSER_AND_WRITER2_JOB_RESULTS_MUST_BE_READ_FROM_EXACT_HEAD_CI_NOT_THIS_JSON',
};
mkdirSync(dir,{recursive:true});
writeFileSync(join(dir,'technical-qualification.json'),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify({schema:report.schema,status:report.status,checks:assertions.length,
  defaultCounts:report.defaultCounts,optedInCounts:report.optedInCounts,
  ownerAccepted:false,mergeAuthorized:false},null,2));
console.log('CII REC-05 retained technical census and Owner custody separation: PASS');
