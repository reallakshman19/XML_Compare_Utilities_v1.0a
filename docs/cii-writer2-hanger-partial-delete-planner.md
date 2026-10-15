# Writer 2 — partial H>1 HANGER DELETE planner authority

## Status

This document extends the merged HANGER planner after PR1024 tail-order qualification.

It qualifies **planner-level partial deletion of existing H>1 hanger records** when exact positional physical custody is proved across every per-hanger array.

It does **not** qualify a physical partial-compaction writer, product apply, HANGER CREATE, or HGRDAT engineering-value semantics.

## Governing distinction

The same transaction now has two different authority states:

```text
planner authority
  may determine exactly which existing hanger records would be retained/deleted

physical writer authority
  remains DELETE-ALL ONLY
```

Therefore a partial H>1 plan may be:

```text
CIIWorkspaceWriter2HangerDeletePlan.v1 = READY
compaction.plannerPartialRecordAuthority = true
compaction.physicalPartialWriteAuthority = false
compaction.physicalWriterScope = DELETE_ALL_ONLY_UNCHANGED
```

The existing delete-all physical writer still requires:

```text
deletePlan.compaction.deleteAll === true
countAfter === 0
```

and otherwise throws:

```text
CII_WRITER_2_HANGER_DELETE_ALL_SCOPE_REQUIRED
```

The merged composite/product readiness independently preserves the same delete-all restriction with:

```text
WRITER_2_HANGER_DELETE_ALL_SCOPE_REQUIRED
```

## Record-binding authority

New module:

```text
tabs/cii-workspace/cii-workspace-writer2-hanger-record-binding.js
```

Authority token:

```text
PHYSICAL_ROW_SHAPE_PLUS_DUAL_EMITTER_ORDER+POSITIONAL_HANGER_ARRAY_RECORD_INDEX
```

This is physical positional authority only. It intentionally declares:

```text
semanticAuthority = NONE_POSITIONAL_PHYSICAL_CUSTODY_ONLY
```

For each record index `i = 1..H`, the binder requires one consistent positional record across:

```text
IHGRNODE[i]
HGRDAT/TAG/GUID physical record i
IHGRFREE row i
IHGRNUM[i]
IHGRTABLE[i]
IHGRSHORT[i]
IHGRCN[i]
```

No array may substitute another record with the same numerical value. The record index itself is the custody key.

## HGRDAT/TAG/GUID tail

PR1024 qualified the two source-observed physical layouts:

```text
INTERLEAVED
  HGRDAT1_i, HGRDAT2_i, TAG_i, GUID_i

GROUPED
  all HGRDAT pairs
  all TAG/GUID pairs
```

The binder consumes PR1024's exact per-record row map. It does not reinterpret any HGRDAT value.

For H=3, deleting record 2 and retaining records 1 and 3 gives:

```text
oldToNewRecordIndex
1 -> 1
2 -> 0
3 -> 2

INTERLEAVED retained tail rows
1,2,3,4,9,10,11,12

GROUPED retained tail rows
1,2,5,6,7,8,11,12
```

The grouped case must stay grouped; canonicalizing it to interleaved order is forbidden.

## IHGRFREE custody

Each hanger record must have exactly one IHGRFREE row with:

```text
2X + 4*I13
```

The planner checks:

- exact `2X` prefix;
- four fixed 13-byte integer fields;
- no trailing nonblank data;
- positional row index equals hanger record index.

These checks establish byte-layout custody only; the engineering meaning of the four fields is not expanded by this PR.

## Packed-array custody

The existing planner already extracts exact fixed-width fields for:

```text
IHGRNODE
IHGRNUM
IHGRTABLE
IHGRSHORT
IHGRCN
```

The record binder additionally requires every field used for partial compaction to satisfy:

```text
field.valueIndex === hanger record index
raw 13-byte field contains an explicit integer token
parsed field value equals that exact token
```

A blank 13-byte field may not silently canonicalize to numeric zero for partial-record authority.

## Fail-closed behavior

Partial H>1 planner authority is admitted only when:

```text
countBefore > 1
0 < deletedRecordCount < countBefore
recordBinding.status == QUALIFIED
```

If record binding fails, the stable blocker remains:

```text
WRITER_2_HANGER_PARTIAL_MULTI_RECORD_TAIL_ORDER_UNQUALIFIED
```

and detailed custody blockers are added as:

```text
WRITER_2_HANGER_PARTIAL_RECORD_BINDING_REQUIRED:<detail>
```

Examples include:

```text
WRITER_2_HANGER_TAIL_ROW_SHAPE_UNQUALIFIED
WRITER_2_HANGER_IHGRFREE_PREFIX_REQUIRED:<record>
WRITER_2_HANGER_POSITIONAL_FIELD_REQUIRED:<array>:<record>
```

## Delete-all non-regression

Delete-all deliberately does not depend on the new per-record binder.

If all existing hangers are selected, no hanger record is retained, so the already-merged physical authority remains:

```text
CONTROL.NOHGRS -> 0
remove complete hanger-specific payload
retain RRMAT/VFLEX byte-for-byte
retain four execution rows byte-for-byte
```

A malformed HGRDAT/TAG/GUID tail or IHGRFREE row that would block partial-record binding does not by itself revoke delete-all authority, provided the existing delete-all structural custody gates still pass.

## Explicit exclusions

This phase does not authorize:

```text
partial H>1 physical MISCEL_1 rewrite
partial H>1 composite/product apply
HANGER CREATE
HANGER attribute editing
HGRDAT semantic interpretation
TAG/GUID semantic rewrite
alternate INPUTXML_CURRENT layout mutation
RRMAT/VFLEX mutation
execution-option mutation
SIF CREATE
Writer3 topology mutation
```

## Next phase

A successor physical partial-compaction PR must independently reconstruct the complete expected `MISCEL_1` postimage from untouched TARGET0 and the qualified planner record map.

It must preserve the target's original tail order class, compact every positional hanger array consistently, rewrite `CONTROL.NOHGRS`, and require exact complete-postimage equality. Product/composite routing should remain delete-all-only until that physical writer and independent validator are accepted.
