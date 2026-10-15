# PR1025 — Writer 2 partial H>1 HANGER DELETE planner integration

# CURRENT RECOVERY STATE — READ FIRST

```text
HANDOVER_READINESS: READY
REPOSITORY: reallaksh19/XML_Compare_Utilities
PR: #1025
BRANCH: agent/cii-writer2-hanger-partial-delete-planner
BASE: main@1f3f7b8e1e9c3829278af131606c056af80c2c00
MISSION: integrate PR1024 tail-order custody into the existing HANGER planner without expanding physical/product authority
CURRENT_STAGE: PLANNER_AUTHORITY_AND_FALSIFIERS_AUTHORED_NOT_EXECUTED
TAKEOVER_AUTHORITY: WRITE_ALLOWED
MERGE_AUTHORITY: OWNER_ONLY
```

## 1. Scope

PR1025 is a planner-authority successor to merged PR1024.

Production changes are limited to:

```text
tabs/cii-workspace/cii-workspace-writer2-hanger-delete.js
tabs/cii-workspace/cii-workspace-writer2-hanger-record-binding.js
```

The physical HANGER writer/validator, tri-family composite, product/core routing, UI, parser, protected converters, benchmark CII files, and workflows are unchanged.

## 2. Authority change

Before PR1025:

```text
H > 1 and 0 < deleted records < H
 -> WRITER_2_HANGER_PARTIAL_MULTI_RECORD_TAIL_ORDER_UNQUALIFIED
 -> planner BLOCKED
```

After PR1025:

```text
H > 1 partial delete
 -> require PR1024 tail classifier QUALIFIED
 -> require one exact positional record binding across all hanger arrays
 -> planner READY only if complete binding passes
```

The physical boundary remains:

```text
partial H>1 physical write = NOT AUTHORIZED
```

Planner output explicitly carries:

```text
compaction.plannerPartialRecordAuthority = true
compaction.physicalPartialWriteAuthority = false
compaction.physicalWriterScope = DELETE_ALL_ONLY_UNCHANGED
```

## 3. Record-binding contract

New module:

```text
cii-workspace-writer2-hanger-record-binding.js
```

Authority:

```text
PHYSICAL_ROW_SHAPE_PLUS_DUAL_EMITTER_ORDER+POSITIONAL_HANGER_ARRAY_RECORD_INDEX
```

For every existing hanger record index `i`, it binds:

```text
IHGRNODE[i]
HGRDAT/TAG/GUID record i
IHGRFREE row i
IHGRNUM[i]
IHGRTABLE[i]
IHGRSHORT[i]
IHGRCN[i]
```

This is positional physical custody only:

```text
semanticAuthority = NONE_POSITIONAL_PHYSICAL_CUSTODY_ONLY
```

No HGRDAT engineering field meaning is introduced.

## 4. QF-1025 findings

### QF-1025-001 — product readiness must not inherit planner authority

Source trace of merged `cii-workspace-writer2-composite-routing.js` proves an independent gate already exists:

```text
if (hangerPlan?.ready &&
    (hangerPlan?.compaction?.deleteAll !== true ||
     Number(hangerPlan?.countAfter) !== 0)) {
  blockers.push('WRITER_2_HANGER_DELETE_ALL_SCOPE_REQUIRED');
}
```

Therefore partial planner READY does not make product Writer2 READY.

The unchanged physical writer separately requires:

```text
deletePlan.compaction.deleteAll === true
countAfter === 0
```

and throws:

```text
CII_WRITER_2_HANGER_DELETE_ALL_SCOPE_REQUIRED
```

### QF-1025-002 — blank packed field cannot become zero authority

The merged base packed decoder converts `Number(rawField.trim())`, so an all-blank field can numerically become zero.

That is insufficient for partial-record custody. The new record binder independently requires an explicit signed/unsigned integer token in every 13-byte field and verifies:

```text
field.valueIndex === recordIndex
field.value === exact integer token from rawField
```

A blank field therefore blocks partial authority with:

```text
WRITER_2_HANGER_POSITIONAL_FIELD_REQUIRED:<array>:<record>
```

The base decoder is intentionally not changed in this PR because delete-all does not retain per-record hanger fields.

### QF-1025-003 — delete-all remains independent of retained-record semantics

Malformed HGRDAT/TAG/GUID or IHGRFREE evidence may block partial record binding, but does not automatically block delete-all.

This preserves PR1020 authority: delete-all removes the complete hanger-specific payload and retains only RRMAT/VFLEX + execution rows.

### QF-1025-004 — grouped order remains grouped

PR1024's corrected retained-row projector is consumed unchanged.

For H=3 deleting record 2:

```text
INTERLEAVED retained tail rows = 1,2,3,4,9,10,11,12
GROUPED retained tail rows     = 1,2,5,6,7,8,11,12
```

No canonicalization between the two physical order classes is allowed.

## 5. Planner behavior

For a qualified H=3 target deleting record 2:

```text
countBefore = 3
countAfter  = 2
oldToNewRecordIndex = {1:1, 2:0, 3:2}
partialMultiRecordDelete = true
partialRecordCompactionAuthorized = true
plannerPartialRecordAuthority = true
physicalPartialWriteAuthority = false
```

Retained custody includes:

```text
retainedRecordIndices
retainedNodes
retainedHgrdatTagGuidRowIndices
retainedIhgrfreeRecordIndices
retainedPackedFields
recordBindingAuthority
```

## 6. Fail-closed cases

Partial H>1 remains BLOCKED when record binding is not qualified.

Stable blocker:

```text
WRITER_2_HANGER_PARTIAL_MULTI_RECORD_TAIL_ORDER_UNQUALIFIED
```

Detailed reasons are additionally surfaced as:

```text
WRITER_2_HANGER_PARTIAL_RECORD_BINDING_REQUIRED:<detail>
```

Authored falsifiers include:

```text
unknown/mixed tail order
bad IHGRFREE 2X prefix
blank packed integer field
packed valueIndex mismatch
```

## 7. Physical/product non-expansion proof

`tests/cii-workspace-writer2-hanger-delete-plan.test.js` now requires qualified partial planner plans for both INTERLEAVED and GROUPED layouts, then calls the existing physical delete-all writer and requires:

```text
CII_WRITER_2_HANGER_DELETE_ALL_SCOPE_REQUIRED
```

`tests/cii-workspace-writer2-hanger-delete-all-physical.test.js` is reconciled to the same boundary: partial selection is no longer expected to fail in the planner; it must fail at the unchanged delete-all physical scope gate.

No physical writer source changed.

## 8. Changed-file ledger

Expected implementation/test paths:

```text
tabs/cii-workspace/cii-workspace-writer2-hanger-delete.js
tabs/cii-workspace/cii-workspace-writer2-hanger-record-binding.js
tests/cii-workspace-writer2-hanger-delete-plan.test.js
tests/cii-workspace-writer2-hanger-delete-all-physical.test.js
tests/cii-workspace-writer2-hanger-record-binding.test.js
docs/cii-writer2-hanger-partial-delete-planner.md
```

Recovery paths:

```text
agents/PR1025_workreport.md
agents/status/PR1025.yaml
agents/claims/PR1025.yaml
agents/MASTER_INDEX.md
```

Any other changed path is unexplained until reconciled.

## 9. Validation truth

Executed/source-inspected:

```text
PR1024 merge / exact PR1025 base                  PASS_GIT_BRANCH
branch relation before recovery docs              PASS: ahead 6 / behind 0
production diff scope before recovery docs        PASS_SOURCE_INSPECTION
merged product delete-all readiness gate          PASS_SOURCE_INSPECTION
merged physical delete-all scope gate             PASS_SOURCE_INSPECTION
planner/record-binding source review              PASS_SOURCE_INSPECTION
regression source review                          PASS_SOURCE_INSPECTION
```

Not executed in a complete checkout:

```text
focused record-binding regression                 AUTHORED_NOT_RUN_ENVIRONMENT
focused HANGER planner regression                 AUTHORED_NOT_RUN_ENVIRONMENT
HANGER delete-all physical regression             AUTHORED_NOT_RUN_ENVIRONMENT
inherited Writer2 component suites                NOT_RUN_ENVIRONMENT
tri-family composite/product suites               NOT_RUN_ENVIRONMENT
full repository npm test                          NOT_RUN_ENVIRONMENT
browser/product flow                              NOT_RUN_ENVIRONMENT
```

The current runtime cannot clone the repository because DNS resolution for `github.com` is unavailable. No unexecuted test is represented as PASS.

## 10. Explicit exclusions

```text
partial H>1 physical MISCEL_1 rewrite
partial H>1 tri-family composite claims
partial H>1 product/core readiness
partial H>1 UI enablement
HANGER CREATE
HANGER attribute editing
HGRDAT semantic authority
SIF CREATE
Writer3 topology mutation
protected converter/parser changes
workflow changes
```

## 11. Exact next phase

After PR1025 is accepted and merged, create a separate physical partial-compaction PR.

That successor must:

1. start from one untouched TARGET0;
2. consume only a qualified PR1025 partial planner plan;
3. preserve the target's original INTERLEAVED or GROUPED tail order;
4. compact IHGRNODE, HGRDAT/TAG/GUID, IHGRFREE and all four remaining packed arrays by the same old->new record map;
5. rewrite CONTROL.NOHGRS;
6. preserve RRMAT/VFLEX, defaults and execution rows where applicable;
7. independently reconstruct the complete expected postimage without trusting writer testimony;
8. require exact byte equality;
9. keep product/composite routing blocked until a later separate adoption PR.

## Appendix A — takeover qualification questions

1. Why is PR1024 tail-order classification not sufficient by itself to authorize partial HANGER deletion?
2. What exact physical structures are bound to hanger record index `i` in PR1025?
3. Why is record index, rather than equal numeric value, the custody key?
4. What authority is deliberately *not* granted for HGRDAT fields?
5. How does the planner distinguish planner readiness from physical write authority?
6. Which exact physical writer error proves partial authority has not leaked?
7. Which exact product-readiness blocker independently keeps partial HANGER apply disabled?
8. Why can malformed per-record tail evidence still permit delete-all?
9. How does PR1025 prevent an all-blank 13-byte integer field from silently becoming zero authority?
10. For H=3 deleting record 2, what is the old->new record index map?
11. What retained tail row indices are expected for INTERLEAVED order?
12. What retained tail row indices are expected for GROUPED order?
13. Why must the grouped row order not be canonicalized to interleaved order?
14. What complete-postimage proof is required before any physical partial-compaction PR may be merged?
