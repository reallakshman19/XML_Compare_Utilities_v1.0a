# EP-CII-W2-0010 — W2 A external execution capsule ready; verifier pending

CHAIN_ID: CII-WRITER2-RUNTIME-QUALIFICATION
LEG_ID: PR1063-W2A-EXTERNAL-EXECUTION-READINESS
ENDPOINT_ID: EP-CII-W2-0010
PREVIOUS_ENDPOINT: EP-CII-W2-0009

CREATED_AT: 2026-08-28T15:20:00+05:30
ENDPOINT_REASON: READY_FOR_NEXT_EXTERNAL_RUNTIME_ATTEMPT

TASK / ISSUE: Writer2 W2 A exact public runtime execution
PR: #1063 — CII: close Writer2 W2A public runtime dependency graph
BRANCH: agent/cii-writer2-w2a-public-runtime

CHECKPOINT_HEAD: c3cf59271ab585cc5f8b9d040128e3fe8e697080
MAIN_HEAD_OBSERVED: a9018c131be736606e44fd0379545d233238f33e
MERGE_BASE: a9018c131be736606e44fd0379545d233238f33e
MATERIAL_QUALIFICATION_BASIS_HEAD: a9018c131be736606e44fd0379545d233238f33e
ROOT_TREE: 27eb6c81b8b69742e781720b2450714df7c7f74e

STATE: BLOCKED
EXECUTION_MODE: AUTO
AUTO_STATE: EXTERNAL_EXACT_CHECKOUT_REQUIRED
SCOPE_AUTHORITY: READ_ONLY_W2A_RUNTIME_QUALIFICATION
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
COORDINATION_STATE: SAFE

TAKEOVER_QUALIFICATION_QUESTION_SET: CII-W2-QS-0009
TAKEOVER_CANDIDATE_ANSWER: agents/qualifications/CII-WRITER2-RUNTIME-QUALIFICATION/CII-W2-QS-0009-gpt-5-6-sol-answer.md
TAKEOVER_QUALIFICATION_STATUS: ANSWERED_VERIFIER_PENDING
ENGINEERING_CRITICAL_WRITE_AUTHORITY: FALSE
PRODUCTION_PATCH_AUTHORITY: NONE

## Mission and current state

Execute unchanged W2 A through the real public Writer2 route without source reconstruction, workflow bypass, or authority widening. EP8 closed the exact static source graph. EP9 exhausted the currently available exact materialization routes. This leg answers the EP9 takeover questionnaire and prepares one exact external execution capsule so the next environment can produce admissible runtime evidence without interpretation drift.

## This leg completed

- Re-read the updated `engineering-pr-delivery-v2` skill at `Common@10d667ce715bb52e1f73035c6fa326db77d0f9dd` and retained READ_ONLY takeover rules.
- Reconfirmed `deploy.yml` has `workflow_dispatch` and exact-revision checkout, but the connected tool surface exposes no workflow-dispatch operation and no workflow mutation is authorized.
- Corrected the workflow-run audit by querying the GitHub Actions REST collection directly for frozen SHA `a9018c13...`; result is `total_count=0`, so there is genuinely no push/PR workflow run or retained artifact at that commit.
- Confirmed the unchanged public core path from `applyCiiWorkspaceTargetWriter2()` through `applyWriter()`, `currentTargetFor()` canonical target re-intake/hash protection, `applyLowLevelWriter()` RESTRAINT composite dispatch, canonical postimage re-intake and `validateCiiWriter2ProductRoundTrip()`.
- Identified the first authored W2 A assertion after module load: `routedPlan.status === 'PREVIEW_READY'`.
- Answered all five `CII-W2-QS-0009` questions in a candidate-only artifact; no independent verdict exists, so write authority remains false.
- Added `agents/evidence/PR1063_w2a_external_execution_capsule.md` with exact checkout/head/tree/test-blob/worktree checks, raw stdout/stderr capture, exit classification and first-wrong-boundary isolation order.
- Did not alter production, tests, benchmarks, oracles, tolerances or workflows.

## Current blocker

The current runtime still cannot materialize exact repository bytes. The read-only GitHub connector can inspect exact blobs/tree state but cannot expose a complete archive into this execution container, ordinary Git network resolution is unavailable, and there is no retained workflow artifact.

```text
STATIC_SOURCE_GRAPH             CLOSED
EXACT_EXTERNAL_EXECUTION_CAPSULE READY
LOCAL_EXACT_CHECKOUT            UNAVAILABLE
W2_A                            NOT_RUN
FIRST_AUTHORED_PRODUCT_FAILURE  NONE
WRITE_AUTHORITY                 FALSE
```

## Exact next action

In an execution environment with exact GitHub checkout access, execute the command sequence in:

```text
agents/evidence/PR1063_w2a_external_execution_capsule.md
```

The required identities are:

```text
HEAD      = a9018c131be736606e44fd0379545d233238f33e
root tree = 27eb6c81b8b69742e781720b2450714df7c7f74e
W2 A blob = 9922377ddeda86fc9167d65f33c97095346e79fa
```

Then run unchanged:

```text
node tests/cii-workspace-writer2-restraint-product-routing.test.js
```

Preserve stdout, stderr, exit status, pre/post worktree status and identities exactly.

## Classification rule

```text
checkout/network/materialization stop             -> NOT_RUN / environment
module/environment stop before authored assertion -> NOT_RUN / environment
first reached authored assertion/product exception-> FAIL
clean authored exit 0 + expected completion        -> candidate PASS
```

A candidate PASS remains subject to the repository's independent qualification and gate rules.

## Known / proven

- Frozen main remains `a9018c131be736606e44fd0379545d233238f33e` on the material basis.
- Root tree is `27eb6c81b8b69742e781720b2450714df7c7f74e`.
- W2 A entrypoint blob is `9922377ddeda86fc9167d65f33c97095346e79fa`.
- Public core dispatch re-intakes the current target before mutation, verifies its hash against the preview, selects RESTRAINT composite when a RESTRAINT APPLY is present, re-intakes the Writer2 byte postimage, and invokes product validation.
- The first authored W2 A assertion is the routed-plan `PREVIEW_READY` check; failures before that are not authored test failures.
- GitHub Actions REST reports no workflow runs for the frozen SHA.
- No independent verifier verdict currently exists for `CII-W2-QS-0009`.

## Not proven / NOT_RUN

`W2 A`, `BM-W2-01..04 public`, `W2 B`, `W2.35`, `W2.35a`, and `W2.40` remain `NOT_RUN`. `W2 H` remains `NOT_READY`.

No runtime PASS/FAIL is inferred from source closure, candidate qualification answers, or focused PR #1062 family tests.

## Current hypothesis

There is still no demonstrated Writer2 product defect. Exact repository-byte availability is the only blocker to reaching the unchanged authored W2 A runtime in the current execution environment.

## Falsifier

An exact checkout at the frozen material basis loads the unchanged W2 A entrypoint and reaches any authored assertion/product exception. That raw authored outcome supersedes the environment-only hypothesis.

## Protected invariants

- exact HEAD/root-tree/test-blob custody;
- lexical I13 RESTRAINT count/pointer fields;
- exact 24-row RESTRAINT block cardinality and deletion compaction;
- target0 hash custody and canonical postimage re-intake;
- frozen benchmark sources and independent expected values;
- unrelated-byte/topology preservation;
- SIF CREATE remains blocked;
- raw SIF field-2 semantic authority remains bounded;
- Writer1C and Writer3/topology authority boundaries remain unchanged;
- focused PASS is not public PASS;
- candidate self-answer cannot grant engineering-critical write authority;
- no workflow mutation/bypass, tolerance weakening, oracle regeneration or source reconstruction may manufacture W2 A evidence.

## Do not redo

Do not restart static dependency closure, the historical 54-file sparse frontier, or the workflow-artifact search. Do not manually rebuild a subset merely to produce a green runtime.

## Do not change

Do not change production code, authored W2 A test, frozen benchmark/source files, independent oracle values, tolerances, SIF CREATE authority, Writer3/topology or `.github/workflows/**` unless a future authored failure is reached and valid write qualification separately authorizes the smallest necessary correction.

## Expected next-leg files / domains

Read-only execution evidence first. If and only if an authored W2 A failure occurs and engineering-critical write qualification is independently passed, the first-wrong production module plus the narrowest focused falsifier/regression may enter mutation scope.

## Inputs

- `tests/cii-workspace-writer2-restraint-product-routing.test.js`
- `tests/cii-workspace-writer2-composite-restraint-fixture.js`
- `tabs/cii-workspace/cii-workspace-core.js`
- `package.json`
- `agents/evidence/PR1063_w2a_dependency_ledger.md`
- `agents/evidence/PR1063_w2a_static_closure_complete.md`
- `agents/evidence/PR1063_w2a_execution_environment_capability_audit.md`
- `agents/evidence/PR1063_w2a_external_execution_capsule.md`

## Benchmarks

- `Benchmark/CIICompare/Writer2/CII_WRITER2_BENCHMARKS.json`
- BM-W2-01 NODENAME independent structural postimage oracle
- BM-W2-02 SIF independent structural postimage oracle
- BM-W2-03 HANGER independent structural postimage oracle
- BM-W2-04 RESTRAINT independent structural postimage oracle
- focused exact-blob family qualification evidence merged by PR #1062 at its narrower evidence class

## Common / governing documents

- `reallaksh19/Common@10d667ce715bb52e1f73035c6fa326db77d0f9dd/skills/engineering-pr-delivery-v2/SKILL.md`
- `references/relay-model.md`
- `references/agentchain-schema.md`
- `references/qualification.md`
- `references/auto-mode.md`
- `references/git-pr-policy.md`
- `references/source-indexing.md`
- `references/engineering-validation.md`
- `references/anti-gaming-rules.md`
- `references/multi-agent-coordination.md`
- `ciibenchmarkroadmap.md`
- `agents/agentchain.md`

## Authoritative sources

Qualified V11 fixed-format/pointer/cardinality custody only where explicitly qualified. This leg adds no new CAESAR/Fortran semantic authority.

## Production paths

Unchanged:

```text
applyCiiWorkspaceTargetWriter2
 -> applyWriter('2')
 -> currentTargetFor / canonical target re-intake + stale hash gate
 -> adaptCiiDocumentToTopologyGraph
 -> applyLowLevelWriter
 -> applyCiiWriter2CompositeWithRestraintDelete
 -> canonical postimage re-intake
 -> validateCiiWriter2ProductRoundTrip
 -> CIIWorkspaceTargetApplyResult.v1 PASS
```

## Validation / test paths

Primary next runtime gate:

```text
node tests/cii-workspace-writer2-restraint-product-routing.test.js
```

BM-W2-01..04 public only after W2 A candidate PASS.

## Changed during this leg

Relay/evidence/qualification metadata only:

```text
agents/qualifications/CII-WRITER2-RUNTIME-QUALIFICATION/CII-W2-QS-0009-gpt-5-6-sol-answer.md
agents/evidence/PR1063_w2a_external_execution_capsule.md
agents/agentchain/CII-WRITER2-RUNTIME-QUALIFICATION/EP-CII-W2-0010.md
agents/agentchain.md (next index update)
```

No production/test/benchmark/oracle/workflow file changed.

## Validation summary

```text
STATIC_SOURCE_CLOSURE                   PASS_SOURCE_INSPECTION
PUBLIC_CORE_TRACE                       PASS_SOURCE_INSPECTION
FROZEN_SHA_ACTIONS_RUN_QUERY            PASS_ARTIFACT_INSPECTION / ZERO_RUNS
TAKEOVER_QS0009_CANDIDATE_ANSWER        COMPLETE
TAKEOVER_QS0009_INDEPENDENT_VERDICT     NOT_RUN / VERIFIER_UNAVAILABLE
EXTERNAL_EXECUTION_CAPSULE              READY
W2_A_RUNTIME                            NOT_RUN
```

## Open risks / questions

The next runtime must come from an execution substrate with exact repository checkout access. If it reaches an authored failure, production mutation still cannot start until the candidate receives an independent valid takeover verdict on the unchanged material basis.

## Next-agent qualification

QUALIFICATION_BASIS_HEAD: a9018c131be736606e44fd0379545d233238f33e
QUESTION_SET_ID: CII-W2-QS-0010
QUESTION_SET_STATUS: CURRENT

### Q1 — Production Trace

Trace the exact unchanged W2 A public path and identify both the first authored assertion and the public stale-target hash gate. Explain which event changes classification from environment `NOT_RUN` to authored `FAIL`.

### Q2 — Current Unresolved Problem / Failure Isolation

Using the external execution capsule, define the minimum admissible evidence bundle for one W2 A attempt: commit/tree/blob identities, worktree state, stdout/stderr, exit code and post-run state. Explain how to distinguish checkout, module-load, authored-assertion and product-validation failures.

### Q3 — Authority / Invariant

Explain why an authored W2 A FAIL would justify investigation but still would not itself grant production write authority. List the independent-verifier and protected-authority requirements that remain before any patch.

### Q4 — Independent Validation

Independently derive the W2 A RESTRAINT deletion postimage `[1,2,3,0] -> [1,0,2,0]`, CONTROL `3 -> 2`, rows `72 -> 48`, and state the exact unrelated-byte/topology/I13 falsifiers that must accompany a runtime PASS.

### Q5 — Next Contribution / Minimal Patch

Given each possible external outcome (`NOT_RUN` transport, `NOT_RUN` module environment, authored FAIL, candidate PASS), state the exact next repository action and which files/domains must remain untouched.