# Writer 2 — HANGER DELETE authority

## Status

This document qualifies a **planner only** for deleting existing hanger records from an IHGRNODE-first CAESAR II 2019 `MISCEL_1` layout.

It does **not** qualify a physical writer and it does **not** qualify HANGER CREATE.

Policy token:

```text
CII_WRITER_2_HANGER_DELETE_COMPACTION
```

CREATE blocker:

```text
WRITER_2_HANGER_CREATE_PAYLOAD_SEMANTICS_NOT_QUALIFIED
```

Partial multi-record blocker:

```text
WRITER_2_HANGER_PARTIAL_MULTI_RECORD_TAIL_ORDER_UNQUALIFIED
```

## Source basis

`converters/scripts/cii2019_section_rules.py` establishes the CII 2019 row-count model:

```text
CONTROL row 1:
NUMELT, NUMNOZ, NOHGRS, NONAM, NORED, NUMFLG

MISCEL_1 prefix:
RRMAT                         ceil(NUMELT / 6) rows
VFLEX                         4 * NUMNOZ rows

hanger payload, H=NOHGRS > 0:
2 default/header rows
IHGRNODE                      ceil(H / 6) packed rows
HGRDAT + TAG/GUID             4 * H rows total
IHGRFREE                      H rows
IHGRNUM                       ceil(H / 6) packed rows
IHGRTABLE                     ceil(H / 6) packed rows
IHGRSHORT                     ceil(H / 6) packed rows
IHGRCN                        ceil(H / 6) packed rows

MISCEL_1 suffix:
execution options             4 rows
```

Therefore:

```text
hanger payload rows, H>0 = 2 + 5*H + 5*ceil(H/6)
```

and complete nonblank `MISCEL_1` rows are:

```text
ceil(NUMELT/6) + 4*NUMNOZ + hanger_payload_rows(H) + 4
```

`tabs/cii-workspace/cii-workspace-hanger.js` qualifies `CONTROL.NOHGRS` plus `MISCEL_1.IHGRNODE` node presence and identifies the IHGRNODE-first layout as:

```text
CAESAR_SYNCHRONIZER_IHGRNODE_FIRST
```

The parser-compatible alternate layout:

```text
INPUTXML_CURRENT_HGRDAT_FIRST
```

remains read-only for Writer 2.

## QF-1019-001 — multi-hanger tail-order conflict

A source audit found that the two repository emitters cited by the original PR do **not** establish one common H>1 HGRDAT/TAG-GUID order:

`converters/scripts/cii2019_hanger_miscel_control.py` emits:

```text
IHGRNODE
record1: HGRDAT1, HGRDAT2, TAG, GUID
record2: HGRDAT1, HGRDAT2, TAG, GUID
...
IHGRFREE records
packed arrays
```

while `converters/scripts/cii2019_miscel_hardener.py` emits:

```text
IHGRNODE
all HGRDAT records
all TAG/GUID records
IHGRFREE records
packed arrays
```

For H=1 these orders are physically equivalent. For H>1 they are not.

`buildCiiHangerEvidence()` proves the IHGRNODE position only; its `CAESAR_SYNCHRONIZER_IHGRNODE_FIRST` label does not distinguish these two tail orders. Therefore it is not sufficient authority for partial H>1 record compaction.

### Corrected authority

Writer 2 may plan:

1. deletion when H=1, which necessarily deletes the complete hanger payload; or
2. deletion of **all existing hanger records** when H>1, because the entire hanger payload is removed and retained per-record HGRDAT/TAG-GUID mapping is unnecessary.

Writer 2 must block:

```text
H > 1 and 0 < deleted_record_count < H
```

with:

```text
WRITER_2_HANGER_PARTIAL_MULTI_RECORD_TAIL_ORDER_UNQUALIFIED
```

The old `1,2,3 -> 1,0,2` arithmetic remains a mathematical mapping only. It is **not mutation authority** until the H>1 tail ordering is source-qualified.

## Why delete-all can be qualified before CREATE

Deleting all existing hangers needs no synthesis or interpretation of retained hanger engineering data:

```text
CONTROL.NOHGRS -> 0
hanger defaults -> removed
IHGRNODE -> removed
complete HGRDAT/TAG/GUID envelope -> removed
IHGRFREE -> removed
IHGRNUM/IHGRTABLE/IHGRSHORT/IHGRCN -> removed
RRMAT/VFLEX -> retained byte-for-byte
execution rows -> retained byte-for-byte
```

CREATE is different. It requires authoritative construction/default/sentinel semantics for every new HGRDAT value, TAG/GUID representation, IHGRFREE value and packed-array value. Those semantics remain unresolved.

## Physical custody gates

The planner requires:

1. explicit `BOUND` transfer scope;
2. original TARGET byte custody;
3. qualified existing hanger node custody;
4. IHGRNODE-first layout `CAESAR_SYNCHRONIZER_IHGRNODE_FIRST`;
5. exact `CONTROL.NOHGRS` field at CONTROL row 1 field 3, width 13;
6. `CONTROL.NOHGRS == hangerEvidence.count`;
7. exact nonblank `MISCEL_1` row count from the formula above;
8. no blank physical rows inside `MISCEL_1`;
9. all five packed H-length arrays contain exactly H integer values;
10. every packed integer row has the canonical `2X` prefix and exact 13-byte value-field custody;
11. physical IHGRNODE order equals qualified `hangerEvidence.nodes` order;
12. every DELETE operation is REVIEWED/LOCKED and targets exactly one node;
13. every physical hanger record at that node is selected;
14. no other APPLY family is admitted;
15. partial H>1 deletion is blocked until tail order is qualified.

## Compaction arithmetic versus mutation authority

The index map is still calculated for audit testimony:

```text
old selected index      -> 0
old retained index      -> sequential retained index
```

For example:

```text
1 -> 1
2 -> 0
3 -> 2
```

But for H=3 deleting only record 2, the planner status is `BLOCKED`. The map must not be consumed as authorization for retained HGRDAT/TAG-GUID bytes.

For delete-all:

```text
1 -> 0
2 -> 0
...
H -> 0
```

and retained opaque-record authority is unnecessary.

## Real benchmark oracle

`Benchmark/CIICompare/BM_CII_SOURCE.CII` provides:

```text
NUMELT = 40
NUMNOZ = 0
NOHGRS = 1
hanger node = 205
```

Observed arithmetic:

```text
RRMAT                    ceil(40/6) = 7
hanger payload           2 + 5*1 + 5*ceil(1/6) = 12
execution rows           4
complete payload         23 rows
```

Deleting its only hanger is an authorized delete-all projection:

```text
NOHGRS                    1 -> 0
old record 1              -> 0
MISCEL_1 rows             23 -> 11
                         = 7 RRMAT + 4 execution
```

Because H=1, the conflicting HGRDAT/TAG-GUID orderings collapse to the same physical sequence.

## Explicit exclusions

This phase does not authorize:

```text
HANGER CREATE
partial H>1 HANGER DELETE
HANGER attribute editing
alternate INPUTXML_CURRENT layout mutation
ambiguous SAME_NODES dual-layout mutation
nozzle VFLEX mutation
RRMAT mutation
execution-option mutation
physical MISCEL_1 rewrite
product/core Writer-2 routing
Writer-3 topology mutation
```

## Next phase

After this narrowed planner is accepted, a physical HANGER DELETE writer may implement **delete-all only** first:

```text
untouched TARGET
 -> CONTROL.NOHGRS 0
 -> preserve RRMAT/VFLEX bytes
 -> remove complete hanger payload
 -> preserve execution rows
 -> one variable-length byte patch
 -> re-intake
 -> independently reconstruct complete expected postimage
 -> PASS only on exact byte equality
```

Partial retained-record compaction must remain blocked until the H>1 tail order is independently source-qualified.