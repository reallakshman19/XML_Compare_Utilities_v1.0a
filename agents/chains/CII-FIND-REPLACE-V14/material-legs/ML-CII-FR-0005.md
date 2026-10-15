# ML-CII-FR-0005 — native-v14 compact numeric row correction

CHAIN_ID: CII-FIND-REPLACE-V14
MATERIAL_LEG_ID: ML-CII-FR-0005
PREWORK_ENDPOINT: EP-CII-FR-0025
PREDECESSOR_MATERIAL_LEG: ML-CII-FR-0004
PR: 1081
BRANCH: feature/cii-find-replace-finish-v14
BASE_MAIN: bfe3abbb67060c1212001f2e9d967c229a057640
PRODUCT_MATERIAL_HEAD: 700e08a5be64a35bcc157554e809e97ba41bcace

## Material paths

```text
MODIFY tabs/cii-workspace/cii-workspace-find-replace-v14-field-authority.js
MODIFY tests/cii-workspace-find-replace-v14-field-authority.test.js
```

No other product/test path is part of this material leg.

## Exact material blobs

```text
field-authority.js
  1607a63ac29068eb74960eb755d047af21746840
field-authority.test.js
  a32a4134154267e8022c456274087261eca41785
```

## Change

Replace the incorrect blanket 80-byte numeric-row requirement with explicit canonical v14 compact fixed-width row authority. Canonical numeric widths are 15/28/41/54/67/80 bytes for one through six fields.

The correction pins represented retained-real row schemas for Element, BEND, RIGID, RESTRANT, SIF&TEES and REDUCERS. Compatibility with old full-width synthetic fixtures is allowed only when out-of-schema trailing fields are zero/blank padding, and those fields never become mutable spans. Near-width malformed records still fail closed.

Node Name code and behavior are unchanged. FORCE/FORCMNT remains excluded.

## Validation

Evidence: `agents/evidence/PR1081_compact_v14_corrective_exact_execution.md`

Promoted exact-source focused execution:

```text
PASS 20/20
FAIL 0
SKIP 0
```

Exact retained `SYS-0001-v14.CII` execution:

```text
Element        PASS 112/112
BEND           PASS 9/9
RIGID          PASS 43/43
RESTRANT       PASS 40/40
SIF&TEES       PASS 2/2
REDUCERS       PASS 1/1
U1 ownership   PASS 95/95 represented pointers
NODENAME       PASS 55/55 resolver + claim validation
FORCE/FORCMNT  BLOCKED as required
```

The dedicated U1 synthetic suite was not rerun in this corrective reconstruction; prior exact-source U1 `PASS 17/17` remains retained evidence from ML-CII-FR-0003 and is not relabeled as a new run.

## NOT_RUN preserved

```text
SOURCE 3 retained-real authored runtime  NOT_RUN
Full repository suite                    NOT_RUN
External CAESAR acceptance               NOT_RUN
```

## Invariants

```text
TARGET0 overwrite                 DISABLED
Direct Apply-to-source            DISABLED
Writer1/Writer2 invocation        NONE
NODENAME production logic         UNCHANGED
FORCE/FORCMNT                     DE_SCOPED
CONTROL / IEL mutation            NONE
record clone/repoint              NONE
UI/CSV generic block expansion    NOT IN THIS LEG
merge                             OWNER_ONLY / NOT AUTHORIZED
```

## Successor requirement

Freeze a successor endpoint with the U3 compact-row defect closed, WRITE_AUTHORITY returned to READ_ONLY, and U4 remaining-v14-family evidence as the next bounded phase before any generic UI/CSV expansion.
