# WIP-CII-W2-FREEZE-R2-1232 work report

WIP_ID: WIP-CII-W2-FREEZE-R2-1232
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1232
PROGRAMME: github:reallaksh19/XML_Compare_Utilities#1083
PROGRAM_ID: PGM-XMLCU-CII-W2-MS-NODENAME
WORK_PACKAGE_ID: WP-007
BRANCH: revision/cii-writer2-freeze-r2-1232
BASE_MAIN: 300c05dd5e69419e1f16b3622f0cc24a93170b3a
COMMON_PROTOCOL: engineering-pr-delivery-v3.1
COMMON_BASIS: 1ced68258afeaf50df113b1d38a4ceb9193587e3
TWO_PASS_REVISION: TPG-2P-2026-09-28-R3
STATE: IMPLEMENTATION_IN_PROGRESS
PR: #1233 DRAFT
MERGE_AUTHORITY: OWNER_ONLY
EXECUTION_HOST_UPDATE: 2026-09-28T15:xxZ — this checkpoint was written from a
Claude Code cloud session with a real `git` checkout of this exact branch,
Node 22.22.2, and outbound network/DNS. Unlike the prior ChatGPT execution
host (see "Current execution-environment limitation" below, which is now
historical, not current), this host can and does execute the repository's
own Node test files directly, including the real-retained S1/S2/S3/T
benchmarks. See "FT-1232-003" and the refreshed "Validation status" section.

## Mission / scope

Fix the retained CII Writer2 S1/S2/S3 -> T browser/application freeze without changing PB-0003 FORTRAN fixed-format, NodeName, Writer1C, Writer2, V14 projection, benchmark, or write-authority semantics.

The approved implementation plan is issue #1232 comment `IMPLEMENTATION_PLAN — rev 1`.

## Live basis

Revalidated at execution start:

- XML_Compare_Utilities `main`: `300c05dd5e69419e1f16b3622f0cc24a93170b3a`
- Common `main`: `1ced68258afeaf50df113b1d38a4ceb9193587e3`
- Two-Pass: `TPG-2P-2026-09-28-R3`
- #1232: OPEN
- open overlapping CII Writer2 PRs observed: none
- predecessor #1224: CLOSED
- PR #1228: MERGED
- PR #1230: MERGED

## Current first-wrong-boundary findings

Current-main source trace confirms the approved root hypothesis at the architecture level.

### Inspect amplification

`cii-workspace-source-set.js::inspectCiiWorkspaceSourceSetWithVersionBridge()` loops over every source and calls the pair API `inspectCiiWorkspaceModelsWithVersionBridge()`.

Each pair call:
1. `normalizePairInput()` normalizes SOURCE and TARGET;
2. `inspectCiiWorkspaceModels()` calls `intakePair()`;
3. `intakePair()` independently intakes SOURCE and TARGET and independently builds both topology graphs;
4. inspection computes per-pair anchor suggestions.

For retained S1/S2/S3, the same immutable TARGET therefore reaches TARGET normalize/intake/topology construction three times during Inspect. Converter cache hits can avoid repeated Python conversion output generation, but do not avoid TARGET document parse, topology construction, neighbourhood/context calculation, landmarks, anchor analysis, or deep-freeze traversal.

### Compare amplification

`cii-workspace-multisource-preview.js::createCiiWriter2SourceSetPreviewWithVersionBridge()` loops over each source and creates:
- a complete Writer2 preview; then
- a complete Writer1C replacement preview.

For S1/S2/S3 this is six pair-preview executions against the same TARGET. Each complete preview again enters `normalizePairInput()` and `createCiiWorkspacePreview()`, whose `intakePair()` reparses and regraphs TARGET.

The UI retains `cachedTargetBytes` and prior `inspection`, but Compare calls the preview API from bytes again and does not reuse prepared models.

### Topology repeated traversal

`cii-workspace-topology-adapter.js` on main computed `contextFor(node)` for every edge endpoint in `attachContexts()` and recomputed `neighbourhoodLayers(id)` for graph nodes. Commit `d1413021cd15f9e5c8efcf2769af44593241d738` now builds one context per unique node and reuses its frozen neighbourhood evidence for incident edges and graph nodes. This removes redundant traversal within every topology build without changing topology evidence values.

### FT-1232-003 — prepared-model/shared-TARGET inspection architecture

Implemented in this checkpoint, on top of the topology memoization
(`d1413021`) already on this branch:

- `cii-workspace-writer-version-bridge.js` gained
  `prepareCiiWorkspaceTargetWithVersionBridge()` (normalizes, intakes, and
  topology-graphs TARGET exactly once) and
  `inspectCiiWorkspaceModelsWithPreparedTarget()` (normalizes only SOURCE and
  reuses the prepared TARGET). The pre-existing `normalizeSideToV11()`,
  `inspectCiiWorkspaceModelsWithVersionBridge()`, and
  `createCiiWorkspacePreviewWithVersionBridge()` are byte-for-byte unchanged.
- `cii-workspace-core.js::intakePair()` (and the `inspectCiiWorkspaceModels()`
  / `createCiiWorkspacePreview()` wrappers around it) gained an optional
  trailing `prepared` argument that, when given a `targetDocument`/`targetGraph`,
  skips re-intaking/re-graphing TARGET. Every existing 2-argument caller is
  unaffected (falls back to the original full-intake behavior).
- `cii-workspace-source-set.js::inspectCiiWorkspaceSourceSetWithVersionBridge()`
  now prepares TARGET once and reuses it for every source member, instead of
  calling the single-pair API with full TARGET bytes on every loop iteration.
- `cii-workspace-intake.js` and `cii-workspace-topology-adapter.js` gained an
  optional, default-off `instrumentation.record(event)` hook (no-op when
  absent) so the "TARGET built once / SOURCE built per member" invariant is
  machine-checked, not just asserted by reading the code.
- New test `tests/cii-workspace-source-set-shared-target-construction-count.test.js`
  proves, against a real (small, V11) repository fixture: `TARGET_NORMALIZE`,
  `TARGET_INTAKE`, `TARGET_TOPOLOGY` each fire exactly once per session;
  `SOURCE_NORMALIZE`/`SOURCE_INTAKE`/`SOURCE_TOPOLOGY` each fire once per
  source; all members observe one identical prepared-TARGET content hash; and
  the new prepared path's per-source inspection evidence is `deepEqual` to
  the untouched legacy single-pair API's evidence for identical bytes
  (`.source`, `.target`, `.baseAnchorSuggestions`,
  `.versionBridge.{source,target}`). Result: **PASS**, 0 failures.
- This closes exactly the "Inspect amplification" gap described above for
  the S1/S2/S3 → T Inspect path. It intentionally does **not** touch
  "Compare amplification" (multisource-preview.js Writer2/Writer1C double
  preview) — that is FT-1232-004, still pending.

### Real-retained execution results (this checkpoint)

This host actually executed the two real-retained regression tests to
completion for the first time (both launched pre-edit, at commit `49ce11b9`,
before any FT-1232-003 file was touched):

- `tests/cii-workspace-multisource-pb0003-benchmark.test.js`: ran 43m24s,
  then **FAILED** —
  `assert.deepEqual(automatic.choices.map(c => c.status), ['READY','READY','READY'])`
  got `['REVIEW_REQUIRED', 'READY', 'READY']`. (Its process exit code was
  misreported as 0 by this session's own shell pipeline — `... | tail -60`
  swallows Node's real non-zero exit — an error in how the command was
  invoked, not in the test; the actual stdout content clearly shows an
  uncaught `AssertionError`. Corrected for all runs described below.)
- `tests/cii-workspace-multisource-retained-auto-anchor-benchmark.test.js`:
  ran ~44 min, then **FAILED** with the same root cause, spelled out
  explicitly: `S1 Auto Anchor must resolve a unique HIGH/MEDIUM topology
  base: NO_HIGH_OR_MEDIUM_QUALIFIED_TOPOLOGY_BASE`, `actual: 'REVIEW_REQUIRED'`.

**Root-cause isolation (this checkpoint):** built an isolated `git worktree`
at `main` (`300c05dd...`, before #1224/#1228/#1230/WP-007 existed) and ran a
targeted single-pair `inspectCiiWorkspaceModelsWithVersionBridge(S1, T)` +
`ciiAutomaticBaseSelection()` script against real `Benchmark/S1.CII` /
`Benchmark/T.CII`, once on `main` and once on this branch's current head
(`d1413021` + FT-1232-003). Results were **byte-identical**: both produced
`status: 'REVIEW_REQUIRED'`, `reason: 'NO_HIGH_OR_MEDIUM_QUALIFIED_TOPOLOGY_BASE'`,
`baseAnchorSuggestions.length: 5`, empty `selectionKeys`/`baseLoops`/
`candidates`, and near-identical elapsed time (~3,326,851 ms vs. ~3,314,828 ms,
i.e. ~55.3 minutes both times).

**Conclusion:** the `REVIEW_REQUIRED` result for retained S1 is **pre-existing
on `main`, unaffected by `d1413021` and unaffected by FT-1232-003.** Neither
this branch's topology-context memoization nor its shared-TARGET prepared-
model refactor changed this outcome by so much as one byte. This is a
real, separate, pre-existing product gap in automatic base-anchor selection
for retained S1 against T — not a WP-007 regression, and not something this
issue's scope (freeze/performance/runtime-reuse) authorizes fixing. It should
be reported/owned separately (it means both of this repo's only real-retained
CI-gating tests are currently red on `main` itself, independent of any CII
Writer2 freeze work). FT-1232-003 stands validated: it provably does not
alter this or any other observed outcome relative to the unmodified code.

### Browser acceptance gap

The retained tile Playwright test allows up to 120 seconds for Inspect, Compare/review rebuild and Apply milestones, but contains no independent event-loop heartbeat or long-task responsiveness assertion. Eventual completion can therefore pass while the app is functionally frozen for a long interval.

## Hypothesis state

SOURCE_TRACE_HYPOTHESIS: CONFIRMED

Confirmed meaning: repeated TARGET/common-analysis work exists exactly where the implementation plan predicts.

RUNTIME_DOMINANT_STAGE: PARTIALLY_MEASURED — end-to-end only, per-stage attribution still NOT_RUN

This checkpoint executed real retained-data runs to completion for the first
time (see "Real-retained execution results" below). A single-pair S1-vs-T
`inspectCiiWorkspaceModelsWithVersionBridge()` call took ~55.3 minutes
wall-clock in this host (Node child-process Python conversion fallback, not
the browser Worker path). That number is real and reproducible (measured
twice, on two different branches, within ~12 seconds of each other), but it
is an **end-to-end** figure. The relative contribution of the Python V14↔V11
conversion subprocess versus synchronous JS parser/topology/anchor/
correspondence work is still not separately instrumented — Phase 1 of the
approved plan ("add non-semantic performance instrumentation... distinguish
repeated TARGET work; one intrinsically long synchronous TARGET stage;
converter wait; DOM/render cost") has still not actually been executed with
real per-stage timestamps; the diagnosis above was, and remains, inferred
from source reading plus this one end-to-end number, not measured per stage.
This matters because the Python conversion runs in a Worker in the real
browser (off the main thread) — if it dominates the ~55 minutes, it would
not itself be the main-thread freeze cause, only the JS-side share would be.
Recommend real per-stage instrumentation as the next concrete step before
further architectural work, per the existing Phase 1 of the approved plan.

## Current execution-environment limitation

This ChatGPT execution environment has:
- GitHub provider read/write access through the connected GitHub integration;
- no local XML_Compare_Utilities checkout;
- no `gh` CLI;
- no DNS/network path from the container to github.com;
- no repository-local RLL/CODEX_LOCAL adapter discovered;
- no workflow-dispatch tool for starting a new WP-007 workflow;
- the only CII Writer2 benchmark workflow on main is push-bound specifically to the historical Revision 1 branch.

Repository policy requires the repo backup utility and local `.agent-worklogs/` custody before production-file edits. Those controls must not be bypassed by directly replacing production files through the provider API.

## Validation status

| Gate | Status | Basis |
|---|---|---|
| live Common/V3.1 basis | PASS | Common main re-read this run |
| live target-main basis | PASS | main = 300c05dd5e69419e1f16b3622f0cc24a93170b3a |
| active Writer2 overlap check | PASS | no open Writer2 PR observed |
| source-trace repeated TARGET work | PASS | current-main functions listed above |
| source-trace duplicate Writer2/Writer1C full preview | PASS | current-main multisource preview loop |
| topology redundant neighbourhood/context traversal | PASS_FIXED_FOCUSED | commit `d1413021`; focused context-reuse regression PASS |
| source-set shared-TARGET construction count (TARGET×1, SOURCE×N) | PASS | new test, real V11 fixture, executed to completion this run |
| prepared-model vs legacy single-pair parity | PASS | same new test; `deepEqual` on source/target/anchors/versionBridge for all 3 sources |
| existing topology-context-cache regression | PASS | re-executed this run, 0.064s |
| existing source-set custody regression (real S1/S2/S3/T hashes) | PASS | re-executed this run, 0.098s |
| source-set UI wiring contract test | FAIL_PRE_EXISTING_UNRELATED | re-confirmed via `git stash` bisection against the exact pre-edit branch head; identical failure with or without this change; out of WP-007 scope, not fixed here |
| existing browser responsiveness assertion | FAIL_AS_COVERAGE_GAP | no heartbeat/long-task assertion present (unchanged; still pending, see FT-1232-005) |
| retained real-benchmark correctness (PB-0003 + auto-anchor, real 2.87 MB TARGET) | FAIL_PRE_EXISTING_ON_MAIN | both ran to completion pre-edit (43–44 min each) and FAILED on `REVIEW_REQUIRED` vs `READY` for S1; isolated via a `main`-branch worktree re-run of the identical single-pair call — byte-identical failure on `main` (before #1224/WP-007 existed) proves this is unrelated to `d1413021` and unrelated to FT-1232-003; reported separately below, not owned by this issue |
| FT-1232-003 non-regression against real retained data | PASS | the same isolation re-run also proves FT-1232-003 (this branch's head) produces byte-identical `baseAnchorSuggestions`/status/timing to unmodified `main` for real S1-vs-T — i.e. this checkpoint changed zero observable behavior on real data, only construction counts |
| real single-pair Inspect wall-clock (S1 vs T, Node child-process Python conversion fallback) | MEASURED_END_TO_END_ONLY | ~55.3 minutes, measured twice (main and this branch), consistent to within 12s; per-stage (Python conversion vs. JS topology/anchor/correspondence) attribution still NOT_RUN — see RUNTIME_DOMINANT_STAGE |
| retained Chromium + real Pyodide on WP-007 | NOT_RUN_ENVIRONMENT | still not attempted this checkpoint; this host has a real Chromium binary available and is a credible candidate to finally execute this, but it was not yet attempted in favor of landing FT-1232-003 first |
| production mutation | IN_PROGRESS | topology memoization (`d1413021`) + shared-TARGET prepared-model architecture (this checkpoint) committed; Compare-side reuse (FT-1232-004) and UI generation/cancellation + Chromium heartbeat (FT-1232-005) remain pending |

## Changed-file ledger

Current branch material:
- `agents/WIP-CII-W2-FREEZE-R2-1232_workreport.md` — recovery-first WIP state.
- `tabs/cii-workspace/cii-workspace-topology-adapter.js` — memoized per-node topology context/neighbourhood derivation (`d1413021`); this checkpoint added an optional `options.instrumentation` parameter to the same exported function.
- `tests/cii-workspace-topology-context-cache.test.js` — focused regression (`d1413021`).
- `tabs/cii-workspace/cii-workspace-intake.js` — this checkpoint: optional instrumentation hook only.
- `tabs/cii-workspace/cii-workspace-core.js` — this checkpoint: optional `prepared` TARGET override threaded through `intakePair`/`inspectCiiWorkspaceModels`/`createCiiWorkspacePreview`.
- `tabs/cii-workspace/cii-workspace-writer-version-bridge.js` — this checkpoint: new `prepareCiiWorkspaceTargetWithVersionBridge()` and `inspectCiiWorkspaceModelsWithPreparedTarget()`; instrumentation hook added to `normalizeSideToV11()`.
- `tabs/cii-workspace/cii-workspace-source-set.js` — this checkpoint: `inspectCiiWorkspaceSourceSetWithVersionBridge()` now prepares TARGET once and reuses it.
- `tests/cii-workspace-source-set-shared-target-construction-count.test.js` — this checkpoint: new construction-count + prepared/legacy parity regression.

No benchmark, workflow, parser, Writer1C/Writer2 mutation, bridge projection, or Common-controlled file has changed.

## Backup / patch ledger

Topology optimization local custody completed before the existing-file edit (prior checkpoint):
- local task ledger: `.agent-worklogs/20260928_1729_cii-writer2-freeze-r2/` (local/Git-ignored by repository policy);
- repository backup utility: backup #1 for `cii-workspace-topology-adapter.js`;
- pre-edit SHA-256: `c119a1b6a04878f661e22c872710707924603e8982943abeae5a6b19368ab80f`;
- post-edit SHA-256: `ab4caaa948895c5de43ade86bcac46c570e886cc3116b395182bea2716bb7131`;
- focused test SHA-256: `5605783ffb5fc180aeb1e1f771b1b90c4bf95e6584cc80e19bf88c48649f2097`;
- patch generated from the exact pre-edit backup;
- backup verification PASS.

Shared-TARGET prepared-model custody completed before each existing-file edit (this checkpoint):
- local task ledger: `.agent-worklogs/20260928_1509_cii-writer2-freeze-r2-ft1232-003/` (local/Git-ignored by repository policy);
- repository backup utility, all pre-edit SHA-256 verified against this exact branch head (`49ce11b9`) before editing:
  - backup #90 `cii-workspace-intake.js` — `cf8739b5311097accd5a965a746d09cba803ce7a5a4ba079314dd90c492e94b9`;
  - backup #91 `cii-workspace-topology-adapter.js` — `ab4caaa948895c5de43ade86bcac46c570e886cc3116b395182bea2716bb7131` (matches the post-edit hash recorded above, confirming this checkpoint started from the exact PR #1233 head);
  - backup #92 `cii-workspace-core.js` — `98028235222dbee0c82e4dbffe765327efc448383aa05f1c9acae18e86aa9c98`;
  - backup #93 `cii-workspace-writer-version-bridge.js` — `0dcfc28d30bd2da797f08647ce01b5239cad87d1c775fa5a3ab00d1b455f4337`;
  - backup #94 `cii-workspace-source-set.js` — `c5ac83928a220da0ca347e6928a10f15ebadafc5b6d1e9cf73bc2ee491de75f3`;
- `tests/cii-workspace-source-set-shared-target-construction-count.test.js` is a new file (no pre-image).

## Protected invariants

- PB-0003 is unchanged.
- Retained S1/S2/S3/T and TEXPECTED bytes are immutable.
- FORTRAN fixed-format and I13 rules are unchanged.
- Writer1C exact-span/preimage REPLACE is unchanged.
- Writer2 CREATE/DELETE relocation authority is unchanged.
- V14 projection/change-isolation guards are unchanged.
- BM-001/TEXPECTED authority classification is unchanged.
- REVIEW_ONLY remains non-writing.
- frozen 3D_Converters sources are unchanged.
- workflow files are protected absent separate Owner authorization.
- merge remains Owner-only.

## Highest risk

FT-1232-003 is now validated two ways: (1) exact construction-count and
prepared/legacy parity assertions on a real small fixture, and (2) a
byte-identical-output isolation proof against real retained S1-vs-T data
versus unmodified `main`. Both passed; this checkpoint is not the source of
the retained-benchmark failures. The actual highest risk is now scope
confusion, not correctness: the two real-retained "authoritative" tests
(PB-0003, auto-anchor) fail on `main` itself, before WP-007 existed, for a
reason (`NO_HIGH_OR_MEDIUM_QUALIFIED_TOPOLOGY_BASE` on retained S1) that has
nothing to do with the freeze/performance boundary this issue owns. Do not
let a future session (or an eager AUTO-MODE-style continuation) try to "fix"
that classification gap under issue #1232 — it is a different owned outcome
and needs its own issue/authorization. Separately, per RUNTIME_DOMINANT_STAGE
above, the ~55-minute single-pair figure is real but not yet decomposed by
stage, so it is not yet known how much of it is addressable by further JS-side
orchestration work (FT-1232-004/005) versus dominated by the frozen,
out-of-scope Python conversion engine running in a Worker off the main thread.

## EXACT_NEXT_ACTION

1. Report the retained-benchmark failure and its `main`-branch isolation
   proof to issue #1232 as a separate, non-WP-007-owned finding (done by this
   checkpoint — see the TASK_EVIDENCE comment posted alongside this report).
   Do not fix it from this PR.
2. Recommended next technical step, before FT-1232-004: add minimal,
   non-semantic per-stage wall-clock instrumentation (Python conversion wait
   vs. intake/parse vs. topology build vs. anchor-suggestion vs.
   correspondence) around one real single-pair Inspect call, per Phase 1 of
   the approved plan, which has still never actually been executed with real
   numbers. This is cheap to add and directly resolves whether FT-1232-004
   (Compare-side JS reuse) is high-value or whether attention belongs on the
   conversion layer / Workerization instead.
3. Once that attribution exists: proceed to FT-1232-004 (reuse prepared
   SOURCE/TARGET models from Inspect in Compare; split common analysis from
   Writer1C/Writer2 projection) only if JS-side work is shown to be a
   material share of wall-clock time — with its own construction-count/parity
   regression before being claimed done, as FT-1232-003 required of itself.
4. FT-1232-005 (UI operation-generation/cancellation guards, retained
   Chromium event-loop heartbeat probe) remains the last owned outcome and is
   unstarted; this host has a real Chromium binary and could be the first to
   actually execute it.