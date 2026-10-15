# EP-CII-FR-0024 — U3 retained-real native-v14 failure checkpoint

CHAIN_ID: CII-FIND-REPLACE-V14
ENDPOINT_ID: EP-CII-FR-0024
PREDECESSOR_ENDPOINT: EP-CII-FR-0023
LATEST_MATERIAL_LEG: ML-CII-FR-0004
LATEST_MATERIAL_LEG_FILE: agents/chains/CII-FIND-REPLACE-V14/material-legs/ML-CII-FR-0004.md
PR: 1081
BRANCH: feature/cii-find-replace-finish-v14
BASE_MAIN: bfe3abbb67060c1212001f2e9d967c229a057640
PRODUCT_MATERIAL_HEAD: 09c7c1aab70fab5d918065d11b557050205b97f0
STATE: RETAINED_REAL_FAILURE_REQUIRES_CORRECTIVE_PATCH
ENGINEERING_STATE: BLOCKED_BY_NATIVE_V14_COMPACT_ROW_DEFECT
CUSTODY_STATE: HELD
QUALIFICATION_STATE: NOT_REQUIRED
WRITE_AUTHORITY: READ_ONLY
AUTO_STATE: NOT_APPLICABLE
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
MERGEABILITY: MERGEABLE_CLEAN
NEXT_PHASE_AUTHORITY: READ_ONLY_PENDING_OWNER_PROGRESSION

## U3 execution result

U3 reconstructed the retained native CAESAR II v14 benchmark exactly from:

```text
reallaksh19/3D_Converters@ca8d391ac5f829f53bebb3c37adf0547c34a67b4
Benchmarks/v11-v14.zip
archive Git blob 8409e1c429665e34a83c2a464665ebf5d5f1b0a1
SYS-0001-v14.CII
SHA-256 d2d4316309d9b1aa34b55ad72f89193fd0e437930db203fecd9ede00e69b2faf
168574 bytes
```

Evidence:

`agents/evidence/PR1081_u3_native_v14_retained_real_execution.md`

## What passed

Committed U1 ownership/cardinality logic passed every represented generic auxiliary pointer:

```text
BEND        9/9
RIGID      43/43
RESTRANT   40/40
SIF&TEES    2/2
REDUCERS    1/1
TOTAL      95/95
shared pointers 0
```

Existing specialized NODENAME behavior also remained clean:

```text
resolver          PASS 55/55
retained-real claim validation PASS 55/55
```

SIF&TEES retained-real U2 field mutation passed both represented records with exact same-width numeric claims.

FORCE/FORCMNT remains blocked.

## What failed

The committed U2 field-authority layer requires `ref.body.length === 80` for a numeric row. Native v14 legitimately emits compact fixed-width numeric rows when fewer than six values are present.

Observed canonical widths are:

```text
15, 28, 41, 54, 67, 80
```

The result on committed U2 code is:

```text
ELEMENT      0/112  FAIL  NUMERIC_FIELD_ROW_INVALID:ELEMENT_R9
BEND          0/9   FAIL  AUX_FIELD_ROW_SCHEMA_UNRECOGNIZED:BEND:2
RIGID         0/43  FAIL  AUX_FIELD_ROW_SCHEMA_UNRECOGNIZED:RIGID:0
RESTRANT      0/40  FAIL  AUX_FIELD_ROW_SCHEMA_UNRECOGNIZED:RESTRANT:1
SIF&TEES      2/2   PASS
REDUCERS      0/1   FAIL  AUX_FIELD_ROW_SCHEMA_UNRECOGNIZED:REDUCERS:0
```

This is a retained-real production defect in U2 field parsing, not a failure in U1 ownership.

## Diagnostic falsifier

An uncommitted throwaway copy that only recognized the canonical compact widths (and stopped requiring 80 bytes for every Element pointer row) resolved:

```text
ELEMENT     112/112
BEND          9/9
RIGID        43/43
RESTRANT     40/40
SIF&TEES       2/2
REDUCERS       1/1
NODENAME      55/55
```

This is diagnostic only and MUST NOT be promoted to PASS. Production correction must retain exact row-shape/fail-closed validation.

## Validation truth

```text
Benchmark custody / exact native member              PASS
U1 native-v14 represented ownership                  PASS 95/95
NODENAME retained-real regression                    PASS 55/55
SIF&TEES retained-real U2 claims                     PASS 2/2
U2 native-v14 expanded field authority               FAIL
U2 synthetic/focused exact-source runtime            PASS 19/19
U1 synthetic/focused exact-source runtime            PASS 17/17
PR1081 prior UI/static exact-source closure           PASS 10/10
SOURCE 3 retained-real authored runtime               NOT_RUN
Full repository suite                                 NOT_RUN
External CAESAR acceptance                            NOT_RUN
```

No NOT_RUN state was promoted.

## Protected invariants

```text
TARGET0 overwrite                 DISABLED
Direct Apply-to-source            DISABLED
Writer1/Writer2 invocation        NONE
NODENAME production logic         UNCHANGED
FORCE/FORCMNT                     DE_SCOPED
CONTROL / IEL mutation            NONE
record clone/repoint              NONE
UI/CSV generic block expansion    NOT AUTHORIZED
merge                             OWNER_ONLY / NOT AUTHORIZED
```

## Exact next action

On the next Owner progression, perform a bounded corrective field-authority leg before any UI/CSV expansion. Replace the blanket 80-byte numeric-row assumption with explicit canonical compact v14 row-shape authority, including correct Element row/pointer shapes and represented auxiliary shapes; preserve field boundaries, numeric postimage validation, U1 ownership, Node Name specialization and FORCE exclusion; add compact-row regressions; then re-run this exact retained native-v14 benchmark. Do not merge PR1081 without explicit Owner authorization.
