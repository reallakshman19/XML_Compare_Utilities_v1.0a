# PR1024 — Writer 2 H>1 HANGER tail-order qualification

# CURRENT RECOVERY STATE — READ FIRST

```text
HANDOVER_READINESS: READY
REPOSITORY: reallaksh19/XML_Compare_Utilities
PR: #1024
BRANCH: agent/cii-writer2-hanger-partial-delete-authority
BASE: main@d9b680d61d14f320a75e4546fd07370eb5d39d17
MISSION: qualify physical HGRDAT/TAG/GUID tail ordering for future partial H>1 HANGER deletion without enabling mutation
CURRENT_STAGE: CLASSIFIER_AND_FALSIFIERS_AUTHORED_NOT_EXECUTED
TAKEOVER_AUTHORITY: WRITE_ALLOWED
MERGE_AUTHORITY: OWNER_ONLY
```

## 1. Scope

PR1024 is qualification-only.

It adds a physical classifier for the two H>1 hanger-tail layouts already identified by merged PR1019. It does **not** modify:

- `cii-workspace-writer2-hanger-delete.js`;
- the physical HANGER writer/validator;
- the tri-family composite;
- product/core routing;
- UI;
- parser/fixed-field implementation;
- protected converters;
- benchmark CII files;
- workflows.

The merged production blocker remains:

```text
WRITER_2_HANGER_PARTIAL_MULTI_RECORD_TAIL_ORDER_UNQUALIFIED
```

## 2. Source grounding

Cross-repository source audit used:

```text
reallaksh19/3D_Converters
commit ca8d391ac5f829f53bebb3c37adf0547c34a67b4
```

`cii2019_hanger_miscel_control.py` emits per-record interleaving:

```text
HGRDAT1, HGRDAT2, TAG, GUID
```

`cii2019_miscel_hardener.py` emits grouped rows:

```text
all HGRDAT pairs, then all TAG/GUID pairs
```

The conflict is physically distinguishable because HGRDAT rows decode as exactly 6 then 5 finite numeric values, while TAG/GUID rows follow the fixed string-card shape.

## 3. New classifier contract

File:

```text
tabs/cii-workspace/cii-workspace-writer2-hanger-tail-order.js
```

Exports:

```text
CII_WRITER_2_HANGER_TAIL_ORDERS
CII_WRITER_2_HANGER_TAIL_ORDER_AUTHORITY
qualifyCiiWriter2HangerTailOrder
retainedCiiWriter2HangerTailRows
```

Qualification result:

```text
schema = CIIWriter2HangerTailOrderQualification.v1
status = QUALIFIED | BLOCKED
order  = SINGLE_RECORD_ORDER_EQUIVALENT
       | HGRDAT_TAG_GUID_INTERLEAVED_PER_RECORD
       | HGRDAT_ALL_THEN_TAG_GUID_ALL
authority = PHYSICAL_ROW_SHAPE_PLUS_DUAL_EMITTER_ORDER
mutationAuthority = NONE_CLASSIFICATION_ONLY
```

## 4. Exact physical rules

For H>0, the classifier requires exactly `4*H` rows.

Interleaved:

```text
per record: numeric(6), numeric(5), string, string
```

Grouped:

```text
H pairs of numeric(6), numeric(5)
then H pairs of string, string
```

H=1 is intentionally classified as `SINGLE_RECORD_ORDER_EQUIVALENT` because both physical orders collapse to the same sequence.

TAG/GUID string cards require:

```text
7X + I5 declared length + 1X + body
0 <= declared length <= 100
declared length <= available body
```

Both compact empty 13-character cards and padded 100-character bodies are admitted.

## 5. QF-1024-001 — grouped retention-order bug found before PR

The first retention helper implementation emitted selected grouped records in record order:

```text
HGRDAT1,HGRDAT2,TAG,GUID per retained record
```

That would have converted a grouped TARGET into interleaved order.

Corrected before PR creation:

```text
grouped retention = all retained HGRDAT pairs, then all retained TAG/GUID pairs
interleaved retention = retained complete 4-row records in original record order
```

For H=3 retaining records 1 and 3:

```text
interleaved -> 1,2,3,4,9,10,11,12
grouped     -> 1,2,5,6,7,8,11,12
```

This is a qualification-critical invariant.

## 6. Authored regression

File:

```text
tests/cii-workspace-writer2-hanger-tail-order.test.js
```

Cases:

1. H=3 interleaved -> QUALIFIED + exact record-2 map;
2. H=3 grouped -> QUALIFIED + exact record-2 map;
3. retained 1+3 preserves original ordering class;
4. H=1 compact/padded empty string cards -> SINGLE_RECORD_ORDER_EQUIVALENT;
5. mixed forged envelope -> BLOCKED;
6. wrong `4*H` row cardinality -> BLOCKED;
7. forged string length > available body -> BLOCKED;
8. H=0 -> outside classifier / BLOCKED.

## 7. Changed-file ledger

Expected PR1024 paths:

```text
tabs/cii-workspace/cii-workspace-writer2-hanger-tail-order.js
tests/cii-workspace-writer2-hanger-tail-order.test.js
docs/cii-writer2-hanger-partial-delete-tail-order.md
agents/PR1024_workreport.md
agents/status/PR1024.yaml
agents/claims/PR1024.yaml
agents/MASTER_INDEX.md
```

No existing production writer path is intentionally changed.

## 8. Validation truth

```text
PR1023 merge / PR1024 exact base                    PASS
3D_Converters dual-emitter source conflict          PASS_SOURCE_INSPECTION
interleaved emitter row order                       PASS_SOURCE_INSPECTION
grouped emitter row order                           PASS_SOURCE_INSPECTION
qualification module source audit                   PASS_SOURCE_INSPECTION
QF-1024-001 correction                              PASS_SOURCE_INSPECTION
focused Node regression                             AUTHORED_NOT_RUN_ENVIRONMENT
inherited HANGER regression                         NOT_RUN_ENVIRONMENT
full repository                                     NOT_RUN_ENVIRONMENT
browser/product                                     NOT_RUN_ENVIRONMENT
```

No unexecuted test is represented as PASS.

## 9. Explicit exclusions

```text
partial H>1 planner READY
partial H>1 physical write
partial H>1 product route
HANGER CREATE
HANGER attribute edit
SIF CREATE
Writer3 topology
```

## 10. Exact next action

Successor PR should integrate this classifier into `physicalCustody()` in the merged HANGER planner, bind its record map to IHGRNODE/IHGRFREE/all packed arrays, and remove the partial-H>1 blocker **only at planner level**. Physical mutation remains a separate phase with an independent complete-postimage validator.

## Appendix A — takeover qualification

A next agent must be able to answer these before changing authority:

1. Why did PR1019 block partial H>1 deletion?
2. What exact source conflict exists between the synchronizer and hardener?
3. Why can the conflict be classified physically without interpreting hanger engineering values?
4. What exact row signature identifies HGRDAT1 and HGRDAT2?
5. What exact physical structure identifies TAG/GUID string cards?
6. Why are compact empty and padded empty string rows both accepted?
7. Why is H=1 `SINGLE_RECORD_ORDER_EQUIVALENT`?
8. For H=3 grouped order, what rows belong to record 2?
9. Why must grouped retention not be emitted in record-interleaved order?
10. What does QF-1024-001 prevent?
11. Which merged production blocker is intentionally still active?
12. Which additional arrays must share the same record index before planner authority can expand?
13. Why is planner qualification still separate from physical mutation authority?
14. What independent evidence must a future physical writer produce before PASS?
