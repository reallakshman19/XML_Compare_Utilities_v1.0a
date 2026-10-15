# Local executable evidence — BM-CII-W2-NB-R1-LOCAL-0001

WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1224
CHAIN_ID: CII-W2-NODENAME-BYTE-R1-1224
PROGRAM_BASIS_REVISION: PB-0003
BRANCH: revision/cii-writer2-nodename-byte-r1-1224
BRANCH_HEAD_BEFORE_CHECKPOINT: bf2edca942481e79427ee310a1da09769812acb3
MAIN_OBSERVED: 242fc1b1df7e398b64e15a1fd3e2f87d1ff5b581
OWNER_STRATEGY: skip workflow/CI and check locally; proceed robustly
OWNER_PROGRESSION: 2026-09-16 `proceed next`

## Execution surface

A local Node execution surface was used directly rather than GitHub Actions.

- Node: v22.16.0
- Git: 2.47.3
- shell DNS for `github.com` / `api.github.com`: unavailable
- shell GitHub credential: none exposed
- repository files used for focused execution were fetched through the connected GitHub repository source, then verified locally by Git blob identity where stated below
- no workflow result is used as product evidence in this receipt

## Exact production blob custody

The local copies used for the focused tests were checked with `git hash-object` against the GitHub blob SHA.

- `tabs/cii-workspace/cii-workspace-propagation.js`
  - GitHub blob: `0a422dfaae61a60d0eabe217cd47457adb543de6`
  - local Git blob: `0a422dfaae61a60d0eabe217cd47457adb543de6`
  - custody: EXACT_MATCH
- `tabs/cii-workspace/cii-workspace-writer1c-nodename.js`
  - GitHub blob: `4eda5077279393b2256612fefd5581f09cd95f2e`
  - local Git blob: `4eda5077279393b2256612fefd5581f09cd95f2e`
  - custody: EXACT_MATCH
- `tabs/cii-workspace/cii-workspace-target-writer-1c.js`
  - GitHub blob: `4b127d364d9e32519d82c25ea1f99672ed21552e`
  - local Git blob: `4b127d364d9e32519d82c25ea1f99672ed21552e`
  - custody: EXACT_MATCH

The propagation harness stubbed scoring dependencies only where the current failure occurs before scoring. The Writer1C harness stubbed SIF planning and physical-file byte access only outside the exercised NodeName path. The production modules under test were byte-identical to the GitHub blobs above.

## BM-008 focused current-product execution

Scenario: source anchor frontier has two required source edges; corresponding target anchor frontier has those two compatible edges plus one unrelated target-only edge.

Current exact production result:

```text
status: UNRESOLVED
blockers:
  FRONTIER_CARDINALITY_MISMATCH
  PROPAGATION_AMBIGUITY_RETAINED
  SOURCE_COMPONENT_NOT_FULLY_PROPAGATED
  TARGET_COMPONENT_NOT_FULLY_CLAIMED
sourceComponentEdgeCount: 2
targetComponentEdgeCount: 3
matchedEdgeCount: 0
unmatchedSourceElementIds: S1,S2
unmatchedTargetElementIds: T1,T2,TX
```

Classification: `CURRENT_PRODUCT_FAIL_LOCAL_EXACT_BLOB` for the PB-0003 requirement that a valid source-subgraph correspondence may survive unrelated target-only branches.

This is direct executable evidence for the already-inspected strict check:

```js
if (sourceEdges.length !== targetEdges.length)
  return { status:'BLOCKED', blocker:'FRONTIER_CARDINALITY_MISMATCH' };
```

## Non-committed minimal candidate validation

A local-only candidate was applied to the exact production propagation file. It was not committed or written to GitHub production code.

Candidate delta:

1. frontier cardinality blocks only when `sourceEdges.length > targetEdges.length`;
2. a visited source leaf with no remaining source edges terminates even when target-only edges remain;
3. unmatched target component edges remain reported evidence but no longer add `TARGET_COMPONENT_NOT_FULLY_CLAIMED` as an automatic blocker.

Focused executable cases:

- `extra-anchor-branch`: PASS — READY, source 2 -> target 3, matched 2, unmatched target `TX` retained as evidence.
- `target-only-leaf`: PASS — READY, matched source path terminates while target has unrelated continuation `TX`.
- `missing-required-target`: PASS negative — UNRESOLVED with `FRONTIER_CARDINALITY_MISMATCH` and `SOURCE_COMPONENT_NOT_FULLY_PROPAGATED`.
- `injective-competition`: PASS negative — target cardinality is sufficient, but two source requirements can only claim the same target; `NO_SUPPORTED_FRONTIER_ASSIGNMENT` and source-completeness blockers remain.

Local candidate result: `PB0003_LOCAL_CANDIDATE_PASS`.

This validates the intended minimal patch shape while preserving the existing injective assignment enumeration, winner-gap logic, source completeness, and ambiguity blocking.

## Protected Writer1C local execution

The exact Writer1C NodeName planning and application blobs were exercised with a synthetic physical file and qualified exact-span custody.

Positive replacement:

- one reviewed/explicit APPLY NodeName COPY using `CII_WRITER_1C_NODENAME_EXISTING_ROW_FIELD`;
- equal-width existing-row field mutation;
- byte length preserved;
- bytes before the selected span preserved exactly;
- bytes after the selected span preserved exactly;
- an unrelated `SIF&TEES:UNCHANGED` suffix remained byte-identical.

Negative fail-closed cases:

- stale physical preimage -> `CII_WRITER_1C_PREIMAGE_MISMATCH`;
- selected owner sharing a physical row with an unselected alias -> `WRITER_1C_NODENAME_UNAPPROVED_ALIAS_EFFECT`;
- field overflow -> `WRITER_1C_NODENAME_FIELD_OVERFLOW`;
- non-ASCII proposed name -> `WRITER_1C_NODENAME_NON_ASCII`.

Local result: `WRITER1C_LOCAL_PROTECTED_PRIMITIVE_PASS`.

Conclusion: no local evidence justifies changing Writer1C low-level existing-row NodeName authority. The future production patch should remain concentrated on correspondence/selectability/orchestration unless later retained-real evidence falsifies this result.

## Truth boundary

This receipt is **not** the retained-real PB-0003 multisource benchmark run.

The local container still lacks authenticated repository transport and the exact retained S1/S2/S3/T/TEXPECTED checkout was not reconstructed. Therefore:

- retained structural baseline: `NOT_RUN_ENVIRONMENT`;
- `tests/cii-workspace-multisource-pb0003-benchmark.test.js`: `NOT_RUN_ENVIRONMENT`;
- BM-007 retained TEXPECTED lower-bound census execution: unchanged / not run here;
- BM-008 focused propagation requirement: executable current-product failure captured locally, with non-committed minimal candidate passing focused positive/negative cases;
- production source mutation: NONE;
- frozen benchmark/oracle mutation: NONE;
- workflow/CI reliance for this evidence: NONE.

## Qualification / authority

QUALIFICATION_STATE: ANSWER_COMPLETE_VERDICT_DEFERRED_FOR_BENCHMARK
INDEPENDENT_VERDICT_STATUS: DEFERRED_UNTIL_EXECUTABLE_RETAINED_BENCHMARK_EVIDENCE
WRITE_AUTHORITY: READ_ONLY
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE

The local targeted evidence does not self-grant qualification or production write authority.

## Exact next action

Obtain an authenticated full checkout/build surface (or otherwise reconstruct the exact retained repository inputs without byte loss) and run the retained structural baseline plus `tests/cii-workspace-multisource-pb0003-benchmark.test.js` directly under Node. Capture actual stdout/assertion output without relying on CI. Then obtain the independent Q1-Q5 qualification verdict; after PASS and post-basis reconciliation, the first production patch should be the already-locally-proven minimal propagation change before multisource REPLACE orchestration work.