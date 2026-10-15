# EP-SUPPORT-REPORT-1154-0008 — Owner spreadsheet contract aligned

CHAIN_ID: SUPPORT-REPORT-1154
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1154
PREVIOUS_ENDPOINT: EP-SUPPORT-REPORT-1154-0007
LATEST_MATERIAL_LEG: LEG-003
COMMON_PROTOCOL: engineering-pr-delivery-v2
COMMON_PROTOCOL_BASIS: af4c5c73b87b26187aa6c930b60172cbb1f0f3e2
COMMON_PROTOCOL_STATUS: CURRENT
OWNER_PROGRESSION_COMMAND: PROCEED_NEXT_NO_QS
QUESTION_PACK_ACTION: SUPPRESSED_BY_OWNER
QUESTION_DISPLAY: HIDE
QUALIFICATION_SCOPE_ID: QSCOPE-SUPPORT-REPORT-SPREADSHEET-CONTRACT
QUESTION_SET_ID: SUPPORT-REPORT-1154-QS-0005
QUESTION_SET_STATUS: STALE
TAKEOVER_QUALIFICATION_READY: FALSE
CHAIN_HANDOVER_READY: TRUE
HANDOVER_READY: FALSE

MAIN_OBSERVED: d09849d2596c14c19cf2a03b5d92d349280e6e58
WP001_PR: 1165
WP004_PR: 1173
WP005_PR: 1174
WP005_BRANCH: agent/support-report-1154-wp005
WP005_HEAD: 21344457ce6a2372e6dc110b3097e66eff1fc61f
WP005_STACK_BASE: agent/support-report-1154-wp004@07efddd1365c7134e26dec21821e05a4446ede26
PR1174_STATE: OPEN_DRAFT
PR1174_MERGEABILITY: TRUE
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE

## Accepted result

WP-005 resolves the spreadsheet-contract authority conflict in favor of the frozen Owner workbook. The Support Report exported 21-column A:U order now matches the Owner contract, including:

- SCOPE first;
- schedule / insulation thickness / insulation type at columns 5 / 6 / 7;
- PIPING PRIMARY SUPPORT at column 8 with the Owner workbook's blank header cell;
- stress system / node at columns 14 / 15;
- total support points at 16;
- previous name at 17;
- description / zone / site / remarks at 18–21;
- no REVISION column;
- XLSX ordinal row 1..21 preceding the real header row.

The retained `.preview-samples/wb3d-table7.txt` layout is no longer Support Report spreadsheet authority.

## Validation accepted

- focused contract/export/XLSX syntax checks: PASS;
- independent Owner-column oracle: PASS;
- exact 21 key order: PASS;
- exact Owner XLSX header cells: PASS;
- blank H2 / primary-support column-8 semantics: PASS;
- revision excluded: PASS;
- autofilter begins at A2 when ordinal row is present: PASS;
- WP-005 stack diff: 11 intended contract/export/cache/test files only.

Full repository tests, browser smoke, real workbook byte round-trip, and exact 10-row value parity remain NOT_RUN.

## Remaining blocker

INPUT-003 remains unresolved: authoritative combined staged-model JSON/source for the Owner PS-007 / SL-097 case.

Therefore WP-006 exact cell-level golden parity remains BLOCKED_INPUT003. Expected workbook rows may not be reused as native model input.

## Exact next action

Obtain or identify INPUT-003. Then build the real Support/Steel relationship bundle, run the frozen Owner clash XML through Support Report, and produce a 10-row × 21-column expected-vs-actual ledger with provenance for every mismatch. Do not claim full parity before that source exists.
