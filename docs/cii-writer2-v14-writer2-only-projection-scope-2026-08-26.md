# CII Writer2 V14 bridge — Writer2-only projection scope

Date: 2026-08-26  
PR: #1055  
Stage: W2.30

## Decision

The V14 change-isolation bridge in PR #1055 is a **Writer2 bridge only**.

It does not qualify V14 execution of Writer1B/Writer1C equal-cardinality fixed-field edits in `NODENAME`, `RESTRANT`, or `SIF&TEES`.

Those three sections have qualified Writer2 physical cardinality units:

```text
NODENAME   1 row/unit
RESTRANT  24 rows/unit
SIF&TEES  14 rows/unit
```

For those sections, a canonical baseline/modified payload change with unchanged row count fails closed with:

```text
CII_V14_PROJECTION_EQUAL_CARDINALITY_UNIT_REPLACEMENT_NOT_AUTHORIZED:<section>
```

This prevents a lower-writer field mutation, record reorder, or whole-unit replacement from being silently treated as Writer2 projection authority.

## Current V14 Writer2 surface

```text
CONTROL
  qualified Writer2 count/cardinality field changes only through validated V11 Writer2 postimage

ELEMENTS
  qualified Writer2 pointer relocation/reindex fields only through validated V11 Writer2 postimage

NODENAME
  Writer2 row insertion/deletion within an EXISTING NODENAME section
  equal-cardinality field edits are not V14-qualified here

RESTRANT
  Writer2 24-row block cardinality/compaction only
  equal-cardinality Writer1A/1B restraint field edits are not V14-qualified here

SIF&TEES
  Writer2 14-row V14 block cardinality/compaction only
  equal-cardinality Writer1C ii/io edits are not V14-qualified here

MISCEL_1 / HANGER
  no V14 projection authority
```

V11 Writer1A/1B/1C authority is unchanged by this restriction.

## NODENAME whole-section boundary

The existing qualified V11 Writer2 NODENAME implementation calls `rawSectionEnvelope(..., 'NODENAME')` and throws if the physical section is absent or if there is no following section marker.

Therefore the qualified capability is:

```text
existing NODENAME section
  -> row CREATE / DELETE
  -> CONTROL NONAM cardinality update
  -> ELEMENT NODENAME pointer relocation/reindex
```

It is not:

```text
absent NODENAME section
  -> create a new whole NODENAME section
```

The V14 bridge does not widen that V11 structural authority.

## Exact focused runtime

W2.30 strengthened the existing projection test with three explicit equal-cardinality field-change falsifiers:

```text
NODENAME  -> BLOCK
RESTRANT  -> BLOCK
SIF&TEES  -> BLOCK
```

Exact committed graph:

```text
projection module
0a16b1383da6ef58abf55c53a91711a0a1f21c17

projection test
90b7b8fb4edbdb63accbf0ff21a8185610ab06b0
```

Each local file was admitted by recomputing its Git-object SHA over:

```text
blob <byte_length>\0<exact_bytes>
```

Command:

```text
node --experimental-default-type=module tests/cii-workspace-v14-change-projection.test.js
```

Result:

```text
CII Workspace V14 canonical-delta projection: PASS
```

Classification:

```text
PASS_RUNTIME_EXACT_TWO_FILE_BLOB_GRAPH_NODE_ESM_MODE_W2_30_WRITER2_ONLY_SCOPE
```

## Scope limits

This PASS does not qualify:

```text
V14 Writer1A/1B/1C field projection
full Writer2 Workspace product graph
W2.13 synthetic product
retained-real V11 product
real native V14 Writer2 mutation
browser/Pyodide runtime
repository npm/full regressions
external CAESAR acceptance
```

## Future V14 Writer1 requirement

If V14 Writer1 field editing is later required, it must use a separate source-qualified field-identity projection contract. It must not be enabled by weakening the Writer2 unit-replacement blocker in this PR.
