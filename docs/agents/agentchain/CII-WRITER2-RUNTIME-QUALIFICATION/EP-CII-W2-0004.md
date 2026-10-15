# EP-CII-W2-0004 — PR1062 merge-head self-reference recovery

CHAIN_ID: CII-WRITER2-RUNTIME-QUALIFICATION
LEG_ID: PR1062-PRE-MERGE-RECOVERY
ENDPOINT_ID: EP-CII-W2-0004
PREVIOUS_ENDPOINT: EP-CII-W2-0003

CREATED_AT: 2026-08-28T12:09:00+05:30
ENDPOINT_REASON: PRE_MERGE_RECOVERY
SUPERSEDES_FOR_ACTIVE_USE: EP-CII-W2-0003 exact-head merge predicate only

TASK / ISSUE: Writer2 public runtime and retained-real benchmark qualification
PR: #1062 — CII: author retained-real Writer2 standalone benchmarks
BRANCH: agent/cii-writer2-benchmark-next

CHECKPOINT_HEAD_OBSERVED_BEFORE_THIS_ENDPOINT: d0d36de8899b1c0252342bc6914088de90f80386
MATERIAL_QUALIFICATION_BASIS_HEAD: 5dc79ae7f57528eaca2f6a5e5c50fdb80a68972b
MAIN_HEAD_OBSERVED: d1f7d773ec89459f55d3fca9bcf0c93f2308b1e1
MERGE_BASE: d1f7d773ec89459f55d3fca9bcf0c93f2308b1e1

STATE: READY_FOR_NEXT_LEG
EXECUTION_MODE: AUTO
AUTO_STATE: READY_FOR_PR_TRANSITION
SCOPE_AUTHORITY: LOCKED_TO_APPROVED_BENCHMARK_ROADMAP
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: TRUE
MERGE_AUTHORIZATION_SOURCE: user instruction 2026-08-28T12:06+05:30 — "merge, continue"
COORDINATION_STATE: SAFE

### Mission and current state

Close Writer2 public runtime qualification without promoting focused evidence, weakening fixed-FORTRAN custody, or widening SIF CREATE/Writer3 authority. PR #1062 is ready to transition; the engineering chain is not complete.

### Recovery reason

EP-CII-W2-0003 named the then-live PR head as an exact merge target. Creating EP3 and advancing `agents/agentchain.md` necessarily created relay-only commits, so that literal head predicate became stale even though the material qualification basis did not change. This endpoint corrects only that merge predicate. EP3 remains immutable history.

### This leg completed

- All PR1062 material work through `5dc79ae7f57528eaca2f6a5e5c50fdb80a68972b` is unchanged.
- Live pre-merge checks found PR mergeable with no base drift, submitted reviews, review threads, or status contexts.
- Commits after the material basis through observed head `d0d36de...` affect relay metadata only (`agents/agentchain.md` and immutable relay endpoints).
- Owner explicitly authorized merge and continuation.

### Currently in progress

PR transition only. No production mutation is in progress.

### Remaining work

1. Re-fetch PR #1062 and current `main` after this endpoint/index synchronization.
2. Verify every commit after material basis `5dc79ae7...` remains relay metadata only and `main` has not materially drifted.
3. Mark the draft PR ready for review if GitHub requires that transition for merge.
4. Squash-merge with `expected_head_sha` equal to the freshly fetched live PR head.
5. Start a successor leg under the same CHAIN_ID from the resulting `main`.
6. Continue exact read-only W2 A dependency closure; retain public gates as NOT_RUN until unchanged execution occurs.

### Exact next action

After this endpoint and its index row are durably committed, re-fetch PR #1062 and `main`; if the PR remains mergeable, `main` remains compatible with `d1f7d773...`, and the entire tail after material basis `5dc79ae7...` is relay metadata only, mark ready if necessary and squash-merge using the freshly fetched live head as `expected_head_sha`. Stop instead if any material head/base drift appears.

### Known / proven

- Material qualification basis remains `5dc79ae7...`.
- Focused exact runtime PASS exists for NODENAME, SIF DELETE, HANGER DELETE-ALL, and RESTRAINT compaction.
- BM-W2-01..04 public runtime remains NOT_RUN.
- W2 A remains NOT_RUN; no authored public failure has been observed.
- Frozen BM source remains blob `e41cd05603b56837cbb6e31b9d4074ef6106fe9b`.
- PR merge authorization is now explicit for #1062 only.

### Not proven

- W2 A public PASS.
- BM-W2-01..04 public PASS.
- W2 B, W2.35, W2.35a, W2.40 or release readiness.
- SIF CREATE semantics.

### NOT_RUN

| Check | Status | Limitation |
|---|---|---|
| W2 A public route | NOT_RUN | complete exact private graph not materialized |
| BM-W2-01 public | NOT_RUN | blocked on W2 A/materialization |
| BM-W2-02 public | NOT_RUN | blocked on W2 A/materialization |
| BM-W2-03 public | NOT_RUN | blocked on W2 A/materialization |
| BM-W2-04 public | NOT_RUN | blocked on W2 A/materialization |
| W2 B | NOT_RUN | public prerequisite gates not executed |
| W2.35 | NOT_RUN | prerequisite gates not executed |
| W2.35a | NOT_RUN | prerequisite gates not executed |
| W2.40 | NOT_RUN | native execution unavailable |

### Current hypothesis and falsifier

Hypothesis: unresolved W2 A is still transport/materialization rather than a demonstrated product defect. Falsifier: a complete exact graph loads unchanged W2 A and reaches an authored assertion/product exception; preserve that first raw failure before any repair.

### Protected invariants

- lexical I13 count/pointer custody;
- frozen source and independent oracles;
- focused PASS != public PASS;
- environment/module stop = NOT_RUN;
- SIF CREATE blocked;
- Writer3/topology excluded;
- merge does not imply chain or release completion.

### Do not redo / do not change

Do not redo the closed NODENAME REAL-vs-I13 diagnosis absent contradictory evidence. Do not regenerate independent expected values from Writer2. Do not change `Benchmark/CIICompare/BM_CII_SOURCE.CII`, raw SIF field-2 semantics, #1033 SIF CREATE authority, #1007 Writer1C custody, Writer3/topology, or `.github/workflows/**` without explicit authority.

### Expected next-leg files / domains

Initial successor work is read-only graph reconstruction. If and only if an authored public failure appears, the smallest legitimate patch is the first-wrong Writer2 production boundary plus a focused regression and relay/status updates.

### Inputs

- `Benchmark/CIICompare/BM_CII_SOURCE.CII`, blob `e41cd05603b56837cbb6e31b9d4074ef6106fe9b`.
- `tests/cii-workspace-writer2-restraint-product-routing.test.js`, inherited public W2 A gate blob `9922377ddeda86fc9167d65f33c97095346e79fa`.
- historical W2.13 recovery records in PR1054 agent artifacts.

### Benchmarks

- `Benchmark/CIICompare/Writer2/CII_WRITER2_BENCHMARKS.json`.
- independent NODENAME, SIF, HANGER and RESTRAINT Writer2 oracle modules listed by EP-CII-W2-0003.

### Common / governing documents

- `reallaksh19/Common@10d667ce715bb52e1f73035c6fa326db77d0f9dd/skills/engineering-pr-delivery-v2/SKILL.md`.
- pinned v2 `references/git-pr-policy.md`.
- `ciibenchmarkroadmap.md` at material basis `5dc79ae7...`.
- `agents/agentchain.md`.

### Authoritative sources

Qualified CAESAR V11 fixed-format physical grammar/cardinality custody inherited by this chain; semantic authority is limited to fields explicitly qualified by retained evidence.

### Production paths

`cii-workspace-core.js`, Writer2 composite routing/restraint modules, product validation, and family modules reached by the unchanged public route.

### Validation / test paths

W2 A public routing test; BM-W2-01..04 public benchmark tests; focused NODENAME/SIF/HANGER/RESTRAINT runtime tests retained separately.

### Changed this leg

Relay metadata only. No material engineering file, benchmark source, oracle value, production behavior, or test behavior changed after material basis `5dc79ae7...`.

### Validation summary

Pre-merge live GitHub metadata: mergeable; no base drift observed; no reviews/threads/status contexts. Material freshness: unchanged because the post-basis tail is relay metadata only. Public runtime: NOT_RUN.

### Open risks / questions

Complete private checkout remains unavailable to the runtime. Post-merge squash SHA must be reconciled before engineering-critical mutation. Relay validator runtime is not inferred from source inspection.

### Next-agent qualification

QUALIFICATION_BASIS_HEAD: 5dc79ae7f57528eaca2f6a5e5c50fdb80a68972b
QUESTION_SET_ID: CII-W2-QS-0004
QUESTION_SET_STATUS: CURRENT

#### Q1 — Production Trace
Trace post-merge W2 A from the unchanged routing test through public Writer2 dispatch, canonical target re-intake, RESTRAINT composite transaction, postimage re-intake and product validation; name the first unresolved static import frontier and its correct NOT_RUN classification.

#### Q2 — Current Unresolved Problem / Failure Isolation
Reconcile the squash-merged `main` against material basis `5dc79ae7...`, separate relay metadata from material code, and define the smallest exact dependency-closure experiment that advances the historical sparse-mirror frontier without stubs, import rewrites or partial-core substitutes.

#### Q3 — Authority / Invariant
State the evidence ladder and all gates that remain NOT_RUN after merge; explain why PR merge cannot promote focused evidence, grant SIF CREATE authority, change Writer3/topology authority, or release Writer2.

#### Q4 — Independent Validation
Independently reconstruct W2 A RESTRAINT delete postconditions plus one retained-real BM-W2 case, including CONTROL count, pointer relocation, physical cardinality, lexical-I13 syntax and unrelated-byte protection, without using Writer2 output as the oracle.

#### Q5 — Next Contribution / Minimal Patch
If the first authored public failure appears, define the minimum production patch and focused/public reruns; otherwise state the exact conditions for leaving code unchanged, recording NOT_RUN, and creating a new relay endpoint.
