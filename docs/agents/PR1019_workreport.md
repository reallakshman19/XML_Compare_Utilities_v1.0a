# PR1019 — Writer 2 HANGER DELETE authority

# CURRENT RECOVERY STATE — READ FIRST

```text
HANDOVER_READINESS: READY
REPOSITORY: reallaksh19/XML_Compare_Utilities
PR: #1019
BRANCH: agent/cii-writer2-hanger-delete-authority
BASE: main@887eedc028f64e3831b28fb755fdbe9ed904682f
MISSION: qualify fail-closed existing HANGER deletion before any physical writer
CURRENT_STAGE: DELETE_PLANNER_HARDENED / DRAFT / REPOSITORY_RUNTIME_NOT_RUN
TAKEOVER_AUTHORITY: WRITE_ALLOWED
MERGE_AUTHORITY: OWNER_ONLY
```

## 1. Current scope

Implemented:

```text
HANGER presence DELETE routing
CONTROL.NOHGRS exact field custody
IHGRNODE-first physical custody
canonical MISCEL_1 row-count arithmetic
packed 2X + 13-byte integer-field custody
H=1 delete
H>1 delete-all
CREATE hard blocker
partial H>1 delete hard blocker
alternate-layout mutation blocker
real BM_CII_SOURCE node-205 oracle
```

Not implemented:

```text
physical CONTROL/MISCEL_1 rewrite
independent physical postimage validator
Writer2 composite adoption
product/core routing
browser/UI changes
HANGER CREATE
partial H>1 retained-record compaction
```

## 2. Source authority

Inspected:

```text
converters/scripts/cii2019_section_rules.py
converters/scripts/cii2019_hanger_miscel_control.py
converters/scripts/cii2019_miscel_hardener.py
tabs/cii-workspace/cii-workspace-hanger.js
parser/fixed-field.js
Benchmark/CIICompare/BM_CII_SOURCE.CII
```

Protected converter corroboration inspected read-only:

```text
reallaksh19/3D_Converters
commit ad71a42af34afef565ea4645de83d0613996a106
converters/scripts/cii2019_hanger_miscel_control.py
```

Stable row-count authority:

```text
RRMAT                         ceil(NUMELT/6)
VFLEX                         4*NUMNOZ
hanger defaults               2
IHGRNODE                      ceil(H/6)
HGRDAT + TAG/GUID envelope    4*H
IHGRFREE                      H
IHGRNUM                       ceil(H/6)
IHGRTABLE                     ceil(H/6)
IHGRSHORT                     ceil(H/6)
IHGRCN                        ceil(H/6)
execution rows                4
```

For H>0:

```text
hanger payload rows = 2 + 5*H + 5*ceil(H/6)
```

## 3. QF-1019-001 — H>1 tail-order conflict

The original PR claimed that two emitters independently corroborated one index-parallel HGRDAT/TAG-GUID ordering. Source audit disproved that.

`cii2019_hanger_miscel_control.py` emits:

```text
IHGRNODE
record1 HGRDAT1/HGRDAT2/TAG/GUID
record2 HGRDAT1/HGRDAT2/TAG/GUID
...
IHGRFREE
packed arrays
```

`cii2019_miscel_hardener.py` emits:

```text
IHGRNODE
all HGRDAT rows
all TAG/GUID rows
IHGRFREE
packed arrays
```

For H=1 the two layouts are equivalent. For H>1 they differ.

`buildCiiHangerEvidence()` only proves IHGRNODE location/nodes. Its `CAESAR_SYNCHRONIZER_IHGRNODE_FIRST` label does not distinguish the two tail orders.

### Disposition

Do not guess either order.

New mandatory blocker:

```text
WRITER_2_HANGER_PARTIAL_MULTI_RECORD_TAIL_ORDER_UNQUALIFIED
```

Rule:

```text
H = 1                         -> DELETE may proceed
H > 1 and delete all records  -> DELETE may proceed
H > 1 and retain any record   -> BLOCK
```

The old arithmetic example:

```text
1 -> 1
2 -> 0
3 -> 2
```

is retained only as mathematical testimony; it is not physical mutation authority.

## 4. Why delete-all remains safe

When all hangers are deleted, no retained HGRDAT/TAG-GUID record identity is needed:

```text
NOHGRS -> 0
hanger defaults -> removed
IHGRNODE -> removed
entire opaque HGRDAT/TAG-GUID envelope -> removed
IHGRFREE -> removed
packed arrays -> removed
RRMAT/VFLEX -> retained
execution rows -> retained
```

Therefore the conflicting internal HGRDAT/TAG-GUID ordering is irrelevant to the postimage.

## 5. Packed-array hardening

The canonical integer emitter uses:

```text
2X + N * I13
```

The planner now requires the two-byte prefix to be exactly two spaces before accepting packed IHGRNODE/IHGRNUM/IHGRTABLE/IHGRSHORT/IHGRCN custody. Each retained value field retains exact 13-byte custody.

A forged packed prefix is an authored negative regression.

## 6. CREATE boundary

CREATE remains blocked:

```text
WRITER_2_HANGER_CREATE_PAYLOAD_SEMANTICS_NOT_QUALIFIED
```

because authoritative construction/default/sentinel semantics for HGRDAT, TAG/GUID, IHGRFREE and packed arrays remain incomplete.

## 7. Real physical oracle

`Benchmark/CIICompare/BM_CII_SOURCE.CII`:

```text
NUMELT = 40
NUMNOZ = 0
NOHGRS = 1
hanger node = 205
layout = CAESAR_SYNCHRONIZER_IHGRNODE_FIRST
```

Arithmetic:

```text
RRMAT rows       ceil(40/6) = 7
hanger rows      2 + 5*1 + 5*ceil(1/6) = 12
execution rows   4
before total     23

after H=0:
7 RRMAT + 4 execution = 11
```

This is an authorized delete-all case because H=1.

## 8. Regression coverage authored

```text
H=3 partial delete on INTERLEAVED fixture -> BLOCK
H=3 partial delete on GROUPED fixture     -> BLOCK
H=3 delete-all on INTERLEAVED fixture     -> READY
H=3 delete-all on GROUPED fixture         -> READY
forged packed-array prefix                -> BLOCK
HANGER CREATE                             -> BLOCK
INPUTXML_CURRENT layout                   -> BLOCK
real BM_CII_SOURCE H=1 delete             -> READY
```

The regression intentionally proves that parser `SYNCHRONIZER` labeling alone cannot authorize partial H>1 compaction.

## 9. Changed-file ledger

Implementation/test:

```text
tabs/cii-workspace/cii-workspace-writer2-hanger-delete.js
tests/cii-workspace-writer2-hanger-delete-plan.test.js
docs/cii-writer2-hanger-delete-authority.md
```

Recovery:

```text
agents/PR1019_workreport.md
agents/status/PR1019.yaml
agents/claims/PR1019.yaml
agents/MASTER_INDEX.md
```

No existing parser, Writer1, Writer2 product/core, UI, benchmark CII, or protected converter file is modified.

## 10. Validation truth

```text
PR1018 merge / PR1019 base grounding                    PASS
row-count source review                                 PASS_SOURCE_INSPECTION
QF-1019-001 emitter conflict                            PASS_SOURCE_INSPECTION
protected synchronizer inspection                       PASS_SOURCE_INSPECTION
BM_CII_SOURCE physical oracle                           PASS_SOURCE_INSPECTION
independent row/delete-all arithmetic                    PASS_INDEPENDENT_ARITHMETIC
focused JS regression                                   AUTHORED_NOT_RUN_ENVIRONMENT
inherited hanger custody regression                     NOT_RUN_ENVIRONMENT
Writer2 regression suite                                NOT_RUN_ENVIRONMENT
full repository tests                                   NOT_RUN_ENVIRONMENT
browser/product                                         NOT_RUN_ENVIRONMENT
```

No unexecuted repository/browser test is represented as PASS.

## 11. Exact next phase after PR1019 acceptance

Implement **delete-all physical rewrite first**:

```text
untouched TARGET bytes
 + accepted PR1019 delete-all plan
 -> rewrite CONTROL.NOHGRS exact 13-byte field to 0
 -> retain RRMAT/VFLEX bytes exactly
 -> remove complete hanger payload envelope
 -> retain execution rows exactly
 -> one variable-length byte transaction
 -> re-intake
 -> independently rebuild complete expected postimage
 -> PASS iff actual bytes == expected bytes
```

Do not implement partial H>1 compaction until the HGRDAT/TAG-GUID ordering conflict has independent authoritative resolution.

## Appendix A — takeover qualification

1. What does `buildCiiHangerEvidence()` actually prove, and what does it not prove?
2. State the stable hanger row-count formula for H>0.
3. Describe QF-1019-001 and name the two conflicting emitter orderings.
4. Why is H=1 unaffected by that ordering conflict?
5. Why is H>1 delete-all safe without record-order authority?
6. Why is H>1 partial deletion blocked even though `1,2,3 -> 1,0,2` arithmetic is trivial?
7. Which exact CONTROL field will the physical writer change?
8. What packed-row prefix and field-width custody is required?
9. Why does CREATE still require more semantics than delete-all?
10. What complete expected-postimage proof must the successor validator provide?