# SUPPORT-REPORT-1154-QS-0006

QUALIFICATION_PROFILE_VERSION: 2
QUALIFICATION_SCOPE_ID: QSCOPE-SUPPORT-REPORT-GOLDEN-PARITY-LEDGER
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1154
ISSUE_BASIS_ID: IB-SUPPORT-REPORT-1154-0001
STATUS: CURRENT
OWNER_QUALIFICATION_BASELINE: NOT_APPLICABLE

## Q1 — Production trace
Trace one target report row from Navisworks clash evidence through family+line grouping, native member/carrier enrichment, field projection/provenance, Owner A:U serialization, and parity-ledger comparison. Identify the exact object that owns each actual value and prove the comparator cannot become engineering authority.

## Q2 — Current unresolved problem / failure isolation
Reconstruct the target cases where XML evidence is incomplete (PS-007 10-inch, SL-097 10-inch, SL-097 2-inch). Show which expected member IDs are absent from clash XML, which fields therefore require INPUT-003, and how the ledger distinguishes a true value mismatch from `UNRESOLVED_INPUT` caused by missing authoritative staged-model evidence.

## Q3 — Authority / invariant
Owner XLSX is expected-output authority; native Support/Steel evidence is actual engineering-source authority; clash XML is relationship/fallback evidence only. Prove that expected workbook values are never injected into the report bundle, row matcher, provenance, or source-resolution path. A missing actual value with no authoritative source must remain unresolved rather than PASS.

## Q4 — Independent validation
Given 10 expected rows × 21 Owner columns, derive the 210-cell comparison domain and require deterministic row keys, one ledger entry per cell, explicit expected/actual/provenance, and summary counts satisfying PASS+FAIL+UNRESOLVED_INPUT=210 when all ten rows are present. Include negative controls for duplicate/missing expected row keys, extra actual rows, and mismatched family/pipe identity.

## Q5 — Next contribution / minimal patch
The safe patch is a pure parity-ledger module plus focused tests. It may consume canonical report rows and an independently frozen oracle, but must not change parser/grouping/enrichment/projection/export values. NO-PATCH boundary: do not hard-code PS-007/SL-097 expected members or field values into production, do not alter the Owner oracle, and do not claim BM-004 PASS until INPUT-003 produces authoritative actual rows.
