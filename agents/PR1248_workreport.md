# PR1248 work report — Writer2 review-state UX truth

## Mission

Implement Slice 6 for #1239 after audit: make the two-stage correspondence review state explicit and deterministic without changing the underlying review-to-transfer authority contract.

## Stack / live basis

- Issue: `reallaksh19/XML_Compare_Utilities#1239`
- Base dependency: draft PR #1247 / branch `fix/cii-writer2-anchor-propagation-experiment-1239`
- Stack base SHA: `695e555f57eb0c7c1549a00307c5797e71c67470`
- Branch: `fix/cii-writer2-review-state-ux-1239`
- Merge authority: OWNER_ONLY / NOT_GRANTED

## Audit-first findings

1. The existing product intentionally has a two-stage state machine:
   - review controls mutate pending in-memory decisions;
   - `Apply approvals to Transfer Preview` rebuilds correspondence / transfer preview and makes those decisions authoritative.
2. The prior KPI surface showed total HIGH/MEDIUM confidence counts, but bulk actions used a stricter eligibility predicate: confidence match + identity-bound + not LOCKED.
3. A row already effectively ACCEPTED should not remain bulk-eligible; accepting it again is a true no-op.
4. The older scoped-shell parent observes bulk clicks. A zero-eligible Writer2 bulk click could therefore still dirty an outer scope path even when the Writer2 handler correctly classified the action as `changed:false`.
5. `ciiMultiSourceReviewSummaryMarkup()` is shared with the generic review-only route, so Writer2 control binding must be scoped to the retained Writer2 route only.
6. The retained Writer2 root is `.ciiw-backdrop`, not `.ciiw-workspace`; control lookup must stay inside that exact overlay.

## Implemented semantics

- Added a pure `ciiMultiSourceReviewState()` projection.
- Bulk eligibility is now "this click would actually change the effective decision to ACCEPT".
- Summary distinguishes:
  - total confidence rows;
  - HIGH eligible;
  - MEDIUM eligible;
  - LOCKED;
  - effective ACCEPT / REJECT / PENDING;
  - pending decision deltas not yet applied to Transfer Preview.
- `Accept eligible HIGH (N)` and `Accept eligible MEDIUM (N)` use the same state model as the actual bulk mutation path.
- N=0 bulk controls are disabled, preventing a no-op click from dirtying the parent scoped-shell listener.
- Apply control states:
  - synchronized + no decision delta -> disabled, labelled `Review synchronized with Transfer Preview`;
  - pending decision delta -> enabled, labelled `Apply N pending decision(s) to Transfer Preview`;
  - outer transfer state dirty with synchronized decisions -> enabled with an explicit re-apply label.
- Writer2-only control binding is scoped to the nearest `.ciiw-backdrop` and explicitly no-ops on the generic review-only transfer route.
- Underlying authority remains unchanged: only the existing apply/rebuild transition makes pending decisions authoritative.

## Files

- `tabs/cii-workspace/cii-workspace-multisource-review-state-controls.js`
- `tabs/cii-workspace/cii-workspace-multisource-review-ui.js`
- `tests/cii-workspace-multisource-review-state.test.js`
- `tests/browser/cii-writer2-multisource-retained-tile-ui.spec.mjs`

## Falsifiers / tests authored

- unbound HIGH is not eligible;
- LOCKED HIGH is not eligible;
- already-effective ACCEPT is not eligible;
- first bulk accept mutates only eligible rows;
- second identical bulk accept is a true zero-op;
- pending decision count equals rows whose effective decision differs from bound preview decision;
- synchronized review disables Apply;
- pending decision delta enables Apply and exposes exact pending count;
- retained browser test derives eligible HIGH/MEDIUM counts from the rendered model instead of hard-coding either band as nonzero;
- after apply/rebuild, controls return to synchronized state.

## Protected invariants

- no correspondence authority change;
- no anchor / propagation logic change;
- no Writer1C/Writer2 mutation authority change;
- no transfer-scope contract change;
- no benchmark-answer change;
- generic review-only route gets richer shared summary counts but no Writer2 control mutation;
- owner-only merge remains in force.

## Validation truth

- architecture/source audit: PASS;
- stacked diff scope: PASS — four files only;
- deterministic state-model test: AUTHORED / NOT_RUN in connector-only execution context;
- retained browser UX regression: AUTHORED / NOT_RUN;
- retained automatic S1/S2/S3 benchmark on this head: NOT_RUN;
- exact-head provider status/workflow evidence: pending final-head query;
- merge: NOT AUTHORIZED.

## MATERIAL_FRONTIER

Writer2 review-state presentation + bulk/apply control projection only.

## SEMANTIC_EVIDENCE_FRONTIER

Pending UI decisions remain non-authoritative until the existing apply/rebuild transition. UI counts and enabled controls now project that exact state truth.

## EXACT_NEXT_ACTION

Open stacked draft PR, query exact-head provider status/workflow evidence, publish TASK_EVIDENCE on #1239, then audit Slice 7 blocker causality / scope-hash noise before any implementation. No merge.
