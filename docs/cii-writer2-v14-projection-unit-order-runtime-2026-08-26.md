# CII Writer2 V14 projection — unit order / equal-cardinality runtime evidence

Date: 2026-08-26  
PR: #1055  
Stage: W2.29

## 1. Scope

This record retains the exact two-file authored runtime for:

```text
tabs/cii-workspace/cii-workspace-v14-change-projection.js
tests/cii-workspace-v14-change-projection.test.js
```

The purpose is to prove that V14 projection cannot reinterpret retained physical-unit reorder as delete+insert, cannot treat same-count cardinality-unit replacement as fixed-row mutation, and cannot project unqualified HANGER/MISCEL data.

## 2. Defect found by source audit

The W2.27 projector used unique unit identities and LCS matching for cardinality changes. That was insufficient for:

```text
baseline: A, B
modified: B, A
```

A plain LCS can represent that as one delete plus one insert even though Writer2 compaction authority requires relative retained-unit order to remain unchanged.

A second path existed because equal physical row counts entered fixed-row projection before cardinality semantics were consulted.

A final authority inconsistency was also found: `MISCEL_1` remained on the projectable changed-section allowlist even though no V14 HANGER/MISCEL mutation has qualified packing authority.

## 3. First W2.29 exact run — real FAIL

Committed graph:

```text
projection module  6b83e85ff0229e9c6bbe3363beedbe5843d8c2d9
projection test    ae0f81ed419a26401194abc11e5c78b79164f044
```

Both local files were independently admitted by recomputing Git-object SHA over:

```text
blob <byte_length>\0<exact_bytes>
```

Command:

```text
node --experimental-default-type=module tests/cii-workspace-v14-change-projection.test.js
```

Result:

```text
FAIL
expected CII_V14_PROJECTION_UNIT_REORDER_NOT_AUTHORIZED:RESTRANT
received CII_V14_PROJECTION_ROW_WIDTH_MISMATCH:RESTRANT:0
```

Interpretation: the falsifier proved equal-cardinality RESTRANT changes were still being treated as row mutation instead of cardinality-unit custody.

## 4. Authority correction

For cardinality-qualified sections, any changed equal-cardinality payload no longer enters fixed-row mutation authority. Rows are grouped into qualified units, identities must be unique, and all common units must remain in ordered LCS position.

```text
moved common unit
  -> CII_V14_PROJECTION_UNIT_REORDER_NOT_AUTHORIZED

same-count unit replacement
  -> CII_V14_PROJECTION_EQUAL_CARDINALITY_UNIT_REPLACEMENT_NOT_AUTHORIZED
```

Qualified units remain:

```text
NODENAME   1 row/unit
RESTRANT  24 rows/unit
SIF&TEES  14 rows/unit
```

`MISCEL_1` was then removed entirely from V14 projectable changed sections. Any V14 HANGER/MISCEL delta now fails before row/cardinality projection:

```text
CII_V14_PROJECTION_CHANGED_SECTION_NOT_AUTHORIZED:MISCEL_1
```

No upstream `3D_Converters` Python file changed.

## 5. Intermediate corrected exact run

```text
module  2f1a9cde4b00ccc25c10f2f89b06628d93aafba9
test    ae0f81ed419a26401194abc11e5c78b79164f044
result  PASS
```

This established the unit-order/equal-cardinality correction before the final MISCEL authority tightening.

## 6. Final committed exact run

Final committed graph:

```text
module  0a16b1383da6ef58abf55c53a91711a0a1f21c17
test    586d6be0537162100979df63f56146db9d64c0e5
```

The exact local files were independently Git-object SHA admitted against those committed identities.

Command/result:

```text
node --experimental-default-type=module tests/cii-workspace-v14-change-projection.test.js
CII Workspace V14 canonical-delta projection: PASS
```

Classification:

```text
PASS_RUNTIME_EXACT_TWO_FILE_BLOB_GRAPH_NODE_ESM_MODE_W2_29_FINAL
```

## 7. What this proves

Within projector scope:

- converter canonicalization in unchanged sections does not leak into final native V14 bytes;
- changed sections outside the qualified allowlist fail closed;
- RESTRAINT delete retains original V14 bytes for surviving 24-row blocks;
- duplicate unit identities fail closed;
- retained-unit reorder fails closed;
- same-count cardinality-unit replacement cannot use fixed-row authority;
- non-isolated NODENAME cardinality fails closed;
- `MISCEL_1` / HANGER has no V14 projection authority and any change blocks;
- section-order drift and LF-only V14 material fail closed.

Final V14 projectable changed-section set is exactly:

```text
CONTROL
ELEMENTS
NODENAME
RESTRANT
SIF&TEES
```

## 8. Scope limit

This PASS does not qualify:

```text
current full 12-file frozen-source authored test
browser/Pyodide runtime
W2.13 synthetic product
retained-real V11 product
real native V14 Writer2 bridge
repository npm/browser regressions
external CAESAR acceptance
```
