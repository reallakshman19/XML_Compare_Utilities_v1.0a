# PR1018 — Writer 2 real-benchmark product qualification

# CURRENT RECOVERY STATE — READ FIRST

```text
HANDOVER_READINESS: READY
REPOSITORY: reallaksh19/XML_Compare_Utilities
PR: #1018
BRANCH: agent/cii-writer2-product-qualification
BASE: main@112e2d78de82d537186a266ed6f9d93cb30a4160
MISSION: qualify merged Writer-2 product composite on a real CAESAR CII physical preimage without adding mutation authority
CURRENT_STAGE: REAL_BENCHMARK_QUALIFICATION_AUTHORED_NOT_EXECUTED
TAKEOVER_AUTHORITY: WRITE_ALLOWED
MERGE_AUTHORITY: OWNER_ONLY
```

## 1. Scope

PR1018 is qualification-only. It changes no production Writer/parser/core/UI code.

The test uses the repository file:

```text
Benchmark/CIICompare/BM_CII_TARGET1.CII
GitHub blob: 1a1cb9ac27e9c347cfcd3e4a8766ebad0e4b7853
repository size: 64462 bytes
neutral version: V11
CONTROL element count: 40
CONTROL NODENAME count: 2
CONTROL SIF/TEE count: 9
```

This is a real CAESAR CII preimage. The operation oracle is controlled and explicitly bound; do not claim that BM_CII_SOURCE -> BM_CII_TARGET1 naturally contains the same NODENAME CREATE + SIF DELETE cardinality transaction.

## 2. Qualification transaction

The test deterministically discovers from parsed physical custody:

1. a real exact-custodied ELEMENT with NODENAME pointer 0 and an endpoint that has no existing physical NODENAME span;
2. a real existing V11 SIF pointer; if shared, every physical owner of that pointer is selected.

It then constructs one canonical PR1001 bound scope with:

```text
NODE_NAME / Node name / to-name / CREATE / APPLY
SIF_TEE / SIF/Tee record presence / DELETE / APPLY
```

The NODENAME value is the short ASCII token `QF_REAL`.

The product call under qualification is:

```js
applyCiiWorkspaceTargetWriter2(preview, fixtureBytes, { cryptoRef: webcrypto })
```

## 3. Required positive evidence

The authored regression requires:

- exact original-byte intake eligibility before mutation;
- 40 parsed elements;
- NODENAME physical custody QUALIFIED with 2 rows;
- SIF physical custody QUALIFIED, V11, 10 rows/block, 9 blocks;
- low-level composite mode = `ONE_ORIGINAL_PREIMAGE_COMPOSITE`;
- public product result = PASS / WRITER_2;
- product bytes exactly equal the low-level composite bytes for the same TARGET0 and bound scope;
- independent composite validation = PASS;
- `unexpectedSemanticDeltaCount = 0`;
- exported bytes re-intake successfully with exact-byte custody;
- NODENAME row count 2 -> 3 and selected endpoint resolves to `QF_REAL`;
- SIF block count 9 -> 8 and row count 90 -> 80;
- every selected shared SIF owner pointer becomes 0;
- complete parsed ELEMENT index/FROM/TO connectivity snapshot remains unchanged.

## 4. Negative assurance

### Stale preview replay

The old bound preview is replayed against its own modified export. Required result:

```text
CII_WRITER_2_STALE_TARGET_HASH
```

### Unrelated-byte falsifier

After a correct Writer2 result, one byte in the untouched CAESAR header text is changed. The tampered file is re-intaken and supplied to the independent PR1016 validator. Required rejection:

```text
EXACT_COMPOSITE_POSTIMAGE_MISMATCH
```

This proves reparsing is not sufficient and Writer testimony is not authorization.

## 5. Why the oracle is controlled

The primary BM_CII_SOURCE/TARGET1/TARGET2 benchmark publishes SIF raw-field changes, not an authoritative natural SIF-cardinality DELETE oracle. The larger SOURCE 3 / TARGET 3-1 pair has CONTROL SIF count 14 on both sides. Therefore PR1018 does not manufacture a claim that those pairs contain the required natural DELETE transaction.

Instead, it uses a real, fixed repository CII as physical custody and applies a controlled, explicit operation set against real pointers/rows discovered from that file.

## 6. Changed-file ledger

Qualification:

```text
tests/cii-workspace-writer2-real-benchmark-roundtrip.test.js
```

Recovery:

```text
agents/PR1018_workreport.md
agents/status/PR1018.yaml
agents/claims/PR1018.yaml
agents/MASTER_INDEX.md
```

No production source file is in scope.

## 7. Validation truth

```text
PR1017 merge / PR1018 base grounding                 PASS
benchmark directory/file custody                    PASS_SOURCE_INSPECTION
BM_CII_TARGET1 repository size                      PASS_GITHUB_METADATA
BM_CII_TARGET1 CONTROL 40 / NONAM 2 / SIF 9         PASS_SOURCE_INSPECTION
SOURCE3/TARGET3 CONTROL SIF count 14/14              PASS_SOURCE_INSPECTION
qualification test source audit                     PASS_SOURCE_INSPECTION
exact checkout                                      BLOCKED_ENVIRONMENT_GITHUB_DNS
real-benchmark Writer2 regression                   AUTHORED_NOT_RUN_ENVIRONMENT
inherited Writer2 regressions                       NOT_RUN_ENVIRONMENT
full repository tests                               NOT_RUN_ENVIRONMENT
browser Writer2 flow                                NOT_RUN_ENVIRONMENT
```

Do not upgrade the authored benchmark regression to PASS until it is actually executed from the exact PR head.

## 8. Exact next action after PR1018 disposition

After this qualification passes in an executable environment, freeze the current Writer2 product boundary before considering additional cardinality families.

The next family should not be SIF CREATE until V11 items 27-30 and complete block-construction/default semantics are source-qualified. Hanger cardinality likewise remains blocked until HGRDAT payload and pointer/count maintenance are qualified.

# Appendix A — takeover qualification

1. Why is BM_CII_TARGET1 a real physical-preimage qualification but not a natural SOURCE/TARGET cardinality oracle?
2. What fixed fixture facts are asserted before mutation?
3. How is the NODENAME CREATE candidate selected without inventing an existing field?
4. Why must all SIF pointer owners be selected when a pointer is shared?
5. What exact PR1001 scope custody is constructed?
6. Which public product API is under qualification?
7. Why compare product bytes to the low-level composite bytes?
8. Which semantic/count postconditions prove the two cardinality operations occurred?
9. What connectivity snapshot is protected?
10. Why must stale-preview replay fail?
11. Why is a reparsable unrelated-byte tamper still a FAIL?
12. Which tests remain NOT_RUN and why?
13. Which production files are intentionally unchanged?
14. Why must SIF CREATE remain blocked after this PR?
