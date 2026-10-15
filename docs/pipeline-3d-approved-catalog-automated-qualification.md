# Pipeline 3D Approved Catalog Automated Qualification

## Purpose

This runner executes the repository-native approved-catalog software qualification ladder already delivered by TRI-2A through TRI-2E-A.

It does not supply production catalog values, resolve the production registry source gate, select a digest model, perform CAESAR desktop import, or certify engineering correctness.

## Approved test sequence

The public runner executes these tests in fixed order:

1. `tests/pipeline-3d-model-approved-catalog-registry.test.js`
2. `tests/pipeline-3d-model-approved-catalog-registry-binding.test.js`
3. `tests/pipeline-3d-model-approved-catalog-document.test.js`
4. `tests/pipeline-3d-model-approved-catalog-writer.test.js`
5. `tests/pipeline-3d-model-approved-catalog-builder-writer-integration.test.js`
6. `tests/pipeline-3d-model-approved-catalog-production-input.test.js`

The plan is immutable at runtime and cannot be replaced through public runner options. A missing or non-repository-relative test path blocks the complete run before test execution begins.

## Invocation

Qualification requires a clean repository, including no untracked files. Write the JSON evidence outside the repository because shell redirection creates the destination before the runner authenticates worktree cleanliness.

Bash:

```bash
git status --short
git rev-parse HEAD
node scripts/run-pipeline-approved-catalog-qualification.mjs \
  --baseline "$(git rev-parse HEAD)" \
  > /tmp/pipeline-approved-catalog-qualification.json
```

PowerShell:

```powershell
git status --short
$baseline = git rev-parse HEAD
$outputPath = Join-Path ([System.IO.Path]::GetTempPath()) `
  'pipeline-approved-catalog-qualification.json'
node scripts/run-pipeline-approved-catalog-qualification.mjs `
  --baseline $baseline |
  Tee-Object -FilePath $outputPath
```

Optional per-test timeout override:

```bash
node scripts/run-pipeline-approved-catalog-qualification.mjs \
  --baseline "$(git rev-parse HEAD)" \
  --timeout-ms 180000 \
  > /tmp/pipeline-approved-catalog-qualification.json
```

The baseline must be an exact 40-hex commit SHA. Before any test executes, the runner independently resolves checked-out repository HEAD with `git rev-parse HEAD` and requires exact equality with the supplied baseline.

The runner also executes `git status --porcelain=v1 --untracked-files=all` and requires empty output. Qualification is blocked for modified, staged, deleted, renamed or untracked files. Git or worktree-state resolution failure also blocks qualification.

The timeout must be a positive integer number of milliseconds.

## Exit behavior

- Exit code `0`: the baseline matches checked-out HEAD, the worktree is clean, all six tests returned zero, emitted an explicit terminal `: PASS` sentinel, and produced no blockers.
- Exit code `1`: preflight or one or more tests blocked qualification.

The runner fails closed for:

- invalid baseline SHA;
- repository HEAD resolution failure;
- supplied baseline and checked-out HEAD mismatch;
- worktree-state resolution failure;
- tracked or untracked worktree changes;
- invalid timeout;
- empty, duplicate or malformed internal test plan;
- absolute or repository-escaping test path;
- missing test file;
- test existence-check error;
- execution error;
- timeout;
- signal termination;
- nonzero or unavailable exit status;
- zero exit without an explicit terminal `: PASS` sentinel.

## Evidence contract

Output schema:

```text
PipelineApprovedCatalogQualificationResult.v1
```

Each test result records:

- stable test ID and repository-relative path;
- normalized command;
- exit code and signal;
- duration in milliseconds;
- SHA-256 of stdout and stderr;
- bounded stdout and stderr excerpts;
- per-test ready state.

The aggregate records:

- harness version;
- supplied baseline commit;
- independently resolved repository HEAD;
- authenticated worktree-clean state;
- ordered approved test plan;
- test results;
- diagnostics and blocker codes;
- aggregate ready state.

Durations are intentionally variable. Use `deterministicPipelineApprovedCatalogQualificationProjection(...)` when comparing repeated result structure while excluding timing fields.

## Qualification boundary

A ready result qualifies only the executed software test ladder at the authenticated clean checked-out commit. It does not resolve:

```text
APPROVED_PRODUCTION_REGISTRY_SOURCE_UNRESOLVED
REGISTRY_DIGEST_SCOPE_UNRESOLVED
```

Issue #752 remains the governing production-registry authority gate.
