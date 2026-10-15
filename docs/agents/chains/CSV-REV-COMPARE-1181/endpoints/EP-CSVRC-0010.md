# Endpoint EP-CSVRC-0010 — P0/P1 remediation pre-work freeze

CHAIN_ID: CSV-REV-COMPARE-1181
PREDECESSOR: EP-CSVRC-0009
CUSTODY_EPOCH: 10
AGENT_INSTANCE_ID: chatgpt:d8a6364c-4d17-47b7-ae66-90a497ec5f2d
WORK_ITEM_SOURCE: GITHUB_ISSUE
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1181
WORK_ITEM_MODE: EXCLUSIVE
PR: 1188
BRANCH: issue-1181-phase1-current-main
PR_HEAD_OBSERVED: d5ef50d03da1b9ebffaa03da3c63daaf51748e16
MAIN_OBSERVED: 419c94cca7649626e0b3e641f20d5261967347ba
PR_STATE_AT_GATE: OPEN_DRAFT
PR_MERGEABLE_AT_GATE: TRUE
REVIEWS: NONE
UNRESOLVED_REVIEW_THREADS: NONE
REQUIRED_CHECKS: NONE_CONFIGURED; current head statuses empty
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE

COMMON_PROTOCOL: engineering-pr-delivery-v2
COMMON_PROTOCOL_BASIS: af4c5c73b87b26187aa6c930b60172cbb1f0f3e2
COMMON_PROTOCOL_STATUS: CURRENT
OWNER_PROGRESSION_COMMAND: PROCEED_NEXT
OWNER_INSTRUCTION: 2026-09-10T21:50:04+04:00 — fix audited flaws, proceed next, follow engineering-pr-delivery-v2 at pinned Common basis
ROADMAPS: issue #1181 execution plan; Common engineering-pr-delivery-v2; repository AGENTS.md project overlay
ROADMAP_REVIEW_STATUS: COMPLETE
ROADMAP_ALIGNMENT: ALIGNED
ROADMAP_MUTATION_AUTHORITY: NONE

QUALIFICATION_SCOPE_ID: QSCOPE-XMLCOMPARE-1181-CSV-XML-LINEAGE
QUESTION_SET_ID: QS-CSVRC-1181-0001
QUESTION_SET_STATUS: CURRENT
QUESTION_PACK_ACTION: REUSED
QUESTION_DISPLAY: HIDE
TAKEOVER_QUALIFICATION_READY: TRUE
PREWORK_QUALIFICATION_READY: TRUE

## Audit-triggered bounded remediation scope
The Owner explicitly supersedes the prior Phase-3 sequencing action for this bounded repair leg. This leg does not begin Phase 3 and does not alter benchmark/oracle authority. It repairs defects already inside issue #1181 and the current PARSER_TOPOLOGY qualification scope.

Priority defects to remediate before further benchmark progression:
1. Shared table parser must not merge TSV/pasted physical rows when an unquoted engineering inch mark (`4"`) occurs in a field.
2. Unresolved candidate/structural ambiguity must not emit operational removed/added events, tombstones, or user-facing provisional output before review resolution.
3. Support-revision candidate decisions must not become a competing production authority beside the existing XML Compare candidate-pair authority; integration must preserve one governed candidate/review decision path.
4. Common-support topology must distinguish continuing anchors from newly replicated targets, require support-arrangement evidence, and represent equal-cardinality N->M redesigns.
5. Review decisions must reject conflicting many-source approvals to one target rather than silently dropping an approved edge.
6. Persistent-reference multiplicity must not be silently collapsed by `Map(reference -> component)` semantics.
7. Trusted coordinate-frame anchors must include high-confidence persistent-reference continuations as required by issue #1181.

## Validation truth at pre-work
STATUS: NOT_RUN
OBSERVATION: GitHub connector source/PR inspection; no executable checkout available because the local environment cannot resolve github.com. PR head has no status checks. No workflow file change is authorized.
ORACLE: owner issue specification + existing focused tests + new regression tests to be authored before production behavior changes.

Prior Phase 1 isolated benchmark evidence remains evidence-only. Phase 2 and current-head validation remain NOT_RUN and must not be promoted to PASS.

## Protected invariants
- CSV/table input and Support Report output remain presentation; categorized XML/graph remains comparison domain.
- Existing XML Compare candidate/review authority must be reused rather than replaced with another assignment/decision engine.
- Persistent primary-support references are strongest component identity evidence where present.
- Ambiguous lineage remains review-required and fail-closed.
- R3 remarks are oracle-only; Hold automation remains excluded.
- No workflow mutation; no merge without explicit Owner authorization.

## Exact next action
Create regression tests for the audited P0/P1 defects, then patch the smallest owning parser/lineage/review/model/event/UI seams. Keep executable validation as NOT_RUN unless real execution evidence becomes available. After the material batch, record a material-leg receipt and synchronize CURRENT.md plus the Issue endpoint/Active Handover projection before any further progression.
