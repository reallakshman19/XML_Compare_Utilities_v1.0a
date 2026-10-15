# Writer 2 W2.5 — HANGER CREATE construction qualification

## 1. Final engineering verdict

```text
NOT_READY_FOR_WRITER2_HANGER_CREATE_IMPLEMENTATION
```

This document qualifies the HANGER CREATE source boundary for Issue #1034 / PR #1037.

It does **not** authorize a production HANGER CREATE writer.

```text
BASE_MAIN
  e5d3420f78794e465b4b8c7f858c3fc53baf3039

EXISTING PRODUCTION BLOCKER
  WRITER_2_HANGER_CREATE_PAYLOAD_SEMANTICS_NOT_QUALIFIED

EXISTING RECORD-BINDING SEMANTIC AUTHORITY
  NONE_POSITIONAL_PHYSICAL_CUSTODY_ONLY
```

The qualification materially improves the source position: the CAESAR II 2019 / Version 11 User's Guide names the HANGER neutral-file fields and formats in detail. The remaining blocker is therefore **not** a blanket lack of field names. It is incomplete CREATE construction authority for values that a new record must synthesize, especially software-assigned identity and model-global/default data.

---

## 2. Source hierarchy and evidence classes

The evidence hierarchy used here is:

```text
1. Hexagon-authored CAESAR II 2019 (11.0) User's Guide
   exact-version document mirrored by a third party
   -> VENDOR_AUTHORED_MIRROR_EXACT_V11

2. Official Hexagon CAESAR II Version 12 online help
   -> OFFICIAL_HEXAGON_V12_CORROBORATION

3. Repository protected converter / section rules
   -> REPOSITORY_PROTECTED_CONVERTER

4. Existing merged Writer2 positional/delete qualifications
   -> MERGED_POSITIONAL_PHYSICAL_AUTHORITY

5. Repository .CII observations
   -> OBSERVED_REAL_REPOSITORY_SOURCE or OBSERVED_REPOSITORY_PROFILE
```

Observed values are not promoted to semantic/default authority.

Repository converter fallbacks are implementation policy unless independently supported by vendor documentation.

---

## 3. Exact V11 HANGER neutral-file schema now qualified

The CAESAR II 2019 (11.0) User's Guide, External Interfaces, Hangers section (User's Guide pages 1158–1159), establishes the following neutral-file structure.

### 3.1 Global/default line 1

```text
FORTRAN: (2X, I13, 5G13.6)

IDFTABLE      default hanger table
DEFVAR        default allowed load variation
DEFRIG        default rigid support displacement criteria
DEFMXTRAVEL   default maximum allowed travel
DEFSHTSPR     default allow-short-range flag: 0=no, 1=yes
DEFMUL        default multi-load-case design option
```

### 3.2 Global/default line 2

```text
FORTRAN: (2X, 5I13)

IDFOPER       default number of hanger design operating cases; always 1
IACTCLD       default cold-load calculation switch: 0=no, 1=yes
IHGRLDS       number of hanger operating loads: 0..3
IACTUAL       load case defining actual cold loads
IMULTIOPTS    multi-load-case design option: 1..7
```

### 3.3 IHGRNODE

```text
FORTRAN: (2X, 6I13)
one hanger node number for each HANGER record
```

### 3.4 HGRDAT

```text
11 values per HANGER
2 physical rows per HANGER
FORTRAN: (2X, 6G13.6)
```

| Position | V11 meaning |
|---:|---|
| 1 | Hanger stiffness |
| 2 | Allowable load variation |
| 3 | Rigid support displacement criteria |
| 4 | Allowed space for hanger |
| 5 | Cold load #1, theoretical |
| 6 | Hot load #1 — V11 says initialize to `0.0` |
| 7 | User-defined operating load for variable springs — V11 says initialize to `0.0` |
| 8 | Maximum allowed travel limit |
| 9 | Multiple load case design option |
| 10 | Hanger hardware weight |
| 11 | Constant effort support load, CEFF |

V11 also states that uninitialized values representing infinity, including maximum travel and available space, are represented as:

```text
9999.99
```

This is source authority for the neutral sentinel representation of those infinite/uninitialized concepts. It is not authority to replace a real finite engineering value with `9999.99`.

### 3.5 TAG and GUID

```text
FORTRAN: (7X, I5, 1X, A100)
2 rows per HANGER:
  Hanger Tag
  Hanger GUID

length prefix = actual string length
blank string  = length 0
```

The CAESAR II 2019 Piping Input Reference separately states that the hanger GUID is **software-assigned** and is display-only in the Hangers list input.

That distinction is critical for CREATE.

### 3.6 IHGRFREE

One row per HANGER:

```text
FORTRAN: (2X, 6I13)

1  anchor node to be freed #1
2  anchor node to be freed #2
3  DOF type #1
4  DOF type #2
```

V11 defines DOF type #1 as:

```text
1 = free Y
2 = free XY
3 = free ZY
4 = free X,Y,Z
5 = free all
```

### 3.7 Other positional arrays

```text
IHGRNUM    number of hangers at this location
IHGRTABLE  hanger table number
IHGRSHORT  short-range permission: 0=cannot use, 1=can use
IHGRCN     connecting node number
```

Each is a one-entry-per-HANGER array using `(2X,6I13)` packed rows.

### 3.8 Official later-version corroboration

Official Hexagon Version 12 online help repeats the same field structure, formats and meanings, including HGRDAT positions, TAG/GUID length encoding, IHGRFREE, IHGRNUM, IHGRTABLE, IHGRSHORT and IHGRCN.

Version 12 is used as corroboration only. It is not substituted for exact V11 authority where edition-dependent behavior could matter.

---

## 4. Existing merged physical authority consumed without semantic overreach

Merged PR1024/PR1025/PR1027 authority already proves the physical relationship:

```text
record i
  ├── IHGRNODE[i]
  ├── HGRDAT/TAG/GUID record i
  ├── IHGRFREE row i
  ├── IHGRNUM[i]
  ├── IHGRTABLE[i]
  ├── IHGRSHORT[i]
  └── IHGRCN[i]
```

and the active-fields-only packed-array shape:

```text
prefix          2 bytes
field width     13 bytes
fields/row      6
final row       active fields only
```

This remains:

```text
semanticAuthority = NONE_POSITIONAL_PHYSICAL_CUSTODY_ONLY
```

That is sufficient to retain/delete opaque existing records. It is insufficient to decide values for a new record.

---

## 5. Repository converter evidence — useful, but not universal CREATE authority

`converters/scripts/cii2019_hanger_miscel_control.py` explicitly maps InputXML hanger attributes to the V11-style physical arrays and emits:

```text
IHGRNODE
HGRDAT[11]
TAG
GUID
IHGRFREE[4]
IHGRNUM
IHGRTABLE
IHGRSHORT
IHGRCN
```

It also provides deterministic physical formatting:

```text
I13 integer fields
G13.6 real fields
A100 string rows with a length prefix
active-only packed rows
INTERLEAVED HGRDAT/TAG/GUID emission per hanger
CONTROL.NOHGRS = emitted hanger count
```

This is strong implementation/formatting evidence.

However, its fallback profile is explicitly a fallback when a complete profile is unavailable. Fallback values therefore remain repository policy unless separately vendor-qualified.

A second repository path, `cii2019_miscel_hardener.py`, exposes an important conflict:

```text
synchronizer fallback IHGRNUM template    = 0
hardener default NUM_HGR                  = 1

synchronizer fallback IHGRSHORT template  = 0
hardener/XML default short-range          = 1

synchronizer fallback DEFMUL              = 1
hardener emitted DEFMUL                   = 0
```

This conflict is direct evidence that repository fallback values cannot be treated as a single canonical vendor CREATE contract.

The hardener also states that, when a valid `MISCEL_1` already exists, rebuilding it from InputXML can lose execution options, hanger ordering, and other fields not recoverable from InputXML alone. That observation reinforces the fail-closed boundary.

---

## 6. CREATE authority by field class

Detailed custody is in `docs/cii-writer2-hanger-create-field-map.csv`.

The important classification is:

### 6.1 Directly constructible when an explicit qualified value exists

Examples:

```text
IHGRNODE
HGRDAT positions with an explicit engineering value
TAG
IHGRFREE values
IHGRNUM
IHGRTABLE
IHGRSHORT
IHGRCN
```

This statement means the field meaning and physical format are known. It does **not** authorize silently choosing a default when an explicit value is absent.

### 6.2 V11 provides a direct initialization/sentinel rule

```text
HGRDAT[6] hot load #1                         initialize to 0.0
HGRDAT[7] variable-spring operating load      initialize to 0.0
uninitialized infinite available space        9999.99
uninitialized infinite maximum travel         9999.99
IDFOPER                                        always 1
```

These rules are source-qualified for their stated contexts.

### 6.3 Target-global/default fields

The two header rows are model/global hanger design defaults. V11 names the fields but does not provide one universal numeric value for every model.

Therefore:

```text
TARGET H > 0
  preserving the exact existing two header rows is physically safe
  for an additive transaction, subject to the rest of CREATE being qualified.

TARGET H = 0
  there is no target HANGER header preimage to preserve.
  complete first-hanger header synthesis remains unresolved unless an
  independently qualified source/default contract is provided.
```

### 6.4 GUID

V11 says the hanger GUID is software-assigned and display-only.

The neutral-file format proves that a blank GUID string has a syntactically representable encoding, but the available source does **not** establish that:

```text
blank GUID on neutral-file import
  -> is legal for a newly created hanger
  -> causes CAESAR II to assign a fresh GUID
```

Nor does the source publish an algorithm by which an external Writer may generate a CAESAR-equivalent GUID.

Therefore:

```text
GUID_SOFTWARE_ASSIGNED_CREATE_RULE_UNRESOLVED
```

is a hard CREATE blocker.

Copying a SOURCE model's GUID into TARGET is not authorized: a software-assigned object identity cannot be assumed transferable between model objects without explicit source authority.

---

## 7. Record ordering / insertion qualification

Existing physical files have two qualified multi-record shapes:

```text
INTERLEAVED
  HGRDAT1[i]
  HGRDAT2[i]
  TAG[i]
  GUID[i]
  ... next record

GROUPED
  all HGRDAT rows
  then all TAG/GUID rows
```

Delete authority preserves the target's existing class.

The V11 manual describes TAG and GUID as following each hanger specification and being repeated for each hanger. The repository synchronizer likewise emits INTERLEAVED records. This supports INTERLEAVED as the documented/emitted V11 construction shape.

However, no direct source examined in W2.5 establishes a canonical **record-index insertion policy** such as:

```text
append at end
sort by hanger node
sort by free anchor/support node
preserve SOURCE order
```

The repository synchronizer sorts by:

```text
(free_anchor1 if > 0 else node, node)
```

but that is repository converter policy, not a stated neutral-file requirement.

Therefore:

```text
NEW_HANGER_RECORD_INSERTION_POLICY_UNRESOLVED
```

remains a hard blocker for a general Writer2 CREATE transaction.

For H=0 -> 1 the tail order itself is `SINGLE_RECORD_ORDER_EQUIVALENT`, but the global header and GUID gates still block first-record synthesis.

---

## 8. Packed-array CREATE arithmetic is structurally qualified

For `H > 0`:

```text
packedRows(H) = ceil(H/6)

hangerRows(H)
  = 2
  + packedRows(H)        // IHGRNODE
  + 4*H                  // HGRDAT1,HGRDAT2,TAG,GUID
  + H                    // IHGRFREE
  + 4*packedRows(H)      // IHGRNUM,TABLE,SHORT,CN

  = 2 + 5*H + 5*ceil(H/6)
```

CREATE changes `H -> H+1`.

Critical boundaries:

```text
H=6  -> 7
  before = 2 + 5*6  + 5*1 = 37
  after  = 2 + 5*7  + 5*2 = 47
  delta  = +10 rows

H=12 -> 13
  before = 2 + 5*12 + 5*2 = 72
  after  = 2 + 5*13 + 5*3 = 82
  delta  = +10 rows
```

The extra five rows are the new packed row in each of:

```text
IHGRNODE
IHGRNUM
IHGRTABLE
IHGRSHORT
IHGRCN
```

This arithmetic is safe to hand to W2.6 once the semantic construction gates are resolved.

---

## 9. CONTROL and `MISCEL_1` structural transition

Source/repository physical authority supports:

```text
CONTROL.NOHGRS: H -> H+1
```

and complete governed `MISCEL_1` row-count reconstruction.

A future writer must still use one untouched TARGET0 and preserve, byte-for-byte, all non-HANGER content including:

```text
RRMAT
VFLEX
target-global hanger header rows when H>0 and the transaction does not
  explicitly carry separately qualified authority to change them
execution option rows
all unrelated CII sections
```

`NUMNOZ > 0` is not inherently incompatible with Writer2 CREATE, but the repository synchronizer itself refuses to synthesize VFLEX. A future Writer2 transaction must preserve TARGET0 VFLEX rather than route through a converter fallback.

---

## 10. Required future transaction classes

W2.6 should not begin until source authority can distinguish at least these cases:

```text
ADD_TO_EXISTING_HANGER_REGION
  TARGET H > 0
  preserve exact target header/default rows
  preserve unrelated RRMAT/VFLEX/execution bytes
  construct one new record from qualified source values
  resolve new-record index/order
  resolve GUID

CREATE_FIRST_HANGER_REGION
  TARGET H = 0
  synthesize both hanger header/default rows
  construct first record
  resolve GUID
  CONTROL.NOHGRS 0 -> 1
  create complete HANGER region at the qualified MISCEL_1 position
```

The second class has a strictly larger semantic burden because no target header/default preimage exists.

This split is a recommended future qualification boundary, not production authority.

---

## 11. Hard blockers that force NOT_READY

```text
B01 GUID_SOFTWARE_ASSIGNED_CREATE_RULE_UNRESOLVED
  V11 says GUID is software-assigned/display-only.
  No source proves a legal external generation algorithm or blank-on-import
  assignment behavior for a new neutral-file HANGER.

B02 FIRST_HANGER_HEADER_DEFAULTS_UNRESOLVED
  V11 names model-global/default fields but does not prescribe one universal
  complete numeric header for every new model/HANGER context.

B03 REPOSITORY_FALLBACK_DEFAULT_CONFLICT
  local converter/hardener fallback values disagree for fields including
  IHGRNUM, IHGRSHORT and DEFMUL.

B04 NEW_HANGER_RECORD_INSERTION_POLICY_UNRESOLVED
  no examined V11 source requires append/node-sort/support-node-sort/source-order.

B05 OMITTED_PER_HANGER_DEFAULTS_NOT_COMPLETE
  field meanings are known, but a universal omission/default rule is not
  source-qualified for every HGRDAT/IHGRFREE/IHGRNUM/IHGRTABLE/IHGRSHORT/IHGRCN
  position.

B06 REAL_NATIVE_CREATE_TRANSITION_NOT_AVAILABLE
  repository contains H=1 and H=0 files but no qualified native H=0->1 or
  H=1->2 CREATE before/after pair proving GUID/default/order behavior.
```

Any one of B01-B05 is enough to keep generic Writer2 HANGER CREATE blocked.

---

## 12. What is explicitly not authorized

```text
DO NOT invent a GUID algorithm.
DO NOT copy a SOURCE hanger GUID into TARGET as object identity.
DO NOT choose converter fallback values merely because they produce parseable CII.
DO NOT treat numeric zero, blank, missing and 9999.99 as interchangeable.
DO NOT derive a universal new-record sort order from one repository emitter.
DO NOT use DELETE positional custody as engineering CREATE semantics.
DO NOT weaken WRITER_2_HANGER_CREATE_PAYLOAD_SEMANTICS_NOT_QUALIFIED.
DO NOT start W2.6 from this qualification result.
```

---

## 13. Source acquisition required to unlock W2.6

The minimum useful next evidence is:

1. **GUID CREATE behavior**
   - Hexagon statement/documentation that a blank GUID in an imported neutral HANGER is legal and receives a fresh software-assigned GUID; or
   - another vendor-authorized creation rule.

2. **Native first-hanger transition**
   - CAESAR II native/exported H=0 baseline;
   - same model after creating exactly one hanger;
   - exact `MISCEL_1` and CONTROL bytes;
   - global header/default values and GUID behavior documented.

3. **Native add-second-hanger transition**
   - exact H=1 -> H=2 native before/after pair;
   - demonstrates record insertion ordering and treatment of existing global headers.

4. **Default provenance**
   - source-qualified rule for every value that may be omitted from a CREATE request, or an implementation contract that requires the value explicitly and fails closed if absent.

No synthetic fixture can substitute for vendor/native authority for these semantic questions.

---

## 14. Machine-checkable W2.5 sentinel

`tests/cii-workspace-writer2-hanger-create-qualification.test.js` is intentionally a qualification sentinel, not a production writer test.

It asserts, from checked-in qualification artifacts, that:

```text
required HANGER field families are mapped
V11 structural row arithmetic is frozen
H=6->7 delta is +10
H=12->13 delta is +10
repository census contains no H>1 source
hard blockers B01-B06 remain recorded
production CREATE blocker remains present
final verdict remains NOT_READY
```

Until executed in a complete checkout its evidence class is:

```text
AUTHORED / NOT_RUN_ENVIRONMENT
```

---

## 15. Evidence truth

```text
exact V11 manual provenance/version identity
  PASS_VENDOR_AUTHORED_EXACT_VERSION_MIRROR

V11 HANGER neutral field dictionary/formats
  PASS_VENDOR_AUTHORED_EXACT_VERSION_MIRROR

V11 GUID is software-assigned/display-only
  PASS_VENDOR_AUTHORED_EXACT_VERSION_MIRROR

official Hexagon V12 schema corroboration
  PASS_OFFICIAL_HEXAGON_CORROBORATION

repository synchronizer physical mapping/formatting
  PASS_SOURCE_INSPECTION

repository fallback-default conflict
  PASS_SOURCE_INSPECTION

merged positional/delete authority
  PASS_MERGED_AUTHORITY_INSPECTION

repository HANGER source metadata census
  PASS_SOURCE_INSPECTION

real repository H>1 HANGER source
  NOT_AVAILABLE

native H=0->1 CREATE transition
  NOT_AVAILABLE

native H=1->2 CREATE transition
  NOT_AVAILABLE

GUID neutral CREATE assignment rule
  UNRESOLVED

complete first-hanger global/default synthesis
  UNRESOLVED

canonical new-record insertion policy
  UNRESOLVED

qualification sentinel runtime
  NOT_RUN_ENVIRONMENT

production HANGER CREATE
  BLOCKED / UNCHANGED
```

---

## 16. Final disposition

```text
W2.5 FIELD DICTIONARY
  SUBSTANTIALLY QUALIFIED

W2.5 PHYSICAL ROW/CARDINALITY MODEL
  QUALIFIED

W2.5 GENERIC CREATE CONSTRUCTION CONTRACT
  INCOMPLETE

FINAL VERDICT
  NOT_READY_FOR_WRITER2_HANGER_CREATE_IMPLEMENTATION

W2.6 PLANNER + PHYSICAL WRITER
  NOT AUTHORIZED
```

The next valid engineering action for HANGER CREATE is source/native-transition acquisition and qualification, not production coding.
