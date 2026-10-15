# EP-CII-FR-0023 — U2 field-aware mutation authority complete

CHAIN_ID: CII-FIND-REPLACE-V14
ENDPOINT_ID: EP-CII-FR-0023
PREDECESSOR_ENDPOINT: EP-CII-FR-0022
LATEST_MATERIAL_LEG: ML-CII-FR-0004
LATEST_MATERIAL_LEG_FILE: agents/chains/CII-FIND-REPLACE-V14/material-legs/ML-CII-FR-0004.md
PR: 1081
BRANCH: feature/cii-find-replace-finish-v14
BASE_MAIN: bfe3abbb67060c1212001f2e9d967c229a057640
PRODUCT_MATERIAL_HEAD: 09c7c1aab70fab5d918065d11b557050205b97f0
EVIDENCE_COMMIT: 15c609b5b7eda8807f81abeff8d04f8a03d71328
MATERIAL_RECEIPT_COMMIT: 794b5bddde73a698f515ff2b03ddbe919fb63028
STATE: READY_FOR_NEXT_PHASE
ENGINEERING_STATE: READY
CUSTODY_STATE: HELD
QUALIFICATION_STATE: NOT_REQUIRED
WRITE_AUTHORITY: READ_ONLY
AUTO_STATE: NOT_APPLICABLE
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
OWNER_PROGRESSION_COMMAND: PROCEED_NEXT
NEXT_PHASE_AUTHORITY: READ_ONLY_PENDING_OWNER_PROGRESSION

## Completed U2

U2 establishes field-aware mutation claims for universal Element and element-owned auxiliary Block data while preserving U1 ownership authority.

### Element authority

```text
mutable:
  numeric fields in physical rows 1-9 except row1 FROM/TO
  Element Name text payload
  Line Number text payload
  Line Color/Visibility numeric fields

protected:
  row1 FROM
  row1 TO
  all 15 IEL pointers in rows 13-15
  text length/control columns
  line endings
```

### Auxiliary authority

Generic auxiliary mutation validation now performs:

```text
exact element
-> U1 pointer / CONTROL / cardinality / unique-owner proof
-> exact auxiliary record
-> valid field schema
-> field-contained literal match
-> numeric postimage parse check when numeric
-> TARGET0-relative claim
```

Supported field schemas in U2 include canonical numeric rows, length-prefixed text rows and FLANGES A40 text. Physical blank FLANGES payload rows remain non-mutable physical content.

### Compatibility

Default/raw generic auxiliary resolver calls intentionally retain U1 read-only behavior. Field-aware generic mutation is only admitted through validation's explicit mutation mode. This avoids accidentally broadening unrelated resolver consumers.

## Protected invariants

```text
NODENAME production logic          unchanged
DISPLACEMENT endpoint validation   preserved
FORCE/FORCMNT                      de-scoped / blocked
shared pointers                    fail closed
CONTROL / IEL pointer writes       none
TARGET0 overwrite                  disabled
Direct Apply-to-source             disabled
Writer1/Writer2 invocation         none
executor/output custody            unchanged
UI/CSV generic block expansion     not yet done
merge                              Owner-only / unauthorized
```

## Exact-source validation

Evidence:

`agents/evidence/PR1081_universal_field_u2_exact_execution.md`

Observed focused execution:

```text
19 PASS
0 FAIL
0 SKIP
```

Remote Git blob closure matched all six executed U2 product/test files exactly.

## Validation truth

```text
U2 exact-source focused field runtime                 PASS 19/19
U1 exact-source focused resolver runtime              PASS 17/17
PR1081 prior exact-source UI/static closure            PASS 10/10
Merged non-benchmark Find & Replace                    PASS 33/33
Merged focused Node Name                               PASS 4/4
SOURCE 3 retained-real authored runtime                NOT_RUN
Full repository suite                                  NOT_RUN
Native-v14 archived fixture runtime                    NOT_RUN
External CAESAR acceptance                             NOT_RUN
```

## Recovery note

The ignored local U2 worklog explicitly records that its first three mandatory local backups came from behavior-equivalent local reconstructions rather than byte-exact pre-U2 branch files. Those backups are not claimed as exact restoration evidence. The exact pre-U2 Git blob identities are recorded there and remain authoritative recovery references.

## Next phase boundary — U3 retained-real evidence

Before UI/CSV advertises universal generic blocks, U3 should execute the U1+U2 resolver/validator against retained native-v14 material where available.

Highest-value retained-real families from the existing native-v14 benchmark profile:

```text
BEND
RIGID
RESTRANT
SIF&TEES
REDUCERS
NODENAME (regression only)
```

U3 must not manufacture missing real specimens for EXPJT/UNIFORM/WIND/OFFSETS/ALLOWBLS/FLANGES/EQUIPMNT. Synthetic coverage remains synthetic until a retained-real specimen is acquired/executed.

## Exact next action

On the next Owner progression, perform bounded U3 retained-real/native-v14 execution from this endpoint. Reconstruct the archived native-v14 fixture, run ownership and field-claim resolution for available nonzero auxiliary families, prove Node Name regression remains unchanged, preserve FORCE exclusion and every unexecuted evidence gate, and do not expand UI/CSV or merge PR #1081 unless the Owner separately authorizes those actions.
