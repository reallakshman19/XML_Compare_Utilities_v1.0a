# EP-CII-W2-0007 — W2 A static frontier sharpened after intake closure

CHAIN_ID: CII-WRITER2-RUNTIME-QUALIFICATION
LEG_ID: PR1063-W2A-STATIC-CLOSURE
ENDPOINT_ID: EP-CII-W2-0007
PREVIOUS_ENDPOINT: EP-CII-W2-0006

CREATED_AT: 2026-08-28T12:24:00+05:30
ENDPOINT_REASON: BLOCKER_SHARPENED

TASK / ISSUE: Writer2 W2 A exact public runtime dependency closure
PR: #1063 — CII: close Writer2 W2A public runtime dependency graph
BRANCH: agent/cii-writer2-w2a-public-runtime

CHECKPOINT_HEAD: bb545197ec84b58dd849603190c422fd5c1f42a9
MAIN_HEAD_OBSERVED: a9018c131be736606e44fd0379545d233238f33e
MERGE_BASE: a9018c131be736606e44fd0379545d233238f33e
MATERIAL_QUALIFICATION_BASIS_HEAD: a9018c131be736606e44fd0379545d233238f33e

STATE: BLOCKED
EXECUTION_MODE: AUTO
AUTO_STATE: BLOCKED_ON_COMPLETE_EXACT_GRAPH
SCOPE_AUTHORITY: READ_ONLY_W2A_DEPENDENCY_CLOSURE
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
COORDINATION_STATE: SAFE

### Mission and current state

Continue exact static closure of the unchanged W2 A public runtime graph. The retained-real benchmark/focused-runtime leg is already merged; this successor PR must not mutate production until a complete exact graph reaches the first authored assertion or product exception.

### This leg completed

- Persisted `agents/evidence/PR1063_w2a_dependency_ledger.md` at commit `bb545197...`.
- Re-pinned unchanged W2 A test blob `9922377d...` and its six direct repository imports.
- Re-pinned the public Writer2 call path through `cii-workspace-core.js`, canonical target re-intake, RESTRAINT composite mutation, postimage re-intake, and Writer2 product validation.
- Closed canonical intake source fan-out completely.
- Closed the direct CAESAR parser fan-out completely, including statically loaded XML/PDF branches.
- Closed the historical `cii-workspace-auxiliary.js` frontier and proved it has only fixed-field + contracts dependencies.
- Closed core imports #1 contracts, #2 intake, #3 topology adapter, and #4 geometry.

### Currently in progress

Read-only core static-import closure in deterministic import order.

### Remaining work

1. Close core import #5 `tabs/cii-workspace/cii-workspace-multi-base-anchor.js` and its exact transitive imports.
2. Continue core imports #6 through #33, plus any unresolved direct Writer2 route transitive dependencies.
3. Materialize the complete exact graph without stubs/import rewrites/partial-core substitutes.
4. Execute unchanged W2 A.
5. If W2 A PASS, execute BM-W2-01..04 public unchanged before composites or V14/native gates.

### Exact next action

Fetch `tabs/cii-workspace/cii-workspace-multi-base-anchor.js` from material basis `a9018c131be736606e44fd0379545d233238f33e`, verify its Git blob against the pinned recursive tree, enumerate its static imports, close that branch exactly, and continue core import order.

### Known / proven

- `W2 A` test blob: `9922377ddeda86fc9167d65f33c97095346e79fa`.
- core blob: `cee2858a63992648edf5e61b8f63b3837a937f9e` with 33 direct repository imports.
- intake blob: `3939ff6866191bca0ccf6d27264ecd1f2549ddd5`; its direct fan-out is now source-closed.
- `cii-workspace-auxiliary.js` blob `7459677e...` imports only fixed-field `485daa43...` and contracts `6ab30d8d...`.
- CAESAR parser blob `46b921c6...`; all eight direct parser modules and their observed leaves are source-pinned.
- geometry blob `d2b7094d...` imports contracts only.
- No authored W2 A assertion/product exception has been observed.

### Not proven / NOT_RUN

`W2 A`, `BM-W2-01..04 public`, `W2 B`, `W2.35`, `W2.35a`, and `W2.40` remain NOT_RUN. `W2 H` remains NOT_READY. Static source closure is not runtime evidence.

### Current hypothesis

The only demonstrated W2 A blocker remains complete exact graph materialization caused chiefly by monolithic module-load fan-out, not the RESTRAINT transaction itself.

### Falsifier

A complete exact graph loads the unchanged W2 A test and reaches the first authored assertion/product exception. Preserve that raw failure before any production patch.

### Protected invariants

- lexical I13 count/pointer custody;
- frozen retained-real benchmark source and independent expected values;
- focused PASS is not public PASS;
- missing module/environment is NOT_RUN;
- SIF CREATE remains blocked;
- Writer1C custody and Writer3/topology boundaries remain unchanged;
- no workflow or converter bypass is valid qualification evidence.

### Do not redo

Do not restart source closure from the lost 54-file sparse mirror. Use the durable exact ledger. Do not reopen the NODENAME REAL-vs-I13 diagnosis absent contradictory authored evidence.

### Do not change

Do not change production, `Benchmark/CIICompare/BM_CII_SOURCE.CII`, independent oracle values, raw SIF field-2 semantics, SIF CREATE authority, Writer3/topology, or `.github/workflows/**` under the current read-only leg.

### Expected next-leg files / domains

Read-only GitHub source inspection. Update the dependency ledger and relay metadata as frontiers move. Production/test changes are permitted only after first authored public failure and then only at the first-wrong boundary plus focused falsifier/regression.

### Inputs

- `tests/cii-workspace-writer2-restraint-product-routing.test.js`.
- `Benchmark/CIICompare/BM_CII_SOURCE.CII`.
- `agents/evidence/PR1063_w2a_dependency_ledger.md`.
- PR1054 sparse-mirror historical records.

### Benchmarks

Merged Writer2 benchmark registry and independent NODENAME/SIF/HANGER/RESTRAINT oracles from PR #1062.

### Common / governing documents

- `reallaksh19/Common@10d667ce715bb52e1f73035c6fa326db77d0f9dd/skills/engineering-pr-delivery-v2/SKILL.md`.
- pinned relay-model, agentchain-schema, auto-mode and git-pr-policy references.
- `ciibenchmarkroadmap.md` on merged main.
- `agents/agentchain.md`.

### Authoritative sources

Qualified CAESAR V11 fixed-format physical/cardinality custody only where explicitly qualified; raw SIF field-2 and SIF CREATE construction semantics remain unresolved.

### Production paths

Public core/intake, Writer2 composite routing/restraint, product validation, and the static core fan-out recorded in the dependency ledger.

### Validation / test paths

Unchanged W2 A public test first; BM-W2-01..04 public only after W2 A PASS; focused tests remain lower evidence class.

### Changed this leg

`agents/evidence/PR1063_w2a_dependency_ledger.md` plus relay metadata only. Material qualification basis remains merged main `a9018c13...`.

### Validation summary

SOURCE_INSPECTION_ONLY. Canonical intake + direct CAESAR parser + core imports #1-#4 source-closed. W2 A runtime remains NOT_RUN.

### Open risks / questions

The remaining core module fan-out is still large. Exact private checkout is unavailable to the execution container. A static closure may become complete without creating an executable filesystem; that outcome must remain NOT_RUN rather than reconstructed PASS.

### Next-agent qualification

QUALIFICATION_BASIS_HEAD: a9018c131be736606e44fd0379545d233238f33e
QUESTION_SET_ID: CII-W2-QS-0007
QUESTION_SET_STATUS: CURRENT

#### Q1 — Production Trace
From the unchanged W2 A test, distinguish the six direct test imports, the route-essential Writer2 RESTRAINT transaction, and the 33-module static core fan-out. Trace canonical re-intake and product validation and identify the current first unclosed module.

#### Q2 — Current Unresolved Problem / Failure Isolation
Close `cii-workspace-multi-base-anchor.js` exactly, enumerate every new transitive import, and state whether the resulting stop is module materialization (NOT_RUN) or the first authored product failure (FAIL).

#### Q3 — Authority / Invariant
Explain why source closure and the #1062 merge cannot promote W2 A/public/V14/native gates or authorize production mutation, SIF CREATE, Writer3/topology, tolerance weakening, or workflow bypass.

#### Q4 — Independent Validation
Independently reconstruct the W2 A RESTRAINT delete postconditions: CONTROL count, 24-row compaction, pointer relocation, lexical I13 syntax, unchanged topology and unrelated-byte protection; identify which evidence is independent oracle versus implementation testimony.

#### Q5 — Next Contribution / Minimal Patch
If a complete exact graph reaches an authored failure, define the smallest first-wrong production patch and required focused/public reruns. If closure remains transport-only, define the exact new ledger/frontier evidence to persist while leaving production unchanged.
