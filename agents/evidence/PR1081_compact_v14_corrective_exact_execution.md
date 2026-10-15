# PR1081 — compact v14 corrective exact execution

PR: #1081
Branch: `feature/cii-find-replace-finish-v14`
Product material head: `700e08a5be64a35bcc157554e809e97ba41bcace`
Prework endpoint: `EP-CII-FR-0025`

## Defect closed

U3 retained-real execution showed that the U2 field authority incorrectly required every numeric record to be 80 bytes. Native CAESAR II v14 emits canonical compact `(2X,n*13)` rows when fewer than six fields are present.

The corrective material recognizes only canonical numeric widths:

```text
1 field  15 bytes
2 fields 28 bytes
3 fields 41 bytes
4 fields 54 bytes
5 fields 67 bytes
6 fields 80 bytes
```

Represented native-v14 row-position authority is pinned for Element, BEND, RIGID, RESTRANT, SIF&TEES and REDUCERS. Existing full-width synthetic rows remain compatible only when fields outside the row's v14 schema are zero/blank padding; padding fields are never exposed as mutable spans. Malformed near-widths fail closed.

Node Name production logic was not changed. FORCE/FORCMNT remains excluded.

## Exact promoted blobs

```text
tabs/cii-workspace/cii-workspace-find-replace-v14-field-authority.js
  1607a63ac29068eb74960eb755d047af21746840

tests/cii-workspace-find-replace-v14-field-authority.test.js
  a32a4134154267e8022c456274087261eca41785
```

The GitHub-created blobs returned those exact Git SHAs before the material commit was created, and branch fetch after promotion returned the same SHAs.

## Exact retained benchmark

```text
repository    reallaksh19/3D_Converters
commit        ca8d391ac5f829f53bebb3c37adf0547c34a67b4
archive       Benchmarks/v11-v14.zip
archive blob  8409e1c429665e34a83c2a464665ebf5d5f1b0a1
member        SYS-0001-v14.CII
bytes         168574
line ending   CRLF
SHA-256       d2d4316309d9b1aa34b55ad72f89193fd0e437930db203fecd9ede00e69b2faf
```

## Executed focused suite

```text
node --check tabs/cii-workspace/cii-workspace-find-replace-v14-field-authority.js
node --check tests/cii-workspace-find-replace-v14-field-authority.test.js

node --test \
  tests/cii-workspace-find-replace-validator.test.js \
  tests/cii-workspace-find-replace-scope-resolver.test.js \
  tests/cii-workspace-find-replace-v14-field-authority.test.js
```

Observed:

```text
20 PASS
0 FAIL
0 SKIP
```

The new regression proves canonical compact RIGID and Element rows are accepted while 29-byte RIGID and 68-byte Element numeric rows fail closed.

## Retained native-v14 audit on promoted bytes

```text
Element field authority       PASS 112/112
BEND ownership + fields       PASS 9/9
RIGID ownership + fields      PASS 43/43
RESTRANT ownership + fields   PASS 40/40
SIF&TEES ownership + fields   PASS 2/2
REDUCERS ownership + fields   PASS 1/1
Generic represented ownership PASS 95/95
shared generic pointers       0
NODENAME resolver             PASS 55/55
NODENAME claim validation     PASS 55/55
FORCE/FORCMNT                 BLOCKED as required
```

No Node Name defect was reproduced and its production module was untouched.

## Prior results retained, not rerun in this leg

The dedicated U1 synthetic ownership test file was not present in the local corrective reconstruction, so it was **not rerun** in this leg. The prior exact-source U1 result remains `PASS 17/17` from `ML-CII-FR-0003`; it is not relabeled as a new execution. The current retained-native audit independently reran U1 ownership behavior for all 95 represented generic pointers and passed 95/95.

## Validation truth

```text
Compact-v14 promoted focused suite                   PASS 20/20
Native-v14 represented Element/aux field authority   PASS
Native-v14 represented generic ownership             PASS 95/95
NODENAME retained-real regression                    PASS 55/55
Prior U1 exact-source focused suite                  PASS 17/17 / retained, not rerun here
PR1081 prior UI/static exact-source closure           PASS 10/10 / retained
SOURCE 3 retained-real authored runtime               NOT_RUN
Full repository suite                                 NOT_RUN
External CAESAR acceptance                            NOT_RUN
```

No NOT_RUN state is promoted to PASS.

## Protected invariants

```text
TARGET0 overwrite              DISABLED
Direct Apply-to-source         DISABLED
Writer1/Writer2 invocation     NONE
CONTROL / IEL mutation         NONE
record clone/repoint           NONE
NODENAME production logic      UNCHANGED
FORCE/FORCMNT                  DE_SCOPED
UI/CSV generic expansion       NOT PART OF THIS LEG
merge                          OWNER_ONLY / NOT AUTHORIZED
```
