# EP-CII-W2-0009 — W2 A exact materialization routes exhausted in current environment

CHAIN_ID: CII-WRITER2-RUNTIME-QUALIFICATION
LEG_ID: PR1063-W2A-EXECUTION-ENVIRONMENT-AUDIT
ENDPOINT_ID: EP-CII-W2-0009
PREVIOUS_ENDPOINT: EP-CII-W2-0008

CREATED_AT: 2026-08-28T15:12:00+05:30
ENDPOINT_REASON: BLOCKER_SHARPENED

TASK / ISSUE: Writer2 W2 A exact public runtime execution
PR: #1063 — CII: close Writer2 W2A public runtime dependency graph
BRANCH: agent/cii-writer2-w2a-public-runtime

CHECKPOINT_HEAD: 932e8f803374396ec3e73293b47d619b8779bcc6
MAIN_HEAD_OBSERVED: a9018c131be736606e44fd0379545d233238f33e
MERGE_BASE: a9018c131be736606e44fd0379545d233238f33e
MATERIAL_QUALIFICATION_BASIS_HEAD: a9018c131be736606e44fd0379545d233238f33e

STATE: BLOCKED
EXECUTION_MODE: AUTO
AUTO_STATE: OWNER_ENVIRONMENT_REQUIRED_FOR_EXACT_MATERIALIZATION
SCOPE_AUTHORITY: READ_ONLY_W2A_RUNTIME_QUALIFICATION
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
COORDINATION_STATE: SAFE

ENGINEERING_CRITICAL_WRITE_AUTHORITY: FALSE
PRODUCTION_PATCH_AUTHORITY: NONE

## Mission and current state

Execute unchanged W2 A through the real public Writer2 route without source reconstruction, workflow bypass, or authority widening. EP8 proved the exact static source graph closed. This endpoint proves that the currently available execution/connector capabilities cannot provide an admissible exact repository checkout or archive even though Node and Git themselves are available.

## This leg completed

- Reconfirmed PR #1063 is open, draft and mergeable with base `a9018c131be736606e44fd0379545d233238f33e` and no production/test mutation.
- Confirmed the execution host has Node `v22.16.0` and Git `2.47.3`.
- Confirmed `package.json` is ES-module mode; W2 A can be invoked directly by Node once exact repository bytes are present.
- Queried workflow runs for the frozen material basis; none exist, so no reusable exact workflow artifact exists.
- Attempted exact commit tarball retrieval through the GitHub connector; the connector rejects the archive endpoint before returning bytes.
- Searched for a committed exact W2.13 checkout/bundle; none was found.
- Re-read historical PR1054 evidence: its exact 54-file sparse mirror was ephemeral under `/mnt/data/w217` and is not retained.
- Did not restart sparse/manual reconstruction because EP8 explicitly excludes a manually reconstructed subset as public W2 A PASS evidence.
- Persisted the complete capability audit at `agents/evidence/PR1063_w2a_execution_environment_capability_audit.md`.

## Current blocker

Exact repository-byte materialization, not source closure and not Node runtime availability.

```text
Git checkout                     -> DNS/network unavailable
frozen-commit workflow artifact  -> none
connector tarball/archive        -> unsupported endpoint
committed exact checkout/bundle  -> none found
manual reconstructed subset      -> prohibited as public W2 A evidence
Node runtime                      -> available (v22.16.0)
Git executable                    -> available (2.47.3)
```

No authored W2 A code has executed in this leg.

## Exact classification

```text
STATIC_SOURCE_GRAPH = CLOSED
EXACT_EXECUTABLE_CHECKOUT = UNAVAILABLE_IN_CURRENT_ENVIRONMENT
W2_A = NOT_RUN
FIRST_AUTHORED_PRODUCT_FAILURE = NONE
PRODUCTION_PATCH_AUTHORITY = NONE
```

## Remaining work

1. Obtain an execution environment capable of materializing the exact repository checkout at `a9018c131be736606e44fd0379545d233238f33e` without reconstructing source files.
2. Verify exact HEAD and W2 A test blob `9922377ddeda86fc9167d65f33c97095346e79fa`.
3. Run unchanged `node tests/cii-workspace-writer2-restraint-product-routing.test.js`.
4. Preserve raw stdout/stderr and exit status.
5. If authored W2 A fails, isolate the first wrong production boundary before any surgical patch.
6. If W2 A passes, execute BM-W2-01 through BM-W2-04 public unchanged in order.

## Exact next action

In a runtime with exact private checkout access:

```text
git checkout a9018c131be736606e44fd0379545d233238f33e
verify tests/cii-workspace-writer2-restraint-product-routing.test.js blob = 9922377ddeda86fc9167d65f33c97095346e79fa
node tests/cii-workspace-writer2-restraint-product-routing.test.js
```

Classification rule:

```text
environment/module stop before authored code -> NOT_RUN
first authored assertion/product exception   -> FAIL
clean authored completion                    -> candidate PASS
```

## Known / proven

- Frozen root tree: `27eb6c81b8b69742e781720b2450714df7c7f74e`.
- Exact static W2 A graph is closed per EP8 and `PR1063_w2a_static_closure_complete.md`.
- W2 A entrypoint blob remains `9922377ddeda86fc9167d65f33c97095346e79fa`.
- Local runtime prerequisites Node and Git are present.
- The GitHub connector can read the frozen recursive Git tree and individual source blobs but cannot return the repository tarball/archive through its allowed fetch surface.
- No workflow run exists at the frozen main commit from which an exact archive can be reused.
- Historical PR1054 sparse mirror was temporary and is not retained.

## Not proven / NOT_RUN

`W2 A`, `BM-W2-01..04 public`, `W2 B`, `W2.35`, `W2.35a`, and `W2.40` remain `NOT_RUN`. `W2 H` remains `NOT_READY`.

## Active hypothesis

There is no demonstrated Writer2 product defect. The only active blocker to W2 A is obtaining exact repository bytes in an executable environment.

## Falsifier

An exact checkout at `a9018c131be736606e44fd0379545d233238f33e` successfully loads the unchanged W2 A entrypoint and reaches an authored assertion/product exception. That raw authored result supersedes the environment-only hypothesis.

## Protected invariants

- exact test/blob identity;
- lexical I13 restraint count/pointer custody;
- exact 24-row RESTRAINT block cardinality and compaction;
- frozen benchmark sources and independent expected values;
- focused PASS is not public PASS;
- environment/materialization failure is NOT_RUN;
- SIF CREATE remains blocked;
- raw SIF field-2 authority remains bounded;
- Writer1C custody and Writer3/topology boundaries remain unchanged;
- no workflow/source reconstruction/tolerance/oracle bypass may manufacture W2 A evidence.

## Do not redo

Do not repeat static dependency closure or the historical 54-file sparse frontier. Do not manually rebuild a subset merely to obtain a green test.

## Do not change

Do not change production code, authored W2 A test, frozen benchmark/source files, independent oracle values, tolerances, SIF CREATE authority, Writer3/topology, or `.github/workflows/**` while this environment blocker remains.

## Expected next-leg files / domains

Read-only runtime evidence unless and until the first authored W2 A failure is observed. If that failure occurs, only the first-wrong production module plus a focused falsifier/regression becomes eligible for a bounded patch after valid engineering-critical write qualification.

## Inputs

- `tests/cii-workspace-writer2-restraint-product-routing.test.js`
- `tests/cii-workspace-writer2-composite-restraint-fixture.js`
- `package.json`
- `agents/evidence/PR1063_w2a_dependency_ledger.md`
- `agents/evidence/PR1063_w2a_static_closure_complete.md`
- `agents/evidence/PR1063_w2a_execution_environment_capability_audit.md`

## Benchmarks

- `Benchmark/CIICompare/Writer2/CII_WRITER2_BENCHMARKS.json`
- BM-W2-01 NODENAME independent structural postimage oracle
- BM-W2-02 SIF independent structural postimage oracle
- BM-W2-03 HANGER independent structural postimage oracle
- BM-W2-04 RESTRAINT independent structural postimage oracle
- merged focused exact-blob qualifications from PR #1062 at their narrower evidence class

## Common / governing documents

- `reallaksh19/Common@10d667ce715bb52e1f73035c6fa326db77d0f9dd/skills/engineering-pr-delivery-v2/SKILL.md`
- `relay-model.md`
- `agentchain-schema.md`
- `qualification.md`
- `auto-mode.md`
- `git-pr-policy.md`
- `source-indexing.md`
- `engineering-validation.md`
- `anti-gaming-rules.md`
- `multi-agent-coordination.md`
- `ciibenchmarkroadmap.md`
- `agents/agentchain.md`

## Authoritative sources

Qualified V11 fixed-format/pointer/cardinality custody only where explicitly qualified. No new engineering source authority is created by this environment audit.

## Production paths

Unchanged public core/intake, Writer2 composite RESTRAINT execution, canonical postimage re-intake and product validation paths already source-closed in EP8.

## Validation / test paths

Primary next runtime gate:

```text
node tests/cii-workspace-writer2-restraint-product-routing.test.js
```

BM-W2-01..04 public only after W2 A PASS.

## Changed during this leg

Relay/evidence metadata only:

```text
agents/evidence/PR1063_w2a_execution_environment_capability_audit.md
agents/agentchain/CII-WRITER2-RUNTIME-QUALIFICATION/EP-CII-W2-0009.md
agents/agentchain.md   (next index update)
```

No production/test/benchmark/workflow file is changed.

## Validation summary

```text
STATIC_SOURCE_CLOSURE                PASS_SOURCE_INSPECTION
NODE_RUNTIME_AVAILABLE               PASS_ENVIRONMENT_INSPECTION
GIT_EXECUTABLE_AVAILABLE             PASS_ENVIRONMENT_INSPECTION
EXACT_GIT_NETWORK_MATERIALIZATION    NOT_RUN_ENVIRONMENT_DNS
EXISTING_FROZEN_WORKFLOW_ARTIFACT    NOT_APPLICABLE_NONE_EXISTS
CONNECTOR_TARBALL_MATERIALIZATION    NOT_RUN_CONNECTOR_UNSUPPORTED
COMMITTED_EXACT_CHECKOUT_BUNDLE      NOT_APPLICABLE_NONE_FOUND
W2_A_RUNTIME                         NOT_RUN
```

## Open risks / questions

The next progress requires a different execution substrate or an exact checkout supplied to the runtime. This is now an infrastructure/materialization boundary; further source inspection cannot promote W2 A.

## Next-agent qualification

QUALIFICATION_BASIS_HEAD: a9018c131be736606e44fd0379545d233238f33e
QUESTION_SET_ID: CII-W2-QS-0009
QUESTION_SET_STATUS: CURRENT

### Q1 — Production Trace

Trace the unchanged W2 A public path from its entrypoint blob `9922377d...` through canonical intake, Writer2 RESTRAINT composite execution, postimage re-intake and product validation. Identify the first authored assertion whose execution would distinguish runtime evidence from environment transport evidence.

### Q2 — Current Unresolved Problem / Failure Isolation

Given that Node/Git are available but exact repository-byte transport is not, define the minimum admissible materialization experiment. Explain why a sparse/manual reconstruction, workflow bypass or rewritten import graph cannot convert `NOT_RUN` into PASS.

### Q3 — Authority / Invariant

List the gates and authority boundaries that remain unchanged while W2 A is `NOT_RUN`: BM-W2-01..04 public, W2 B, W2.35/W2.35a/W2.40, W2 H, SIF CREATE, raw SIF field-2 semantics, Writer3/topology, benchmark/oracle/tolerance custody.

### Q4 — Independent Validation

Reconstruct the frozen W2 A RESTRAINT delete postcondition independently: `[1,2,3,0] -> [1,0,2,0]`, CONTROL `3 -> 2`, RESTRANT rows `72 -> 48`, retained-block byte custody, lexical I13 acceptance, topology and unrelated-byte protection. State which evidence remains independent versus implementation-coupled.

### Q5 — Next Contribution / Minimal Patch

If exact checkout becomes available, state the exact verification and command sequence. If an authored assertion fails, identify the first-wrong-boundary method for selecting a minimal patch and rerun order. If exact materialization remains unavailable, state the correct durable classification and what must remain untouched.
