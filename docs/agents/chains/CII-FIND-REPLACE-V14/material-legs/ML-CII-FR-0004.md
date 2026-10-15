# ML-CII-FR-0004 — U2 field-aware mutation claims

CHAIN_ID: CII-FIND-REPLACE-V14
MATERIAL_LEG_ID: ML-CII-FR-0004
PREDECESSOR_ENDPOINT: EP-CII-FR-0022
PREDECESSOR_MATERIAL_LEG: ML-CII-FR-0003
PR: 1081
BRANCH: feature/cii-find-replace-finish-v14
BASE_MAIN: bfe3abbb67060c1212001f2e9d967c229a057640
PRE_U2_PRODUCT_MATERIAL_HEAD: 4f9e79fc899fd5e89c33267480208e25f8d627da
PRODUCT_MATERIAL_HEAD: 09c7c1aab70fab5d918065d11b557050205b97f0
EVIDENCE: agents/evidence/PR1081_universal_field_u2_exact_execution.md

## Owner authority

Owner `proceed next` from EP-CII-FR-0021 authorized one bounded U2 field-aware mutation progression. Merge authority remains Owner-only and `MERGE_AUTHORIZED=FALSE`.

## Material delta

```text
NEW     tabs/cii-workspace/cii-workspace-find-replace-v14-field-authority.js
NEW     tabs/cii-workspace/cii-workspace-find-replace-v14-field-claims.js
MODIFY  tabs/cii-workspace/cii-workspace-find-replace-scope-resolver.js
MODIFY  tabs/cii-workspace/cii-workspace-find-replace-validator.js
MODIFY  tests/cii-workspace-find-replace-scope-resolver.test.js
NEW     tests/cii-workspace-find-replace-v14-field-authority.test.js
```

## Delivered behavior

U2 adds field-level mutation authority after U1 proves record ownership.

### Element

Field-aware validation now permits mutation only inside valid mutable Element fields:

- rows 1-9: numeric fields, except FROM/TO selector fields on row 1;
- Element Name text payload only;
- Line Number text payload only;
- Line Color/Visibility numeric fields;
- all three IEL pointer rows are validated but expose zero mutation spans.

Thus generic Element Find & Replace cannot mutate topology selector identity or auxiliary ownership pointers.

### Auxiliary blocks

For BEND/RIGID/EXPJT/RESTRANT/DISPLMNT/UNIFORM/WIND/OFFSETS/ALLOWBLS/SIF&TEES/REDUCERS/FLANGES/EQUIPMNT, field-aware validation first reuses U1:

```text
exact From/To element
-> IEL pointer
-> CONTROL count
-> section cardinality
-> unique reverse owner
-> exact record
```

Only then are valid record fields exposed.

Numeric claims remain within one fixed numeric field and the complete numeric field must remain finite/parseable after replacement. Length-prefixed text exposes only the text payload. FLANGES A40 exposes only its text content and meaningful blank rows remain preserved.

### Compatibility and protected paths

- default/raw resolver calls retain U1 behavior; generic auxiliary raw resolution remains mutation-blocked;
- the validator explicitly opts into field-aware mutation authority;
- Node Name still uses its existing specialized resolver/whole-field claim plan;
- Displacement endpoint validation remains intact;
- FORCE/FORCMNT remains blocked;
- executor/output custody, Writer1/Writer2, parser/converter, workflows and direct overwrite are unchanged.

## Exact-source validation

Remote blob closure matched the executed source set.

Observed focused run:

```text
19 PASS
0 FAIL
0 SKIP
```

Evidence: `agents/evidence/PR1081_universal_field_u2_exact_execution.md`.

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

## Remaining boundary

U2 is backend field-aware authority. The user-facing CSV/manual/UI block list is still Node Name + Displacement only.

The next phase should be evidence-led rather than UI expansion: execute retained-real/native-v14 U3 coverage against available archived v14 records for families such as BEND, RIGID, RESTRANT, SIF&TEES and REDUCERS, while keeping synthetic coverage for families without retained-real specimens.

Do not promote retained-real/native-v14 or external CAESAR gates without actual execution.
