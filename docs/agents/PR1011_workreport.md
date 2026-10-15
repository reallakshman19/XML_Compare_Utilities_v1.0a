# PR1011 — Writer 2 NODENAME Relocation Planner Work Report

## Recovery header

```text
HANDOVER_READINESS: READY
REPOSITORY: reallaksh19/XML_Compare_Utilities
PR: 1011
BRANCH: agent/cii-writer2-nodename-relocation
BASE: main@7c1b7df01086b1889a765466de7bcb5b4c5ff805
MISSION: qualify deterministic NODENAME create/delete relocation before physical Writer 2 rewrite
CURRENT_STAGE: PHASE4A_RELOCATION_PLANNER_IMPLEMENTED
MERGE_AUTHORITY: OWNER_ONLY
```

## 1. Why Writer 2 starts here

The repository roadmap defines Writer 2 as the pointer/cardinality-aware auxiliary transaction engine. Writer 2 owns operations where auxiliary allocation changes while piping topology remains unchanged. NODENAME is the safest first slice because its field semantics and ELEMENT pointer custody were already qualified by Writer 1C.

This PR intentionally freezes relocation math before any cardinality-changing byte rewrite is enabled.

## 2. Source / format authority

Protected source oracle, read-only:

```text
repository: reallaksh19/3D_Converters
commit observed: db5f9e250edfa6fa01097b02ff71b1737ea78436
file: converters/scripts/inputxml_to_cii2019.py
```

The protected converter defines NODENAME as:

```text
FORTRAN semantic basis: 2X, A10, 16X, A10
implemented physical compatibility width:
  prefix        = 2
  FROM field    = 26 usable columns, columns [2,28)
  TO field      = 25 usable columns, columns [28,53)
  total row     = 53 characters
```

Its canonical formatter is logically:

```text
"  " + FROM.ljust(26) + TO.ljust(25)
```

The protected converter also establishes:

```text
CONTROL line 1 field 4 = NONAM count       (JS index 3)
ELEMENT row 13 field 6 = NODENAME pointer  (JS index 5)
NODENAME pointer basis = 1-based row index
```

Current XML_Compare_Utilities physical custody remains authoritative for mutable ELEMENT binding:

```text
parsed ELEMENT index == physical 15-row ELEMENT block index
AND parsed FROM == physical FROM
AND parsed TO == physical TO
```

Endpoint fallback remains read-only and cannot enter Writer 2 relocation.

## 3. Phase-4A input authority

Only operations meeting all of the following enter the relocation plan:

```text
scopeDecision   = APPLY
family          = NODE_NAME
property        = Node name / to-name
action          = CREATE or DELETE
status          = PREVIEW_READY
matchAuthority  = REVIEWED or LOCKED
policyAuthority = CII_WRITER_2_NODENAME_RELOCATION
```

Any other APPLY operation blocks:

```text
WRITER_2_PHASE1_UNSUPPORTED_APPLY:<operationId>
```

Original byte custody and qualified NODENAME physical custody are required.

## 4. CREATE allocation algorithm

A Writer 2 CREATE is allowed only when the target node has no existing physical NODENAME field.

If a field already exists—even blank—the operation belongs to Writer 1C existing-row mutation and Phase-4A blocks:

```text
WRITER_2_NODENAME_CREATE_EXISTING_FIELD_USE_WRITER_1C:<node>
```

For an actual new allocation:

1. collect exact-custodied incident ELEMENT bindings with current NODENAME pointer = 0;
2. sort by parsed ELEMENT index;
3. select the lowest parsed ELEMENT index deterministically;
4. determine whether the node is the FROM or TO endpoint;
5. combine two CREATE operations into one new row when both endpoints select the same zero-pointer ELEMENT;
6. append new rows after all retained existing rows;
7. assign each appended row its resulting 1-based pointer;
8. emit the owner ELEMENT's pointer transition `0 -> newPointer`.

Divergent CREATE requests that resolve to the same physical endpoint block:

```text
WRITER_2_NODENAME_CREATE_OWNER_CONFLICT:<elementIndex>:FROM|TO
```

Names are ASCII-only and limited to the physical compatibility widths:

```text
FROM <= 26
TO   <= 25
```

## 5. DELETE and compaction algorithm

DELETE is physical, not merely semantic. Every physical field representing the selected node must be removed.

For each selected node:

1. enumerate all physical NODENAME spans whose owner `nodeId` equals the selected node;
2. if a span also has an owner whose node is not selected for deletion, block as an unapproved alias effect;
3. blank the selected FROM/TO field in its row;
4. delete the physical row only when both fields are blank afterward;
5. retain partially populated rows;
6. compact retained rows in original order;
7. derive the complete old-to-new pointer map from the post-delete layout.

Example qualified relocation:

```text
before rows/pointers: 1, 2, 3
delete row 2

after mapping:
1 -> 1
2 -> 0
3 -> 2
```

The ELEMENT that previously pointed to row 3 must therefore change pointer `3 -> 2` even though that ELEMENT was not itself the selected delete owner. This is an intentional relocation consequence, not collateral drift.

Every pointer transition is listed in `pointerChanges` and must have:

```text
bindingAuthority = EXACT_PARSED_INDEX_AND_ENDPOINTS
pointerField.qualified = true
pointerField.width = 13
```

## 6. CONTROL cardinality authority

Before planning:

```text
CONTROL.NONAM == physical NODENAME row count == custody row count
```

Mismatch blocks.

After planning:

```text
CONTROL.NONAM_after = finalRows.length
```

The plan records both before and after counts but does not physically patch CONTROL in Phase-4A.

## 7. Relocation-plan contract

Schema:

```text
CIIWorkspaceWriter2NodeNameRelocationPlan.v1
```

Important outputs:

```text
rowCountBefore
rowCountAfter
controlCountBefore
controlCountAfter
oldToNewPointer
deletedPointers
deletionClaims
appendedRows
finalRows
pointerChanges
operationCount
blockers
```

The plan is transaction-level evidence. It is not a series of sequential line edits.

## 8. Negative assurance / falsifiers authored

Tests cover:

```text
zero-pointer CREATE -> append row + 0->1 pointer
paired FROM+TO CREATE -> one row
DELETE row2 of three -> 1/2/3 -> 1/0/2
partial row DELETE -> row retained / pointer stable
existing physical blank field -> use Writer1C, not Writer2
shared-span foreign owner -> block
CONTROL count mismatch -> block
non-ASCII name -> block
field-width overflow -> block
non-NODENAME APPLY -> block
changed pointer without qualified 13-byte pointer field -> block
divergent same-endpoint CREATE requests -> block
```

## 9. Validation truth

```text
PR1010 merged-base grounding                 PASS_GIT_COMPARE
branch scope                                 PASS_GIT_COMPARE
planner syntax check                         PASS_LOCAL_SOURCE
isolated relocation logic harness           PASS_ISOLATED_PLANNER_HARNESS
repository integrated relocation test        AUTHORED_NOT_RUN_ENVIRONMENT
repository integrated falsifier test         AUTHORED_NOT_RUN_ENVIRONMENT
full repository npm test                     NOT_RUN_ENVIRONMENT
browser                                      NOT_RUN_ENVIRONMENT
```

The isolated harness exercised the same relocation algorithm but used small dependency stubs at the physical-section/fixed-field boundary. It is not represented as full repository runtime qualification.

## 10. Changed-file ledger

Production:

```text
tabs/cii-workspace/cii-workspace-writer2-nodename-relocation.js
```

Tests:

```text
tests/cii-workspace-writer2-nodename-relocation.test.js
tests/cii-workspace-writer2-nodename-relocation-falsifiers.test.js
```

Recovery artifacts are added under `agents/` after PR creation.

No current Writer1A/Writer1B/Writer1C implementation, parser fixed-field engine, converter, benchmark CII, or workflow is modified.

## 11. Explicit exclusions

Phase-4A does **not** authorize:

- physical cardinality-changing CII output;
- CONTROL mutation;
- ELEMENT pointer rewrite;
- SIF/TEE block allocation/deletion;
- hanger allocation/deletion;
- section insertion/deletion;
- topology/node/element creation/deletion;
- new engineering-field semantics;
- Writer 3 behavior.

The planner computes the future CONTROL/pointer/row state but does not write it.

## 12. Appendix A — next-agent qualification

1. State the exact 53-character NODENAME physical layout and source authority.
2. Which CONTROL field owns NONAM and which ELEMENT field owns the NODENAME pointer?
3. Why is an existing blank NODENAME field Writer 1C territory rather than Writer 2 CREATE?
4. How is the CREATE owner chosen when several zero-pointer incident ELEMENTs exist?
5. Why may FROM and TO CREATE requests canonicalize into one new row?
6. What must happen when two CREATE requests claim the same endpoint with different names?
7. Explain the `1/2/3 -> 1/0/2` compaction example.
8. Why can an unselected ELEMENT legitimately require a pointer update after row deletion?
9. Which exact custody conditions are required for every changed ELEMENT pointer?
10. Why does shared physical span ownership require all affected node owners to be selected for deletion?
11. What three counts must agree before relocation begins?
12. How is `CONTROL.NONAM_after` derived?
13. Why is Phase-4A a transaction plan rather than an ordered patch list?
14. Which validations remain NOT_RUN?
15. What independent validation must Phase-4B add before physical rewrite/export is authorized?

## 13. Exact next action

Phase-4B should consume this frozen plan to implement physical output:

```text
original TARGET bytes
 -> independently rebuild final NODENAME section
 -> patch every relocation-derived ELEMENT pointer
 -> patch CONTROL.NONAM
 -> preserve every unrelated section/field
 -> re-intake
 -> independently re-derive expected post-layout from the original TARGET + scoped operations
 -> prove row order / pointer map / CONTROL count / semantic node names / topology invariance
```

Do not expand into SIF/TEE or hanger allocation until NODENAME physical rewrite and independent relocation validation are qualified.
