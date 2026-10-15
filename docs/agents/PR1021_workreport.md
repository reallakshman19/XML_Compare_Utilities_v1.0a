# PR1021 — Writer 2 tri-family one-preimage composite

# CURRENT RECOVERY STATE — READ FIRST

```text
HANDOVER_READINESS: READY
REPOSITORY: reallaksh19/XML_Compare_Utilities
PR: #1021
BRANCH: agent/cii-writer2-composite-hanger-delete-all
BASE: main@a16a3f2ee05abb5adf6ae5801620dd0fd1bdb1f2
MISSION: compose NODENAME CREATE/DELETE + V11 SIF DELETE + HANGER DELETE-ALL from one untouched TARGET preimage
CURRENT_STAGE: TRI_FAMILY_COMPOSITE_AND_INDEPENDENT_VALIDATOR_AUTHORED
TAKEOVER_AUTHORITY: WRITE_ALLOWED
MERGE_AUTHORITY: OWNER_ONLY
```

## 1. Scope

PR1021 adds a new qualification layer only:

```text
WRITER_2_NODENAME
WRITER_2_SIF_DELETE
WRITER_2_HANGER_DELETE_ALL
```

All component writers receive the same untouched TARGET0. Their original-coordinate physical claims are arbitrated together and TARGET0 is patched exactly once.

This PR deliberately does **not** change:

```text
cii-workspace-core.js
cii-workspace-writer2-composite-routing.js
product/UI routing
Writer1B default
existing merged NODENAME/SIF product composite
```

The successor product-routing PR may switch the product only after this tri-family layer is accepted.

## 2. Inherited authority

Merged foundations:

```text
PR1001 explicit APPLY/EXCLUDE parent scope custody
PR1011/1012 NODENAME CREATE/DELETE planner + physical writer
PR1014/1015 V11 SIF existing-block DELETE planner + physical writer
PR1016 one-preimage NODENAME/SIF composite architecture
PR1019 HANGER DELETE planning authority
PR1020 HANGER delete-all physical writer + independent postimage validator
```

Stable blockers inherited unchanged:

```text
WRITER_2_SIF_CREATE_PAYLOAD_SEMANTICS_UNQUALIFIED_ITEMS_27_30
WRITER_2_HANGER_CREATE_PAYLOAD_SEMANTICS_NOT_QUALIFIED
WRITER_2_HANGER_PARTIAL_MULTI_RECORD_TAIL_ORDER_UNQUALIFIED
```

## 3. Why sequential execution is invalid

Each family can change byte length:

```text
NODENAME CREATE        section grows
SIF DELETE             section shrinks
HANGER DELETE-ALL      MISCEL_1 shrinks
```

Therefore this is invalid:

```text
TARGET0 -> NODENAME output -> SIF using TARGET0 offsets -> HANGER using TARGET0 offsets
```

After the first variable-length mutation, downstream original offsets are stale.

The accepted architecture is:

```text
one untouched TARGET0
 |-- NODENAME family projection -> physical claims in TARGET0 coordinates
 |-- SIF DELETE family projection -> physical claims in TARGET0 coordinates
 |-- HANGER DELETE-ALL projection -> physical claims in TARGET0 coordinates

all claims
 -> exact TARGET0 preimage check
 -> original-coordinate sort
 -> cross-family overlap veto
 -> patch TARGET0 exactly once
```

## 4. Parent-scope custody

The tri-family writer independently requires the canonical PR1001 parent scope:

```text
status    = BOUND
mode      = EXPLICIT_APPLY_EXCLUDE
authority = USER_EXPLICIT_OPERATION_SCOPE
scopeId   = nonblank
```

It proves:

```text
plan operation IDs unique
APPLY IDs unique
EXCLUDE IDs unique
APPLY ∩ EXCLUDE = empty
plan APPLY == scope APPLY
plan EXCLUDE == scope EXCLUDE
candidate set == scope candidate set
source hash == scope source hash
target hash == scope target hash == TARGET0 hash
```

Family projections do not manufacture new authority. They retain the parent scope object and label themselves:

```text
DERIVED_BOUND_SUBSET
PARENT_TRANSFER_SCOPE_SUBSET_ONLY
```

## 5. Physical claim classes

Potential claims are limited to already-qualified component outputs.

NODENAME:

```text
CONTROL_NONAM
ELEMENT_NODENAME_POINTER
NODENAME_SECTION_PAYLOAD
```

SIF DELETE:

```text
CONTROL_SIF_TEE_COUNT
ELEMENT_SIF_TEE_POINTER
SIF_TEE_SECTION_PAYLOAD
```

HANGER DELETE-ALL:

```text
CONTROL_HANGER_COUNT
MISCEL_1_HANGER_DELETE_ALL_PAYLOAD
```

Every claim must satisfy:

```text
0 <= byteStart <= byteEnd <= len(TARGET0)
TARGET0[byteStart:byteEnd] == beforeField
```

Any physical overlap blocks, even if two after-images would be identical.

CONTROL row-1 fields are explicitly adjacent/disjoint:

```text
NOHGRS  field3  [28,41)
NONAM   field4  [41,54)
```

Adjacency is allowed; overlap is not.

## 6. Independent validator

`cii-workspace-writer2-composite-hanger-validation.js` does not import the tri-family writer's claim/arbitration helpers.

From untouched TARGET0 + target graph + bound transfer plan it independently:

1. validates parent-scope custody;
2. independently derives family subsets;
3. rebuilds the NODENAME relocation plan;
4. rebuilds the V11 SIF DELETE relocation plan;
5. rebuilds the HANGER DELETE plan and requires `deleteAll=true`, `countAfter=0`;
6. derives exact CONTROL fields from fixed-width coordinates;
7. independently reconstructs NODENAME payload bytes;
8. independently reconstructs retained SIF block bytes;
9. independently derives MISCEL_1 postimage as original RRMAT/VFLEX prefix + four original execution rows;
10. independently arbitrates all original-coordinate claims;
11. constructs the complete expected variable-length postimage;
12. requires actual post bytes == independently expected bytes.

Defense-in-depth also checks:

```text
writer result contract
writer byteString == actual post bytes
mutation count/testimony
family operation/claim counts
parent-scope testimony
component plan testimony
post NODENAME custody/count/pointers
post SIF custody/count/rows/pointers
post HANGER count=0/layout=NONE/MISCEL row count
connectivity unchanged
section order unchanged
```

Writer ledgers are testimony, never authorization.

## 7. Mixed drift regression

`tests/cii-workspace-writer2-composite-hanger.test.js` authors a true three-family transaction:

```text
NODENAME CREATE node80
  NODENAME count 3 -> 4
  earlier section grows

SIF DELETE pointer2
  SIF blocks 3 -> 2
  middle section shrinks

HANGER DELETE-ALL node20
  NOHGRS 1 -> 0
  MISCEL_1 17 -> 5 rows
  later section shrinks
```

The test asserts all three payload claim classes exist and validates the final combined postimage independently.

Adversarial checks authored:

```text
unrelated UNITS byte tamper -> validator BLOCK
forged composite mutation ledger -> validator BLOCK
forged HANGER component delete-plan testimony -> validator BLOCK
CONTROL NOHGRS/NONAM adjacency -> accepted as disjoint
synthetic cross-family overlap -> BLOCK
invalid HANGER policy/partial bypass attempt -> BLOCK
```

## 8. Changed-file ledger

```text
tabs/cii-workspace/cii-workspace-writer2-composite-hanger.js
  tri-family one-preimage physical composition

tabs/cii-workspace/cii-workspace-writer2-composite-hanger-validation.js
  independent tri-family full-postimage validator

tests/cii-workspace-writer2-composite-hanger.test.js
  mixed drift + falsifiers

agents/PR1021_workreport.md
agents/status/PR1021.yaml
agents/claims/PR1021.yaml
agents/MASTER_INDEX.md
  recovery/continuity only
```

No protected converter/parser, product/core, UI, benchmark CII, or workflow file is modified.

## 9. Validation truth

```text
PR1020 merge / PR1021 base grounding                   PASS
tri-family architecture/source audit                   PASS_SOURCE_INSPECTION
parent-scope custody parity with PR1016                 PASS_SOURCE_INSPECTION
CONTROL NOHGRS/NONAM coordinate adjacency review       PASS_SOURCE_INSPECTION
tri-family focused JS regression                       AUTHORED_NOT_RUN_ENVIRONMENT
merged PR1020 HANGER physical regression               NOT_RUN_ENVIRONMENT
merged NODENAME/SIF composite regressions              NOT_RUN_ENVIRONMENT
full repository tests                                  NOT_RUN_ENVIRONMENT
browser/product                                        NOT_RUN_ENVIRONMENT
real-CII tri-family product round trip                  NOT_RUN_ENVIRONMENT
```

Do not promote authored tests to PASS without executed evidence.

## 10. Exact next phase after acceptance

Create a separate product/core routing PR:

```text
base engineering deltas
 -> Writer2 requalification for NODENAME / SIF DELETE / HANGER DELETE-ALL
 -> explicit parent APPLY/EXCLUDE scope
 -> tri-family readiness
 -> applyCiiWriter2CompositeWithHangerDeleteAll(TARGET0,...)
 -> re-intake final bytes
 -> validateCiiWriter2CompositeWithHangerRoundTrip(...)
 -> binary-authoritative export
```

Do not route HANGER as a sequential pass after the current product composite.

## Appendix A — takeover qualification

1. Why is sequential NODENAME -> SIF -> HANGER mutation invalid?
2. Which exact physical claim classes can each family emit?
3. Why are CONTROL.NO HGRS and NONAM allowed simultaneously?
4. What parent-scope sets must match exactly?
5. Why may family projections exclude sibling APPLY rows without becoming new user authority?
6. What blocker still prohibits partial H>1 hanger deletion?
7. What blocker still prohibits HANGER CREATE?
8. What blocker still prohibits SIF CREATE?
9. How does the validator derive the HANGER MISCEL_1 after-image without knowing HGRDAT/TAG ordering?
10. Why are component writer mutation ledgers testimony rather than authorization?
11. What final byte equality proves the variable-length transaction?
12. Which files must remain untouched until the product-routing successor?
