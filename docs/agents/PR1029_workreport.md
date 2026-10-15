# PR1029 — partial H>1 HANGER one-TARGET0 composite adoption

# CURRENT STATE — READ FIRST

```text
HANDOVER_READINESS: READY
PR_RECOVERY_STATE: HEALTHY
TAKEOVER_AUTHORITY: WRITE_ALLOWED
EXECUTION_MODE: MANUAL
SCOPE_AUTHORITY: LOCKED_TO_ISSUE_1028
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
REPOSITORY: reallaksh19/XML_Compare_Utilities
SOURCE_TASK: Issue #1028
PR: #1029
BRANCH: agent/cii-writer2-hanger-partial-composite
BASE_MAIN: e9a28071aa932e5c360206d20807aeaf2e4f9517
GROUNDING_EPOCH: GE-1029-001
CURRENT_STAGE: COMPOSITE_PARTIAL_HANGER_IMPLEMENTED_SOURCE_QUALIFIED_DRAFT
CURRENT_BLOCKER: NONE_FOR_SOURCE_REVIEW
EVIDENCE_LIMITATION: NO_REAL_REPOSITORY_H_GT_1_CII_PREIMAGE
RUNTIME_LIMITATION: CURRENT_HEAD_NATIVE_EXECUTION_NOT_AVAILABLE
```

## Mission

Adopt merged PR1027 partial H>1 HANGER physical claims into the existing one-original-preimage Writer2 composite. Product/core routing, browser/UI enablement, and real H>1 product qualification remain a later separate PR.

## Ground truth / dependency

```text
PR1027 accepted head  457a2c4572c0773cdf1cd2e15fa36f6a3e305638
PR1027 merge/main     e9a28071aa932e5c360206d20807aeaf2e4f9517
PR1029 base           e9a28071aa932e5c360206d20807aeaf2e4f9517
PR1029                OPEN / DRAFT
```

No open PR was found claiming Issue1028 composite-HANGER authority. PR1007 is Writer1C physical custody and does not overlap these production paths.

# IMPLEMENTED TRANSACTION

Existing tri-family composite remains the authority surface:

```text
tabs/cii-workspace/cii-workspace-writer2-composite-hanger.js
```

It now composes from one untouched TARGET0:

```text
WRITER_2_NODENAME
WRITER_2_SIF_DELETE
WRITER_2_HANGER_DELETE_ALL
WRITER_2_HANGER_PARTIAL_DELETE
```

All family components still dry-run against the same untouched TARGET0. Their original-coordinate claims are normalized, checked against TARGET0 preimages, rejected on overlap, then applied in one final splice pass.

## ISS-1029-001 resolved — canonical partial-HANGER child scope

The legacy family projection moves sibling parent APPLY rows to `excludedOperations` but retains the parent transferScope. That remains intentionally unchanged for legacy NODENAME/SIF/delete-all components.

Merged PR1027 partial HANGER requires exact projected operation-container / BOUND-scope equality. PR1029 therefore adds a partial-only child projection:

```text
status    DERIVED_CANONICAL_BOUND_SUBSCOPE
authority PARENT_TRANSFER_SCOPE_CANONICAL_SUBSCOPE
family    WRITER_2_HANGER_PARTIAL_DELETE

child operations
  parent KEEP rows
  HANGER APPLY rows

child excludedOperations
  inherited parent EXCLUDE rows
  sibling parent APPLY rows rewritten EXCLUDE

child transferScope
  source/target hashes = exact parent custody
  applied IDs          = HANGER APPLY IDs only
  excluded IDs         = inherited EXCLUDE + sibling APPLY
  candidate IDs        = exact union
  scopeId              = <parentScopeId>::WRITER_2_HANGER_PARTIAL_DELETE
```

Parent BOUND scope custody remains a separate composite-level authority record; the child scope does not replace it.

Writer implementation commit:

```text
2af0c55368e321a1017b4b1e7f83351d2546aaf8
CII: adopt partial HANGER into one-TARGET0 composite
```

## Delete-all / partial dispatch

The composite first builds the merged HANGER delete plan using the legacy HANGER projection only to classify the authorized cardinality transition.

```text
deleteAll == true && countAfter == 0
  -> unchanged applyCiiWriter2HangerDeleteAll()
  -> legacy family projection retained
  -> authority family WRITER_2_HANGER_DELETE_ALL

partialMultiRecordDelete == true
&& countBefore > 1
&& 0 < countAfter < countBefore
  -> canonical partial-HANGER child scope
  -> applyCiiWriter2HangerPartialDelete()
  -> authority family WRITER_2_HANGER_PARTIAL_DELETE

otherwise
  -> fail closed CII_WRITER_2_COMPOSITE_HANGER_DELETE_SCOPE_UNQUALIFIED
```

The existing delete-all component is not modified.

Composite result preserves prior fields and adds split testimony:

```text
hangerDeleteAllOperations
hangerPartialDeleteOperations
hangerDeleteAllClaims
hangerPartialDeleteClaims
components.hangerDeleteAll
components.hangerPartialDelete
```

`hangerDeleteOperations` and `hangerDeleteClaims` remain aggregate compatibility fields.

# INDEPENDENT COMPLETE-POSTIMAGE VALIDATION

New validator:

```text
tabs/cii-workspace/cii-workspace-writer2-composite-hanger-partial-validation.js
```

Initial implementation:

```text
0d2e127e412bbbe602b1c15b007373cf5b141f48
CII: independently validate partial HANGER composite
```

Custody closure:

```text
5b55744b7c81af1aadb2b90034477e223532db4b
CII: close partial composite testimony custody
```

The validator does not import/call partial Writer mutation/repack helpers.

It independently:

1. rebuilds parent BOUND scope custody using validator-side composite logic;
2. derives the canonical partial-HANGER child scope independently;
3. rebuilds NODENAME/SIF plans using existing independent composite-validator logic;
4. builds the HANGER delete plan from the independent child scope;
5. independently derives retained record map/counts;
6. reuses **PR1027 independent-validator helpers** for exact raw-I13/tail/IHGRFREE partial expected replacements;
7. combines NODENAME + SIF + partial-HANGER expected claims;
8. independently arbitrates original-coordinate spans;
9. reconstructs the complete expected final CII;
10. requires exact final-byte equality;
11. rehashes/re-intakes the actual composite postimage;
12. independently reconstructs the partial-component-only expected bytes to falsify component TARGET0/postimage/representation testimony.

Primary acceptance remains:

```text
actual composite final bytes
== independently reconstructed complete expected composite bytes
```

Writer testimony is checked only after the independent byte oracle.

## Partial component custody retained at composite level

The new validator independently checks:

```text
component deletePlan record/count/packed/tail testimony
component canonical child scope testimony
component target0HashCustody
component partial-only byteString / Uint8Array / text
component byte lengths / mutation count
component postimageHashCustody
component postimageRepresentationCustody
```

Composite-level checks additionally cover:

```text
parentScopeCustody testimony
composite Uint8Array/text representation
actual after.contentSha256 against actual bytes
actual physical text/lines/line-endings against canonical re-intake
family operation/claim counts
connectivity stable
section order stable
```

# QUALIFICATION TESTS AUTHORED

## Partial-only + canonical child scope

```text
tests/cii-workspace-writer2-composite-hanger-partial.test.js
```

Commits:

```text
7ec16e44d2455e09b7f315e35b135f4e3e216829  Writer/subscope qualification
0de845e07e31413587b9db186cedd2f714ef42d9  independent oracle integration
```

Covers:

```text
H=3 delete record2 -> H'=2
partial-only composite byte parity with qualified PR1027 component
partial dispatch != delete-all
canonical child scope under sibling APPLY + inherited EXCLUDE
parent lineage testimony
malformed projected operation container rejection
original-coordinate overlap rejection
exact final-postimage tamper rejection
forged partial component plan testimony rejection
```

## True three-family variable-length case

```text
tests/cii-workspace-writer2-composite-hanger-partial-trifamily.test.js
```

Commits:

```text
47af1a191e6c237124bbd78eb622d53b9d736f5c  tri-family qualification
4f290a2beea53065161b80ecb72780745ef13a22  custody-testimony falsifiers
```

Transaction:

```text
NODENAME CREATE
  variable-length NODENAME growth
+
V11 SIF DELETE
  variable-length SIF&TEES shrinkage
+
HANGER H=3 -> H'=2 partial delete
  CONTROL.NOHGRS + complete MISCEL_1 compaction
```

All three component writers derive claims from one TARGET0 and are applied in one composite pass.

The test also falsifies:

```text
unrelated postimage drift
stale parent transferScope APPLY testimony
forged writer parentScopeCustody
forged partial-component TARGET0 hash custody
```

## Delete-all coexistence

Existing unchanged test:

```text
tests/cii-workspace-writer2-composite-hanger.test.js
```

continues to cover the tri-family HANGER delete-all path and expects:

```text
WRITER_2_HANGER_DELETE_ALL claim ownership
components.hangerDeleteAll
HANGER post count = 0
legacy independent delete-all composite validator PASS
```

The PR1029 Writer preserves all of those legacy result fields and routes delete-all through the unchanged component/legacy projection.

# SOURCE AUDIT

Merged planner source confirms each HANGER DELETE must provide:

```text
PREVIEW_READY
matchAuthority REVIEWED/LOCKED
policyAuthority CII_WRITER_2_HANGER_DELETE_COMPACTION
before=true / proposed=false
one target node identity
qualified physical record binding for partial H>1
```

The new H=3 tri-family fixture provides those fields. Record binding and retained raw-I13 authority are derived from the fixture physical bytes; they are not injected as test testimony.

# CURRENT VALIDATION TRUTH

```text
PR1027 merge                                     PASS_REMOTE_EXECUTION
PR1029 Writer source                            PASS_SOURCE_INSPECTION
canonical child subscope source                 PASS_SOURCE_INSPECTION
independent composite-partial validator source  PASS_SOURCE_INSPECTION_INDEPENDENT_ORACLE
partial-only test source                        AUTHORED / PASS_SOURCE_INSPECTION
tri-family H=3->2 test source                    AUTHORED / PASS_SOURCE_INSPECTION
delete-all legacy test source                   EXISTING / UNCHANGED
exact current-head Node execution               NOT_RUN_ENVIRONMENT
full repository npm test                        NOT_RUN_ENVIRONMENT
real repository H>1 source                      NOT_AVAILABLE
real H>1 product qualification                  OUT_OF_SCOPE / NOT_RUN_NO_REAL_SOURCE
```

Execution attempt on 2026-08-23:

```text
git ls-remote https://github.com/reallaksh19/XML_Compare_Utilities.git HEAD
-> Could not resolve host: github.com
```

No source inspection or authored test is represented as runtime PASS.

# PRODUCT / AUTHORITY BOUNDARY

Unchanged in this PR:

```text
tabs/cii-workspace/cii-workspace-writer2-composite-routing.js
tabs/cii-workspace/cii-workspace-writer2-product-routing.js
browser/UI routes
package.json
workflows
parsers/converters
```

Partial HANGER product/core readiness remains deliberately blocked for the later successor PR.

# CHANGED-FILE LEDGER — CURRENT INTENDED

```text
agents/MASTER_INDEX.md
agents/PR1029_workreport.md
agents/claims/PR1029.yaml
agents/status/PR1029.yaml
tabs/cii-workspace/cii-workspace-writer2-composite-hanger.js
tabs/cii-workspace/cii-workspace-writer2-composite-hanger-partial-validation.js
tests/cii-workspace-writer2-composite-hanger-partial.test.js
tests/cii-workspace-writer2-composite-hanger-partial-trifamily.test.js
```

Expected final reconciliation:

```text
intended = 8
actual   = 8
unexplained = 0
```

# NEGATIVE ASSURANCE

No new authority for:

```text
product/core partial HANGER APPLY
browser/UI partial HANGER execution
real H>1 qualification without a real source
HANGER CREATE/value editing
SIF CREATE
sequential family mutation against intermediate bytes
weaker PR1027 scope/container custody
weaker HANGER delete-all gate
parser/converter mutation
workflow/package mutation
```

# CURRENT DISPOSITION

```text
COMPOSITE PARTIAL-HANGER WRITER ADOPTION       IMPLEMENTED
CANONICAL CHILD BOUND SUBSCOPE                 IMPLEMENTED
DELETE-ALL COEXISTENCE                         PRESERVED
INDEPENDENT COMPLETE-POSTIMAGE VALIDATOR       IMPLEMENTED
PARTIAL-ONLY QUALIFICATION                     AUTHORED / NOT_RUN_ENVIRONMENT
TRI-FAMILY H=3->2 QUALIFICATION                AUTHORED / NOT_RUN_ENVIRONMENT
REAL H>1 SOURCE                                NOT_AVAILABLE
PRODUCT/CORE ADOPTION                          OUT_OF_SCOPE
HANDOVER READINESS                             READY
PR STATE                                       DRAFT
MERGE AUTHORITY                                OWNER_ONLY
MERGE AUTHORIZED                               FALSE
```

Keep PR1029 draft until exact path reconciliation and final source review are complete. Do not merge without fresh owner authorization.

# APPENDIX A — TAKEOVER QUALIFICATION

1. Trace a parent NODENAME + SIF DELETE + HANGER partial transaction from parent scope through child HANGER scope, four family claim sources, arbitration and final splice.
2. Explain why delete-all intentionally keeps the legacy family projection while partial HANGER requires `PARENT_TRANSFER_SCOPE_CANONICAL_SUBSCOPE`.
3. Given parent APPLY `[N1,S1,H1]` and parent EXCLUDE `[X1]`, derive the partial-HANGER child operations, excludedOperations and all three child scope ID sets exactly.
4. Explain why the new validator may reuse PR1027 **validator** raw-I13 helpers but must not import partial Writer payload/repack helpers.
5. Explain how the tri-family test proves original-coordinate composition when one sibling grows, one shrinks and MISCEL_1 shrinks, and identify the fail-closed overlap boundary.

Threshold: total >=92/100 and each >=17/20.
