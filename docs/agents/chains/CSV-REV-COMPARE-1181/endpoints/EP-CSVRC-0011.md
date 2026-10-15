# Endpoint EP-CSVRC-0011 — remediation complete, Phase 1 qualification gate

CHAIN_ID: CSV-REV-COMPARE-1181
PREDECESSOR: EP-CSVRC-0010
CUSTODY_EPOCH: 11
MATERIAL_LEG: LEG-009
MATERIAL_LEG_FILE: agents/chains/CSV-REV-COMPARE-1181/material-legs/LEG-009.md
MATERIAL_HEAD: ad8f936665b8bd66c15101fa64297261cb6a13de
HEAD_AT_CHECKPOINT: b4c0b8b48a4adbecbe7184a195110c8b1b1ee0a7
MAIN_OBSERVED: 419c94cca7649626e0b3e641f20d5261967347ba
PR: 1188
BRANCH: issue-1181-phase1-current-main
PR_STATE: OPEN_DRAFT
PR_MERGEABLE: TRUE
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE

COMMON_PROTOCOL: engineering-pr-delivery-v2
COMMON_PROTOCOL_BASIS: af4c5c73b87b26187aa6c930b60172cbb1f0f3e2
COMMON_PROTOCOL_STATUS: CURRENT
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1181
WORK_ITEM_MODE: EXCLUSIVE
AGENT_INSTANCE_ID: chatgpt:d8a6364c-4d17-47b7-ae66-90a497ec5f2d
ROADMAPS: issue #1181 execution plan; Common engineering-pr-delivery-v2; repository AGENTS.md project overlay
ROADMAP_REVIEW_STATUS: COMPLETE
ROADMAP_ALIGNMENT: ALIGNED
ROADMAP_MUTATION_AUTHORITY: NONE

QUALIFICATION_SCOPE_ID: QSCOPE-XMLCOMPARE-1181-CSV-XML-LINEAGE
QUESTION_SET_ID: QS-CSVRC-1181-0001
QUESTION_SET_STATUS: CURRENT
QUESTION_PACK_ACTION: REUSED
PREWORK_QUALIFICATION_READY: TRUE
TAKEOVER_QUALIFICATION_READY: TRUE

## Material result

LEG-009 records the audited P0/P1 repair batch. The branch now contains regression-first fixes for parser physical-row integrity, XML candidate-pair authority reuse, ambiguity fail-closed output/event gating, common-support cardinality and anchor semantics, target-side review conflicts, duplicate-reference multiplicity, persistent-reference coordinate-frame anchors, stable load-slot identity and review evidence presentation.

No Phase 3 implementation was started. No workflow file was changed.

## Owner benchmark clarification — 2026-09-10T22:32:17+04:00

The Owner restated the benchmark authority and phase boundary:

- SupportLocation uniqueness is the composite `CIVIL SECONDARY SUPPORT (Tag provided by Civil) + PIPE`; Civil alone is never the unique item.
- R3 `REMARKS (IF ANY)` may be used only as benchmark/oracle labels. Labels that production inputs cannot independently establish, including HOLD semantics, are not scored as failures or evidence.
- Benchmark buckets are qualified sequentially: Phase 1 `PS No. change`, Phase 2 `Support location change`, Phase 3 `Load change`, Phase 4 `Total no of support change`.
- This endpoint authorizes/targets only Phase 1 qualification. Later buckets remain separate.

The existing Phase-1 benchmark harness is aligned: expected and detected items use composite Civil+PIPE identity and R3 remarks are blanked before `runSupportRevisionCompare` executes.

## Real benchmark inputs

- `benchmarks/R2.zip` — Git blob `e80acc441108fbf5bdb4639b5c9a94f292258e68`; earlier revision.
- `benchmarks/R3.zip` — Git blob `fb1ecd917e083a9543e394cc23aa3f938d8d87fb`; later revision/oracle labels.
- Prior isolated evidence: workflow run `34499007825`, head `d5b83646b29550ff6ee29b29c9b98c6ec0387c0c`, Phase 1 expected=1 detected=1 TP=1 FP=0 FN=0.
- Prior evidence is not current-head qualification.

The prior oracle-positive item was composite key `SL-111001(REF)||BWGA-1000-FL-8"-M1610003-(FL-07)`. Its R3 remark also contained `Hold removed`; that token is outside Phase-1 scoring and was not production comparison evidence. The prior lineage continuation was established by persistent-reference overlap when PIPE changed.

## Validation truth

CURRENT_REPAIRED_HEAD_PHASE1: NOT_RUN

No executable Phase-1 benchmark has yet run against the repaired LEG-009 state. PR #1188 itself has no workflow run at this checkpoint. The stale qualification PR #1187 remains a qualification vehicle only and must never be merged as delivery.

## Protected invariants

- CSV/Support Report rows are ingress/egress; categorized XML/graph and accepted lineage are comparison authority.
- Composite Civil+PIPE identity governs support-location keys.
- PIPE changes require stronger continuity evidence; Civil equality alone cannot establish continuity.
- R3 remarks do not enter production comparison input.
- HOLD is excluded from Phase-1 scoring.
- Phase 1 qualification cannot be inferred from Phase 2/3/4 behavior.
- PR #1188 remains draft and merge unauthorized.

## Exact next action

Execute the real `R2.zip -> R3.zip` Phase-1 `PS No. change` benchmark against the repaired current branch using the existing qualification lane, without changing workflow files. Record TP/FP/FN and exact composite keys. If the repaired head fails, remain in Phase 1 and repair only the falsified Phase-1 boundary before re-running; do not advance to Phase 2/3/4.