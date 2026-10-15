# #1341 P3.4-A work report — retained Writer2 UI prepared-session/cache wiring

## Recovery header

```text
RESPONSIBILITY: #1341 P3.4-A
PARENT: #1322
PROTOCOL_REF: reallaksh19/Common@46916f4828090c1f32cf2856186b0b00defdbea3:skills/engineering-pr-delivery-v3.2
STACK_BASE: P3.3 @ 4c07c1da6bbbf90e318330c1550a4762e87281c5
BRANCH: fix/cii-writer2-ui-prepared-session-1341
PRODUCT_OWNER: tabs/cii-workspace/cii-workspace-multisource-writer2-ui.js
MERGE_AUTHORITY: OWNER_ONLY
```

## Units

```text
A-U1 Inspect session retention
A-U2 Prepared Compare/review path
A-U3 Invalidation discipline
A-U4 Exact-head qualification
```

## Protected

No review-only router change.
No generation/epoch or duplicate suppression.
No cancellation/AbortSignal.
No Worker.
No Benchmark mutation.

## Implemented material

Production:
- `tabs/cii-workspace/cii-workspace-multisource-writer2-ui.js@d898258c1c2ff149e3025744fd741cdbf1d27480`

Focused wiring test:
- `tests/cii-workspace-writer2-ui-prepared-session-wiring.test.js@a5a9f1ce9c5db6d4947aa9feeb9e0430031c9001`

Implemented:
- Inspect retains `preparedSession`;
- one `commonAnalysisCache` is created per successful Inspect custody epoch;
- Compare and review rebind use `createCiiWriter2SourceSetPreviewFromPreparedSession()`;
- prepared Compare input carries only authority/review state, not SOURCE/TARGET raw bytes;
- file/reset clears prepared runtime;
- anchor/manual/review changes retain cache for key-based reuse;
- destroy releases prepared/session/cache/raw-runtime references.

## Current state

```text
STATE: PRODUCT_AUTHORED
COMPLETED_MATERIAL_UNITS: A-U1 / A-U2 / A-U3
A-U4_FOCUSED_TEST: AUTHORED
EXACT_HEAD_QUALIFICATION: NOT_YET_RUN
REVIEW_ONLY_ROUTER_CHANGE: NONE
GENERATION_CANCELLATION_CHANGE: NONE
BENCHMARK_MUTATION: NONE
NEXT: open stacked draft PR + hosted A-U4 qualification
```

Do not edit product after the qualification candidate is frozen; publish exact-head evidence on #1341.
