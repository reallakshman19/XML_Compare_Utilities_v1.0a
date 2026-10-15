# CII Writer2 — native V14 benchmark and change-isolation correction

Date: 2026-08-26  
PR: #1055  
Pinned converter source: `reallaksh19/3D_Converters@ca8d391ac5f829f53bebb3c37adf0547c34a67b4`

> Authority note: this document originated the W2.27 native-benchmark policy correction. Sections describing the projection implementation are updated through W2.30 so they do not preserve superseded W2.27 prototype authority.

## 1. Purpose

The first XML-side V14 bridge required an untouched native V14 CII to satisfy:

```text
native V14 -> frozen V11 -> frozen V14 == native V14 byte-for-byte
```

That requirement was an XML Writer2 invention; it is not an upstream `3D_Converters` guarantee. The pinned converter qualifies cross-version dialect/semantic transformation but intentionally emits target-dialect numeric formatting.

The real paired benchmark proves whole-file cross-version byte identity is not a viable Writer2 admission rule.

## 2. Exact benchmark custody

Pinned archive:

```text
repository  reallaksh19/3D_Converters
commit      ca8d391ac5f829f53bebb3c37adf0547c34a67b4
path        Benchmarks/v11-v14.zip
size        10740 bytes
Git blob    8409e1c429665e34a83c2a464665ebf5d5f1b0a1
SHA-256     da0b276c4c2f3a44c3dcd0a6cddd6ca9fcdfc44709caac7af61083b79bb7f808
```

The archive was reconstructed from the pinned GitHub object and admitted only after recomputing the Git object hash over:

```text
blob 10740\0<exact zip bytes>
```

Archive members:

```text
SYS-0001-v14.CII
  size       168574 bytes
  ZIP CRC32  fee884d9
  SHA-256    d2d4316309d9b1aa34b55ad72f89193fd0e437930db203fecd9ede00e69b2faf

SYS-0001-v11.cii
  size       316571 bytes
  ZIP CRC32  c0e384d4
  SHA-256    41ef8912a55a978aa96b3300f42ba2ff335ba5bb35c4882f4012af0e011dc9cc
```

The pair is the upstream 112-element same-model benchmark.

## 3. Exact physical profile observed

Native V14 section row counts:

```text
VERSION      61
CONTROL       4
ELEMENTS   1680   = 112 x 15
AUX_DATA      0
NODENAME     55
BEND         27
RIGID        43
EXPJT         0
RESTRANT    960   = 40 x 24
DISPLMNT      0
FORCMNT       0
UNIFORM       0
WIND          0
OFFSETS       0
ALLOWBLS      0
SIF&TEES     28   = 2 x 14
REDUCERS      2   = 1 x 2
FLANGES       0
EQUIPMNT      0
MISCEL_1     23
UNITS        28
COORDS        2
```

The V14 member uses CRLF; the V11 member uses LF.

Physical-unit uniqueness in this benchmark:

```text
40 / 40 RESTRAINT 24-row blocks unique
2 / 2 SIF&TEES 14-row blocks unique
55 / 55 NODENAME 1-row units unique
```

This does not remove the runtime duplicate-unit blocker; it only proves this retained benchmark is not rejected by that ambiguity gate.

## 4. Decisive cross-version byte-identity falsifier

Pinned formatter authority:

```python
# V11 ordinary mid-range REAL
return f"{value:#.6G}"

# V14 REAL
return f"{value:.6E}"
```

The first exact native benchmark RIGID row is:

```text
native V14
   2.044599E+02 0.000000E+00
```

Applying the pinned formatter rules gives:

```text
V14 -> V11
        204.460     0.000000

V11 -> V14
   2.044600E+02 0.000000E+00
```

Therefore:

```text
2.044599E+02 != 2.044600E+02
```

The paired native V11 export is independently:

```text
        204.470     0.000000
```

The same deterministic formatting test finds **26 of the 43 V14 RIGID rows** are non-byte-reversible through the V11 formatter. No lossy engineering audit event is required for this difference.

Disposition:

```text
OLD_WHOLE_FILE_BASELINE_EXACT_ROUNDTRIP_GATE
  = REJECTED_BY_EXACT_BENCHMARK_SOURCE_FALSIFIER

UPSTREAM_CONVERTER_DEFECT
  = FALSE

XML_BRIDGE_POLICY_DEFECT
  = TRUE / CORRECTED_ON_PR1055
```

## 5. Corrected V14 Writer2 model

The bridge uses the frozen converter as a canonical differential oracle while original native V14 bytes remain physical authority:

```text
original native V14 TARGET0
    |
    +--> frozen V14 -> V11
    |        -> normalized V11 TARGET0
    |        -> existing V11 Writer2
    |        -> independently validated V11 TARGET1
    |
    +--> normalized V11 TARGET0 -> frozen V11 -> V14 -> canonical baseline V14
    |
    +--> validated V11 TARGET1 -> frozen V11 -> V14 -> canonical modified V14

canonical baseline -> canonical modified
    -> derive only Writer2-caused delta
    -> project onto ORIGINAL native V14 bytes
    -> projected V14 TARGET1
    -> frozen V14 -> V11
    -> MUST equal exact validated V11 TARGET1
```

The canonical V14 file is never the final Writer2 output.

## 6. Projection authority — superseding W2.27 prototype

Current implementation through W2.30:

```text
tabs/cii-workspace/cii-workspace-v14-change-projection.js
schema CIIWorkspaceV14ChangeProjection.v2
blob   0a16b1383da6ef58abf55c53a91711a0a1f21c17
scope  WRITER2_ONLY
```

Current changed-section allowlist is exactly:

```text
CONTROL
ELEMENTS
NODENAME
RESTRANT
SIF&TEES
```

`MISCEL_1` is **not** authorized. Any HANGER/MISCEL change blocks with:

```text
CII_V14_PROJECTION_CHANGED_SECTION_NOT_AUTHORIZED:MISCEL_1
```

Qualified Writer2 cardinality units:

```text
NODENAME   1 row/unit
RESTRANT  24 rows/unit
SIF&TEES  14 rows/unit in V14
```

Current fail-closed rules include:

```text
unique canonical unit identities required
isolated unit deletion/insertion only
retained common-unit order must remain unchanged
duplicate unit identity -> BLOCK
unit misalignment -> BLOCK
mixed replacement/cardinality run -> BLOCK
same-count unit replacement -> BLOCK
unlisted changed section -> BLOCK
```

Specific W2.29 blockers:

```text
CII_V14_PROJECTION_UNIT_REORDER_NOT_AUTHORIZED
CII_V14_PROJECTION_EQUAL_CARDINALITY_UNIT_REPLACEMENT_NOT_AUTHORIZED
```

### W2.30 Writer2-only boundary

Equal-cardinality existing-field edits in the cardinality-owned sections are **not** qualified for V14 in this PR:

```text
NODENAME Writer1C existing-field edit   -> V14 NOT_QUALIFIED
RESTRANT Writer1A/1B existing fields    -> V14 NOT_QUALIFIED
SIF&TEES Writer1C ii/io existing fields -> V14 NOT_QUALIFIED
```

V11 Writer1 authority remains unchanged. Future V14 Writer1 support requires a separate field-identity projection contract and must not be enabled by weakening the Writer2 unit blocker.

### NODENAME existing-section boundary

Existing V11 Writer2 requires a physical `#$ NODENAME` section and a following marker. Therefore V14 Writer2 inherits:

```text
qualified: row insertion/deletion inside an existing NODENAME section
not qualified: create an absent whole NODENAME section
```

Final authority gate remains:

```text
frozen V14->V11(projected V14 TARGET1)
    == exact validated Writer2 V11 TARGET1 bytes
```

Thus converter formatting normalization outside Writer2's actual mutation cannot leak into final V14 bytes.

## 7. Projector runtime history

W2.27 original focused graph established the change-isolation mechanism. W2.29 then found and fixed retained-unit reorder, equal-cardinality bypass, and MISCEL authority gaps.

Final W2.29 graph:

```text
module  0a16b1383da6ef58abf55c53a91711a0a1f21c17
test    586d6be0537162100979df63f56146db9d64c0e5
result  PASS_RUNTIME_EXACT_TWO_FILE_BLOB_GRAPH_NODE_ESM_MODE_W2_29_FINAL
```

W2.30 Writer2-only scope graph:

```text
module  0a16b1383da6ef58abf55c53a91711a0a1f21c17
test    90b7b8fb4edbdb63accbf0ff21a8185610ab06b0
command node --experimental-default-type=module tests/cii-workspace-v14-change-projection.test.js
result  PASS
class   PASS_RUNTIME_EXACT_TWO_FILE_BLOB_GRAPH_NODE_ESM_MODE_W2_30_WRITER2_ONLY_SCOPE
```

The W2.30 test explicitly falsifies equal-cardinality NODENAME, RESTRANT, and SIF&TEES field changes.

This PASS does **not** qualify the full frozen Python browser graph, W2.13 product, real native V14 Writer2 mutation, V14 Writer1 fields, or external CAESAR acceptance.

## 8. Current qualification state

```text
BENCHMARK_ZIP_CUSTODY                    PASS_EXACT_GIT_BLOB
BENCHMARK_PAIR_EXTRACTION                PASS_EXACT_BYTES
OLD_BASELINE_EXACT_GATE                  REJECTED_EXACT_BENCHMARK_SOURCE_FALSIFIER
V14_CHANGE_ISOLATION_ARCHITECTURE        IMPLEMENTED
V14_WRITER2_PROJECTOR_FOCUSED_RUNTIME    PASS_RUNTIME_EXACT_TWO_FILE_BLOB_GRAPH_NODE_ESM_MODE_W2_30_WRITER2_ONLY_SCOPE
FROZEN_ENGINE_AUTHORED_PYTHON            PASS_RUNTIME_EXACT_SEVEN_FILE_BLOB_GRAPH
FROZEN_SOURCE_JS_HISTORICAL_18433C       PASS_RUNTIME_EXACT_TWELVE_FILE_BLOB_GRAPH_NODE_ESM_MODE
FROZEN_SOURCE_JS_CURRENT_095DDB          NOT_RUN_AFTER_ASSERTION_STRENGTHENING
W2_13_SYNTHETIC_PRODUCT                  NOT_RUN_EXACT_EXECUTABLE_ENVIRONMENT
W2_13_RETAINED_REAL_V11                  NOT_RUN_EXACT_EXECUTABLE_ENVIRONMENT
REAL_WRITER2_PROJECTED_V14_MUTATION      NOT_RUN
PROJECTED_V14_FINAL_NORMALIZATION_PROOF  IMPLEMENTED_PENDING_RUNTIME
BROWSER_PYODIDE_PRODUCT                  NOT_RUN
LIVE_UI_AUTO_ADOPTION                    DISABLED
V14_WRITER1_FIXED_FIELDS                 NOT_QUALIFIED_FAIL_CLOSED
EXTERNAL_CAESAR_ACCEPTANCE               NOT_RUN
```

## 9. Remaining runtime gates

```text
1. unchanged W2.13 synthetic product on the exact full Workspace graph
2. retained-real V11 Writer2 product on the exact full Workspace graph
3. real native V14 Writer2 mutation through canonical differential + original-byte projection
4. projected V14 -> V11 exact equality with Writer2 V11 postimage
5. inherited Writer2 + Writer1 adjacent + repository/browser regressions
6. external CAESAR import/save/re-export acceptance, tracked separately
```
