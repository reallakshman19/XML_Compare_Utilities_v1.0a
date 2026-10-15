# #1294 U4.3 work report — Method-A base-anchor node-custody parity

## Recovery header

```text
RESPONSIBILITY: #1294 U4.3
PROTOCOL_REF: reallaksh19/Common@b47f16746a2f9029e7dcd7f523536046a847dc67:skills/engineering-pr-delivery-v3.2
PR: #1298 OPEN / DRAFT
BRANCH: fix/cii-method-a-base-anchor-custody-1294
BASE: PR #1297 @ 02e17c61f238dbdfa1a9d1bb5707ec0f235a330b
HEAD_BEFORE_REPORT_REFRESH: 3bf6145b0998fd09b7872ead2b471831c9085ae1
MERGE_AUTHORITY: OWNER_ONLY / NOT AUTHORIZED
RETAINED_ACCEPTANCE: #1291 ONLY
```

## Selected responsibility

Extend the existing D5.3 node-custody reconciliation to independently qualified canonical Method-A base anchors.

Owner:
`tabs/cii-workspace/cii-workspace-node-custody.js`.

## Preimage

`cii-workspace-node-custody.js@6e7cb74f9533cde025bee083cdc8ac2b0b05cb25`.

## Intended rule

Preserve a node through winner-gap-only custody when it is independently qualified by either:
- `METHOD_A_QUALIFIED_ADJACENT_BOUNDARY`; or
- `METHOD_A_QUALIFIED_BASE_ANCHOR`.

The base-anchor path must be attested by `multiBaseProvenance` from a HIGH/MEDIUM Method-A contributor with row authority `METHOD_A_QUALIFIED_ANCHOR`.

The existing `winnerGapOnlyReview()` predicate remains unchanged.

## Protected

No edits to:
- alignment;
- Method-A projection;
- arbitration;
- element candidate thresholds/winner gap;
- Method B/manual;
- confidence values;
- geometry/preselection;
- review/engineering delta/Writer;
- Benchmark/TEXPECTED.

## Implemented material

Production:
- `tabs/cii-workspace/cii-workspace-node-custody.js@221ae3dd5ea6f1e98afaf763646885db91e51ff2`

Focused generic test:
- `tests/cii-workspace-method-a-base-anchor-custody.test.js@a01f9e216dd3c21cbd95baf60d763b2d6746d28a`

Protected inherited blobs:
- U4.1 alignment: `cfdbd033c2852627908874e2542de0e0c33f3014`
- U4.2 Method-A projection: `00b8fc6054b14afd8b6b299d477c940843cb2b85`
- arbitration: `ff26a1921dc527a7d7cef2e9a94c56b92651484f`

PR #1298 changed paths are exactly:
1. `agents/WIP-1294-base-anchor-custody_workreport.md`
2. `tabs/cii-workspace/cii-workspace-node-custody.js`
3. `tests/cii-workspace-method-a-base-anchor-custody.test.js`

## Implemented parity

The existing D5.3 adjacent-boundary qualification function is unchanged.

U4.3 adds a separate base-anchor qualification predicate requiring:
- READY correspondence;
- no correspondence or target-custody conflicts;
- REVIEW node with Method-A / Method-A+B basis;
- identitySupported true;
- confidence HIGH/MEDIUM;
- evidence basis `METHOD_A_QUALIFIED_BASE_ANCHOR`;
- Method-A multi-base provenance with HIGH/MEDIUM base confidence and `METHOD_A_QUALIFIED_ANCHOR` row authority.

The existing winner-gap-only affected-element predicate is reused unchanged.

## Validation truth before hosted run

```text
PRODUCT_IMPLEMENTATION: AUTHORED / NOT_YET_HOSTED
FOCUSED_TEST: AUTHORED / NOT_YET_HOSTED
ADJACENT_BOUNDARY_D5_3: PRESERVED
RETAINED_36_OF_36: NOT_RUN / #1291 ONLY
BENCHMARK_MUTATION: NONE
MERGE: NOT AUTHORIZED
```

## Exact next action

Create a validation-only branch from the refreshed PR #1298 head and run:
- exact changed-path/blob guards;
- U4.3 focused parity test;
- inherited D5.3 adjacent-boundary custody regression;
- U4.2 projection regression;
- U4.1 raw boundary-local regression.

Do not edit this report after qualification.
