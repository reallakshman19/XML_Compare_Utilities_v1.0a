# EP-CII-FR-0026 — compact-v14 corrective PASS successor

CHAIN_ID: CII-FIND-REPLACE-V14
ENDPOINT_ID: EP-CII-FR-0026
PREDECESSOR_ENDPOINT: EP-CII-FR-0025
LATEST_MATERIAL_LEG: ML-CII-FR-0005
LATEST_MATERIAL_LEG_FILE: agents/chains/CII-FIND-REPLACE-V14/material-legs/ML-CII-FR-0005.md
PR: 1081
BRANCH: feature/cii-find-replace-finish-v14
BASE_MAIN: bfe3abbb67060c1212001f2e9d967c229a057640
PRODUCT_MATERIAL_HEAD: 700e08a5be64a35bcc157554e809e97ba41bcace
STATE: READY_FOR_NEXT_PHASE
ENGINEERING_STATE: READY
CUSTODY_STATE: HELD
QUALIFICATION_STATE: NOT_REQUIRED
WRITE_AUTHORITY: READ_ONLY
AUTO_STATE: NOT_APPLICABLE
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
NEXT_PHASE_AUTHORITY: READ_ONLY_PENDING_OWNER_PROGRESSION

## Corrective closure

EP-CII-FR-0024 reproduced a retained-native defect: U2 required every numeric row to be 80 bytes. ML-CII-FR-0005 corrects that assumption with explicit canonical v14 compact numeric widths and represented row-position schemas.

Exact material:

```text
700e08a5be64a35bcc157554e809e97ba41bcace
field-authority.js       1607a63ac29068eb74960eb755d047af21746840
field-authority.test.js  a32a4134154267e8022c456274087261eca41785
```

## Promoted execution

```text
focused exact-source suite             PASS 20/20
Element retained-native fields         PASS 112/112
BEND retained-native ownership/fields  PASS 9/9
RIGID retained-native ownership/fields PASS 43/43
RESTRANT retained-native ownership     PASS 40/40
SIF&TEES retained-native ownership     PASS 2/2
REDUCERS retained-native ownership     PASS 1/1
generic represented ownership          PASS 95/95
NODENAME retained-native regression    PASS 55/55
FORCE/FORCMNT                           BLOCKED as required
```

The prior exact-source U1 synthetic suite remains PASS 17/17 from ML-CII-FR-0003 but was not rerun in this corrective reconstruction.

## Retained benchmark custody

```text
reallaksh19/3D_Converters@ca8d391ac5f829f53bebb3c37adf0547c34a67b4
Benchmarks/v11-v14.zip
archive blob 8409e1c429665e34a83c2a464665ebf5d5f1b0a1
SYS-0001-v14.CII
168574 bytes / CRLF
SHA-256 d2d4316309d9b1aa34b55ad72f89193fd0e437930db203fecd9ede00e69b2faf
```

## Protected invariants

```text
TARGET0 overwrite                 DISABLED
Direct Apply-to-source            DISABLED
Writer1/Writer2 invocation        NONE
NODENAME production logic         UNCHANGED
FORCE/FORCMNT                     DE_SCOPED
CONTROL / IEL mutation            NONE
record clone/repoint              NONE
UI/CSV generic block expansion    DEFERRED
merge                             OWNER_ONLY / NOT AUTHORIZED
```

## Validation truth

```text
Compact-v14 corrective focused runtime                PASS 20/20
Native-v14 represented Element/aux runtime            PASS
Native-v14 represented ownership                      PASS 95/95
NODENAME retained-real regression                     PASS 55/55
Prior U1 exact-source focused suite                   PASS 17/17 / retained
PR1081 prior UI/static exact-source closure            PASS 10/10 / retained
SOURCE 3 retained-real authored runtime                NOT_RUN
Full repository suite                                  NOT_RUN
External CAESAR acceptance                             NOT_RUN
```

## Exact next action

On the next Owner progression, perform bounded **U4 remaining v14 family qualification/evidence** before UI/CSV expansion. Pin field-row schemas and execute focused/spec-backed tests for EXPJT, UNIFORM, WIND, OFFSETS, ALLOWBLS, FLANGES and EQUIPMNT; search for retained-real v14 specimens for those families and DISPLMNT, and run them when available. Do not fabricate retained-real coverage. Preserve U1 ownership/cardinality/shared-owner gates, the compact-row correction, NODENAME specialized logic, Displacement endpoint semantics and FORCE exclusion. Do not expand generic UI/CSV choices or merge PR1081 without separate Owner authorization.
