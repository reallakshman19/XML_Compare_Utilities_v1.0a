# CII Writer 2 — V11 SIF/TEE block DELETE authority

## Verdict

```text
V11_EXISTING_BLOCK_DELETE_REINDEX: QUALIFIED_CANDIDATE
V11_NEW_BLOCK_CREATE: BLOCKED
CREATE_BLOCKER: WRITER_2_SIF_CREATE_PAYLOAD_SEMANTICS_UNQUALIFIED_ITEMS_27_30
```

This phase separates **structural deletion/relocation** from **semantic block construction**.

## Source-qualified V11 structure

Existing repository source qualification establishes for CAESAR II neutral Version 11:

```text
section                 #$ SIF&TEES
format                  2X,6G13.6
tee slots per block     2
items per tee slot      30
rows per tee slot       5
rows per block          10
ELEMENT pointer         row 13, field index 4
pointer basis           1-based SIF block index
CONTROL SIF count       CONTROL row 3, field index 4
```

The Version-11 source directly names items 1..26. Items 27..30 remain unresolved for both tee slots.

The qualified field map therefore contains:

```text
60 physical fields total
52 directly named V11 fields
 8 unresolved fields = items 27..30 x 2 slots
```

The selected Writer-1C ii/io positions remain independently qualified and unchanged by this phase.

## Structural corroboration

The protected `reallaksh19/3D_Converters` V11/V14 record adapter independently treats a V11 SIF auxiliary as:

```text
two independent tee slots x 30 values
= two slots x five rows
= ten rows total
```

For V11→V14 it preserves all leading 30 V11 values per slot and appends 12 zero extension values per slot. For V14→V11 it removes only the 12-value V14 extension after explicitly checking for unsupported non-zero extension content.

This corroborates **record shape and slot boundaries**. It does not resolve the engineering meanings of V11 items 27..30.

## Why DELETE can be qualified before CREATE

A Writer-2 DELETE transaction does not synthesize or reinterpret any retained SIF field.

For a selected existing block:

```text
1. prove exact ELEMENT -> physical pointer ownership;
2. require every owner of a shared pointer to be selected;
3. remove that complete existing 10-row block;
4. retain every other block byte-for-byte;
5. compact 1-based block indices;
6. derive every ELEMENT pointer transition caused by compaction;
7. derive CONTROL SIF-count_after from retained block count.
```

No field inside a retained block changes. No field inside the removed block is reinterpreted to construct new engineering data.

Example:

```text
before block pointers: 1,2,3
delete block 2
old -> new:            1->1, 2->0, 3->2
```

The `3->2` pointer rewrite is a mandatory relocation consequence even when its ELEMENT was not selected for deletion.

## Why CREATE remains blocked

A new block requires an authoritative postimage for all 60 physical fields, including both slots' items 27..30.

Neither of these is sufficient:

```text
- copying an opaque SOURCE 10-row payload;
- filling unresolved items with zero/default values;
- inferring meanings from later neutral editions;
- assuming the protected V11/V14 structural converter defines V11 engineering semantics.
```

The earlier Writer-1C qualification specifically established that parser ownership and fixed position do not, by themselves, authorize raw-field copying. Writer 2 does not relax that rule.

CREATE can only be revisited after either:

1. items 27..30 are source-qualified for the exact V11 edition and the complete block-construction/default rules are authoritative; or
2. a separately qualified source proves an exact whole-block transfer contract, including semantic compatibility and default/sentinel behavior for every field.

Until then:

```text
WRITER_2_SIF_CREATE_PAYLOAD_SEMANTICS_UNQUALIFIED_ITEMS_27_30
```

is mandatory.

## Shared-pointer rule

If multiple ELEMENTs own one SIF pointer, deleting the block for only some owners would create an unapproved alias effect.

Therefore:

```text
all physical owners selected   -> deletion may proceed
any physical owner unselected  -> BLOCK
```

There is no last-writer-wins or implicit owner detachment.

## Edition gate

This slice is V11 only.

Later neutral editions change SIF block shape and field ordering. V14/V15 use 42 items per tee and 14 rows per auxiliary block, with known item-order drift. A V11 pointer/cardinality planner must therefore fail closed on non-V11 custody.

## Current phase boundary

Authorized candidate:

```text
existing V11 SIF block DELETE
shared-owner arbitration
block compaction
oldPointer -> newPointer map
ELEMENT pointer relocation plan
CONTROL SIF-count_after
```

Not yet authorized in this PR:

```text
physical byte rewrite/export
SIF block CREATE
raw block COPY
field-level Type/code mutation
hanger cardinality
other auxiliary-section relocation
Writer 3 topology mutation
```
