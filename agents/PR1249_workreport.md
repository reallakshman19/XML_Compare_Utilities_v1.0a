# PR1249 work report — Writer2 blocker causality / scope-noise cleanup

## Mission

Implement Slice 7 for #1239 after audit: stop treating downstream stage consequences as independent root failures and stop reporting scope hash/set mismatches when no valid bound scope exists yet.

## Stack / live basis

- Issue: `reallaksh19/XML_Compare_Utilities#1239`
- Base dependency: draft PR #1248 / branch `fix/cii-writer2-review-state-ux-1239`
- Stack base SHA: `5f31bae3b229cfbd68ff8124562d37067843f036`
- Branch: `fix/cii-writer2-blocker-causality-1239`
- Merge authority: OWNER_ONLY / NOT_GRANTED

## Audit-first findings

1. `combinedTransferPlan()` copies per-member transfer blockers, then adds aggregate `MULTISOURCE_CORRESPONDENCE_NOT_READY`, creating a flat cascade.
2. `ciiWriter2SourceSetNodeNameReadiness()` then adds:
   - `CII_MS_WRITER2_BOUND_SCOPE_REQUIRED`;
   - scope source/target hash mismatch checks;
   - scope operation-set mismatch checks;
   - `CII_MS_WRITER2_TRANSFER_PLAN_NOT_PREVIEW_READY`.
3. When `transferScope` is absent, scope-specific hash and set checks are not meaningful; the only truthful scope blocker is that a valid bound scope is required.
4. A genuinely BOUND scope with wrong custody must still fail with precise scope hash/set mismatches.
5. The correct diagnostic projection is causal:
   - member/root correspondence cause;
   - aggregate correspondence consequence;
   - transfer unavailable;
   - scope not bindable;
   - writer unavailable.
6. Direct transfer conflicts form a separate primary root and derive scope/writer unavailability without inventing a correspondence failure.

## Implemented semantics

- Added `cii-workspace-multisource-blocker-causality.js`.
- Readiness now publishes `blockerCausality` alongside the existing raw `blockers` array.
- Raw blocker codes are retained for compatibility/audit; the causal model classifies primary vs derived diagnostics.
- If correspondence is blocked by member blockers, the causal model identifies those member blockers as primary and projects the aggregate/transfer/scope/writer chain as derived.
- If transfer is blocked by a direct target mutation conflict, that conflict is primary and scope/writer unavailability is derived.
- If transfer is ready but no scope has been bound, `CII_MS_WRITER2_BOUND_SCOPE_REQUIRED` is the primary actionable blocker and Writer2 unavailability is derived.
- `custodyBlockers()` now returns immediately after `CII_MS_WRITER2_BOUND_SCOPE_REQUIRED` when the scope is not structurally BOUND. It does not emit fabricated scope hash/set mismatches in that state.
- Once a scope is structurally BOUND, source-set hash, target hash and operation-set custody checks still execute unchanged/fail-closed.

## Files

- `tabs/cii-workspace/cii-workspace-multisource-blocker-causality.js`
- `tabs/cii-workspace/cii-workspace-multisource-writer2-readiness.js`
- `tests/cii-workspace-multisource-blocker-causality.test.js`

## Falsifiers / tests authored

- no scope -> exactly bound-scope-required from scope-specific custody path; no scope source/target hash mismatch; no candidate-set mismatch;
- structurally BOUND wrong scope -> precise source-set and target hash mismatches retained;
- `S1:CORRESPONDENCE_NOT_READY` -> primary S1 cause, aggregate correspondence + transfer + scope + writer derived chain;
- scope-required is suppressed as a root while correspondence is the actual upstream root;
- transfer-ready + no scope -> bound-scope-required primary, writer unavailable derived;
- direct target mutation conflict -> primary transfer conflict, scope/writer consequences derived.

## Protected invariants

- no correspondence matching change;
- no anchor / propagation logic change;
- no Writer mutation authority change;
- no transfer-scope selection/binding contract change;
- no benchmark/geometry/Method-A change;
- raw blocker codes remain available;
- owner-only merge remains in force.

## Validation truth

- architecture/source audit: PASS;
- stacked diff scope: PASS — three files before this report;
- deterministic blocker-causality regression: AUTHORED / NOT_RUN in connector-only execution context;
- retained Writer2 browser regression: NOT_RUN;
- retained automatic S1/S2/S3 benchmark: NOT_RUN;
- exact-head provider status/workflow evidence: pending final-head query;
- merge: NOT AUTHORIZED.

## MATERIAL_FRONTIER

Writer2 readiness diagnostics / scope-custody noise only.

## SEMANTIC_EVIDENCE_FRONTIER

Primary vs derived blocker truth is now explicit without weakening any fail-closed custody or mutation gate.

## EXACT_NEXT_ACTION

Open stacked draft PR, query exact-head provider evidence, publish TASK_EVIDENCE on #1239. Then audit persistence separately; do not mix persistence with blocker semantics. No merge.
