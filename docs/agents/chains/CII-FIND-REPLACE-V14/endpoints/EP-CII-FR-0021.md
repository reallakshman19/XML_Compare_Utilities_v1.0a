# EP-CII-FR-0021 — universal auxiliary U1 complete

CHAIN_ID: CII-FIND-REPLACE-V14
ENDPOINT_ID: EP-CII-FR-0021
PREDECESSOR_ENDPOINT: EP-CII-FR-0020
LATEST_MATERIAL_LEG: ML-CII-FR-0003
LATEST_MATERIAL_LEG_FILE: agents/chains/CII-FIND-REPLACE-V14/material-legs/ML-CII-FR-0003.md
PR: 1081
BRANCH: feature/cii-find-replace-finish-v14
BASE_MAIN: bfe3abbb67060c1212001f2e9d967c229a057640
PRODUCT_MATERIAL_HEAD: 4f9e79fc899fd5e89c33267480208e25f8d627da
MATERIAL_RECEIPT_COMMIT: bec9b2da2c61989022655aa4cfa506b67c2140d3
EVIDENCE_COMMIT: d35c8db7a0bd41130898cba313bbec6bab842622
STATE: READY_FOR_NEXT_PHASE
ENGINEERING_STATE: READY
CUSTODY_STATE: HELD
QUALIFICATION_STATE: NOT_REQUIRED
WRITE_AUTHORITY: READ_ONLY
AUTO_STATE: NOT_APPLICABLE
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
MERGEABILITY: MERGEABLE_CLEAN
QUALIFICATION_SCOPE_ID: QSCOPE-PR1081-UNIVERSAL-AUX-U1
QUESTION_SET_ID: CII-FR-QS-0002
QUESTION_SET_STATUS: NOT_APPLICABLE
QUESTION_PACK_ACTION: SUPPRESSED_BY_OWNER
QUESTION_DISPLAY: HIDE
OWNER_PROGRESSION_COMMAND: PROCEED_NEXT
OWNER_QUALIFICATION_OVERRIDE: SKIP_U1_CONSUMED
NEXT_PHASE_AUTHORITY: READ_ONLY_PENDING_OWNER_PROGRESSION

## Completed U1

U1 now provides one reusable fail-closed v14 auxiliary ownership layer:

```text
exact From/To element
+ canonical IEL pointer
+ CONTROL count
+ v14 rows-per-record
+ exact physical section rows
+ reverse pointer owner set
=> exact uniquely owned auxiliary record
```

The new registry covers all 15 v14 IEL positions and uses v14-specific cardinalities, including:

```text
ALLOWBLS  28
SIF&TEES  14
REDUCERS    2
```

rather than legacy 26/10/1 values.

Physical blank payload rows are preserved. Embedded comment ambiguity and shared pointers fail closed.

## Public Find & Replace behavior after U1

The user-facing supported mutable block surface is intentionally unchanged:

```text
NODENAME      existing specialized path
DISPLACEMENT  existing mutable path, now strengthened by common CONTROL/owner resolution
```

Recognized generic families can establish ownership evidence internally but still return zero mutable spans and:

```text
BLOCK_MUTATION_NOT_QUALIFIED:<BLOCK>
```

Therefore U1 does not claim that universal generic block mutation is complete.

## Protected invariants

```text
NODENAME production logic          unchanged
DISPLACEMENT endpoint validation   preserved
FORCE/FORCMNT                      de-scoped
TARGET0 overwrite                  disabled
Direct Apply-to-source             disabled
Writer1/Writer2 invocation         none
CONTROL / IEL structural mutation  none
validator/executor/output custody  unchanged
merge                              Owner-only / unauthorized
```

## Exact-source validation

Evidence:

`agents/evidence/PR1081_universal_auxiliary_u1_exact_execution.md`

Observed focused execution:

```text
17 PASS
0 FAIL
0 SKIP
```

The suite covers the complete registry, pointer/cardinality/ownership failures, v14-only cardinality deltas, blank-row preservation, generic mutation blocking, Displacement regression behavior, Node Name routing and FORCE rejection.

## Validation truth

```text
U1 exact-source focused resolver runtime             PASS 17/17
PR1081 prior exact-source UI/static closure           PASS 10/10
Merged non-benchmark Find & Replace                   PASS 33/33
Merged focused Node Name                              PASS 4/4
SOURCE 3 retained-real authored runtime               NOT_RUN
Full repository suite                                 NOT_RUN
Native-v14 archived fixture runtime                   NOT_RUN
External CAESAR acceptance                            NOT_RUN
```

## Next phase boundary

U2 is a materially different authority layer: field-aware mutation claims for universal Element and auxiliary Block scopes.

At minimum U2 must protect:

```text
ELEMENT From/To selector fields
all 15 ELEMENT auxiliary pointer fields
field boundaries / length prefixes / control columns
numeric parse validity after replacement
line-ending bytes
shared auxiliary ownership
```

NODENAME should remain on its current specialized implementation. FORCE/FORCMNT remains excluded.

U2 does not inherit writable authority from the completed U1 leg. Current state is READ_ONLY pending the next Owner progression.

## Exact next action

On the next Owner progression, perform the bounded U2 field-schema/claim-engine phase starting from this endpoint. Do not modify Node Name logic unless a concrete defect is reproduced, do not resume FORCE/FORCMNT, preserve every `NOT_RUN` gate, and do not merge PR #1081 without explicit Owner merge authorization.
