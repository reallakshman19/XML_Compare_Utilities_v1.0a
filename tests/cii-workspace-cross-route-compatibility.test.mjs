import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Test-only REC-05 compatibility qualification. Do not import golden labels,
// production Writer2 write authority or approval state from this runner.
const root = fileURLToPath(new URL('../', import.meta.url));
const outDir = join(root, 'test-results/cii-method-a-qualification');
const groups = Object.freeze({
  writer1c: Object.freeze([
    'tests/cii-workspace-writer1c-byte-custody.test.js',
    'tests/cii-workspace-writer1c-element-custody-hardening.test.js',
    'tests/cii-workspace-writer1c-nodename.test.js',
    'tests/cii-workspace-writer1c-benchmark-roundtrip.test.js',
  ]),
  genericReviewExport: Object.freeze([
    'tests/cii-workspace-multisource-review-only.test.js',
    'tests/cii-workspace-multisource-review-only-router.test.js',
    'tests/cii-workspace-multisource-review-state.test.js',
    'tests/cii-workspace-multisource-review-ui.test.js',
    'tests/cii-workspace-compare-review-export.test.js',
    'tests/cii-workspace-export-audit.test.js',
  ]),
});
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fixturePaths = [
  'Benchmark/S1.CII', 'Benchmark/S2.CII', 'Benchmark/S3.CII',
  'Benchmark/T.CII', 'Benchmark/CIICompare/BM_CII_TARGET1.CII',
];
const fixtureHashes = Object.fromEntries(fixturePaths.map((p) => {
  const absolute = join(root, p);
  if (!existsSync(absolute)) throw new Error('QUALIFICATION_FIXTURE_ABSENT:' + p);
  return [p, digest(readFileSync(absolute))];
}));
const expected = Object.freeze({
  'Benchmark/S1.CII': '9a9cb14db4c13f5aac41cc74a60e7e528722eb5003d09f07192762ab6bfb1a2b',
  'Benchmark/S2.CII': '7ec48b76b65eedfd5ecc9c8e8feca1a45dd8c83721a68b53aa0db3363e6d27fd',
  'Benchmark/S3.CII': 'c2143b31c482158ac5514d2709406c14a9179e656277c654e932bb845d090caa',
  'Benchmark/T.CII': 'abfa3ffc9281fe75d4170b2d885d554cb1f120dadedae7c7ab609548b63cc060',
});
for (const [p, sha] of Object.entries(expected)) {
  if (fixtureHashes[p] !== sha) throw new Error('QUALIFICATION_FROZEN_FIXTURE_SHA_MISMATCH:' + p);
}

const checks = [];
for (const [group, tests] of Object.entries(groups)) {
  for (const testPath of tests) {
    const fileBytes = readFileSync(join(root,testPath));
    const result = spawnSync(process.execPath, [testPath], {
      cwd: root, encoding: 'utf8', timeout: 240000, maxBuffer: 16 * 1024 * 1024,
    });
    const success = result.status === 0 && !result.error && result.signal === null;
    const record = {
      group, path: testPath, sha256: digest(fileBytes),
      status: success ? 'PASS' : 'FAIL',
      exitCode: result.status, signal: result.signal,
      failure: result.error ? String(result.error) : null,
      stdoutTail: (result.stdout || '').slice(-900),
      stderrTail: success ? '' : (result.stderr || '').slice(-1500),
    };
    checks.push(record);
    console.log(group + ' :: ' + testPath + ' :: ' + record.status);
    if (!success) console.error(JSON.stringify(record,null,2));
  }
}
const cases = Object.fromEntries(Object.entries(groups).map(([group,paths])=>[group, {
  total: paths.length,
  passed: checks.filter((c)=>c.group===group&&c.status==='PASS').length,
}]));
const failed = checks.filter((c)=>c.status!=='PASS');
const report = {
  schema:'CiiWriter2CrossRouteQualification.v1',
  evidenceRole:'NATIVE_TEST_COMPATIBILITY_NOT_OWNER_ACCEPTANCE',
  headSha: process.env.GITHUB_SHA || null,
  hostedRunId: process.env.GITHUB_RUN_ID || null,
  status: failed.length ? 'FAIL' : 'PASS',
  fixtureHashes, caseGroups:cases,
  totalCases:checks.length, passedCases:checks.length-failed.length,
  checks, 
  limitation:'Writer1C BM_CII_TARGET1 in-memory round trip is independent of S1/S2/S3/T Writer2 output; REVIEW_ONLY never produces modified-target bytes.',
  ownerAccepted:false, mergeAuthorized:false,
};
mkdirSync(outDir,{recursive:true});
writeFileSync(join(outDir,'cross-route-compatibility.json'),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify({schema:report.schema,status:report.status,
  groups:cases,total:report.totalCases,passed:report.passedCases,
  ownerAccepted:false},null,2));
if (failed.length) process.exitCode = 1;
