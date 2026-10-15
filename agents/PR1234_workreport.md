# PR1234 Work Report

## Mission

Continue WP-007 / issue #1232 from the instrumentation-only draft PR #1234 and implement the Owner-approved bounded physical Method-A search: default search budget 10 candidate pairs, UI configurable, with top 5 displayed suggestions. Preserve PB-0003 and existing FORTRAN / Writer1C / Writer2 authority semantics.

## Protocol / live basis

- Engineering Relay: V3.1, `Common@1ced68258afeaf50df113b1d38a4ceb9193587e3`
- Parent issue: #1232; `PLAN_UPDATE — rev 2` records the approved direction.
- Base/main: `d69f71ff9803e7fca1815a36e373335c95ca7dbb`
- PR: #1234, draft
- Pre-edit PR head: `dc71c0f315193380750e8370226916e288508048`
- Latest product/test head before this report refresh: `dc5b9d7ca1f69e0fb50c4b596716b3375fe95f60`
- Branch: `wp007-ft1232-004-anchor-perf`
- Open #1232 PR overlap observed: only #1234.
- Merge authority: OWNER_ONLY.

## Takeover qualification

`TAKEOVER_AUTHORITY = READ_ONLY` was used for re-grounding, then disposition `CONTINUE`.

- A1 Production trace: wrapper `suggestCiiBaseAnchorPairs()` → `suggestCiiPhysicalMethodAAnchors()` → `discoverCiiMethodABases()` → repeated `qualifyCiiGeometryTransform()`.
- A2 Failure isolation: predecessor instrumentation measured ~42.18 min in `ANCHOR_WRAPPER_PHYSICAL_CANDIDATES_MS`; raw and canonical core passes were milliseconds.
- A3 Authority/invariant: bounding physical candidates can change anchor identity; Owner explicitly approved the bounded-search direction in #1232. Geometry transform implementation itself remains unchanged.
- A4 Independent validation plan: focused candidate-budget test + existing anchor/multisource tests where runnable; retained PB-0003 benchmark remains authoritative.
- A5 Minimal patch: preselect physical candidates before `discoverCiiMethodABases()`, snapshot a UI-configurable multi-source search budget, independently cap visible suggestions to 5.

## Implemented behavior

1. `suggestCiiPhysicalMethodAAnchors()` now defaults to 10 physical candidate pairs and hard-caps at 24.
2. Candidate preselection is deterministic: highest connectivity/component-kind richness seeds the set, then a greedy SOURCE+TARGET spatial-spread score diversifies the remaining pairs; node IDs are final tie-breakers.
3. Physical Method-A seed and expansion limits are both capped to the selected physical pool, preventing the old 50+ pair geometry qualification path.
4. Instrumentation now records physical candidate count, configured search limit, and selected count.
5. The suggestion wrapper has a separate `baseAnchorDisplayLimit`; multi-source inspection defaults it to 5 without shrinking the core discovery suggestion limit.
6. Multi-source Inspect snapshots one search budget for the whole S1/S2/S3 operation. Default is 10; allowed UI/backend range is 3–24.
7. The shared Writer2 multi-source UI now shows `Method-A search pairs` as a number input before Inspect. The same control applies to retained and generic review-only routes.
8. Added `tests/cii-workspace-anchor-search-budget.test.js` covering default/min/max limits, deterministic 10-of-13 preselection, discovery-limit capping, display-limit independence, multi-source top-5 default, explicit API override, and UI contract text.

## Changed-file ledger

Current implementation files:

- `tabs/cii-workspace/cii-workspace-anchor-physical-candidates.js`
- `tabs/cii-workspace/cii-workspace-anchor-suggestions.js`
- `tabs/cii-workspace/cii-workspace-source-set.js`
- `tabs/cii-workspace/cii-workspace-multisource-review-only-filter-shell.js`
- `tests/cii-workspace-anchor-search-budget.test.js`
- `agents/PR1234_workreport.md`

Inherited predecessor instrumentation still in this PR:

- `tabs/cii-workspace/cii-workspace-anchor-suggestions-core.js`
- instrumentation additions in `tabs/cii-workspace/cii-workspace-anchor-suggestions.js`

No change was made to `cii-workspace-geometry.js`, FORTRAN parsing, Writer1C/Writer2 mutation semantics, retained fixtures, benchmark answers, or workflow files.

## Current hypothesis / falsifier

Hypothesis: bounding the physical Method-A pool to 10 before discovery removes the combinatorial freeze while keeping useful deterministic candidates.

Falsifier: retained accepted correspondence/output is lost, protected PB-0003 output changes, or the retained browser still exhibits an unacceptable unbroken main-thread stall. If falsified, revise ranking/budget or revisit the algorithm under a new plan; do not silently accept semantic drift.

## Validation state

- Live base/PR grounding: **PASS** — `main` remains `d69f71f…`; #1234 is the only open #1232 PR observed.
- Root-cause trace: **PASS** — predecessor real-data instrumentation + current code inspection.
- Diff scope inspection: **PASS** — no geometry-transform or writer-authority file changed.
- Focused regression test authored: **PASS** as artifact presence; execution **NOT_RUN**.
- Existing Node/unit suite: **NOT_RUN** — GitHub connector provides repository mutation/read access but no repository execution environment.
- GitHub Actions on product/test head `dc5b9d7…`: **NOT_RUN / unavailable** — no workflow runs or commit statuses were instantiated.
- Retained S1/S2/S3 → T browser benchmark: **NOT_RUN**.
- PB-0003 byte-closure / negative assurance: **NOT_RUN**.

Do not interpret the authored test or static diff inspection as runtime PASS.

## Highest risk

Candidate truncation is intentionally semantic-sensitive. The deterministic ranking is designed to preserve structurally informative and spatially diverse physical candidates, but only the retained benchmark can prove that the accepted S1/S2/S3 correspondence/basis outcome remains valid with the default budget of 10.

The UI search preference is ephemeral module state for the mounted multi-source workflow; `inspectCiiWorkspaceSourceSetWithVersionBridge()` snapshots it once at operation start so one Inspect cannot mix budgets across members.

## Backup / local ledger note

This session is operating through the GitHub connector against the private repository and does not expose a repository filesystem in which `node utils/backup.cjs` or the git-ignored `.agent-worklogs/` ledger can run. Pre-edit Git blob SHAs and commit history were preserved through GitHub and are recorded by the branch/commit history; no local backup/ledger claim is made.

## EXACT_NEXT_ACTION

Run `tests/cii-workspace-anchor-search-budget.test.js` plus the existing relevant anchor/source-set tests in a repository execution environment, then run the retained S1/S2/S3 → T benchmark with instrumentation. Record candidate count/search limit/selected count and `ANCHOR_WRAPPER_PHYSICAL_CANDIDATES_MS`; if retained semantics remain correct and responsiveness is acceptable, update #1232 with TASK_EVIDENCE and move PR #1234 toward review. If retained output changes, keep the PR draft and treat it as the plan falsifier.
