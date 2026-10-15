# Endpoint EP-CSVRC-0009 — Phase 2 implementation checkpoint

CHAIN_ID: CSV-REV-COMPARE-1181
PREDECESSOR: EP-CSVRC-0008
MATERIAL_LEG: LEG-008
MATERIAL_HEAD: 7e3732be5a2ac0cd97acdc2a1a3d1a7b5de52c51
MAIN_OBSERVED: 419c94cca7649626e0b3e641f20d5261967347ba
PR: 1188
PR_STATE_AT_GATE: OPEN_DRAFT
PR_MERGEABLE_AT_GATE: TRUE
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE

## Capability at this endpoint
Phase 2 `Support location change` is implemented as an event projection over already-accepted XML lineage. Ordinary 1->1 support locations now emit `SUPPORT_LOCATION_RELOCATED` only when normalized coordinate evidence is `ACTUAL_POSITION_CHANGED` under a trusted revision frame. The frame must satisfy the existing Phase 1 contract: scoring-frame usable, at least three anchors, and at least two validated axes.

Common-support anchor relocation now uses the same frame gate plus persistent-reference continuity. Raw coordinate text/sign changes and under-anchored movement do not emit relocation. Human output remains deterministic: relocation projects to `Relocated Support`.

A Phase 2 real benchmark harness is present for R2.zip -> R3.zip. It treats R3 remarks as oracle-only labels, blanks remarks from both revisions before comparison, and carries Phase 1 metrics as a regression gate.

## Validation truth
STATUS: NOT_RUN

No executable current-head validation ran. GitHub reports zero status checks and zero workflow runs for `7e3732be5a2ac0cd97acdc2a1a3d1a7b5de52c51`. The connector has no workflow-dispatch action and the local execution environment cannot resolve GitHub for checkout. No PASS claim is made.

Prior Phase 1 evidence remains: run 34499007825, real R2->R3 `PS No. change` expected=1, detected=1, TP=1, FP=0, FN=0. It is evidence-only for this newer head.

## Drift / PR gate
Main remains `419c94cca7649626e0b3e641f20d5261967347ba`. PR #1188 is open, draft, and GitHub currently reports mergeable TRUE. No merge authority is granted for this PR.

## Exact next action
Do not start Phase 3. Obtain an executable validation path for PR #1188 and run the real R2.zip -> R3.zip Phase 1+2 benchmark. Phase 2 must remain `IMPLEMENTED_NOT_QUALIFIED` until that run produces evidence. Workflow files must not be modified without explicit owner authorization.
