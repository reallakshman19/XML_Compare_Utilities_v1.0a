# EP-CII-W2-0011 — W2 A all in-platform exact-materialization routes exhausted

CHAIN_ID: CII-WRITER2-RUNTIME-QUALIFICATION
LEG_ID: PR1063-W2A-MATERIALIZATION-ROUTE-EXHAUSTION
ENDPOINT_ID: EP-CII-W2-0011
PREVIOUS_ENDPOINT: EP-CII-W2-0010

CREATED_AT: 2026-08-28T16:43:00+05:30
ENDPOINT_REASON: BLOCKER_SHARPENED

TASK / ISSUE: Writer2 W2 A exact public runtime execution
PR: #1063 — CII: close Writer2 W2A public runtime dependency graph
BRANCH: agent/cii-writer2-w2a-public-runtime

CHECKPOINT_HEAD: 05ff6aef413ca18934a0dc698e6e86fa1d6308af
MAIN_HEAD_OBSERVED: a9018c131be736606e44fd0379545d233238f33e
MERGE_BASE: a9018c131be736606e44fd0379545d233238f33e
MATERIAL_QUALIFICATION_BASIS_HEAD: a9018c131be736606e44fd0379545d233238f33e
ROOT_TREE: 27eb6c81b8b69742e781720b2450714df7c7f74e
W2_A_TEST_BLOB: 9922377ddeda86fc9167d65f33c97095346e79fa

STATE: BLOCKED
EXECUTION_MODE: AUTO
AUTO_STATE: EXTERNAL_EXACT_CHECKOUT_REQUIRED
SCOPE_AUTHORITY: READ_ONLY_W2A_RUNTIME_QUALIFICATION
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
COORDINATION_STATE: SAFE

TAKEOVER_QUALIFICATION_QUESTION_SET: CII-W2-QS-0009
TAKEOVER_QUALIFICATION_STATUS: ANSWERED_VERIFIER_PENDING
ENGINEERING_CRITICAL_WRITE_AUTHORITY: FALSE
PRODUCTION_PATCH_AUTHORITY: NONE

## Mission and current state

Execute unchanged W2 A through the real public Writer2 route on the exact frozen repository without reconstruction, workflow bypass, or authority widening. EP10 prepared the exact external execution capsule. This endpoint records that the remaining in-platform materialization routes have now also been tested and exhausted.

## This leg completed

- Reconfirmed live PR #1063 remained open, draft and mergeable at head `1e95386cd04b6644594e86db72f297f4d522bd7e` before this leg, still based on frozen main `a9018c131be736606e44fd0379545d233238f33e`.
- Tested the separate container download primitive against the exact frozen commit archive. It could not deliver bytes because its URL-safety/view gate was not satisfiable for the archive URL in this environment.
- Searched the persistent ChatGPT Library for a retained full repository archive/checkout/bundle or executable W2.13/W217/W218 mirror. No such artifact was found.
- Persisted the route audit at `agents/evidence/PR1063_w2a_materialization_route_exhaustion.md`.
- Did not execute W2 A because no admissible exact checkout was materialized.
- Did not mutate production, authored tests, benchmarks, oracles, tolerances or workflows.

## Current blocker

Exact repository-byte materialization is unavailable on every accessible in-platform route tested so far.

```text
STATIC_SOURCE_GRAPH                   CLOSED
EXTERNAL_EXECUTION_CAPSULE            READY
ORDINARY_GIT_NETWORK                  UNAVAILABLE_DNS
GITHUB_CONNECTOR_ARCHIVE              UNSUPPORTED
GITHUB_ACTIONS_ARTIFACT_AT_FROZEN_SHA NONE
COMMITTED_EXACT_BUNDLE                NONE_FOUND
PERSISTENT_LIBRARY_EXACT_SNAPSHOT     NONE_FOUND
CONTAINER_ARCHIVE_DOWNLOAD            BLOCKED_BY_TOOL_TRANSPORT_POLICY
W2_A                                  NOT_RUN
FIRST_AUTHORED_PRODUCT_FAILURE        NONE
```

## Exact next action

Use an execution substrate that can materialize the exact checkout at:

```text
a9018c131be736606e44fd0379545d233238f33e
```

Then execute the unchanged command sequence in:

```text
agents/evidence/PR1063_w2a_external_execution_capsule.md
```

Required identities:

```text
HEAD      = a9018c131be736606e44fd0379545d233238f33e
root tree = 27eb6c81b8b69742e781720b2450714df7c7f74e
W2 A blob = 9922377ddeda86fc9167d65f33c97095346e79fa
```

Primary authored command:

```text
node tests/cii-workspace-writer2-restraint-product-routing.test.js
```

## Classification rule

```text
checkout/network/materialization stop              -> NOT_RUN / environment
module/environment stop before authored assertion  -> NOT_RUN / environment
first reached authored assertion/product exception -> FAIL
clean authored exit 0 + expected completion         -> candidate PASS
```

## Known / proven

- Frozen material basis, root tree and W2 A entrypoint blob identities are known.
- Exact static W2 A dependency closure is complete.
- Public Writer2 core trace is source-closed through canonical preimage re-intake/hash custody, RESTRAINT composite dispatch, canonical postimage re-intake and product validation.
- The first authored W2 A assertion after successful module load is `routedPlan.status === 'PREVIEW_READY'`.
- No GitHub Actions run/artifact exists at the frozen SHA.
- No committed or Library-retained exact checkout/bundle has been found.
- No authored W2 A assertion has executed in the current environment.

## Not proven / NOT_RUN

`W2 A`, `BM-W2-01..04 public`, `W2 B`, `W2.35`, `W2.35a`, and `W2.40` remain `NOT_RUN`. `W2 H` remains `NOT_READY`.

No product PASS/FAIL is inferred from source closure, environment probes, candidate qualification answers or focused PR #1062 tests.

## Current hypothesis

There is still no demonstrated Writer2 product defect. Exact repository-byte materialization remains the only blocker before the unchanged authored W2 A test can decide the next engineering branch.

## Falsifier

An exact checkout successfully loads the unchanged W2 A entrypoint and reaches an authored assertion/product exception. That raw authored result supersedes the environment-only hypothesis.

## Protected invariants

- exact HEAD/root-tree/test-blob custody;
- lexical I13 RESTRAINT count/pointer fields;
- exact 24-row RESTRAINT block cardinality/deletion compaction;
- canonical preimage/postimage re-intake and stale-target hash protection;
- frozen benchmark sources and independent expected values;
- unrelated-byte/topology preservation;
- SIF CREATE remains blocked;
- raw SIF field-2 semantic authority remains bounded;
- Writer1C and Writer3/topology authority boundaries remain unchanged;
- focused PASS is not public PASS;
- candidate self-answer cannot grant engineering-critical write authority;
- no source reconstruction, workflow bypass, tolerance weakening or oracle regeneration may manufacture evidence.

## Do not redo

Do not repeat static dependency closure, GitHub Actions artifact search, historical sparse-mirror search, persistent Library search, or archive transport probes in this same execution environment unless the available tool capability changes.

## Do not change

Do not change production code, authored W2 A test, frozen benchmark/source files, independent oracle values, tolerances, SIF CREATE authority, Writer3/topology, or `.github/workflows/**` while W2 A remains environment-blocked.

## Expected next-leg files / domains

Read-only runtime evidence first. Only after the first authored W2 A failure and an independent qualification granting write authority may the first-wrong production module and its narrow falsifier/regression enter mutation scope.

## Inputs

- `tests/cii-workspace-writer2-restraint-product-routing.test.js`
- `tests/cii-workspace-writer2-composite-restraint-fixture.js`
- `tabs/cii-workspace/cii-workspace-core.js`
- `package.json`
- `agents/evidence/PR1063_w2a_external_execution_capsule.md`
- `agents/evidence/PR1063_w2a_materialization_route_exhaustion.md`

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
- `agents/agentchain.md`

## Authoritative sources

Only already-qualified V11 fixed-format/pointer/cardinality custody. This environment audit creates no new engineering source authority.

## Production paths

Unchanged public core/intake, Writer2 RESTRAINT composite execution, canonical postimage re-intake and product validation paths previously source-closed.

## Validation / test paths

Primary next runtime gate:

```text
node tests/cii-workspace-writer2-restraint-product-routing.test.js
```

BM-W2-01..04 public only after W2 A candidate PASS and applicable qualification rules.

## Changed during this leg

Relay/evidence metadata only:

```text
agents/evidence/PR1063_w2a_materialization_route_exhaustion.md
agents/agentchain/CII-WRITER2-RUNTIME-QUALIFICATION/EP-CII-W2-0011.md
agents/agentchain.md   (next index update)
```

No production/test/benchmark/oracle/workflow file is changed.

## Validation summary

```text
STATIC_SOURCE_CLOSURE                 PASS_SOURCE_INSPECTION
EXTERNAL_EXECUTION_CAPSULE            PASS_ARTIFACT_INSPECTION
CONTAINER_ARCHIVE_MATERIALIZATION     NOT_RUN_TOOL_TRANSPORT_POLICY
PERSISTENT_LIBRARY_EXACT_SNAPSHOT     NOT_APPLICABLE_NONE_FOUND
W2_A_RUNTIME                          NOT_RUN
```

## Open risks / questions

No in-platform exact checkout source remains known. Progress requires a new execution substrate or newly supplied exact repository artifact. Until then, further source inspection cannot promote W2 A.

## Next-agent qualification

QUALIFICATION_BASIS_HEAD: a9018c131be736606e44fd0379545d233238f33e
QUESTION_SET_ID: CII-W2-QS-0011
QUESTION_SET_STATUS: CURRENT

### Q1 — Production Trace

Trace the exact W2 A public path from the frozen test entrypoint through `currentTargetFor()`, RESTRAINT composite dispatch, postimage canonical re-intake and `validateCiiWriter2ProductRoundTrip()`. Name the first authored assertion and explain why all materialization failures before module load remain `NOT_RUN`.

### Q2 — Current Unresolved Problem / Failure Isolation

Given that all currently accessible exact-materialization routes are exhausted, define the minimum evidence an external exact-checkout run must retain to distinguish environment `NOT_RUN`, authored `FAIL`, and candidate `PASS` without interpretation drift.

### Q3 — Authority / Invariant

State every authority boundary that remains frozen while W2 A is `NOT_RUN`: public BM-W2-01..04, W2 B/W2.35/W2.35a/W2.40, W2 H, SIF CREATE, raw SIF field-2 semantics, Writer1C custody, Writer3/topology, benchmark/oracle/tolerance/workflow custody.

### Q4 — Independent Validation

Independently reconstruct the RESTRAINT delete postcondition `[1,2,3,0] -> [1,0,2,0]`, CONTROL `3 -> 2`, rows `72 -> 48`, retained-block byte identity and lexical I13 requirement, and explain which parts are independent of production implementation.

### Q5 — Next Contribution / Minimal Patch

If an exact external run reaches an authored failure, specify the first-wrong-boundary isolation order and the prerequisites for engineering-critical write authority before any patch. If the run passes, specify the next public benchmark order. If exact materialization remains unavailable, state what must remain unchanged.
