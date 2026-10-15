# CII Writer2 Benchmark Roadmap

## Purpose

Create a retained, auditable Writer2 benchmark ladder from the exact frozen real file:

```text
Benchmark/CIICompare/BM_CII_SOURCE.CII
Git blob: e41cd05603b56837cbb6e31b9d4074ef6106fe9b
Frozen source commit: 9685a2f41ec2b5a5c170762816702fefe90e18a7
Neutral version: V11
```

The benchmark program separates source/engineering custody, focused family runtime, and public-product runtime qualification. Writer2 output must never become its own sole oracle. Generated V14 and native V14 remain different evidence classes.

Current relay custody is indexed by:

```text
agents/agentchain.md
agents/agentchain/CII-WRITER2-RUNTIME-QUALIFICATION/
```

## Governing rules

1. Every case is tied to the exact frozen source blob.
2. Standalone mutation families are qualified before composites.
3. Expected postimages are constructed by independent benchmark modules that do not import Writer2 mutation code.
4. Fixture drift fails closed; no dynamic fallback candidate is allowed for a frozen case.
5. Bytes and semantics outside authorized mutation coordinates remain unchanged.
6. Writer2 benchmarks preserve ELEMENT connectivity/topology.
7. I13 count/pointer coordinates require lexical integers, not merely numerically integral values.
8. V11 retained-real, generated V14, #1042 generated V14, and native V14 remain separate gates.
9. Focused family runtime success does not qualify the public product route.
10. Source inspection never promotes an unexecuted runtime gate to PASS.
11. Missing checkout/module transport is NOT_RUN, not authored FAIL.
12. Any additional production repair after the closed NODENAME I13 defect requires a reproduced falsifier at the first wrong product boundary; do not patch around environment/materialization stops.

## Frozen baseline

```text
ELEMENTS                  40 x 15-row blocks
CONTROL.NOHGRS            1
CONTROL.NONAM              4
CONTROL.RESTRAINT blocks   7
CONTROL.SIF&TEES blocks    9
NODENAME rows              4
RESTRANT rows/block        24
SIF&TEES rows/block        10
HANGER count               1
HANGER node                205
MISCEL_1 rows              23
```

Machine-readable authority:

```text
Benchmark/CIICompare/Writer2/CII_WRITER2_BENCHMARKS.json
```

## Benchmark ladder

### BM-W2-00 — identity/control

```text
input      BM_CII_SOURCE.CII
operation  none
expected   byte-identical identity
state      AUTHORED_SELF_CHECK
runtime    SELF_CHECK_SOURCE_REVIEW
```

Purpose: zero-delta intake/export custody.

Independent byte-identity oracle:

```text
Benchmark/CIICompare/Writer2/cii-writer2-benchmark-identity-oracle.js
blob 79a5242bea3a2ade5b72a343c135686a6c25e7ea
```

Authored self-check:

```text
tests/cii-workspace-writer2-benchmark-identity-control.test.js
blob 0479cbe7db7cd02c9f85d63d538b1a1de52e10a6
```

The self-check binds the untouched frozen bytes as the independent postimage authority, requires unchanged topology/content hash, and proves that zero operations do not manufacture Writer2 mutation authority. This authored source-level self-check is not a public-product runtime PASS.

### BM-W2-01 — retained-real NODENAME CREATE

Frozen candidate:

```text
node                   10
owner element index    0
owner                   10 -> 20
owner endpoint          FROM
pointer before          0
name after              BM-N10
existing NODENAME rows 4
pointer after           5
```

The active Writer2 relocation authority is:

```text
tabs/cii-workspace/cii-workspace-writer2-nodename-relocation.js
blob 326954e4d6342ba25915c107c7118b4f51c23610
```

CREATE allocation rule:

```text
no existing physical NODENAME field
-> collect exact incident pointer=0 bindings
-> choose lowest parsed ELEMENT index
-> append after retained NODENAME rows
-> assign resulting 1-based row pointer
```

Independent expected transition:

```text
CONTROL.NONAM       4 -> 5
NODENAME rows       4 -> 5
ELEMENT0 pointer    0 -> 5
ELEMENT count       40 -> 40
connectivity        unchanged
pointer syntax      lexical I13
```

Independent oracle:

```text
Benchmark/CIICompare/Writer2/cii-writer2-benchmark-nodename-oracle.js
blob ab770906e30fa4a0db156e083517af1d7793eb5c
```

Authored public-product test:

```text
tests/cii-workspace-writer2-benchmark-nodename-create.test.js
blob 7ba33984f290550f6f40eb91369ce9ceab1b74af
```

#### Reproduced V11 I13 defect and bounded repair

Preimage production blob:

```text
tabs/cii-workspace/cii-workspace-writer2-nodename-write.js
9e520ceaedc16b0bd36b70396bca3bfc9fd5996f
```

The preimage routed the ELEMENT NODENAME pointer through:

```text
numericField() -> formatCiiWriterSig6()
```

although the physical pointer coordinate is I13.

Exact source-contract falsifier:

```text
tests/cii-workspace-writer2-nodename-i13-source-contract.test.js
blob c80bca35e3b62f216eaab5bf8a48faaa21a276d7
```

Observed classification:

```text
preimage  FAIL as expected
postimage PASS
```

Surgical postimage writer:

```text
eb6bff1cdd4dc1f50e101a4f2f2dc717c74bdd5c
```

The repair removes the REAL-style pointer formatter path and writes the pointer through the existing lexical integer field formatter.

Focused exact runtime:

```text
tests/cii-workspace-writer2-nodename-i13-focused-runtime.test.js
blob 65896fd41e16efcd25dea97ad5a8848cbc87d03c
state PASS_RUNTIME_EXACT_5_FILE_BLOB_GRAPH
observed pointer 0 -> 5
observed lexical token "5"
```

Current public state:

```text
AUTHORED_PUBLIC_RUNTIME_NOT_RUN
```

The focused PASS does not qualify the public product route.

### BM-W2-02 — retained-real V11 SIF/TEE DELETE

Frozen candidate:

```text
owner element        70 -> 250
SIF pointer          1
record node          70
source raw code      3
```

Operation and expected transition:

```text
DELETE complete SIF block 1
CONTROL.SIF&TEES     9 -> 8
SIF rows             90 -> 80
selected pointer     1 -> 0
retained pointers    p > 1 => p - 1
connectivity         unchanged
pointer syntax       lexical I13
```

Independent oracle:

```text
Benchmark/CIICompare/Writer2/cii-writer2-benchmark-sif-oracle.js
```

Authored public-product test:

```text
tests/cii-workspace-writer2-benchmark-sif-delete.test.js
```

Raw-code mutation `3 -> 5` is explicitly excluded while raw field-2 semantics remain unresolved.

Focused exact runtime:

```text
tests/cii-workspace-writer2-sif-delete-physical.test.js
blob 65d70d2cab42ce19ac6648d9c6929dae56404990
state PASS_RUNTIME_EXACT_8_FILE_BLOB_GRAPH
```

Observed focused evidence includes:

```text
middle delete mapping  1:1, 2:0, 3:2
delete-all              PASS
lexical I13 pointers    PASS
exact postimage         PASS
unrelated-byte guard    PASS
forged-testimony guard  PASS
```

Current public state:

```text
AUTHORED_PUBLIC_RUNTIME_NOT_RUN
```

### BM-W2-03 — retained-real HANGER DELETE-ALL

Frozen candidate:

```text
node                  205
layout                CAESAR_SYNCHRONIZER_IHGRNODE_FIRST
CONTROL.NOHGRS        1
MISCEL_1 rows         23
rrmat/prefix rows     7
execution tail rows   4
```

Independent expected transition:

```text
CONTROL.NOHGRS        1 -> 0
hanger nodes          [205] -> []
MISCEL_1 rows         23 -> 11
retained rows         first 7 + last 4
ELEMENT connectivity unchanged
```

Independent oracle:

```text
Benchmark/CIICompare/Writer2/cii-writer2-benchmark-hanger-oracle.js
blob 16cbba8d5ac7dec1dc4e8cce1c5f0b6a9c728b3f
```

Authored public-product test:

```text
tests/cii-workspace-writer2-benchmark-hanger-delete-all.test.js
blob 93703ac66fec9b663165d95a20afbc654b6e26f4
```

The oracle derives the synchronizer IHGRNODE location independently from CONTROL counts and MISCEL_1 physical shape, then constructs the exact postimage without importing Writer2 mutation code.

Focused exact runtime:

```text
tests/cii-workspace-writer2-hanger-focused-runtime.test.js
blob 2e45b358640e9028c66b11b108b6b8d44d2dd2d1
state PASS_RUNTIME_EXACT_9_FILE_BLOB_GRAPH
```

The focused graph includes the real HANGER record-binding and tail-order custody modules; no stub or reduced writer-only path was used.

Observed:

```text
hanger count 1 -> 0
post custody count 0
post layout CONTROL_NOHGRS_ZERO
retained payload exact prefix + execution tail
```

Current public state:

```text
AUTHORED_PUBLIC_RUNTIME_NOT_RUN
```

### BM-W2-04 — retained-real RESTRAINT block DELETE/compaction

Primary retained-real W2 B case.

Frozen candidate:

```text
pointer              1
slot                 1
node                 190
owner element        180 -> 190
rows/block           24
```

Independent expected transition:

```text
CONTROL restraints         7 -> 6
RESTRANT rows              168 -> 144
selected pointer           1 -> 0
retained pointers p > 1    p -> p - 1
CONTROL.NONAM              remains 4
ELEMENT connectivity       unchanged
count/pointer syntax       lexical I13
```

Independent oracle:

```text
Benchmark/CIICompare/Writer2/cii-writer2-benchmark-oracle.js
```

Authored public-product test:

```text
tests/cii-workspace-writer2-benchmark-restraint-delete.test.js
```

Focused exact compaction runtime:

```text
tests/cii-workspace-writer2-restraint-compaction-focused-runtime.test.js
blob b7e76470cf416e595c556467b3207b4fe8d5d0ba
state PASS_RUNTIME_EXACT_7_FILE_BLOB_GRAPH
```

Current exact planner/custody blobs:

```text
compaction plan  aedfb3ac78eed2294a88a64af261386f0db65085
pointer custody  7053230546eaba4588b98a35ae5fc3819da83c14
```

Observed focused case:

```text
pointer mapping      1:1, 2:0, 3:2
CONTROL count        3 -> 2
deleted row range    [24,48)
lexical I13 custody  PASS
```

The earlier exact pointer-I13 qualification also remains PASS.

Current public state:

```text
AUTHORED_PUBLIC_RUNTIME_NOT_RUN
```

### BM-W2-05 — tri-family one-preimage composite

The tri-family self-check is authored from one original preimage. Public composite qualification still depends on BM-W2-01, BM-W2-02 and BM-W2-03 independently passing **public** runtime qualification:

```text
NODENAME CREATE node10 -> BM-N10
+ SIF block1 DELETE
+ HANGER node205 DELETE-ALL
```

Expected CONTROL state:

```text
NOHGRS      1 -> 0
NONAM       4 -> 5
RESTRAINT   7 -> 7
SIF&TEES    9 -> 8
NUMELT      40 -> 40
```

Authored self-check:

```text
tests/cii-workspace-writer2-benchmark-trifamily-composite.test.js
blob b21428dd68bcc7d147f192ff693187bd9db7b595
```

Current state:

```text
AUTHORED_SELF_CHECK
PUBLIC_RUNTIME_BLOCKED_ON_STANDALONE_PUBLIC_RUNTIME_QUALIFICATION
```

The authored self-check does not bypass or satisfy the standalone public-runtime gate.

### BM-W2-06 — four-family stress case

The four-family self-check is authored from one original preimage. Public composite qualification still depends on BM-W2-01/02/03/04 **public** runtime qualification:

```text
NODENAME CREATE
+ SIF DELETE
+ HANGER DELETE-ALL
+ RESTRAINT DELETE
```

Expected cardinality vector:

| Field | Before | After |
|---|---:|---:|
| NUMELT | 40 | 40 |
| NOHGRS | 1 | 0 |
| NONAM | 4 | 5 |
| RESTRAINT | 7 | 6 |
| SIF&TEES | 9 | 8 |

Authored self-check:

```text
tests/cii-workspace-writer2-benchmark-fourfamily-composite.test.js
blob a5a53ce9b7362b88a0c3525a5b654766d2a5a4e5
```

Current state:

```text
AUTHORED_SELF_CHECK
PUBLIC_RUNTIME_BLOCKED_ON_STANDALONE_PUBLIC_RUNTIME_QUALIFICATION
```

The authored self-check does not bypass or satisfy the standalone public-runtime gate.

## Negative benchmark suite

### NEG-01 — unrelated byte drift

Change one unrelated header byte after an otherwise-correct postimage. Independent validation must fail exact complete-postimage comparison.

### NEG-02 — stale preview/hash

Replay a bound preview against an already-modified target. Must fail stale-target custody.

### NEG-03 — wrong CONTROL field

Mutate an unrelated CONTROL field in addition to the authorized count. Must fail.

### NEG-04 — wrong pointer relocation

Leave a required relocation stale after a cardinality change. Must fail the independent oracle.

### NEG-05 — invalid I13 lexical form

I13 coordinates reject REAL-style spellings such as:

```text
6.000000
6.000000E+00
6.000000D+00
```

This falsifier applies to Writer2-controlled count/pointer coordinates. The NODENAME pointer defect in this exact class has been reproduced and repaired; the lexical rule remains active for all families.

### NEG-06 — wrong V11 SIF cardinality

Delete fewer or more than the complete 10-row V11 SIF block. Must fail.

## Independent oracle architecture

Level-A repository oracles independently parse fixed sections and construct expected postimages. They do not import Writer2 planner/writer/mutation modules.

Current Level-A oracle set:

```text
BM-W2-00  cii-writer2-benchmark-identity-oracle.js
BM-W2-01  cii-writer2-benchmark-nodename-oracle.js
BM-W2-02  cii-writer2-benchmark-sif-oracle.js
BM-W2-03  cii-writer2-benchmark-hanger-oracle.js
BM-W2-04  cii-writer2-benchmark-oracle.js
```

Level-B CAESAR-native retained oracles may be added when genuine native files are available. Converter-generated V14 must not be relabelled native.

## Version/runtime ladder

### W2 A — synthetic public runtime

Existing authored gate:

```text
tests/cii-workspace-writer2-restraint-product-routing.test.js
blob 9922377ddeda86fc9167d65f33c97095346e79fa
```

State: `NOT_RUN`.

Historical exact sparse-mirror execution reached module loading only and stopped at `cii-workspace-auxiliary.js`; no authored assertion failed. The current `cii-workspace-auxiliary.js` itself imports only `parser/fixed-field.js` and `cii-workspace-contracts.js`, so that historical frontier is a materialization checkpoint, not an engineering failure.

### W2 B — retained-real V11

Primary evidence case: BM-W2-04.

State: `NOT_RUN`; classification requires W2 A and BM-W2-04 public runtime PASS.

### W2.35 — converter-generated V14

Authored browser gate uses the real Worker/Pyodide bridge and requires final V14 downgrade equality with validated V11 Writer2 output.

State: `NOT_RUN`.

### W2.35a — Issue #1042 generated V14

Separate historical regression identity. NONAM must remain byte-identical for a pure RESTRAINT delete.

State: `NOT_RUN`.

### W2.40 — pinned native V14

Uses genuine pinned upstream V14 target custody; generated V14 cannot satisfy this gate.

State: `NOT_RUN`.

### W2 H — release freeze

Requires at minimum:

```text
W2 A PASS
W2 B / BM-W2-04 PASS
W2.35 PASS
W2.35a PASS
W2.40 PASS
I13 falsifiers PASS
negative benchmark suite PASS
no unexpected semantic delta
```

Current state: `NOT_READY`.

## Implementation phases and current progress

```text
Phase 1  benchmark custody + BM-W2-04 oracle        AUTHORED / public runtime NOT_RUN
Phase 2  BM-W2-01/02/03/04 standalone families     FOCUSED EXACT RUNTIME PASS / public runtime NOT_RUN
Phase 3  BM-W2-05/06 composites                     AUTHORED SELF_CHECK / public runtime BLOCKED
Phase 4  generated V14                               AUTHORED gate / runtime NOT_RUN
Phase 5  native V14                                  AUTHORED gate / runtime NOT_RUN
Phase 6  release bundle                              NOT_READY
```

## Current hard gate

All four standalone mutation families now have bounded focused exact-runtime evidence, but the exact private repository still cannot be materialized into this execution filesystem for unchanged public Node/Chromium execution. Native Git/raw download cannot resolve GitHub DNS, while the connected GitHub interface provides exact source/blob access but no authenticated checkout/archive materialization into the execution container.

Therefore:

```text
FOCUSED FAMILY RUNTIME       PASS for NODENAME/SIF/HANGER/RESTRAINT
PUBLIC PRODUCT RUNTIME      NOT_RUN
W2 A / W2 B                 NOT_RUN
ADDITIONAL PRODUCTION FIX   requires a new reproduced product falsifier
BM-W2-05 / BM-W2-06         SELF_CHECK AUTHORED / public runtime blocked on standalone public runtime
RELEASE FREEZE              NOT_READY
```

The next legitimate runtime sequence remains:

```text
1. materialize/reconcile complete exact repository graph
2. node tests/cii-workspace-writer2-restraint-product-routing.test.js
3. node tests/cii-workspace-writer2-benchmark-nodename-create.test.js
4. node tests/cii-workspace-writer2-benchmark-sif-delete.test.js
5. node tests/cii-workspace-writer2-benchmark-hanger-delete-all.test.js
6. node tests/cii-workspace-writer2-benchmark-restraint-delete.test.js
7. stop at first authored falsifier and isolate it
8. only after standalone public PASS, run/qualify the already-authored BM-W2-05 and BM-W2-06 self-check composites
9. run playwright.cii-writer2.config.mjs for W2.35/W2.35a/W2.40
```

No benchmark expectation, source authority, or tolerance may be weakened to obtain green status.
