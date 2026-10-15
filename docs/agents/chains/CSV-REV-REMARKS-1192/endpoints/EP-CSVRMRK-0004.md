# Endpoint EP-CSVRMRK-0004 — R1 executable qualification FAIL

CHAIN_ID: CSV-REV-REMARKS-1192
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1192
PARENT_WORK_ITEM: github:reallaksh19/XML_Compare_Utilities#1181
PREDECESSOR: EP-CSVRMRK-0003
ISSUE_BASIS_ID: IB-CSV-REV-REMARKS-1192-0001
DELIVERY_PR: 1197
DELIVERY_BRANCH: issue-1192-remark-remediation
DELIVERY_MATERIAL_HEAD: 81c727d3a5841b9b23ba54ad8738a33808f83921
QUALIFICATION_PR: 1200 (QUALIFICATION ONLY — NEVER MERGE)
QUALIFICATION_HEAD: fcc572b77fdf7e8dae5ee7fe78d020f1dadd47ab
QUALIFICATION_RUN: 34586607702
QUALIFICATION_JOB: 103222162057
MAIN_OBSERVED: 2b473ae1c4e93d92ad2af8e0716bd8e72ac2eab0
COMMON_PROTOCOL_BASIS: af4c5c73b87b26187aa6c930b60172cbb1f0f3e2
ENGINEERING_STATE: IN_PROGRESS
CUSTODY_STATE: HELD
QUALIFICATION_STATE: FAIL
WRITE_AUTHORITY: READ_ONLY
AUTO_STATE: NOT_APPLICABLE
MERGEABILITY: MERGEABLE
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
QUALIFICATION_SCOPE_ID: QSCOPE-XMLCOMPARE-1192-REMARK-CORRECTNESS
QUESTION_SET_ID: QS-CSVRC-1192-0001
QUESTION_SET_STATUS: CURRENT
TAKEOVER_QUALIFICATION_READY: TRUE

## Qualification outcome

R1 executable qualification is non-vacuous and failed on the real R2→R3 relocation oracle:
- Phase 1: expected 1 / detected 1 / TP1 FP0 FN0 / PASS.
- Phase 2: expected 13 / detected 14 / TP7 FP7 FN6 / precision 0.5 / recall 0.5384615384615384 / F1 0.5185185185185186 / **FAIL**.
- Phase 3: expected 2 / detected 2 / TP2 FP0 FN0 / PASS.
- Phase 4: oracleExpected 3 / unsupported 1 / checkable expected 2 / detected 2 / TP2 FP0 FN0 / PASS.

The Phase-2 oracle defect itself is corrected: `Support Relocated` now enters the expected set. The failed real score proves the current R1 production rule is not sufficient. Re-enabling trusted `1->1` movement creates seven false positives and still misses six expected rows.

Qualification receipt: `agents/qualifications/CSV-REV-REMARKS-1192/QR-CSVRC-1192-R1-0001.md`.

## Protected boundary

No R2 deletion-state projection, common-support replication redesign, support-type attribution change, total-support change, XLSX ingress change, or workflow-file production change is authorized by this endpoint. Target remarks remain oracle-only; Civil+PIPE identity remains authoritative.

EXACT_NEXT_ACTION: in a new Owner progression, perform R1 failure isolation for the seven FP and six FN using lineage/cardinality/coordinate-frame evidence, derive a narrow detector rule without target-remark evidence, patch R1, and rerun the same qualification-only gate. Do not merge #1197 or #1200.