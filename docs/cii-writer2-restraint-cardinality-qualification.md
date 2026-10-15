# Writer2 W2.9 — RESTRAINT cardinality qualification

```text
SOURCE_TASK: Issue #1038
BASE_MAIN: ff9d706796e42a43ebfb1c74696350e9b8cc695b
MODE: SOURCE_QUALIFICATION_AND_PLANNER_GATE
FINAL_VERDICT: NOT_READY_FOR_WRITER2_RESTRAINT_CARDINALITY_PLANNER
PHYSICAL_WRITER_AUTHORITY: FALSE
COMPOSITE_PRODUCT_AUTHORITY: FALSE
WRITER1B_FREE_SLOT_AUTHORITY: PRESERVED
RESTRAINT_CARDINALITY_COMPOSITE_BLOCKER: PRESERVED
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
```

## 1. Executive disposition

W2.9 found a real and useful structural split, but not enough source authority to authorize the generic Writer2 RESTRAINT cardinality planner requested by Issue #1038.

Qualified narrowly:

```text
RESTRAINT_BLOCK_COUNT_UNIT
  number of restraint auxiliary data blocks

RESTRAINT_POINTER_UNIT
  1-based restraint auxiliary block index

V11_PHYSICAL_BLOCK_SHAPE
  6 restraint slots
  × 4 physical rows per slot
  = 24 rows per block

DELETE_COMPACTION_RELOCATION_ARITHMETIC
  QUALIFIED_DERIVED_FROM_DIRECT_FORMAT
```

Still unresolved for generic CREATE/cardinality planning:

```text
RESTRAINT_GUID_SOFTWARE_ASSIGNED_CREATE_RULE_UNRESOLVED
RESTRAINT_TYPE_DEPENDENT_CREATE_DEFAULTS_INCOMPLETE
NEW_RESTRAINT_BLOCK_ALLOCATION_POLICY_NOT_VENDOR_QUALIFIED
NATIVE_RESTRAINT_BLOCK_CREATE_TRANSITION_NOT_AVAILABLE
SHARED_POINTER_ALIAS_SEMANTICS_NOT_SOURCE_QUALIFIED
FULL_REPOSITORY_POINTER_ALIAS_CENSUS_NOT_EXECUTED
```

Any of the first four blockers is sufficient to prevent a generic CREATE-capable cardinality planner.

Therefore:

```text
NOT_READY_FOR_WRITER2_RESTRAINT_CARDINALITY_PLANNER
```

No production planner, physical writer, composite route, product route or UI capability is added by W2.9.

---

## 2. Existing Writer1B boundary — must not move

Current merged Writer1B already owns fixed-capacity restraint mutation inside an existing 24-row block.

`tabs/cii-workspace/cii-workspace-restraint-slot-transfer.js` defines:

```text
SLOTS = 6
ROWS_PER_SLOT = 4
ROWS_PER_BLOCK = 24
```

Writer1B CREATE requires:

```text
one qualified existing target restraint-block pointer
+ at least one clean empty slot
+ source/target identity correspondence
+ empty TAG/GUID metadata on the transferred record
```

Its authority includes:

```text
PROTECTED_WRITER_EXISTING_24_ROW_BLOCK_FREE_SLOT
```

Its structural hard stop is:

```text
RESTRAINT_TARGET_FREE_SLOT_REQUIRED
```

Writer1B CLEAR remains inside the same block and uses:

```text
PROTECTED_WRITER_EXISTING_24_ROW_BLOCK_EMPTY_SLOT_TEMPLATE
```

W2.9 does not replace, weaken or reroute either path.

Rule:

```text
existing clean free slot
  -> Writer1B

new 24-row block required
  -> Writer2 true-cardinality domain
```

---

## 3. Exact V11 restraint engineering input authority

Source:

```text
CAESAR II User's Guide
Version 2019 (11.0)
April 2019
Hexagon AB / Intergraph
vendor-authored mirror:
https://studylib.net/doc/27184542/guia-caesar
```

Authority class:

```text
VENDOR_AUTHORED_MIRROR_EXACT_V11
```

V11 Piping Input, Restraints, pp.163 onward establishes:

```text
up to six restraints per element
Node number required
restraint Type required
all other restraint input optional
blank stiffness -> rigid support default behavior
support Tag may be entered
Support GUID may be imported by PCF mapping
```

V11 restraint GUID authority is decisive:

```text
GUID = software-assigned for the restraint
GUID = display-only in the Restraints list input
```

This does not publish an external GUID generation algorithm.

It also does not prove that a new neutral-file restraint with blank GUID receives a fresh software-assigned GUID on import.

Consequences:

```text
Writer-generated GUID      NOT AUTHORIZED
copy SOURCE GUID to TARGET NOT AUTHORIZED AS GENERIC IDENTITY RULE
blank GUID CREATE behavior UNRESOLVED
```

Hard blocker:

```text
RESTRAINT_GUID_SOFTWARE_ASSIGNED_CREATE_RULE_UNRESOLVED
```

---

## 4. Neutral-file CONTROL count authority

Official Hexagon neutral-file help defines the CONTROL auxiliary counts and explicitly identifies the fourth auxiliary count as:

```text
number of restraint auxiliary data blocks in the input file
```

The current Writer route reads this value as CONTROL row 2, item 4.

W2.9 therefore classifies the governed cardinality unit as:

```text
CONTROL.RESTRAINT = restraint auxiliary block count
```

It is not the occupied restraint-slot count.

This is additionally corroborated by real V11 repository files where:

```text
CONTROL restraint count × 24 == RESTRANT physical block row count
```

for inspected sources.

---

## 5. Neutral-file block shape and pointer authority

Vendor neutral-file documentation defines:

```text
ELEMENT IEL item 4
  pointer to Restraint Auxiliary field

pointer = 0
  no restraint auxiliary data of this type associated with the element
```

The RESTRANT auxiliary block contains six possible restraint specifications.

Each slot carries:

```text
row 1 / row 2 numeric fields:
  1 node
  2 restraint type
  3 stiffness
  4 gap
  5 friction coefficient
  6 connecting node
  7 X direction cosine
  8 Y direction cosine
  9 Z direction cosine

row 3:
  Support TAG

row 4:
  Support GUID
```

Numeric format:

```text
2X,6G13.6
```

String format:

```text
7X,I5,1X,A100
```

Blank string length prefix:

```text
0
```

Current V12 official help corroborates this six-slot/four-row physical shape. Real V11 repository CII files independently show the same 24-row block shape.

Edition guard:

```text
supported W2.9 physical class requires V11/2019-compatible 6-slot × 4-row layout
older 4-restraint neutral layouts are NOT authority for this route
later-edition field growth must not be backported by position without qualification
```

---

## 6. Repository protected-converter evidence — policy, not vendor default authority

`converters/scripts/inputxml_to_cii2019.py` defines:

```text
RESTRAINT_SLOTS_PER_AUX = 6
RESTRAINT_LINES_PER_SLOT = 4
RESTRAINT_LINES_PER_AUX_BLOCK = 24
```

Its local emitter:

```text
one block per element that has restraints
block index = next sequential emitted block
empty slot = two numeric template/zero rows + blank TAG + blank GUID
occupied slot = node/type/stiffness/gap/friction/CNode + direction cosines + TAG/GUID
```

and derives an element pointer as:

```text
(len(payload) // 24) + 1
```

This is valuable implementation/corroboration evidence, but the following remain repository policy unless separately sourced:

```text
append in element iteration order
new-block allocation index policy
converter stiffness token/default selection
source GUID propagation behavior
per-type direction-cosine fallback policy
```

W2.9 does not promote those policies into vendor-neutral CREATE authority.

---

## 7. Real repository V11 restraint evidence

The repository contains real multi-block restraint sources; this is materially stronger than the previous HANGER H>1 evidence state.

Observed CONTROL restraint-block counts:

```text
Benchmark/CIICompare/BM_CII_SOURCE.CII        7
Benchmark/CIICompare/BM_CII_TARGET1.CII       7
Benchmark/CIICompare/BM_CII_TARGET2.CII       7
Benchmark/CIICompare/SOURCE 3.CII           132
Benchmark/CIICompare/TARGET 3-1.CII         135
converters/scripts/inputxml_profile_bm_cii_2019.cii  8
Benchmark/Pipeline/CII                        0
output.cii                                    0
```

`SOURCE 3.CII` explicitly identifies:

```text
CAESAR II / Neutral file interface Ver 11.00
```

`BM_CII_SOURCE.CII` and `SOURCE 3.CII` visibly contain 24-row restraint blocks with:

```text
occupied slots
+ zero numeric empty slots
+ zero-length TAG rows
+ zero-length GUID rows
```

This qualifies physical observation and strongly corroborates the block model.

It does not provide a controlled native before/after pair for:

```text
0 blocks -> 1 block
N blocks -> N+1 blocks
N blocks -> N-1 blocks
middle-block deletion/compaction
blank GUID import -> software-assigned GUID
```

Those transitions remain `NOT_AVAILABLE` in the current repository evidence set.

---

## 8. DELETE/compaction relocation arithmetic

The direct physical model is sufficient to derive deterministic index relocation if a complete block is removed from a contiguous RESTRANT block sequence.

Let:

```text
B = original block count
D = set of deleted old block indices
p = an original positive restraint pointer
```

For a retained block:

```text
newPointer(p) = p - count(d in D where d < p)
```

For a deleted block:

```text
oldToNew[d] = 0
```

Examples:

```text
B=3, delete {2}
  1 -> 1
  2 -> 0
  3 -> 2

B=3, delete {1}
  1 -> 0
  2 -> 1
  3 -> 2

B=3, delete {3}
  1 -> 1
  2 -> 2
  3 -> 0

B=5, delete {2,4}
  1 -> 1
  2 -> 0
  3 -> 2
  4 -> 0
  5 -> 3
```

CONTROL consequence:

```text
blockCountAfter = B - |D|
```

Physical RESTRANT consequence:

```text
rowCountAfter = 24 × blockCountAfter
```

Safety condition:

Every original positive ELEMENT restraint pointer must be accounted for by one relocation map. A pointer to a removed block is not silently redirected.

This arithmetic is classified:

```text
QUALIFIED_DERIVED_FROM_DIRECT_FORMAT
```

It is not physical-write authority.

---

## 9. Why the generic planner is still NOT_READY

### B01 — software-assigned GUID

```text
RESTRAINT_GUID_SOFTWARE_ASSIGNED_CREATE_RULE_UNRESOLVED
```

A new occupied restraint slot requires an identity disposition. V11 does not authorize an external generation rule and does not prove blank-neutral-import assignment.

### B02 — type-dependent CREATE defaults

```text
RESTRAINT_TYPE_DEPENDENT_CREATE_DEFAULTS_INCOMPLETE
```

V11 makes Node and Type required but many remaining fields optional. Their effective meaning/default can depend on restraint type. A universal raw CREATE payload cannot be inferred from recurring zeros or one converter profile.

### B03 — new-block allocation policy

```text
NEW_RESTRAINT_BLOCK_ALLOCATION_POLICY_NOT_VENDOR_QUALIFIED
```

The repository converter appends blocks in element order, but the examined vendor source does not establish that as the canonical Writer2 mutation policy for an existing neutral file.

### B04 — no native CREATE transition

```text
NATIVE_RESTRAINT_BLOCK_CREATE_TRANSITION_NOT_AVAILABLE
```

No qualified repository before/after pair proves first-block or additional-block creation behavior, pointer allocation and GUID treatment.

### B05 — shared-pointer aliases

```text
SHARED_POINTER_ALIAS_SEMANTICS_NOT_SOURCE_QUALIFIED
```

The neutral format permits pointers to auxiliary blocks, but the semantic conditions under which multiple elements may intentionally share one restraint block are not qualified here. A future planner must fail closed unless ownership is unambiguous or separately qualified.

### B06 — exhaustive alias census not executed

```text
FULL_REPOSITORY_POINTER_ALIAS_CENSUS_NOT_EXECUTED
```

Remote source inspection established real multi-block files but did not execute a full exact-checkout pointer-alias census over all CII assets.

B01-B04 independently block generic CREATE-capable planner authority.

---

## 10. Recommended future authority split

Do not force CREATE and DELETE into one premature planner.

A safer successor split is:

```text
RESTRAINT_BLOCK_DELETE_COMPACTION
  unique/unambiguous block ownership only
  block becomes empty under an authorized operation set
  complete old->new block relocation map
  CONTROL decrement
  all ELEMENT pointer rewrites derived from one map
  shared/ambiguous ownership -> BLOCK

RESTRAINT_BLOCK_CREATE_ALLOCATION
  remains blocked until GUID/default/allocation source authority is complete
```

This recommendation does not itself authorize production work.

A future issue may source-qualify the DELETE-only planner separately if the owner chooses to split W2.9.

---

## 11. Mandatory case disposition R01-R18

```text
R01 existing clean free slot
  WRITER1B_ONLY

R02 no free slot, new block required
  BLOCKED_GENERIC_CREATE_AUTHORITY

R03 target pointer=0, first block required
  BLOCKED_GENERIC_CREATE_AUTHORITY

R04 clear slot, block remains occupied
  WRITER1B_FIXED_CAPACITY_PATH

R05 clear last occupied slot, block candidate for removal
  DELETE_COMPACTION_ARITHMETIC_QUALIFIED; planner not authorized in this PR

R06 remove middle block
  RELOCATION_FORMULA_QUALIFIED; physical/planner authority withheld

R07 remove first block
  RELOCATION_FORMULA_QUALIFIED

R08 remove last block
  RELOCATION_FORMULA_QUALIFIED

R09 allocate after existing blocks
  UNRESOLVED_VENDOR_ALLOCATION_POLICY

R10 shared pointer / alias ownership
  BLOCK_UNLESS_SEPARATELY_QUALIFIED

R11 duplicate logical claims
  MUST_CANONICALIZE_IDENTICAL_COMPLETE_OWNERSHIP_OR_BLOCK

R12 conflicting claims on same block
  BLOCK

R13 stale TARGET hash / pointer drift
  BLOCK

R14 CONTROL block-count mismatch
  BLOCK

R15 RESTRANT row count not multiple of 24
  BLOCK

R16 slot metadata/GUID semantics unresolved for CREATE
  BLOCK

R17 unsupported edition/layout
  BLOCK

R18 node/element/topology creation
  WRITER3 / BLOCK_FROM_WRITER2
```

---

## 12. Evidence truth

```text
exact V11 restraint input semantics
  PASS_VENDOR_AUTHORED_EXACT_VERSION_MIRROR

exact V11 restraint GUID software-assigned/display-only
  PASS_VENDOR_AUTHORED_EXACT_VERSION_MIRROR

official Hexagon CONTROL restraint-block count semantics
  PASS_OFFICIAL_HEXAGON_SOURCE

six-slot / TAG/GUID neutral physical format
  PASS_VENDOR_NEUTRAL_DOCUMENTATION
  + PASS_OFFICIAL_HEXAGON_V12_CORROBORATION
  + PASS_REAL_V11_SOURCE_INSPECTION

Writer1B free-slot boundary
  PASS_MERGED_SOURCE_INSPECTION

repository converter block emission
  PASS_SOURCE_INSPECTION_REPOSITORY_POLICY_ONLY

real V11 multi-block source availability
  AVAILABLE

native controlled block CREATE transition
  NOT_AVAILABLE

native controlled block DELETE/compaction transition
  NOT_AVAILABLE

DELETE relocation arithmetic
  PASS_DERIVED_FROM_DIRECT_FORMAT

full repository pointer-alias census
  NOT_RUN_ENVIRONMENT

qualification sentinel
  AUTHORED / NOT_RUN_ENVIRONMENT

physical Writer2 restraint-cardinality writer
  NOT_IMPLEMENTED / NOT_AUTHORIZED

composite/product restraint cardinality
  BLOCKED / UNCHANGED
```

No source-inspection result is represented as runtime PASS.

---

## 13. Final verdict

```text
NOT_READY_FOR_WRITER2_RESTRAINT_CARDINALITY_PLANNER
```

Reason:

The generic W2.9 planner mission includes CREATE/allocation cases, and the current source set cannot construct a new restraint block with source-qualified identity/default/allocation semantics without guessing.

The narrower DELETE/compaction relocation arithmetic is retained as qualified evidence for a future explicitly scoped successor.
