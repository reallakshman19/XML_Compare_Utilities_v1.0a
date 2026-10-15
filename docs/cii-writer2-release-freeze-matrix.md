# CII Writer 2 — release/freeze capability matrix

Status: **LIVE STACKED CLOSURE ON PR #1055**

```text
BASE_MAIN = 297fb37a0e894a3aac91de9188ebf30e810781fb
V11_ENGINEERING_AUTHORITY = CAESAR II 2019 / Version 11.0
V14_DIALECT_BRIDGE_SOURCE = reallaksh19/3D_Converters@ca8d391ac5f829f53bebb3c37adf0547c34a67b4
CURRENT_STAGE = W2.34 WRITER2 EXPORT CUSTODY
PROGRAM_VERDICT = NOT_READY_FOR_WRITER2_RELEASE_FREEZE
```

## 1. Global invariants

```text
one untouched writer-domain TARGET0
canonical BOUND APPLY / EXCLUDE scope
cryptographic target custody
original-coordinate claim arbitration
independent complete V11 postimage oracle
no last-writer-wins
no fabricated authority
no unexecuted test represented as PASS
no Writer3 topology leakage
```

V14 / product invariants:

```text
frozen pinned 3D_Converters source only
allow_lossy = false
original V14 SHA retained
normalized V11 SHA retained
existing V11 Writer2 only
canonical modified V14 must downgrade exactly to Writer2 V11 TARGET1
final V14 output = ORIGINAL V14 bytes + isolated canonical Writer2 delta
final projected V14 must downgrade exactly to Writer2 V11 TARGET1
canonical V14 is differential evidence only
changed section must be explicitly projectable
cardinality changes use qualified physical units only
CONTROL/ELEMENTS changes must pass exact field-identity guard
physical cardinality change requires matching CONTROL count and same-family pointer claim
V14 Writer1 fixed-field projection is not qualified
MISCEL_1/HANGER has no V14 projection authority
explicit Writer2 product route must use the version bridge
ordinary product default remains Writer1B
Writer2 export requires versionBridgeValidation.status = PASS
Writer2 export requires byteString
Writer2 text fallback is forbidden
```

Whole-file `V14 -> V11 -> V14 == original` is retired by exact native benchmark evidence.

## 2. Binding Issue #1042

```text
CONTROL zero-based row0 field3 = NONAM/NODENAME count
CONTROL zero-based row1 field3 = RESTRAINT auxiliary-block count
```

W2.11 P19 and W2.12 R09 remain mandatory negative-assurance anchors.

## 3. V14 change-isolation architecture

```text
ORIGINAL V14 TARGET0
  -> frozen V14->V11 -> normalized V11 TARGET0
  -> existing V11 Writer2 -> independently validated V11 TARGET1
  -> frozen V11->V14 -> canonical modified V14

normalized V11 TARGET0 -> frozen V11->V14 -> canonical baseline V14

canonical baseline vs modified
  -> W2.31/W2.32 fixed-field + pointer-correlation authority guard
  -> W2.29/W2.30 change projector
  -> project onto ORIGINAL V14
  -> projected V14 TARGET1
  -> frozen V14->V11
  -> MUST equal exact validated V11 TARGET1
```

## 4. V14 projector — W2.30

```text
module tabs/cii-workspace/cii-workspace-v14-change-projection.js
schema CIIWorkspaceV14ChangeProjection.v2
blob   0a16b1383da6ef58abf55c53a91711a0a1f21c17
```

Projectable changed sections exactly:

```text
CONTROL
ELEMENTS
NODENAME
RESTRANT
SIF&TEES
```

Qualified physical cardinality units:

```text
NODENAME   1 row/unit
RESTRANT  24 rows/unit
SIF&TEES  14 rows/unit
```

Equal-cardinality Writer1-style field edits in those cardinality sections, retained-unit reorder, non-isolated cardinality runs, MISCEL/HANGER changes and absent whole NODENAME section creation remain fail-closed.

Exact W2.30 runtime:

```text
module  0a16b1383da6ef58abf55c53a91711a0a1f21c17
test    90b7b8fb4edbdb63accbf0ff21a8185610ab06b0
PASS_RUNTIME_EXACT_TWO_FILE_BLOB_GRAPH_NODE_ESM_MODE_W2_30_WRITER2_ONLY_SCOPE
```

## 5. V14 Writer2 fixed-field / pointer authority — W2.31/W2.32

```text
module tabs/cii-workspace/cii-workspace-v14-writer2-fixed-field-authority.js
schema CIIWorkspaceV14Writer2FixedFieldAuthority.v1
current blob fc97ddd7fd5645e46c70a722c7f96f17dc7ae188
bridge integration blob 8038993f0a97719c0c316f31c2d6c30ea0386ec4
```

Allowed CONTROL coordinates:

```text
row0 field3  CONTROL_NODENAME_NONAM_COUNT
row1 field3  CONTROL_RESTRAINT_BLOCK_COUNT
row2 field4  CONTROL_SIF_TEE_BLOCK_COUNT
```

Allowed ELEMENTS coordinates per 15-row element block:

```text
row12 field3 ELEMENT_RESTRAINT_POINTER
row13 field4 ELEMENT_SIF_TEE_POINTER
row13 field5 ELEMENT_NODENAME_POINTER
```

Rules:

```text
changed CONTROL/ELEMENT field outside six coordinates -> BLOCK
count/pointer values must be non-negative integers
physical cardinality change requires matching CONTROL before/after count
CONTROL count change without cardinality change -> BLOCK
pointer change without cardinality change -> BLOCK
physical cardinality change without same-family pointer claim -> BLOCK
SIF/RESTRAINT cardinality increase -> BLOCK
changed pointer must remain within before/after physical block count
```

Runtime:

```text
W2.31
  module 7bc3a83ef37159c9a70fb0e16acaba721fd73b26
  test   74077b00b094c5e30ff402f8a0adeb1814bb24cc
  PASS_RUNTIME_EXACT_TWO_FILE_BLOB_GRAPH_NODE_ESM_MODE_W2_31_FIXED_FIELD_AUTHORITY

W2.32
  module fc97ddd7fd5645e46c70a722c7f96f17dc7ae188
  test   78dbe0af0b8d0d8fd55aae26f586f727bb2d03df
  PASS_RUNTIME_EXACT_TWO_FILE_BLOB_GRAPH_NODE_ESM_MODE_W2_32_POINTER_CORRELATION
```

## 6. W2.33/W2.34 live Writer2 product route

W2.33 fixed product reachability/routing:

```text
ordinary CII Workspace tile -> Writer1B default unchanged
separate CII Writer 2 — V11/V14 tile -> explicit writerVersion='2'
Writer2 inspection -> inspectCiiWorkspaceModelsWithVersionBridge
Writer2 preview    -> createCiiWorkspacePreviewWithVersionBridge
Writer2 apply      -> applyCiiWorkspaceTargetWriter2WithVersionBridge
scoped apply       -> requires preview.versionBridge
```

W2.34 fixes final export custody on both product surfaces:

```text
WRITER_2 export
  versionBridgeValidation.status MUST be PASS
  byteString MUST be present
  exact byteString is exported
  applied.text fallback is forbidden
```

Fail-closed blockers:

```text
CII_WRITER_2_VERSION_BRIDGE_VALIDATION_REQUIRED
CII_WRITER_2_BYTE_STRING_REQUIRED
```

Current W2.34 blobs:

```text
shell                 226ae8f3a7906b0d28a8c10195ad9b27d7f6444e
scoped transfer UI    4d60b2c1f418ed3a7490a1f4d91f3c83f2cc5ae8
engineering UI        cff53d820075417f817d6768c16ce550910c28c5
workspace tile        b7589c7595f3b33cdd8529a03c7e990da4b68d76
bridge                8038993f0a97719c0c316f31c2d6c30ea0386ec4
focused regression    20b31c241ded6e475fe293277e3f3d29ac787093
broader regression    2b01a6eba2e60eabdb3dd19b28c7aaba1deb758d
```

Qualification:

```text
focused W2.34 source regression
  PASS_SOURCE_INSPECTION_W2_34_LIVE_V11_V14_BRIDGE_AND_EXPORT_CUSTODY
  graph 7 files
  runtime NOT_RUN_EXACT_7_FILE_GRAPH_NOT_MATERIALIZED

broader routing/export regression
  PASS_SOURCE_INSPECTION_BRIDGE_BOUND_PRODUCT_AND_EXPORT_CUSTODY
  graph 14 files
  runtime NOT_RUN_EXACT_14_FILE_GRAPH_NOT_MATERIALIZED

browser/product runtime
  NOT_RUN
```

No source-inspection result is represented as runtime PASS.

## 7. Result and audit custody

The bridge returns a V14 Writer2 result only after both proofs pass:

```text
canonical modified V14 -> V11 == independently validated V11 TARGET1
projected native V14    -> V11 == independently validated V11 TARGET1
```

`validation` remains the independent V11 semantic oracle and `versionBridgeValidation` is the final-dialect proof. A mismatch throws before return.

Explicit scope binding preserves `preview.audit`, and artifact export serializes the resulting audit, so version-bridge evidence remains in downloaded audit JSON.

Mixed V11/V14 SOURCE/TARGET combinations retain independent side version/hash evidence; TARGET original version controls the actual write dialect. The bridge is therefore not modified merely to rename aggregate mode.

## 8. Capability matrix

| Family / operation | Owner | V11 disposition | V14 disposition |
|---|---|---|---|
| NODENAME row CREATE/DELETE + pointer reindex | Writer2 | DONE, existing section required | Implemented, existing section required; full bridge runtime pending |
| NODENAME existing-field update | Writer1C | DONE | NOT_QUALIFIED_FAIL_CLOSED |
| SIF block DELETE/compaction/reindex | Writer2 | DONE | 14-row DELETE-only projection implemented; full bridge runtime pending |
| SIF existing ii/io update | Writer1C | DONE | NOT_QUALIFIED_FAIL_CLOSED |
| SIF new block CREATE | Writer2 | SOURCE_BLOCKED_REAFFIRMED_V11 | NOT AUTHORIZED |
| HANGER delete-all / partial | Writer2 | DONE / DONE_PRODUCT_ROUTED | NOT_AUTHORIZED_FAIL_CLOSED |
| HANGER CREATE | Writer2 | SOURCE_BLOCKED_REAFFIRMED_V11 | NOT AUTHORIZED |
| RESTRAINT whole 24-row block DELETE | Writer2 | IMPLEMENTED_RUNTIME_PENDING | 24-row DELETE-only projection implemented; full bridge runtime pending |
| RESTRAINT existing numeric/free-slot fields | Writer1A/1B | DONE | NOT_QUALIFIED_FAIL_CLOSED |
| RESTRAINT new 24-row block CREATE | Writer2 | SOURCE_BLOCKED_REAFFIRMED_V11 | NOT AUTHORIZED |
| node/element/connectivity topology | Writer3 | OUTSIDE_WRITER2 | OUTSIDE_WRITER2 |

## 9. Frozen converter custody

```text
cii_v11_v14.py               6152f28c0c43b4d70029f360d993da5794310c8a
cii_v11_v14_format.py        56f59fb7e095a887fc84e8a008a5f40acbadaec5
cii_v11_v14_records.py       1a1f7bdd78a4b1479dd474fd9cc61a2b9adef235
cii_v11_v14_sif.py           88c1d80bdb7bd2d5197a56c5be60ac2057c02367
cii_v11_v14_validate.py      8e6896e8b61ac3c90d579139d39b29a6ace1637c
cii2019_section_rules.py     efa894afd241f8ac0b74f6a6e0ecfaedc3d6d76e
```

No upstream source was altered.

## 10. Runtime / regression evidence

```text
W2.11 RESTRAINT physical runtime          PASS_RUNTIME_EXACT_BLOB
W2.12 R01-R22                             PASS_RUNTIME_EXACT_BLOB
frozen-engine authored Python             PASS_RUNTIME_EXACT_SEVEN_FILE_BLOB_GRAPH
historical frozen-source JS @18433c...    PASS_RUNTIME_EXACT_TWELVE_FILE_BLOB_GRAPH_NODE_ESM_MODE
W2.30 projector                           PASS_RUNTIME_EXACT_TWO_FILE_BLOB_GRAPH_NODE_ESM_MODE_W2_30_WRITER2_ONLY_SCOPE
W2.31 fixed-field guard                   PASS_RUNTIME_EXACT_TWO_FILE_BLOB_GRAPH_NODE_ESM_MODE_W2_31_FIXED_FIELD_AUTHORITY
W2.32 pointer correlation                 PASS_RUNTIME_EXACT_TWO_FILE_BLOB_GRAPH_NODE_ESM_MODE_W2_32_POINTER_CORRELATION
current frozen-source JS @ade99d0...      PASS_RUNTIME_EXACT_THIRTEEN_FILE_BLOB_GRAPH_NODE_ESM_MODE_W2_32
W2.34 focused route/export @20b31c...     PASS_SOURCE_INSPECTION / NOT_RUN_EXACT_7_FILE_GRAPH
W2.34 broader route/export @2b01a6...     PASS_SOURCE_INSPECTION / NOT_RUN_EXACT_14_FILE_GRAPH

W2.13 synthetic Writer2 product           NOT_RUN_EXACT_EXECUTABLE_ENVIRONMENT
W2.13 retained-real V11 CII               NOT_RUN_EXACT_EXECUTABLE_ENVIRONMENT
real V14 change-isolated Writer2 path     NOT_RUN
browser V14 bridge                        NOT_RUN
external CAESAR acceptance                NOT_RUN
repository npm/full regressions           NOT_RUN/PARTIAL
```

## 11. Remaining gates

```text
W2.34 C0  focused routing/export source test on exact 7-file graph
W2 C0     broader Writer2 product-routing/export test on exact 14-file graph
W2 A      unchanged W2.13 synthetic product on exact full Workspace graph
W2 B      retained-real V11 RESTRAINT product on exact full Workspace graph
BRIDGE B  real/native V14 Writer2 + exact projected normalization proof
W2 C/D    inherited Writer2 + Writer1 adjacent + npm + browser/product regressions
W2 H      final READY/NOT_READY release-freeze verdict
EXTERNAL  actual CAESAR V11/V14 import/use + save/re-export acceptance
```

Native checkout remains unavailable. No stubs/import rewrites/partial-core substitutes are authorized. GitHub Actions are not authorized for qualification.

## 12. Freeze rule

`READY_FOR_WRITER2_RELEASE_FREEZE` requires every source-qualified V11 Writer2 operation to be runtime-dispositioned, V11 CREATE blockers explicit/fail-closed, exposed V14 Writer2 routes to preserve original unrelated bytes, exact CONTROL/ELEMENT identity, matching CONTROL/cardinality/pointer correlation, qualified physical cardinality, final projected V14 normalization equal to independently validated V11 TARGET1, and product export to require bridge PASS plus byte custody. No lossy conversion, broad canonical rewrite, unauthorized field/section, Writer2 text fallback, unqualified V14 Writer1 mutation, HANGER/MISCEL projection, absent-section NODENAME creation or Writer3 leakage is permitted.
