# EP-SUPPORT-REPORT-1154-0013 — WP-008 pre-work / post-merge basis

CHAIN_ID: SUPPORT-REPORT-1154
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1154
ENDPOINT_KIND: PREWORK
ENGINEERING_STATE: READY
CUSTODY_STATE: HELD
WRITE_AUTHORITY: WRITE_ALLOWED
WRITE_AUTHORITY_SCOPE: WP-008 UI/export-state integration only
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED_FOR_PRIOR_STACK: TRUE_CONSUMED
OWNER_INSTRUCTION: 2026-09-10T04:26:46Z `merge if mergable, proceed next`
QUESTION_DISPLAY: HIDE_BY_OWNER_STANDING_INSTRUCTION

## Merged dependency stack

The Owner explicitly authorized merge when mergeable. The stack was integrated in dependency order with expected-head-SHA guards:

- PR #1165 -> main merge `0f9b8a57950c478b389b9f9fd5935b5515d8e5fa`
- PR #1173 -> main merge `677fa4147a98cbec36000ad675fc562304b54ea9`
- PR #1174 -> retargeted to main, merge `70cc37f7f7d1b763ec3323d1543396999dbcb480`
- PR #1175 -> retargeted to main, merge `392ed9c8271e636629ef8a4bd6c4f9f0e9ffb338`
- PR #1176 -> retargeted to main, merge `fd25a7eeb3512a13fda73d4e9d7c67ac6e333fd5`

MAIN_BASIS: fd25a7eeb3512a13fda73d4e9d7c67ac6e333fd5

## WP-008 bounded problem

Current Support Report UI allows XML-only/partially enriched reports and enables exports, but the run state says only `Support Report ready` and exported files use neutral names. That can mislabel clash-evidence-only or partially enriched artifacts as complete even though native member/attribute enrichment remains unresolved.

WP-008 may change presentation/export-state semantics only:

- keep XML-only/partial export allowed for evidence review;
- mark UI completeness state explicitly when `summary.xmlOnlyRowCount > 0`;
- label exported XLSX/CSV filenames as partial when XML-only rows remain;
- preserve complete-report filenames when no XML-only rows remain;
- preserve current input invalidation and blocking behavior;
- add focused static/runtime tests and wire them into the active Support Report test graph.

Forbidden in this leg:

- parser/grouping/member/carrier/source-authority changes;
- engineering field/value changes;
- Owner oracle changes;
- fabrication of INPUT-003 staged-model data;
- BM-004 parity PASS claim.

INPUT-003 remains unresolved. BM-004 remains BLOCKED_INPUT003.

## Exit gate

- partial enrichment is never labeled as fully ready/complete;
- detached downloaded filenames preserve partial status;
- complete reports retain existing neutral filenames;
- invalidated/blocked reports cannot export;
- focused UI/export-state tests PASS;
- no production file exceeds repository line limits;
- material receipt and successor endpoint freeze exact validation truth.
