# Benchmark readiness — CII Writer2 NodeName revision

EVIDENCE_ID: BM-CII-W2-NB-R1-READINESS-0001
CHAIN_ID: CII-W2-NODENAME-BYTE-R1-1224
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1224
PROGRAM_BASIS_REVISION: PB-0003
MAIN_BASIS: 242fc1b1df7e398b64e15a1fd3e2f87d1ff5b581
OWNER_SEQUENCE: BENCHMARK_FIRST_THEN_INDEPENDENT_QUALIFICATION_VERDICT
WRITE_AUTHORITY: READ_ONLY

## Retained harness inspection

Current-main `tests/cii-workspace-multisource-retained-auto-anchor-benchmark.test.js` uses S1/S2/S3, T, and TEXPECTED, then runs Auto Anchor -> multisource preview -> canonical Writer2 selection -> scoped Writer2 apply -> raw identity and partial-TEXPECTED checks.

The retained harness derives `expectedKeys` from `expectedStructuralTransferKeys(expectedDelta.rows)` and asserts exact equality of Writer2 physical APPLY keys/cardinality to that set. That helper includes CREATE/DELETE only. It is therefore a historical structural witness, not a complete PB-0003 full-discovery oracle: PB-0003 treats TEXPECTED as lower-bound known-positive evidence and requires reviewed REPLACE plus preservation checks.

## Execution availability

A fresh Node run could not be executed in this connected session because no repository/benchmark files are mounted and the GitHub connector has no arbitrary repository shell. Current main has one Actions run, Deploy GitHub Pages run 34954503581, and `.github/workflows/deploy.yml` runs only `tests/deploy-workflow-pages-artifact.test.js`, not the CII benchmark. It is not benchmark evidence.

Direct retained-baseline command when a repository checkout is available:

`node tests/cii-workspace-multisource-retained-auto-anchor-benchmark.test.js`

## Required benchmark-first gates

BM-004 original-T byte negative assurance; BM-005 transfer-scope REPLACE regression; BM-006 CREATE/DELETE count-pointer-cardinality regression; BM-007 TEXPECTED lower-bound witness; BM-008 injective source-subgraph positive/negative cases; BM-009 exact SIF&TEES and unrelated-section byte invariance including a one-byte SIF falsifier.

BENCHMARK_READINESS: BLOCKED_BY_EXECUTION_ENVIRONMENT
RETAINED_HARNESS_INSPECTION: PASS_READ_ONLY
RETAINED_HARNESS_PB0003_COVERAGE: INCOMPLETE
PB0003_BM004_009: NOT_RUN_ENVIRONMENT
INDEPENDENT_QUALIFICATION_VERDICT: DEFERRED_UNTIL_BENCHMARK_EVIDENCE

No production, test, benchmark input/oracle, converter, or workflow file was modified.