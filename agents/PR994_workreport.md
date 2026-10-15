# PR994 — CII independent multi-base Method A/B core

# CURRENT RECOVERY STATE — READ FIRST

## Recovery Header

```text
HANDOVER_READINESS: READY
PR_RECOVERY_STATE: DRAFT_IMPLEMENTATION_COMPLETE_OD_SCALED_FOCUSED_PASS_REAL_BENCHMARK_AUTHORED
WORK_INTENT: IMPLEMENT
CRITICALITY: ENGINEERING_CRITICAL
REPOSITORY: reallaksh19/XML_Compare_Utilities
SOURCE_TASK: Issue #993 — first core increment only
PR: 994
BRANCH: agent/cii-multi-base-core
BASE: main@a2acb8b3d3c49a14a4be045112e05bd21b476e95
MERGE_AUTHORITY: OWNER_ONLY
CURRENT_STAGE: HANDOVER_RECONCILE
GROUNDING_EPOCH: GE-007 / 2026-08-19
APPENDIX_A_STATUS: PASS_FOR_CURRENT_CORE_INCREMENT
CURRENT_BLOCKER: NONE_FOR_REVIEW; SOURCE-3/TARGET3-1 EXECUTION NOT_RUN_ENVIRONMENT
HIGHEST_RISK: real-CII execution/calibration must not weaken OD/two-axis/cross-compatible-3D/conflict hard gates
EXACT_NEXT_ACTION: execute SOURCE-3/TARGET3-1 plus inherited CII suite in a complete checkout; do not merge without explicit owner authorization.
```

## Handover in 60 Seconds

Current authority:

```text
independent Method A local bases
          OR
independent Method B local bases
          ↓
compatible READY evidence accumulates
READY source/target identity collision => AMBIGUOUS
```

Owner tolerance policy:

```text
T = x * SOURCE_OD
x default = 2.0
x configurable
SOURCE OD reference = minimum positive incident SOURCE OD
OD role = tolerance scale only
TARGET OD = no tolerance or identity authority
```

Method A uses per-anchor `residual/(x*SOURCE_OD) <= 1`. Missing SOURCE OD for 3+ anchors is `UNAVAILABLE`; no fixed-mm fallback. Alternate admissible triplets in one local base that materially disagree fail closed with `METHOD_A_AMBIGUOUS_BASES`.

Method B compares run-length error and angular-equivalent displacement against the same SOURCE-OD-scaled tolerance. It retains the hard >=2 independent-run gate. Additional planar/full-3D weight is earned only when additional SOURCE/TARGET runs are mutually compatible; unrelated third axes cannot manufacture 3D confidence.

`SOURCE-3.CII` and `TARGET3-1.CII` were added to `main` during this work and have now been merged into the PR branch as the current base. They provide a real multi-base qualification case rather than a synthetic-only one.

## Repository Ground Truth

```text
PR994: OPEN / DRAFT / UNMERGED
base: main@a2acb8b3d3c49a14a4be045112e05bd21b476e95
branch: agent/cii-multi-base-core
latest compare after benchmark merge: ahead / 0 behind
changed files relative to current main: 17
merge authority: OWNER_ONLY
```

The `main@a2acb8b3` delta from the prior base added only:

```text
Benchmark/CIICompare/SOURCE-3.CII
Benchmark/CIICompare/TARGET3-1.CII
```

No production-code overlap was introduced by that base advance.

## Mission / Scope

Implemented in this core PR:

1. Method A local multi-basis rigid registration and ambiguity veto.
2. Independent Method A OR loops.
3. Method B executable undirected pipe-run basis and two-axis hard gate.
4. Independent Method B OR loops.
5. Cross-loop source/target identity conflict veto.
6. Configurable `x*SOURCE_OD` tolerance, default x=2.
7. Method A evidence weighting.
8. Method B OD-scaled run-length and angular-equivalent-displacement qualification.
9. Method B cross-compatible planar/full-3D complexity weighting.
10. Synthetic regressions plus independent Python numerical oracle.
11. Authored real-CII regression using `SOURCE-3.CII` / `TARGET3-1.CII`.

Out of scope and unchanged:

```text
full-screen/UI orchestration
workspace-wide independent-loop propagation
transfer APPLY/EXCLUDE
Writer 1A / Writer 1B
transfer policy / transfer plan
fixed-field parser
SIF/Tee or NodeName mutation
protected external CII converter/writer
workflow files
```

## Real Benchmark Evidence — SOURCE-3 vs TARGET3-1

### File-level revision evidence

```text
SOURCE-3 CONTROL ELEMENT count = 219
TARGET3-1 CONTROL ELEMENT count = 223
SOURCE bend count = 37
TARGET bend count = 38
```

The target therefore is not a trivial renumbered clone; it contains structural revision growth.

### Multiple local numbering regimes

The same file pair contains manually observed geometry-equivalent edges with different node-number offsets:

| Local base | SOURCE edge | TARGET edge | Identical geometry evidence | TARGET-SOURCE node offset |
|---|---|---|---|---:|
| A | 20000→20010 | 7000→7010 | Δ=(-88.9,0,0), OD=114.3 | -13000 |
| B | 60880→60890 | 7250→7260 | local vertical geometry, OD=114.3 | -53630 |
| C | 6030→6040 | 7650→7660 | Δ=(+489,0,0), OD=168.3 | +1620 |

Therefore one global node-number offset is mathematically invalid for this real file pair. Node number/offset remains non-authoritative identity evidence.

### Real Method A acceptance basis

Authored benchmark anchors:

```text
60920 ↔ 7290
60930 ↔ 7300
60940 ↔ 7310
```

At the SOURCE, `60920→60930` is vertical with `ΔZ=-450 mm`; `60930→60940` is horizontal with `ΔX=-152 mm`. The three nodes are therefore non-collinear. SOURCE OD is 114.3 mm around the basis.

Expected default Method A tolerance:

```text
T = 2 * 114.3 = 228.6 mm
```

Acceptance expectation in `tests/cii-workspace-benchmark-base-anchor.test.js`:

```text
status = READY
factor = 2
basisAgreementToleranceMm = 228.6
maxNormalizedResidual <= 1
```

This expectation is AUTHORED, not yet an observed PASS.

### Real Method B acceptance anchor

Authored real Method B anchor:

```text
SOURCE 60930 ↔ TARGET 7300
```

The physical location has at least two independent incident run directions on SOURCE and TARGET. Expected SOURCE OD reference is 114.3 mm, therefore default tolerance is 228.6 mm.

Acceptance expectation:

```text
SOURCE independentAxisRunCount >= 2
TARGET independentAxisRunCount >= 2
odAuthority = SOURCE
odRefMm = 114.3
toleranceMm = 228.6
status = READY
geometryComplexity >= 24
```

Again: AUTHORED, NOT_RUN_ENVIRONMENT.

## Method A Authority

For local anchor `i`:

```text
Ti = x * SOURCE_OD_i
ei = residual_i / Ti
hypothesis admissible iff max(ei) <= 1
```

All qualified non-collinear triplets are enumerated. Every hypothesis is checked against all anchors assigned to the local base. Admissible transforms that materially disagree beyond the OD-scaled base tolerance make that base `METHOD_A_AMBIGUOUS_BASES`.

Method A evidence weight /100:

```text
residual quality      35
conditioning          25
spatial extent        20
anchor redundancy     10
basis consensus       10
```

Current provisional bands: HIGH >=85; MEDIUM >=70; otherwise REVIEW. Ambiguity remains a hard veto regardless of score.

## Method B Authority

Run construction:

```text
maximal straight PIPE run
continue through degree-2 nodes only
opposite collinear rays merge into one undirected run
run collinearity default = 0.5 deg
independent-axis minimum = 15 deg
```

Cross-revision physical compatibility:

```text
lengthNormalized = abs(LS-LT)/(x*SOURCE_OD)

dTheta = abs(thetaS-thetaT)
dAngular = 2*Lcharacteristic*sin(dTheta/2)
angleNormalized = dAngular/(x*SOURCE_OD)

qualified iff lengthNormalized <= 1
             and angleNormalized <= 1
             and terminator/topology evidence is compatible
```

Method B weight /100:

```text
geometry complexity          40
run compatibility            20
terminator/topology          15
structural neighbourhood     15
mutual-best + winner gap     10
```

Geometry-complexity credit is based on the largest compatible mapped run set:

```text
<2 compatible independent axes        0/40; REVIEW hard cap
2 compatible independent axes        24/40
3+ compatible coplanar axes          32/40
3+ compatible non-coplanar axes      32 + 8*V
V = mapped SOURCE/TARGET scalar-triple-product evidence, capped at 1
orthogonal compatible XYZ            40/40
```

A changed/unrelated third run may coexist with a qualified two-axis READY basis, but it receives only two-axis complexity credit.

## Validation Ledger

### PASS — focused implementation-coupled JS

```text
node --check focused current production/test modules
node tests/cii-workspace-geometry-authority.test.js
node tests/cii-workspace-multi-base-authority.test.js
node tests/cii-workspace-base-anchor-suggestions.test.js
```

Proven in focused JS:

```text
x configurability
SOURCE-OD tolerance scaling
TARGET-OD invariance
missing SOURCE OD fail closed
Method-A alternate-base ambiguity
one-axis Method-B REVIEW cap
400 mm run mismatch: x=2 PASS / x=1 REVIEW for OD273
3 degree vs 5 degree angular-equivalent-displacement boundary
0/24/32/40 geometry complexity
changed third run receives no false 3D credit
A/B OR + conflict veto
```

### PASS — independent Python oracle

```text
python tests/qualification/cii-workspace-multi-base-oracle.py
Production JavaScript imports: NONE
```

The oracle independently reproduces `x*OD`, Method-A ambiguity, Method-B length/angular tolerance and 0/24/32/40 complexity expectations.

### AUTHORED / NOT_RUN — real SOURCE-3/TARGET3-1 benchmark

```text
tests/cii-workspace-benchmark-base-anchor.test.js
benchmark content: PRESENT ON CURRENT MAIN/PR BRANCH
benchmark expectation: AUTHORED
full execution: NOT_RUN_ENVIRONMENT
```

The latest benchmark test file received reconstructed syntax validation locally, but the exact current Git blob was not executed with complete benchmark files in the local runtime. It is therefore not represented as PASS.

### Other NOT_RUN

```text
coordinate-invariance full execution: NOT_RUN_ENVIRONMENT
full inherited CII Workspace suite: NOT_RUN_ENVIRONMENT
full repository npm test: NOT_RUN_ENVIRONMENT
browser/Chromium: NOT_RUN_ENVIRONMENT
Writer lifecycle: NOT_RUN_OUT_OF_SCOPE
GitHub Actions/CI: refresh exact current head; no PASS claim without observed run
```

## Changed-File Ledger

Current PR diff relative to `main@a2acb8b3` is 17 files. The two new benchmark `.CII` files do not appear in the PR diff because they are now part of the base.

Intended PR paths:

```text
agents/MASTER_INDEX.md
agents/PR994_workreport.md
agents/status/PR994.yaml
agents/claims/PR994.yaml
agents/claims/WIP-CII993-MULTIBASE.yaml   historical inactive pointer
tabs/cii-workspace/cii-workspace-contracts.js
tabs/cii-workspace/cii-workspace-geometry.js
tabs/cii-workspace/cii-workspace-pipe-runs.js
tabs/cii-workspace/cii-workspace-multi-base-anchor.js
tabs/cii-workspace/cii-workspace-anchor-suggestions.js
tabs/cii-workspace/cii-workspace-core.js
tests/cii-workspace-geometry-authority.test.js
tests/cii-workspace-base-anchor-suggestions.test.js
tests/cii-workspace-multi-base-authority.test.js
tests/cii-workspace-coordinate-invariance.test.js
tests/cii-workspace-benchmark-base-anchor.test.js
tests/qualification/cii-workspace-multi-base-oracle.py
```

No Writer, transfer, fixed-field parser, workflow or protected converter file is changed.

Production physical-line counts at the current core checkpoint:

```text
geometry            227
pipe-runs           272
multi-base           71
anchor-suggestions  124
core                 153
```

All remain below the 300-line module heuristic.

## Continuation / Custody

```text
Start: current PR994 diff + this workreport.
Do not redo: OR semantics, x*SOURCE_OD authority, cross-compatible 3D-weight rule.
Do not modify in this PR: Writer, transfer policy/plan, fixed-field parser, external writer, workflows.
Required before wider authority: execute SOURCE-3/TARGET3-1 and inherited CII suite in a complete checkout.
Merge: OWNER_ONLY; PR must remain draft until explicitly authorized.
```

## Takeover Chain

- GE-001: Issue #993 and source boundaries re-grounded.
- GE-002: Method A multi-basis + Method B executable two-axis core implemented.
- GE-003/004: independent OR/conflict core integrated and focused qualified.
- GE-005: fixed tolerance superseded by configurable `x*SOURCE_OD`, default x=2; explicit Method A/B weighting added.
- GE-006: Method-B extra 3D weight tightened to require additional cross-compatible mapped runs.
- GE-007: `main` advanced with `SOURCE-3.CII` / `TARGET3-1.CII`; branch normalized to new base; real multi-offset Method A/B regression authored and retained as NOT_RUN_ENVIRONMENT.

# APPENDIX A — IMPLEMENTATION QUALIFICATION

A1 Method A: independent local OR bases; every qualified triplet validates all local anchors using per-anchor `r/(x*SOURCE_OD)`; missing OD fails closed; alternate admissible transform disagreement => AMBIGUOUS.

A2 Method B: maximal undirected straight PIPE runs; >=2 independent axes hard gate; cross-revision run and angle differences converted to SOURCE-OD-scaled physical errors; additional 3D weight only from additional compatible mapped runs.

A3 UI/transfer: not implemented in this core slice. Future APPLY/EXCLUDE must remain downstream of correspondence/delta authority and upstream of unchanged Writer readiness.

# HISTORICAL RECORD — NOT CURRENT AUTHORITY

The first PR994 draft used fixed 2 mm Method-A residual/basis tolerance and fixed 10%/2-degree Method-B cross-revision comparisons. On 2026-08-19 the owner superseded those with configurable `x*SOURCE_OD`, default x=2, and requested higher weight for more complex 3D geometry. GE-006 further required that extra 3D credit be based on cross-revision-compatible extra runs. GE-007 added the real `SOURCE-3/TARGET3-1` qualification case, which demonstrates multiple local node-number regimes inside one file pair and therefore reinforces the prohibition on global node-offset identity authority.
