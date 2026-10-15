# EP-CII-FR-0012 — Excel-style Manual Grid

CHAIN_ID: CII-FIND-REPLACE-V14
ENDPOINT_ID: EP-CII-FR-0012
PR: 1076
BRANCH: feature/cii-find-replace-excel-manual-grid-v14
BASE: 274b47ef7a787a9f82cfe585371dc9b19d7983b1
CHECKPOINT_HEAD: c325acd635f5bcd03df01a43400bea00c0cd50f7
STATE: ACTIVE_DRAFT
CUSTODY_STATE: HELD
WRITE_AUTHORITY: EXISTING_FIND_REPLACE_UI_AND_MANUAL_SESSION_SCOPE_ONLY
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE

## Owner requirement

Manual table entry shall be an editable Microsoft Excel-style table.

## Implemented bounded progression

- replaced the detached six-field form with a spreadsheet grid;
- direct cell editing with row numbers;
- initial blank rows plus add/delete/clear row controls;
- Excel/Sheets rectangular clipboard paste using tab/newline boundaries;
- Enter advances vertically and Tab remains native;
- scope-dependent visible spreadsheet columns;
- `Update Preview` synchronizes the grid by replacing MANUAL preview rows;
- CSV preview rows remain preserved;
- added focused session/static/manual-grid tests.

## Protected invariants

- TARGET0 remains immutable.
- Apply remains Apply-to-new-copy only.
- Writer1/Writer2 remain uninvoked.
- NODE NAME/DISPLACEMENT authority is unchanged.
- FORCE/FORCMNT remains blocked and exposes no new mutable span.
- no benchmark/oracle/workflow/parser/converter change.

## Validation truth

- source implementation: COMPLETE
- changed-path containment: pending final compare
- authored focused tests: PRESENT
- exact-checkout focused execution: NOT_RUN / current substrate
- full suite: NOT_RUN
- retained-real/native-v14/external CAESAR gates: unchanged

## Exact next action

Reconcile PR #1076 head against `main`, verify changed-file containment and GitHub mergeability, and execute the focused tests if an exact executable checkout becomes available. Do not merge without Owner authorization.
