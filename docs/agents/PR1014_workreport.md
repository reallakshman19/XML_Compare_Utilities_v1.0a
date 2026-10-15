# PR1014 — Writer 2 V11 SIF/TEE block DELETE relocation authority

## Current recovery state

```text
HANDOVER_READINESS: READY
PR_RECOVERY_STATE: IMPLEMENTED_PLANNER / DRAFT / REPOSITORY_RUNTIME_NOT_RUN
TAKEOVER_AUTHORITY: WRITE_ALLOWED
REPOSITORY: reallaksh19/XML_Compare_Utilities
PR: 1014
BRANCH: agent/cii-writer2-sif-block-authority
BASE: main@70c7004f872ccba019c1e8b12b27e5ff7dbd0b4f
MISSION: qualify and plan V11 existing SIF/TEE block DELETE + compaction/reindex
MERGE_AUTHORITY: OWNER_ONLY
```

## 1. Why this is DELETE-only

V11 source qualification proves the `#$ SIF&TEES` physical layout:

```text
2 tee slots/block
30 values/slot
5 rows/slot
10 rows/block
FORTRAN 2X,6G13.6
```

Items 1..26 are directly named by the V11 source. Items 27..30 remain unresolved in each tee slot, leaving 8 unresolved physical fields per 10-row block.

Therefore:

```text
existing complete block DELETE + relocation   candidate authority
new block CREATE                              BLOCKED
raw SOURCE 10-row COPY                        BLOCKED
zero/default synthesis                        BLOCKED
later-edition semantic inference              BLOCKED
```

Mandatory CREATE blocker:

`WRITER_2_SIF_CREATE_PAYLOAD_SEMANTICS_UNQUALIFIED_ITEMS_27_30`

## 2. Structural corroboration

The protected `reallaksh19/3D_Converters` V11/V14 converter independently models V11 SIF storage as two independent 30-value tee slots / ten rows total. It preserves the V11 leading 30 values through edition conversion and handles V14-only extension rows separately.

This corroborates shape and slot boundaries only. It is not semantic authority for V11 items 27..30.

## 3. Implemented transaction plan

New module:

`tabs/cii-workspace/cii-workspace-writer2-sif-delete.js`

Policy:

`CII_WRITER_2_SIF_TEE_DELETE_RELOCATION`

The plan requires:

1. bound explicit APPLY / EXCLUDE transfer scope;
2. original TARGET byte custody;
3. qualified existing V11 SIF physical custody;
4. exact 10-row block shape;
5. CONTROL SIF count matching physical row count / 10;
6. reviewed or locked element correspondence;
7. exactly one target element identity per DELETE operation;
8. exact parsed-element-index + FROM/TO physical binding;
9. existing nonzero SIF pointer;
10. all owners of a shared pointer selected;
11. exact 13-byte pointer-field custody for every pointer changed by compaction.

## 4. Compaction rule

Example:

```text
before block pointers: 1,2,3
selected delete:       block 2
old -> new:            1->1, 2->0, 3->2
```

The element whose pointer shifts `3->2` is part of the transaction even if that element was not selected for deletion.

The planner emits:

- `deletedPointers`;
- `retainedPointers`;
- complete `oldToNewPointer`;
- `pointerChanges` for every changed ELEMENT pointer;
- `controlCountBefore` / `controlCountAfter`;
- deletion claims;
- explicit `createAuthority.ready=false` evidence.

## 5. Shared-pointer rule

A shared SIF block can be removed only if every physical owner is selected.

```text
owners {E1,E2}; selected {E1}     -> BLOCK
owners {E1,E2}; selected {E1,E2}  -> eligible
```

Blocker:

`WRITER_2_SIF_DELETE_UNAPPROVED_SHARED_POINTER`

No implicit owner detachment or last-writer-wins behavior is permitted.

## 6. Edition boundary

This phase is V11 only.

V14/V15 use 42 values per tee / 14 rows per block and contain documented ordering drift. Non-V11 custody therefore blocks.

## 7. Changed-file ledger

Implementation/qualification files:

```text
docs/cii-writer2-sif-delete-authority.md
tabs/cii-workspace/cii-workspace-writer2-sif-delete.js
tests/cii-workspace-writer2-sif-delete-plan.test.js
agents/PR1014_workreport.md
agents/status/PR1014.yaml
agents/claims/PR1014.yaml
agents/MASTER_INDEX.md
```

No parser, protected converter, existing Writer-1, NODENAME Writer-2, workflow, or benchmark file is modified.

## 8. Validation truth

```text
PR1013 merge / current-main grounding                  PASS
branch ancestry                                        PASS_GIT_COMPARE
source qualification review                            PASS_SOURCE_INSPECTION
V11 items27..30 unresolved gate                        PASS_SOURCE_INSPECTION
protected converter structural corroboration           PASS_SOURCE_INSPECTION
independent 1,2,3 -> 1,0,2 arithmetic oracle          PASS_INDEPENDENT_SIF_DELETE_RELOCATION_ORACLE
independent shared-owner oracle                        PASS_INDEPENDENT_SIF_DELETE_RELOCATION_ORACLE
repository JS SIF-delete regression                    AUTHORED_NOT_RUN_ENVIRONMENT
inherited Writer1 regressions                          NOT_RUN_ENVIRONMENT
full npm test                                          NOT_RUN_ENVIRONMENT
browser/product flow                                   NOT_RUN_ENVIRONMENT
```

No repository test that was not executed is represented as PASS.

## 9. Current blockers / limitations

- Exact complete checkout remains unavailable in the current container because `github.com` DNS resolution fails.
- CREATE remains blocked until V11 items27..30 and complete construction/default semantics are source-qualified.
- This PR does not physically remove SIF rows or rewrite CONTROL / ELEMENT pointers.
- Product/core Writer-2 routing is not extended to SIF DELETE in this PR.

## 10. Exact next phase after acceptance

Separate PR:

```text
Phase SIF-2B physical delete
 -> reuse PR1014 relocation plan
 -> rewrite CONTROL SIF count
 -> rewrite every changed ELEMENT SIF pointer
 -> remove selected complete 10-row blocks from #$ SIF&TEES
 -> preserve retained blocks byte-for-byte
 -> re-intake
 -> independent complete variable-length expected-postimage validator
```

CREATE must remain blocked in that successor unless semantic qualification changes first.

# Appendix A — takeover questionnaire

1. Why can DELETE be qualified without assigning engineering meaning to items27..30?
2. Why can CREATE not use the same argument?
3. What exact V11 structure is source-qualified?
4. What does the protected V11/V14 converter corroborate, and what does it not prove?
5. Why must a shared pointer require all owners selected?
6. For `1,2,3` with block2 deleted, why must pointer3 become 2?
7. Which pointer field is being relocated and what physical width is required?
8. Which CONTROL count must follow final SIF block count?
9. Why is V12/V14 not admitted to this V11 planner?
10. What must the next independent validator reconstruct without trusting Writer testimony?
