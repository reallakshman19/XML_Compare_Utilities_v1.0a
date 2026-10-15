# PR1240 work report — CII Writer2 evidence-qualified Compare Review

## Recovery header

- `WORK_ITEM`: `reallaksh19/XML_Compare_Utilities#1239`
- `PR`: `#1240`
- `WORK_INTENT`: IMPLEMENT
- `CRITICALITY`: ENGINEERING_CRITICAL
- `MERGE_AUTHORITY`: OWNER_ONLY / NOT_GRANTED
- `BASE`: `main@b2ff4c67fe6b1ad1e9d4a0be182d6aa3dc53ac08`
- `BRANCH`: `fix/cii-writer2-evidence-qualified-review-1239`
- `LAST_PRODUCT_TEST_HEAD`: `23b22a21b184d9c7bef2b64f12281fa36905c994`
- `LAST_REPORT_REFRESH_BASIS`: `a0072896227a4428c18c589ba7f013519afb6ef2`
- `PR_STATE`: OPEN / DRAFT / UNMERGED

## Owner correction: audit before implementation

Owner explicitly required **audit first, then implement**. Further product mutation was stopped, current `main`, #1239, PR #1240, the actual evidence producers, review projector, bulk-review state machine and inherited-status producers were audited, and only then were corrections continued.

## Audit findings and implemented authority contracts

### Adjacent boundary

`cii-workspace-alignment.js#boundaryRow()` emits `ADJACENT_MATCH_BOUNDARY` HIGH only when both adjacent matched element evidences independently carry HIGH identity confidence. Compare Review now projects this as `ADJACENT_EDGE_CONSENSUS`, with HIGH/BOUND only for 2/2 identity-supported HIGH sides. The NODE does not pretend to own direct M1/M2 evidence.

### Workflow HIGH fallback

The first PR patch still fell through to global `ciiIdentityConfidence(row)`, which contains `row.status === HIGH -> HIGH`. That path has been removed from Compare Review. Workflow labels do not establish review identity.

### HIGH implies binding

Compare Review now enforces:

```text
review HIGH => identityBound
```

An explicit HIGH-looking token is downgraded to REVIEW if its recognized evidence contract does not bind identity.

### RIGID component derivative authority

`cii-workspace-components.js` creates `POINTER_BOUND_RIGID_COMPONENT_CONTEXT` rows whose status follows the parent element unless pointer custody conflicts. Existing `engineering-delta.js#componentDeltas()` already requires a bound parent element and no component blockers. Compare Review now mirrors that authority explicitly:

```text
qualified parent ELEMENT identity
+ qualified RIGID pointer custody
= derivative component identity
```

This prevents a stricter evidence projector from accidentally demoting legitimate component rows while still refusing inherited status as proof by itself.

## Current projection contract

```text
LOCKED authority                    -> LOCKED / BOUND
candidate.status != SUPPORTED       -> REVIEW/UNRESOLVED / unbound
candidate.status == SUPPORTED       -> bound; confidence from explicit winner evidence
ADJACENT_MATCH_BOUNDARY             -> HIGH only for 2/2 identity-supported HIGH adjacent elements
explicit direct identity evidence   -> HIGH only when explicit HIGH + identitySupported=true
naked workflow status HIGH          -> REVIEW / unbound
unbound row                         -> never review HIGH
RIGID component                     -> parent evidence-qualified identity + valid pointer custody
```

Bulk `Accept all HIGH` consumes only normalized `confidence === HIGH && identityBound === true` rows.

## Changed production behavior

### `tabs/cii-workspace/cii-workspace-compare-review.js`

- evidence-qualified candidate/direct confidence;
- adjacent-edge consensus normalization;
- HIGH=>BOUND invariant;
- RIGID parent+pointer-custody derivative normalization;
- `identityEvidenceBasis`, `adjacentBoundary`, `componentIdentity` projections;
- manual LOCKED preserved.

### `tabs/cii-workspace/cii-workspace-multisource-review-ui.js`

- adjacent rows render `ADJACENT CONSENSUS · 2/2 HIGH` with LEFT/RIGHT evidence;
- RIGID rows render `RIGID COMPONENT · PARENT <confidence> · POINTER CUSTODY PASS/BLOCKED`;
- recognized derivative rows do not fall back to `RED 0/0` direct-evidence presentation;
- generic direct HIGH rationale only claims M1+M2 when both projected methods pass;
- bulk status says decisions are pending until Apply-to-Preview rebuild.

### `tests/cii-workspace-adjacent-boundary-review.test.mjs`

Falsifiers cover: valid adjacent HIGH; naked status HIGH; supported-without-confidence; explicit direct supported HIGH; explicit HIGH unbound; valid RIGID derivative; status-only parent RIGID rejection; pointer-custody conflict; manual LOCKED; and evidence-specific UI rendering.

A weak guarded producer-integration assertion was removed because it could pass without exercising the scorer.

## Producer audit result

At this review boundary the relevant authority forms are: scored path/alignment evidence, propagation candidate/direct evidence, adjacent left/right composite evidence, RIGID parent-derived component context, and manual LOCKED authority. Static search found no additional relevant inherited `status: row.status` producer beyond the RIGID component path.

## Protected invariants / negative assurance

No change to correspondence generation, `cii-workspace-engineering-delta.js` global semantics, Writer2 CREATE/DELETE, Writer1C exact-span mutation, V11↔V14, Method-A/B matching/discovery, #1234 search budget, transfer-scope authority, frozen Benchmark files/answers, workflows or deployment. Production code reads no benchmark IDs or expected answers.

## Diff boundary

Against `main`, PR #1240 changes only:

1. `agents/PR1240_workreport.md`
2. `tabs/cii-workspace/cii-workspace-compare-review.js`
3. `tabs/cii-workspace/cii-workspace-multisource-review-ui.js`
4. `tests/cii-workspace-adjacent-boundary-review.test.mjs`

## Validation truth

| Gate | Status | Observation / oracle |
|---|---|---|
| live main grounding | PASS | exact GitHub readback |
| issue/producer/authority audit | PASS | exact source + issue inspection |
| workflow-HIGH fallback | FAIL → FIXED | removed from review projection |
| HIGH without binding | FAIL → FIXED | HIGH=>BOUND enforced |
| RIGID inherited-status regression risk | FAIL → FIXED | parent+pointer contract |
| producer search for other inherited-status paths | PASS (static) | none found at this boundary |
| diff scope | PASS | 2 production modules + test + report |
| deterministic test design | PASS | no benchmark hard-coding / pseudo-pass |
| commit statuses at `23b22a21…` | NOT_RUN / none instantiated | statuses=[] |
| workflow runs at `23b22a21…` | NOT_RUN / none instantiated | workflow_runs=[] |
| focused imported Node execution | NOT_RUN | no full authenticated checkout in connector session |
| existing review/confidence/rigid regressions | NOT_RUN | same environment boundary |
| retained S1/S2/S3→T Chromium benchmark | NOT_RUN | not claimed |
| byte closure / V11↔V14 qualification | NOT_RUN | not claimed |
| merge | NOT_APPLICABLE | Owner authorization not granted |

## MATERIAL_FRONTIER

`Compare Review evidence normalization + review rendering + bulk-HIGH eligibility` only.

## SEMANTIC_EVIDENCE_FRONTIER

Static producer/authority audit PASS. Exact imported Node, retained Chromium, byte closure and V11↔V14 execution remain NOT_RUN.

## Follow-on — outside this first PR

After executable validation of this authority slice, #1239 retains: full `Correspondence → Source vs Target` census/export; partial-TEXPECTED 36-delta positive overlay; direct proposal `Use / Review & Lock / Reject`; causal blocker tree/no-scope hash-noise suppression; hash-keyed Writer2 session persistence.

Issue #1237 remains the broader anchor-seed/cardinality specification. PR #1238 must not independently alter this active review-authority slice.

## Highest remaining risk

Executable compatibility. If a legitimate producer is later found to rely only on workflow HIGH, add a named evidence contract rather than restoring status-as-proof.

## EXACT_NEXT_ACTION

Run on the final exact PR head:

```text
node tests/cii-workspace-adjacent-boundary-review.test.mjs
relevant existing compare-review/confidence/rigid-custody tests
retained S1/S2/S3 -> T browser benchmark
```

Record PASS / FAIL / NOT_RUN truth. Keep PR #1240 draft and unmerged until explicit Owner authorization.
