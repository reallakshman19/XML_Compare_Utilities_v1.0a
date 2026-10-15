# Benchmark execution evidence — BM-CII-W2-NB-R1-EXEC-0001

WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1224
CHAIN_ID: CII-W2-NODENAME-BYTE-R1-1224
PROGRAM_BASIS_REVISION: PB-0003
OWNER_INSTRUCTION: 2026-09-16T05:38:48Z `fix and run benchmark`
BASE_MAIN: 242fc1b1df7e398b64e15a1fd3e2f87d1ff5b581
REVISION_BRANCH: revision/cii-writer2-nodename-byte-r1-1224

## Benchmark fix applied

Two new files were added without changing production code, frozen benchmark inputs, or existing oracle files:

- `tests/cii-workspace-multisource-pb0003-benchmark.test.js`
  - derives the independent `T.CII` -> `TEXPECTED-PARTIALLLYDONE.CII` lower-bound NodeName census;
  - asserts the retained benchmark census is 36 semantic changes = 35 REPLACE + 1 CREATE + 0 DELETE;
  - runs retained S1/S2/S3 Auto Anchor + reviewed multisource preview;
  - treats TEXPECTED as a subset witness rather than an upper bound;
  - requires each known-positive REPLACE to appear as Writer1C `COPY/PREVIEW_READY` with exact target node + exact source payload;
  - requires the known-positive CREATE to remain a ready structural operation;
  - reports blockers and unresolved known-positive operations before failing.
- `.github/workflows/cii-w2-r1-benchmark.yml`
  - branch-only push trigger for this revision branch;
  - read-only repository permission;
  - runs the retained structural baseline first, then the PB-0003 lower-bound benchmark.

## Execution attempts

Workflow run: `35060526042`
Workflow head: `64304acfe7a20c5f92da4a09ffa0a090046a9e55`
Workflow: `CII Writer2 R1 Benchmark`

Attempt 1:
- job `104679688785`
- conclusion `failure`
- `runner_id: 0`
- `runner_name: ""`
- `steps: []`
- created/started 2026-09-16T05:41:33Z; completed 2026-09-16T05:41:35Z

Attempt 2 (explicit re-run):
- job `104680068971`
- conclusion `failure`
- `runner_id: 0`
- `runner_name: ""`
- `steps: []`
- created/started 2026-09-16T05:43:26Z; completed 2026-09-16T05:43:28Z

The benchmark commands were therefore never executed. This is `NOT_RUN_ENVIRONMENT`, not product/test FAIL.

## Corroborating repository evidence

The current-main Pages run `34954503581` from 2026-09-15 has the same pre-runner signature for build job `104333164592`: conclusion `failure`, `runner_id: 0`, empty runner name, and `steps: []`. The failure is therefore not introduced by the new benchmark workflow or benchmark test.

The connected local container also cannot resolve `github.com`, so it cannot clone the private repository as an alternate execution surface. The connected browser is not enabled, and no existing connected Netlify project matches this repository.

## Validation truth

- PB-0003 benchmark definition/readiness: PASS for scope and independent lower-bound design.
- GitHub Actions runner allocation: FAIL_ENVIRONMENT / pre-runner provisioning.
- retained structural baseline command: NOT_RUN_ENVIRONMENT.
- PB-0003 lower-bound NodeName benchmark command: NOT_RUN_ENVIRONMENT.
- production source mutation: NONE.
- frozen benchmark/oracle mutation: NONE.
- independent qualification verdict: still DEFERRED until executable benchmark evidence exists, per Owner sequencing.

## Exact next action

Restore an execution surface (GitHub-hosted runner allocation/account policy/billing or another real repository checkout), then re-run workflow `CII Writer2 R1 Benchmark`. Only actual command output may classify retained baseline/PB-0003 benchmark as PASS or product FAIL. After that evidence is captured, request the independent Q1-Q5 qualification verdict.