# #1327 P3.3-C work report — bounded ephemeral common-analysis cache

## Recovery header

```text
RESPONSIBILITY: #1327 P3.3-C
PARENT: #1321
DESIGN: #1313 issuecomment-6026961531
KEY: #1325 / PR #1330
PREPARED_PREVIEW: #1326 + #1335
PROTOCOL_REF: reallaksh19/Common@b47f16746a2f9029e7dcd7f523536046a847dc67:skills/engineering-pr-delivery-v3.2
STACK_BASE: #1336 @ 836d2d18ddbf199b5643a226d05649c4a6ce03be
BRANCH: fix/cii-common-analysis-cache-1327
PRODUCT_OWNER: tabs/cii-workspace/cii-workspace-multisource-preview.js
MERGE_AUTHORITY: OWNER_ONLY
```

## Mission

Add optional caller-held common-analysis reuse for the prepared Writer2 path.

Cache invariants:
- one entry per sourceId;
- authority change replaces that entry;
- prepared-session custody change clears all entries;
- no historical key accumulation;
- review/Writer projection state never enters the key.

## Protected

- no generic review-only path;
- no UI wiring;
- no raw legacy API change;
- no geometry/correspondence/Writer policy change;
- no Benchmark mutation.

## Implemented material

Production:
- `tabs/cii-workspace/cii-workspace-multisource-preview.js@d8d669b174c97a543cfd139df7d14e6bd71b76ce`

Focused retained cache test:
- `tests/cii-workspace-common-analysis-cache.test.js@d4958bf9e7513176d23499c3f3bedb72b05542b2`

Implemented:
- `createCiiCommonAnalysisCache()`;
- canonical prepared-session cache identity based on P3.3-A custody;
- one `Map` entry per sourceId;
- per-member `ciiCommonAnalysisAuthorityKey()` lookup;
- hit/miss/reset instrumentation;
- full-session reset when custody identity changes;
- source authority change replaces only that source entry.

No cache supplied preserves P3.3-B behavior.

## Current state

```text
STATE: PRODUCT_AUTHORED
HOSTED_QUALIFICATION: NOT_YET_RUN
CACHE_BOUND: ONE_ENTRY_PER_SOURCE
REVIEW_ONLY_PATH: NONE
UI_WIRING: NONE
BENCHMARK_MUTATION: NONE
NEXT: stacked draft PR + exact-head qualification
```
