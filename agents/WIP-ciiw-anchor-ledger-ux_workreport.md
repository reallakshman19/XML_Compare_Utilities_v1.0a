# WIP-ciiw-anchor-ledger-ux

## Mission
Correct the live Writer2 multi-source anchor/review UX without weakening engineering authority:
- show one editable source-set master ledger of selected/locked anchor authority above per-source match-basis evidence;
- make manual `USER LOCKED` anchors visibly distinct from HIGH/MEDIUM auto-correspondence review;
- make zero-result bulk HIGH/MEDIUM actions true no-ops;
- make review-only anchor proposals human-readable, including explicit Node Name discovery evidence when present;
- retain Method B's >=2 independent-axis automatic qualification gate.

## Live grounding
- base/main at takeover: `186a95c221279ff963bb22fe7d5befd3de436eea` (includes unrelated #1100 Find & Replace version-detection fix).
- branch: `fix/cii-writer2-anchor-ledger-readable-basis`.
- predecessor Writer2 UI changes: #1098; Pages cache refresh #1099.
- exact live symptom: three reviewed manual anchors S1 `3870->870`, S2 `120->40070`, S3 `1890->21890` are displayed as USER LOCKED, but clicking `Accept all HIGH` reports `0 HIGH ... marked Accept` and still dirties the ledger / demands Apply approvals.
- current proposal evidence already carries `candidateGeneration.reviewDiscovery.nodeName` plus one-axis run lengths; UI hides this in technical/identity wording instead of showing the human reason.

## Current failure isolation
1. `onBulkHigh` / `onBulkMedium` unconditionally call `markReviewDirty(...)` even when `bulkAcceptCiiMultiSourceReview()` returns 0. No decision changed, but Transfer Preview is invalidated.
2. Manual anchors enter correspondence as `status: LOCKED` via `lockedNodeRows()`, so they are already review-authoritative for those node pairs; they should not be represented as missing HIGH acceptance.
3. Selected anchor authority is split between per-source automatic-base UI and per-source manual fallback UI; there is no single owner-visible ledger.
4. `candidateMarkup()` leads with internal score/rank/gap and full Method A/B telemetry while exact Node Name review discovery exists only in `candidateGeneration.reviewDiscovery`/identity exclusions.

## Authority / invariants
- Manual anchor locks only the explicitly reviewed SOURCE/TARGET node pair and supplies base authority; it does not promote propagated one-axis correspondence rows to automatic identity.
- Method B automatic qualification remains fail-closed at >=2 independent axes on SOURCE and TARGET.
- Exact existing Node Name is review discovery/corroboration only, never correspondence identity authority.
- No Writer2 mutation engine, NODENAME relocation, V11/V14 converter, target-shadow, projector, or workflow change is in scope.

## Appendix A implementation takeover qualification
### A1 Production trace — 20/20
`mountCiiWriter2MultiSourceShell` -> manualBySource/selectedBySource -> `previewInput()` -> `createCiiWriter2SourceSetPreviewWithVersionBridge`; visible review uses `ciiMultiSourceReviewMarkup`; manual anchor correspondence becomes LOCKED through core `normalizeAnchorPairs()` / `lockedNodeRows()`.

### A2 Current failure isolation — 20/20
Zero-count bulk acceptance calls `markReviewDirty` unconditionally. Proposal rows already include exact-name review discovery but `candidateMarkup()` does not surface it as the primary reason.

### A3 Authority / invariant — 20/20
Preserve two-axis Method B gate and review-only Node Name semantics. Manual lock does not confer automatic route-wide acceptance.

### A4 Independent validation — 18/20
Independent live user observation provides exact anchor pairs and resulting UI. Current source inspection confirms LOCKED anchor row semantics and zero-count dirty-state bug. Full browser rerun is NOT_RUN until patch is deployed.

### A5 Next-commit / minimal patch — 20/20
Add a small dedicated anchor-ledger UI module, wire it into existing multi-source shell, make zero-count bulk action a no-op, simplify proposal card top-level evidence, and add focused tests/styles. No core correspondence thresholds or Writer2 writer changes.

**Qualification: 98/100; each challenge >=18/20. TAKEOVER_AUTHORITY -> IMPLEMENTATION. Decision: CONTINUE.**

## Local recovery state
A local `.agent-worklogs/20260903_1519_ciiw-anchor-ledger-ux/` ledger was created from the exact successful Pages artifact for main `186a95c...`. Repository backup utility saved pre-edit backups for:
- `cii-workspace-multisource-writer2-ui.js` backup #1, SHA-256 `40793747fc7ae6f1a16f2c0bf1ab7793539821083053b4263cc794ffd068f093`;
- `cii-workspace-engineering-ui.js` backup #2, SHA-256 `aaf73d92068bbff87f7b39f8aefe7afe8a2c15111c331023a33558587e368a09`;
- `cii-workspace-transfer-scope-ui.css` backup #3, SHA-256 `0d470da7d282ac81f1fc4eb6b482254a960f1af0ccf3355cb4599e3bb4d657c3`.

## Validation state
- source inspection / RCA: PASS (inspection oracle + live user evidence).
- product/browser after patch: NOT_RUN.
- CI/workflows: NOT_RUN.

## EXACT_NEXT_ACTION
Implement the isolated ledger/status/proposal-UX patch on this branch, add focused regression tests, run local Node tests against the extracted exact-main artifact, then open a PR. Merge authority remains OWNER_ONLY.
