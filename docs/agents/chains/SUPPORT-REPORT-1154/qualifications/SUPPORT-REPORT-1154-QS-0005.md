# SUPPORT-REPORT-1154-QS-0005 — grouping/enrichment authority

QUALIFICATION_PROTOCOL_VERSION: 3
QUALIFICATION_PROFILE: GENERAL_ENGINEERING
QUALIFICATION_PROFILE_VERSION: 2
CHAIN_ID: SUPPORT-REPORT-1154
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1154
QUALIFICATION_SCOPE_ID: QSCOPE-SUPPORT-REPORT-GROUPING-ENRICHMENT
QUESTION_SET_ID: SUPPORT-REPORT-1154-QS-0005
QUESTION_SET_STATUS: CURRENT
QUESTION_PACK_ACTION: REFRESHED
QUESTION_DISPLAY: SHOW
BASIS_MAIN: b1595d8f81cf2a2e1fafd33b03b18c3be362c785
COMMON_PROTOCOL_BASIS: af4c5c73b87b26187aa6c930b60172cbb1f0f3e2
OWNER_QUALIFICATION_BASELINE_DISCOVERY: COMPLETE
OWNER_QUALIFICATION_BASELINE_SOURCE: NONE
OWNER_QUALIFICATION_BASELINE_STATUS: NOT_APPLICABLE

This set advances issue #1154 from parser intake into WP-004 canonical grouping and authoritative enrichment. INPUT-003 (the real combined staged-model JSON for the target PS-007/SL-097 case) remains unresolved; therefore mechanics may be qualified, but target-family native parity cannot be claimed from synthetic fixtures or the expected workbook.

## Q1 — Production trace
Trace one `{secondarySupportFamilyId, fullLineTag}` group from clash evidence into `support-report-engine.js`, through family lookup, native member selection, member→carrier authority, field projection and row evidence. Identify the exact owner for each transition and prove grouping/export/UI do not become native relationship authority.

Falsifier: family identity alone can include a native member whose explicit line/branch context contradicts the group, or report code builds a second Support/Steel relationship model.

## Q2 — Incomplete-clash recovery / failure isolation
For PS-007 10-inch, distinguish clash-visible `/PS-007.7` from the expected complete list `/PS-007.6, /PS-007.4, /PS-007.7`. Prove the engine can recover omitted members only when native line/branch evidence supplies them; prove context conflicts remain excluded and visible in evidence. Treat the current synthetic PS-007 fixture as a mechanics test only, not authoritative target data.

Falsifier: native-only members are inferred from the family name or copied from the Owner expected workbook rather than produced by staged-model evidence.

## Q3 — Carrier and field authority invariant
Prove selected native members' resolved physical carrier IDs outrank same-line/branch catalog heuristics; missing resolved carriers fail closed; contradictory explicit carrier lines cannot leak; equally authoritative conflicting carrier values blank the conflicted field and emit evidence. Define a field provenance/source-class model without introducing numeric pseudo-confidence or a second field-resolution implementation.

Falsifier: catalog order selects engineering values, a missing resolved carrier falls back silently, or a provenance label claims authoritative/native source without corresponding evidence.

## Q4 — Independent validation
Use current source plus production-independent input discovery to separate: (a) invariants proven by current-main tests/source, (b) new field-provenance behavior that can be unit-tested without target staged data, and (c) target PS-007/SL-097 parity that remains BLOCKED_INPUT003. Confirm conversation custody contains only SupportreportXML.xml and SL-097 and PS-007.xlsx and search the repository for a real target staged-model fixture before accepting the blocker.

Falsifier: WP-004 is marked complete solely from synthetic report tests or expected-output data.

## Q5 — Minimal patch / delivery boundary
Keep PR #1165 WP-001-only. If a material WP-004 gap exists, use a separate branch from current main and patch only that gap. The currently identified minimal gap is field-level provenance/source-class evidence in canonical JSON. Do not mutate the Owner golden oracle, fabricate staged-model members/attributes, change spreadsheet column authority, or broaden Support/Steel defaults.

Exit for this progression: either (1) a bounded provenance patch with focused tests and material receipt, while WP-004 target parity remains BLOCKED_INPUT003, or (2) NO_PATCH if source review proves equivalent provenance already exists.
