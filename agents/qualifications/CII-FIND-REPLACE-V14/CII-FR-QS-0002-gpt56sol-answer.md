# CII-FR-QS-0002 — universal auxiliary U1 candidate answer

CHAIN_ID: CII-FIND-REPLACE-V14
PR: 1081
QUESTION_SET_ID: CII-FR-QS-0002
QUALIFICATION_SCOPE_ID: QSCOPE-PR1081-UNIVERSAL-AUX-U1
QUALIFICATION_BASIS_HEAD: 136149b2c0becf13d186c366e67cbb985511a725
PRODUCT_MATERIAL_HEAD: 43761321967387130988590bc61877a79b632c37
CANDIDATE_ID: GPT-5.6-SOL-2026-09-02-B
CANDIDATE_AUTHORIZATION_CLAIM: NONE
VERIFIER_REQUIRED: TRUE
SELF_VERIFICATION_ALLOWED: FALSE

## Scope being qualified

This question set is intentionally narrow. It qualifies only the U1 read-only ownership layer for element-owned CII v14 auxiliary records and the focused tests for that layer.

In scope after an independent PASS:

- a new immutable v14 auxiliary authority registry;
- common IEL pointer extraction from exact 15-row ELEMENTS blocks;
- CONTROL cardinality correlation;
- exact physical-section extraction preserving blank payload rows;
- reverse pointer-owner reconstruction;
- generic read-only record resolution for qualified auxiliary families;
- refactoring DISPLACEMENT to consume the common ownership/cardinality primitives while preserving its endpoint identity checks;
- focused resolver tests.

Explicitly out of scope:

- NODENAME behavior or validator logic changes;
- FORCE/FORCMNT mutation or qualification;
- generic field mutation/claim generation (U2);
- CSV/manual/UI expansion (later phase);
- executor/output custody;
- Writer1/Writer2;
- parser/converter mutation;
- benchmark/oracle/workflow mutation;
- topology or pointer/cardinality writes;
- merge authority.

## Q1 — Production Trace

Current Find & Replace operation custody is:

```text
CSV/manual operation
 -> preview/approval
 -> validateFindReplacePreimage()
 -> resolveFindReplaceScope()
 -> TARGET0-relative physical claims
 -> buildValidatedFindReplacePostimage()
 -> independent postimage validation
 -> qualified TARGET1
 -> Apply-to-new-copy / download receipt
```

The current BLOCK resolver has three explicit paths:

1. `NODENAME` -> `resolveNodeNameScope()`;
2. `DISPLACEMENT` / `DISPLMNT` -> `resolveDisplacement()`;
3. `FORCE` / `FORCMNT` -> fail-closed `resolveForce()`.

All other blocks return `BLOCK_SCOPE_UNSUPPORTED:*`.

The present DISPLACEMENT path independently:

- binds one exact `From -> To` 15-row element;
- reads zero-based element row 12, field 4 as the DISPLMNT pointer;
- requires a positive integer pointer;
- slices a 20-row DISPLMNT block;
- checks endpoint identity from the first rows of the two displacement specifications.

Its weakness for the expanded architecture is that it derives block count from `sectionRows / 20` rather than correlating the section with CONTROL. A malformed file can therefore be internally divisible by 20 while disagreeing with the declared CONTROL count.

NODENAME is already stronger and separate: its dedicated module correlates CONTROL NONAM, the exact NODENAME pointer, physical row cardinality, and reverse field ownership. U1 must not rewrite or weaken that logic.

The correct universal auxiliary trace for U1 is:

```text
From + To
 -> exact unique ELEMENTS block
 -> requested auxiliary spec
 -> common IEL pointer reader
 -> matching CONTROL declared count
 -> exact physical target section
 -> require sectionRows == controlCount * v14RowsPerRecord
 -> require 1 <= pointer <= controlCount
 -> reconstruct all element owners of that pointer
 -> reject shared pointer for element-specific custody
 -> expose only exact pointer-owned record refs
```

The first wrong boundary if U1 maps the wrong data is the new auxiliary ownership resolver, not the executor.

## Q2 — Current Unresolved Problem / Failure Isolation

The unresolved problem is not literal replacement. The existing validator/executor can already consume TARGET0-relative equal-width claims. The unresolved problem is proving which physical auxiliary record belongs to one selected element for block families beyond NODENAME and DISPLACEMENT.

The v14 element format uses three 6I13 pointer rows at physical element rows 13-15. The 15 pointer positions are:

```text
IEL1  BEND       row13 field1
IEL2  RIGID      row13 field2
IEL3  EXPJT      row13 field3
IEL4  RESTRANT   row13 field4
IEL5  DISPLMNT   row13 field5
IEL6  FORCMNT    row13 field6
IEL7  UNIFORM    row14 field1
IEL8  WIND       row14 field2
IEL9  OFFSETS    row14 field3
IEL10 ALLOWBLS   row14 field4
IEL11 SIF&TEES   row14 field5
IEL12 NODENAME   row14 field6
IEL13 REDUCERS   row15 field1
IEL14 FLANGES    row15 field2
IEL15 EQUIPMNT   row15 field3
```

This can be implemented with one zero-based pointer-index rule:

```text
rowIndex   = 12 + floor(pointerIndex / 6)
fieldIndex = pointerIndex % 6
```

The matching CONTROL cardinality map is:

```text
BEND       CONTROL row2 field1
RIGID      CONTROL row2 field2
EXPJT      CONTROL row2 field3
RESTRANT   CONTROL row2 field4
DISPLMNT   CONTROL row2 field5
FORCMNT    CONTROL row2 field6
UNIFORM    CONTROL row3 field1
WIND       CONTROL row3 field2
OFFSETS    CONTROL row3 field3
ALLOWBLS   CONTROL row3 field4
SIF&TEES   CONTROL row3 field5
NODENAME   CONTROL row1 field4 (NONAM)
REDUCERS   CONTROL row1 field5 (NORED)
FLANGES    CONTROL row1 field6 (NUMFLG)
EQUIPMNT   CONTROL row4 field1
```

The v14 rows-per-record profile to use for U1 is:

```text
BEND        3
RIGID       1
EXPJT       1
RESTRANT   24
DISPLMNT   20
FORCMNT    20 (known structure but owner-de-scoped for Find & Replace)
UNIFORM     6
WIND        1
OFFSETS     1
ALLOWBLS   28
SIF&TEES   14
NODENAME    1 (existing special resolver)
REDUCERS    2
FLANGES    12
EQUIPMNT    6
```

Version-specific deltas matter: repository v11/2019-era rules contain legacy ALLOWBLS=26, SIF&TEES=10 and REDUCERS=1 values; the v14 converter/validator independently establishes 28, 14 and 2. U1 must never import the legacy table as v14 authority.

Minimum falsifiers:

1. pointer `0` -> BLOCK;
2. pointer greater than CONTROL count -> BLOCK;
3. section physical row count differs from `CONTROL count * rowsPerRecord` -> BLOCK;
4. malformed/non-integral pointer -> BLOCK;
5. duplicate exact `From -> To` element -> BLOCK;
6. two distinct elements owning the same positive pointer for the requested family -> `AUX_POINTER_SHARED` / BLOCK;
7. unexpected comment rows that make fixed-record indexing ambiguous -> BLOCK;
8. FORCE/FORCMNT -> BLOCK regardless of otherwise-valid pointer/cardinality.

The retained native-v14 benchmark evidence already demonstrates real record cardinalities including `112 x 15 ELEMENTS`, `40 x 24 RESTRANT`, `2 x 14 SIF&TEES`, `1 x 2 REDUCERS`, plus real BEND, RIGID and NODENAME payloads. This is source evidence, not a claim that U1 runtime has executed against the archived v14 member.

## Q3 — Authority / Invariant

Positive authority sources:

1. CAESAR II v14 neutral-file format documentation:
   - exact 15 auxiliary IEL positions in the ELEMENTS record;
   - CONTROL count order;
   - auxiliary record shapes/cardinalities.

2. `converters/scripts/cii-v11-v14-upstream/cii_v11_v14_validate.py`:
   - independent repository v14 structure gate;
   - CONTROL-derived section cardinality;
   - v14 deltas ALLOWBLS=28, SIF&TEES=14, REDUCERS=2.

3. `converters/scripts/cii-v11-v14-upstream/cii_v11_v14_records.py`:
   - v14-specific ALLOWBLS/SIF&TEES/REDUCERS record transformations and row counts.

4. `docs/cii-writer2-v14-native-benchmark-change-isolation-2026-08-26.md`:
   - retained native-v14 physical profile with 15-row elements and real auxiliary record counts.

5. `tabs/cii-workspace/cii-workspace-find-replace-nodename-scope.js`:
   - existing Find & Replace precedent for pointer + CONTROL + owner reconstruction;
   - not to be modified in U1.

6. `tabs/cii-workspace/cii-workspace-v14-writer2-fixed-field-authority.js`:
   - corroborating read authority for NODENAME/RESTRANT/SIF pointer and cardinality identities;
   - Writer2 mutation authority is explicitly not borrowed.

Protected invariants:

```text
TARGET0 overwrite                       DISABLED
Direct Apply-to-source                  DISABLED
Writer1/Writer2 invocation              NONE
FORCE/FORCMNT                           DE_SCOPED
NODENAME resolver/validator             UNCHANGED
DISPLACEMENT endpoint identity checks   PRESERVED
CONTROL values                          READ_ONLY
ELEMENT IEL pointer values              READ_ONLY
section cardinality                     READ_ONLY
executor/output custody                 UNCHANGED
line endings                            NEVER AUTHORIZED AS SEARCH SPANS
NOT_RUN evidence                        MUST REMAIN NOT_RUN
MERGE                                  OWNER_ONLY / NOT AUTHORIZED
```

A pointer is reference authority, not mutation authority. U1 may read pointers and counts only. It may not clone records, repoint elements, alter CONTROL, or solve shared ownership by structural mutation.

## Q4 — Independent Validation

A verifier should independently reconstruct at least these facts from repository sources rather than trusting the candidate table:

1. `ELEMENTS` has exact 15-row canonical blocks.
2. DISPLACEMENT currently uses element row12 zero-based / field4 zero-based, corresponding to IEL5.
3. NODENAME currently uses element row13 zero-based / field5 zero-based, corresponding to IEL12.
4. `cii_v11_v14_validate.py` maps CONTROL counts to BEND/RIGID/EXPJT/RESTRANT/DISPLMNT/FORCMNT/UNIFORM/WIND/OFFSETS/ALLOWBLS/SIF&TEES/REDUCERS/FLANGES/EQUIPMNT and validates `count * rowsPerBlock`.
5. v14 ALLOWBLS/SIF&TEES/REDUCERS are 28/14/2, not 26/10/1.
6. the native-v14 benchmark document observes `1680 = 112 x 15 ELEMENTS`, `960 = 40 x 24 RESTRANT`, `28 = 2 x 14 SIF&TEES`, and `2 = 1 x 2 REDUCERS`.
7. the NODENAME resolver already performs CONTROL correlation and reverse-owner reconstruction, proving that this custody pattern is established in Find & Replace.

Proposed U1 synthetic test construction should use canonical fixed-field rows and a real CONTROL section. For one generic family such as BEND:

```text
CONTROL BEND count = 2
selected element IEL1 = 2
BEND section rows = 6
```

Expected result:

```text
status      PASS
pointer     2
recordIndex 1
rowCount    3
spans/refs  exact BEND payload rows 4..6 only
owners      exactly selected element
```

Negative variants must independently falsify zero pointer, count mismatch, out-of-range pointer and shared pointer.

For DISPLACEMENT, U1 should prove the same currently-valid 20-row record still resolves after common-plumbing refactor and that the existing endpoint mismatch blocker remains effective.

For NODENAME, no implementation change is expected; the focused regression must prove the same pointer/field evidence and claims before and after U1.

Evidence truth after qualification remains:

```text
Current PR exact-source UI/static closure       PASS 10/10
Merged non-benchmark Find & Replace             PASS 33/33
Merged focused Node Name                       PASS 4/4
SOURCE 3 retained-real authored runtime         NOT_RUN
Full repository suite                           NOT_RUN
Native-v14 archived fixture runtime             NOT_RUN
External CAESAR acceptance                      NOT_RUN
```

No source inspection or design reconstruction upgrades a NOT_RUN runtime gate to PASS.

## Q5 — Next Contribution / Minimal Patch

Smallest U1 material patch after an independent `PASS_WRITE_ALLOWED`:

### New production file

`tabs/cii-workspace/cii-workspace-find-replace-v14-aux-authority.js`

Responsibilities only:

- immutable `V14_AUX_BLOCKS` registry;
- fixed integer reader for CONTROL/IEL fields;
- common `readAuxPointer()`;
- common `readAuxControlCount()`;
- exact `physicalSectionRefs()` preserving blank rows;
- `buildAuxPointerOwners()`;
- `resolveOwnedAuxRecord()` with pointer/cardinality/shared-owner fail-closed gates.

### Existing production file

`tabs/cii-workspace/cii-workspace-find-replace-scope-resolver.js`

Minimal changes:

- import the U1 authority helper;
- route qualified generic auxiliary names to the common read-only resolver;
- refactor DISPLACEMENT pointer/cardinality plumbing to the common resolver while retaining `validateDisplacementIdentity()` unchanged in semantics;
- keep NODENAME dispatch exactly routed to `resolveNodeNameScope()`;
- keep FORCE/FORCMNT fail-closed.

No generic validator mutation is required in U1; U1 establishes ownership only. Unsupported generic block intake/UI can remain blocked until later phases.

### Focused tests

`tests/cii-workspace-find-replace-scope-resolver.test.js`

Add:

- generic BEND pointer/cardinality success;
- RIGID single-row success;
- RESTRANT 24-row success;
- ALLOWBLS v14 28-row success and legacy-26 mismatch blocker;
- SIF&TEES v14 14-row success and legacy-10 mismatch blocker;
- REDUCERS v14 2-row success and legacy-1 mismatch blocker;
- FLANGES blank physical row preservation;
- EQUIPMNT 6-row success;
- pointer zero;
- pointer out of CONTROL range;
- CONTROL/section cardinality mismatch;
- malformed pointer;
- shared pointer;
- unexpected fixed-record comment ambiguity;
- FORCE remains blocked;
- existing DISPLACEMENT identity behavior remains unchanged;
- NODENAME regression remains unchanged.

Expected unchanged paths in U1:

```text
tabs/cii-workspace/cii-workspace-find-replace-nodename-scope.js
tabs/cii-workspace/cii-workspace-find-replace-validator.js
tabs/cii-workspace/cii-workspace-find-replace-executor.js
tabs/cii-workspace/cii-workspace-find-replace-output.js
tabs/cii-workspace/cii-workspace-find-replace-csv.js
tabs/cii-workspace/cii-workspace-find-replace-ui.js
Writer1 / Writer2
parser/converter sources
benchmarks/oracles
workflows
```

Stop conditions:

- any contradiction in IEL position, CONTROL count mapping or v14 row cardinality;
- inability to preserve physical blank rows exactly;
- shared-pointer policy cannot be enforced without structural mutation;
- common Displacement plumbing changes its established endpoint behavior;
- NODENAME results differ despite no authorized NODENAME change;
- independent verifier unavailable or verdict not PASS.

## Candidate conclusion

U1 is technically isolated and does not require mutation authority over auxiliary payload fields. It establishes a reusable, fail-closed `element -> pointer -> CONTROL -> exact physical record` ownership layer. The candidate requests no write authority for U2 mutation, UI/CSV expansion, FORCE, NODENAME changes, Writer1/Writer2, merge, or any unrelated repository area.
