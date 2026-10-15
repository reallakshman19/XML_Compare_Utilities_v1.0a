# PR1023 — Writer 2 tri-family real-benchmark product qualification

# CURRENT RECOVERY STATE — READ FIRST

```text
HANDOVER_READINESS: READY
REPOSITORY: reallaksh19/XML_Compare_Utilities
PR: #1023
BRANCH: agent/cii-writer2-trifamily-real-benchmark-qualification
BASE: main@dcb9c4333ae86fb7d2dc15426db10f0e4cbdae46
MISSION: qualify the merged Writer-2 NODENAME + V11 SIF DELETE + HANGER DELETE-ALL product path on one real CAESAR V11 preimage without adding mutation authority
CURRENT_STAGE: REAL_TRIFAMILY_BENCHMARK_QUALIFICATION_AUTHORED_NOT_EXECUTED
TAKEOVER_AUTHORITY: WRITE_ALLOWED
MERGE_AUTHORITY: OWNER_ONLY
```

## 1. Scope

PR1023 is qualification-only plus recovery-index correction. It changes no production Writer/parser/core/UI code.

Primary real preimage:

```text
Benchmark/CIICompare/BM_CII_SOURCE.CII
GitHub blob: e41cd05603b56837cbb6e31b9d4074ef6106fe9b
neutral version: V11
CONTROL NUMELT: 40
CONTROL NOHGRS: 1
CONTROL NONAM: 4
CONTROL SIF/TEE count: 9
real HANGER node: 205
MISCEL_1 rows before: 23
qualified delete-all MISCEL_1 rows after: 11
```

Source inspection confirms the four real NODENAME rows are physically present. The controlled operation oracle does not claim that a natural SOURCE/TARGET benchmark pair contains exactly this three-family cardinality transaction.

## 2. Qualification transaction

The test deterministically discovers from the real TARGET0:

1. an exact-custodied ELEMENT with NODENAME pointer 0 and an endpoint with no existing physical NODENAME;
2. a real existing V11 SIF pointer; if shared, every physical owner is selected;
3. the qualified real HANGER record at node 205.

The bound APPLY set is:

```text
NODE_NAME / Node name / to-name / CREATE
SIF_TEE / SIF/Tee record presence / DELETE  [all owners of one selected pointer]
HANGER / Hanger presence / DELETE           [node 205, delete-all]
```

The NODENAME qualification token is short ASCII `QF_TRI`.

## 3. Product path under qualification

```text
real BM_CII_SOURCE TARGET0
 -> canonical explicit APPLY/EXCLUDE scope
 -> ciiWriter2CompositeReadiness
 -> applyCiiWriter2CompositeWithHangerDeleteAll(TARGET0)
 -> applyCiiWorkspaceTargetWriter2(preview, original bytes)
 -> require product bytes == direct tri-family bytes
 -> re-intake export
 -> validateCiiWriter2CompositeWithHangerRoundTrip
 -> exact complete-postimage equality
```

There is no sequential NODENAME -> SIF -> HANGER pass.

## 4. Positive evidence required by the authored regression

Before mutation:

```text
writer1CByteEligible = true
neutralVersionMajor = 11
ELEMENT count = 40
NODENAME physical custody = QUALIFIED
NODENAME row count = 4
SIF custody = QUALIFIED
SIF block count = 9
SIF rows/block = 10
HANGER custody = QUALIFIED
HANGER layout = CAESAR_SYNCHRONIZER_IHGRNODE_FIRST
HANGER count = 1
HANGER nodes = [205]
MISCEL_1 rows = 23
```

After mutation:

```text
NODENAME selected endpoint = QF_TRI
NODENAME rows = 5
SIF blocks = 8
SIF rows = 80
all owners of selected SIF pointer -> pointer 0
HANGER count = 0
HANGER layout = CONTROL_NOHGRS_ZERO
HANGER nodes = []
MISCEL_1 rows = 11
ELEMENT index/FROM/TO connectivity = unchanged
```

Public product output must equal the direct low-level tri-family output for the same TARGET0 and bound scope.

## 5. Negative assurance

### Stale preview replay

Replay the old bound preview against its own export. Required failure:

```text
CII_WRITER_2_STALE_TARGET_HASH
```

### Unrelated-byte falsifier

Change one byte in the untouched CAESAR header after a correct Writer2 result. Re-intake may still succeed, but independent validation must reject with:

```text
EXACT_TRI_FAMILY_POSTIMAGE_MISMATCH
```

### Forged mutation testimony

Delete one mutation from the writer-result ledger while keeping the correct bytes. Independent validation must reject with a composite mutation count/testimony mismatch.

### Duplicate parent-scope testimony

Duplicate one APPLY operation ID in `transferScope.appliedOperationIds`.

Required layer-specific results:

```text
product readiness:
  ciiWriter2CompositeReadiness.ready = false
  WRITER_2_COMPOSITE_SCOPE_APPLY_IDS_DUPLICATE

low-level tri-family writer:
  CII_WRITER_2_COMPOSITE_HANGER_SCOPE_APPLY_DUPLICATE_ID
  thrown before byte mutation
```

The two layers intentionally use different error namespaces; the qualification asserts each actual contract rather than collapsing them into one string.

## 6. Existing fail-closed boundaries inherited unchanged

```text
SIF CREATE
  WRITER_2_SIF_CREATE_PAYLOAD_SEMANTICS_UNQUALIFIED_ITEMS_27_30

HANGER CREATE
  WRITER_2_HANGER_CREATE_PAYLOAD_SEMANTICS_NOT_QUALIFIED

H>1 partial HANGER DELETE
  WRITER_2_HANGER_PARTIAL_MULTI_RECORD_TAIL_ORDER_UNQUALIFIED

unsupported cardinality/topology families
  remain blocked
```

No production file is changed to widen these authorities.

## 7. Changed-file ledger

Qualification:

```text
tests/cii-workspace-writer2-trifamily-real-benchmark-roundtrip.test.js
```

Recovery:

```text
agents/PR1023_workreport.md
agents/status/PR1023.yaml
agents/claims/PR1023.yaml
agents/MASTER_INDEX.md
```

Expected production source changes: 0.

## 8. Validation truth

```text
PR1022 merge / PR1023 base grounding                  PASS_GIT_BRANCH
BM_CII_SOURCE V11/CONTROL counts                      PASS_SOURCE_INSPECTION
BM_CII_SOURCE NODENAME four-row custody               PASS_SOURCE_INSPECTION
BM_CII_SOURCE real hanger 205 / 23->11 row basis      PASS_INHERITED_SOURCE_EVIDENCE
qualification test source audit                       PASS_SOURCE_INSPECTION
exact checkout                                        BLOCKED_ENVIRONMENT_GITHUB_DNS
focused tri-family real-benchmark regression          AUTHORED_NOT_RUN_ENVIRONMENT
inherited PR1022 product regression                   NOT_RUN_ENVIRONMENT
inherited PR1021 tri-family regression                NOT_RUN_ENVIRONMENT
inherited Writer2 component regressions               NOT_RUN_ENVIRONMENT
full repository tests                                 NOT_RUN_ENVIRONMENT
browser Writer2 flow                                  NOT_RUN_ENVIRONMENT
```

No unexecuted check is represented as PASS.

## 9. Exact next action

1. reconcile the authored test against current source contracts;
2. execute focused qualification if an exact checkout becomes available;
3. inspect exact PR head status/workflow evidence;
4. keep PR draft/unmerged until owner disposition.

Do not widen Writer2 authority in PR1023.

# Appendix A — takeover qualification

1. Why is BM_CII_SOURCE selected instead of combining separate synthetic fixtures?
2. Which four CONTROL counts establish the three-family physical preimage?
3. Why is the NODENAME candidate discovered dynamically instead of hard-coded?
4. Why must every owner of the selected SIF pointer be in the DELETE APPLY set?
5. Why is node 205 an admissible HANGER delete-all transaction?
6. Why does HANGER delete-all avoid the unresolved H>1 retained-tail ordering problem?
7. What exact parent scope fields are authoritative?
8. Why compare public product bytes to direct tri-family writer bytes?
9. Which complete postimage validator is authoritative?
10. Why is successful reparsing insufficient after an unrelated-byte tamper?
11. What does the stale-preview falsifier prove?
12. What does forged mutation testimony prove?
13. Why do readiness and low-level writer use different duplicate-scope error namespaces?
14. Which Writer2 authorities remain blocked after this qualification?
15. Which production files are intentionally unchanged?
16. Which tests remain NOT_RUN and why?
