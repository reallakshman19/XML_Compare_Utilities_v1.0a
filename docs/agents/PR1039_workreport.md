# PR1039 work report — Writer2 W2.9 RESTRAINT cardinality qualification

```text
HANDOVER_READINESS: READY
PR_RECOVERY_STATE: HEALTHY
TAKEOVER_AUTHORITY: WRITE_ALLOWED_WITHIN_ISSUE_1038_QUALIFICATION_SCOPE
EXECUTION_MODE: MANUAL
SCOPE_AUTHORITY: LOCKED_TO_ISSUE_1038
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
REPOSITORY: reallaksh19/XML_Compare_Utilities
SOURCE_TASK: Issue #1038
PR: #1039
BRANCH: agent/cii-writer2-restraint-cardinality-w29
BASE_MAIN: ff9d706796e42a43ebfb1c74696350e9b8cc695b
REPORT_BASIS_HEAD: 6aa1f04ad24958ab64c069074343c7ccb54f3c28
CURRENT_STAGE: W2_9_RESTRAINT_CARDINALITY_QUALIFICATION_COMPLETE_NOT_READY_RECONCILED
FINAL_VERDICT: NOT_READY_FOR_WRITER2_RESTRAINT_CARDINALITY_PLANNER
PHYSICAL_WRITER_AUTHORITY: FALSE
COMPOSITE_PRODUCT_AUTHORITY: FALSE
WRITER1B_FREE_SLOT_AUTHORITY: PRESERVED
```

`REPORT_BASIS_HEAD` is the pre-final-coordination head whose GitHub compare established the observed 9-path scope. Live GitHub state remains authoritative for the branch head after coordination-only commits.

## Handover in 60 Seconds

PR1037/W2.5 was owner-authorized and squash-merged to `main@ff9d706796e42a43ebfb1c74696350e9b8cc695b` before W2.9 started.

Roadmap state:

```text
W2.1 SIF CREATE qualification
  NOT_READY -> W2.2-W2.4 blocked

W2.5 HANGER CREATE qualification
  merged NOT_READY -> W2.6-W2.8 blocked

W2.9 RESTRAINT true cardinality
  THIS PR
  final verdict NOT_READY_FOR_WRITER2_RESTRAINT_CARDINALITY_PLANNER
```

W2.9 materially qualified the block/pointer model and DELETE-compaction relocation arithmetic, but generic CREATE-capable cardinality planning remains source-incomplete. No production planner or writer was added.

## Grounding epoch GE-1039-001

```text
live main at branch creation
  ff9d706796e42a43ebfb1c74696350e9b8cc695b

branch
  agent/cii-writer2-restraint-cardinality-w29

PR
  #1039 draft during active work

source issue
  #1038

coordination
  PR1033 remains active qualification-only
  shared path = agents/MASTER_INDEX.md
  RESTRAINT production/test authority overlap = NONE

classification
  SAFE_WITH_SHARED_INDEX_RECONCILIATION
```

A full repository clone was attempted. The environment failed before checkout because `github.com` could not be resolved. Therefore exact-checkout Node execution, full pointer census and repository-wide tests remain `NOT_RUN_ENVIRONMENT`.

## Scope boundary

Qualification/planner gate only.

Explicit non-scope:

```text
Writer1B fixed-slot behavior
Writer2 physical restraint-cardinality writer
one-TARGET0 composite adoption
product/core routing
UI/browser enablement
SIF CREATE
HANGER CREATE
Writer3 topology
protected converter mutation
workflow/package mutation
```

## Existing Writer1B authority preserved

Merged Writer1B owns cardinality-preserving mutation inside one existing restraint auxiliary block:

```text
6 slots
4 rows/slot
24 rows/block
CREATE into clean existing free slot
CLEAR qualified existing slot
```

Preserved authority/blockers:

```text
PROTECTED_WRITER_EXISTING_24_ROW_BLOCK_FREE_SLOT
PROTECTED_WRITER_EXISTING_24_ROW_BLOCK_EMPTY_SLOT_TEMPLATE
RESTRAINT_TARGET_FREE_SLOT_REQUIRED
```

Boundary:

```text
existing free slot -> Writer1B
new block required -> Writer2 true-cardinality domain
```

## Source qualification

### Exact V11 input semantics

Vendor-authored CAESAR II User's Guide Version 2019 (11.0), April 2019 establishes:

```text
up to six restraints per element
Node required
Type required
other restraint input optional
blank stiffness -> rigid support behavior
Tag may be entered
Support GUID may be imported through PCF mapping
```

The decisive V11 identity statement is:

```text
restraint GUID = software-assigned
restraint GUID = display-only in Restraints list input
```

No external neutral-file GUID generation algorithm was found.

### CONTROL count

Official Hexagon neutral help defines the fourth auxiliary count in CONTROL as:

```text
number of restraint auxiliary data blocks
```

Therefore Writer2 cardinality count is a block count, not an occupied-slot count.

### Pointer and block format

Vendor neutral documentation plus merged custody establishes:

```text
ELEMENT IEL item4 = pointer to restraint auxiliary field
pointer 0 = no restraint auxiliary data
current supported pointer = 1-based 24-row block index
```

Current six-slot block:

```text
6 restraint slots
x 4 physical rows
= 24 rows
```

Per slot:

```text
row1/row2 numeric:
  node
  type
  stiffness
  gap
  friction
  connecting node
  X/Y/Z direction cosines

row3 Support TAG
row4 Support GUID
```

Blank string representation uses length prefix 0.

Edition guard is mandatory; older four-restraint neutral layouts are not current W2.9 authority.

### Repository converter

`converters/scripts/inputxml_to_cii2019.py` locally emits:

```text
6 x 4 = 24 rows/block
one block per element with restraints
next sequential emitted block index
empty numeric/template rows
blank TAG/GUID rows for unused slots
```

This is repository converter policy/corroboration. It is not promoted to universal vendor CREATE authority.

## Real-source census

Observed block counts:

```text
BM_CII_SOURCE.CII                         7
BM_CII_TARGET1.CII                        7
BM_CII_TARGET2.CII                        7
SOURCE 3.CII                            132
TARGET 3-1.CII                          135
inputxml_profile_bm_cii_2019.cii          8
Benchmark/Pipeline/CII                     0
output.cii                                 0
legacy sys30 profile                       3  // unsupported layout signature
```

`SOURCE 3.CII` identifies `Neutral file interface Ver 11.00`.

Real V11 files visibly corroborate occupied slots plus zero/blank empty slots inside 24-row blocks.

No controlled native before/after pair was found for:

```text
0 -> 1 restraint block
N -> N+1 restraint blocks
N -> N-1 restraint blocks
middle-block compaction
blank GUID import -> assigned software GUID
```

## DELETE-compaction relocation arithmetic

For original positive block pointer `p` and deleted old-block set `D`:

```text
newPointer(p) = p - count(d in D where d < p)
```

Deleted blocks map to zero in the old-to-new block map.

Qualification examples:

```text
B=3 delete {2}
  1->1  2->0  3->2

B=3 delete {1}
  1->0  2->1  3->2

B=3 delete {3}
  1->1  2->2  3->0

B=5 delete {2,4}
  1->1  2->0  3->2  4->0  5->3
```

Count/row consequence:

```text
blockCountAfter = B - |D|
RESTRANT rowsAfter = 24 * blockCountAfter
```

Classification:

```text
PASS_DERIVED_FROM_DIRECT_FORMAT
```

This is evidence for a future DELETE-only planner; it is not planner or physical-write authority in PR1039.

## Hard blockers

```text
B01 RESTRAINT_GUID_SOFTWARE_ASSIGNED_CREATE_RULE_UNRESOLVED
B02 RESTRAINT_TYPE_DEPENDENT_CREATE_DEFAULTS_INCOMPLETE
B03 NEW_RESTRAINT_BLOCK_ALLOCATION_POLICY_NOT_VENDOR_QUALIFIED
B04 NATIVE_RESTRAINT_BLOCK_CREATE_TRANSITION_NOT_AVAILABLE
B05 SHARED_POINTER_ALIAS_SEMANTICS_NOT_SOURCE_QUALIFIED
B06 FULL_REPOSITORY_POINTER_ALIAS_CENSUS_NOT_EXECUTED
```

B01-B04 independently block generic CREATE-capable planner authority.

## R01-R18 disposition

```text
R01 free slot                         Writer1B only
R02 no free slot                      generic CREATE blocked
R03 pointer=0 first block             generic CREATE blocked
R04 clear slot/block still occupied   Writer1B fixed-capacity
R05 last occupied slot                DELETE-compaction candidate only
R06 remove middle block               relocation arithmetic qualified
R07 remove first block                relocation arithmetic qualified
R08 remove last block                 relocation arithmetic qualified
R09 new-block allocation order        unresolved
R10 shared pointer alias              block unless separately qualified
R11 duplicate logical claims          canonicalize only with complete identical custody or block
R12 conflicting same-block claims     block
R13 stale TARGET                      block
R14 CONTROL count mismatch            block
R15 rows not multiple of 24           block
R16 CREATE GUID/default unresolved     block
R17 unsupported edition/layout        block
R18 node/element topology change      Writer3
```

## Machine-checkable sentinel

Authored:

```text
tests/cii-workspace-writer2-restraint-cardinality-qualification.test.js
```

It asserts:

```text
NOT_READY final verdict
B01-B06 presence
CONTROL block-count semantics recorded
software-assigned GUID blocker recorded
four independent relocation-map examples
24-row count arithmetic
Writer1B RESTRAINT_TARGET_FREE_SLOT_REQUIRED remains present
Writer2 composite restraintCardinality blocker remains present
no production restraint-cardinality planner exists
```

Runtime truth:

```text
AUTHORED / NOT_RUN_ENVIRONMENT
```

## Changed-file ledger — observed

GitHub compare at `REPORT_BASIS_HEAD` showed:

```text
ahead / behind   10 / 0
merge-base        ff9d706796e42a43ebfb1c74696350e9b8cc695b
intended paths    9
actual paths      9
production paths  0
unexplained       0
```

Exact paths:

```text
agents/MASTER_INDEX.md
agents/PR1039_workreport.md
agents/claims/PR1039.yaml
agents/status/PR1039.yaml
docs/cii-writer2-restraint-cardinality-field-map.csv
docs/cii-writer2-restraint-cardinality-qualification.md
docs/cii-writer2-restraint-cardinality-real-source-census.csv
docs/cii-writer2-restraint-cardinality-source-ledger.csv
tests/cii-workspace-writer2-restraint-cardinality-qualification.test.js
```

Final coordination commits modify only already-intended metadata paths; live GitHub compare is authoritative for the latest head.

## Validation ledger

```text
exact V11 restraint input semantics
  PASS_VENDOR_AUTHORED_EXACT_VERSION_MIRROR

exact V11 software-assigned/display-only GUID
  PASS_VENDOR_AUTHORED_EXACT_VERSION_MIRROR

official Hexagon CONTROL block count
  PASS_OFFICIAL_HEXAGON_SOURCE

neutral six-slot/TAG/GUID block format
  PASS_VENDOR_NEUTRAL_DOCUMENTATION
  + PASS_OFFICIAL_HEXAGON_V12_CORROBORATION

Writer1B scope boundary
  PASS_MERGED_SOURCE_INSPECTION

real V11 multi-block sources
  AVAILABLE / PASS_REMOTE_SOURCE_INSPECTION

DELETE relocation arithmetic
  PASS_DERIVED_FROM_DIRECT_FORMAT

native CREATE transition
  NOT_AVAILABLE

native DELETE transition
  NOT_AVAILABLE

full exact-checkout pointer-alias census
  NOT_RUN_ENVIRONMENT

qualification sentinel
  NOT_RUN_ENVIRONMENT

npm test
  NOT_RUN_ENVIRONMENT

browser/product
  NOT_APPLICABLE_NO_PRODUCTION_ROUTE_CHANGE
```

No unexecuted check is represented as PASS.

## Recommended successor split

Do not start generic W2.10.

A separately scoped future issue may qualify:

```text
RESTRAINT_BLOCK_DELETE_COMPACTION
```

with unique/unambiguous block ownership, explicit fail-closed alias handling, one old-to-new block map, CONTROL decrement and complete expected postimage.

Keep:

```text
RESTRAINT_BLOCK_CREATE_ALLOCATION
```

blocked until GUID/default/allocation source authority is complete.

## Exact next action

```text
SOURCE_ACQUISITION
or
EXPLICIT_NARROW_DELETE_COMPACTION_SUCCESSOR
```

PR1039 remains owner-merge-controlled. No merge without fresh owner authorization.

## Appendix A — expert takeover gate

1. Why is an existing free restraint slot Writer1B, while a new 24-row block is Writer2?
2. Prove the pointer unit and physical block span for pointer `p`.
3. What exactly does CONTROL restraint count represent?
4. Derive the 1..5 relocation map when old blocks 2 and 4 are removed.
5. Why must a pointer to a removed block never be silently redirected?
6. What source establishes GUID ownership and why does it block generic CREATE?
7. Which converter behaviors are repository policy rather than vendor rules?
8. Why do real 132/135-block files not prove CREATE semantics?
9. When is a whole block removable versus one slot merely clearable?
10. What must happen if two ELEMENTs share one block pointer?
11. Define the future independent complete-postimage oracle for variable-length RESTRANT compaction.
12. State every fact that keeps the generic W2.9 planner NOT_READY.
