# EP-SUPPORT-REPORT-1154-0006 — WP-004 pre-work boundary

CHAIN_STATE_VERSION: 3
HANDOVER_PROTOCOL_VERSION: 2
CHAIN_ID: SUPPORT-REPORT-1154
ENDPOINT_ID: EP-SUPPORT-REPORT-1154-0006
PREVIOUS_ENDPOINT: EP-SUPPORT-REPORT-1154-0005
ENDPOINT_REASON: WP004_PREWORK_WRITE_AHEAD
CUSTODY_EPOCH: 6

WORK_ITEM_SOURCE: GITHUB_ISSUE
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1154
WORK_ITEM_MODE: EXCLUSIVE
AGENT_INSTANCE_ID: chatgpt:787fb18a-1c45-43d0-b8ad-7f23d3ce2106

REPO: reallaksh19/XML_Compare_Utilities
CHAIN_BRANCH: agent/support-report-1154
MATERIAL_BRANCH_PLANNED: agent/support-report-1154-wp004
MAIN_HEAD_OBSERVED: b1595d8f81cf2a2e1fafd33b03b18c3be362c785
PR1165_STATE: OPEN_DRAFT
PR1165_MERGEABLE: TRUE
PR1165_BOUNDARY: WP001_ONLY_DO_NOT_BROADEN

MATERIAL_HISTORY_ROOT_BASE: 9fae87ed935d1dfe32d9302140ea414799d26fed
LATEST_MATERIAL_LEG: LEG-001
LATEST_MATERIAL_LEG_FILE: agents/chains/SUPPORT-REPORT-1154/material-legs/LEG-001.md
WP004_PREWORK_ENDPOINT: TRUE
WP004_MATERIAL_LEG: PENDING

COMMON_PROTOCOL: engineering-pr-delivery-v2
COMMON_PROTOCOL_BASIS: af4c5c73b87b26187aa6c930b60172cbb1f0f3e2
COMMON_PROTOCOL_STATUS: CURRENT

ENGINEERING_STATE: IN_PROGRESS
CUSTODY_STATE: HELD
QUALIFICATION_STATE: NOT_REQUIRED
WRITE_AUTHORITY: WRITE_ALLOWED
WRITE_AUTHORITY_SCOPE: WP-004 minimal field-provenance/source-class material patch plus focused tests on a separate current-main branch; no Owner-oracle mutation and no staged-model fabrication
AUTO_STATE: NOT_APPLICABLE
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE

OWNER_PROGRESSION_COMMAND: PROCEED_NEXT
OWNER_INSTRUCTION: 2026-09-10T00:00:52Z `proceed next`
MATERIAL_PROGRESSION_AUTHORITY: ACTIVE_FOR_WP004_BOUNDED_PATCH

QUALIFICATION_SCOPE_ID: QSCOPE-SUPPORT-REPORT-GROUPING-ENRICHMENT
QUESTION_SET_ID: SUPPORT-REPORT-1154-QS-0005
QUESTION_SET_STATUS: CURRENT
QUESTION_PACK_ACTION: REFRESHED
QUESTION_DISPLAY: SHOW
TAKEOVER_QUALIFICATION_READY: TRUE
CHAIN_HANDOVER_READY: TRUE

# Input truth

- INPUT-001 Owner SupportreportXML.xml: durable sanitized fixture exists.
- INPUT-002 Owner SL-097 and PS-007.xlsx: durable independent oracle exists.
- INPUT-003 authoritative combined staged-model JSON for exact target enrichment: UNRESOLVED.
- Conversation file inventory at this progression contains only SupportreportXML.xml and SL-097 and PS-007.xlsx.
- Repository search finds target PS-007 recovery values in synthetic `tests/support-report-builder.test.js`; no `SL-097.11` repository source/fixture was found. Synthetic expected-like values are not authoritative staged-model evidence.

# Current-main WP-004 mechanics already present

At `b1595d8f...`:
- canonical grouping grain remains secondary family + full line;
- native member selection prefers exact line, then non-conflicting branch, then non-conflicting direct clash identity;
- family-only inclusion is insufficient;
- selected native members can contribute native-only omitted members;
- selected member resolved physical carrier IDs outrank line/branch carrier fallback;
- explicit conflicting carrier lines cannot leak through branch fallback;
- missing resolved carriers fail closed;
- equally authoritative carrier field conflicts blank the conflicted field and emit conflict evidence.

# Material gap authorized in this leg

Canonical row evidence has relationship-level provenance (`selectedNativeMemberIds`, `nativeOnlyMemberIds`, carrier IDs, coordinate fallback flags) but lacks a per-output-field source-class map. WP-004 requires per-field provenance/source class. The bounded patch may add deterministic qualitative field provenance to canonical JSON without changing output values or spreadsheet contract.

Allowed source classes must describe evidence, not confidence probabilities. Expected classes include authoritative native member attributes, authoritative carrier attributes, clash relationship evidence, explicit clash coordinate fallback, deterministic line-tag/path derivation, conflict, and unresolved.

# Validation boundary

Required before LEG-002:
- syntax for each changed/new JS file;
- focused unit tests proving provenance for native members, authoritative carriers, deterministic size derivation, native vs clash coordinates, conflicts and unresolved fields;
- no CSV/XLSX visible value change;
- no production module >=300 physical lines;
- no use of Owner workbook values as staged-model source.

Exact PS-007/SL-097 real staged-model parity remains BLOCKED_INPUT003 and cannot be converted to PASS by this patch.

EXACT_NEXT_ACTION: create `agent/support-report-1154-wp004` from main@b1595d8f..., implement the minimal field-provenance patch and focused tests, validate exact material bytes, record LEG-002 and successor endpoint. If the material branch cannot be isolated cleanly, stop rather than broadening PR #1165.
