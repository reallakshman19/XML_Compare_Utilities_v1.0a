ISSUE_CURRENT_STATE_VERSION: 3
CHAIN_ID: CSV-REV-COMPARE-1181
ISSUE_BASIS_ID: IB-CSV-REV-COMPARE-1181-0001
ISSUE_CURRENT_STATE_ENDPOINT: EP-CSVRC-0015
UPDATED_AT: 2026-09-11T12:33:00+04:00

# Original task / acceptance ledger

- TASK-001 | separate Utilities tile | MERGED — PR #1184
- TASK-002..TASK-006 | XML-first conversion/profile/parser/duplicate/parallel-list foundation | MERGED — PR #1184; parser physical-record integrity repaired in LEG-009
- TASK-007..TASK-013 | XML hierarchy, persistent identity, candidate outcomes/cardinality, semantic PIPE, coordinate frame, common-support topology | MERGED — PR #1184; audited lineage/common-support/candidate-authority defects repaired in LEG-009
- TASK-014..TASK-020 | component/load event semantics, structured event ledger, deterministic remarks, Hold exclusion and suppressed-field policy | MERGED — PR #1184; ambiguity event/output barrier and multiplicity fixes repaired in LEG-009; load semantic-null and total-support attribution hardened in LEG-010
- TASK-021..TASK-024 | later-revision output/audit/staged UI/review | MERGED — PR #1184; review integrity/evidence and blocked-preview fixes repaired in LEG-009
- TASK-025 | owner benchmark behaviors | COMPLETE_QUALIFIED — all four ordered R2->R3 buckets qualified; one Phase-4 R3 oracle row explicitly unsupported because no R2 composite predecessor exists
- TASK-026 | surgical implementation/no competing authorities | REMEDIATED_AND_REGRESSION_QUALIFIED — existing XML Compare candidate-pair authority supplies candidate pairs/IDs; Phase-4 uses existing exact-pair component-graph events rather than a parallel row matcher
- TASK-027 | owner-only merge | COMPLETE — Owner explicitly authorized merge at 2026-09-11T03:54:00Z; PR #1188 merged as `52a05713c662c76bf5e46f8de3819a4837e35a66`; qualification-only PR #1189 closed unmerged
- TASK-028 | direct XLSX browser ingress | HOTFIX_IMPLEMENTED_FOCUSED_QUALIFIED_BROWSER_ACCEPTANCE_PENDING — PR #1191 / LEG-011

# Owner benchmark authority

- Unique SupportLocation item = `CIVIL SECONDARY SUPPORT (Tag provided by Civil) + PIPE`; Civil alone is not unique and must not be used as support-location identity.
- PIPE may change across revisions only when stronger lineage evidence establishes continuity, such as persistent primary-support reference overlap plus corroboration.
- R3 `REMARKS (IF ANY)` is benchmark/oracle only and is blanked from both revisions before production comparison.
- Unsupported/non-mechanically-verifiable labels such as HOLD/Hold Removed are excluded from comparison evidence.
- Bucket order: Phase 1 `PS No. change`; Phase 2 `Support location change`; Phase 3 `Load change`; Phase 4 `Total no of support change`.
- Owner `proceed next` at 2026-09-11T08:22:00Z authorized one bounded post-merge progression to repair direct XLSX UI ingress and checkpoint the hotfix. It did not authorize merge of PR #1191.

# Post-merge UI defect

Owner browser acceptance with direct `R2.xlsx` and `R3.xlsx` selection showed raw OOXML/ZIP text beginning with `PK... [Content_Types].xml` in both revision text areas. The UI used `File.text()` for all selected files, so XLSX package bytes were passed into the flat-table parser. The resulting diagnostics inferred invalid one/two-column schemas and then reported governed Support Report columns as missing.

# Material history

LATEST_MATERIAL_LEG: LEG-011
LATEST_MATERIAL_LEG_FILE: agents/chains/CSV-REV-COMPARE-1181/material-legs/LEG-011.md
MATERIAL_HEAD: 84a9073ac09bcb27724dca7a78d0e6f46c29c453
MATERIAL_BASE_MAIN: 136abb2f7bc371e1a622f5d69e7c326e42bdf3b6

LEG-011 repairs only the browser ingress boundary. XLSX now uses `File.arrayBuffer()` plus SheetJS, detects the Support Report worksheet by `PIPE + CIVIL SECONDARY SUPPORT` semantics within the first 40 rows, preserves formulas with leading `=`, serializes the detected worksheet table to CSV text, then delegates unchanged to the governed Table-to-Categorized-XML parser. CSV/TSV/TXT/paste behavior remains on the prior text path.

# Qualification evidence

ENGINE_QUALIFICATION_RECEIPT: agents/qualifications/CSV-REV-COMPARE-1181/QR-CSVRC-1181-0001.md
ENGINE_QUALIFICATION_RUN: 34559399072
ENGINE_QUALIFICATION_JOB: 103138837486
ENGINE_QUALIFICATION_CONCLUSION: SUCCESS
ENGINE_QUALIFICATION_HEAD: fab90ca9e61a28fc29f428f0c174955384ef16da
R2_EXTRACT: `Load Data-Rev 2`, 144 rows x 36 columns
R3_EXTRACT: `Load Data-Rev 3`, 43 rows x 36 columns

HOTFIX_QUALIFICATION_RECEIPT: agents/qualifications/CSV-REV-COMPARE-1181/QR-CSVRC-1181-0002.md
HOTFIX_QUALIFICATION_STATE: PASS_FOCUSED_LOCAL
HOTFIX_FOCUSED_RESULT: 7 tests passed / 0 failed; UI and XLSX-ingress syntax checks passed
HOTFIX_MANUAL_BROWSER_ACCEPTANCE: PENDING

# Benchmark ledger

- PHASE-1 | `PS No. change` | PASS
  - expected=1, detected=1, TP=1, FP=0, FN=0, precision=1, recall=1, F1=1
  - TP composite key: `SL-111001(REF)||BWGA-1000-FL-8"-M1610003-(FL-07)`
- PHASE-2 | `Support location change` | PASS
  - real benchmark expected=0, detected=0, FP=0, FN=0; real data is a negative control
  - dedicated executable positive relocation regression: PASS
- PHASE-3 | `Load change` | PASS
  - expected=2, detected=2, TP=2, FP=0, FN=0, precision=1, recall=1, F1=1
  - keys: `SL-111001(REF)||BWGA-1000-FL-8"-M1610003-(FL-07)::LOAD_SIGNATURE_CHANGED`; `SL-111009(REF)||/BWGA-1000-8"-P1110101-1006520P5-01::LOAD_SIGNATURE_CHANGED`
- PHASE-4 | `Total no of support change` | PASS_WITH_EXPLICIT_UNSUPPORTED_ORACLE
  - oracleExpected=3, unsupported=1, checkable expected=2, detected=2, TP=2, FP=0, FN=0, precision=1, recall=1, F1=1
  - TP: `SL-111064(REF)||BWGA-1000-2"-P8310001-13421-01` (1 -> 2)
  - TP: `SL-111069(REF)||BWGA-1000-2"-P8310007-253461P1-01` (2 -> 1)
  - unsupported: `SL-111064(REF)||BWGA-1000-3/4"-D8310024-253461P1-01` — `NO_LINEAGE_PREDECESSOR`; no R2 Civil+PIPE predecessor, therefore not mechanically checkable and not comparison evidence

# Current delivery status

ENGINEERING_STATE: HOTFIX_IMPLEMENTED
CUSTODY_STATE: HELD
QUALIFICATION_STATE: PASS_FOCUSED_LOCAL_BROWSER_ACCEPTANCE_PENDING
WRITE_AUTHORITY: READ_ONLY
AUTO_STATE: NOT_APPLICABLE
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
PR: 1191
PR_STATUS: OPEN_DRAFT_MERGEABLE
BRANCH: issue-1181-xlsx-ui-ingress-hotfix
ACTIVE_ENDPOINT: EP-CSVRC-0015
MAIN_OBSERVED: 136abb2f7bc371e1a622f5d69e7c326e42bdf3b6
MATERIAL_HEAD: 84a9073ac09bcb27724dca7a78d0e6f46c29c453
CURRENT_HEAD_VALIDATION: XLSX_INGRESS_FOCUSED_PASS_BROWSER_RETRY_PENDING
QUESTION_SET: QS-CSVRC-1181-0001 CURRENT / REUSED
QUALIFICATION_SCOPE: QSCOPE-XMLCOMPARE-1181-CSV-XML-LINEAGE
CHAIN_HANDOVER_READY: TRUE
TAKEOVER_QUALIFICATION_READY: TRUE
HANDOVER_CONTENT_READY: TRUE
HANDOVER_VALIDATION_STATUS: PASS
HANDOVER_READY: TRUE
ISSUE_CHAIN_ROOT_COMMENT_ID: 5615805173
ISSUE_ACTIVE_HANDOVER_COMMENT_ID: 5615807778
ISSUE_LATEST_ENDPOINT_COMMENT_ID: 5631696133
ISSUE_HANDOVER_SYNC_STATUS: IN_SYNC
PR_REVIEWS: NONE
PR_UNRESOLVED_THREADS: NONE
PR_HEAD_STATUSES: NONE
PR_HEAD_WORKFLOW_RUNS: NONE
EXACT_NEXT_ACTION: run Owner browser acceptance using actual R2.xlsx + R3.xlsx against hotfix preview/deployment; expect extracted Support Report table text rather than PK bytes, then normal schema validation and XML comparison. Merge remains Owner-only and requires a new explicit authorization.
