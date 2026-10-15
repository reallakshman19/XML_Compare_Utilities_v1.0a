# PR1062 Work Report — retained-real Writer2 standalone benchmarks

## CURRENT STATE — READ FIRST

```text
HANDOVER_READINESS: READY
REPOSITORY: reallaksh19/XML_Compare_Utilities
BASE_MAIN: d1f7d773ec89459f55d3fca9bcf0c93f2308b1e1
BRANCH: agent/cii-writer2-benchmark-next
PR: #1062 / DRAFT / OPEN
PREDECESSOR: #1061 squash-merged at d1f7d773ec89459f55d3fca9bcf0c93f2308b1e1
WORK_INTENT: IMPLEMENT / VALIDATE
CRITICALITY: ENGINEERING_CRITICAL
EXECUTION_MODE: AUTO
AUTO_STATE: BLOCKED
HARD_STOP: EXACT_PRIVATE_PUBLIC_RUNTIME_REQUIRED_BEFORE_COMPOSITES
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
```

## Handover in 60 seconds

Phase-2 standalone benchmark **authoring** is complete for all four Writer2 mutation families, and a focused exact runtime layer is now closed for each family without using stubs/import rewrites/partial-core substitutes:

```text
BM-W2-01 NODENAME CREATE       public retained-real runtime NOT_RUN
  focused exact planner/writer PASS

BM-W2-02 SIF DELETE            public retained-real runtime NOT_RUN
  focused exact physical writer+validator PASS

BM-W2-03 HANGER DELETE-ALL     public retained-real runtime NOT_RUN
  focused exact planner+record-binding+tail-order+writer PASS

BM-W2-04 RESTRAINT DELETE      public retained-real runtime NOT_RUN
  inherited exact pointer-I13 PASS
  focused exact compaction-planner PASS
```

These focused PASSes do **not** promote the public `applyCiiWorkspaceTargetWriter2()` benchmark cases. A complete exact private checkout is still unavailable in this execution environment, so W2 A, the retained-real public benchmarks, W2 B, V14 gates and release freeze remain fail-closed.

Phase-3 composites BM-W2-05/06 remain blocked until the standalone **public** runtimes pass.

## Frozen benchmark source

```text
Benchmark/CIICompare/BM_CII_SOURCE.CII
Git blob e41cd05603b56837cbb6e31b9d4074ef6106fe9b
Neutral version V11
ELEMENTS 40
CONTROL.NOHGRS 1
CONTROL.NONAM 4
CONTROL.RESTRAINT 7
CONTROL.SIF&TEES 9
NODENAME rows 4
MISCEL_1 rows 23
```

## BM-W2-01 — NODENAME CREATE

Frozen retained-real case:

```text
node                 10
owner ELEMENT index  0
owner endpoints      10 -> 20
endpoint side        FROM
pointer               0 -> 5
name                  BM-N10
CONTROL.NONAM         4 -> 5
ELEMENT count         40 -> 40
connectivity          unchanged
```

Independent oracle:

```text
Benchmark/CIICompare/Writer2/cii-writer2-benchmark-nodename-oracle.js
blob ab770906e30fa4a0db156e083517af1d7793eb5c
```

Public retained-real test:

```text
tests/cii-workspace-writer2-benchmark-nodename-create.test.js
blob 7ba33984f290550f6f40eb91369ce9ceab1b74af
runtime NOT_RUN
```

### Reproduced fixed-FORTRAN defect and repair

Preimage Writer2 NODENAME writer:

```text
9e520ceaedc16b0bd36b70396bca3bfc9fd5996f
```

The ELEMENT NODENAME pointer used `numericField() -> formatCiiWriterSig6()`, which emits REAL-style tokens into an I13 pointer coordinate.

Exact source-contract falsifier:

```text
tests/cii-workspace-writer2-nodename-i13-source-contract.test.js
c80bca35e3b62f216eaab5bf8a48faaa21a276d7
```

Preimage result:

```text
FAIL AS EXPECTED
```

Surgical repair:

```text
- remove Writer1A formatCiiWriterSig6 dependency from NODENAME writer
- remove local REAL numericField helper
- ELEMENT NODENAME pointer now uses integerField(...)
```

Postimage production blob:

```text
eb6bff1cdd4dc1f50e101a4f2f2dc717c74bdd5c
```

Exact focused runtime:

```text
tests/cii-workspace-writer2-nodename-i13-focused-runtime.test.js
65896fd41e16efcd25dea97ad5a8848cbc87d03c
```

Exact admitted graph:

```text
fixed-field                 485daa43553681ca54f488499e57f36d2239be58
physical-file               0c4c445fbd3d4b929b1f9288b789b244547c8867
NODENAME relocation         326954e4d6342ba25915c107c7118b4f51c23610
NODENAME writer             eb6bff1cdd4dc1f50e101a4f2f2dc717c74bdd5c
focused test                65896fd41e16efcd25dea97ad5a8848cbc87d03c
```

Observed:

```text
CONTROL.NONAM   4 -> 5
pointer         0 -> 5
I13 token       "5"
PASS_RUNTIME_EXACT_5_FILE_BLOB_GRAPH
```

## BM-W2-02 — SIF DELETE

Public retained-real case remains authored/NOT_RUN.

Focused qualification used the repository's existing unchanged test:

```text
tests/cii-workspace-writer2-sif-delete-physical.test.js
65d70d2cab42ce19ac6648d9c6929dae56404990
```

Exact admitted graph:

```text
fixed-field                 485daa43553681ca54f488499e57f36d2239be58
physical-file               0c4c445fbd3d4b929b1f9288b789b244547c8867
contracts                   6ab30d8dd088225fd89bb729bf9ffdebefe652f6
Writer1C SIF custody        915ceb0a199091f00823e89d6c73c6007da62f9d
SIF delete planner          7213a92de3223c4ce9b82e80fa872a55fd992ee3
SIF physical writer         550e37e64ab0550adde1b372d50a4b35da96d5b2
SIF validator               13a0d5ebc43f7dd3b012f4c828cd4ae2ec67e011
existing test               65d70d2cab42ce19ac6648d9c6929dae56404990
```

All eight local files were `git hash-object` verified before execution.

Observed:

```text
middle delete   old mapping 1/2/3 -> 1/0/2
block count     3 -> 2
lexical I13     PASS
exact postimage PASS
unrelated-byte falsifier PASS
forged mutation testimony falsifier PASS
delete-all      3 -> 0 PASS
```

Classification:

```text
SIF_DELETE_FOCUSED_RUNTIME = PASS_RUNTIME_EXACT_8_FILE_BLOB_GRAPH
BM-W2-02_PUBLIC_RUNTIME    = NOT_RUN
```

## BM-W2-03 — HANGER DELETE-ALL

Frozen retained-real case:

```text
node                 205
layout               CAESAR_SYNCHRONIZER_IHGRNODE_FIRST
CONTROL.NOHGRS       1 -> 0
MISCEL_1             23 -> 11
retained rows        first 7 + last 4
connectivity         unchanged
```

Independent oracle:

```text
Benchmark/CIICompare/Writer2/cii-writer2-benchmark-hanger-oracle.js
16cbba8d5ac7dec1dc4e8cce1c5f0b6a9c728b3f
```

Public test:

```text
tests/cii-workspace-writer2-benchmark-hanger-delete-all.test.js
93703ac66fec9b663165d95a20afbc654b6e26f4
runtime NOT_RUN
```

Focused test:

```text
tests/cii-workspace-writer2-hanger-focused-runtime.test.js
2e45b358640e9028c66b11b108b6b8d44d2dd2d1
```

It uses a canonical one-hanger synchronizer fixture and executes the real HANGER evidence, planner, record-binding, tail-order and delete-all writer. No HANGER custody module is bypassed.

Exact admitted graph:

```text
fixed-field                 485daa43553681ca54f488499e57f36d2239be58
contracts                   6ab30d8dd088225fd89bb729bf9ffdebefe652f6
hanger evidence             71e5bca8cb3429878785244b5508e104add2fc57
physical-file               0c4c445fbd3d4b929b1f9288b789b244547c8867
record binding              7d860be728f1eddfb374391bae9b3ae49cac808c
tail order                  eda94b208239f324b45c9c70f57537c31a501e56
hanger delete planner       d104fe291c0bda1b41c29604a98671dae8a23a9a
hanger delete-all writer    5993c4e534438629a683b018f15dd013c37a20b2
focused test                2e45b358640e9028c66b11b108b6b8d44d2dd2d1
```

All nine hashes MATCH before execution.

Observed:

```text
hanger count        1 -> 0
post layout         CONTROL_NOHGRS_ZERO
post nodes          []
retained MISCEL     exact prefix + execution tail
PASS_RUNTIME_EXACT_9_FILE_BLOB_GRAPH
```

## BM-W2-04 — RESTRAINT DELETE/compaction

Public retained-real BM-W2-04 remains authored/NOT_RUN.

Inherited exact pointer-I13 gate remains PASS from PR #1060:

```text
cii-workspace-writer2-restraint-delete-custody.js
7053230546eaba4588b98a35ae5fc3819da83c14
```

This PR adds a stronger focused compaction runtime:

```text
tests/cii-workspace-writer2-restraint-compaction-focused-runtime.test.js
b7e76470cf416e595c556467b3207b4fe8d5d0ba
```

The fixture has three exact 24-row blocks owned uniquely by three ELEMENT pointers `1/2/3`; pointer2 is deleted. It executes the real compaction planner and lexical-I13 custody.

Exact admitted graph:

```text
fixed-field                 485daa43553681ca54f488499e57f36d2239be58
physical-file               0c4c445fbd3d4b929b1f9288b789b244547c8867
contracts                   6ab30d8dd088225fd89bb729bf9ffdebefe652f6
byte SHA-256                6435e0eaadc382a18aac6a0bd46318ab6c27c714
restraint pointer custody   7053230546eaba4588b98a35ae5fc3819da83c14
compaction planner          aedfb3ac78eed2294a88a64af261386f0db65085
focused test                b7e76470cf416e595c556467b3207b4fe8d5d0ba
```

All seven hashes MATCH before execution.

Observed:

```text
block count       3 -> 2
CONTROL count     3 -> 2
pointer mapping   1->1, 2->0, 3->2
pointer changes   E1 2->0; E2 3->2
deleted rows      [24,48)
lexical I13       PASS
CREATE authority  remains false
PASS_RUNTIME_EXACT_7_FILE_BLOB_GRAPH
```

## Runtime ladder truth

Focused runtime is not the public product gate:

```text
W2 A                                NOT_RUN
BM-W2-01 public retained-real       NOT_RUN
BM-W2-02 public retained-real       NOT_RUN
BM-W2-03 public retained-real       NOT_RUN
BM-W2-04 public retained-real       NOT_RUN
W2 B                                NOT_RUN
W2.35 generated V14                 NOT_RUN
W2.35a #1042 generated V14          NOT_RUN
W2.40 native V14                    NOT_RUN
W2 H release freeze                 NOT_READY
```

Reason:

```text
EXACT_PRIVATE_PUBLIC_RUNTIME_REQUIRED_BEFORE_COMPOSITES
```

This execution environment still has exact GitHub source/blob reads but no exact private checkout materialization into one runnable public-core filesystem. Native Git DNS remains unavailable.

## Phase 3 gate

Do **not** author BM-W2-05/06 yet.

Required sequence:

```text
W2 A public runtime PASS
BM-W2-01 public runtime PASS
BM-W2-02 public runtime PASS
BM-W2-03 public runtime PASS
BM-W2-04 public runtime PASS
-> then BM-W2-05
-> then BM-W2-06
```

The focused exact PASS layer reduces implementation uncertainty, but it does not satisfy that public-route requirement.

## Authority boundaries

No SIF/HANGER/RESTRANT CREATE, Writer3 topology, parser/converter rewrite, workflow modification, raw SIF field-2 semantic widening, benchmark-source modification, or validation weakening.

Only one production file changed in #1062:

```text
tabs/cii-workspace/cii-workspace-writer2-nodename-write.js
```

That change is tied to a reproduced exact I13 falsifier.

## Changed-file ledger

Benchmark/roadmap:

```text
ciibenchmarkroadmap.md
Benchmark/CIICompare/Writer2/CII_WRITER2_BENCHMARKS.json
Benchmark/CIICompare/Writer2/cii-writer2-benchmark-nodename-oracle.js
Benchmark/CIICompare/Writer2/cii-writer2-benchmark-hanger-oracle.js
```

Production:

```text
tabs/cii-workspace/cii-workspace-writer2-nodename-write.js
```

Tests authored in #1062:

```text
tests/cii-workspace-writer2-benchmark-nodename-create.test.js
tests/cii-workspace-writer2-benchmark-hanger-delete-all.test.js
tests/cii-workspace-writer2-nodename-i13-source-contract.test.js
tests/cii-workspace-writer2-nodename-i13-focused-runtime.test.js
tests/cii-workspace-writer2-hanger-focused-runtime.test.js
tests/cii-workspace-writer2-restraint-compaction-focused-runtime.test.js
```

Existing unchanged test used for focused evidence:

```text
tests/cii-workspace-writer2-sif-delete-physical.test.js
```

Recovery:

```text
agents/PR1062_workreport.md
agents/status/PR1062.yaml
agents/claims/PR1062.yaml
```

## Exact continuation

When a complete exact private checkout is available, run unchanged in this order:

```text
node tests/cii-workspace-writer2-restraint-product-routing.test.js
node tests/cii-workspace-writer2-benchmark-nodename-create.test.js
node tests/cii-workspace-writer2-benchmark-sif-delete.test.js
node tests/cii-workspace-writer2-benchmark-hanger-delete-all.test.js
node tests/cii-workspace-writer2-benchmark-restraint-delete.test.js
```

Stop on first authored product falsifier. Only after all required standalone public gates PASS may AUTO MODE author BM-W2-05/06.

## Appendix A — takeover qualification

1. Reproduce the NODENAME I13 preimage failure and explain why numeric reparsing was insufficient.
2. Name all five exact blobs in the NODENAME focused writer runtime and derive `0 -> 5`.
3. Name all eight SIF focused blobs and explain the independent exact-postimage/anti-testimony checks.
4. Name all nine HANGER focused blobs and explain why record-binding and tail-order could not be stubbed out.
5. Derive the RESTRAINT `1/2/3 -> 1/0/2` compaction and name all seven exact blobs.
