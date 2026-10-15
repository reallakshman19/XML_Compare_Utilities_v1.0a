# Endpoint EP-CSVRC-0015 — browser XLSX ingress hotfix ready for acceptance

CHAIN_ID: CSV-REV-COMPARE-1181
PREDECESSOR: EP-CSVRC-0014
CUSTODY_EPOCH: 15
LATEST_MATERIAL_LEG: LEG-011
MATERIAL_HEAD: 84a9073ac09bcb27724dca7a78d0e6f46c29c453
MAIN_OBSERVED: 136abb2f7bc371e1a622f5d69e7c326e42bdf3b6
PR: 1191
BRANCH: issue-1181-xlsx-ui-ingress-hotfix
PR_STATE: OPEN_DRAFT
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE

COMMON_PROTOCOL: engineering-pr-delivery-v2
COMMON_PROTOCOL_BASIS: af4c5c73b87b26187aa6c930b60172cbb1f0f3e2
COMMON_PROTOCOL_STATUS: CURRENT
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1181
WORK_ITEM_MODE: EXCLUSIVE
ISSUE_BASIS_ID: IB-CSV-REV-COMPARE-1181-0001
QUALIFICATION_SCOPE_ID: QSCOPE-XMLCOMPARE-1181-CSV-XML-LINEAGE
QUESTION_SET_ID: QS-CSVRC-1181-0001
QUESTION_SET_STATUS: CURRENT
QUESTION_PACK_ACTION: REUSED

## Owner progression authority

At 2026-09-11T08:22:00Z, the Owner issued `proceed next` after direct browser use of `R2.xlsx` and `R3.xlsx` showed raw OOXML ZIP content (`PK... [Content_Types].xml`) in both revision text areas and blocked schema validation. The bounded progression is XLSX UI ingress repair plus checkpoint only; no merge is authorized.

## Root cause and correction

The existing UI read every selected file using `File.text()`. That is correct for CSV/TSV/TXT but invalid for XLSX, which is a ZIP-based OOXML package.

Material head `84a9073ac09bcb27724dca7a78d0e6f46c29c453` repairs only this ingress boundary:

1. `.xlsx` is accepted by the file picker.
2. XLSX uses `File.arrayBuffer()` and SheetJS workbook parsing.
3. The Support Report worksheet is detected by the same qualification signature: exact `PIPE` plus Civil Secondary Support semantics within the first 40 worksheet rows.
4. Formula cells are preserved as leading-`=` formula text.
5. The worksheet table is serialized to ordinary CSV text and passed to the existing governed Table-to-Categorized-XML parser.
6. CSV/TSV/TXT and paste behavior remain unchanged.
7. A missing Support Report header fails explicitly at ingress instead of reaching schema validation as ZIP bytes.

No XML lineage, candidate scoring, common-support topology, typed events, remarks, four-bucket benchmark policy, or export authority changed.

## Qualification

HOTFIX_QUALIFICATION_RECEIPT: agents/qualifications/CSV-REV-COMPARE-1181/QR-CSVRC-1181-0002.md
HOTFIX_QUALIFICATION_STATE: PASS_FOCUSED_LOCAL
MANUAL_BROWSER_ACCEPTANCE: PENDING

Focused executable result: 7 tests passed / 0 failed, plus syntax checks for the UI module and XLSX ingress module.

Prior engine receipt `QR-CSVRC-1181-0001` remains authoritative for the real R2->R3 four-bucket comparison:

- Phase 1 `PS No. change`: PASS.
- Phase 2 `Support location change`: PASS.
- Phase 3 `Load change`: PASS.
- Phase 4 `Total no of support change`: PASS with one explicit unsupported oracle row lacking an R2 composite predecessor.

## Current state

ENGINEERING_STATE: HOTFIX_IMPLEMENTED
CUSTODY_STATE: HELD
QUALIFICATION_STATE: PASS_FOCUSED_LOCAL_BROWSER_ACCEPTANCE_PENDING
WRITE_AUTHORITY: READ_ONLY
AUTO_STATE: NOT_APPLICABLE
CHAIN_HANDOVER_READY: TRUE
TAKEOVER_QUALIFICATION_READY: TRUE
HANDOVER_CONTENT_READY: TRUE
HANDOVER_VALIDATION_STATUS: PASS

`main` advanced independently through PR #1190 during this progression. The hotfix was replayed onto exact current main `136abb2f7bc371e1a622f5d69e7c326e42bdf3b6`; material comparison is one commit ahead and zero behind.

## Exact next action

Run the Owner's direct browser acceptance using actual `R2.xlsx` + `R3.xlsx` against the hotfix deployment/preview. Expected result: extracted Support Report table text replaces `PK...` bytes, schema validation proceeds, and the existing XML comparison pipeline runs normally. After that evidence, Owner may explicitly authorize merge of PR #1191.
