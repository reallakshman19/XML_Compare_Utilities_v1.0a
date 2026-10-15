# PR1102 work report — CII Writer2 anchor authority / proposal UX

## Mission
Correct the live Writer2 multi-source anchor/review UX without weakening correspondence authority:
- show one editable source-set master ledger of selected/locked anchor authority above per-source match-basis evidence;
- make manual `USER LOCKED` anchors visibly distinct from HIGH/MEDIUM automatic correspondence review;
- make zero-result bulk HIGH/MEDIUM actions true no-ops;
- show a concise human-readable explanation for anchor proposals, including explicit Node Name review-discovery evidence when present;
- retain Method B's >=2 independent-axis automatic qualification gate.

## Base / branch / PR
- takeover base: `main@186a95c221279ff963bb22fe7d5befd3de436eea` (includes unrelated #1100 Find & Replace V14 version-detection fix).
- branch: `fix/cii-writer2-anchor-ledger-readable-basis`.
- PR: #1102.
- predecessor Writer2 UI changes: #1098.
- Pages cache refresh: #1099.
- merge authority: **OWNER_ONLY**.

## Live user evidence
Reviewed manual anchors:
- S1 `3870 -> 870`
- S2 `120 -> 40070`
- S3 `1890 -> 21890`

Source-set custody shown correctly by product:
`5390166aab9504880bd4514af865c914ba8a41ce2922e7d473311d62b10723a3`

Reported defect after setting those anchors:
`0 HIGH correspondence rows marked Accept. Apply approvals to Transfer Preview to bind this review ledger.`

Owner also requested:
1. an editable master anchor table above `INPUTS & MATCH BASIS`;
2. master list updates when manual anchors are added/edited;
3. a concise explanation of why an anchor was proposed, with Node Name basis visible;
4. removal of unnecessary top-level technical noise.

## Root cause
### RCA-01 — zero-count bulk action dirtied review state
`onBulkHigh` / `onBulkMedium` called `markReviewDirty(...)` even when `bulkAcceptCiiMultiSourceReview()` returned 0. No decision changed, but Transfer Preview was invalidated and the UI demanded Apply approvals.

### RCA-02 — manual anchors already are LOCKED
Core correspondence normalizes reviewed manual anchors as user-locked anchor authority. Anchor correspondence rows become `workflowStatus/decision: LOCKED`; therefore the manually reviewed base row itself does not require HIGH acceptance.

Remaining propagated rows correctly remain REVIEW where one-axis evidence is insufficient for automatic identity authority.

### RCA-03 — selected authority had no single visible owner ledger
Automatic Method A/B selections and reviewed manual pairs were rendered in separate per-source sections. There was no single source-set view answering “which anchors are actually chosen now?”

### RCA-04 — Node Name review-discovery evidence existed but was buried
Anchor suggestions already carry `candidateGeneration.reviewDiscovery.nodeName` plus one-axis run lengths/delta/tolerance/terminator compatibility. The visible card led with structural score, rank, winner gap, and Method A/B telemetry instead of the human reason.

## Authority invariants
- Manual anchor locks only the explicitly reviewed SOURCE/TARGET node pair and supplies base authority.
- Manual anchor does **not** promote propagated one-axis rows to automatic correspondence.
- Method B automatic qualification remains fail-closed at >=2 independent axes on SOURCE and TARGET.
- Exact existing Node Name remains review discovery/corroboration only; it is not correspondence identity authority.
- Target-conflict veto remains unchanged.
- No Writer2 mutation engine, NODENAME relocation, V11/V14 converter, target-shadow, projector, or workflow change.

## Implementation
### `cii-workspace-multisource-anchor-ledger-ui.js` — new
Adds `Source-set Anchor Authority` before the per-source match-basis blocks.

The ledger shows:
- SOURCE member S1/S2/S3;
- authority type (`USER LOCKED`, Method A, Method B);
- SOURCE node;
- TARGET node;
- state;
- action.

Reviewed manual rows are editable with `Update` and removable. Selected automatic bases are removable. The table is regenerated from the actual `manualBySource` / `selectedBySource` authority maps, so `Add reviewed anchor`, edit, remove, and Method A/B selection all update the same master view.

The same module adds an `Anchor proposal rationale` summary before technical per-source cards. For review-discovery pairs it shows:
- exact unique existing Node Name;
- network run direction and SOURCE/TARGET length;
- length delta;
- OD-scaled tolerance;
- terminator agreement;
- explicit authority reason: e.g. `REVIEW · 1/1 axes; automatic Method B requires at least 2/2`.

Example represented by focused regression:
- S1 `3870 <-> 870`
- Node Name `SL-097.19`
- Z run `63564 mm <-> 63564 mm`
- delta `0 mm`
- tolerance `546 mm`
- REVIEW because only `1/1` independent axes exist.

### `cii-workspace-multisource-review-ui.js`
Adds a pure bulk-outcome wrapper:
- eligible HIGH/MEDIUM rows > 0 => normal dirty/apply workflow;
- eligible rows = 0 => `changed:false`, no review dirtying, no Transfer Preview invalidation.

No-op status reports the existing LOCKED anchor count and explains that REVIEW/UNRESOLVED rows require explicit decisions.

### `cii-workspace-multisource-writer2-ui.js`
- renders master ledger immediately after source-set custody and before member match-basis sections;
- wires master manual Update/Remove and automatic-base removal;
- reports LOCKED reviewed anchor rows separately from REVIEW correspondence after Compare;
- uses bulk outcome to dirty review state only when a decision actually changed.

### `cii-workspace-transfer-scope-ui.css`
- styles master ledger and proposal-rationale table;
- keeps manual action buttons compact;
- hides the largest Method A/B telemetry blocks only inside the multi-source member cards, because the human-readable rationale now precedes them;
- single-source engineering evidence CSS/renderer is unchanged.

### Focused regressions
- `tests/cii-workspace-multisource-anchor-ledger-ui.test.js`
  - selected Method B + USER LOCKED rows share one master ledger;
  - manual edit controls exist;
  - zero-HIGH with three LOCKED anchors returns `changed:false` and leaves decisions untouched;
  - positive HIGH acceptance still changes decision state.
- `tests/cii-workspace-multisource-anchor-rationale-ui.test.js`
  - pins S1-like `3870 <-> 870` rationale with Node Name `SL-097.19`, 63,564 mm network match, zero delta, 546 mm tolerance, and the 2/2 Method B gate explanation.

## Appendix A implementation takeover qualification
### A1 Production trace — 20/20
`mountCiiWriter2MultiSourceShell` -> manual/selected authority maps -> `previewInput()` -> source-set preview. Visible review uses combined multi-source review; manual base authority enters core locked anchor correspondence.

### A2 Current failure isolation — 20/20
Zero-count bulk dirty-state reproduced directly from handler logic. Manual anchor LOCKED semantics confirmed in core/review code. Exact-name review-discovery payload confirmed in anchor suggestion model.

### A3 Authority / invariant — 20/20
Two-axis Method B gate and review-only Node Name semantics retained. Manual lock remains explicit node-pair authority only.

### A4 Independent validation — 18/20
Exact live user observation plus current source inspection and local tests. Full browser/Worker rerun remains Owner product acceptance.

### A5 Next-commit / minimal patch — 20/20
Seven paths only; no writer/converter/projector/workflow modifications. Single-source engineering renderer deliberately left untouched.

**Qualification: 98/100; each challenge >=18/20. Decision: CONTINUE.**

## Recovery / backup evidence
Local exact-main workspace was extracted from successful Pages artifact for `main@186a95c...`, workflow run `33748149910`.

Repository backup utility was run before edits on existing production paths. Pre-edit SHA-256 receipts include:
- multi-source Writer2 UI: `40793747fc7ae6f1a16f2c0bf1ab7793539821083053b4263cc794ffd068f093`;
- transfer-scope CSS: `0d470da7d282ac81f1fc4eb6b482254a960f1af0ccf3355cb4599e3bb4d657c3`;
- multi-source review UI: `48331b1f733139e7f360f09049a5888450f2678d887307beb965d8c5784e408e`.

Local patch ledger:
`.agent-worklogs/20260903_1519_ciiw-anchor-ledger-ux/`

## Validation
Local PASS:
- syntax checks on modified/new JS;
- existing `tests/cii-workspace-engineering-ui.test.js`;
- existing `tests/cii-workspace-multisource-review-ui.test.js`;
- existing `tests/cii-workspace-multisource-review-registration.test.js`;
- new master-ledger / zero-count bulk no-op regression;
- new concise proposal-rationale regression.

NOT_RUN:
- browser/Worker end-to-end Writer2 multi-source product flow;
- GitHub workflow/CI qualification for PR #1102.

## Changed paths
Production:
1. `tabs/cii-workspace/cii-workspace-multisource-anchor-ledger-ui.js` — new
2. `tabs/cii-workspace/cii-workspace-multisource-review-ui.js`
3. `tabs/cii-workspace/cii-workspace-multisource-writer2-ui.js`
4. `tabs/cii-workspace/cii-workspace-transfer-scope-ui.css`

Tests:
5. `tests/cii-workspace-multisource-anchor-ledger-ui.test.js` — new
6. `tests/cii-workspace-multisource-anchor-rationale-ui.test.js` — new

Handover:
7. `agents/PR1102_workreport.md`

## EXACT_NEXT_ACTION
Owner reviews PR #1102. If Owner explicitly authorizes merge, merge it. Then verify Pages loads the changed multi-source files and rerun the exact S1/S2/S3 -> T flow. Product acceptance targets:
1. `Source-set Anchor Authority` appears above per-source `INPUTS & MATCH BASIS`;
2. S1 `3870->870`, S2 `120->40070`, S3 `1890->21890` appear as USER LOCKED editable rows after Add reviewed anchor;
3. rationale table visibly shows Node Name + network basis and why one-axis evidence remains REVIEW;
4. clicking Accept all HIGH when there are zero HIGH rows does not demand Apply approvals or invalidate Transfer Preview.
