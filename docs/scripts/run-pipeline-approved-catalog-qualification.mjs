import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PIPELINE_APPROVED_CATALOG_QUALIFICATION_SCHEMA =
  'PipelineApprovedCatalogQualificationResult.v1';
export const PIPELINE_APPROVED_CATALOG_QUALIFICATION_HARNESS_VERSION = 'TRI-2F-A.1';

export const PIPELINE_APPROVED_CATALOG_QUALIFICATION_TESTS = Object.freeze([
  Object.freeze({
    id: 'TRI-2A-REGISTRY',
    path: 'tests/pipeline-3d-model-approved-catalog-registry.test.js',
  }),
  Object.freeze({
    id: 'TRI-2B-BINDING',
    path: 'tests/pipeline-3d-model-approved-catalog-registry-binding.test.js',
  }),
  Object.freeze({
    id: 'TRI-2C-DOCUMENT-ADOPTION',
    path: 'tests/pipeline-3d-model-approved-catalog-document.test.js',
  }),
  Object.freeze({
    id: 'TRI-2D-WRITER-AUTHENTICATION',
    path: 'tests/pipeline-3d-model-approved-catalog-writer.test.js',
  }),
  Object.freeze({
    id: 'TRI-2D-B-BUILDER-WRITER-INTEGRATION',
    path: 'tests/pipeline-3d-model-approved-catalog-builder-writer-integration.test.js',
  }),
  Object.freeze({
    id: 'TRI-2E-A-PRODUCTION-TRANSPORT',
    path: 'tests/pipeline-3d-model-approved-catalog-production-input.test.js',
  }),
]);

const SHA40 = /^[a-f0-9]{40}$/i;
const PASS_SENTINEL = /:\s*PASS\s*$/;
const MAX_EXCERPT = 4096;

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function text(value) {
  return String(value ?? '');
}

function digest(value) {
  return createHash('sha256').update(text(value), 'utf8').digest('hex');
}

function excerpt(value) {
  const output = text(value);
  if (output.length <= MAX_EXCERPT) return output;
  const half = Math.floor((MAX_EXCERPT - 32) / 2);
  return `${output.slice(0, half)}\n...[OUTPUT TRUNCATED]...\n${output.slice(-half)}`;
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

function normalizedPlan(testPlan) {
  if (!Array.isArray(testPlan)) return [];
  return testPlan.map((item) => Object.freeze({
    id: text(item?.id).trim(),
    path: text(item?.path).trim(),
  }));
}

function runGit(repoRoot, args) {
  let execution;
  try {
    execution = spawnSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      timeout: 10000,
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024,
      env: { ...process.env, NO_COLOR: '1' },
    }) || {};
  } catch (error) {
    throw error;
  }
  if (execution.error) throw execution.error;
  if (execution.status !== 0) {
    const error = new Error(text(execution.stderr).trim()
      || `git ${args.join(' ')} returned a nonzero status.`);
    error.code = 'GIT_COMMAND_STATUS';
    error.exitCode = execution.status ?? null;
    throw error;
  }
  return text(execution.stdout);
}

function resolveRepositoryHead(repoRoot) {
  const head = runGit(repoRoot, ['rev-parse', 'HEAD']).trim().toLowerCase();
  if (!SHA40.test(head)) {
    const error = new Error('git rev-parse HEAD did not return an exact 40-hex commit SHA.');
    error.code = 'GIT_HEAD_INVALID';
    throw error;
  }
  return head;
}

function resolveRepositoryWorktreeStatus(repoRoot) {
  return runGit(repoRoot, ['status', '--porcelain=v1', '--untracked-files=all']);
}

function repositoryRelativePath(repoRoot, path) {
  if (!path || isAbsolute(path)) return false;
  const resolvedPath = resolve(repoRoot, path);
  const relativePath = relative(resolve(repoRoot), resolvedPath);
  return relativePath !== '' && !relativePath.startsWith('..') && !isAbsolute(relativePath);
}

function preflightState({ baselineCommit, repoRoot, testPlan, timeoutMs, exists,
  headResolver, worktreeResolver }) {
  const diagnostics = [];
  const suppliedBaseline = text(baselineCommit).trim().toLowerCase();
  const baselineValid = SHA40.test(suppliedBaseline);
  let repositoryHead = null;
  let worktreeClean = false;

  if (!baselineValid) diagnostics.push(diagnostic(
    'PIPELINE_APPROVED_CATALOG_QUALIFICATION_BASELINE_INVALID',
    'Qualification requires an exact 40-hex baseline commit SHA.',
    { baselineCommit: text(baselineCommit).trim() },
  ));

  if (baselineValid) {
    try {
      repositoryHead = text(headResolver(repoRoot)).trim().toLowerCase();
      if (!SHA40.test(repositoryHead)) throw Object.assign(
        new Error('Repository HEAD resolver did not return an exact 40-hex commit SHA.'),
        { code: 'GIT_HEAD_INVALID' },
      );
      if (repositoryHead !== suppliedBaseline) diagnostics.push(diagnostic(
        'PIPELINE_APPROVED_CATALOG_QUALIFICATION_BASELINE_MISMATCH',
        'Supplied qualification baseline does not match the checked-out repository HEAD.',
        { suppliedBaseline, repositoryHead },
      ));
    } catch (error) {
      diagnostics.push(diagnostic(
        'PIPELINE_APPROVED_CATALOG_QUALIFICATION_HEAD_RESOLUTION_FAILED',
        'Qualification could not authenticate the checked-out repository HEAD.',
        { code: error?.code ?? null, message: error?.message ?? String(error) },
      ));
    }

    try {
      const worktreeStatus = text(worktreeResolver(repoRoot));
      worktreeClean = worktreeStatus.trim().length === 0;
      if (!worktreeClean) diagnostics.push(diagnostic(
        'PIPELINE_APPROVED_CATALOG_QUALIFICATION_WORKTREE_DIRTY',
        'Qualification requires a clean tracked and untracked repository worktree.',
        { statusExcerpt: excerpt(worktreeStatus) },
      ));
    } catch (error) {
      diagnostics.push(diagnostic(
        'PIPELINE_APPROVED_CATALOG_QUALIFICATION_WORKTREE_RESOLUTION_FAILED',
        'Qualification could not authenticate repository worktree cleanliness.',
        { code: error?.code ?? null, message: error?.message ?? String(error) },
      ));
    }
  }

  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) diagnostics.push(diagnostic(
    'PIPELINE_APPROVED_CATALOG_QUALIFICATION_TIMEOUT_INVALID',
    'Qualification timeout must be a positive integer number of milliseconds.',
    { timeoutMs },
  ));
  if (testPlan.length === 0) diagnostics.push(diagnostic(
    'PIPELINE_APPROVED_CATALOG_QUALIFICATION_TEST_PLAN_EMPTY',
    'Qualification requires at least one approved test entry.',
  ));

  const ids = new Set();
  const paths = new Set();
  testPlan.forEach((test, testIndex) => {
    if (!test.id || !test.path) diagnostics.push(diagnostic(
      'PIPELINE_APPROVED_CATALOG_QUALIFICATION_TEST_ENTRY_INVALID',
      'Every qualification test requires a nonblank ID and repository-relative path.',
      { testIndex, id: test.id, path: test.path },
    ));
    if (test.path && !repositoryRelativePath(repoRoot, test.path)) diagnostics.push(diagnostic(
      'PIPELINE_APPROVED_CATALOG_QUALIFICATION_TEST_PATH_INVALID',
      'Qualification test paths must remain repository-relative and inside the repository root.',
      { testIndex, id: test.id, path: test.path },
    ));
    if (ids.has(test.id) || paths.has(test.path)) diagnostics.push(diagnostic(
      'PIPELINE_APPROVED_CATALOG_QUALIFICATION_TEST_ENTRY_DUPLICATE',
      'Qualification test IDs and paths must be unique.',
      { testIndex, id: test.id, path: test.path },
    ));
    ids.add(test.id);
    paths.add(test.path);
    if (!test.path || !repositoryRelativePath(repoRoot, test.path)) return;
    let present = false;
    try {
      present = exists(resolve(repoRoot, test.path));
    } catch (error) {
      diagnostics.push(diagnostic(
        'PIPELINE_APPROVED_CATALOG_QUALIFICATION_TEST_EXISTENCE_CHECK_ERROR',
        'Qualification could not verify an approved test path.',
        { testIndex, id: test.id, path: test.path, message: error?.message ?? String(error) },
      ));
      return;
    }
    if (!present) diagnostics.push(diagnostic(
      'PIPELINE_APPROVED_CATALOG_QUALIFICATION_TEST_MISSING',
      'An approved qualification test file is missing.',
      { testIndex, id: test.id, path: test.path },
    ));
  });

  return freeze({
    repositoryHead,
    worktreeClean,
    diagnostics: freeze(uniqueDiagnostics(diagnostics)),
  });
}

function executionDiagnostics(test, execution) {
  const diagnostics = [];
  if (execution.error?.code === 'ETIMEDOUT') diagnostics.push(diagnostic(
    'PIPELINE_APPROVED_CATALOG_QUALIFICATION_TEST_TIMEOUT',
    'Qualification test exceeded its execution timeout.',
    { id: test.id, path: test.path },
  ));
  else if (execution.error) diagnostics.push(diagnostic(
    'PIPELINE_APPROVED_CATALOG_QUALIFICATION_TEST_EXECUTION_ERROR',
    'Qualification test could not be executed.',
    { id: test.id, path: test.path, code: execution.error.code ?? null,
      message: execution.error.message ?? String(execution.error) },
  ));
  if (execution.signal) diagnostics.push(diagnostic(
    'PIPELINE_APPROVED_CATALOG_QUALIFICATION_TEST_SIGNALLED',
    'Qualification test terminated by signal.',
    { id: test.id, path: test.path, signal: execution.signal },
  ));
  if (execution.status !== 0) diagnostics.push(diagnostic(
    'PIPELINE_APPROVED_CATALOG_QUALIFICATION_TEST_FAILED',
    'Qualification test returned a nonzero or unavailable exit status.',
    { id: test.id, path: test.path, exitCode: execution.status ?? null },
  ));
  if (execution.status === 0 && !PASS_SENTINEL.test(text(execution.stdout))) diagnostics.push(diagnostic(
    'PIPELINE_APPROVED_CATALOG_QUALIFICATION_PASS_SENTINEL_MISSING',
    'Qualification test completed without an explicit terminal : PASS sentinel.',
    { id: test.id, path: test.path },
  ));
  return diagnostics;
}

function resultFromPreflight({ baselineCommit, testPlan, preflight }) {
  return freeze({
    schema: PIPELINE_APPROVED_CATALOG_QUALIFICATION_SCHEMA,
    harnessVersion: PIPELINE_APPROVED_CATALOG_QUALIFICATION_HARNESS_VERSION,
    baselineCommit: text(baselineCommit).trim().toLowerCase(),
    repositoryHead: preflight.repositoryHead,
    worktreeClean: preflight.worktreeClean,
    testPlan: freeze(testPlan),
    results: freeze([]),
    diagnostics: preflight.diagnostics,
    blockerCodes: freeze([...new Set(preflight.diagnostics.map((item) => item.code))]),
    ready: false,
  });
}

function runQualification({
  baselineCommit = '',
  repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url))),
  testPlan,
  timeoutMs = 120000,
  runner = spawnSync,
  exists = existsSync,
  headResolver = resolveRepositoryHead,
  worktreeResolver = resolveRepositoryWorktreeStatus,
  clock = () => Number(process.hrtime.bigint() / 1000000n),
} = {}) {
  const plan = normalizedPlan(testPlan);
  const preflight = preflightState({ baselineCommit, repoRoot, testPlan: plan,
    timeoutMs, exists, headResolver, worktreeResolver });
  if (preflight.diagnostics.length > 0) return resultFromPreflight({
    baselineCommit, testPlan: plan, preflight,
  });

  const results = [];
  const diagnostics = [];
  for (const test of plan) {
    const started = clock();
    let execution;
    try {
      execution = runner(process.execPath, [test.path], {
        cwd: repoRoot,
        encoding: 'utf8',
        timeout: timeoutMs,
        windowsHide: true,
        maxBuffer: 16 * 1024 * 1024,
        env: { ...process.env, NO_COLOR: '1' },
      }) || {};
    } catch (error) {
      execution = { status: null, signal: null, stdout: '', stderr: '', error };
    }
    const durationMs = Math.max(0, clock() - started);
    const testDiagnostics = executionDiagnostics(test, execution);
    diagnostics.push(...testDiagnostics);
    results.push(freeze({
      id: test.id,
      path: test.path,
      command: freeze(['node', test.path]),
      exitCode: Number.isInteger(execution.status) ? execution.status : null,
      signal: execution.signal ?? null,
      durationMs,
      stdoutSha256: digest(execution.stdout),
      stderrSha256: digest(execution.stderr),
      stdoutExcerpt: excerpt(execution.stdout),
      stderrExcerpt: excerpt(execution.stderr),
      ready: testDiagnostics.length === 0,
    }));
  }
  const frozenDiagnostics = freeze(uniqueDiagnostics(diagnostics));
  return freeze({
    schema: PIPELINE_APPROVED_CATALOG_QUALIFICATION_SCHEMA,
    harnessVersion: PIPELINE_APPROVED_CATALOG_QUALIFICATION_HARNESS_VERSION,
    baselineCommit: text(baselineCommit).trim().toLowerCase(),
    repositoryHead: preflight.repositoryHead,
    worktreeClean: preflight.worktreeClean,
    testPlan: freeze(plan),
    results: freeze(results),
    diagnostics: frozenDiagnostics,
    blockerCodes: freeze([...new Set(frozenDiagnostics.map((item) => item.code))]),
    ready: results.length === plan.length && results.every((item) => item.ready)
      && frozenDiagnostics.length === 0,
  });
}

export function runPipelineApprovedCatalogQualification(options = {}) {
  return runQualification({
    ...options,
    testPlan: PIPELINE_APPROVED_CATALOG_QUALIFICATION_TESTS,
  });
}

export function deterministicPipelineApprovedCatalogQualificationProjection(result) {
  return freeze({
    ...result,
    results: freeze((result?.results || []).map(({ durationMs: _durationMs, ...item }) => freeze(item))),
  });
}

export const buildPipelineApprovedCatalogQualificationJson = (result) =>
  JSON.stringify(result, null, 2);

function cliArguments(argv) {
  const baselineIndex = argv.indexOf('--baseline');
  const timeoutIndex = argv.indexOf('--timeout-ms');
  return {
    baselineCommit: baselineIndex >= 0 ? argv[baselineIndex + 1] : process.env.QUALIFICATION_BASELINE_SHA,
    timeoutMs: timeoutIndex >= 0 ? Number(argv[timeoutIndex + 1]) : 120000,
  };
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath && invokedPath === fileURLToPath(import.meta.url)) {
  const result = runPipelineApprovedCatalogQualification(cliArguments(process.argv.slice(2)));
  process.stdout.write(`${buildPipelineApprovedCatalogQualificationJson(result)}\n`);
  if (!result.ready) process.exitCode = 1;
}

export const _internal = Object.freeze({
  digest,
  excerpt,
  diagnostic,
  normalizedPlan,
  runGit,
  resolveRepositoryHead,
  resolveRepositoryWorktreeStatus,
  repositoryRelativePath,
  preflightState,
  executionDiagnostics,
  runQualification,
  cliArguments,
});
