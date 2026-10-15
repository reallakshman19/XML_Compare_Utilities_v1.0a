import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TextDecoder } from 'node:util';
import { fileURLToPath } from 'node:url';
import {
  PIPELINE_APPROVED_CATALOG_QUALIFICATION_HARNESS_VERSION,
  PIPELINE_APPROVED_CATALOG_QUALIFICATION_SCHEMA,
  PIPELINE_APPROVED_CATALOG_QUALIFICATION_TESTS,
} from './run-pipeline-approved-catalog-qualification.mjs';

export const PIPELINE_APPROVED_CATALOG_EVIDENCE_VERIFICATION_SCHEMA =
  'PipelineApprovedCatalogQualificationEvidenceVerification.v1';
export const PIPELINE_APPROVED_CATALOG_EVIDENCE_VERIFIER_VERSION = 'TRI-2F-B.1';

const SHA40 = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const PASS_SENTINEL = /:\s*PASS\s*$/;
const TRUNCATION_MARKER = '...[OUTPUT TRUNCATED]...';
const TRUNCATION_SEPARATOR = `\n${TRUNCATION_MARKER}\n`;
const TRUNCATED_SIDE_LENGTH = Math.floor((4096 - 32) / 2);
const MAX_EVIDENCE_BYTES = 16 * 1024 * 1024;
const TOP_LEVEL_KEYS = Object.freeze([
  'schema',
  'harnessVersion',
  'baselineCommit',
  'repositoryHead',
  'worktreeClean',
  'testPlan',
  'results',
  'diagnostics',
  'blockerCodes',
  'ready',
]);
const TEST_KEYS = Object.freeze(['id', 'path']);
const RESULT_KEYS = Object.freeze([
  'id',
  'path',
  'command',
  'exitCode',
  'signal',
  'durationMs',
  'stdoutSha256',
  'stderrSha256',
  'stdoutExcerpt',
  'stderrExcerpt',
  'ready',
]);

function plain(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value)));
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function text(value) {
  return String(value ?? '');
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function diagnostic(code, message, details = {}) {
  return freeze({ severity: 'BLOCKING', code, message, details: freeze({ ...details }) });
}

function uniqueDiagnostics(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.code}:${JSON.stringify(item.details || {})}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function exactKeys(value, expectedKeys) {
  return plain(value) && same(Object.keys(value), expectedKeys);
}

function rawBytes(rawEvidence) {
  if (typeof rawEvidence === 'string') return Buffer.from(rawEvidence, 'utf8');
  if (Buffer.isBuffer(rawEvidence) || rawEvidence instanceof Uint8Array) {
    return Buffer.from(rawEvidence);
  }
  return null;
}

function semanticProjection(evidence) {
  return {
    schema: evidence?.schema ?? null,
    harnessVersion: evidence?.harnessVersion ?? null,
    baselineCommit: evidence?.baselineCommit ?? null,
    repositoryHead: evidence?.repositoryHead ?? null,
    worktreeClean: evidence?.worktreeClean ?? null,
    testPlan: Array.isArray(evidence?.testPlan)
      ? evidence.testPlan.map((item) => ({ id: item?.id ?? null, path: item?.path ?? null })) : null,
    results: Array.isArray(evidence?.results) ? evidence.results.map((item) => ({
      id: item?.id ?? null,
      path: item?.path ?? null,
      command: item?.command ?? null,
      exitCode: item?.exitCode ?? null,
      signal: item?.signal ?? null,
      stdoutSha256: item?.stdoutSha256 ?? null,
      stderrSha256: item?.stderrSha256 ?? null,
      stdoutExcerpt: item?.stdoutExcerpt ?? null,
      stderrExcerpt: item?.stderrExcerpt ?? null,
      ready: item?.ready ?? null,
    })) : null,
    diagnostics: evidence?.diagnostics ?? null,
    blockerCodes: evidence?.blockerCodes ?? null,
    ready: evidence?.ready ?? null,
  };
}

function canonicalProjectionBytes(evidence) {
  return Buffer.from(`${JSON.stringify(semanticProjection(evidence), null, 2)}\n`, 'utf8');
}

function decodeAndParse(bytes, diagnostics) {
  if (!bytes) {
    diagnostics.push(diagnostic(
      'PIPELINE_APPROVED_CATALOG_EVIDENCE_INPUT_INVALID',
      'Qualification evidence must be a UTF-8 string, Buffer, or Uint8Array.',
    ));
    return null;
  }
  if (bytes.length === 0 || bytes.length > MAX_EVIDENCE_BYTES) {
    diagnostics.push(diagnostic(
      'PIPELINE_APPROVED_CATALOG_EVIDENCE_SIZE_INVALID',
      'Qualification evidence must be nonempty and within the verifier size limit.',
      { evidenceByteLength: bytes.length, maximumByteLength: MAX_EVIDENCE_BYTES },
    ));
    return null;
  }
  let decoded;
  try {
    decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (error) {
    diagnostics.push(diagnostic(
      'PIPELINE_APPROVED_CATALOG_EVIDENCE_UTF8_INVALID',
      'Qualification evidence is not valid UTF-8.',
      { message: error?.message ?? String(error) },
    ));
    return null;
  }
  let parsed;
  try {
    parsed = JSON.parse(decoded);
  } catch (error) {
    diagnostics.push(diagnostic(
      'PIPELINE_APPROVED_CATALOG_EVIDENCE_JSON_INVALID',
      'Qualification evidence is not valid JSON.',
      { message: error?.message ?? String(error) },
    ));
    return null;
  }
  let canonical;
  try {
    canonical = Buffer.from(`${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
  } catch (error) {
    diagnostics.push(diagnostic(
      'PIPELINE_APPROVED_CATALOG_EVIDENCE_CANONICALIZATION_FAILED',
      'Qualification evidence could not be canonically serialized.',
      { message: error?.message ?? String(error) },
    ));
    return null;
  }
  if (!bytes.equals(canonical)) diagnostics.push(diagnostic(
    'PIPELINE_APPROVED_CATALOG_EVIDENCE_NONCANONICAL',
    'Qualification evidence bytes must exactly equal JSON.stringify(result, null, 2) plus one LF.',
    { suppliedByteLength: bytes.length, canonicalByteLength: canonical.length },
  ));
  return parsed;
}

function validateTestPlan(evidence, diagnostics) {
  const testPlan = evidence?.testPlan;
  if (!Array.isArray(testPlan) || testPlan.length !== PIPELINE_APPROVED_CATALOG_QUALIFICATION_TESTS.length) {
    diagnostics.push(diagnostic(
      'PIPELINE_APPROVED_CATALOG_EVIDENCE_TEST_PLAN_INVALID',
      'Evidence must retain the exact approved qualification test plan.',
      { expectedCount: PIPELINE_APPROVED_CATALOG_QUALIFICATION_TESTS.length,
        actualCount: Array.isArray(testPlan) ? testPlan.length : null },
    ));
    return;
  }
  testPlan.forEach((item, testIndex) => {
    const expected = PIPELINE_APPROVED_CATALOG_QUALIFICATION_TESTS[testIndex];
    if (!exactKeys(item, TEST_KEYS) || item.id !== expected.id || item.path !== expected.path) {
      diagnostics.push(diagnostic(
        'PIPELINE_APPROVED_CATALOG_EVIDENCE_TEST_PLAN_ENTRY_INVALID',
        'Every evidence test-plan entry must exactly match the approved ID, path and field set.',
        { testIndex, expected, actual: item },
      ));
    }
  });
}

function validateOutputDigest(result, kind, diagnostics, counters) {
  const hashField = `${kind}Sha256`;
  const excerptField = `${kind}Excerpt`;
  const hash = result?.[hashField];
  const output = result?.[excerptField];
  if (!SHA256.test(text(hash))) {
    diagnostics.push(diagnostic(
      'PIPELINE_APPROVED_CATALOG_EVIDENCE_OUTPUT_HASH_INVALID',
      'Each output hash must be a lowercase 64-hex SHA-256 value.',
      { id: result?.id, field: hashField, value: hash },
    ));
    return;
  }
  if (typeof output !== 'string') {
    diagnostics.push(diagnostic(
      'PIPELINE_APPROVED_CATALOG_EVIDENCE_OUTPUT_EXCERPT_INVALID',
      'Each output excerpt must be a string.',
      { id: result?.id, field: excerptField },
    ));
    return;
  }
  if (output.includes(TRUNCATION_MARKER)) {
    const parts = output.split(TRUNCATION_SEPARATOR);
    if (parts.length !== 2 || parts[0].length !== TRUNCATED_SIDE_LENGTH
      || parts[1].length !== TRUNCATED_SIDE_LENGTH) {
      diagnostics.push(diagnostic(
        'PIPELINE_APPROVED_CATALOG_EVIDENCE_TRUNCATION_FORMAT_INVALID',
        'Truncated output evidence must retain the exact TRI-2F-A head, marker and tail geometry.',
        { id: result?.id, field: excerptField, excerptLength: output.length,
          expectedSideLength: TRUNCATED_SIDE_LENGTH },
      ));
      return;
    }
    counters.truncated += 1;
    return;
  }
  counters.recomputed += 1;
  const actual = sha256(Buffer.from(output, 'utf8'));
  if (actual !== hash) diagnostics.push(diagnostic(
    'PIPELINE_APPROVED_CATALOG_EVIDENCE_OUTPUT_HASH_MISMATCH',
    'A fully retained output excerpt does not match its recorded SHA-256 digest.',
    { id: result?.id, field: hashField, expected: hash, actual },
  ));
}

function validateResults(evidence, diagnostics, counters) {
  const results = evidence?.results;
  if (!Array.isArray(results) || results.length !== PIPELINE_APPROVED_CATALOG_QUALIFICATION_TESTS.length) {
    diagnostics.push(diagnostic(
      'PIPELINE_APPROVED_CATALOG_EVIDENCE_RESULT_COUNT_INVALID',
      'Evidence must retain exactly one result for every approved qualification test.',
      { expectedCount: PIPELINE_APPROVED_CATALOG_QUALIFICATION_TESTS.length,
        actualCount: Array.isArray(results) ? results.length : null },
    ));
    return 0;
  }
  let verifiedTestCount = 0;
  results.forEach((result, resultIndex) => {
    const before = diagnostics.length;
    const expected = PIPELINE_APPROVED_CATALOG_QUALIFICATION_TESTS[resultIndex];
    if (!exactKeys(result, RESULT_KEYS)) diagnostics.push(diagnostic(
      'PIPELINE_APPROVED_CATALOG_EVIDENCE_RESULT_FIELDS_INVALID',
      'Each test result must retain the exact approved result field set and order.',
      { resultIndex, id: result?.id, actualKeys: plain(result) ? Object.keys(result) : null },
    ));
    if (result?.id !== expected.id || result?.path !== expected.path
      || !same(result?.command, ['node', expected.path])) diagnostics.push(diagnostic(
      'PIPELINE_APPROVED_CATALOG_EVIDENCE_RESULT_IDENTITY_INVALID',
      'Each result must match its approved test ID, path, order and normalized command.',
      { resultIndex, expected, actualId: result?.id, actualPath: result?.path,
        actualCommand: result?.command },
    ));
    if (result?.exitCode !== 0 || result?.signal !== null || result?.ready !== true) {
      diagnostics.push(diagnostic(
        'PIPELINE_APPROVED_CATALOG_EVIDENCE_RESULT_STATUS_INVALID',
        'Every qualified result requires exitCode 0, null signal and ready true.',
        { resultIndex, id: result?.id, exitCode: result?.exitCode,
          signal: result?.signal, ready: result?.ready },
      ));
    }
    if (!Number.isSafeInteger(result?.durationMs) || result.durationMs < 0) diagnostics.push(diagnostic(
      'PIPELINE_APPROVED_CATALOG_EVIDENCE_RESULT_DURATION_INVALID',
      'Every qualified result requires a nonnegative safe-integer durationMs.',
      { resultIndex, id: result?.id, durationMs: result?.durationMs },
    ));
    if (typeof result?.stdoutExcerpt !== 'string'
      || !PASS_SENTINEL.test(result.stdoutExcerpt)) diagnostics.push(diagnostic(
      'PIPELINE_APPROVED_CATALOG_EVIDENCE_PASS_SENTINEL_INVALID',
      'Every qualified result requires terminal : PASS evidence in stdoutExcerpt.',
      { resultIndex, id: result?.id },
    ));
    validateOutputDigest(result, 'stdout', diagnostics, counters);
    validateOutputDigest(result, 'stderr', diagnostics, counters);
    if (diagnostics.length === before) verifiedTestCount += 1;
  });
  return verifiedTestCount;
}

function validateEvidence(evidence, expectedBaseline, diagnostics, counters) {
  if (!exactKeys(evidence, TOP_LEVEL_KEYS)) diagnostics.push(diagnostic(
    'PIPELINE_APPROVED_CATALOG_EVIDENCE_TOP_LEVEL_FIELDS_INVALID',
    'Evidence must retain the exact approved top-level field set and order.',
    { actualKeys: plain(evidence) ? Object.keys(evidence) : null },
  ));
  if (evidence?.schema !== PIPELINE_APPROVED_CATALOG_QUALIFICATION_SCHEMA
    || evidence?.harnessVersion !== PIPELINE_APPROVED_CATALOG_QUALIFICATION_HARNESS_VERSION) {
    diagnostics.push(diagnostic(
      'PIPELINE_APPROVED_CATALOG_EVIDENCE_SCHEMA_INVALID',
      'Evidence schema and harness version must match the merged TRI-2F-A contract.',
      { expectedSchema: PIPELINE_APPROVED_CATALOG_QUALIFICATION_SCHEMA,
        actualSchema: evidence?.schema,
        expectedHarnessVersion: PIPELINE_APPROVED_CATALOG_QUALIFICATION_HARNESS_VERSION,
        actualHarnessVersion: evidence?.harnessVersion },
    ));
  }
  if (!SHA40.test(text(evidence?.baselineCommit))
    || evidence?.baselineCommit !== expectedBaseline
    || evidence?.repositoryHead !== expectedBaseline) diagnostics.push(diagnostic(
    'PIPELINE_APPROVED_CATALOG_EVIDENCE_BASELINE_INVALID',
    'Evidence baselineCommit and repositoryHead must exactly match the expected baseline.',
    { expectedBaseline, baselineCommit: evidence?.baselineCommit,
      repositoryHead: evidence?.repositoryHead },
  ));
  if (evidence?.worktreeClean !== true) diagnostics.push(diagnostic(
    'PIPELINE_APPROVED_CATALOG_EVIDENCE_WORKTREE_INVALID',
    'Qualified evidence requires worktreeClean true.',
    { worktreeClean: evidence?.worktreeClean },
  ));
  validateTestPlan(evidence, diagnostics);
  const verifiedTestCount = validateResults(evidence, diagnostics, counters);
  if (!Array.isArray(evidence?.diagnostics) || evidence.diagnostics.length !== 0) {
    diagnostics.push(diagnostic(
      'PIPELINE_APPROVED_CATALOG_EVIDENCE_DIAGNOSTICS_PRESENT',
      'Qualified evidence must contain an empty diagnostics array.',
      { diagnostics: evidence?.diagnostics },
    ));
  }
  if (!Array.isArray(evidence?.blockerCodes) || evidence.blockerCodes.length !== 0) {
    diagnostics.push(diagnostic(
      'PIPELINE_APPROVED_CATALOG_EVIDENCE_BLOCKERS_PRESENT',
      'Qualified evidence must contain an empty blockerCodes array.',
      { blockerCodes: evidence?.blockerCodes },
    ));
  }
  if (evidence?.ready !== true) diagnostics.push(diagnostic(
    'PIPELINE_APPROVED_CATALOG_EVIDENCE_AGGREGATE_NOT_READY',
    'Qualified evidence requires aggregate ready true.',
    { ready: evidence?.ready },
  ));
  return verifiedTestCount;
}

export function verifyPipelineApprovedCatalogQualificationEvidence({
  rawEvidence = null,
  expectedBaseline = '',
} = {}) {
  const diagnostics = [];
  const bytes = rawBytes(rawEvidence);
  const normalizedExpectedBaseline = text(expectedBaseline).trim().toLowerCase();
  const evidenceSha256 = bytes ? sha256(bytes) : null;
  if (!SHA40.test(normalizedExpectedBaseline)) diagnostics.push(diagnostic(
    'PIPELINE_APPROVED_CATALOG_EVIDENCE_EXPECTED_BASELINE_INVALID',
    'Evidence verification requires an exact lowercase or uppercase 40-hex expected baseline.',
    { expectedBaseline: text(expectedBaseline).trim() },
  ));
  const evidence = decodeAndParse(bytes, diagnostics);
  const counters = { recomputed: 0, truncated: 0 };
  let verifiedTestCount = 0;
  if (plain(evidence) && SHA40.test(normalizedExpectedBaseline)) {
    verifiedTestCount = validateEvidence(evidence, normalizedExpectedBaseline,
      diagnostics, counters);
  } else if (evidence !== null && !plain(evidence)) diagnostics.push(diagnostic(
    'PIPELINE_APPROVED_CATALOG_EVIDENCE_OBJECT_INVALID',
    'Qualification evidence JSON must contain one top-level plain object.',
  ));
  const semanticBytes = canonicalProjectionBytes(evidence);
  const frozenDiagnostics = freeze(uniqueDiagnostics(diagnostics));
  return freeze({
    schema: PIPELINE_APPROVED_CATALOG_EVIDENCE_VERIFICATION_SCHEMA,
    verifierVersion: PIPELINE_APPROVED_CATALOG_EVIDENCE_VERIFIER_VERSION,
    expectedBaseline: normalizedExpectedBaseline,
    evidenceSchema: evidence?.schema ?? null,
    harnessVersion: evidence?.harnessVersion ?? null,
    evidenceByteLength: bytes?.length ?? 0,
    evidenceSha256,
    semanticProjectionSha256: sha256(semanticBytes),
    verifiedTestCount,
    recomputedOutputDigestCount: counters.recomputed,
    truncatedOutputDigestCount: counters.truncated,
    diagnostics: frozenDiagnostics,
    blockerCodes: freeze([...new Set(frozenDiagnostics.map((item) => item.code))]),
    ready: plain(evidence) && frozenDiagnostics.length === 0
      && verifiedTestCount === PIPELINE_APPROVED_CATALOG_QUALIFICATION_TESTS.length,
  });
}

export const buildPipelineApprovedCatalogEvidenceVerificationJson = (verification) =>
  JSON.stringify(verification, null, 2);

function cliArguments(argv) {
  const evidenceIndex = argv.indexOf('--evidence');
  const baselineIndex = argv.indexOf('--expected-baseline');
  return {
    evidencePath: evidenceIndex >= 0 ? argv[evidenceIndex + 1] : '',
    expectedBaseline: baselineIndex >= 0 ? argv[baselineIndex + 1] : '',
  };
}

function readFailureVerification(expectedBaseline, error, evidencePath) {
  const result = verifyPipelineApprovedCatalogQualificationEvidence({
    rawEvidence: null,
    expectedBaseline,
  });
  const extra = diagnostic(
    'PIPELINE_APPROVED_CATALOG_EVIDENCE_READ_FAILED',
    'Qualification evidence file could not be read.',
    { evidencePath, code: error?.code ?? null, message: error?.message ?? String(error) },
  );
  const diagnostics = freeze([...result.diagnostics, extra]);
  return freeze({
    ...result,
    diagnostics,
    blockerCodes: freeze([...new Set(diagnostics.map((item) => item.code))]),
    ready: false,
  });
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath && invokedPath === fileURLToPath(import.meta.url)) {
  const { evidencePath, expectedBaseline } = cliArguments(process.argv.slice(2));
  let verification;
  try {
    verification = verifyPipelineApprovedCatalogQualificationEvidence({
      rawEvidence: readFileSync(resolve(evidencePath)),
      expectedBaseline,
    });
  } catch (error) {
    verification = readFailureVerification(expectedBaseline, error, evidencePath);
  }
  process.stdout.write(`${buildPipelineApprovedCatalogEvidenceVerificationJson(verification)}\n`);
  if (!verification.ready) process.exitCode = 1;
}

export const _internal = Object.freeze({
  sha256,
  diagnostic,
  exactKeys,
  rawBytes,
  semanticProjection,
  canonicalProjectionBytes,
  decodeAndParse,
  validateTestPlan,
  validateOutputDigest,
  validateResults,
  validateEvidence,
  cliArguments,
  readFailureVerification,
  TOP_LEVEL_KEYS,
  TEST_KEYS,
  RESULT_KEYS,
  TRUNCATED_SIDE_LENGTH,
  MAX_EVIDENCE_BYTES,
});
