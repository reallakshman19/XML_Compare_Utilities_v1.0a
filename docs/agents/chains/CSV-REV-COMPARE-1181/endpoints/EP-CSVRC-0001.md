CHAIN_STATE_VERSION: 3
HANDOVER_PROTOCOL_VERSION: 2
CHAIN_ID: CSV-REV-COMPARE-1181
ENDPOINT_ID: EP-CSVRC-0001
PREDECESSOR_ENDPOINT: NONE
AGENT_INSTANCE_ID: chatgpt:d8a6364c-4d17-47b7-ae66-90a497ec5f2d
WORK_ITEM_SOURCE: GITHUB_ISSUE
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1181
WORK_ITEM_MODE: EXCLUSIVE
COMMON_PROTOCOL: engineering-pr-delivery-v2
COMMON_PROTOCOL_BASIS: af4c5c73b87b26187aa6c930b60172cbb1f0f3e2
COMMON_PROTOCOL_STATUS: CURRENT
ISSUE_BASIS_ID: IB-CSV-REV-COMPARE-1181-0001
ISSUE_CURRENT_STATE_FILE: agents/chains/CSV-REV-COMPARE-1181/issue-state/CURRENT.md
PR: NONE
BRANCH: issue-1181-csv-rev-compare-xml-v2
BASE_MAIN: e325d9799bcdec9e5f9d9953679f295bb98beaf3
ENGINEERING_STATE: READY
CUSTODY_STATE: HELD
QUALIFICATION_STATE: NOT_REQUIRED_FOR_CURRENT_CUSTODIAN; FUTURE_TAKEOVER_SET_CURRENT
WRITE_AUTHORITY: WRITE_ALLOWED
AUTO_STATE: NOT_APPLICABLE
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
PREWORK_QUALIFICATION_READY: TRUE
QUALIFICATION_PROFILE: PARSER_TOPOLOGY
QUALIFICATION_PROFILE_VERSION: 2
QUALIFICATION_SCOPE_ID: QSCOPE-XMLCOMPARE-1181-CSV-XML-LINEAGE
QUESTION_SET_ID: QS-CSVRC-1181-0001
QUESTION_SET_STATUS: CURRENT
OWNER_QUALIFICATION_BASELINE_DISCOVERY: COMPLETE
OWNER_QUALIFICATION_BASELINE_MANIFEST: agents/chains/CSV-REV-COMPARE-1181/qualification-baselines/QB-CSVRC-1181-0001.json
OWNER_QUALIFICATION_BASELINE_STATUS: SATISFIED
TAKEOVER_QUALIFICATION_READY: TRUE
HANDOVER_CONTENT_READY: TRUE
HANDOVER_VALIDATION_STATUS: NOT_RUN
CHAIN_HANDOVER_READY: TRUE
HANDOVER_READY: FALSE_UNTIL_MATERIAL_VALIDATION_AND_ISSUE_SYNC

# Authority / reconciliation

- Explicit Owner instruction: `rebase if required; PR1181 is done, proceed coding` at 2026-09-10T08:41:21Z.
- No GitHub PR #1181 exists; instruction is treated as clearance that prerequisite work is complete and issue #1181 coding may proceed.
- Current main is `e325d9799bcdec9e5f9d9953679f295bb98beaf3`; no open PR search result matched table-categorizer/revision-compare authority.
- Old branch `issue-1181-csv-rev-compare-xml@ff7396d6...` is 22 commits ahead / 29 behind its comparison to current main and is salvage evidence only. It is not the delivery history.
- No applicable Owner roadmap registry match was located. Issue #1181 remains the primary execution specification.

# Full takeover qualification pack — QS-CSVRC-1181-0001

## Q1 Production Trace
Trace one quoted CSV row with duplicated `Fy,Fy` values `-13623,-11594` through `parseTableSource()` stable `columnIds` / `rawByColumnId`, the governed `support-revision-csv-xml/v1` profile, categorized graph/XML, support-revision semantic model, lineage/event ledger, remark renderer and output cell. Prove exact row/cell provenance and identify parser vs categorizer vs comparison authority. Fail if a second CSV parser, header-only value map, direct row matcher or remarks become authority.

## Q2 Current Failure Isolation
Using REV1 `=1006649755/3641 -> /SL-212.3 -> SHOE-250`, REV2 `=1006649755/3641 -> /SL-212.2 -> SHOE-250`, and REV1-only `=1006649755/4596 -> MDS/ST06.10-PMP`, reconstruct persistent-reference lineage. Predict shared and removed reference sets and prove `3641` => SAME_COMPONENT + PRIMARY_MEMBER_RENUMBERED while `4596` contributes to SUPPORT_COMPONENT_SET_CHANGED. Falsifier: change REV2 persistent reference 3641 to a distinct reference; continuation confidence must disappear.

## Q3 Authority / Invariant
Using required cardinalities `1 -> N`, `N -> 1`, `N -> M` and coordinate forms `N 1124807`, `N -1124807`, `S 1124807`, prove minimum structural evidence for CROSS_FAMILY_COMMON_SUPPORT and coordinate-frame normalization. Duplicate PREV NAME/member suffix/raw coordinate text are not persistent engineering identity. Ambiguous structural transitions remain review-required. Falsifier: identical family/reference-set/position duplicates must not emit COMMON_SUPPORT_REPLICATED.

## Q4 Independent Validation
Hand-derive load-vector classifications for PS02039: EMPTY `[Fy#1='', Fy#2='']` -> NUMERIC `[-13623,-11594]`; unchanged numeric `[-13623,-11594] -> [-13623,-11594]`; changed `[-13623,-11594] -> [-14000,-11594]`. Predict LOAD_BECAME_NUMERIC / no event / LOAD_SIGNATURE_CHANGED independently of production output. Explain stable ordinal ownership and versioned tolerance. Fail if duplicate headers collapse or production output is the oracle.

## Q5 Minimal Patch / NO-PATCH Boundary
Using aligned list lengths 4/4/4 and negative case 2/1/3, identify the smallest reusable extension to existing `many-per-row` that preserves every item plus mismatch diagnostics, and the support-specific graph/model/event consumers. Preserve parser behavior, generic Revision Compare mission and remarks-as-output separation. NO-PATCH if current main already owns equivalent aligned evidence. Fail if the design adds direct CSV comparison, competing decision ledger, or support remarks inside comparison logic.

# Planned material leg LEG-001

MATERIAL_SCOPE: governed CSV->categorized XML foundation only: generic aligned many-per-row + duplicate-column series, support-revision profile, conversion pipeline and focused tests.
PROTECTED_DOMAINS: existing parser contract; generic Revision Compare behavior; target remarks; Hold automation.
EXACT_NEXT_ACTION: begin LEG-001 production implementation after this endpoint commit exists in history.
