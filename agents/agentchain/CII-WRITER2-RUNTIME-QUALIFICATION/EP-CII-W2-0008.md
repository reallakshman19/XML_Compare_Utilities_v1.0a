# EP-CII-W2-0008 — W2 A source graph closed; executable materialization blocked

CHAIN_ID: CII-WRITER2-RUNTIME-QUALIFICATION
LEG_ID: PR1063-W2A-STATIC-CLOSURE-COMPLETE
ENDPOINT_ID: EP-CII-W2-0008
PREVIOUS_ENDPOINT: EP-CII-W2-0007

CREATED_AT: 2026-08-28T13:50:51+05:30
ENDPOINT_REASON: BLOCKER_SHARPENED

TASK / ISSUE: Writer2 W2 A exact public runtime dependency closure and execution
PR: #1063 — CII: close Writer2 W2A public runtime dependency graph
BRANCH: agent/cii-writer2-w2a-public-runtime

CHECKPOINT_HEAD: 7219079a73e28835657827aa29d07431674a5d85
MAIN_HEAD_OBSERVED: a9018c131be736606e44fd0379545d233238f33e
MERGE_BASE: a9018c131be736606e44fd0379545d233238f33e
MATERIAL_QUALIFICATION_BASIS_HEAD: a9018c131be736606e44fd0379545d233238f33e

STATE: BLOCKED
EXECUTION_MODE: AUTO
AUTO_STATE: BLOCKED_ON_EXECUTABLE_PRIVATE_MATERIALIZATION
SCOPE_AUTHORITY: READ_ONLY_W2A_RUNTIME_QUALIFICATION
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
COORDINATION_STATE: SAFE

TAKEOVER_QUALIFICATION_QUESTION_SET: CII-W2-QS-0007
TAKEOVER_CANDIDATE_ANSWER: agents/qualifications/CII-WRITER2-RUNTIME-QUALIFICATION/CII-W2-QS-0007-gpt-5-6-sol-answer.md
TAKEOVER_QUALIFICATION_STATUS: DEFERRED_VERIFICATION
ENGINEERING_CRITICAL_WRITE_AUTHORITY: FALSE

## Mission and current state

Close Writer2 W2 A through the unchanged public product runtime without widening CREATE/topology authority. The exact repository-source graph is now statically closed at the merged material basis. No authored W2 A assertion or product exception has executed because the runtime environment cannot materialize the private repository tree.

## This leg completed

- Reconciled live PR #1063 against EP-CII-W2-0007: later commits were relay metadata only; no material basis drift.
- Reconfirmed live `main` remains exactly `a9018c131be736606e44fd0379545d233238f33e`.
- Reconfirmed PR #1063 had no reviews, no review threads and no status contexts before this endpoint work.
- Closed core imports #5 through #33 and all observed transitive repository imports for the W2 A public route.
- Closed Writer2 NODENAME, SIF, HANGER and RESTRAINT planner/write branches and all product-validator transitive branches.
- Persisted complete source-closure evidence in `agents/evidence/PR1063_w2a_static_closure_complete.md`.
- Reconstructed the frozen W2 A RESTRAINT compaction independently: `[1,2,3,0] -> [1,0,2,0]`, CONTROL `3 -> 2`, RESTRANT rows `72 -> 48`, lexical I13 pointers, topology/unrelated-byte protection.
- Attempted unchanged repository materialization with `git ls-remote`; environment failed DNS resolution for `github.com` before checkout.
- Persisted candidate takeover answers for `CII-W2-QS-0007`; no independent verifier is available in this leg, so takeover remains READ_ONLY.

## Current blocker

Executable private-repository materialization in the available runtime environment.

Observed local execution probe:

```text
git ls-remote https://github.com/reallaksh19/XML_Compare_Utilities.git refs/heads/main
fatal: unable to access 'https://github.com/reallaksh19/XML_Compare_Utilities.git/': Could not resolve host: github.com
status 128
```

This occurred before repository checkout, Node module load, Writer2 route execution or authored assertions.

## Exact classification

```text
STATIC_SOURCE_GRAPH = CLOSED
W2_A = NOT_RUN
FIRST_AUTHORED_PRODUCT_FAILURE = NONE
PRODUCTION_PATCH_AUTHORITY = NONE
```

Missing/unavailable execution environment remains `NOT_RUN`, never reconstructed PASS and never product FAIL.

## Remaining work

1. Materialize the exact private repository tree at `a9018c131be736606e44fd0379545d233238f33e` in an executable environment without stubs, import rewrites, sparse substitutes or partial-core reconstruction.
2. Run unchanged `node tests/cii-workspace-writer2-restraint-product-routing.test.js`.
3. If W2 A reaches an authored failure, preserve the first raw exception/assertion and isolate the first wrong production boundary before any patch.
4. If W2 A PASS, execute BM-W2-01, BM-W2-02, BM-W2-03 and BM-W2-04 public unchanged.
5. Do not promote W2 B/V14/native/release gates until their explicit prerequisites pass.

## Exact next action

In an execution environment with exact private checkout access, obtain `reallaksh19/XML_Compare_Utilities@a9018c131be736606e44fd0379545d233238f33e`, verify HEAD and the unchanged W2 A test blob `9922377ddeda86fc9167d65f33c97095346e79fa`, then run:

```text
node tests/cii-workspace-writer2-restraint-product-routing.test.js
```

Preserve stdout/stderr and exit status exactly. Module/environment failure before authored code = `NOT_RUN`; first authored assertion/product exception = `FAIL`; clean authored completion = candidate `PASS` subject to the repository's qualification/verification rules.

## Known / proven

- W2 A entrypoint blob `9922377ddeda86fc9167d65f33c97095346e79fa` is unchanged at the material basis.
- Core blob `cee2858a63992648edf5e61b8f63b3837a937f9e` has 33 direct repository imports; all are now source-closed with their observed transitive imports.
- Canonical intake, CAESAR parser fan-out, physical-file, contracts, fixed-field and hanger shared leaves are source-closed.
- RESTRAINT critical path is source-closed through pointer I13 custody `70532305...`, compaction planner `aedfb3ac...`, physical writer `e8a92417...`, independent delete validator `1833d9fe...`, composite validator `919ac88c...` and product validator `05fcb594...`.
- The W2 A frozen fixture starts with restraint pointers `[1,2,3,0]`, three 24-row blocks and deletes pointer 2.
- BM-W2-04 remains a separate retained-real independent structural postimage oracle class and does not replace W2 A public runtime.

## Not proven / NOT_RUN

`W2 A`, `BM-W2-01..04 public`, `W2 B`, `W2.35`, `W2.35a`, and `W2.40` remain `NOT_RUN`. `W2 H` remains `NOT_READY`. No runtime PASS/FAIL inference is permitted from static closure.

## Protected invariants

- lexical I13 restraint count/pointer custody;
- exact 24-row RESTRAINT block cardinality and compaction;
- frozen retained-real benchmark sources and independent expected values;
- focused PASS is not public PASS;
- missing module/environment/transport is NOT_RUN;
- raw SIF field-2 semantics remain non-authoritative outside explicitly qualified uses;
- SIF CREATE remains blocked;
- Writer1C custody and Writer3/topology boundaries remain unchanged;
- no stubs, import rewrites, partial-core substitute, tolerance weakening, regenerated oracle, benchmark mutation or workflow bypass counts as W2 A evidence.

## Do not redo

Do not restart static source closure from core import #1 or the historical 54-file sparse mirror. The exact closure is durable in `agents/evidence/PR1063_w2a_dependency_ledger.md` plus `agents/evidence/PR1063_w2a_static_closure_complete.md`.

## Do not change

Do not change production, frozen benchmark/source files, independent oracle values, raw SIF field-2 authority, SIF CREATE authority, Writer3/topology, tolerances, or `.github/workflows/**` under this blocked read-only leg.

## Inputs

- `tests/cii-workspace-writer2-restraint-product-routing.test.js`
- `tests/cii-workspace-writer2-composite-restraint-fixture.js`
- `agents/evidence/PR1063_w2a_dependency_ledger.md`
- `agents/evidence/PR1063_w2a_static_closure_complete.md`
- `Benchmark/CIICompare/BM_CII_SOURCE.CII`

## Benchmarks

- `Benchmark/CIICompare/Writer2/CII_WRITER2_BENCHMARKS.json`
- BM-W2-01 NODENAME independent structural postimage oracle
- BM-W2-02 SIF independent structural postimage oracle
- BM-W2-03 HANGER independent structural postimage oracle
- BM-W2-04 RESTRAINT independent structural postimage oracle
- merged focused exact-blob family qualifications from PR #1062, retained at their narrower evidence class

## Common / governing documents

- `reallaksh19/Common@10d667ce715bb52e1f73035c6fa326db77d0f9dd/skills/engineering-pr-delivery-v2/SKILL.md`
- pinned `relay-model.md`, `agentchain-schema.md`, `qualification.md`, `auto-mode.md`, `git-pr-policy.md`, `source-indexing.md`, `engineering-validation.md`, `anti-gaming-rules.md`, `multi-agent-coordination.md`
- `ciibenchmarkroadmap.md`
- `agents/agentchain.md`

## Validation summary

SOURCE_CLOSURE = COMPLETE.
LOCAL_EXECUTION = ATTEMPTED, ENVIRONMENT_TRANSPORT_FAILED_BEFORE_REPOSITORY_MATERIALIZATION.
W2_A = NOT_RUN.
No production code or test was modified.

## Open risks / questions

The next execution environment must provide exact private checkout access. A manually reconstructed subset is not equivalent to the public runtime graph and must not be used to claim W2 A PASS. Independent takeover verification for `CII-W2-QS-0007` is also still deferred; this does not block read-only evidence continuation but forbids engineering-critical write authority.

## Next-agent qualification

QUALIFICATION_BASIS_HEAD: a9018c131be736606e44fd0379545d233238f33e
QUESTION_SET_ID: CII-W2-QS-0008
QUESTION_SET_STATUS: CURRENT

### Q1 — Production Trace

From the unchanged W2 A test, trace the exact public path through core canonical re-intake, Writer2 RESTRAINT composite execution, postimage re-intake and product validation. Explain why the now-complete static graph still does not constitute runtime evidence.

### Q2 — Current Unresolved Problem / Failure Isolation

Given the observed DNS/materialization failure, define the minimum exact experiment that distinguishes another environment/transport `NOT_RUN` from the first authored W2 A `FAIL`. State the prediction and falsifier before execution.

### Q3 — Authority / Invariant

Explain which W2 A/BM/W2 B/V14/native/release gates remain unqualified and why neither static closure nor focused PR #1062 PASS grants SIF CREATE, Writer3/topology, tolerance/oracle changes, benchmark mutation or workflow bypass authority.

### Q4 — Independent Validation

Reconstruct independently the W2 A RESTRAINT pointer/count/cardinality postimage from `[1,2,3,0]` deleting pointer 2. Define lexical I13 acceptance/rejection, exact 24-row compaction, topology preservation and unrelated-byte negative assurance. Distinguish implementation testimony from independent benchmark oracle evidence.

### Q5 — Next Contribution / Minimal Patch

If exact private materialization succeeds, state the precise unchanged command and evidence to retain. If the first authored failure occurs, identify how to choose the smallest first-wrong patch and rerun order. If materialization still fails, state what durable evidence must be added while production remains unchanged.
