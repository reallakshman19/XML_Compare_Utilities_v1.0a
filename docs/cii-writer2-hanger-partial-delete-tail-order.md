# Writer 2 — H>1 HANGER partial-delete tail-order qualification

## Status

This phase qualifies **physical tail-order classification and per-record row ownership only**.

It does **not** relax the merged `WRITER_2_HANGER_PARTIAL_MULTI_RECORD_TAIL_ORDER_UNQUALIFIED` planner blocker, does not perform physical compaction, and does not change product/core routing.

The new authority token is:

```text
PHYSICAL_ROW_SHAPE_PLUS_DUAL_EMITTER_ORDER
```

The existing HANGER CREATE blocker remains unchanged:

```text
WRITER_2_HANGER_CREATE_PAYLOAD_SEMANTICS_NOT_QUALIFIED
```

## Source conflict being resolved

Merged PR1019 correctly found two H>1 `MISCEL_1` tail orders in the repository source basis.

At `reallaksh19/3D_Converters@ca8d391ac5f829f53bebb3c37adf0547c34a67b4`:

`converters/scripts/cii2019_hanger_miscel_control.py` states and emits:

```text
IHGRNODE
record 1: HGRDAT1, HGRDAT2, TAG, GUID
record 2: HGRDAT1, HGRDAT2, TAG, GUID
...
IHGRFREE
packed arrays
```

`converters/scripts/cii2019_miscel_hardener.py` emits:

```text
IHGRNODE
all HGRDAT1/HGRDAT2 record pairs
all TAG/GUID record pairs
IHGRFREE
packed arrays
```

For H=1 the sequences are identical. For H>1 they differ.

## Why the conflict is physically classifiable

Both emitters give each hanger exactly:

```text
HGRDAT1  numeric fixed-field row, 6 values
HGRDAT2  numeric fixed-field row, 5 values
TAG      string-card row
GUID     string-card row
```

The string card is physically distinguishable from the numeric HGRDAT rows:

```text
7X + I5 length + 1X + up to 100 character body
```

The synchronizer permits an empty compact string card containing only the 13-character prefix; the hardener pads the 100-character body. Both forms are admitted only when the declared length fits the available body.

Therefore an untouched `4*H` HGRDAT/TAG/GUID envelope can be classified without interpreting engineering values.

### Interleaved signature

For every record `i`:

```text
row 4i+1 -> numeric, 6 values
row 4i+2 -> numeric, 5 values
row 4i+3 -> string card
row 4i+4 -> string card
```

### Grouped signature

For the first `2H` rows:

```text
record i -> numeric 6-value row, numeric 5-value row
```

followed by `2H` string rows:

```text
record i -> TAG string card, GUID string card
```

For H>1 exactly one signature must match. If neither or both match, classification fails closed.

## Qualified per-record row ownership

The classifier emits only original-envelope 1-based row indices.

For H=3 interleaved:

```text
record 1 -> HGRDAT [1,2], TAG 3,  GUID 4
record 2 -> HGRDAT [5,6], TAG 7,  GUID 8
record 3 -> HGRDAT [9,10], TAG 11, GUID 12
```

For H=3 grouped:

```text
record 1 -> HGRDAT [1,2], TAG 7,  GUID 8
record 2 -> HGRDAT [3,4], TAG 9,  GUID 10
record 3 -> HGRDAT [5,6], TAG 11, GUID 12
```

The retention helper preserves the **original ordering class**. It must never convert grouped bytes to interleaved bytes or vice versa.

Example, retain records 1 and 3:

```text
interleaved retained row order -> 1,2,3,4,9,10,11,12
grouped retained row order     -> 1,2,5,6,7,8,11,12
```

## Fail-closed gates

Classification blocks when any of these is true:

1. H is not a positive safe integer;
2. envelope row count is not exactly `4*H`;
3. expected HGRDAT rows do not decode to exactly 6 then 5 finite numeric values;
4. expected TAG/GUID rows do not satisfy the string-card physical contract;
5. H>1 matches neither known order;
6. H>1 somehow matches both known orders.

No heuristic nearest-match or row coercion is allowed.

## What this phase still does not authorize

```text
partial H>1 planner READY
partial H>1 physical MISCEL_1 rewrite
CONTROL.NOHGRS rewrite for partial delete
IHGRNODE / IHGRNUM / IHGRTABLE / IHGRSHORT / IHGRCN repacking
IHGRFREE row compaction
product/core Writer2 partial HANGER route
HANGER CREATE
hanger attribute editing
alternate HGRDAT-first parent layout mutation
```

The merged product remains unchanged and partial H>1 deletion remains blocked until a successor integrates this classifier into the planner and proves complete record-index custody across:

```text
IHGRNODE
HGRDAT/TAG/GUID
IHGRFREE
IHGRNUM
IHGRTABLE
IHGRSHORT
IHGRCN
```

## Successor gate

The next PR may remove the current planner blocker only if it can prove, from one untouched TARGET preimage:

1. qualified `CAESAR_SYNCHRONIZER_IHGRNODE_FIRST` parent layout;
2. qualified tail-order classifier result;
3. exact record index selected by every approved HANGER DELETE operation;
4. retained HGRDAT/TAG/GUID row ownership from this classifier;
5. retained IHGRFREE row ownership by the same record index;
6. retained packed-field ownership for all five packed H-length arrays;
7. deterministic old-record-index -> new-record-index mapping;
8. no physical write yet unless a separate independent postimage validator is added.
