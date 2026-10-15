# CII Writer2 V11/V14 bridge — local extracted-source runtime evidence

Date: 2026-08-25
Updated through: W2.27 on 2026-08-26
PR: #1055
Branch: `agent/cii-writer2-restraint-product-runtime-w218`
Pinned source repository: `reallaksh19/3D_Converters`
Pinned source commit: `ca8d391ac5f829f53bebb3c37adf0547c34a67b4`

## 1. Scope and evidence classification

This record documents bounded runtime execution performed while the native repository checkout remained unavailable. Later W2.27 evidence is referenced here only to keep the pending-gate vocabulary current; it does not retroactively widen the original extracted-source runtime slice.

Current classification:

```text
FROZEN_SOURCE_CUSTODY                PASS_EXACT_BLOB_CUSTODY
EXTRACTED_HIGH_RISK_RUNTIME_SLICE    PASS_RUNTIME_EXACT_SOURCE_EXCERPT
EXTRACTED_ADAPTER_CUSTODY_SLICE      PASS_RUNTIME_EXACT_SOURCE_EXCERPT
NATIVE_BENCHMARK_ZIP_CUSTODY         PASS_EXACT_GIT_BLOB
NATIVE_BENCHMARK_PAIR_EXTRACTION     PASS_EXACT_BYTES
V14_PROJECTION_FOCUSED_RUNTIME       PASS_RUNTIME_EXACT_TWO_FILE_BLOB_GRAPH_NODE_ESM_MODE
FULL_FROZEN_ENGINE_RUNTIME           NOT_RUN_EXACT_REPOSITORY_MODULE_GRAPH
TARGET_AUTHORED_SOURCE_TEST          NOT_RUN_EXACT_REPOSITORY_MODULE_GRAPH
TARGET_AUTHORED_ENGINE_TEST          NOT_RUN_EXACT_REPOSITORY_MODULE_GRAPH
W2_13_PRODUCT_RUNTIME                NOT_RUN_EXACT_EXECUTABLE_ENVIRONMENT
REAL_V14_WRITER2_CHANGE_ISOLATION    NOT_RUN
```

`PASS_RUNTIME_EXACT_SOURCE_EXCERPT` must not be promoted to full converter, authored-module, Writer2 product, browser, external CAESAR, or release PASS. The focused V14 projection PASS is likewise limited to its exact two-file JS graph.

## 2. Exact frozen-source custody

The six vendored files were compared directly against `3D_Converters@ca8d391ac5f829f53bebb3c37adf0547c34a67b4`.

| File | Git blob SHA | Result |
|---|---|---|
| `cii_v11_v14.py` | `6152f28c0c43b4d70029f360d993da5794310c8a` | exact match |
| `cii_v11_v14_format.py` | `56f59fb7e095a887fc84e8a008a5f40acbadaec5` | exact match |
| `cii_v11_v14_records.py` | `1a1f7bdd78a4b1479dd474fd9cc61a2b9adef235` | exact match |
| `cii_v11_v14_sif.py` | `88c1d80bdb7bd2d5197a56c5be60ac2057c02367` | exact match |
| `cii_v11_v14_validate.py` | `8e6896e8b61ac3c90d579139d39b29a6ace1637c` | exact match |
| `cii2019_section_rules.py` | `efa894afd241f8ac0b74f6a6e0ecfaedc3d6d76e` | exact match |

The existing XML `converters/scripts/cii2019_section_rules.py` is not substituted.

Production worker hardening additionally requires these same Git blob identities to be verified against exact deployed bytes before frozen Python is written into Pyodide or executed. That live-worker gate is implemented but browser runtime remains `NOT_RUN`.

## 3. Executed converter semantic falsifiers

Exact source excerpts from the blob-verified frozen files were locally materialized only for the functions under test.

```text
T01 source VERSION 11 accepted                         PASS
T02 source VERSION 14 accepted                         PASS
T03 unsupported VERSION 12 rejected                    PASS
T04 V14 SIF item15/item16 axial/torsion semantic swap  PASS
T05 non-zero V14 SIF item27 rejected with lossy=false  PASS
T06 non-zero V11 SIF item19 rejected on V11->V14       PASS
T07 empty V14 restraint stiffness maps to V11 sentinel PASS
T08 V14 ALLOWBLS item154 rejected with lossy=false     PASS
```

These prove the bounded semantic behaviors only; they do not prove the full six-file engine graph.

## 4. Executed adapter-custody falsifiers

A second bounded local slice executed the exact algorithms added by W2.20-W2.26:

```text
T09 WebCrypto Git-blob SHA equals independent Node Git-object SHA     PASS
T10 audit missing loss_events fails closed                            PASS
T11 binary byteString roundtrip preserves 0x00..0xFF; >0xFF rejects  PASS
T12 failed serialized job cannot overlap or poison following job     PASS
```

T09 independently formed the Git object bytes as:

```text
"blob " + byte_length + NUL + exact_bytes
```

and confirmed the WebCrypto SHA-1 result against a separate Node `createHash('sha1')` calculation.

T10 confirms malformed converter testimony cannot become an implicit zero-loss result. T11 confirms Writer2 `byteString` custody is binary, not UTF-8 text custody. T12 confirms the queue contract executes job 2 only after failed job 1 has completed and allows job 2 to succeed.

## 5. W2.27 evidence added after this original slice

The exact pinned upstream benchmark archive has now been reconstructed and admitted independently:

```text
Benchmarks/v11-v14.zip
size      10,740 bytes
Git blob  8409e1c429665e34a83c2a464665ebf5d5f1b0a1
SHA-256   da0b276c4c2f3a44c3dcd0a6cddd6ca9fcdfc44709caac7af61083b79bb7f808
```

Its `SYS-0001-v14.CII` and `SYS-0001-v11.cii` members were extracted as exact bytes. This is **benchmark custody/extraction PASS**, not full converter execution on the benchmark.

That exact native V14 file falsified the former XML-side baseline requirement that `V14->V11->V14` be whole-file byte-identical. The gate is therefore **retired**, not pending. W2.27 replaces it with original-byte change isolation:

```text
canonical modified V14 -> V11
  must equal exact validated Writer2 V11 TARGET1

projected ORIGINAL-byte-preserving V14 -> V11
  must equal exact validated Writer2 V11 TARGET1
```

The focused projection test also executed successfully on an exact two-file blob graph:

```text
module  0a04c75c2ed0880a815c17616a7c99afcde132c2
test    60f1586e5ac469988b59ede2b59258dcdc771e57
result  PASS_RUNTIME_EXACT_TWO_FILE_BLOB_GRAPH_NODE_ESM_MODE
```

That result does not qualify the full converter/Pyodide/Writer2 bridge.

## 6. What the 12 extracted falsifiers establish

Within their bounded scope they support:

- neutral major admission is limited to 11/14;
- SIF axial/torsional mapping is semantic;
- unsupported V14/ambiguous V11 SIF data fails closed;
- V14 restraint default sentinel mapping is preserved;
- non-zero V14 ALLOWBLS extension data fails closed;
- the runtime Git-blob hashing algorithm is independently consistent;
- malformed audit arrays do not silently become empty evidence;
- exact 8-bit Writer2 postimage custody survives string transport;
- shared-runtime conversion jobs can be serialized without queue poisoning.

## 7. What remains unproved

This evidence set still does **not** prove:

- unchanged `tests/cii-workspace-v11-v14-frozen-source.test.js` from its exact full repository module graph;
- unchanged `tests/cii-workspace-v11-v14-frozen-engine.test.py` from its exact frozen Python graph;
- the complete six-file Python graph compiling/executing together in the target repository;
- full-file source/target structure validation through `cii_v11_v14_validate.py` in the target runtime;
- real benchmark V14 normalization through the full pinned converter graph;
- canonical modified V14 -> V11 exact equality with the validated Writer2 V11 postimage;
- projected native-byte V14 -> V11 exact equality with that same Writer2 V11 postimage;
- browser/Pyodide worker execution, including deployed-source blob verification;
- W2.13 product routing or retained-real-CII behavior;
- external CAESAR V11 import/save/re-export acceptance;
- repository `npm test` or browser qualification.

The retired whole-file baseline equality rule is intentionally absent from this pending list.

## 8. Execution-environment blocker

Native clone and raw GitHub download fail in the execution container. A direct-IP/TLS recovery attempt was also made against representative GitHub and raw-content addresses; outbound HTTPS connection itself failed. Therefore the blocker is not represented as merely a DNS-name-resolution issue.

```text
EXACT_NATIVE_CHECKOUT = NOT_AVAILABLE_THIS_RUNTIME
GITHUB_ACTIONS        = NOT_AUTHORIZED
```

No authored test source or import path may be modified merely to bypass this limitation. Small exact graphs may be materialized only when every participating Git blob can be independently admitted.

## 9. No-Actions rule

Current PR diff contains no workflow file and no GitHub Actions result is qualification evidence.

## 10. Next exact gates

Run unchanged when their exact graphs are available:

```text
node tests/cii-workspace-v11-v14-frozen-source.test.js
python tests/cii-workspace-v11-v14-frozen-engine.test.py
node tests/cii-workspace-writer2-restraint-product-routing.test.js
```

Then execute retained-real V11 RESTRAINT and the real native V14 change-isolated Writer2 path:

```text
native V14 -> normalized V11 -> Writer2 TARGET1
-> canonical baseline/modified V14 differential
-> projection onto ORIGINAL V14
-> projected V14 -> V11 == exact validated Writer2 TARGET1
```

Until those actual authored/full-path executions occur, they remain `NOT_RUN`.
