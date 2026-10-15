# PR1041 work report — Writer2 W2.10 RESTRAINT block DELETE/compaction planner

```text
HANDOVER_READINESS: READY
PR_RECOVERY_STATE: HEALTHY
TAKEOVER_AUTHORITY: WRITE_ALLOWED_WITHIN_ISSUE_1040
EXECUTION_MODE: MANUAL
SCOPE_AUTHORITY: LOCKED_TO_ISSUE_1040_DELETE_COMPACTION_ONLY
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: TRUE — explicit owner instruction 2026-08-23
REPOSITORY: reallaksh19/XML_Compare_Utilities
SOURCE_TASK: Issue #1040
PR: #1041
BRANCH: agent/cii-writer2-restraint-delete-compaction-w210
BASE_MAIN: a1c64e618475f55655c7650326b214e6c0918574
CURRENT_STAGE: W2_10_RESTRAINT_DELETE_COMPACTION_PLANNER_REVIEW_READY
GENERIC_RESTRAINT_CREATE: BLOCKED_UNCHANGED
PHYSICAL_WRITER_AUTHORITY: FALSE
COMPOSITE_PRODUCT_AUTHORITY: FALSE
WRITER1B_FREE_SLOT_AUTHORITY: PRESERVED
```

## Current result

W2.10 implements **planning only** for removal of complete 24-row `RESTRANT` blocks after qualified Writer1B slot CLEAR operations leave a block empty.

Planner authority:

```text
CII_WRITER_2_RESTRAINT_BLOCK_DELETE_COMPACTION_PLAN
```

The planner derives one deterministic block map:

```text
newPointer(p) = 0                                  when p is deleted
newPointer(p) = p - count(d < p, d deleted)       when p is retained
```

It derives from that one map:

```text
CONTROL restraint block count transition
complete deleted block row ranges
all affected positive ELEMENT restraint-pointer changes
retained block order
```

No bytes are mutated in this PR.

## Exact physical custody hardening

A final source audit found that generic `auxiliaryEvidence.elements` may use a FROM/TO semantic fallback when exact parsed-index binding is unavailable. That is acceptable for read-only evidence but not for relocation authority.

PR1041 therefore adds:

```text
tabs/cii-workspace/cii-workspace-writer2-restraint-delete-custody.js
```

Authority:

```text
EXACT_PARSED_INDEX_ENDPOINTS_AND_PHYSICAL_RESTRAINT_POINTER_I13
```

Each pointer owner must prove:

```text
TARGET0 original bytes
15-row physical ELEMENT block
parsed element index == physical block index
physical FROM/TO == parsed FROM/TO
row-12 restraint pointer field
exact fixed-width 13-byte I13 pointer field
semantic auxiliary pointer/endpoints agree with the physical binding
```

No FROM/TO fallback is accepted for mutation planning.

## Fail-closed gates

```text
canonical BOUND APPLY/EXCLUDE operation containers
SOURCE hash testimony bound to transferScope
TARGET0 SHA-256 recomputed from exact bytes
TARGET byte-length testimony
V11 layout
CONTROL block count == RESTRANT rows/24
24-row restraint physical custody
positive pointer in range
exact ELEMENT pointer custody
shared pointer aliases blocked
qualified Writer1B CLEAR preimage required
selected slot raw preimage equality
full block empty after selected CLEARs
TAG/GUID residue veto
duplicate slot-delete claim veto
owner-node custody
CREATE/new-block request blocked
pointer 0 unchanged
```

## Qualification matrix

Authored cases:

```text
D01 sole block -> 1->0
D02 first of 3
D03 middle of 3
D04 last of 3
D05 delete {2,4} of 5
D06 occupied sibling slot -> BLOCK
D07 TAG/GUID residue -> BLOCK
D08 owner-node mismatch -> BLOCK
D09 shared pointer alias -> BLOCK
D10 pointer out of range -> BLOCK
D11 CONTROL count mismatch -> BLOCK
D12 RESTRANT rows not multiple of 24 -> BLOCK
D13 stale TARGET hash -> BLOCK
D14 duplicate delete claim -> BLOCK and no deletion testimony
D15 CREATE -> BLOCK
D16 existing free-slot CREATE remains Writer1B
D17 pointer 0 unchanged
D18 no APPLY deletion -> BLOCK
H01 SOURCE hash mismatch -> BLOCK
H02 malformed scope container -> BLOCK
H03 stale slot preimage -> BLOCK and no deletion testimony
H04 auxiliary pointer differs from physical I13 -> BLOCK
H05 parsed endpoints do not bind physical ELEMENT block -> BLOCK
```

Independent arithmetic construction is present in the test and does not call the production relocation helper to derive its expected `{2,4}` map.

## Evidence truth

```text
merged W2.9 block/count arithmetic             PASS_MERGED_AUTHORITY
planner source                                PASS_SOURCE_INSPECTION
exact physical ELEMENT pointer custody         PASS_SOURCE_INSPECTION
D01-D18 pre-hardening local run                PASS_LOCAL_EXECUTION_EXACT_FETCHED_DEPENDENCIES_AT_TIME
H01-H03 local run                              PASS_LOCAL_EXECUTION_EXACT_FETCHED_DEPENDENCIES_AT_TIME
H04-H05 current source                         AUTHORED / PASS_SOURCE_INSPECTION
current full exact checkout                    NOT_RUN_ENVIRONMENT — github.com DNS resolution failure
current repository npm test                    NOT_RUN_ENVIRONMENT
browser/product                                NOT_APPLICABLE — unchanged route
status contexts                                absence only, never PASS
workflow runs                                  absence only, never PASS
```

Do not upgrade H04/H05 or the current exact head to native runtime PASS without actual execution.

## Scope exclusions preserved

```text
new restraint block allocation
first-block CREATE
seventh-restraint CREATE
GUID generation
restraint type/default synthesis
physical RESTRANT deletion writer
CONTROL byte mutation
ELEMENT pointer byte mutation
one-TARGET0 composite adoption
product/core/UI routing
Writer3 topology
SIF CREATE
HANGER CREATE
workflow/package/parser/converter changes
```

## Changed-file ledger

Implementation/test paths:

```text
tabs/cii-workspace/cii-workspace-writer2-restraint-delete-compaction-plan.js
tabs/cii-workspace/cii-workspace-writer2-restraint-delete-custody.js
tests/cii-workspace-writer2-restraint-delete-compaction-plan.test.js
```

Coordination paths added in closure:

```text
agents/PR1041_workreport.md
agents/status/PR1041.yaml
agents/claims/PR1041.yaml
```

`agents/MASTER_INDEX.md` must be reconciled with the post-merge roadmap in the immediate successor workstream if not included before merge; live GitHub PR/issue state remains authoritative.

## Exact next engineering phase

After W2.10 merge, the next **implementation** phase is W2.11:

```text
RESTRAINT block DELETE physical writer
```

It may consume only W2.10 plan authority and must independently validate the complete final postimage. It must perform one original-coordinate mutation transaction covering:

```text
CONTROL restraint block count
RESTRANT section 24-row block deletion/compaction
all ELEMENT restraint pointer I13 rewrites
```

No CREATE allocation is allowed.

After W2.11, use separate phases for composite adoption, product/core adoption, real-source/native roundtrip qualification, and release/freeze closure.

## Appendix A — expert takeover gate

1. Derive the old->new pointer map for deleting blocks `{2,4}` from five blocks and identify pointer changes for owners of old blocks 1..5.
2. Explain why Writer1B CLEAR and Writer2 whole-block DELETE are separate authorities and transactions.
3. Prove why a block with any occupied unselected slot cannot be physically removed.
4. Explain why blank TAG/GUID is checked on every slot before block removal.
5. Explain why `auxiliaryEvidence.elements` FROM/TO fallback is insufficient for mutation authority.
6. State the exact physical ELEMENT row/field holding the restraint pointer and its fixed width.
7. Define how TARGET0 SHA custody and exact parsed-index/endpoints prevent stale or ambiguous relocation.
8. Explain why all pointer rewrites must derive from one complete block map rather than opportunistic decrements.
9. Explain why pointer 0 is outside positive block relocation and must remain zero.
10. Explain the current shared-pointer policy and why W2.10 blocks aliases rather than inferring ownership semantics.
11. State why restraint CREATE/GUID/default semantics remain irrelevant and blocked for DELETE compaction.
12. Define the independent W2.11 complete-postimage oracle: which bytes/sections must be rebuilt without calling Writer payload helpers?
