# EP-SUPPORT-REPORT-1154-0007 — WP-004 mechanics complete; target parity blocked by INPUT-003

CHAIN_STATE_VERSION: 3
HANDOVER_PROTOCOL_VERSION: 2
CHAIN_ID: SUPPORT-REPORT-1154
ENDPOINT_ID: EP-SUPPORT-REPORT-1154-0007
PREVIOUS_ENDPOINT: EP-SUPPORT-REPORT-1154-0006
ENDPOINT_REASON: WP004_PROVENANCE_MATERIAL_COMPLETE_TARGET_PARITY_BLOCKED_INPUT003
CUSTODY_EPOCH: 7

WORK_ITEM_SOURCE: GITHUB_ISSUE
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1154
WORK_ITEM_MODE: EXCLUSIVE
AGENT_INSTANCE_ID: chatgpt:787fb18a-1c45-43d0-b8ad-7f23d3ce2106

REPO: reallaksh19/XML_Compare_Utilities
CHAIN_BRANCH: agent/support-report-1154
MATERIAL_BRANCH: agent/support-report-1154-wp004
MATERIAL_BASE: b1595d8f81cf2a2e1fafd33b03b18c3be362c785
MATERIAL_HEAD: 07efddd1365c7134e26dec21821e05a4446ede26
CURRENT_MAIN_OBSERVED: d09849d2596c14c19cf2a03b5d92d349280e6e58
PR_WP001: 1165
PR_WP004: 1173
PR1173_STATE: OPEN_DRAFT
PR1173_MERGEABLE: TRUE
PR1173_CHANGED_FILES: 8

LATEST_MATERIAL_LEG: LEG-002
LATEST_MATERIAL_LEG_FILE: agents/chains/SUPPORT-REPORT-1154/material-legs/LEG-002.md
PREWORK_ENDPOINT: EP-SUPPORT-REPORT-1154-0006

COMMON_PROTOCOL: engineering-pr-delivery-v2
COMMON_PROTOCOL_BASIS: af4c5c73b87b26187aa6c930b60172cbb1f0f3e2
COMMON_PROTOCOL_STATUS: CURRENT

ENGINEERING_STATE: BLOCKED_INPUT
CUSTODY_STATE: HELD
QUALIFICATION_STATE: NOT_REQUIRED
WRITE_AUTHORITY: READ_ONLY
WRITE_AUTHORITY_SCOPE: WP-004 material leg receipted; no later-package mutation while exact target native enrichment remains blocked by missing authoritative INPUT-003 unless Owner supplies a new progression basis
AUTO_STATE: NOT_APPLICABLE
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE

OWNER_PROGRESSION_COMMAND: PROCEED_NEXT
OWNER_INSTRUCTION: 2026-09-10T00:00:52Z `proceed next`
MATERIAL_PROGRESSION_AUTHORITY: CONSUMED_BY_LEG002

QUALIFICATION_SCOPE_ID: QSCOPE-SUPPORT-REPORT-GROUPING-ENRICHMENT
QUESTION_SET_ID: SUPPORT-REPORT-1154-QS-0005
QUESTION_SET_STATUS: CURRENT
QUESTION_PACK_ACTION: REFRESHED
QUESTION_DISPLAY: SHOW
TAKEOVER_QUALIFICATION_READY: TRUE
CHAIN_HANDOVER_READY: TRUE

# WP-004 achieved in this progression

Current-main grouping/member/carrier authority was reconciled and retained:
- group identity is `{secondarySupportFamilyId, fullLineTag}`;
- native member selection requires exact line, admissible branch, or non-conflicting direct clash identity; family root alone cannot include a contradictory member;
- resolved selected-member carrier IDs outrank line/branch carrier heuristics;
- missing resolved carriers fail closed;
- explicit carrier line contradictions cannot leak via branch fallback;
- conflicting authoritative carrier values blank only the affected field and remain diagnostic/evidenced.

LEG-002 adds the roadmap-required per-field source record under canonical `row.evidence.fieldProvenance` without changing displayed fields or CSV/XLSX serialization.

Qualitative source classes cover authoritative native member/member position/member path/carrier evidence, conflicts, clash relationship/group/path evidence, explicit fallbacks, deterministic derivations and unresolved values. Native coordinate source identity is narrowed to the exact representative member whose position won.

# Validation

PASS:
- every changed/new JS/MJS parses with `node --check` on byte-identical branch content;
- field projection + provenance tests: 12/12;
- build-gate/routing tests: 5/5;
- canonical-row engine provenance integration: 1/1;
- projection = 275 lines; engine = 278 lines;
- PR branch diff = exactly eight intended files.

NOT_RUN:
- complete repository test suite;
- browser workflow smoke;
- exact Owner 10-row cell parity;
- real staged-model enrichment parity.

# Blocking input

INPUT-003 remains unresolved: authoritative combined staged-model JSON for the exact PS-007/SL-097 Owner case.

Conversation file custody contains the Owner clash XML and expected XLSX only. The clash XML cannot provide all native members or engineering fields. Repository synthetic tests are mechanics evidence only and cannot become production input authority.

Therefore the following exact target claims remain unproven:
- PS-007 10-inch complete native membership `/PS-007.6, /PS-007.4, /PS-007.7`;
- SL-097 10-inch `/SL-097.11, /SL-097.8, /SL-097.12, /SL-097.13`;
- SL-097 2-inch `/SL-097.4, /SL-097.7`;
- exact authoritative carrier/native attributes required for workbook parity.

WP004_STATUS: MECHANICS_AND_PROVENANCE_COMPLETE_TARGET_PARITY_BLOCKED_INPUT003

# Downstream authority boundary

Do not advance WP-005/WP-006 as if native parity were proven. The Owner XLSX/current-production column-contract conflict also remains open and independent of this missing staged-model source.

PR #1165 remains WP-001-only. PR #1173 owns this WP-004 material leg. Neither is merge-authorized by this endpoint.

EXACT_NEXT_ACTION: obtain or identify the authoritative combined staged-model JSON/source used by Support/Steel for the Owner target, then run the real clash XML + native relationship bundle through Support Report and compare the 10 rows against the frozen Owner oracle. If the Owner instead issues another progression command without supplying INPUT-003, re-ground first and do not fabricate or infer the missing native records from the expected workbook.
