# EP-SUPPORT-REPORT-1154-0002 — WP-001 pre-work after current-main reconciliation

CHAIN_STATE_VERSION: 3
HANDOVER_PROTOCOL_VERSION: 2
CHAIN_ID: SUPPORT-REPORT-1154
ENDPOINT_ID: EP-SUPPORT-REPORT-1154-0002
PREVIOUS_ENDPOINT: EP-SUPPORT-REPORT-1154-0001
ENDPOINT_REASON: OWNER_PROCEED_NEXT_WP001_PREWORK
CUSTODY_EPOCH: 2

WORK_ITEM_SOURCE: GITHUB_ISSUE
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1154
WORK_ITEM_MODE: EXCLUSIVE
AGENT_INSTANCE_ID: chatgpt:787fb18a-1c45-43d0-b8ad-7f23d3ce2106

REPO: reallaksh19/XML_Compare_Utilities
BRANCH: agent/support-report-1154
BRANCH_HEAD_BEFORE_ENDPOINT: 16123fcb9dd540252c105289a6b6b418e3136b49
MAIN_HEAD_OBSERVED: 28bb79ccdcfc229bbff51c1bd8e59806f64760a5
MATERIAL_HISTORY_ROOT_BASE: 9fae87ed935d1dfe32d9302140ea414799d26fed
MATERIAL_LEG_PREWORK_ENDPOINT_FILE: agents/chains/SUPPORT-REPORT-1154/endpoints/EP-SUPPORT-REPORT-1154-0002.md

ISSUE_BASIS_ID: IB-SUPPORT-REPORT-1154-0001
ISSUE_BASIS_FILE: agents/chains/SUPPORT-REPORT-1154/issue-basis/IB-SUPPORT-REPORT-1154-0001.md
ISSUE_CURRENT_STATE_FILE: agents/chains/SUPPORT-REPORT-1154/issue-state/CURRENT.md
ISSUE_CHAIN_ROOT_COMMENT_ID: 5605124994
ISSUE_ACTIVE_HANDOVER_COMMENT_ID: 5605121164
PREVIOUS_ISSUE_ENDPOINT_COMMENT_ID: 5605129153
ISSUE_HANDOVER_SYNC_STATUS: STALE_UNTIL_EP0002_COMMENT_AND_ACTIVE_REFRESH

COMMON_PROTOCOL: engineering-pr-delivery-v2
COMMON_PROTOCOL_BASIS: af4c5c73b87b26187aa6c930b60172cbb1f0f3e2
COMMON_PROTOCOL_STATUS: CURRENT

ENGINEERING_STATE: READY
CUSTODY_STATE: HELD
QUALIFICATION_STATE: NOT_REQUIRED
WRITE_AUTHORITY: WRITE_ALLOWED
WRITE_AUTHORITY_SCOPE: WP-001 only — new sanitized XML fixture, frozen artifact_tool workbook oracle, independent integrity test; no Support Report production-file mutation
AUTO_STATE: NOT_APPLICABLE
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE

OWNER_PROGRESSION_COMMAND: PROCEED_NEXT
OWNER_INSTRUCTION: 2026-09-09T16:35:01Z `proceed next`
MATERIAL_PROGRESSION_AUTHORITY: WP001_DATA_ORACLE_ONLY

QUALIFICATION_PROTOCOL_VERSION: 3
QUALIFICATION_PROFILE: PARSER_TOPOLOGY
QUALIFICATION_PROFILE_VERSION: 2
QUALIFICATION_SCOPE_ID: QSCOPE-SUPPORT-REPORT-XML-GOLDEN-PARITY
QUESTION_SET_ID: SUPPORT-REPORT-1154-QS-0002
QUESTION_SET_STATUS: CURRENT
QUESTION_PACK_ACTION: REFRESHED
QUESTION_DISPLAY: SHOW
PREWORK_QUALIFICATION_READY: TRUE
TAKEOVER_QUALIFICATION_READY: TRUE

# Live-main reconciliation

Since EP-0001, main advanced through Owner-merged Support Report PRs:
- #1156 / `3826c35bbaf382967bc0af51058fe742cfebf629` — retained-sample 21-column projection changes;
- #1157 / `cf2033d45bad7f64976764ceed87b4c343fe1c5c` — field-projection split and revision projection;
- #1158 / `28bb79ccdcfc229bbff51c1bd8e59806f64760a5` — spreadsheet formula neutralization in CSV/TSV.

POST_BASIS_DRIFT: MATERIAL_BOUNDARY_CHANGED_DOWNSTREAM_WP005_WP007_WP009
WP001_QUALIFICATION_COVERAGE: RETAINED_AFTER_REFRESHED_QSET — the authorized leg touches only new independent fixture/oracle/test files and does not modify the changed production paths.
OWNER_INTENT_DRIFT: NONE
EXACT_WORK_ITEM_COLLISION: NONE_FOUND_IN_CANONICAL_CHAIN_SEARCH
COORDINATION_STATE: SAFE_DISJOINT_FOR_WP001; downstream production contract requires later reconciliation.

# Newly exposed authority conflict

The Owner-supplied `SL-097 and PS-007.xlsx` does not match the current main `SUPPORT_REPORT_COLUMNS` order established from `.preview-samples/wb3d-table7.txt`:
- Owner XLSX starts `SCOPE`; production starts `PREV PRIMARY SUPPORT NAME`.
- Owner XLSX keeps schedule + insulation thickness + insulation type as separate columns 5/6/7; production places schedule at 17 and combines insulation at 18.
- Owner XLSX column 8 header is blank and its cells hold PIPING PRIMARY SUPPORT; production column 8 is PIPING PRIMARY SUPPORT REFERENCE.
- Owner XLSX has no REVISION column; production has REVISION at 21.

This conflict is NOT resolved in WP-001. WP-001 freezes the Owner oracle so later output-contract work has a durable independent authority basis. `.preview-samples` remains repository evidence and cannot silently replace an explicit Owner acceptance artifact.

# WP-001 exact material boundary

Authorized new paths only:
- `tests/fixtures/support-report/support-report-ps007-sl097.sanitized.xml`
- `tests/fixtures/support-report/support-report-ps007-sl097.golden.json`
- `tests/support-report-fixture-integrity.test.mjs`

No existing product/test/oracle file is to be modified in this leg. Therefore the repository backup command is not applicable to these new-file writes; all existing product files remain untouched.

# Input / oracle basis

- Owner XML SHA256: `7738159bb96e2e38927a52fd6ebe625cf3f16eae0b7ad218652b799648736e62`.
- Sanitized XML candidate SHA256: `326c0eb9e4bf17b224d63c539600d74ad0f6ffb6a9f4afbcddf2ad3ae29c6348`; sanitization removes only root `exchange@filepath` metadata.
- Owner XLSX SHA256: `16eb75d84bf31e9fa92ef26c0e73bf2cd6c5e71e1fcd047ffa27bb9094c36d56`; source `ASIM!A1:U12`.
- Frozen artifact_tool oracle SHA256: `9097c07a6853173d39d36157eee6d4cac8eda8324e993b3bce6908e69c63be2e`.
- Oracle shape: 21 headers, 10 rows; PS-007=5; SL-097=5; total-support-points=5.
- Combined staged-model input remains UNRESOLVED; full production cell parity stays NOT_RUN.

# Validation plan

Independent integrity test must use Node built-ins only and import no Support Report production module. It must prove fixture/oracle hashes and structural cardinalities, remove no engineering XML content, and prove at least one expected native-only member exists in the Owner oracle but not the clash fixture.

Planned validation:
- `node --check tests/support-report-fixture-integrity.test.mjs`
- `node --test tests/support-report-fixture-integrity.test.mjs`
- branch diff confirms no `tabs/support-steel-relationship-builder/**` changes from this material leg.

Full product regression/browser/XLSX parity remains NOT_RUN in WP-001.

EXACT_NEXT_ACTION: commit the three authorized WP-001 files, run the focused independent integrity validation, record LEG-001 and freeze a successor endpoint. Do not modify production Support Report code in this progression.
