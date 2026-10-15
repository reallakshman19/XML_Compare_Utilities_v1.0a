# PR1059 Work Report — Writer2 W2 A + retained-real benchmark closure

## CURRENT STATE — READ FIRST

```text
HANDOVER_READINESS: READY
REPOSITORY: reallaksh19/XML_Compare_Utilities
BASE_MAIN: 9685a2f41ec2b5a5c170762816702fefe90e18a7
BRANCH: agent/cii-writer2-w2a-runtime-closure
PR: #1059 / DRAFT / OPEN
CRITICALITY: ENGINEERING_CRITICAL
WORK_INTENT: IMPLEMENT / INVESTIGATE / VALIDATE
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
RELEASE_FREEZE: NOT_READY_FOR_WRITER2_RELEASE_FREEZE
```

PR #1059 has two active but distinct qualification tracks:

1. **W2 A exact public runtime** — unchanged committed synthetic test remains `NOT_RUN_GRAPH_RECONSTRUCTION_IN_PROGRESS` until its complete exact ESM graph executes.
2. **CII retained-real benchmark program** — owner explicitly instructed on 2026-08-27: `create a ciibenchmarkroadmap.md, then start coding`. Phase 1 is now authored around frozen real `BM_CII_SOURCE.CII` using an independent structural oracle for RESTRAINT block delete/compaction.

The benchmark work does **not** replace W2 A and does **not** promote W2 B. It supplies the retained-real oracle that W2 B will use after W2 A passes.

## Handover in 60 seconds

Inherited gates:

```text
W2.34 focused bridge/export      PASS
W2 C0 exact 14-file public route PASS
W2 A synthetic public runtime    NOT_RUN
W2 B retained-real V11           NOT_RUN
W2.35 generated V14              NOT_RUN
W2.35a #1042 generated V14       NOT_RUN
W2.40 native V14                 NOT_RUN
W2 H release freeze              NOT_READY
```

The V14 fixed-FORTRAN I13 hardening is already implemented and focused-runtime qualified. Exact preimage `fc97ddd7...` fails the new lexical-I13 falsifier; exact postimage `5f1473f...` and the existing V14 fixed-field regression pass under exact Git-blob reconstruction. Classification remains:

```text
W2_V14_I13_LEXICAL_FIXED_FIELD_AUTHORITY = PASS_RUNTIME_EXACT_3_FILE_BLOB_SUBGRAPH
```

New benchmark Phase 1:

```text
roadmap
  ciibenchmarkroadmap.md

frozen source
  Benchmark/CIICompare/BM_CII_SOURCE.CII
  Git blob e41cd05603b56837cbb6e31b9d4074ef6106fe9b
  frozen at main@9685a2f41ec2b5a5c170762816702fefe90e18a7

manifest
  Benchmark/CIICompare/Writer2/CII_WRITER2_BENCHMARKS.json

independent oracle
  Benchmark/CIICompare/Writer2/cii-writer2-benchmark-oracle.js
  imports no Writer2 writer/planner/mutation code

Phase-1 authored test
  tests/cii-workspace-writer2-benchmark-restraint-delete.test.js

case
  BM-W2-04 / retained-real V11 RESTRAINT DELETE
  pointer 1
  slot 1
  node 190
  unique owner 180 -> 190

expected
  RESTRAINT blocks 7 -> 6
  RESTRAINT rows 168 -> 144
  deleted owner pointer 1 -> 0
  every retained pointer p > 1 -> p - 1
  CONTROL.NONAM remains 4
  ELEMENT count remains 40
  connectivity unchanged
  changed CONTROL/ELEMENT count-pointer fields remain lexical I13
```

Phase-1 runtime is **NOT_RUN**. The test and live Writer2 API contracts were source-inspected, but no exact complete ESM graph execution has yet occurred. Do not relabel authored/source-inspected evidence as runtime PASS.

## Ground truth

- repository: `reallaksh19/XML_Compare_Utilities`
- base: `main@9685a2f41ec2b5a5c170762816702fefe90e18a7`
- branch: `agent/cii-writer2-w2a-runtime-closure`
- PR: #1059 draft/open
- predecessor: PR #1058 merged at base SHA above
- W2 A test: `tests/cii-workspace-writer2-restraint-product-routing.test.js`
- W2 A test blob: `9922377ddeda86fc9167d65f33c97095346e79fa`
- public entrypoint: `applyCiiWorkspaceTargetWriter2`
- frozen retained benchmark source blob: `e41cd05603b56837cbb6e31b9d4074ef6106fe9b`
- owner I13 write instruction: `ok fix them`
- owner benchmark scope instruction: `create a ciibenchmarkroadmap.md, then start coding`
- merge authority: owner only / not granted

## Authority boundaries

### Allowed in current owner-approved scope

- retain the prior V14 Writer2 lexical-I13 production correction;
- author benchmark roadmap, manifests, independent oracles and tests;
- use frozen real benchmark evidence to qualify already-existing Writer2 behavior;
- fix an additional Writer2 production defect only if exact authored runtime reproduces that defect.

### Not authorized by benchmark work

- Writer3 topology changes;
- SIF CREATE semantics;
- HANGER CREATE semantics;
- RESTRAINT CREATE/allocation semantics;
- raw SIF/TEE field-2 semantic mutation authority;
- lossy V14 conversion;
- relabelling converter-generated V14 as native V14;
- weakening complete-postimage validation;
- promoting W2 A/B or browser gates without execution.

## Completed prior slice — V14 lexical I13 hardening

### Defect

The preimage V14 Writer2 fixed-field authority accepted numerically integral REAL spellings such as:

```text
3.000000
3.000000E+00
3.000000D+00
```

for fields whose CAESAR fixed-FORTRAN contract is lexical I13.

### Patch

Production path:

```text
tabs/cii-workspace/cii-workspace-v14-writer2-fixed-field-authority.js
preimage  fc97ddd7fd5645e46c70a722c7f96f17dc7ae188
postimage 5f1473f692c172de5aa0712a70bc72d917a6934d
```

The parser now gates integer count/pointer text through:

```js
const INTEGER_RX = /^[+-]?\d+$/;
```

Focused falsifier:

```text
tests/cii-workspace-v14-writer2-i13-lexical.test.js
blob 37703add4fbefd5e5636ef49a4b54214e33e5820
```

Existing regression:

```text
tests/cii-workspace-v14-writer2-fixed-field-authority.test.js
blob 78dbe0af0b8d0d8fd55aae26f586f727bb2d03df
```

Exact focused execution:

```text
preimage + new test
  FAIL AS EXPECTED: actual 3, expected null

postimage + new test
  PASS

postimage + existing regression
  PASS
```

No generic parser, converter, Writer3 topology or CREATE semantics changed.

## CII benchmark roadmap

`ciibenchmarkroadmap.md` defines the benchmark ladder:

```text
BM-W2-00 identity
BM-W2-01 NODENAME CREATE
BM-W2-02 V11 SIF block DELETE
BM-W2-03 HANGER DELETE-ALL
BM-W2-04 RESTRAINT block DELETE/compaction
BM-W2-05 tri-family composite
BM-W2-06 four-family composite
```

and negative cases:

```text
NEG-01 unrelated byte drift
NEG-02 stale preview/hash
NEG-03 wrong CONTROL field
NEG-04 wrong pointer relocation
NEG-05 non-lexical I13
NEG-06 wrong V11 SIF 10-row cardinality
```

The version ladder stays explicit:

```text
W2 A     synthetic public runtime; benchmark does not replace
W2 B     BM-W2-04 retained-real V11
W2.35    BM-W2-04 converter-generated V14
W2.35a   separate #1042 generated-V14 regression
W2.40    genuine native V14 only
W2 H     aggregate release freeze
```

## Phase 1 implementation — BM-W2-04

### Frozen real record

The benchmark intentionally does not discover a convenient record at runtime. Its manifest freezes:

```text
RESTRAINT pointer         1
slot                      1
node                      190
owner element             180 -> 190
expected pointer owners   1
expected occupied slots   1
expected node records     1
```

Any drift fails the benchmark. There is no dynamic fallback candidate.

### Independent oracle

Path:

```text
Benchmark/CIICompare/Writer2/cii-writer2-benchmark-oracle.js
```

The oracle uses only fixed-format/section logic implemented inside the benchmark module. It imports no Writer2 mutation code.

For BM-W2-04 it independently verifies:

1. CRLF-only retained source;
2. CONTROL restraint count exactly 7;
3. CONTROL NONAM exactly 4;
4. ELEMENTS exactly `40 * 15` rows;
5. pointer-1 unique owner is `180 -> 190`;
6. RESTRANT exactly 168 rows / 7 blocks;
7. block 1 slot 1 is occupied by node 190;
8. only one slot in that block is occupied;
9. TAG/GUID are blank;
10. exactly one retained semantic restraint record exists at node 190.

It then builds the expected postimage independently:

```text
CONTROL restraint count 7 -> 6 using lexical I13
ELEMENT pointer 1 -> 0
ELEMENT pointer p > 1 -> p - 1
delete exactly first 24 RESTRANT rows
preserve all other physical line text
```

This avoids the anti-pattern `Writer2 output == expected because Writer2 generated expected`.

### Authored benchmark test

Path:

```text
tests/cii-workspace-writer2-benchmark-restraint-delete.test.js
```

The test is authored to verify:

- source Git blob SHA-1 equals frozen `e41cd056...`;
- source intake/version/element count;
- frozen pointer/node/owner/slot custody;
- low-level `applyCiiWriter2CompositeWithRestraintDelete()` output equals the independent oracle byte-for-byte;
- public `applyCiiWorkspaceTargetWriter2()` output equals the same independent oracle;
- public and low-level outputs are exactly equal;
- `validateCiiWriter2ProductRoundTrip()` passes on the oracle postimage;
- CONTROL row1/NONAM remains byte-identical;
- only CONTROL restraint count changes in CONTROL;
- postimage CONTROL and ELEMENT restraint pointers remain lexical I13;
- ELEMENT connectivity remains identical;
- independent pointer-relocation map is realized in postimage custody;
- one unrelated header-byte tamper fails `EXACT_COMPLETE_POSTIMAGE_MISMATCH`;
- replay against the postimage fails stale-target custody.

### Live API cross-check

Source inspection confirms current live contracts match the authored test:

```text
applyCiiWriter2CompositeWithRestraintDelete()
  result schema CIIWorkspaceWriter2CompositeRestraintResult.v1
  components.restraintDelete retained
  familyMutationCounts.restraintDeleteOperations retained

validateCiiWriter2ProductRoundTrip(before, after, graph, transferPlan, writerResult)
  dispatches restraint result schema
  requires restraint component testimony
  returns productValidatorClass RESTRAINT_DELETE_COMPOSITE
```

Classification:

```text
BM-W2-04 source/API contract = PASS_SOURCE_INSPECTION
BM-W2-04 authored test       = AUTHORED
BM-W2-04 exact runtime       = NOT_RUN
W2 B                         = NOT_RUN
```

## Current changed-file ledger

PR #1059 currently intentionally contains:

```text
agents/PR1059_workreport.md
agents/claims/PR1059.yaml
agents/status/PR1059.yaml

# Prior focused production correction
tabs/cii-workspace/cii-workspace-v14-writer2-fixed-field-authority.js
tests/cii-workspace-v14-writer2-i13-lexical.test.js

# Benchmark program
ciibenchmarkroadmap.md
Benchmark/CIICompare/Writer2/CII_WRITER2_BENCHMARKS.json
Benchmark/CIICompare/Writer2/cii-writer2-benchmark-oracle.js
tests/cii-workspace-writer2-benchmark-restraint-delete.test.js
```

No workflow file, frozen upstream converter, benchmark source file, Writer3 topology module, SIF/HANGER/RESTRAINT CREATE implementation, or generic fixed-field parser was changed by the benchmark phase.

## Validation ledger

| Gate | Status | Observation | Oracle / evidence | Notes |
|---|---|---|---|---|
| W2.34 focused bridge/export | PASS inherited | prior exact runtime | predecessor | unchanged |
| W2 C0 exact route/export | PASS inherited | prior exact runtime | predecessor | unchanged |
| V14 I13 preimage falsifier | FAIL as expected | LOCAL_EXECUTION / EXACT_GIT_BLOB | authored falsifier | defect reproduced |
| V14 I13 patched focused gate | PASS | LOCAL_EXECUTION / EXACT_GIT_BLOB | authored tests | exact 3-file graph |
| benchmark roadmap | AUTHORED | SOURCE_INSPECTION | owner-approved plan | no runtime claim |
| benchmark manifest | AUTHORED | SOURCE_INSPECTION | frozen BM source facts | no runtime claim |
| BM-W2-04 independent oracle | AUTHORED | SOURCE_INSPECTION | no Writer2 imports | no runtime claim |
| BM-W2-04 Writer2/API compatibility | PASS | SOURCE_INSPECTION | live RESTRAINT composite/product-validator contracts | execution still required |
| BM-W2-04 exact public runtime | NOT_RUN | NOT_OBSERVED | independent oracle required | graph not materialized |
| W2 A exact public runtime | NOT_RUN | NOT_OBSERVED | exact graph required | unchanged test |
| W2 B retained-real V11 | NOT_RUN | NOT_OBSERVED | BM-W2-04 candidate | cannot promote before W2 A PASS |
| generated/native V14 gates | NOT_RUN | NOT_OBSERVED | none | later phases |
| release freeze | NOT_READY | SOURCE/STATE | required gates incomplete | no promotion |

## Runtime/environment boundary

Native Git access from the execution container remains unavailable:

```text
git ls-remote https://github.com/reallaksh19/XML_Compare_Utilities.git HEAD
fatal: Could not resolve host: github.com
```

The GitHub connector provides exact source/blob access but not a repository/archive materialization endpoint. Small focused graphs were reconstructed exactly for the I13 gate. W2 A and the new BM-W2-04 public test still require exact transitive graph materialization before runtime classification.

## Exact next actions

Order:

```text
1. Materialize the exact BM-W2-04 test graph from current branch.
2. Git-blob verify every admitted repository file.
3. Run unchanged:
   node tests/cii-workspace-writer2-benchmark-restraint-delete.test.js
4. First authored assertion/runtime failure after graph completion = genuine benchmark FAIL.
5. Clean completion = BM-W2-04 runtime PASS only; do not yet promote W2 B unless W2 A is also PASS.
6. Continue exact W2 A graph reconstruction and unchanged W2 A execution.
7. When W2 A + BM-W2-04 both PASS, promote/run W2 B retained-real qualification.
8. Only then proceed to generated V14 and native V14 benchmark phases.
```

Do not modify additional production Writer behavior unless an exact authored execution exposes a reproducible defect.

## Appendix A — takeover qualification

1. Trace BM-W2-04 from frozen `BM_CII_SOURCE.CII` pointer 1 / node 190 / owner `180->190`, through independent oracle construction, low-level RESTRAINT composite, public Writer2 route and product validation. Identify every authorized physical coordinate.
2. Prove why the independent oracle is not implementation-coupled to Writer2. Show how it derives `7->6`, `168->144`, pointer `1->0`, and `p>1 -> p-1` from frozen source/manifest authority.
3. Explain why CONTROL row1 field4 NONAM must remain exactly 4 while CONTROL row2 field4 RESTRAINT changes 7->6, including lexical I13 requirements.
4. Show why benchmark runtime remains NOT_RUN after source/API inspection and identify the exact event that converts BM-W2-04 to PASS or FAIL.
5. State the next minimal production action if exact BM-W2-04 runtime disagrees with the independent oracle. The answer must isolate the first wrong boundary; changing the oracle to match Writer2 is disallowed without independent source evidence.
