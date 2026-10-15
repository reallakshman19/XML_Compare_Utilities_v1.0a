# PR1115 workreport — Writer2 BM-W2-01 standalone NODENAME I13 validator repair

## Mission

Fix issue #1115, the next authored public-runtime boundary after merged PR #1114, without changing Writer2 mutation authority or benchmark/oracle semantics.

## Grounding

```text
base main        2b21967319520bdd3e9448eedc6fa1f56113e5b7
predecessor      PR #1114 / issue #1113
runtime chain    PR #1064
BM-W2-01 runner  7ba33984f290550f6f40eb91369ce9ceab1b74af
validator before 93b1ebe4548dc51df286be7dea224a8643bbcd94
```

## Observed failure

After W2 A passed with PR #1114 represented, the unchanged BM-W2-01 runner reached `validateCiiWriter2NodeNameRoundTrip()` and failed:

```text
WRITER_2_EXACT_POSTIMAGE_MISMATCH
WRITER_2_MUTATION_TESTIMONY_MISMATCH
```

Before that validator call, the low-level Writer output already equaled the independent BM-W2-01 structural oracle.

## Root cause

The standalone validator rebuilt `ELEMENT_NODENAME_POINTER` expected bytes with generic G13.6 formatting:

```js
afterField: numericField(change.newPointer)
```

NODENAME ELEMENT pointers are qualified fixed-width lexical integers and must use I13. Merged PR #1112 had already corrected the independent composite-hanger validator, but this standalone validator remained stale.

## Production repair

One semantic line only:

```js
afterField: integerField(change.newPointer)
```

Published validator blob:

```text
before 93b1ebe4548dc51df286be7dea224a8643bbcd94
after  fa4e249d5054915ebd6c4340028583a20bc57da0
```

Generic numeric formatting remains unchanged for fields that are actually G13.6.

## Validation

The one-line correction was executed locally against the unchanged authored BM-W2-01 runner and independent oracle in the current-main-equivalent executable graph.

Observed:

```text
BM-W2-01 retained-real NODENAME CREATE qualification passed.
exit = 0
```

The published validator blob `fa4e249d...` is byte-identical to the locally tested file.

Classification:

```text
BM-W2-01 current-main-equivalent executable graph = PASS
exact current-main .git checkout                 = NOT_RUN_ENVIRONMENT
repository-wide npm                              = NOT_RUN_ENVIRONMENT
```

No weaker evidence class is promoted into an exact-checkout PASS.

## Changed paths

```text
tabs/cii-workspace/cii-workspace-writer2-nodename-validation.js
agents/PR1115_workreport.md
```

## Protected boundaries

Unchanged:

```text
Writer2 NODENAME mutation logic
NODENAME CREATE/DELETE authority
SIF/HANGER/RESTRAINT CREATE authority
benchmarks/oracles/tolerances
Writer1C
Writer3/topology
converter semantics
workflows
```

## Merge authorization

Owner explicitly authorized merging this successor together with PR #1114 on 2026-09-07. Merge must still use head-SHA protection and preserve the above scope.
