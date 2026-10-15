# PR1081 U3 retained-real native-v14 execution

## Scope

Read-only U3 execution of the current PR1081 U1/U2 Find & Replace ownership and field-claim code against the retained native CAESAR II v14 benchmark. No product, UI, CSV, parser/converter, executor/output, writer, benchmark/oracle, workflow or FORCE/FORCMNT mutation was performed in this phase.

## Retained source custody

Archive source:

```text
repository  reallaksh19/3D_Converters
commit      ca8d391ac5f829f53bebb3c37adf0547c34a67b4
archive     Benchmarks/v11-v14.zip
Git blob    8409e1c429665e34a83c2a464665ebf5d5f1b0a1
member      SYS-0001-v14.CII
```

Reconstructed through GitHub-served base64 ranges, then independently checked locally:

```text
archive git hash-object  8409e1c429665e34a83c2a464665ebf5d5f1b0a1
member bytes             168574
member SHA-256            d2d4316309d9b1aa34b55ad72f89193fd0e437930db203fecd9ede00e69b2faf
physical line endings     CRLF only
physical lines            2935
ELEMENTS                   112 x 15 rows
```

The member hash and byte count match the previously retained benchmark custody record.

## Exact committed PR1081 code executed

```text
parser/fixed-field.js                                      485daa43553681ca54f488499e57f36d2239be58
tabs/cii-workspace/cii-workspace-byte-sha256.js            6435e0eaadc382a18aac6a0bd46318ab6c27c714
tabs/cii-workspace/cii-workspace-find-replace-nodename-scope.js  8e8b917f0c937f7c3891aa74d2c9385bc68c11e7
tabs/cii-workspace/cii-workspace-find-replace-v14-aux-authority.js 079b55252af7594ea04f959620f2d8d00e348b6f
tabs/cii-workspace/cii-workspace-find-replace-v14-field-authority.js 6626346a5d2b98603bd7235ceb24bc5bb0f028cb
tabs/cii-workspace/cii-workspace-find-replace-v14-field-claims.js b76cb034dfd6e6c4859c65d87b050d94abe8f896
tabs/cii-workspace/cii-workspace-find-replace-scope-resolver.js e5294be666d235c85c69fe97a181db9fbc893fbe
tabs/cii-workspace/cii-workspace-find-replace-validator.js ce4c31b01ce522d8d0c39fd0cfafa698328b337a
```

No test-only replacement implementation was used for the admitted result.

## Retained-real ownership result — U1

All nonzero generic auxiliary pointers represented by this benchmark passed the committed U1 pointer + CONTROL + physical cardinality + unique-owner resolver:

| Family | Positive element pointers | Shared pointers | U1 PASS | U1 FAIL |
|---|---:|---:|---:|---:|
| BEND | 9 | 0 | 9 | 0 |
| RIGID | 43 | 0 | 43 | 0 |
| RESTRANT | 40 | 0 | 40 | 0 |
| SIF&TEES | 2 | 0 | 2 | 0 |
| REDUCERS | 1 | 0 | 1 | 0 |
| **Total** | **95** | **0** | **95** | **0** |

This confirms that the U3 defect is not in pointer ownership, CONTROL correlation or record slicing.

## Node Name retained-real regression

The existing specialized Node Name production path was not modified.

Observed on all 55 nonzero NODENAME pointers:

```text
pointer records                    55
shared pointers                     0
specialized resolver PASS          55/55
whole-field retained-real claims   55/55 PASS
```

No Node Name defect was reproduced.

## SIF&TEES retained-real U2 result

Both real SIF&TEES records use full six-field numeric rows and passed field-aware U2 resolution and exact same-width numeric claim validation:

```text
60 -> 70       SIF&TEES_R1_F1   7.000000E+01 -> 8.000000E+01   PASS / 1 claim
1170 -> 1190   SIF&TEES_R1_F1   1.190000E+03 -> 2.190000E+03   PASS / 1 claim
```

Result: **PASS 2/2**.

## Retained-real U2 failure

The current committed U2 field parser incorrectly treats the maximum six-field numeric width (80 bytes) as mandatory for every numeric physical row.

Native CAESAR II v14 emits compact canonical fixed-width rows when a record line contains fewer than six values. The canonical observed widths are `2 + 13*n`, i.e. `15, 28, 41, 54, 67, 80` bytes.

Observed retained-real layouts include:

```text
ELEMENT rows 1-8       80
ELEMENT row 9          67   (five numeric values)
ELEMENT Name           13   (zero-length in this sample)
ELEMENT Line Number    49
ELEMENT color/visible  28   (two values)
ELEMENT pointer rows   80, 80, 41

BEND                    80, 80, 28
RIGID                   28
RESTRANT per DOF        80, 41, 13, 13   repeated six times
SIF&TEES                14 x 80
REDUCERS                67, 67
```

Current committed U2 outcome:

| Scope/family | Retained-real U2 PASS | FAIL | Deterministic blocker |
|---|---:|---:|---|
| ELEMENT | 0 | 112 | `NUMERIC_FIELD_ROW_INVALID:ELEMENT_R9` |
| BEND | 0 | 9 | `AUX_FIELD_ROW_SCHEMA_UNRECOGNIZED:BEND:2` |
| RIGID | 0 | 43 | `AUX_FIELD_ROW_SCHEMA_UNRECOGNIZED:RIGID:0` |
| RESTRANT | 0 | 40 | `AUX_FIELD_ROW_SCHEMA_UNRECOGNIZED:RESTRANT:1` |
| SIF&TEES | 2 | 0 | none |
| REDUCERS | 0 | 1 | `AUX_FIELD_ROW_SCHEMA_UNRECOGNIZED:REDUCERS:0` |

Therefore the expanded U2 retained-real gate is **FAIL**. Synthetic/focused U2 PASS 19/19 remains truthful but is insufficient for native-v14 release qualification.

## Root-cause isolation diagnostic — NOT production evidence

A throwaway, uncommitted local copy was modified only to recognize the six canonical compact numeric widths:

```text
15, 28, 41, 54, 67, 80
```

and to stop requiring 80 bytes for every Element pointer row. With only that diagnostic relaxation:

```text
ELEMENT     112/112 resolve
BEND          9/9 resolve
RIGID        43/43 resolve
RESTRANT     40/40 resolve
SIF&TEES       2/2 resolve
REDUCERS       1/1 resolve
NODENAME      55/55 remains clean
```

This result is **DIAGNOSTIC ONLY / NOT COMMITTED / NOT PASS evidence**. The corrective production patch must preserve fail-closed row-shape validation rather than blindly accepting arbitrary truncation.

## Corrective boundary

The next coding leg should correct v14 numeric row authority, not broaden the UI.

At minimum:

1. represent canonical compact numeric row shapes explicitly instead of requiring 80 bytes everywhere;
2. preserve fixed field boundaries and numeric postimage parsing;
3. validate exact expected field counts per known Element/auxiliary physical row where authority is available;
4. preserve Element FROM/TO and all IEL pointer protection;
5. preserve U1 CONTROL/cardinality/shared-owner gates;
6. preserve specialized NODENAME logic unchanged;
7. preserve FORCE/FORCMNT exclusion;
8. add compact-row regression tests before re-running this exact native benchmark.

## Validation ledger

```text
Benchmark custody / exact member hash                   PASS
U1 native-v14 ownership represented generic families   PASS 95/95
NODENAME retained-real specialized regression           PASS 55/55
SIF&TEES retained-real U2 field claims                  PASS 2/2
U2 native-v14 Element/represented generic field gate    FAIL
PR1081 U2 synthetic/focused suite                       PASS 19/19 (retained truth)
PR1081 U1 synthetic/focused suite                       PASS 17/17 (retained truth)
SOURCE 3 retained-real authored runtime                 NOT_RUN
Full repository suite                                   NOT_RUN
External CAESAR acceptance                              NOT_RUN
```

U3 does not authorize UI/CSV generic block expansion or merge.
