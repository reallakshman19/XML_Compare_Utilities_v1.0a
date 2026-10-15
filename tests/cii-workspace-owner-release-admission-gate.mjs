import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// REC-06 deliberately reports the absence of admission inputs; it has no
// function or flag that can grant Owner acceptance, enable a feature or merge.
const dir = fileURLToPath(new URL('../test-results/cii-method-a-qualification/', import.meta.url));
const read = (filename) => JSON.parse(readFileSync(join(dir,filename),'utf8'));
const sha256 = (filename) => createHash('sha256').update(readFileSync(join(dir,filename))).digest('hex');
const tech = read('technical-qualification.json');
const golden = read('owner-golden-readiness.json');
const audit = read('source-target-census.json');
const optIn = read('source-target-census-optin.json');
const source = readFileSync(fileURLToPath(new URL(
  '../tabs/cii-workspace/cii-workspace-multi-base-correspondence.js',import.meta.url)), 'utf8');
assert.equal(tech.schema,'CiiMethodATechnicalQualification.v1');
assert.equal(tech.status,'TECHNICAL_SOURCE_CENSUS_AND_GATING_PASS_OWNER_ACCEPTANCE_BLOCKED');
assert.equal(tech.checks.length,9);
assert(tech.checks.every((check) => check.status === 'PASS'));
assert.equal(tech.ownerAccepted,false);
assert.equal(tech.mergeAuthorized,false);
assert.equal(tech.defaultTerminalOptInEnabled,false);
assert.equal(golden.status,'BLOCKED_AUTHENTIC_OWNER_GOLDEN_MISSING');
assert.deepEqual(golden.blockers,['COMPLETE_ORIGINAL_OWNER_LEXICAL_TEXT_REQUIRED']);
assert.equal(golden.ownerAccepted,false);
assert.equal(golden.canAuthorizeWriter2,false);
assert.equal(golden.evidenceContext.completeOwnerTablePresent,false);
assert.equal(golden.evidenceContext.partialOracleIsFullGolden,false);
assert(source.includes('if (options.methodATerminalContinuation !== true)'),
  'terminal propagation must stay disabled by default in production source');
assert.equal(audit.summary.BOUND,105);
assert.equal(optIn.summary.BOUND,111);
assert.equal(tech.evidenceDigests.defaultCensus,sha256('source-target-census.json'));
assert.equal(tech.evidenceDigests.optedInCensus,sha256('source-target-census-optin.json'));
assert.equal(tech.evidenceDigests.blockedGoldenReceipt,sha256('owner-golden-readiness.json'));

const phaseInputs = [
  ['PH0','Owner-approved work-specific v3.6 relay/AIM label, pinned plan YAML and authorized lab'],
  ['PH1','Owner review/acceptance of representative physical NODE confidence score, grade and conditioning evidence'],
  ['PH2','Owner review/acceptance of confidence policy and effective UI/audit behavior'],
  ['PH3','Owner review/acceptance of propagation, cross-member TARGET custody and complete 150-node inventory'],
  ['PH4','Authenticated *complete* raw Owner PS↔SL lexical table, attested count/hash and ambiguity adjudication'],
  ['PH5','Owner review/acceptance of governed correspondence corrections and independently constrained Writer1C/Writer2 scope'],
  ['PH6','Owner review/acceptance of retained S1/S2/S3→T end-to-end raw-byte and UI evidence'],
  ['PH7','Explicit Owner release/merge authorization plus required final PR review/acceptance'],
];
const phases = phaseInputs.map(([phase,necessaryOwnerEvidence])=>({
  phase, ownerAcceptance:'NOT_PROVIDED_TO_THIS_GATE', necessaryOwnerEvidence,
  technicalEvidenceDoesNotSubstituteForOwnerAcceptance:true,
}));
const blockers = [
  'AUTHENTIC_COMPLETE_OWNER_LEXICAL_GOLDEN_NOT_SUPPLIED',
  'OWNER_ATTESTED_RAW_SHA256_ROW_COUNT_AND_PROVENANCE_NOT_SUPPLIED',
  'OWNER_ADJUDICATION_OF_REPEATED_AND_ANOMALOUS_LABELS_NOT_SUPPLIED',
  'WORK_SPECIFIC_V3_6_APPROVED_AIM_PLAN_LABEL_SHA_AND_AUTHORIZED_LAB_NOT_SUPPLIED',
  'PH0_TO_PH7_OWNER_SIGNOFF_NOT_PRESENT_IN_THIS_EVIDENCE_INPUT',
  'EXPLICIT_PR68_MERGE_AND_DEFAULT_ENABLE_AUTHORITY_NOT_SUPPLIED',
];
const report = {
  schema:'CiiWriter2OwnerReleaseAdmissionHold.v1',
  evidenceRole:'NON_Authorizing_MACHINE_READABLE_RELEASE_HOLD',
  headSha:process.env.GITHUB_SHA||null,
  hostedRunId:process.env.GITHUB_RUN_ID||null,
  parentIssue:'https://github.com/reallakshman19/XML_Compare_Utilities/issues/69',
  pr:'https://github.com/reallakshman19/XML_Compare_Utilities/pull/68',
  admission:'BLOCKED_OWNER_EXTERNAL_EVIDENCE_REQUIRED',
  technicalInvariantCount:tech.checks.length,
  technicalInvariantPassCount:tech.checks.filter(x=>x.status==='PASS').length,
  retainedSourceNodePopulation:150,
  originalBoundNodeCount:105,
  explicitlyOptedInBoundNodeCount:111,
  optInDefaultEnabled:false,
  ownerPhases:phases,
  ownerAcceptedPhasesFromSuppliedEvidence:0,
  totalOwnerPhases:phases.length,
  fullGoldenStatus:golden.status,
  completeOwnerOriginalRowsSupplied:false,
  mergeAuthorization:false,
  releaseAuthorization:false,
  blockers,
  separatelyRequiredExternalChecks:[
    'Inspect actual authenticated Owner attestation and work-specific v3.6 protocol artifacts',
    'Reconcile every original Owner lexical row and obtain explicit ambiguity disposition',
    'Review exact-head GitHub Actions all four jobs, PR reviews, and branch protection separately',
    'Require explicit Owner decision on default-enabling terminal continuation and merging PR #68',
  ],
  evidenceSha256:{
    technicalQualification:sha256('technical-qualification.json'),
    ownerGoldenReadiness:sha256('owner-golden-readiness.json'),
    defaultSourceCensus:sha256('source-target-census.json'),
    optedInSourceCensus:sha256('source-target-census-optin.json'),
  },
  noAutomaticAuthority:'CI_SUCCESS_IS_NOT_OWNER_ACCEPTANCE_NOR_MERGE_AUTHORIZATION',
};
assert.equal(phases.length,8);
assert.equal(report.admission,'BLOCKED_OWNER_EXTERNAL_EVIDENCE_REQUIRED');
assert.equal(report.mergeAuthorization,false);
mkdirSync(dir,{recursive:true});
writeFileSync(join(dir,'owner-release-admission-hold.json'),JSON.stringify(report,null,2)+'\n','utf8');
const markdown=[
 '# CIIW69 REC-06 Owner admission handoff — HOLD',
 '',
 'This record is an independently generated technical gate, not an Owner sign-off.',
 'Exact GitHub commit: '+(report.headSha||'unbound local fixture'), 
 'GitHub Actions run: '+(report.hostedRunId||'unbound local fixture'),
 '',
 '**Technical 9/9**; default BOUND 105/150; explicitly enabled BOUND 111/150.',
 '**Owner acceptance 0/8 evidenced in this runner. Release HOLD; merge HOLD; default opt-in OFF.**',
 'Complete authentic Owner golden: '+golden.status+'.',
 '',
 '## External prerequisites',
 ...blockers.map((b)=>'- '+b),
 '',
 '## Eight separate Owner decisions required',
 ...phases.map((p)=>'- '+p.phase+': '+p.necessaryOwnerEvidence),
 '',
 '## Evidence SHA-256',
 ...Object.entries(report.evidenceSha256).map(([name,sha])=>'- '+name+': '+sha),
 '',
 'Neither a passing Node test nor a self-authored checksum creates Owner authorization.',
].join('\n');
writeFileSync(join(dir,'owner-release-admission-hold.md'),markdown+'\n','utf8');
console.log('CII REC-06 non-authorizing admission HOLD: PASS (Owner acceptance and merge remain BLOCKED)');
console.log(JSON.stringify({head:report.headSha,technical:report.technicalInvariantPassCount,
 phases:report.totalOwnerPhases,admission:report.admission,mergeAuthorization:false},null,2));
