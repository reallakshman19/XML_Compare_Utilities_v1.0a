import assert from 'node:assert/strict';
import {
  PIPELINE_APPROVED_CATALOG_QUALIFICATION_TESTS,
  buildPipelineApprovedCatalogQualificationJson,
  runPipelineApprovedCatalogQualification,
} from '../scripts/run-pipeline-approved-catalog-qualification.mjs';
import {
  PIPELINE_APPROVED_CATALOG_EVIDENCE_VERIFICATION_SCHEMA,
  PIPELINE_APPROVED_CATALOG_EVIDENCE_VERIFIER_VERSION,
  buildPipelineApprovedCatalogEvidenceVerificationJson,
  verifyPipelineApprovedCatalogQualificationEvidence,
  _internal,
} from '../scripts/verify-pipeline-approved-catalog-qualification-evidence.mjs';

const baseline = 'a'.repeat(40);

function harnessResult({ clockStep = 1, stdout = null } = {}) {
  let now = 0;
  return runPipelineApprovedCatalogQualification({
    baselineCommit: baseline,
    repoRoot: '/repo',
    exists: () => true,
    headResolver: () => baseline,
    worktreeResolver: () => '',
    runner: (_command, [path]) => ({
      status: 0,
      signal: null,
      stdout: stdout == null ? `${path}: PASS\n` : stdout,
      stderr: '',
    }),
    clock: () => {
      const value = now;
      now += clockStep;
      return value;
    },
  });
}

function canonical(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function modifiedEvidence(source, mutate) {
  const value = structuredClone(source);
  mutate(value);
  return canonical(value);
}

function blocked(rawEvidence, code, expectedBaseline = baseline) {
  const verification = verifyPipelineApprovedCatalogQualificationEvidence({
    rawEvidence,
    expectedBaseline,
  });
  assert.equal(verification.ready, false, `expected ${code} to block verification`);
  assert.ok(verification.blockerCodes.includes(code),
    `${code} not found in ${verification.blockerCodes}`);
  return verification;
}

const result = harnessResult();
assert.equal(result.ready, true);
assert.equal(result.results.length, PIPELINE_APPROVED_CATALOG_QUALIFICATION_TESTS.length);
const raw = `${buildPipelineApprovedCatalogQualificationJson(result)}\n`;
const verification = verifyPipelineApprovedCatalogQualificationEvidence({
  rawEvidence: raw,
  expectedBaseline: baseline.toUpperCase(),
});
assert.equal(verification.schema, PIPELINE_APPROVED_CATALOG_EVIDENCE_VERIFICATION_SCHEMA);
assert.equal(verification.verifierVersion, PIPELINE_APPROVED_CATALOG_EVIDENCE_VERIFIER_VERSION);
assert.equal(verification.expectedBaseline, baseline);
assert.equal(verification.evidenceSchema, result.schema);
assert.equal(verification.harnessVersion, result.harnessVersion);
assert.equal(verification.evidenceByteLength, Buffer.byteLength(raw));
assert.match(verification.evidenceSha256, /^[a-f0-9]{64}$/);
assert.match(verification.semanticProjectionSha256, /^[a-f0-9]{64}$/);
assert.equal(verification.verifiedTestCount, PIPELINE_APPROVED_CATALOG_QUALIFICATION_TESTS.length);
assert.equal(verification.recomputedOutputDigestCount,
  PIPELINE_APPROVED_CATALOG_QUALIFICATION_TESTS.length * 2);
assert.equal(verification.truncatedOutputDigestCount, 0);
assert.deepEqual(verification.diagnostics, []);
assert.deepEqual(verification.blockerCodes, []);
assert.equal(verification.ready, true);
assert.equal(Object.isFrozen(verification), true);
assert.equal(Object.isFrozen(verification.diagnostics), true);
assert.equal(buildPipelineApprovedCatalogEvidenceVerificationJson(verification),
  JSON.stringify(verification, null, 2));
assert.deepEqual(verification, verifyPipelineApprovedCatalogQualificationEvidence({
  rawEvidence: Buffer.from(raw, 'utf8'), expectedBaseline: baseline,
}));

const differentTimingResult = harnessResult({ clockStep: 7 });
const differentTimingRaw = canonical(differentTimingResult);
const differentTimingVerification = verifyPipelineApprovedCatalogQualificationEvidence({
  rawEvidence: differentTimingRaw,
  expectedBaseline: baseline,
});
assert.equal(differentTimingVerification.ready, true);
assert.notEqual(differentTimingVerification.evidenceSha256, verification.evidenceSha256);
assert.equal(differentTimingVerification.semanticProjectionSha256,
  verification.semanticProjectionSha256);

blocked(JSON.stringify(result), 'PIPELINE_APPROVED_CATALOG_EVIDENCE_NONCANONICAL');
const duplicateReady = raw.replace(/\n  "ready": true\n}\n$/,
  '\n  "ready": true,\n  "ready": true\n}\n');
blocked(duplicateReady, 'PIPELINE_APPROVED_CATALOG_EVIDENCE_NONCANONICAL');
blocked('{ invalid\n', 'PIPELINE_APPROVED_CATALOG_EVIDENCE_JSON_INVALID');
blocked(Buffer.from([0xc3, 0x28]), 'PIPELINE_APPROVED_CATALOG_EVIDENCE_UTF8_INVALID');
blocked({}, 'PIPELINE_APPROVED_CATALOG_EVIDENCE_INPUT_INVALID');
blocked(raw, 'PIPELINE_APPROVED_CATALOG_EVIDENCE_EXPECTED_BASELINE_INVALID', 'main');
blocked(raw, 'PIPELINE_APPROVED_CATALOG_EVIDENCE_BASELINE_INVALID', 'b'.repeat(40));

blocked(modifiedEvidence(result, (value) => { value.extra = true; }),
  'PIPELINE_APPROVED_CATALOG_EVIDENCE_TOP_LEVEL_FIELDS_INVALID');
blocked(modifiedEvidence(result, (value) => { value.schema = 'Wrong.v1'; }),
  'PIPELINE_APPROVED_CATALOG_EVIDENCE_SCHEMA_INVALID');
blocked(modifiedEvidence(result, (value) => { value.harnessVersion = 'Wrong'; }),
  'PIPELINE_APPROVED_CATALOG_EVIDENCE_SCHEMA_INVALID');
blocked(modifiedEvidence(result, (value) => { value.baselineCommit = 'b'.repeat(40); }),
  'PIPELINE_APPROVED_CATALOG_EVIDENCE_BASELINE_INVALID');
blocked(modifiedEvidence(result, (value) => { value.repositoryHead = 'b'.repeat(40); }),
  'PIPELINE_APPROVED_CATALOG_EVIDENCE_BASELINE_INVALID');
blocked(modifiedEvidence(result, (value) => { value.worktreeClean = false; }),
  'PIPELINE_APPROVED_CATALOG_EVIDENCE_WORKTREE_INVALID');

blocked(modifiedEvidence(result, (value) => { value.testPlan.reverse(); }),
  'PIPELINE_APPROVED_CATALOG_EVIDENCE_TEST_PLAN_ENTRY_INVALID');
blocked(modifiedEvidence(result, (value) => { value.testPlan[0].extra = true; }),
  'PIPELINE_APPROVED_CATALOG_EVIDENCE_TEST_PLAN_ENTRY_INVALID');
blocked(modifiedEvidence(result, (value) => { value.testPlan.pop(); }),
  'PIPELINE_APPROVED_CATALOG_EVIDENCE_TEST_PLAN_INVALID');
blocked(modifiedEvidence(result, (value) => { value.results.pop(); }),
  'PIPELINE_APPROVED_CATALOG_EVIDENCE_RESULT_COUNT_INVALID');
blocked(modifiedEvidence(result, (value) => { value.results[0].extra = true; }),
  'PIPELINE_APPROVED_CATALOG_EVIDENCE_RESULT_FIELDS_INVALID');
blocked(modifiedEvidence(result, (value) => { value.results[0].path = 'tests/other.js'; }),
  'PIPELINE_APPROVED_CATALOG_EVIDENCE_RESULT_IDENTITY_INVALID');
blocked(modifiedEvidence(result, (value) => { value.results[0].command = ['node', 'other.js']; }),
  'PIPELINE_APPROVED_CATALOG_EVIDENCE_RESULT_IDENTITY_INVALID');
blocked(modifiedEvidence(result, (value) => { value.results[0].exitCode = 1; }),
  'PIPELINE_APPROVED_CATALOG_EVIDENCE_RESULT_STATUS_INVALID');
blocked(modifiedEvidence(result, (value) => { value.results[0].signal = 'SIGTERM'; }),
  'PIPELINE_APPROVED_CATALOG_EVIDENCE_RESULT_STATUS_INVALID');
blocked(modifiedEvidence(result, (value) => { value.results[0].durationMs = -1; }),
  'PIPELINE_APPROVED_CATALOG_EVIDENCE_RESULT_DURATION_INVALID');
blocked(modifiedEvidence(result, (value) => {
  value.results[0].durationMs = Number.MAX_SAFE_INTEGER + 1;
}), 'PIPELINE_APPROVED_CATALOG_EVIDENCE_RESULT_DURATION_INVALID');
blocked(modifiedEvidence(result, (value) => { value.results[0].stdoutExcerpt = 'completed'; }),
  'PIPELINE_APPROVED_CATALOG_EVIDENCE_PASS_SENTINEL_INVALID');
blocked(modifiedEvidence(result, (value) => { value.results[0].stdoutSha256 = 'bad'; }),
  'PIPELINE_APPROVED_CATALOG_EVIDENCE_OUTPUT_HASH_INVALID');
blocked(modifiedEvidence(result, (value) => { value.results[0].stdoutSha256 = 'f'.repeat(64); }),
  'PIPELINE_APPROVED_CATALOG_EVIDENCE_OUTPUT_HASH_MISMATCH');
blocked(modifiedEvidence(result, (value) => {
  value.results[0].stdoutExcerpt = 'short\n...[OUTPUT TRUNCATED]...\nshort: PASS\n';
}), 'PIPELINE_APPROVED_CATALOG_EVIDENCE_TRUNCATION_FORMAT_INVALID');
blocked(modifiedEvidence(result, (value) => { value.results[0].ready = false; }),
  'PIPELINE_APPROVED_CATALOG_EVIDENCE_RESULT_STATUS_INVALID');
blocked(modifiedEvidence(result, (value) => {
  value.diagnostics.push({ severity: 'BLOCKING', code: 'FORGED', details: {} });
}), 'PIPELINE_APPROVED_CATALOG_EVIDENCE_DIAGNOSTICS_PRESENT');
blocked(modifiedEvidence(result, (value) => { value.blockerCodes.push('FORGED'); }),
  'PIPELINE_APPROVED_CATALOG_EVIDENCE_BLOCKERS_PRESENT');
blocked(modifiedEvidence(result, (value) => { value.ready = false; }),
  'PIPELINE_APPROVED_CATALOG_EVIDENCE_AGGREGATE_NOT_READY');

const longOutput = `${'x'.repeat(5000)}\nlong fixture: PASS\n`;
const truncatedResult = harnessResult({ stdout: longOutput });
const truncatedVerification = verifyPipelineApprovedCatalogQualificationEvidence({
  rawEvidence: canonical(truncatedResult),
  expectedBaseline: baseline,
});
assert.equal(truncatedVerification.ready, true);
assert.equal(truncatedVerification.truncatedOutputDigestCount,
  PIPELINE_APPROVED_CATALOG_QUALIFICATION_TESTS.length);
assert.equal(truncatedVerification.recomputedOutputDigestCount,
  PIPELINE_APPROVED_CATALOG_QUALIFICATION_TESTS.length);
assert.equal(_internal.TRUNCATED_SIDE_LENGTH, 2032);

assert.deepEqual(_internal.cliArguments([
  '--evidence', '/tmp/evidence.json', '--expected-baseline', baseline,
]), { evidencePath: '/tmp/evidence.json', expectedBaseline: baseline });
const readFailure = _internal.readFailureVerification(baseline,
  Object.assign(new Error('missing'), { code: 'ENOENT' }), '/tmp/missing.json');
assert.equal(readFailure.ready, false);
assert.ok(readFailure.blockerCodes.includes(
  'PIPELINE_APPROVED_CATALOG_EVIDENCE_READ_FAILED'));

console.log('pipeline-3d approved catalog qualification evidence verifier: PASS');
