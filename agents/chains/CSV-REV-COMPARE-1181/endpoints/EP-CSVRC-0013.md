# Endpoint EP-CSVRC-0013 — Phase 3 Load change pre-work freeze

CHAIN_ID: CSV-REV-COMPARE-1181
PREDECESSOR: EP-CSVRC-0012
CUSTODY_EPOCH: 13
LATEST_MATERIAL_LEG: LEG-009
HEAD_AT_PREWORK: a9a2d0769d568bf23c77719ae9b1b2ded0cbcd30
MAIN_OBSERVED: 419c94cca7649626e0b3e641f20d5261967347ba
PR: 1188
BRANCH: issue-1181-phase1-current-main
PR_STATE: OPEN_DRAFT
PR_MERGEABLE: TRUE
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE

COMMON_PROTOCOL: engineering-pr-delivery-v2
COMMON_PROTOCOL_BASIS: af4c5c73b87b26187aa6c930b60172cbb1f0f3e2
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1181
WORK_ITEM_MODE: EXCLUSIVE
AGENT_INSTANCE_ID: chatgpt:d8a6364c-4d17-47b7-ae66-90a497ec5f2d

## Owner progression authority

At 2026-09-10T19:14:13Z (2026-09-10T23:14:13+04:00), the Owner issued `proceed next` after EP-CSVRC-0012 explicitly gated progression. This authorizes only Phase 3 `Load change`. It does not authorize Phase 4, workflow-file mutation, merge, or any change to the established XML/categorized-graph comparison authority.

## Re-grounding / continuation decision

DECISION: CONTINUE

Live delivery PR #1188 remains the sole delivery PR for issue #1181, open draft and mergeable. Qualification-only PR #1189 remains evidence infrastructure and must never be merged as delivery. Current main remains `419c94cca7649626e0b3e641f20d5261967347ba` at this pre-work boundary.

The current load authority is already present in `support-revision-loads.js` and `support-revision-events.js`:

- load slots preserve `columnId`, `columnOrdinal`, header, ordinal, raw value and source-cell lineage;
- comparison keys by stable `columnId` first, then ordinal/header fallback;
- numeric equality uses the versioned `SUPPORT_REV_LOAD_POLICY_V1` absolute/relative tolerances;
- only accepted lineage edges reach operational load comparison;
- `LOAD_BECAME_NUMERIC` and `LOAD_SIGNATURE_CHANGED` are typed event-ledger outputs and deterministic remark inputs.

## Phase 3 hypothesis and falsifier

HYPOTHESIS: Phase 3 requires qualification harness work only; the repaired production load comparison already satisfies the owner bucket when evaluated on accepted XML lineage.

FALSIFIER: real `benchmarks/R2.zip -> benchmarks/R3.zip` mechanically-checkable load oracle rows do not match detector output, or focused regressions expose incorrect stable-column alignment, numeric/symbolic state handling, tolerance behavior, duplicate-heading handling, or load comparison across structural lineage.

If falsified, patch only the smallest owning load/event seam after a failing regression is recorded. Do not tune expected values to production output.

## Phase 3 benchmark contract

- Bucket: `Load change`.
- R3 `REMARKS (IF ANY)` is oracle-only and must be blanked from both revisions before production comparison.
- Expected items use the later-revision composite SupportLocation identity `CIVIL SECONDARY SUPPORT + PIPE`.
- Detector authority is the typed event ledger, not generated remark text.
- Candidate/lineage acceptance remains upstream authority; load values never establish identity.
- Stable duplicate load headings are aligned by source `columnId`/column ordinal, not object insertion order.
- Empty -> numeric is classified distinctly as `LOAD_BECAME_NUMERIC`; other material signature deltas use `LOAD_SIGNATURE_CHANGED`.
- Numeric changes within `SUPPORT_REV_LOAD_POLICY_V1` tolerance are unchanged.
- HOLD/Hold Removed is excluded from Phase-3 evidence.
- Phase 1 and Phase 2 metrics remain regression guards.

## Validation state

PHASE1: PASS
PHASE2: PASS
PHASE3: NOT_RUN
PHASE4: NOT_STARTED / NOT_AUTHORIZED

No Phase-3 code or test change exists at this endpoint. No workflow file has been changed.

## Exact next action

Author the Phase-3 `Load change` benchmark module and focused regressions first, reusing the Phase-1/Phase-2 harness pattern and the existing load/event authorities. Then execute the real R2->R3 Phase-3 benchmark through the existing qualification-only lane without workflow-file mutation. If the benchmark falsifies production load semantics, remain in Phase 3 and repair only the isolated defect; otherwise record qualification and stop before Phase 4.