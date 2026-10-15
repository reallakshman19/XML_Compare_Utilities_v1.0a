# CII-W2-QS-0007 — incoming candidate answer

CHAIN_ID: CII-WRITER2-RUNTIME-QUALIFICATION
ENDPOINT_ID: EP-CII-W2-0007
QUESTION_SET_ID: CII-W2-QS-0007
QUALIFICATION_BASIS_HEAD: a9018c131be736606e44fd0379545d233238f33e
CANDIDATE_ID: GPT-5.6-SOL-PR1063-TAKEOVER
LIVE_PR_HEAD_OBSERVED: b7e415906c64f97c7b8a2ad4a31dd09cf42cfc0b
LIVE_MAIN_HEAD_OBSERVED: a9018c131be736606e44fd0379545d233238f33e
RECONCILIATION: METADATA_DRIFT
QUALIFICATION_STATUS: DEFERRED_VERIFICATION
TAKEOVER_AUTHORITY: READ_ONLY

## Q1 — Production Trace

The unchanged W2 A entrypoint is `tests/cii-workspace-writer2-restraint-product-routing.test.js`, Git blob `9922377ddeda86fc9167d65f33c97095346e79fa`. Its six direct repository imports are:

1. `tabs/cii-workspace/cii-workspace-core.js`
2. `tabs/cii-workspace/cii-workspace-writer2-composite-routing.js`
3. `tabs/cii-workspace/cii-workspace-writer2-composite-restraint.js`
4. `tabs/cii-workspace/cii-workspace-writer2-product-validation.js`
5. `tabs/cii-workspace/cii-workspace-writer2-restraint-delete-compaction-plan.js`
6. `tests/cii-workspace-writer2-composite-restraint-fixture.js`

The route-essential Writer2 RESTRAINT sequence is:

`W2 A test -> applyCiiWriter2CompositePlanContract() -> ciiWriter2CompositeReadiness() -> applyCiiWriter2CompositeWithRestraintDelete() -> postimage re-intake -> validateCiiWriter2ProductRoundTrip()`.

The public path additionally enters `applyCiiWorkspaceTargetWriter2()` in `cii-workspace-core.js`, re-intakes the caller target bytes, checks the bound target hash, dispatches the Writer2 composite RESTRAINT transaction, re-intakes the returned postimage, and calls the product validator. The public core has 33 direct repository imports before the route can execute. At the material basis all 33 direct imports and their observed transitive repository imports have now been source-closed exactly. There is no remaining unclosed repository module; the first unresolved boundary is executable materialization of the private repository in the runtime environment.

## Q2 — Current Unresolved Problem / Failure Isolation

The minimum isolating experiment after static closure was an unchanged repository materialization probe:

`git ls-remote https://github.com/reallaksh19/XML_Compare_Utilities.git refs/heads/main`

Observed result:

`fatal: unable to access ... Could not resolve host: github.com`

This failure occurs before checkout, Node module loading, Writer2 routing, or any authored W2 A assertion. Classification is therefore `NOT_RUN`, not `FAIL`.

Prediction: in an execution environment that can materialize the exact private tree at `a9018c131be736606e44fd0379545d233238f33e`, the unchanged command must reach the authored W2 A test. The first authored assertion/product exception, if any, is the falsifier for the current transport-only hypothesis and must be preserved raw before any production repair.

First wrong boundary currently observed: external repository transport/materialization, before product code.

## Q3 — Authority / Invariant

Authoritative current material basis is merged `main` at `a9018c131be736606e44fd0379545d233238f33e`; live main remains exactly that SHA. PR #1063 is documentation/evidence-only so far and contains no authorized production mutation.

The following remain protected:

- W2 A is `NOT_RUN`; static source closure is not runtime evidence.
- BM-W2-01..04 public remain `NOT_RUN`; focused PASS evidence from PR #1062 does not promote public runtime.
- W2 B, W2.35, W2.35a and W2.40 remain `NOT_RUN`; W2 H remains `NOT_READY`.
- SIF CREATE remains blocked by unresolved V11 complete payload semantics/items 27..30.
- Writer1C physical-custody boundaries and Writer3/topology exclusions remain unchanged.
- benchmark/oracle expected values and tolerances may not be weakened or regenerated from production output.
- `.github/workflows/**` is outside the authorized leg and cannot be used as a bypass for unavailable runtime evidence.

Invalid shortcut: treating a complete static import graph or the merged focused qualification as W2 A PASS. Neither executes the public route.

## Q4 — Independent Validation

For the frozen W2 A synthetic fixture, the starting RESTRAINT pointer vector is `[1,2,3,0]` across the four elements and the CONTROL restraint-block count is `3`. Each block is exactly 24 rows, so the RESTRANT section has `3 x 24 = 72` rows.

Deleting pointer 2 must compact retained blocks 1 and 3 without changing their internal bytes:

- old pointer 1 -> new pointer 1;
- deleted old pointer 2 -> new pointer 0;
- old pointer 3 -> new pointer 2;
- existing zero pointer remains zero.

Therefore the expected element pointer vector is `[1,0,2,0]`, CONTROL count is `2`, and RESTRANT section cardinality is `2 x 24 = 48` rows. Pointer fields are physical 13-character `I13` integer fields; valid postimages are lexical decimal integers padded to width 13, not `G13.6` forms such as `2.000000` or exponent notation.

The parsed element set and endpoints must remain unchanged: `(10,20)`, `(30,40)`, `(50,60)`, `(70,80)`. NODENAME, SIF/TEE, HANGER and unrelated bytes are outside this one-family mutation and must remain byte-identical except for independently authorized CONTROL/pointer/RESTRANT-section replacement spans.

Evidence classes:

- the arithmetic above is an independent reconstruction from the frozen fixture shape and fixed-format custody rules;
- `cii-workspace-writer2-restraint-delete-validation.js` and the product validator are implementation-side validation testimony, not an independent external oracle;
- the retained-real BM-W2-04 benchmark has an `INDEPENDENT_STRUCTURAL_POSTIMAGE` oracle and independently constrains the same 24-row/I13 compaction rules, but it does not replace the required W2 A synthetic public runtime execution.

## Q5 — Next Contribution / Minimal Patch

No production patch is currently legitimate because no authored product failure has been observed.

The smallest next contribution is runtime evidence only: materialize the exact private repository tree at `a9018c131be736606e44fd0379545d233238f33e` in an executable environment, with no stubs/import rewrites/partial-core substitutes, and execute the unchanged `tests/cii-workspace-writer2-restraint-product-routing.test.js`.

If the exact graph reaches an authored failure, preserve the raw first exception/assertion, identify the first wrong production boundary, and patch only that module plus the narrowest focused falsifier/regression. Then rerun W2 A unchanged. Only after W2 A PASS should BM-W2-01..04 public be executed unchanged.

If execution remains blocked by environment/transport, production stays unchanged and the relay must record the exact failed materialization command, observation class, and `NOT_RUN` state.

## Candidate conclusion

The repository source graph for W2 A is now statically closed at the frozen material basis. The current blocker is executable private-repository materialization, not a demonstrated Writer2 defect. This candidate does not self-authorize production mutation; an independent verifier is still required before any engineering-critical write authority could be granted.