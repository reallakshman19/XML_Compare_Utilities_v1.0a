# CII Writer2 V11/V14 — exact frozen-source authored runtime

Date: 2026-08-26  
PR: #1055  
Initial stage: W2.28  
Current stage: W2.32  
Pinned upstream: `reallaksh19/3D_Converters@ca8d391ac5f829f53bebb3c37adf0547c34a67b4`

## 1. Current exact W2.32 execution

The current authored frozen-source custody test was reconstructed from the exact PR #1055 Git blobs without changing the test, imports, production modules, or frozen Python.

Current test blob:

```text
ade99d0d4f4d4ff394a90f81286e4394b5409a54
```

Complete exact graph size:

```text
13 files
```

Before execution, every participating file was admitted by recomputing its Git-object SHA over:

```text
blob <byte_length>\0<exact_bytes>
```

The reconstructed graph was then executed unchanged:

```text
node --experimental-default-type=module tests/cii-workspace-v11-v14-frozen-source.test.js
CII Workspace frozen 3D_Converters V11/V14 source + change-isolation custody: PASS
```

Classification:

```text
PASS_RUNTIME_EXACT_THIRTEEN_FILE_BLOB_GRAPH_NODE_ESM_MODE_W2_32
```

No native clone, stub, import rewrite, partial-core substitute, or GitHub Actions execution was used.

## 2. Exact admitted graph

```text
tests/cii-workspace-v11-v14-frozen-source.test.js
  ade99d0d4f4d4ff394a90f81286e4394b5409a54

tabs/cii-workspace/cii-workspace-v11-v14-converter.js
  01ee6b457b123eb32f084ad45f8ff72cb909a1b9

tabs/cii-workspace/cii-workspace-writer-version-bridge.js
  8038993f0a97719c0c316f31c2d6c30ea0386ec4

tabs/cii-workspace/cii-workspace-v14-change-projection.js
  0a16b1383da6ef58abf55c53a91711a0a1f21c17

tabs/cii-workspace/cii-workspace-v14-writer2-fixed-field-authority.js
  fc97ddd7fd5645e46c70a722c7f96f17dc7ae188

converters/cii-v11-v14-writer-worker.js
  0c28eef6251e780b230dda1ce71e6da05f21abcc

converters/scripts/cii2019_section_rules.py
  c025879cdabd168bd33790682fb30336b48841b9

converters/scripts/cii-v11-v14-upstream/cii_v11_v14.py
  6152f28c0c43b4d70029f360d993da5794310c8a
converters/scripts/cii-v11-v14-upstream/cii_v11_v14_format.py
  56f59fb7e095a887fc84e8a008a5f40acbadaec5
converters/scripts/cii-v11-v14-upstream/cii_v11_v14_records.py
  1a1f7bdd78a4b1479dd474fd9cc61a2b9adef235
converters/scripts/cii-v11-v14-upstream/cii_v11_v14_sif.py
  88c1d80bdb7bd2d5197a56c5be60ac2057c02367
converters/scripts/cii-v11-v14-upstream/cii_v11_v14_validate.py
  8e6896e8b61ac3c90d579139d39b29a6ace1637c
converters/scripts/cii-v11-v14-upstream/cii2019_section_rules.py
  efa894afd241f8ac0b74f6a6e0ecfaedc3d6d76e
```

The exact admission also preserved upstream byte details that decoded-text reconstruction can obscure. In particular, the pinned `cii_v11_v14.py` and `cii_v11_v14_validate.py` blobs have no final newline; their Git-object identities were verified before execution rather than inferred from display text.

## 3. What the current source-custody PASS covers

The test verifies, on the current W2.32 graph:

```text
all six frozen Python/dependency Git blobs are exactly pinned
local cii2019_section_rules.py remains distinct from the frozen dependency
worker fetches frozen source as bytes and checks Git blob identity
worker installs only verified frozen bytes into Pyodide
worker serializes jobs and cleans temporary files
converter enforces conversion audit schema/count/hash custody
version detection is exact for V11/V14 and rejects unsupported/intermediate versions
bridge uses pinned 3D_Converters source
allow_lossy=true is absent from the bridge path
canonical V14 is not used as final output
final projected V14 must normalize exactly to validated V11 TARGET1
W2.30 changed-section/cardinality projection policy is present
W2.32 fixed-field guard has the exact six CONTROL/ELEMENT coordinates
W2.32 pointer/cardinality correlation blocker is present
MISCEL_1/HANGER is absent from V14 projection authority
formatter non-byte-roundtrip falsifier remains explicit
binary byte-string/SHA utilities preserve byte custody
```

## 4. Historical runtime epochs

Retained historical evidence remains valid for the blobs actually executed at those epochs:

```text
historical source test @18433c7664428a02bea97625ce6bdc3c21bd8365
  PASS_RUNTIME_EXACT_TWELVE_FILE_BLOB_GRAPH_NODE_ESM_MODE

W2.31 focused guard
  guard 7bc3a83ef37159c9a70fb0e16acaba721fd73b26
  test  74077b00b094c5e30ff402f8a0adeb1814bb24cc
  PASS_RUNTIME_EXACT_TWO_FILE_BLOB_GRAPH_NODE_ESM_MODE_W2_31_FIXED_FIELD_AUTHORITY

W2.32 focused guard
  guard fc97ddd7fd5645e46c70a722c7f96f17dc7ae188
  test  78dbe0af0b8d0d8fd55aae26f586f727bb2d03df
  PASS_RUNTIME_EXACT_TWO_FILE_BLOB_GRAPH_NODE_ESM_MODE_W2_32_POINTER_CORRELATION
```

The former `NOT_RUN_AFTER_W2_32_POINTER_ASSERTION_STRENGTHENING` state is superseded by the exact 13-file execution above.

## 5. Frozen source identities

```text
cii_v11_v14.py               6152f28c0c43b4d70029f360d993da5794310c8a
cii_v11_v14_format.py        56f59fb7e095a887fc84e8a008a5f40acbadaec5
cii_v11_v14_records.py       1a1f7bdd78a4b1479dd474fd9cc61a2b9adef235
cii_v11_v14_sif.py           88c1d80bdb7bd2d5197a56c5be60ac2057c02367
cii_v11_v14_validate.py      8e6896e8b61ac3c90d579139d39b29a6ace1637c
cii2019_section_rules.py     efa894afd241f8ac0b74f6a6e0ecfaedc3d6d76e
```

Frozen Python remains untouched.

## 6. Scope limits

This source-custody PASS does **not** qualify:

```text
full CII Workspace / W2.13 product routing
retained-real V11 RESTRAINT product runtime
real/native V14 change-isolated Writer2 mutation
browser/Pyodide product route
repository npm/full regressions
external CAESAR import/save/re-export acceptance
```

Those remain separate gates and must not inherit this PASS.
