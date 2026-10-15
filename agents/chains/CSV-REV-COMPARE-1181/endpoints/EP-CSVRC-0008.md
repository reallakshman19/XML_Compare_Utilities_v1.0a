# Endpoint EP-CSVRC-0008 — Phase 1 current-main re-ground

CHAIN_ID: CSV-REV-COMPARE-1181
PREDECESSOR: EP-CSVRC-0007
MATERIAL_LEG: LEG-007
MATERIAL_HEAD: ad0906521f15423d025b7d68b25f8cc2c15a36b8
MAIN_OBSERVED: 419c94cca7649626e0b3e641f20d5261967347ba
PR: 1188
BRANCH: issue-1181-phase1-current-main
PR_STATE: OPEN_DRAFT
PR_MERGEABLE: TRUE
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE

## Delivered at this endpoint
Phase 1 `PS No. change` is re-grounded as a single current-main material commit. The delivery path no longer contains the stale pre-v2 salvage history. The re-ground preserves merged issue-#1181 authorities while adding the owner-directed composite `Civil + PIPE` identity, persistent-reference fallback when PIPE changes, PREV NAME weighting, SIZE/BORE compatibility, and auditable validated-frame coordinate weighting.

`SUPPORT_LINEAGE_SCORE_V2` v2.1.0 records per-signal contributions and coordinate-axis evidence. Approximate lineage cannot be created by PREV NAME or coordinate proximity alone; known bore mismatch blocks it. Existing `XmlCompareCandidatePairModel` reuse remains in the candidate pipeline as XML Compare evidence.

## Real benchmark authority
INPUT-004 is now RESOLVED:
- `benchmarks/R2.zip` = earlier revision
- `benchmarks/R3.zip` = later revision / oracle remarks

R3 remarks are removed from comparison input. Unsupported/unprovable oracle tokens such as HOLD do not count as errors. Benchmarking is bucket-wise.

Phase 1 prior isolated qualification evidence: GitHub Actions run `34499007825`, head `d5b83646b29550ff6ee29b29c9b98c6ec0387c0c`, real R2->R3 result expected=1, detected=1, TP=1, FP=0, FN=0, precision=1, recall=1, F1=1.

## Validation truth for this endpoint
STATUS: NOT_RUN
SCOPE: exact current-main material head `ad0906521f15423d025b7d68b25f8cc2c15a36b8`.
REASON: no PR-triggered workflow run exists for PR #1188 and no connector workflow-dispatch action is available. No workflow file was changed because owner authorization for workflow mutation was not provided.

The prior PASS is retained as evidence, not inherited as an exact-head PASS.

## Drift / merge state
The material commit's sole parent is current main `419c94cca7649626e0b3e641f20d5261967347ba`; PR #1188 is therefore 1 material commit ahead and 0 behind at this checkpoint. GitHub reports it mergeable and draft. Merge is not authorized in this progression.

## Next action
On the next exact `proceed next`, begin Phase 2 `Support location change` from this current-main Phase 1 base, preserving the Phase 1 benchmark gate and using lineage coordinate evidence as the primary auditable relocation input. Do not tune against non-mechanically-checkable R3 tokens.
