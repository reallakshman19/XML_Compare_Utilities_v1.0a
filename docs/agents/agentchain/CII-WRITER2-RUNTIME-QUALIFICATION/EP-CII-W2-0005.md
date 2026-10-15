# EP-CII-W2-0005 — post-merge successor-leg start

CHAIN_ID: CII-WRITER2-RUNTIME-QUALIFICATION
LEG_ID: W2A-PUBLIC-RUNTIME-SUCCESSOR
ENDPOINT_ID: EP-CII-W2-0005
PREVIOUS_ENDPOINT: EP-CII-W2-0004

CREATED_AT: 2026-08-28T12:12:00+05:30
ENDPOINT_REASON: AFTER_PR_TRANSITION

TASK / ISSUE: Writer2 public runtime and retained-real benchmark qualification
PREDECESSOR_PR: #1062 — squash merged
PREDECESSOR_MERGE_SHA: a9018c131be736606e44fd0379545d233238f33e
PR: PENDING
BRANCH: agent/cii-writer2-w2a-public-runtime

CHECKPOINT_HEAD: a9018c131be736606e44fd0379545d233238f33e
MAIN_HEAD_OBSERVED: a9018c131be736606e44fd0379545d233238f33e
MERGE_BASE: a9018c131be736606e44fd0379545d233238f33e
MATERIAL_QUALIFICATION_BASIS_HEAD: a9018c131be736606e44fd0379545d233238f33e

STATE: BLOCKED
EXECUTION_MODE: AUTO
AUTO_STATE: BLOCKED_ON_EXACT_PUBLIC_GRAPH_MATERIALIZATION
SCOPE_AUTHORITY: READ_ONLY_W2A_DEPENDENCY_CLOSURE
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
COORDINATION_STATE: SAFE

### Mission and current state

Continue the same Writer2 qualification chain after PR #1062 merge. The next leg is not benchmark authoring: it is exact public W2 A dependency closure and unchanged execution. Focused family PASS remains inherited evidence only; public and V14/native gates remain NOT_RUN.

### Completed / current / remaining

Completed: PR #1062 squash merged at `a9018c131be736606e44fd0379545d233238f33e`; its merge message explicitly preserves W2 A, BM-W2-01..04 public, W2 B, W2.35, W2.35a and W2.40 as NOT_RUN. Successor branch was created from that exact main SHA.

Current: no production mutation. Read-only exact dependency closure for `tests/cii-workspace-writer2-restraint-product-routing.test.js`.

Remaining: materialize/reconstruct the complete static ESM graph, execute the unchanged W2 A test, classify any missing module/environment stop as NOT_RUN, and only if authored execution is reached use the first assertion/product exception as FAIL evidence. After W2 A PASS, execute BM-W2-01..04 public unchanged before any composite or V14 promotion.

### Exact next action

Trace and pin the complete static import closure reachable from the unchanged W2 A test at merge SHA `a9018c131be736606e44fd0379545d233238f33e`, starting with the public core/intake/composite route already identified in EP-CII-W2-0002; identify the first still-unpinned repository module and preserve its Git blob before attempting any runtime reconstruction.

### Known / proven

- PR #1062 merged successfully at `a9018c131be736606e44fd0379545d233238f33e`.
- Frozen BM source remains unchanged.
- Focused exact runtime PASS exists for NODENAME, SIF DELETE, HANGER DELETE-ALL and RESTRAINT compaction.
- W2 A has not executed on a complete exact graph.
- Historical sparse mirror reached 54 exact JS files and stopped during dependency closure without authored failure.
- `cii-workspace-auxiliary.js` itself has only two static imports: `parser/fixed-field.js` and `cii-workspace-contracts.js`.

### Not proven / NOT_RUN

| Gate | Status | Reason |
|---|---|---|
| W2 A | NOT_RUN | complete exact public graph not materialized |
| BM-W2-01 public | NOT_RUN | W2 A prerequisite not closed |
| BM-W2-02 public | NOT_RUN | W2 A prerequisite not closed |
| BM-W2-03 public | NOT_RUN | W2 A prerequisite not closed |
| BM-W2-04 public | NOT_RUN | W2 A prerequisite not closed |
| W2 B | NOT_RUN | retained-real public prerequisite not closed |
| W2.35 | NOT_RUN | prerequisite gates not closed |
| W2.35a | NOT_RUN | prerequisite gates not closed |
| W2.40 | NOT_RUN | native V14 qualification unavailable |
| W2 H | NOT_READY | prerequisite qualification incomplete |

### Current hypothesis and falsifier

Hypothesis: W2 A is blocked by exact private module materialization rather than a demonstrated Writer2 product defect. Falsifier: the unchanged W2 A entrypoint loads on a complete exact graph and reaches an authored assertion or product exception. Preserve the first raw failure before any patch.

### Protected invariants / do not redo / do not change

Protect lexical I13 counts/pointers, frozen benchmark input, independent oracle values, focused-vs-public evidence separation, SIF CREATE blocker, Writer1C custody boundary and Writer3/topology exclusion. Do not use stubs, import rewrites, partial-core substitutes, reconstructed entrypoints, lossy converter paths, or workflow output as a substitute for exact public runtime. Do not change `.github/workflows/**` without explicit authority.

### Expected next-leg files / domains

Read-only source/graph inspection initially. If an authored public failure is reached, expected material scope is one first-wrong Writer2 production module, one focused regression/falsifier, and relay/status records. No benchmark/source/oracle edits are authorized by this endpoint.

### Inputs

- `Benchmark/CIICompare/BM_CII_SOURCE.CII` — frozen retained-real V11 input.
- `tests/cii-workspace-writer2-restraint-product-routing.test.js` — unchanged W2 A public synthetic runtime gate.
- PR1054 historical workreport/status/claims — sparse-mirror execution custody.

### Benchmarks

- `Benchmark/CIICompare/Writer2/CII_WRITER2_BENCHMARKS.json`.
- independent Writer2 NODENAME/SIF/HANGER/RESTRAINT oracle modules merged by #1062.

### Common / governing documents

- `reallaksh19/Common@10d667ce715bb52e1f73035c6fa326db77d0f9dd/skills/engineering-pr-delivery-v2/SKILL.md`.
- pinned v2 relay/agentchain/git-PR/validation references.
- `ciibenchmarkroadmap.md` on merged main.
- `agents/agentchain.md`.

### Authoritative sources

Qualified CAESAR V11 fixed-format physical grammar/cardinality custody inherited by this chain. Semantic authority remains limited to explicitly qualified coordinates; raw SIF field-2 and SIF CREATE construction semantics remain unresolved.

### Production paths

- `tabs/cii-workspace/cii-workspace-core.js`.
- `tabs/cii-workspace/cii-workspace-intake.js`.
- Writer2 composite routing/restraint and product-validation modules.
- parser/auxiliary/capability/NODENAME/hanger/physical-file/SIF-custody modules loaded by canonical intake.

### Validation / test paths

- `tests/cii-workspace-writer2-restraint-product-routing.test.js`.
- BM-W2-01..04 public tests after W2 A.
- focused family tests retained as lower evidence class.

### Changed this leg

Relay metadata only: successor branch creation and this endpoint. No engineering material file changed.

### Validation summary

Merge transition: PASS by GitHub merge result and fetched merge commit. Public runtime: NOT_RUN. Post-merge material basis is the squash merge SHA `a9018c131be736606e44fd0379545d233238f33e`.

### Open risks / questions

Private checkout remains unavailable to the execution container. Static-closure reconstruction may be expensive; every admitted file must be Git-blob exact. The old lost sparse mirror cannot be used as runtime evidence, only as historical frontier evidence.

### Next-agent qualification

QUALIFICATION_BASIS_HEAD: a9018c131be736606e44fd0379545d233238f33e
QUESTION_SET_ID: CII-W2-QS-0005
QUESTION_SET_STATUS: CURRENT

#### Q1 — Production Trace
Trace W2 A from the unchanged test through public Writer2 dispatch, canonical intake, RESTRAINT composite mutation, postimage intake and product round-trip validation; enumerate the direct static-import fan-out caused by core/intake loading and identify the first unpinned module.

#### Q2 — Current Unresolved Problem / Failure Isolation
Design the smallest exact dependency-closure experiment from merged main that advances beyond the historical sparse-mirror frontier without stubs or import rewrites. Define which outcomes are NOT_RUN versus FAIL and preserve the first authored-failure falsifier.

#### Q3 — Authority / Invariant
State the post-merge evidence ladder and explain why #1062 merge changes none of the NOT_RUN/public/V14/native/release gates and grants no SIF CREATE or Writer3 authority.

#### Q4 — Independent Validation
Independently reconstruct expected W2 A RESTRAINT delete postconditions and one BM-W2 retained-real case, including CONTROL count, pointer relocation, block cardinality, lexical I13 and unrelated-byte invariance, without using Writer2 output as oracle.

#### Q5 — Next Contribution / Minimal Patch
If exact public execution reaches an authored failure, define the minimal patch and rerun set; if dependency materialization remains incomplete, state exactly what new frontier evidence must be persisted without modifying production.
