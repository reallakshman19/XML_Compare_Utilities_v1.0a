# #1325 P3.3-A work report — deterministic common-analysis authority key

## Recovery header

```text
RESPONSIBILITY: #1325 P3.3-A
PARENT: #1321
DESIGN: #1313 issuecomment-6026961531
MICRO_DECOMPOSITION: #1232 issuecomment-6027252460
PROTOCOL_REF: reallaksh19/Common@b47f16746a2f9029e7dcd7f523536046a847dc67:skills/engineering-pr-delivery-v3.2
STACK_BASE: #1324 @ c637db92295d379ca6cc3b8aa69d7ace8ff51b5f
BRANCH: fix/cii-common-analysis-authority-key-1325
MERGE_AUTHORITY: OWNER_ONLY
```

## One responsibility

Define a pure deterministic key for one prepared source member's writer-independent common analysis.

The key owns:
- prepared SOURCE/TARGET custody identity;
- sourceId;
- canonical base/manual authority;
- normalized common-analysis semantic options.

It must exclude:
- writerVersion;
- review decisions;
- transfer scope;
- instrumentation;
- cryptoRef implementation;
- source-set display/search discovery options;
- TEXPECTED/BM identities.

## Protected

No cache.
No preview execution.
No UI.
No Benchmark mutation.

## Implemented material

Production helper:
- `tabs/cii-workspace/cii-workspace-common-analysis-key.js@6baf90caff8c457fa64e1ac859b5f3d3127063c3`

Focused generic test:
- `tests/cii-workspace-common-analysis-authority-key.test.js@458e3e8c4dccfe2e6faa1616774f808687388513`

Reconciled implementation:
- deterministic canonical preimage + SHA-256 key;
- canonical Method-A / Method-B loops and manual seed authority;
- explicit-base loops require stable base IDs and fail closed otherwise;
- order-invariant prepared custody from sorted member hashes + target hashes + conversion policy;
- current order-sensitive `sourceSetSha256` is deliberately not direct cache authority;
- complete normalized common-analysis option contract with current defaults;
- known writer/review/display/search/oracle options excluded;
- unknown serializable options conservatively invalidate the key;
- legacy ignored `diameterToleranceRatio` / `wallToleranceRatio` aliases do not create false misses.

Falsifiers cover:
- loop/pair/probe order invariance;
- prepared member order invariance even when current sourceSetSha changes;
- real SOURCE/TARGET/converter custody invalidation;
- explicit-vs-implicit default equivalence;
- each traced semantic option invalidation;
- Writer/review/display/oracle exclusion;
- manual seed mode separation;
- incomplete custody fail-closed behavior.

No cache object or preview call is introduced.

## Current state

```text
STATE: PRODUCT_AUTHORED
CACHE: NONE
PREVIEW_EXECUTION: NONE
UI: NONE
BENCHMARK_MUTATION: NONE
NEXT: open stacked draft PR and qualify exact head
```


## Parallel-work reconciliation

A parallel implementation was found on this same branch and PR #1330.

It was not overwritten blindly. The existing key/test scaffolding was retained and hardened to satisfy #1325 issuecomment-6027364103:
- removed direct dependence on order-sensitive `sourceSetSha256`;
- expanded semantic option coverage;
- strengthened fail-closed and future-option behavior.

No cache or preview code was added during reconciliation.

## Next qualification

Exact-head qualification must prove:
1. only helper/test/report changed relative to #1324;
2. helper + test syntax;
3. focused deterministic key contract;
4. P3.2 prepared-session custody remains PASS;
5. no Benchmark/multisource-preview/UI mutation.


## Qualification iteration

Validation v3:
- run `37547723699`;
- exact diff/blob guard: PASS;
- syntax: PASS;
- focused key test: FAIL at explicit-default equivalence.

Root cause:
```text
raw options.limit
  -> normalized landmarkLimit
  -> also classified as unknown extra option

raw options.coordinateToleranceMm
  -> normalized spatialToleranceMm
  -> also classified as unknown extra option
```

That double-counted aliases and produced a false cache miss between omitted defaults and explicitly supplied equivalent defaults.

Repair:
- classify `limit` and `coordinateToleranceMm` as normalized aliases excluded from the future-option bucket;
- no authority/custody/cache/preview behavior changed.

Updated key helper blob:
`db8573e6cca0cff6bbf7fbeef97c3690418d5688`

Focused test remains:
`458e3e8c4dccfe2e6faa1616774f808687388513`

Next: fresh exact-head qualification on a new validation branch.
