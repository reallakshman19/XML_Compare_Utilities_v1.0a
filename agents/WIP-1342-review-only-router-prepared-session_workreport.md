# WIP-1342 — generic review-only router prepared-session/cache wiring

PROTOCOL_REF:
reallaksh19/Common@3761d930ae061b899cc737d26390041ccc6db858:skills/engineering-pr-delivery-v3.2

Parent: #1322
Responsibility: #1342 P3.4-B
Stack base: #1341 qualified head a7e8c73ae2cf7d95207a5c1ed6911ffabc7c593d

## Scope

One production owner only:

- tabs/cii-workspace/cii-workspace-multisource-review-only-router.js

Focused qualification:

- tests/cii-workspace-review-only-router-prepared-session-wiring.test.js

## Implemented

B-U1:
- generic Inspect now calls prepareAndInspectCiiWorkspaceSourceSetWithVersionBridge();
- state retains inspection + preparedSession;
- state owns one createCiiCommonAnalysisCache() per generic custody epoch.

B-U2:
- generic Compare/rebind now call createCiiMultiSourceReviewOnlyPreviewFromPreparedSession();
- both reuse state.preparedSession + state.commonAnalysisCache;
- raw source/target inputs are no longer passed to the Compare builder.

B-U3:
- source/target change drops generic state through resetGeneric();
- destroy now also calls resetGeneric();
- manual/base authority edits preserve the retained cache for authority-key member invalidation;
- review-decision edits preserve the retained cache;
- exact retained S1/S2/S3 custody still delegates to mountCiiWriter2MultiSourceShell();
- zero-write blocker remains unchanged.

## Protected

No Writer2 UI change.
No P3.3 product change.
No BM001/mutation authority.
No generation/cancellation/Worker behavior.
No Benchmark mutation.

## Current material state

Product delta versus #1341 base: 11 additions / 8 deletions.
Focused test authored: 162 additions.
Exact-head hosted qualification: NOT YET RUN.

NEXT: open stacked draft PR and run B-U4 exact-head qualification.