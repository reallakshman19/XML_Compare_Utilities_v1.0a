# #1293 U4.2 work report — Method-A boundary-local identity projection

## Recovery header

```text
RESPONSIBILITY: #1293 U4.2
PROTOCOL_REF: reallaksh19/Common@b47f16746a2f9029e7dcd7f523536046a847dc67:skills/engineering-pr-delivery-v3.2
PR: #1297 OPEN / DRAFT
BRANCH: fix/cii-method-a-boundary-local-projection-1293
BASE: PR #1296 @ 82b238a7521acdca2072727cd6438f73ad593593
HEAD_BEFORE_REPORT_REFRESH: 52362146a1bb56e7b139b097818fc8e6dcf5c102
MERGE_AUTHORITY: OWNER_ONLY / NOT AUTHORIZED
RETAINED_ACCEPTANCE: #1291 ONLY
```

## Selected responsibility

Consume U4.1 raw `boundaryIdentity` evidence inside qualified Method-A projection only.

Owner:
`tabs/cii-workspace/cii-workspace-multi-base-correspondence.js`.

## Preimage

`cii-workspace-multi-base-correspondence.js@adf5c71f189f564cea87e38f55f62a36817e9d20`.

## Intended rule

For REVIEW `ADJACENT_MATCH_BOUNDARY` rows and a qualified HIGH/MEDIUM Method-A loop:

```text
supported =
  existing HIGH/HIGH whole-edge boundary evidence
  OR
  row.evidence.boundaryIdentity.identitySupported === true
```

When supported:
- identitySupported=true;
- identityConfidence=loop confidence;
- identityEvidenceBasis=METHOD_A_QUALIFIED_ADJACENT_BOUNDARY;
- row remains REVIEW.

No confidence promotion beyond loop evidence.

## Protected

No edits to:
- U4.1 alignment raw evidence;
- arbitration;
- node custody;
- Method B/manual;
- candidate thresholds/winner gap;
- geometry/preselection;
- review/engineering delta/Writer;
- Benchmark/TEXPECTED.

## Implemented material

Production:
- `tabs/cii-workspace/cii-workspace-multi-base-correspondence.js@00b8fc6054b14afd8b6b299d477c940843cb2b85`

Focused generic test:
- `tests/cii-workspace-method-a-boundary-local-projection.test.js@aaef0c3ed47f804d3b1917f24fcc527d3e4614eb`

Protected inherited blobs:
- U4.1 alignment: `cfdbd033c2852627908874e2542de0e0c33f3014`
- D5.3 node custody: `6e7cb74f9533cde025bee083cdc8ac2b0b05cb25`

PR #1297 changed paths are exactly:
1. `agents/WIP-1293-boundary-local-projection_workreport.md`
2. `tabs/cii-workspace/cii-workspace-multi-base-correspondence.js`
3. `tests/cii-workspace-method-a-boundary-local-projection.test.js`

## Focused contract

The projection supports a REVIEW `ADJACENT_MATCH_BOUNDARY` only when a qualified HIGH/MEDIUM Method-A loop exists and either:
- the existing whole-edge HIGH/HIGH rule succeeds; or
- U4.1 `boundaryIdentity.identitySupported === true`.

Confidence remains capped to the Method-A loop. Raw/canonical workflow status is not promoted to LOCKED.

## Validation truth before hosted run

```text
PRODUCT_IMPLEMENTATION: AUTHORED / NOT_YET_HOSTED
FOCUSED_TEST: AUTHORED / NOT_YET_HOSTED
NODE_CUSTODY: UNCHANGED
RETAINED_36_OF_36: NOT_RUN / #1291 ONLY
BENCHMARK_MUTATION: NONE
MERGE: NOT AUTHORIZED
```

## Exact next action

Create a validation-only branch from the refreshed PR #1297 head and run:
- exact changed-path/blob guards;
- U4.2 focused projection test;
- U4.1 raw boundary-local evidence regression;
- inherited D3 boundary provenance and projection-integration regressions.

Do not edit this report after the qualification run; publish exact-head evidence on #1293 so the validated product head remains stable.
