# EP-CII-W2-0003 — PR1062 owner-authorized merge checkpoint

CHAIN_ID: CII-WRITER2-RUNTIME-QUALIFICATION
LEG_ID: PR1062-PRE-MERGE
ENDPOINT_ID: EP-CII-W2-0003
PREVIOUS_ENDPOINT: EP-CII-W2-0002

CREATED_AT: 2026-08-28T12:07:00+05:30
ENDPOINT_REASON: BEFORE_MERGE

TASK / ISSUE: Writer2 public runtime and retained-real benchmark qualification
PR: #1062 — CII: author retained-real Writer2 standalone benchmarks
BRANCH: agent/cii-writer2-benchmark-next

CHECKPOINT_HEAD: 02fb118674fc5bea6fb10d869d4a44c5d9b60123
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

Close the Writer2 runtime ladder without promoting focused runtime evidence into retained-real public-product evidence, without weakening lexical fixed-FORTRAN custody, and without widening SIF CREATE or Writer3/topology authority.

PR #1062 has completed its coherent benchmark-authoring/focused-runtime leg. The chain itself is not complete: W2 A and every retained-real public gate remain NOT_RUN because the complete exact private ESM graph has not executed through the unchanged public entrypoint.

### This leg completed

- Authored retained-real standalone Writer2 benchmark registry/oracles/tests for NODENAME, SIF, HANGER and RESTRAINT families.
- Reproduced and surgically repaired the NODENAME Writer2 pointer REAL-vs-I13 defect.
- Retained focused exact runtime PASS for all four standalone mutation families.
- Preserved BM-W2-01..04 public runtime as NOT_RUN.
- Reconciled `ciibenchmarkroadmap.md` to the focused/public evidence split.
- Migrated the chain to engineering-pr-delivery-v2 with immutable endpoints and repo-wide `agents/agentchain.md` traffic custody.
- Reconciled legacy open PR boundaries (#1033 SIF CREATE qualification and #1007 Writer1C NODENAME custody) as protected, non-overlapping authority domains.
- Traced the W2 A public route and historical sparse-mirror stop; no authored public assertion failure has been observed.
- Pre-merge live check at PR head `02fb118674fc5bea6fb10d869d4a44c5d9b60123`: mergeable, base/main unchanged at `d1f7d773ec89459f55d3fca9bcf0c93f2308b1e1`, no submitted reviews, no review threads, no commit status contexts.
- Compared material basis `5dc79ae7...` to PR head `02fb1186...`: only `agents/agentchain.md` and immutable endpoint `EP-CII-W2-0002.md` changed; these are relay metadata and do not stale the material qualification basis.

### Currently in progress

PR transition only. No production mutation is in progress.

### Remaining work

1. Merge PR #1062 with exact-head protection.
2. Start a successor leg on the resulting `main` under the same CHAIN_ID.
3. Reconcile the post-merge squash SHA against the material basis and relay-only commits.
4. Continue exact read-only dependency closure for unchanged W2 A public test.
5. Execute W2 A only after a complete exact graph is materialized.
6. If W2 A reaches authored execution, run BM-W2-01..04 public retained-real tests unchanged.
7. Only after standalone public PASS, proceed to composites BM-W2-05/06, W2 B, W2.35, W2.35a, W2.40 and release-freeze gates.

### Exact next action

Squash-merge PR #1062 only if its live head is still `02fb118674fc5bea6fb10d869d4a44c5d9b60123` and `main` is still compatible with merge base `d1f7d773ec89459f55d3fca9bcf0c93f2308b1e1`; after merge, create the successor leg under the same chain before any engineering-critical mutation.

### Known / proven

- Frozen benchmark source is unchanged: `Benchmark/CIICompare/BM_CII_SOURCE.CII`, blob `e41cd05603b56837cbb6e31b9d4074ef6106fe9b`.
- NODENAME Writer2 post-fix blob is `eb6bff1cdd4dc1f50e101a4f2f2dc717c74bdd5c` at the material basis.
- Focused exact runtime PASS exists for NODENAME, SIF DELETE, HANGER DELETE-ALL, and RESTRAINT compaction.
- Public BM-W2-01..04 runtime remains NOT_RUN.
- W2 A has not reached an authored assertion/exception on a complete exact graph.
- The historical sparse-mirror stop at `cii-workspace-auxiliary.js` is a materialization frontier, not product FAIL.
- Current PR diff is coherent with this leg and has no workflow, benchmark source, converter, Writer3/topology, or SIF CREATE implementation change.

### Not proven

- W2 A public runtime PASS.
- BM-W2-01..04 public retained-real PASS.
- W2 B retained-real closure.
- Generated-V14 or native-V14 closure.
- Writer2 release readiness.
- SIF CREATE payload semantics.

### NOT_RUN

| Check | Status | Observation | Oracle | Limitation |
|---|---|---|---|---|
| W2 A public route | NOT_RUN | NOT_OBSERVED | implementation-coupled public entrypoint | exact complete private graph not materialized |
| BM-W2-01 public | NOT_RUN | NOT_OBSERVED | independent NODENAME oracle + public route | blocked on W2 A/materialization |
| BM-W2-02 public | NOT_RUN | NOT_OBSERVED | independent SIF oracle + public route | blocked on W2 A/materialization |
| BM-W2-03 public | NOT_RUN | NOT_OBSERVED | independent HANGER oracle + public route | blocked on W2 A/materialization |
| BM-W2-04 public | NOT_RUN | NOT_OBSERVED | independent RESTRAINT oracle + public route | blocked on W2 A/materialization |
| W2 B | NOT_RUN | NOT_OBSERVED | retained-real V11 | prerequisite public gates not executed |
| W2.35 | NOT_RUN | NOT_OBSERVED | converter-generated V14 | prerequisite gates not executed |
| W2.35a | NOT_RUN | NOT_OBSERVED | #1042 generated-V14 regression | prerequisite gates not executed |
| W2.40 | NOT_RUN | NOT_OBSERVED | native V14 | native execution unavailable |

### Current hypothesis

The unresolved W2 A state remains a dependency materialization/transport limitation. A complete exact graph should load beyond the historical sparse-mirror frontier without changing production code.

### Falsifier

A complete exact graph loads the unchanged W2 A public entrypoint and reaches the first authored assertion or product exception. That raw failure falsifies the transport-only hypothesis and becomes the sole basis for any next production patch.

### Protected invariants

- Lexical I13 custody for Writer2 counts and pointers.
- Frozen benchmark source and independent expected postimages.
- Focused PASS is not public PASS.
- Missing module/environment remains NOT_RUN, not FAIL.
- SIF CREATE remains blocked unless independently qualified.
- Writer3/topology remains excluded.
- Connectivity remains invariant for the current Writer2 mutation families.
- Merge authorization applies to PR #1062 only; it does not grant release authority.

### Do not redo

- Do not reopen the closed NODENAME REAL-vs-I13 diagnosis without contradictory evidence.
- Do not regenerate independent oracle values from Writer2 output.
- Do not reinterpret the historical sparse-mirror module stop as product FAIL.
- Do not author composite benchmarks before standalone public runtime closure.

### Do not change

- `Benchmark/CIICompare/BM_CII_SOURCE.CII`.
- independent BM-W2 expected values.
- raw SIF field-2 semantics.
- #1033 SIF CREATE qualification boundary.
- #1007 Writer1C NODENAME custody boundary.
- `.github/workflows/**` without explicit owner authorization.
- Writer3/topology or converter authority as a bypass for Writer2 public runtime.

### Expected next-leg files / domains

The immediate successor leg is read-only graph reconstruction and may require no repository material change. If an authored public failure is reached, the expected material patch is the single first-wrong Writer2 production boundary plus one focused falsifier/regression and relay/status updates. Any benchmark/oracle/source-authority change requires a fresh endpoint before mutation.

### Inputs

1. `Benchmark/CIICompare/BM_CII_SOURCE.CII` — frozen retained-real V11 input, blob `e41cd05603b56837cbb6e31b9d4074ef6106fe9b`.
2. `tests/cii-workspace-writer2-restraint-product-routing.test.js` — W2 A public synthetic runtime gate, inherited blob `9922377ddeda86fc9167d65f33c97095346e79fa`.
3. `agents/PR1054_workreport.md`, `agents/status/PR1054.yaml`, `agents/claims/PR1054.yaml` — historical exact sparse-mirror custody; mirror itself not retained.

### Benchmarks

- `Benchmark/CIICompare/Writer2/CII_WRITER2_BENCHMARKS.json`.
- `Benchmark/CIICompare/Writer2/cii-writer2-benchmark-nodename-oracle.js`.
- `Benchmark/CIICompare/Writer2/cii-writer2-benchmark-sif-oracle.js`.
- `Benchmark/CIICompare/Writer2/cii-writer2-benchmark-hanger-oracle.js`.
- `Benchmark/CIICompare/Writer2/cii-writer2-benchmark-oracle.js`.

### Common / governing documents

- `reallaksh19/Common@10d667ce715bb52e1f73035c6fa326db77d0f9dd/skills/engineering-pr-delivery-v2/SKILL.md`.
- `reallaksh19/Common@10d667ce715bb52e1f73035c6fa326db77d0f9dd/skills/engineering-pr-delivery-v2/references/git-pr-policy.md`.
- `ciibenchmarkroadmap.md` at material basis `5dc79ae7...`.
- `agents/agentchain.md`.

### Authoritative sources

- Qualified CAESAR V11 fixed-format physical grammar/cardinality custody inherited by the Writer2 chain; semantic authority is limited to explicitly qualified fields.
- PR #1033 is authority only for unresolved SIF CREATE construction semantics; it grants no production CREATE authority.

### Production paths

- `tabs/cii-workspace/cii-workspace-core.js`.
- `tabs/cii-workspace/cii-workspace-writer2-composite-routing.js`.
- `tabs/cii-workspace/cii-workspace-writer2-composite-restraint.js`.
- `tabs/cii-workspace/cii-workspace-writer2-product-validation.js`.
- family-specific Writer2 modules reached by the public route.

### Validation / test paths

- `tests/cii-workspace-writer2-restraint-product-routing.test.js`.
- `tests/cii-workspace-writer2-benchmark-nodename-create.test.js`.
- `tests/cii-workspace-writer2-benchmark-sif-delete.test.js`.
- `tests/cii-workspace-writer2-benchmark-hanger-delete-all.test.js`.
- `tests/cii-workspace-writer2-benchmark-restraint-delete.test.js`.
- focused tests retained separately for NODENAME, SIF, HANGER, RESTRAINT.

### Changed this leg

No new material engineering change after `5dc79ae7...`. Commits between material basis and observed PR head `02fb1186...` modify only relay metadata (`agents/agentchain.md` and immutable `EP-CII-W2-0002.md`). This endpoint is itself relay metadata.

### Validation summary

- PR mergeability: PASS by live GitHub PR metadata at head `02fb1186...`.
- Base drift: PASS/none observed; `main` remains `d1f7d773...`.
- Reviews/threads: none observed; absence is not PASS evidence.
- Commit status contexts: none observed; absence is not PASS evidence.
- Material-basis freshness: PASS by commit comparison; only relay metadata exists after `5dc79ae7...`.
- Public runtime: NOT_RUN.

### Open risks / questions

- Complete private checkout remains unavailable to the execution container.
- Official relay validator runtime remains environment-dependent and must not be inferred from source inspection.
- Public route monolithic imports create a larger exact dependency graph than focused tests.
- Post-merge squash SHA must be reconciled before successor engineering mutation.

### Next-agent qualification

QUALIFICATION_BASIS_HEAD: 5dc79ae7f57528eaca2f6a5e5c50fdb80a68972b
QUESTION_SET_ID: CII-W2-QS-0003
QUESTION_SET_STATUS: CURRENT

#### Q1 — Production Trace

From the post-merge `main`, trace unchanged W2 A from `tests/cii-workspace-writer2-restraint-product-routing.test.js` through `applyCiiWorkspaceTargetWriter2()`, `currentTargetFor()`, composite RESTRAINT routing/compaction, canonical re-intake, and `validateCiiWriter2ProductRoundTrip()`. Name the exact first unresolved static import frontier and classify a missing module as NOT_RUN rather than product FAIL.

#### Q2 — Current Unresolved Problem / Failure Isolation

Reconcile the post-merge squash commit against PR #1062 material basis `5dc79ae7...` and its relay-only tail. Then define the smallest exact dependency-closure experiment that can advance beyond the historical `cii-workspace-auxiliary.js` frontier without stubs, import rewrites, reconstructed entrypoints, or partial-core substitutions. State the raw authored-failure falsifier.

#### Q3 — Authority / Invariant

State the evidence hierarchy from focused family PASS to W2 A, BM-W2-01..04 public retained-real, W2 B, generated V14, #1042 generated-V14 regression, native V14, and release. Identify exactly which gates remain NOT_RUN after PR #1062 merge and explain why merge cannot promote them or widen SIF CREATE/Writer3 authority.

#### Q4 — Independent Validation

Independently reconstruct expected RESTRAINT delete postconditions for W2 A and one retained-real standalone BM-W2 case, including CONTROL count custody, pointer relocation, fixed block cardinality, lexical-I13 requirements, unrelated-byte protection, and the boundary between independent oracle evidence and Writer2 implementation testimony.

#### Q5 — Next Contribution / Minimal Patch

If the complete exact public graph reaches the first authored failure, define the minimal permissible production patch, focused regression, unchanged public rerun, rollback condition, and relay update. Also state the conditions requiring no code change and continuation as NOT_RUN.
