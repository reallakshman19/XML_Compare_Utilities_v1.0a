# PR1076 Workreport — CII Find & Replace Excel-style Manual Grid

## Owner requirements

1. Section `3. Manual table entry` shall be an editable Microsoft Excel-style table rather than a detached form-style row editor.
2. Section `5. Validate, Apply to New Copy, and Download` shall not render as a compressed action/status block; the transactional order and current qualification state must be visually explicit.

## Delivery container

- PR: `#1076`
- Branch: `feature/cii-find-replace-excel-manual-grid-v14`
- Base: `main@274b47ef7a787a9f82cfe585371dc9b19d7983b1`
- Material product/test head after Section 5 correction: `9b3f867388dab7c48072704cc8dc8655c2733bcd`
- Merge authority: Owner-only; not granted in the latest fix message.

## Product delta

Changed:

- `tabs/cii-workspace/cii-workspace-find-replace.js`
- `tabs/cii-workspace/cii-workspace-find-replace-ui.js`
- `tabs/cii-workspace/cii-workspace-find-replace-session.js`
- `tabs/cii-workspace/cii-workspace-find-replace.css`
- `tests/cii-workspace-find-replace-session.test.js`
- `tests/cii-workspace-find-replace-ui-registration.test.js`
- `tests/cii-workspace-find-replace-manual-grid.test.js`

### Section 3 — editable spreadsheet

1. Manual entry is rendered as an editable spreadsheet grid with row numbers.
2. Three blank rows are available initially; rows can be added/deleted/cleared.
3. Tab navigation remains native; Enter moves to the same column on the next row.
4. Rectangular tab/newline clipboard ranges copied from Microsoft Excel/Google Sheets can be pasted into the grid.
5. Visible editable columns follow the active scope:
   - DOCUMENT: Find Text, Replace Text, Expected Matches
   - ELEMENT: From, To, Find Text, Replace Text, Expected Matches
   - BLOCK: From, To, Block, Find Text, Replace Text, Expected Matches
6. `Update Preview` replaces current manual preview rows deterministically instead of appending duplicates.
7. Existing CSV preview rows are preserved when the manual grid is refreshed.
8. Any unsynchronized spreadsheet edit creates a dirty-grid gate: review decisions, validation, Apply-to-new-copy, audit export and download are disabled until `Update Preview` is run.
9. If an already qualified/applied session is edited, the qualification/release is invalidated immediately.
10. Spreadsheet refresh preserves a non-v14 target blocker; manual editing cannot promote a legacy target into a ready state.
11. NODE NAME and DISPLACEMENT remain selectable; FORCE remains visible but qualification-pending/fail-closed.

### Section 5 — explicit finalization workflow

1. Replaced the compressed action row with three numbered workflow rows:
   - `1 Validate TARGET1` → `Validate & Preview`
   - `2 Apply to New Copy` → release qualified TARGET1 only
   - `3 Download` → `Download Modified CII`
2. `Export Audit JSON` is separated as a secondary control rather than appearing inline with the three transactional actions.
3. Added an explicit `Workflow status` panel before the hash/claim/qualification KPIs.
4. Kept Source hash, Claims, Target hash and Qualification as four separately bordered KPI cells.
5. Added explanatory copy under `Qualified TARGET1 preview` stating that it is available only after successful validation.
6. Corrected the misleading terminal fallback status. A reviewed state with zero approved rows now says:
   `No approved replacement rows. Approve at least one row before validation.`
   It no longer reports `Preview ready.` while Claims=0 and Qualification=Pending.
7. Transaction semantics are unchanged: Validate → Apply-to-new-copy → Download.

## Unchanged authority

No changes to:

- CII v14 target qualification requirements;
- NODENAME or DISPLACEMENT physical ownership;
- FORCE/FORCMNT mutation authority;
- validator/executor claim semantics;
- Apply-to-new-copy/output custody;
- TARGET0 overwrite prohibition;
- Writer1/Writer2;
- parsers/converters;
- benchmarks/oracles;
- workflows.

## Source review findings

Source/diff review: **PASS** for bounded intent after fail-closed corrections:

1. stale-preview prevention — unsynced edits block all downstream review/release actions;
2. legacy target preservation — `replaceFindReplaceManualRows()` retains `TARGET_VERSION_BLOCKED` and `TARGET_V14_REQUIRED:*`;
3. Section 5 state clarity — zero-approved rows can no longer be described as preview-ready;
4. finalization controls remain in required Validate → Apply → Download order.

Focused tests cover:

- rectangular Excel clipboard parsing;
- mode-specific spreadsheet column order;
- block alias normalization;
- blank-row detection;
- deterministic MANUAL-row replacement with CSV preservation;
- non-v14 blocker preservation;
- dirty-grid UI gating;
- explicit Section 5 ordered-step markup and status copy;
- existing Apply-to-new-copy and FORCE-blocked boundaries.

## Validation truth

- source/diff review: **PASS / inspection**;
- focused tests: **AUTHORED, NOT_RUN**;
- exact-checkout execution: **NOT_RUN / current connector-only substrate**;
- GitHub CI/check status: no PASS claimed unless attached to final head;
- full repository suite: **NOT_RUN**;
- retained-real/native-v14/external CAESAR gates: unchanged from prior chain state.

## Coordination

Draft PR #1075 is evidence-only and touches only `agents/**`; it does not overlap the product/test paths above. The Owner's Section 3 and Section 5 UI requirements are the active product priority in PR #1076.
