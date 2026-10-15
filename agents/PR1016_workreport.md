# PR1016 — Writer 2 one-original-preimage cardinality composite

# CURRENT RECOVERY STATE — READ FIRST

```text
HANDOVER_READINESS: READY
REPOSITORY: reallaksh19/XML_Compare_Utilities
PR: #1016
BRANCH: agent/cii-writer2-composite-one-preimage
BASE: main@d5ecd8ac356cebba6027d7d6446e644053632565
MISSION: compose qualified Writer-2 NODENAME cardinality mutations and V11 SIF DELETE from one untouched TARGET preimage
CURRENT_STAGE: COMPOSITE_HARDENED_CANONICAL_SCOPE_CUSTODY_AWAITING_REPOSITORY_EXECUTION
MERGE_AUTHORITY: OWNER_ONLY
```

## 1. Why this PR exists

PR1013 routed Writer-2 NODENAME through the product. PR1014/PR1015 then qualified and implemented physical V11 SIF/TEE existing-block DELETE. Both NODENAME and SIF block mutation can change file byte length.

Sequential execution is invalid:

```text
TARGET0
 -> NODENAME Writer2 changes byte length
 -> SIF Writer2 uses offsets qualified against TARGET0
```

The second writer's original byte coordinates no longer refer to the same physical positions after the first variable-length pass.

PR1016 therefore composes both families from one untouched preimage and patches once.

## 2. Qualified component authorities reused unchanged

### NODENAME

Merged PR1011/PR1012 authority:

- CREATE/DELETE only;
- exact ELEMENT/NODENAME custody;
- deterministic row allocation/compaction;
- complete NODENAME pointer relocation;
- CONTROL.NONAM after-count;
- physical variable-length writer.

### V11 SIF/TEE

Merged PR1014/PR1015 authority:

- existing complete 10-row block DELETE only;
- exact V11 10-row physical custody;
- all-owner shared-pointer veto;
- complete SIF pointer relocation;
- CONTROL SIF-count after value;
- retained blocks copied byte-for-byte.

SIF CREATE remains blocked:

`WRITER_2_SIF_CREATE_PAYLOAD_SEMANTICS_UNQUALIFIED_ITEMS_27_30`

## 3. Composite transaction model

Input must already have the canonical user-bound explicit APPLY/EXCLUDE scope produced by `applyCiiTransferScope()`.

Allowed APPLY operations:

```text
NODE_NAME / Node name / to-name / CREATE
NODE_NAME / Node name / to-name / DELETE
SIF_TEE / SIF/Tee record presence / DELETE
```

A manually forced SIF CREATE preserves the established semantic blocker. Any other APPLY operation blocks with `CII_WRITER_2_COMPOSITE_UNSUPPORTED_APPLY`.

Before family projection, the composite now proves the parent scope itself:

```text
transferScope.mode      == EXPLICIT_APPLY_EXCLUDE
transferScope.status    == BOUND
transferScope.authority == USER_EXPLICIT_OPERATION_SCOPE
scopeId                 nonblank
sourceSha256             == transferPlan.sourceDocument.contentSha256
targetSha256             == transferPlan.targetDocument.contentSha256
                         == TARGET0.contentSha256
candidateOperationIds    exact mutable candidate ids
appliedOperationIds      exact APPLY ids
excludedOperationIds     exact EXCLUDE ids
```

All plan operation IDs and all scope ID arrays must be nonblank and duplicate-free. APPLY and EXCLUDE sets must be disjoint. Set-equivalence alone is not sufficient because deduplication can hide cardinality defects.

For each qualified family the composite then creates an explicitly derived subset:

```text
familyProjection.status    = DERIVED_BOUND_SUBSET
familyProjection.authority = PARENT_TRANSFER_SCOPE_SUBSET_ONLY
familyProjection.parentScopeId = original user-bound scopeId
```

The original `transferScope` object is preserved unchanged. The projection may only remove sibling APPLY operations from a component view; it cannot invent a new APPLY decision.

Each merged Phase-4B component writer dry-runs from the same TARGET0 and emits candidate original-coordinate replacement claims.

## 4. Physical claim classes

Potential original-coordinate claims are:

```text
WRITER_2_NODENAME
  CONTROL_NONAM
  ELEMENT_NODENAME_POINTER
  NODENAME_SECTION_PAYLOAD

WRITER_2_SIF_DELETE
  CONTROL_SIF_TEE_COUNT
  ELEMENT_SIF_TEE_POINTER
  SIF_TEE_SECTION_PAYLOAD
```

Every claim must prove:

```text
0 <= byteStart <= byteEnd <= len(TARGET0)
TARGET0[byteStart:byteEnd] == beforeField
```

All claims are sorted in TARGET0 coordinates. Any overlap blocks, including same-postimage overlap. Adjacent ELEMENT row-13 SIF and NODENAME pointer fields are allowed because their spans are disjoint.

The TARGET is patched exactly once.

## 5. Independent validator

The final validator does not use the composite mutation ledger as authorization and independently rechecks the parent transfer-scope custody rather than importing the writer's scope verifier.

It independently:

1. validates canonical parent scope mode/status/authority/scopeId;
2. verifies source/target hashes;
3. verifies exact candidate/APPLY/EXCLUDE operation-id cardinality, uniqueness and disjointness;
4. independently derives the NODENAME and SIF family subsets from that parent scope;
5. rebuilds the merged PR1011 NODENAME relocation plan from TARGET0;
6. rebuilds the merged PR1014 SIF DELETE relocation plan from TARGET0;
7. independently formats CONTROL integer fields;
8. independently formats relocated pointer fields using a separate six-significant-digit oracle;
9. independently reconstructs the NODENAME payload;
10. independently reconstructs the retained SIF payload directly from TARGET0 bytes;
11. arbitrates the independently derived original-coordinate claims;
12. constructs the complete expected variable-length postimage;
13. requires actual post bytes == expected post bytes.

Defense-in-depth also checks:

- post image remains original-byte eligible;
- composite schema/status/writer/mode contract;
- mutation count;
- family operation/claim counts;
- both CONTROL counts;
- NODENAME and SIF row counts;
- complete NODENAME pointer snapshot;
- complete SIF pointer snapshot;
- NODENAME semantic postimage;
- connectivity unchanged;
- section order unchanged;
- parent-scope testimony matches independent custody;
- composite mutation testimony matches independent claims;
- component relocation testimony matches independently rebuilt plans;
- SIF CREATE authority remains blocked.

## 6. Regression fixtures

The authored mixed fixture deliberately places NODENAME before SIF and performs:

```text
NODENAME CREATE at node 80
  row count 3 -> 4
  byte length increases before SIF section

SIF DELETE block 2
  block count 3 -> 2
  SIF pointers 1,2,3,0 -> 1,0,2,0
  byte length decreases later in file
```

This is a direct anti-sequential-drift case.

Additional falsifiers authored:

- unrelated REDUCERS payload tamper -> validator rejection;
- forged final composite mutation ledger -> rejection;
- forged SIF component relocation testimony -> rejection;
- forged parent scope APPLY set -> writer and validator rejection;
- synthetic cross-family overlapping original spans -> composite blocks;
- unsupported PROCESS APPLY -> composite blocks;
- forced SIF CREATE -> semantic blocker retained;
- duplicate plan operation IDs -> writer and validator rejection;
- duplicate scope operation IDs -> writer and validator rejection;
- APPLY/EXCLUDE operation-ID overlap -> rejection;
- target hash drift -> writer and validator rejection.

## 7. Qualification findings

### QF-1016-001 — recursive freeze defect

Initial composite code returned `deepFreeze(result)`.

Repository `deepFreeze()` recursively calls `Object.freeze()` on every object. Node throws on a non-empty `Uint8Array`:

```text
TypeError: Cannot freeze array buffer views with elements
```

The composite result and both component results contain byte arrays.

Fix:

```text
outer composite result    -> shallow Object.freeze
components envelope       -> shallow Object.freeze
plain claim/metadata data -> deepFreeze remains permitted
Uint8Array bytes           -> not recursively frozen
```

### QF-1016-002 — projected subset falsely represented as bound user scope

Initial composite projection changed sibling `scopeDecision=APPLY` rows to `EXCLUDE` while retaining a `BOUND` scope object as if that altered operation set were itself user-bound.

The real PR1001 scope contract binds source hash, target hash and the complete candidate/APPLY/EXCLUDE operation ID sets. A derived family subset is not a new user decision.

Fix:

- prove the original parent scope first;
- preserve the original `transferScope` object unchanged;
- identify each internal family view as `DERIVED_BOUND_SUBSET / PARENT_TRANSFER_SCOPE_SUBSET_ONLY`;
- allow projection only by removing sibling APPLY operations from the component view.

### QF-1016-003 — duplicate operation IDs hidden by set comparison

Initial parent-scope comparison normalized ID lists with `Set`, which could make a duplicated operation ID appear equivalent to a single authorized ID.

Fix:

- plan operation IDs must be nonblank and globally unique across active + excluded rows;
- parent APPLY and EXCLUDE IDs must each be unique and disjoint;
- scope candidate/APPLY/EXCLUDE arrays must each be nonblank-ID and duplicate-free;
- writer and validator enforce these independently.

## 8. Changed-file ledger

Implementation/test:

```text
tabs/cii-workspace/cii-workspace-writer2-composite.js
tabs/cii-workspace/cii-workspace-writer2-composite-validation.js
tests/cii-workspace-writer2-composite.test.js
tests/cii-workspace-writer2-composite-scope-custody.test.js
```

Recovery:

```text
agents/PR1016_workreport.md
agents/status/PR1016.yaml
agents/claims/PR1016.yaml
agents/MASTER_INDEX.md
```

No changes to:

- protected converter;
- fixed-field parser;
- Writer1A/1B/1C;
- merged NODENAME planners/writers/validators;
- merged SIF DELETE planner/writer/validator;
- PR1001 transfer-scope implementation;
- product/core routing in this PR;
- benchmark CII;
- workflow.

## 9. Validation truth

```text
PR1015 merge / current-main grounding                 PASS
branch ancestry                                      PASS_GIT_COMPARE
PR1001 transfer-scope compatibility audit             PASS_SOURCE_INSPECTION
canonical-scope projection audit                      PASS_SOURCE_INSPECTION
new composite writer initial syntax                   PASS_LOCAL_SOURCE_BEFORE_PUBLICATION
new composite validator initial syntax                PASS_LOCAL_SOURCE_BEFORE_PUBLICATION
new mixed regression initial syntax                   PASS_LOCAL_SOURCE_BEFORE_PUBLICATION
Uint8Array deepFreeze defect                         PASS_LOCAL_REPRODUCTION_AND_SOURCE_FIX
post-hardening writer/validator syntax                NOT_RUN_ENVIRONMENT
scope-custody falsifier regression                    AUTHORED_NOT_RUN_ENVIRONMENT
repository mixed composite regression                AUTHORED_NOT_RUN_ENVIRONMENT
inherited Writer2 NODENAME regressions               NOT_RUN_ENVIRONMENT
inherited Writer2 SIF DELETE regressions             NOT_RUN_ENVIRONMENT
inherited Writer1A/1B/1C regressions                 NOT_RUN_ENVIRONMENT
full npm test                                        NOT_RUN_ENVIRONMENT
browser/product flow                                 NOT_RUN_ENVIRONMENT
real CII mixed export/re-intake                      NOT_RUN_ENVIRONMENT
```

The execution container still cannot resolve `github.com` for an exact checkout. Do not upgrade authored tests to PASS without execution evidence.

## 10. Exact next action after PR1016 disposition

Route Writer 2 through this composite rather than the current NODENAME-only core path:

```text
base engineering deltas
 -> Writer2 routing adapter recognizes:
      NODENAME CREATE/DELETE
      V11 SIF existing-block DELETE
 -> canonical explicit APPLY/EXCLUDE scope
 -> composite readiness for all APPLY operations
 -> one-preimage composite apply
 -> re-intake composite bytes
 -> independent composite validator
 -> binary-authoritative Modified_<target>.cii export
```

Do not route SIF DELETE as a second sequential pass after the currently routed NODENAME writer.

SIF CREATE remains blocked.

# Appendix A — next-agent qualification

1. Why is sequential NODENAME then SIF Writer-2 application invalid even if each standalone writer validates independently?
2. Which six physical claim classes can PR1016 compose?
3. What exact preimage equation must every component claim satisfy?
4. Why does adjacency between ELEMENT SIF and NODENAME pointer fields not constitute overlap?
5. What happens if two component claims overlap with identical postimages?
6. Why are component mutation ledgers testimony rather than authorization?
7. Why must the original user-bound transferScope remain unchanged in a family projection?
8. What does `DERIVED_BOUND_SUBSET` authorize and what can it never do?
9. Which transfer-scope hashes and operation-ID sets are rechecked before any component dry run?
10. Why is set equality insufficient to prove operation cardinality?
11. How does the validator independently rebuild the NODENAME payload?
12. How does it rebuild the SIF payload without interpreting retained SIF internal semantics?
13. Why must SIF CREATE remain blocked in the composite?
14. What runtime defect occurs if the composite result is recursively `deepFreeze`d?
15. What fixture proves true variable-length offset drift rather than same-length composition?
16. Which unsupported APPLY families must fail closed?
17. What must the product/core successor route to avoid reintroducing sequential mutation?
18. Which repository/browser tests remain NOT_RUN?
