# PR992 — CII Writer 1B qualified cardinality-preserving fields

## Recovery Header

```text
WORK_ID: PR992
WORK_INTENT: IMPLEMENT
CRITICALITY: ENGINEERING_CRITICAL
REPOSITORY: reallaksh19/XML_Compare_Utilities
BASE_BRANCH: main
BASE_BASIS_SHA: edf297f7e749d4ff2fe68a84d2482d5344c284d5
WORKING_BRANCH: agent/cii-writer-1b-qualified-slice
PR: 992
PR_STATE: DRAFT_UNMERGED
CURRENT_STAGE: VALIDATE_RECONCILE
HANDOVER_READINESS: READY
IMPLEMENTATION_STATE: COMPLETE_WITHIN_QUALIFIED_SCOPE
MERGE_AUTHORITY: OWNER_ONLY
MERGE_DISPOSITION: CONDITIONALLY_MERGEABLE_WITH_EXPLICIT_ACCEPTANCE_OF_NOT_RUN_ENVIRONMENT
EXACT_NEXT_ACTION: either execute the committed TARGET1/TARGET2 + full lifecycle suite in a complete checkout, or obtain explicit owner authorization to merge while preserving those gates as NOT_RUN_ENVIRONMENT.
```

## Handover in 60 Seconds

Writer 1B is implemented on top of merged Writer 1A. `main` remains exactly `edf297f7e749d4ff2fe68a84d2482d5344c284d5`, so PR992 has no base drift. GitHub reports PR992 mergeable; there are no CI statuses, reviews or review threads.

Qualified Writer 1B production scope:

```text
ELEMENT row 2: WT, insulation thickness, corrosion allowance, T1, T2, T3
ELEMENT row 3: T4, T5, T6, T7, T8, T9
ELEMENT row 4: P1, P2, P3, P4, P5, P6
ELEMENT row 5: P7, P8, P9
ELEMENT row 6: insulation density, fluid density, hydro pressure
ELEMENT header: conditional OD only under topology-closed plain-PIPE/no-reducer custody
RESTRANT: one-slot CREATE/CLEAR inside an already-owned 24-row block
Writer 1A compatibility mode retained explicitly
Plan-driven reparse / negative assurance before export
```

Explicitly blocked:

```text
SIF/TEE semantic rewrite
new RESTRANT blocks or pointer re-indexing
multiple-slot restraint cardinality changes
restraint tag/GUID string mutation
BEND/FORCMNT/DISPLMNT/UNIFORM/WIND/OFFSETS/ALLOWBLS mutation
node/element/connectivity/geometry mutation
workflow changes
protected external writer changes
```

## Source Qualification

Protected writer authority establishes the 15-row ELEMENT layout, including T1–T9, P1–P9, insulation/corrosion, densities and hydro pressure. It also establishes `6 slots × 4 rows = 24 rows` per RESTRANT block and the empty-slot representation. SIF/TEE remains intentionally unqualified because payload semantics are not established by current source authority.

OD was tightened beyond the initial roadmap rule. Writer 1B does **not** permit a single-edge OD change merely because the edge is plain PIPE with reducer pointer 0. The post-write local run must be topology-closed: every neighboring TARGET edge at each non-terminal endpoint must already match the proposed SOURCE OD. This prevents Writer 1B from silently creating a new diameter transition.

## Implementation Summary

- `parser/sections/elements.js`: canonical 15-row parsing and full qualified Writer 1B fixed fields.
- topology/capability/delta layers: carry extended fields as downstream revision evidence only; M1/M2 identity remains unchanged.
- `cii-workspace-writer1b-od.js`: topology-closed OD eligibility.
- `cii-workspace-restraint-slot-transfer.js`: deterministic +1/-1 free-slot plan using existing-record pairing; metadata-safe.
- `cii-workspace-target-writer-1b.js`: exact fixed-span mutation, preimage checks, overflow/duplicate-field guards, fixed cardinality.
- `cii-workspace-writer-validation.js`: plan-driven negative assurance allowing only approved Writer 1B semantic changes.
- transfer policy/core/UI: Writer 1B production default; Writer 1A compatibility remains available through `writerVersion: '1A'`.
- SIF/TEE remains fail-closed.

## Protected Invariants

- node IDs/count unchanged;
- element count/order unchanged;
- FROM/TO/DX/DY/DZ unchanged;
- geometry unchanged;
- auxiliary pointer values/ownership unchanged;
- section row cardinality unchanged;
- unrelated restraint slots unchanged;
- tag/GUID rows unchanged;
- no OD-based identity evidence;
- unsupported approved operations block apply rather than being silently skipped;
- protected external writer unchanged.

## Validation Ledger

| Check | Status | Observation | Oracle / note |
|---|---|---|---|
| live `main` grounding | PASS | GitHub live state | still `edf297f7...`; no base drift |
| PR mergeability | PASS | GitHub live state | mergeable=true, draft=true |
| CI statuses | NOT_APPLICABLE / NONE | GitHub live state | no configured status checks reported |
| extended ELEMENT source layout | PASS | source inspection | protected writer exact row/field layout |
| RESTRANT block/empty-slot source custody | PASS | source inspection | 6×4=24 rows; empty metadata rows |
| SIF/TEE mutation authority | FAIL_CLOSED | source inspection | semantics unqualified; mutation blocked |
| Writer 1B extended ELEMENT/OD focused execution | PASS_IMPLEMENTATION_COUPLED | Node execution using exact branch Writer 1B + current Writer 1A dependency | 5 exact fixed-field rewrites; file length unchanged |
| RESTRANT slot CREATE/CLEAR focused execution | PASS_IMPLEMENTATION_COUPLED | Node execution | fixed 24-row block; unrelated slot preserved; file length unchanged |
| exact 15-row parser ambiguity case | PASS_IMPLEMENTATION_COUPLED | Node execution | 2 intended elements parsed as 2 despite T4–T9 row resembling old header heuristic |
| OD topology-closed eligibility | PASS_IMPLEMENTATION_COUPLED | Node execution | terminal/closed run qualifies; open neighbor/reducer/source transition block |
| Writer 1B transfer-policy negatives | PASS_IMPLEMENTATION_COUPLED | Node execution | unqualified OD protected; SIF/TEE blocked; Writer 1A cardinality change blocked |
| round-trip negative assurance | PASS_IMPLEMENTATION_COUPLED | Node execution | unauthorized DX change and non-empty restraint metadata deliberately rejected |
| real TARGET1/TARGET2 Writer 1B benchmark | NOT_RUN_ENVIRONMENT | committed test | complete repository runtime unavailable in this session |
| explicit Writer 1A TARGET1/TARGET2 compatibility benchmarks | NOT_RUN_ENVIRONMENT | committed tests now pin `writerVersion: '1A'` | complete repository runtime unavailable |
| inherited shell/browser/full CII Workspace suite | NOT_RUN_ENVIRONMENT | committed/reconciled tests | complete repository runtime unavailable |

`PASS_IMPLEMENTATION_COUPLED` means the exact branch modules were reconstructed into the execution container and run under Node; it is not promoted to full-checkout PASS.

## Merge Assessment

PR992 is technically mergeable and the implemented mutation paths are fail-closed. The unresolved issue is validation coverage, not a known engineering defect. Merging now is defensible **only** under the same explicit owner-risk acceptance used for PR991: retain real TARGET1/TARGET2 and full lifecycle as `NOT_RUN_ENVIRONMENT` and do not represent them as PASS.

Under strict qualification without owner risk acceptance, do not merge until those committed tests run in a complete checkout.

## Changed-file Ledger

31 files are currently changed in PR992:

```text
agents/MASTER_INDEX.md
agents/PR992_workreport.md
agents/claims/PR992.yaml
agents/status/PR992.yaml
parser/sections/elements.js
tabs/cii-workspace/cii-workspace-capabilities.js
tabs/cii-workspace/cii-workspace-core.js
tabs/cii-workspace/cii-workspace-placeholders.js
tabs/cii-workspace/cii-workspace-restraint-slot-transfer.js
tabs/cii-workspace/cii-workspace-restraint-transfer.js
tabs/cii-workspace/cii-workspace-shell.js
tabs/cii-workspace/cii-workspace-target-writer-1b.js
tabs/cii-workspace/cii-workspace-topology-adapter.js
tabs/cii-workspace/cii-workspace-transfer-plan.js
tabs/cii-workspace/cii-workspace-transfer-policy.js
tabs/cii-workspace/cii-workspace-writer-validation.js
tabs/cii-workspace/cii-workspace-writer1b-deltas.js
tabs/cii-workspace/cii-workspace-writer1b-od.js
tests/cii-workspace-anchor-approval-ui.test.js
tests/cii-workspace-benchmark-writer-1a-restraint.test.js
tests/cii-workspace-benchmark-writer-1a.test.js
tests/cii-workspace-benchmark-writer-1b.test.js
tests/cii-workspace-elements-writer1b-layout.test.js
tests/cii-workspace-restraint-slot-writer-1b.test.js
tests/cii-workspace-shell-lifecycle.test.js
tests/cii-workspace-target-writer-1b.test.js
tests/cii-workspace-transfer-preview-policy.test.js
tests/cii-workspace-transfer-preview-ui.test.js
tests/cii-workspace-writer1b-negative-assurance.test.js
tests/cii-workspace-writer1b-od-eligibility.test.js
tests/cii-workspace-writer1b-policy.test.js
```

No workflow file or protected external CII writer is changed.

## Appendix A — Qualification

- Production trace: PASS — parser → topology evidence → engineering delta → review-gated transfer → Writer 1B readiness → exact mutation → re-intake → negative assurance → export.
- Failure isolation: PASS — remaining gap is environmental high-level execution; SIF/TEE and unsupported families remain blocked by design.
- Authority/invariants: PASS — source-qualified fixed fields only, target-native identity/pointers/cardinality preserved.
- Independent source validation: PASS for layout/custody; real benchmark runtime remains NOT_RUN_ENVIRONMENT.
- Handover: PASS — another agent can execute the committed benchmark/lifecycle suite without redesigning the implementation.
