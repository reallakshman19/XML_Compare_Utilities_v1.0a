# PR1060 Work Report — Writer2 BM-W2-04 exact runtime closure

## CURRENT STATE — READ FIRST

```text
HANDOVER_READINESS: READY
REPOSITORY: reallaksh19/XML_Compare_Utilities
BASE_MAIN: 29766c0432665e5f4b1340e59f9a16e7d4ef3999
BRANCH: agent/cii-writer2-bmw204-runtime-closure
PR: #1060 / DRAFT / OPEN
PREDECESSOR: PR #1059 / squash-merged at ba4659e2cfb0c7242738ca7e6f372d94c3e44541
CRITICALITY: ENGINEERING_CRITICAL
WORK_INTENT: INVESTIGATE / VALIDATE / IMPLEMENT_ONLY_ON_REPRODUCED_DEFECT
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
RELEASE_FREEZE: NOT_READY_FOR_WRITER2_RELEASE_FREEZE
```

## Inherited gate truth

```text
W2.34 focused bridge/export      PASS
W2 C0 exact public route         PASS
V14 lexical-I13 focused gate     PASS
V11 SIF lexical-I13 fix          IMPLEMENTED / separate runtime qualification pending
BM-W2-02 authored                YES / exact public runtime NOT_RUN
BM-W2-04 authored                YES / exact public runtime NOT_RUN
W2 A synthetic public runtime    NOT_RUN
W2 B retained-real V11           NOT_RUN
W2.35 generated V14              NOT_RUN
W2.35a #1042 generated V14       NOT_RUN
W2.40 native V14                 NOT_RUN
W2 H release freeze              NOT_READY
```

## Reproduced and fixed in PR1060 — RESTRAINT pointer lexical I13 custody

While expanding BM-W2-04, `buildCiiWriter2RestraintPointerCustody()` was found to claim `EXACT_PARSED_INDEX_ENDPOINTS_AND_PHYSICAL_RESTRAINT_POINTER_I13` while accepting numerically integral REAL spellings such as `1.000000`.

Focused falsifier:

```text
tests/cii-workspace-writer2-restraint-pointer-i13-custody.test.js
blob 2c5940d17b13807455c4468a0b6d31fdc36f860f
```

Exact five-file graph:

```text
parser/fixed-field.js
  485daa43553681ca54f488499e57f36d2239be58

tabs/cii-workspace/cii-workspace-contracts.js
  6ab30d8dd088225fd89bb729bf9ffdebefe652f6

tabs/cii-workspace/cii-workspace-physical-file.js
  0c4c445fbd3d4b929b1f9288b789b244547c8867

tabs/cii-workspace/cii-workspace-writer2-restraint-delete-custody.js
  preimage 2176ac97eaef84f3aa9073d5eaf73d1530cf09a8
  postimage 7053230546eaba4588b98a35ae5fc3819da83c14

tests/cii-workspace-writer2-restraint-pointer-i13-custody.test.js
  2c5940d17b13807455c4468a0b6d31fdc36f860f
```

Exact preimage execution failed as intended:

```text
actual   = QUALIFIED
expected = BLOCKED
token    = 1.000000
```

The patch adds lexical `/^[+-]?\d+$/` qualification before semantic nonnegative-safe-integer conversion. Exact postimage execution with the same test passed.

```text
W2_RESTRAINT_POINTER_LEXICAL_I13_CUSTODY
= PASS_RUNTIME_EXACT_5_FILE_BLOB_GRAPH
```

No generic parser, RESTRAINT CREATE/allocation authority, topology, benchmark oracle, or Writer3 behavior changed. This focused PASS does not promote BM-W2-04, W2 A, or W2 B.

## BM-W2-04 retained-real V11 benchmark

Frozen source:

```text
Benchmark/CIICompare/BM_CII_SOURCE.CII
Git blob e41cd05603b56837cbb6e31b9d4074ef6106fe9b
neutral version V11
```

Frozen case:

```text
RESTRAINT pointer 1
slot 1
node 190
unique owner 180 -> 190

expected:
  blocks 7 -> 6
  rows 168 -> 144
  pointer 1 -> 0
  p > 1 -> p - 1
  CONTROL NONAM 4 unchanged
  element count 40 unchanged
  topology unchanged
  changed count/pointers lexical I13
```

Entry test and independent oracle remain unchanged:

```text
tests/cii-workspace-writer2-benchmark-restraint-delete.test.js
  54c08bf0b2baf8138a703350d9e2600387693008

Benchmark/CIICompare/Writer2/cii-writer2-benchmark-oracle.js
  b36e38c8df327069f07ea20ad50c91f03ffdcd6a
```

The oracle imports no Writer2 mutation/planner code.

## Public route/validator source trace

`applyCiiWorkspaceTargetWriter2()` calls the normal `applyWriter(..., '2')` path. For any applied RESTRAINT operation, `applyLowLevelWriter()` routes to `applyCiiWriter2CompositeWithRestraintDelete()`. The postimage is then re-intaken and `validateCiiWriter2ProductRoundTrip()` dispatches to the RESTRAINT composite validator.

The RESTRAINT validator independently rebuilds the plan/claims, reconstructs complete expected final bytes from Target0, and compares exact final bytes before trusting writer testimony. This source path is consistent with the BM-W2-04 oracle contract.

## Current exact graph frontier

Pinned current blobs:

```text
benchmark test                                 54c08bf0b2baf8138a703350d9e2600387693008
benchmark oracle                               b36e38c8df327069f07ea20ad50c91f03ffdcd6a
parser/fixed-field.js                          485daa43553681ca54f488499e57f36d2239be58
parser/caesar-parser.js                        46b921c656fff242354c27b6d1a83dd40791f7ec
cii-workspace-core.js                          cee2858a63992648edf5e61b8f63b3837a937f9e
cii-workspace-intake.js                        3939ff6866191bca0ccf6d27264ecd1f2549ddd5
cii-workspace-physical-file.js                 0c4c445fbd3d4b929b1f9288b789b244547c8867
cii-workspace-topology-adapter.js              57b8d2d6e8335887b962e09085cc93ece2e36d68
cii-workspace-auxiliary.js                     7459677eccb2ca460b1971ac6d75c22f2f5ae870
cii-workspace-hanger.js                        71e5bca8cb3429878785244b5508e104add2fc57
cii-workspace-capabilities.js                  db7b67ed25ccad6f8bb46c03561747ea7b2094c1
cii-workspace-nodename.js                      050df81250d62cc454856e403d6e4ffc85fd9321
cii-workspace-writer1c-sif-custody.js          915ceb0a199091f00823e89d6c73c6007da62f9d
cii-workspace-writer2-composite-restraint.js   c007c91e1ac73a3ba5003f59ccdfa027eb5156a0
cii-workspace-writer2-product-validation.js    05fcb594a3be5e360ce804c77872319730a16b53
cii-workspace-writer2-composite-restraint-validation.js
                                                919ac88c071db9d793c7793cbbd82cff7e193189
cii-workspace-writer2-composite-restraint-validation-support.js
                                                a5b8f07b733161ddfec222d1a80371bcd27794e7
cii-workspace-writer2-restraint-delete-validation.js
                                                1833d9fecc37061eaf2f51f1676e6386e1f9ac3c
cii-workspace-writer2-restraint-delete-custody.js
                                                7053230546eaba4588b98a35ae5fc3819da83c14
```

`parser/caesar-parser.js` adds its section parser/validator/PDF imports. `cii-workspace-core.js` still statically imports the broader workspace construction graph even though BM-W2-04 directly exercises only the Writer2 apply route.

Native Git remains unavailable in the execution container (`Could not resolve host: github.com`). The connector exposes exact files/blobs/tree reads but no clone/archive transport. This is an environment/materialization limitation, not a benchmark FAIL or PASS.

## Existing RESTRAINT compaction regression — diagnostic only

The existing authored `cii-workspace-writer2-restraint-delete-compaction-plan.test.js` behaved PASS on a reconstructed local graph after the I13 patch. However the locally reconstructed planner/test bytes did not match the current exact Git blobs, so the run is deliberately **not** qualification evidence.

Current branch truth:

```text
planner blob  aedfb3ac78eed2294a88a64af261386f0db65085
test blob     e27c65b68cc4e44138c4965b07c85f00893ef0e7
behavior      PASS diagnostic only
claim         NOT PROMOTED
```

## Runtime classification

```text
RESTRAINT lexical-I13 focused gate PASS_RUNTIME_EXACT_5_FILE_BLOB_GRAPH
BM-W2-04 source/API path            PASS_SOURCE_INSPECTION
BM-W2-04 independent oracle         AUTHORED
BM-W2-04 complete exact graph       NOT_YET_MATERIALIZED
BM-W2-04 unchanged execution        NOT_RUN
W2 A                                NOT_RUN
W2 B retained-real V11              NOT_RUN
```

## Exact next action

1. Expand current `parser/caesar-parser.js` section-parser/validator imports and the remaining static imports of `cii-workspace-core.js`.
2. Verify every admitted repository file against its current Git blob.
3. Run unchanged `node tests/cii-workspace-writer2-benchmark-restraint-delete.test.js` only after the graph is complete.
4. First authored assertion/runtime failure after complete graph materialization = genuine BM-W2-04 FAIL.
5. Clean completion = BM-W2-04 runtime PASS only; do not promote W2 B until W2 A also passes.
6. Continue unchanged W2 A public-runtime test next.
7. No further production change without another exact reproduced defect.

## Authority boundaries

No stubs, import rewrites, partial-core substitute, lossy V14 bridge, reconstructed PASS, Writer3 topology widening, SIF CREATE, HANGER CREATE, RESTRAINT CREATE, or raw SIF field-2 semantic mutation authority.

## Changed-file ledger

```text
agents/PR1060_workreport.md
agents/status/PR1060.yaml
agents/claims/PR1060.yaml
tabs/cii-workspace/cii-workspace-writer2-restraint-delete-custody.js
tests/cii-workspace-writer2-restraint-pointer-i13-custody.test.js
```

## Appendix A — takeover qualification

1. Reproduce why `1.000000` was incorrectly accepted under an authority explicitly named physical I13 and identify the exact preimage/postimage blobs.
2. Trace BM-W2-04 pointer 1 / node 190 / owner `180->190` through intake, physical pointer custody, compaction planning, physical write, public route, and product validation.
3. Explain why the focused lexical-I13 PASS and diagnostic compaction PASS do not promote BM-W2-04 or W2 B.
4. State the exact event that changes BM-W2-04 from NOT_RUN to PASS or FAIL.
5. If the completed BM-W2-04 graph fails next, identify the first wrong authority boundary before changing any oracle or production code.
