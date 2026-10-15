# PR1119 workreport — BM-W2-03 HANGER oracle NOHGRS value extraction

## Mission

Repair issue #1118, the authored BM-W2-03 oracle type-extraction defect, without changing retained expected values or Writer2 behavior.

## Grounding

```text
repository        reallaksh19/XML_Compare_Utilities
base main         d6e5c01da59ea6f8533afd1fd3ba96b591c03eb8
branch            fix/cii-writer2-bm-w2-03-oracle-nohgrs-value
source issue      #1118
runtime predecessor PR #1064
W2 A repair       merged PR #1114
BM-W2-01 repair   merged PR #1116
BM-W2-02 issue    #1117 (unmerged)
```

## Authored failure

The unchanged BM-W2-03 runner stopped before Writer2 with:

```text
BM_W2_03_ORACLE_NOHGRS_DRIFT:[object Object]
```

`integerI13()` returns a frozen field object with `raw`, `token`, `value`, and `span`. `sourceFacts()` already extracts `.value` for adjacent CONTROL.NUMELT and CONTROL.NUMNOZ, but did not do so for CONTROL.NOHGRS.

## Patch

Only:

```diff
- const nohgrs = integerI13(control.rows[0], CONTROL_HANGER_FIELD, 'CONTROL_NOHGRS');
+ const nohgrs = integerI13(control.rows[0], CONTROL_HANGER_FIELD, 'CONTROL_NOHGRS').value;
```

Published oracle blob:

```text
before 16cbba8d5ac7dec1dc4e8cce1c5f0b6a9c728b3f
after  d41f7919257dc273d473f0e9a7bfd0a4fb9da0dd
```

No expected benchmark value, coordinate, tolerance, source bytes, Writer2 mutation logic, authority, topology, converter, or workflow changed.

## Validation

```text
node --check Benchmark/CIICompare/Writer2/cii-writer2-benchmark-hanger-oracle.js
PASS

retained BM_CII_SOURCE oracle regression
NUMELT=40
NUMNOZ=0
NOHGRS before=1
NOHGRS after=0
MISCEL_1 rows 23 -> 11
PASS
```

Prior diagnostic execution of the unchanged authored BM-W2-03 runner with only this one-line correction reached:

```text
BM-W2-03 retained-real HANGER DELETE-ALL qualification passed.
exit = 0
```

That result remains diagnostic until the correction is accepted and the ordered batch is rerun. The official runtime ledger remains stopped at BM-W2-03; BM-W2-04 is NOT_RUN.

## Validation integrity

| Gate | Status | Observation | Oracle class |
|---|---|---|---|
| Oracle syntax | PASS | executed locally | N/A |
| Retained source fact extraction | PASS | executed locally | independent benchmark source |
| Full BM-W2-03 with correction | PASS_DIAGNOSTIC | previously executed locally | authored independent oracle with one type fix |
| Official ordered BM-W2-03 gate | NOT_RUN_AFTER_PUBLICATION | must rerun after acceptance | protected oracle |
| BM-W2-04 | NOT_RUN | ordered predecessor not accepted | retained-real |
| Exact `.git` checkout / CI | NOT_RUN_ENVIRONMENT | native GitHub DNS unavailable | repository runtime |

No NOT_RUN gate is represented as PASS.

## Local backup / patch ledger

```text
.agent-worklogs/20260907_1225_bm-w2-03-oracle-nohgrs/
```

Repository backup tooling was used before the local edit. The module patch records pre/post SHA-256 and a one-line reversible hunk.

## Protected boundaries

Unchanged:

```text
benchmark expected values
benchmark source CII bytes
oracle coordinates and tolerances
Writer2 mutation logic
SIF/HANGER/RESTRAINT CREATE authority
Writer1C
Writer3/topology
converter semantics
workflows
```

## Merge state

```text
PR state          DRAFT
merge authorized  FALSE for PR #1119
```

Do not merge without fresh explicit Owner authorization.
