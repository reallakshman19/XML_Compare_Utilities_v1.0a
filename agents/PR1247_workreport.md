# PR1247 work report — Writer2 manual anchors as independent propagation seeds

## Mission

Repair the multi-source Writer2 semantic fork where one manual anchor recursively propagates but two or more manual anchors silently switch to locked-span comparison, then measure retained S1 one/two/three-anchor scenarios without predeclaring the required anchor count.

## Stack / live basis

- Issue: `reallaksh19/XML_Compare_Utilities#1239`
- PR: `reallaksh19/XML_Compare_Utilities#1247`
- Base dependency: draft PR #1246 / branch `fix/cii-writer2-anchor-proposal-actions-1239`
- Stack base SHA: `0df764857d89d6adc66d8b10e2282d7d67aee6f9`
- Branch: `fix/cii-writer2-anchor-propagation-experiment-1239`
- Merge authority: OWNER_ONLY / NOT_GRANTED

## Audit-first findings

1. Generic manual flat `anchorPairs` become one `USER_LOCKED_LEGACY` loop.
2. One pair -> `propagateSingleCiiAnchorCorrespondence` recursively explores the connected source component.
3. Two+ pairs -> `compareLockedCiiAnchorSpan` compares only the first↔last unique locked route and checks intermediate anchor ordering.
4. Therefore adding a second manual anchor changes algorithm class instead of adding another propagation seed/corroboration.
5. Generic multi-base arbitration cannot be reused unchanged because it discards a loop whose overall correspondence status is `UNRESOLVED`, even when that seed produced many valid bound rows.
6. V11↔V14 normalization clones the whole input and only replaces side byte fields, so an explicit seed-mode marker survives the bridge.

## Scoped repair

Multi-source Writer2 only sets `anchorPairMode: INDEPENDENT_SEEDS` on manual anchor member payloads.

Core behavior:
- generic callers without the marker keep historical `LEGACY_ANCHOR_PAIRS` behavior unchanged;
- marked manual pairs become one READY `USER_LOCKED_SEED` loop per exact reviewed pair;
- each seed uses the existing recursive single-anchor propagator;
- multiple seed results are combined by `arbitrateCiiSeedCorrespondences`.

Seed arbitration:
- keeps non-conflicting resolved claims from READY or partially `UNRESOLVED` seed propagations;
- prunes an unresolved source element/node claim only if another seed resolves that same source identity;
- detects source/target node and element contradictions across seeds;
- computes aggregate resolved source-element coverage;
- only returns aggregate READY when conflict-free coverage is complete and no unresolved row remains;
- preserves per-seed blockers as `seedDiagnostics` even when aggregate coverage resolves them;
- never upgrades a contradictory seed set.

## Declared denominator

| Unit | State |
|---|---|
| U1 identify one-vs-multi manual semantic fork | PASS static audit |
| U2 independent manual seed authority, multi-source only | IMPLEMENTED |
| U3 partial-seed conflict-veto arbitration | IMPLEMENTED |
| U4 retained S1 one/two/three experiment + legacy span baseline | AUTHORED / NOT_RUN |
| U5 metrics: coverage, ambiguity, benchmark recovery, runtime | AUTHORED / NOT_RUN |
| U6 exact-head PR/evidence | ACTIVE |

## Retained scenarios

- ONE: `3910 ↔ 875`
- TWO: `3910 ↔ 875`, `3940 ↔ 880`
- THREE: `3910 ↔ 875`, `3940 ↔ 880`, `3870 ↔ 870`

The experiment derives T→TEXPECTED positives dynamically and records, per scenario:
- anchor count;
- elapsed milliseconds;
- member correspondence status;
- seed coverage;
- blockers/seed diagnostics;
- cross-seed conflicts;
- locked/emitted node rows;
- S1 BOUND / UNRESOLVED / AMBIGUOUS / UNEMITTED census counts;
- qualified S1 NodeName changes;
- known-positive correspondence recovery attributable to S1;
- known-positive mutation recovery attributable to S1;
- additional qualified S1 mutations outside the partial benchmark.

It also runs TWO/THREE through the untouched generic legacy flat-anchor path as locked-span baselines.

Recommendation ranking is computed from observed data: conflict-free first, then known-positive mutation recovery, correspondence recovery, bound coverage, lower ambiguity, then fewer anchors. No retained result count or winning anchor count is hard-coded.

## Files

- `tabs/cii-workspace/cii-workspace-core.js`
- `tabs/cii-workspace/cii-workspace-correspondence-arbitration.js`
- `tabs/cii-workspace/cii-workspace-multi-base-correspondence.js`
- `tabs/cii-workspace/cii-workspace-multisource-preview.js`
- `tests/cii-workspace-manual-seed-arbitration.test.js`
- `tests/browser/cii-writer2-manual-anchor-cardinality.spec.mjs`

## Protected invariants

- Method A locked-span semantics unchanged.
- Method B qualification/propagation unchanged.
- generic/single-source legacy flat-anchor semantics unchanged by default.
- manual pairs remain exact USER LOCKED seed authority only.
- NodeName never becomes identity authority.
- cross-seed contradictions block; extra anchors cannot override conflicts.
- Writer mutation authority unchanged.
- benchmark files/answers unchanged.
- no workflow/deployment change.

## Validation truth

- source/architecture audit: PASS;
- stacked diff scope: PASS by GitHub compare;
- synthetic seed-arbitration test: AUTHORED / NOT_RUN;
- retained 1/2/3 browser experiment: AUTHORED / NOT_RUN;
- empirical winning anchor count: NOT_RUN / UNKNOWN;
- existing retained automatic S1/S2/S3 benchmark on this head: NOT_RUN;
- exact-head provider evidence: pending final head query;
- merge: NOT AUTHORIZED.

## MATERIAL_FRONTIER

Multi-source Writer2 manual-anchor orchestration + seed arbitration + experiment only.

## SEMANTIC_EVIDENCE_FRONTIER

Each reviewed manual pair is exact USER LOCKED seed authority. Propagated rows remain evidence-qualified, partial ambiguity is retained, and contradictions are conflict-vetoed.

## EXACT_NEXT_ACTION

Delete provisional WIP report, check exact-head GitHub statuses/workflows, publish `TASK_EVIDENCE` on #1239, then continue to review-state UX cleanup. Empirical 1/2/3 recommendation remains NOT_RUN until executable browser validation exists.