# Writer2 CREATE source-authority refresh — CAESAR II Version 11 only — 2026-08-25

## Status

```text
PR = #1055
BASE_MAIN = 297fb37a0e894a3aac91de9188ebf30e810781fb
AUTHORITY_EDITION = CAESAR II 2019 / Version 11.0 ONLY
NEUTRAL_INTERFACE_SCOPE = VERSION 11.00
LATER_EDITION_AUTHORITY = EXCLUDED
MODE = SOURCE_ACQUISITION_REFRESH_ONLY
PRODUCTION_CREATE_AUTHORITY = FALSE
```

This record answers one narrow question: **does CAESAR II Version 11 alone provide enough source authority to synthesize the complete physical bytes for a new Writer2 SIF, HANGER, or RESTRAINT record/block?**

Authority rule:

```text
exact V11 vendor-authored material       may qualify V11 semantics
real V11 neutral files                   may qualify observed physical facts only
repository converter/default behavior    is repository policy unless vendor-sourced
V12/V14/current-version documentation    is NOT V11 CREATE authority
later-edition field meanings/defaults    MUST NOT fill V11 gaps
```

Final V11-only result:

```text
SIF CREATE       SOURCE_BLOCKED_REAFFIRMED_V11
HANGER CREATE    SOURCE_BLOCKED_REAFFIRMED_V11
RESTRAINT CREATE SOURCE_BLOCKED_REAFFIRMED_V11
PRODUCTION CREATE CHANGE = NONE
```

---

## 1. SIF / TEE CREATE — V11 authority

### V11 sources

Repository ledger:

```text
docs/cii-writer1c-sif-source-ledger.csv
```

Exact Version 11 vendor-authored authority retained by that ledger includes:

```text
CAESAR II User's Guide
Version 2019 (11.0), April 2019
Piping Input / SIFs & Tees, pp.142-153

CAESAR II User's Guide
Version 2019 (11.0), April 2019
External Interfaces / Neutral File / Auxiliary Element Data, p.1187
```

The V11 neutral description establishes:

```text
section             #$ SIF&TEES
FORTRAN format      (2X,6G13.6)
items per tee       30
tee slots           2
rows per tee        5
rows per auxiliary  10
item 3              In-Plane SIF (ii)
item 4              Out-Plane SIF (io)
items 1..26         explicitly identified in the retained V11 source ledger
```

The V11 product guide separately establishes the engineering meaning of ii/io, user-defined SIF constraints, and code-dependent Type context.

### V11 blocker

The retained V11 neutral description states 30 items per tee but directly names only items 1..26. The retrieved V11 authority therefore does **not** establish the semantics or required neutral representation of items 27..30.

A new Writer2 block cannot preserve unknown bytes because no target block exists. CREATE would have to synthesize all 60 positions. Consequently the following remain unresolved from V11 alone:

```text
V11 items 27..30 meaning / reserved representation
complete 60-position CREATE construction contract
exact omitted/default/sentinel encoding for every position
unused second-tee-slot CREATE representation
complete Type + piping-code construction rule
```

V11 verdict:

```text
V11_SIF_PHYSICAL_SCHEMA                  PASS_VENDOR_V11
V11_SIF_ITEMS_1_26                       PASS_VENDOR_V11
V11_SIF_ITEMS_27_30                      UNRESOLVED
V11_COMPLETE_60_POSITION_CREATE_CONTRACT UNRESOLVED
V11_UNUSED_SECOND_TEE_SLOT_CREATE_RULE   UNRESOLVED
SIF_CREATE                               SOURCE_BLOCKED_REAFFIRMED_V11
```

Production blocker remains fail-closed:

```text
WRITER_2_SIF_CREATE_PAYLOAD_SEMANTICS_UNQUALIFIED_ITEMS_27_30
```

No V12/V14 semantics may be substituted for these V11 gaps.

---

## 2. HANGER CREATE — V11 authority

### V11 sources

Repository ledger:

```text
docs/cii-writer2-hanger-create-source-ledger.csv
```

Exact Version 11 vendor-authored authority retained by that ledger:

```text
CAESAR II User's Guide
Version 2019 (11.0), October 2018
External Interfaces > Miscellaneous Data Group #1 > Hangers
pp.1158-1159

CAESAR II User's Guide
Version 2019 (11.0), October 2018
Piping Input Reference > Hangers
pp.184-185
```

V11 directly qualifies the published HANGER physical dictionary:

```text
two hanger default/header rows
IHGRNODE
11 HGRDAT meanings/formats
9999.99 uninitialized/infinite representation
TAG/GUID string format
IHGRFREE
IHGRNUM
IHGRTABLE
IHGRSHORT
IHGRCN
```

V11 also states that the hanger GUID is software-assigned and display-only in the Hangers list.

### V11 blocker

Those facts are not a complete neutral CREATE algorithm. The exact V11 sources do not publish:

```text
external GUID generation algorithm
blank-GUID neutral import -> fresh software GUID behavior
complete universal numeric CREATE defaults for every HGRDAT/header field
first-hanger exact header/default byte construction
new-record insertion/index rule across correlated packed arrays
complete omitted/per-hanger default construction
```

Repository converter fallbacks cannot close these gaps because the retained V11 ledger records conflicting local fallback policies; repository policy is not vendor CREATE authority.

The repository also lacks a controlled V11-native before/after pair for:

```text
H=0 -> H=1
H=1 -> H=2
```

Therefore insertion order, existing-header treatment, and generated identity behavior remain unproven.

V11 verdict:

```text
V11_HANGER_PHYSICAL_DICTIONARY        PASS_VENDOR_V11
V11_HANGER_GUID_OWNERSHIP             PASS_VENDOR_V11
V11_GUID_CREATE_RULE                  UNRESOLVED
V11_COMPLETE_CREATE_DEFAULTS          UNRESOLVED
V11_FIRST_HANGER_HEADER_CONSTRUCTION  UNRESOLVED
V11_NEW_RECORD_INSERTION_POLICY       UNRESOLVED
V11_NATIVE_H0_H1_H2_TRANSITION        NOT_AVAILABLE
HANGER_CREATE                         SOURCE_BLOCKED_REAFFIRMED_V11
```

Retained hard blockers:

```text
GUID_SOFTWARE_ASSIGNED_CREATE_RULE_UNRESOLVED
FIRST_HANGER_HEADER_DEFAULTS_UNRESOLVED
REPOSITORY_FALLBACK_DEFAULT_CONFLICT
NEW_HANGER_RECORD_INSERTION_POLICY_UNRESOLVED
OMITTED_PER_HANGER_DEFAULTS_NOT_COMPLETE
REAL_NATIVE_CREATE_TRANSITION_NOT_AVAILABLE
```

---

## 3. RESTRAINT CREATE — V11 authority

### V11 sources

Repository ledgers:

```text
docs/cii-writer2-restraint-cardinality-source-ledger.csv
docs/cii-writer2-restraint-cardinality-qualification.md
```

Exact Version 11 vendor-authored authority retained by those records:

```text
CAESAR II User's Guide
Version 2019 (11.0), April 2019
Piping Input > Restraints, pp.163-175
```

V11 directly establishes:

```text
up to six restraints per element
Node required
Type required
remaining restraint input optional
blank stiffness -> rigid-support behavior
Tag input
Support GUID import via PCF
restraint GUID software-assigned and display-only
```

Merged V11 qualification plus real Version 11 neutral sources establish the supported physical custody:

```text
6 restraint slots
4 physical rows per slot
24 rows per auxiliary block
ELEMENT restraint pointer = 1-based block index
CONTROL restraint cardinality = auxiliary-block count
real V11 files contain occupied and empty 24-row blocks
```

Real V11 sources include the retained benchmark and Version 11.00 neutral files, but these are observations, not controlled CREATE transitions.

### V11 blocker

V11 does not publish the external algorithm needed to synthesize a new block safely:

```text
blank/new restraint GUID import assignment rule
external software GUID generation rule
complete Type-dependent CREATE defaults/byte representation
new 24-row block allocation/index policy
first-block CREATE serialization contract
shared-pointer alias CREATE semantics
```

No controlled same-model V11 native transition is retained for:

```text
0 -> 1 restraint auxiliary block
N -> N+1 restraint auxiliary blocks
```

Therefore a new block cannot be authorized merely because DELETE compaction arithmetic and existing-block Writer1B free-slot CREATE are qualified.

V11 verdict:

```text
V11_RESTRAINT_BLOCK_SHAPE                 PASS_VENDOR_AND_REAL_V11
V11_RESTRAINT_GUID_OWNERSHIP              PASS_VENDOR_V11
V11_GUID_CREATE_RULE                      UNRESOLVED
V11_TYPE_DEPENDENT_COMPLETE_CREATE_PAYLOAD UNRESOLVED
V11_NEW_BLOCK_ALLOCATION_POLICY           UNRESOLVED
V11_SHARED_POINTER_CREATE_SEMANTICS       UNRESOLVED
V11_NATIVE_BLOCK_CREATE_TRANSITION        NOT_AVAILABLE
RESTRAINT_CREATE                          SOURCE_BLOCKED_REAFFIRMED_V11
```

Production blocker remains authoritative:

```text
WRITER_2_RESTRAINT_BLOCK_CREATE_ALLOCATION_NOT_QUALIFIED
```

---

## 4. V11-only Gate F conclusion

The CREATE blocker does **not** depend on Version 12 or Version 14 evidence. Version 11 alone is sufficient to establish both the known schema portions and the remaining authority gaps.

```text
AUTHORITY_SCOPE                       CAESAR_II_2019_VERSION_11_ONLY
LATER_EDITION_AUTHORITY_ALLOWED       FALSE
SIF_CREATE_SOURCE_REFRESH             COMPLETE_SOURCE_BLOCKED_V11
HANGER_CREATE_SOURCE_REFRESH          COMPLETE_SOURCE_BLOCKED_V11
RESTRAINT_CREATE_SOURCE_REFRESH       COMPLETE_SOURCE_BLOCKED_V11
PRODUCTION_CREATE_CHANGE              NONE
```

What would actually reopen each family:

```text
SIF
  authoritative V11 meaning/default/reserved representation for items 27..30
  + complete V11 60-position new-block construction rule

HANGER
  authoritative V11 blank/generated GUID behavior
  + complete V11 default/header construction
  + V11 insertion/order rule
  + controlled native H=0->1 and H=1->2 evidence

RESTRAINT
  authoritative V11 blank/generated GUID behavior
  + complete V11 Type-dependent block construction
  + V11 block allocation/index rule
  + shared-pointer CREATE semantics
  + controlled native 0->1 or N->N+1 block transition
```

Until then all three CREATE families remain explicit fail-closed `SOURCE_BLOCKED` operations. No later-edition semantics are permitted to fill the gaps.