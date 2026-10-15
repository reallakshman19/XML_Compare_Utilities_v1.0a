# Endpoint EP-CII-W2-NB-R1-0004 — benchmark first / verdict deferred

CHAIN_STATE_VERSION: 3
CHAIN_ID: CII-W2-NODENAME-BYTE-R1-1224
ENDPOINT_ID: EP-CII-W2-NB-R1-0004
PREDECESSOR_ENDPOINT: EP-CII-W2-NB-R1-0003
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1224
PROGRAM_BASIS_REVISION: PB-0003
BRANCH: revision/cii-writer2-nodename-byte-r1-1224
MAIN_OBSERVED: 242fc1b1df7e398b64e15a1fd3e2f87d1ff5b581
COMMON_PROTOCOL_BASIS: fed57820909f4984a97d67437340df952b73a5ab

## Owner sequence

Owner instruction at 2026-09-16T05:30:55Z: benchmark first, then independent qualification verdict.

This is accepted as process sequencing. It does not authorize production/test/oracle/workflow mutation.

## Benchmark readiness

Evidence: `agents/chains/CII-W2-NODENAME-BYTE-R1-1224/evidence/BM-CII-W2-NB-R1-READINESS-0001.md`.

The current retained benchmark harness was inspected against PB-0003. It remains useful as a historical CREATE/DELETE witness but is incomplete for the revision because it requires exact equality to TEXPECTED-derived structural keys and does not establish the full reviewed REPLACE surface required by PB-0003.

A fresh Node execution is `NOT_RUN_ENVIRONMENT`: no repository checkout or benchmark files are mounted in the connected runtime, and the only current-main Actions workflow does not run the CII benchmark.

## State

ENGINEERING_STATE: READY_READ_ONLY
CUSTODY_STATE: HELD
QUALIFICATION_STATE: ANSWER_COMPLETE_VERDICT_DEFERRED_FOR_BENCHMARK
WRITE_AUTHORITY: READ_ONLY
BENCHMARK_SEQUENCE_STATE: FIRST
BENCHMARK_READINESS: BLOCKED_BY_EXECUTION_ENVIRONMENT
PB0003_BM004_009: NOT_RUN_ENVIRONMENT
INDEPENDENT_VERDICT_STATUS: DEFERRED_UNTIL_BENCHMARK_EVIDENCE
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE

No production, test, benchmark input/oracle, converter, or workflow file changed.

## Exact next action

Run the retained baseline plus PB-0003 BM-004..009 from a real repository checkout/execution surface. Record exact outputs/failures. Only then request the independent Q1..Q5 qualification verdict.