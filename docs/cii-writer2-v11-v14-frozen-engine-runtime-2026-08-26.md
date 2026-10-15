# CII Writer2 V11/V14 — exact frozen-engine authored runtime

Date: 2026-08-26  
PR: #1055  
Stage: W2.28  
Pinned upstream: `reallaksh19/3D_Converters@ca8d391ac5f829f53bebb3c37adf0547c34a67b4`

## 1. Scope

This record retains execution of the authored target test:

```text
tests/cii-workspace-v11-v14-frozen-engine.test.py
```

against the complete frozen Python import graph used by that test. No frozen Python source was edited, stubbed, substituted, import-rewritten, or fetched from a different revision.

## 2. Exact frozen graph

Pinned source blobs:

```text
cii_v11_v14.py               6152f28c0c43b4d70029f360d993da5794310c8a
cii_v11_v14_format.py        56f59fb7e095a887fc84e8a008a5f40acbadaec5
cii_v11_v14_records.py       1a1f7bdd78a4b1479dd474fd9cc61a2b9adef235
cii_v11_v14_sif.py           88c1d80bdb7bd2d5197a56c5be60ac2057c02367
cii_v11_v14_validate.py      8e6896e8b61ac3c90d579139d39b29a6ace1637c
cii2019_section_rules.py     efa894afd241f8ac0b74f6a6e0ecfaedc3d6d76e
```

Every local materialized file was admitted by independently recomputing its Git object SHA over:

```text
blob <byte_length>\0<exact_bytes>
```

before execution.

## 3. First exact authored-test execution — real FAIL

Original authored test blob:

```text
431d898616f78b2ff999f5470cfadac0be8ab750
```

All seven exact graph SHA checks passed. Runtime result:

```text
5 tests PASS
1 test ERROR
```

Exact failure:

```text
AttributeError: module 'cii_v11_v14' has no attribute '_map_restraint_stiffness'
```

The failing target assertion called:

```python
mod._map_restraint_stiffness(...)
```

The frozen main module does not import or re-export that private helper. The exact helper is owned by:

```text
cii_v11_v14_records.py
```

No upstream/frozen-source defect was inferred from this harness error.

## 4. Authority-preserving harness correction

Only the target authored test was corrected:

```python
import cii_v11_v14_records as records
...
records._map_restraint_stiffness(...)
```

No frozen Python file changed.

Corrected authored test Git blob:

```text
43721ed3f2c990080945afa2a8a3702dbb021eb4
```

The correction changes only which exact frozen owner the assertion calls; it does not weaken the assertion, change expected values, add a fallback, or bypass any converter behavior.

## 5. Corrected exact-graph rerun

Before rerun, all seven participating blobs were rechecked:

```text
test                                            43721ed3f2c990080945afa2a8a3702dbb021eb4 PASS
cii_v11_v14.py                                  6152f28c0c43b4d70029f360d993da5794310c8a PASS
cii_v11_v14_format.py                           56f59fb7e095a887fc84e8a008a5f40acbadaec5 PASS
cii_v11_v14_records.py                          1a1f7bdd78a4b1479dd474fd9cc61a2b9adef235 PASS
cii_v11_v14_sif.py                              88c1d80bdb7bd2d5197a56c5be60ac2057c02367 PASS
cii_v11_v14_validate.py                         8e6896e8b61ac3c90d579139d39b29a6ace1637c PASS
cii2019_section_rules.py                        efa894afd241f8ac0b74f6a6e0ecfaedc3d6d76e PASS
```

Command:

```text
python tests/cii-workspace-v11-v14-frozen-engine.test.py
```

Result:

```text
test_detects_only_11_and_14                                  PASS
test_nonzero_v11_ambiguous_sif_field_blocks_upgrade         PASS
test_nonzero_v14_sif_extension_fails_closed                 PASS
test_restraint_default_stiffness_mapping_is_preserved       PASS
test_sif_axial_torsion_swap_is_semantic_not_positional      PASS
test_v14_allowables_extension_requires_loss_opt_in          PASS

Ran 6 tests
OK
```

Classification:

```text
PASS_RUNTIME_EXACT_SEVEN_FILE_BLOB_GRAPH
```

## 6. What this proves

Within this authored-test scope:

- the six pinned frozen Python files import together as the actual dependency graph required by the test;
- neutral version admission remains 11/14 only;
- SIF axial/torsional mapping is semantic;
- non-zero V14 SIF extension fields fail closed without lossy opt-in;
- ambiguous legacy V11 SIF fields fail closed on upgrade;
- V14 ALLOWBLS extension data fails closed without lossy opt-in;
- restraint default-stiffness mapping remains available from its exact frozen records owner.

## 7. Scope limits

This PASS does **not** by itself qualify:

```text
browser/Pyodide worker runtime
runtime deployed-source fetch/blob verification
frozen-source authored JS integration test
real benchmark full-file conversion
W2.13 product routing
retained-real V11 Writer2 product
real V14 change-isolated Writer2 mutation
final projected V14 -> V11 postimage proof
repository npm/browser suite
external CAESAR import/save/re-export acceptance
```

Those remain separate gates.
