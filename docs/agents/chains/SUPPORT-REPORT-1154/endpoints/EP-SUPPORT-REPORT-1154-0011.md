CHAIN_STATE_VERSION: 3
CHAIN_ID: SUPPORT-REPORT-1154
ENDPOINT_ID: EP-SUPPORT-REPORT-1154-0011
ENDPOINT_CLASS: PREWORK
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1154
WORK_PACKAGE: WP-007
OWNER_INSTRUCTION: 2026-09-10T03:51:22Z `proceed next, no Qs further`
OWNER_PROGRESSION_COMMAND: PROCEED_NEXT_NO_QS
QUESTION_DISPLAY: HIDE
CUSTODY_STATE: HELD
WRITE_AUTHORITY_AFTER_ENDPOINT: WRITE_ALLOWED_WP007_ONLY
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
MAIN_BASIS: d09849d2596c14c19cf2a03b5d92d349280e6e58
STACK_BASE_BRANCH: agent/support-report-1154-wp006
STACK_BASE_HEAD: af776a5e1b636070b034e506018c06882a9becf8
PR_BASE_CHAIN: #1175 stacked on #1174 on #1173
INPUT003_STATUS: UNRESOLVED_BLOCKER_FOR_BM004
WP007_SCOPE: independent XLSX serialization/read-back fidelity only; no engineering-value, grouping, membership, carrier-resolution, parser, or Owner-oracle mutation
PREWORK_FACTS:
- support-report-xlsx.js already emits the Owner 21-column field order, ordinal row, exact Owner header row, and row-2 autofilter.
- existing tests use a fake XLSX writer for byte-path assertions; BM-006 full reader round-trip is not yet independently proven.
- no npm xlsx dependency was identified on the current branch; production intentionally loads SheetJS xlsx@0.18.5 from esm.sh.
- existing repository code also consumes xlsx@0.18.5 for spreadsheet ingestion, so WP-007 must not introduce a second spreadsheet authority or unrelated dependency.
EXIT_TARGET:
- produce real XLSX bytes through supportReportToXlsxBytes using SheetJS 0.18.5;
- read those bytes independently and verify ordinal/header/data layout, formula-injection safety, sheet identity and autofilter where the reader exposes it;
- if production bytes fail, patch only the concrete writer defect;
- otherwise prefer validation/evidence-only NO_RUNTIME_CHANGE.
BLOCKER_BOUNDARY: BM-004 target 10x21 value parity remains blocked by authoritative staged-model INPUT-003 and must not be inferred from the expected XLSX.
