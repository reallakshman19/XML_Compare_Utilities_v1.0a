# EP-CII-W2-0001 — validated Writer2 runtime qualification relay migration

CHAIN_ID: CII-WRITER2-RUNTIME-QUALIFICATION
LEG_ID: PR1062-PHASE2-FOCUSED-CLOSURE
ENDPOINT_ID: EP-CII-W2-0001
PREVIOUS_ENDPOINT: NONE — chain start; this conforming endpoint supersedes the malformed pre-validation migration artifact from commits 538b6bbf8a9abfc010474053866af47d16cf3c9d and aa9f61a1a94c8a13d4955e3f4cfe7823b9972e62

CREATED_AT: 2026-08-28T07:47:00+05:30
ENDPOINT_REASON: LEGACY_TO_RELAY_MIGRATION

TASK / ISSUE: Writer2 public runtime and retained-real benchmark qualification; preserve W2 A/W2 B/W2.35/W2.35a/W2.40 fail-closed ladder
PR: #1062 — CII: author retained-real Writer2 standalone benchmarks
BRANCH: agent/cii-writer2-benchmark-next

CHECKPOINT_HEAD: 77644656565cb4ab4d646bb87b6f892926232bd4
MAIN_HEAD_OBSERVED: d1f7d773ec89459f55d3fca9bcf0c93f2308b1e1
MERGE_BASE: d1f7d773ec89459f55d3fca9bcf0c93f2308b1e1

STATE: BLOCKED
EXECUTION_MODE: AUTO
AUTO_STATE: BLOCKED
SCOPE_AUTHORITY: LOCKED_TO_APPROVED_BENCHMARK_ROADMAP
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
COORDINATION_STATE: SAFE

SUPERSEDES_ARTIFACT: agents/agentchain/CII-WRITER2-RUNTIME-QUALIFICATION/CII-W2-EP-0001.md at commit 538b6bbf8a9abfc010474053866af47d16cf3c9d
SUPERSEDED_ASSERTION: first migration artifact/index conformed to engineering-pr-delivery-v2 structural schema
CORRECTED_STATE: first migration attempt was PRE_VALIDATION_INVALID because its endpoint ID did not match EP-* and its index used code-wrapped locator/head cells; this endpoint is the first accepted relay endpoint
EVIDENCE: Common engineering-pr-delivery-v2 validate_agentchain.py blob 4bfc69dd46a6033d3845c80ceb1cf59ea9f6039c

### Mission

Close Writer2 qualification without weakening fixed-FORTRAN custody or converting focused subgraph evidence into public-product authority. The next material gate is the unchanged public `applyCiiWorkspaceTargetWriter2()` runtime against the exact private repository state, followed by retained-real BM-W2-01..04 public tests. Phase-3 composites and release promotion remain blocked until those public gates pass.

### This leg completed

- Authored retained-real BM-W2-01 NODENAME CREATE and BM-W2-03 HANGER DELETE-ALL independent benchmark/oracle coverage.
- Preserved inherited BM-W2-02 SIF DELETE and BM-W2-04 RESTRAINT DELETE/compaction benchmark families.
- Reproduced the V11 NODENAME ELEMENT pointer I13 defect and repaired only `tabs/cii-workspace/cii-workspace-writer2-nodename-write.js`.
- Closed focused exact runtime for NODENAME, SIF, HANGER, and RESTRAINT.
- Preserved all BM-W2-01..04 public runtime claims as NOT_RUN.
- Preserved W2 A/W2 B/W2.35/W2.35a/W2.40 as NOT_RUN and release freeze as NOT_READY.
- Reconciled legacy open PR #1033 and #1007 boundaries with no exact-file overlap.
- Migrated the mission to engineering-pr-delivery-v2 durable relay custody.

### Currently in progress

No material production mutation is authorized while the complete exact private checkout is unavailable. Relay/index migration and PR-state reconciliation are metadata-only.

### Remaining work

1. Materialize a complete exact private checkout at the current material basis or reconcile a later materially equivalent head.
2. Run the public W2 A route unchanged.
3. Run BM-W2-01, BM-W2-02, BM-W2-03, and BM-W2-04 public retained-real tests unchanged.
4. Stop at the first authored falsifier and distinguish environment/module NOT_RUN from authored FAIL.
5. Patch only the first reproduced product defect, if any, and re-run exact pre/post falsifiers plus adjacent regressions.
6. Only after standalone public runtime PASS, author BM-W2-05 and BM-W2-06.
7. Then progress W2.35, W2.35a, W2.40 and release-freeze qualification.

### Exact next action

Materialize the complete exact repository graph for material head `77644656565cb4ab4d646bb87b6f892926232bd4` (or first reconcile a later head for material equivalence), then run unchanged `node tests/cii-workspace-writer2-restraint-product-routing.test.js`; if and only if that public W2 A gate reaches authored execution, run BM-W2-01..04 public tests unchanged in order and stop at the first authored failure.

### Known / proven

- Current main and PR merge-base are `d1f7d773ec89459f55d3fca9bcf0c93f2308b1e1`.
- PR #1062 material basis is `77644656565cb4ab4d646bb87b6f892926232bd4`, with 14 material changed files.
- PR #1062 is open, draft, unmerged, mergeable; merge remains owner-only.
- BM source blob is `e41cd05603b56837cbb6e31b9d4074ef6106fe9b` and unchanged.
- NODENAME writer post-fix blob is `eb6bff1cdd4dc1f50e101a4f2f2dc717c74bdd5c`.
- Focused runtime evidence is PASS for all four mutation families as indexed in `agents/claims/PR1062.yaml`.
- Focused PASS has no public-runtime implication.
- #1033 has no exact-file overlap and remains SIF CREATE qualification-only; CREATE remains blocked.
- #1007 has no exact-file overlap and remains Writer1C NODENAME custody work.

### Not proven

- Complete public `applyCiiWorkspaceTargetWriter2()` runtime on the exact current repository graph.
- BM-W2-01..04 retained-real public-product PASS.
- W2 A or W2 B closure.
- Generated V14 W2.35/W2.35a closure.
- Native V14 W2.40 closure.
- Release readiness.
- Any SIF CREATE construction semantics beyond the separately blocked #1033 authority.

### NOT_RUN

| Check | Status | Observation | Oracle / basis | Reason |
|---|---|---|---|---|
| W2 A public route | NOT_RUN | NOT_OBSERVED | implementation-coupled public route | complete exact private checkout unavailable |
| BM-W2-01 public retained-real NODENAME | NOT_RUN | NOT_OBSERVED | independent structural oracle + public route | complete exact private checkout unavailable |
| BM-W2-02 public retained-real SIF | NOT_RUN | NOT_OBSERVED | independent structural oracle + public route | complete exact private checkout unavailable |
| BM-W2-03 public retained-real HANGER | NOT_RUN | NOT_OBSERVED | independent structural oracle + public route | complete exact private checkout unavailable |
| BM-W2-04 public retained-real RESTRAINT | NOT_RUN | NOT_OBSERVED | independent structural oracle + public route | complete exact private checkout unavailable |
| W2 B | NOT_RUN | NOT_OBSERVED | retained-real V11 | blocked on public runtime |
| W2.35 | NOT_RUN | NOT_OBSERVED | converter-generated V14 | blocked on prior gates |
| W2.35a | NOT_RUN | NOT_OBSERVED | issue-1042 generated-V14 regression | blocked on prior gates |
| W2.40 | NOT_RUN | NOT_OBSERVED | native V14 | native evidence not yet executed |

### Active hypothesis

The remaining W2 A blocker is environmental/materialization rather than a demonstrated Writer2 product defect. Focused family tests reduce defect risk but do not establish that the complete public dependency graph executes.

### Falsifier

After every admitted repository file is verified against the target head, the unchanged public W2 A test reaches an authored assertion/exception instead of a missing-module/materialization/environment boundary. That event falsifies the environment-only hypothesis and authorizes isolation of the first wrong product boundary.

### Protected invariants

- Fixed-FORTRAN integer pointer/count coordinates remain lexical I13.
- NOT_RUN never becomes PASS without execution.
- Focused subgraph PASS never promotes public-product runtime.
- Independent benchmark expected values are not regenerated from Writer2 output.
- `Benchmark/CIICompare/BM_CII_SOURCE.CII` remains frozen.
- Connectivity/topology remains unchanged for current Writer2 mutation families.
- SIF CREATE remains blocked while payload semantics are unqualified.
- Writer3/topology authority remains outside this chain.
- Merge remains owner-only.

### Do not redo

- Do not re-diagnose the already-reproduced NODENAME I13 defect unless new evidence contradicts the post-fix focused PASS.
- Do not rebuild focused SIF/HANGER/RESTRAINT evidence merely to manufacture a public PASS label.
- Do not replace public-route execution with stubs, import rewrites, partial-core substitutes, or reconstructed PASS.

### Do not change

- `Benchmark/CIICompare/BM_CII_SOURCE.CII`.
- Raw SIF field-2 semantic authority.
- SIF CREATE qualification/authority owned by legacy PR #1033.
- Writer1C NODENAME custody authority owned by legacy PR #1007.
- `.github/workflows/**` without explicit owner authorization.
- Converter/frozen-source authority merely to force Writer2 tests green.
- Independent oracle expected values to match production output.

### Expected next-leg files / domains

Primary expectation is validation/materialization only. If a genuine authored public-route defect is reproduced, change only the first isolated Writer2 production boundary and its focused regression. Likely domains are `tabs/cii-workspace/cii-workspace-writer2-*.js` and `tests/cii-workspace-writer2-*.test.js`; broader expansion requires a new endpoint and authority reconciliation.

### Inputs

1. `Benchmark/CIICompare/BM_CII_SOURCE.CII`
   - repository: reallaksh19/XML_Compare_Utilities
   - blob: `e41cd05603b56837cbb6e31b9d4074ef6106fe9b`
   - version: CAESAR neutral V11
   - authority: FROZEN_RETAINED_REAL_INPUT
   - next-leg role: common retained-real input for BM-W2-01..04

2. PR1062 state artifacts
   - paths: `agents/status/PR1062.yaml`, `agents/claims/PR1062.yaml`, `agents/PR1062_workreport.md`
   - authority: RECOVERY_STATE / EVIDENCE_INDEX
   - qualification state: CURRENT_AT_CHECKPOINT_HEAD

### Benchmarks

1. `Benchmark/CIICompare/Writer2/CII_WRITER2_BENCHMARKS.json`
   - authority: benchmark registry separating focused and public runtime

2. `Benchmark/CIICompare/Writer2/cii-writer2-benchmark-nodename-oracle.js`
   - blob: `ab770906e30fa4a0db156e083517af1d7793eb5c`
   - authority: INDEPENDENT_STRUCTURAL_POSTIMAGE

3. `Benchmark/CIICompare/Writer2/cii-writer2-benchmark-hanger-oracle.js`
   - blob: `16cbba8d5ac7dec1dc4e8cce1c5f0b6a9c728b3f`
   - authority: INDEPENDENT_STRUCTURAL_POSTIMAGE

4. BM-W2-02/BM-W2-04 expectations
   - locator: benchmark manifest + existing public benchmark tests
   - authority: independent structural postimage where explicitly declared; implementation-coupled tests remain separate
   - state: AUTHORED_PUBLIC_RUNTIME_NOT_RUN

### Common / governing documents

1. engineering-pr-delivery-v2
   - repository: reallaksh19/Common
   - path: `skills/engineering-pr-delivery-v2/SKILL.md`
   - commit: `10d667ce715bb52e1f73035c6fa326db77d0f9dd`
   - blob: `b5ef40e04f9dc58c17577618d2e4dabbcdec9f25`
   - authority: PROCESS_GOVERNING

2. `ciibenchmarkroadmap.md`
   - repository: reallaksh19/XML_Compare_Utilities
   - authority: PROJECT_QUALIFICATION_SEQUENCE
   - state: CURRENT_AT_CHECKPOINT_HEAD

### Authoritative sources

1. Qualified CAESAR V11 fixed-format source/formatter custody inherited from preceding Writer2 legs.
   - authority boundary: physical grammar/cardinality/pointer syntax only where explicitly qualified; it does not qualify unresolved SIF CREATE semantic fields.

2. Legacy PR #1033 SIF CREATE qualification.
   - authority boundary: qualification/data only; production CREATE remains blocked by `WRITER_2_SIF_CREATE_PAYLOAD_SEMANTICS_UNQUALIFIED_ITEMS_27_30`.

### Production paths

- `tabs/cii-workspace/cii-workspace-writer2-nodename-write.js` — current PR's only production modification.
- `tabs/cii-workspace/cii-workspace-writer2-*.js` — family boundaries to inspect only after an authored public failure.
- public routing modules reached by `applyCiiWorkspaceTargetWriter2()` — trace first; do not pre-emptively modify.

### Validation / test paths

Public gates, unchanged:

- `tests/cii-workspace-writer2-restraint-product-routing.test.js`
- `tests/cii-workspace-writer2-benchmark-nodename-create.test.js`
- `tests/cii-workspace-writer2-benchmark-sif-delete.test.js`
- `tests/cii-workspace-writer2-benchmark-hanger-delete-all.test.js`
- `tests/cii-workspace-writer2-benchmark-restraint-delete.test.js`

Focused evidence already PASS and not a public substitute:

- `tests/cii-workspace-writer2-nodename-i13-source-contract.test.js`
- `tests/cii-workspace-writer2-nodename-i13-focused-runtime.test.js`
- `tests/cii-workspace-writer2-sif-delete-physical.test.js`
- `tests/cii-workspace-writer2-hanger-focused-runtime.test.js`
- `tests/cii-workspace-writer2-restraint-compaction-focused-runtime.test.js`

### Changed during this leg

At material head `77644656565cb4ab4d646bb87b6f892926232bd4`, PR #1062 has 14 material changed files: benchmark manifest, two independent oracles, roadmap, PR1062 workreport/status/claims, one production NODENAME writer, and six benchmark/focused tests. Relay migration commits are metadata-only and do not change `QUALIFICATION_BASIS_HEAD`.

### Validation summary

- NODENAME focused runtime: PASS; OBSERVATION=LOCAL_EXECUTION; exact 5-file Git-blob graph; source-contract falsifier independently detects REAL-vs-I13 formatter class.
- SIF focused runtime: PASS; OBSERVATION=LOCAL_EXECUTION; exact 8-file Git-blob graph; independent exact postimage and anti-testimony checks included.
- HANGER focused runtime: PASS; OBSERVATION=LOCAL_EXECUTION; exact 9-file Git-blob graph including record-binding and tail-order custody.
- RESTRAINT focused compaction runtime: PASS; OBSERVATION=LOCAL_EXECUTION; exact 7-file Git-blob graph with lexical-I13 pointer custody.
- Public Writer2 runtime: NOT_RUN; OBSERVATION=NOT_OBSERVED.

### Open risks / questions

- Private repository visibility prevents unauthenticated archive/clone materialization; connector blob reads do not create a complete executable checkout.
- PR #1062 description is stale relative to the 14-file material state and must be reconciled as metadata.
- Multiple legacy draft PRs predate relay-v2; #1033 and #1007 were checked for overlap and are explicitly protected.
- The public route may expose a real dependency/behavior defect once exact materialization succeeds.
- The malformed pre-validation relay attempt is preserved by Git history and explicitly superseded here; it must not be treated as a valid endpoint.

### Next-agent qualification

QUALIFICATION_BASIS_HEAD: 77644656565cb4ab4d646bb87b6f892926232bd4
QUESTION_SET_ID: CII-W2-QS-0001
QUESTION_SET_STATUS: CURRENT

#### Q1 — Production Trace

From the live material basis, trace the exact public call path beginning at `tests/cii-workspace-writer2-restraint-product-routing.test.js` into `applyCiiWorkspaceTargetWriter2()` and down to the family-specific physical mutation boundary used by the test. Name every material module/function boundary you rely on, identify where target-byte/hash custody is enforced, and identify the first boundary whose absence would make the run NOT_RUN rather than an authored FAIL.

#### Q2 — Current Unresolved Problem / Failure Isolation

The current hypothesis is that the remaining W2 A blocker is repository materialization/environment rather than a proven product defect. Define the minimum exact experiment that distinguishes those cases. State your prediction under the environment-only hypothesis, the concrete falsifier, how you will classify a missing static module versus an authored assertion, and the first wrong boundary you would inspect if the falsifier fires.

#### Q3 — Authority / Invariant

Using the live benchmark manifest, current Writer2 production files, and protected legacy PR boundaries, state which evidence may authorize public-runtime promotion and which evidence cannot. Explain why the four focused PASS results cannot promote BM-W2-01..04, why SIF CREATE authority from #1033 must remain blocked, and name one plausible shortcut that would violate fixed-FORTRAN or benchmark authority.

#### Q4 — Independent Validation

For BM-W2-01..04, identify the independent or independently reconstructed expected postimage/custody evidence that must remain separate from Writer2 output. For at least two families, show the exact count/pointer/cardinality expectations you would verify after the public run, including lexical-I13 requirements, and state how unrelated-byte drift would be falsified without deriving the oracle from production output.

#### Q5 — Next Contribution / Minimal Patch

Assume the complete exact public graph is materialized and the first authored failure occurs. Describe the smallest legitimate next contribution: exact module/function domain to isolate first, expected changed files, protected unchanged domains, focused pre/post falsifier, public regression rerun, and the condition under which you must stop rather than patch. Explicitly preserve BM source, independent oracles, SIF CREATE block, Writer3/topology exclusion, and owner-only merge authority.
