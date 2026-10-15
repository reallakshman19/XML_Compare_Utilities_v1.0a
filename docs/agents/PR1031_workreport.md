# PR1031 — partial H>1 HANGER product/core adoption

# CURRENT STATE — READ FIRST

```text
HANDOVER_READINESS: READY
PR_RECOVERY_STATE: HEALTHY
TAKEOVER_AUTHORITY: WRITE_ALLOWED
EXECUTION_MODE: MANUAL
SCOPE_AUTHORITY: LOCKED_TO_ISSUE_1030
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
BASE_MAIN: 9f2f11ccf3b2f62cecaf75677a3dcbff39c85f6b
DEPENDENCY: PR1029 MERGED @ 9f2f11ccf3b2f62cecaf75677a3dcbff39c85f6b
CURRENT_STAGE: SOURCE_IMPLEMENTATION_COMPLETE_REVIEW_PENDING
CURRENT_BLOCKER: NONE_FOR_SOURCE_REVIEW
RUNTIME_LIMITATION: CURRENT_HEAD_NATIVE_EXECUTION_NOT_AVAILABLE
REAL_H_GT_1_SOURCE: NOT_AVAILABLE
REAL_H_GT_1_PRODUCT_ROUNDTRIP: NOT_RUN_NO_REAL_SOURCE
```

## Mission

Adopt merged PR1029 partial H>1 HANGER composite authority into explicit Writer2 product/core routing without changing the qualified physical writer or one-TARGET0 composite implementation.

## Grounded source diagnosis

At baseline `main@9f2f11cc...` two product gates remained:

1. `cii-workspace-writer2-composite-routing.js` built the qualified HANGER planner result but required every ready HANGER transaction to be delete-all (`countAfter == 0`).
2. `cii-workspace-core.js` already called the PR1029 composite Writer, but always sent its result to the legacy delete-all composite validator.

Therefore this PR changes product readiness and product validator dispatch only. The low-level Writer2 mutation call remains the merged PR1029 composite.

## Implemented production authority

### 1. Explicit product HANGER transaction classes

Implemented in:

```text
tabs/cii-workspace/cii-workspace-writer2-composite-routing.js
```

Primary implementation commit:

```text
15a9b5d76680de1512e36c3cd754c0713d1610bf
CII: admit qualified partial HANGER in product readiness
```

Compatibility correction:

```text
5edd0bcf239d2235691cc8161159d5be5fc54103
CII: preserve Writer2 readiness count contract
```

`hangerTransactionClass(plan)` returns only:

```text
DELETE_ALL
PARTIAL_H_GT_1
null / unqualified
```

Delete-all remains:

```text
plan.ready
compaction.deleteAll === true
countAfter === 0
```

Partial H>1 is admitted only when all are true:

```text
plan.ready === true
countBefore > 1
0 < countAfter < countBefore
compaction.partialMultiRecordDelete === true
compaction.plannerPartialRecordAuthority === true
compaction.partialRecordCompactionAuthorized === true
physicalCustody.recordBinding.status === QUALIFIED
physicalCustody.recordBinding.authority is nonblank
physicalCustody.recordBinding.semanticAuthority === NONE_POSITIONAL_PHYSICAL_CUSTODY_ONLY
compaction.recordBindingAuthority === physicalCustody.recordBinding.authority
```

Any other ready HANGER class fails closed with:

```text
WRITER_2_HANGER_PRODUCT_TRANSACTION_CLASS_UNQUALIFIED
```

The existing stable readiness count contract was intentionally preserved:

```text
familyMutationCounts = {
  nodeName,
  sifDelete,
  hangerDelete
}
```

Class-specific authority is exposed separately through:

```text
hangerTransactionClass
components.hangerDeleteAll
components.hangerPartialDelete
```

Policy testimony now states:

```text
hangerMutation = EXISTING_HANGER_DELETE_ALL_OR_QUALIFIED_PARTIAL
hangerPartialMultiDelete = QUALIFIED_POSITIONAL_RECORD_COMPACTION_ONLY
```

### 2. Fail-closed product validator dispatcher

New module:

```text
tabs/cii-workspace/cii-workspace-writer2-product-validation.js
```

Commit:

```text
852f5889a21de3f6f403efb2b400a01c2b85dbbe
CII: add fail-closed Writer2 product validator dispatch
```

Dispatch authority is bound to both Writer family-count testimony and component presence:

```text
hangerPartialDeleteOperations > 0
  AND components.hangerPartialDelete present
    -> validateCiiWriter2CompositeWithPartialHangerRoundTrip

hangerDeleteAllOperations > 0
  AND components.hangerDeleteAll present
    -> legacy validateCiiWriter2CompositeWithHangerRoundTrip

no HANGER operation class
    -> legacy validator for NODENAME/SIF-only Writer2 composites

count/component mismatch
    -> FAIL CLOSED

both delete-all and partial classes/components
    -> FAIL CLOSED
```

Failure codes include:

```text
CII_WRITER_2_PRODUCT_HANGER_DELETE_ALL_COMPONENT_TESTIMONY_MISMATCH
CII_WRITER_2_PRODUCT_HANGER_PARTIAL_COMPONENT_TESTIMONY_MISMATCH
CII_WRITER_2_PRODUCT_HANGER_COMPONENT_CLASS_AMBIGUOUS
```

The product validation result adds:

```text
productValidatorClass = DELETE_ALL | PARTIAL_H_GT_1 | NO_HANGER
unexpectedSemanticDeltaCount = 0
```

### 3. Core product wiring

File:

```text
tabs/cii-workspace/cii-workspace-core.js
```

Commit:

```text
10fe85954eb55e24bd9bc2e5464bdcc12a95e712
CII: dispatch Writer2 product validation by HANGER class
```

Source-diff audit against baseline proves only the intended changes:

```text
legacy Writer2 validator import
  -> product validator-dispatch import

version === '2' validation call
  -> validateCiiWriter2ProductRoundTrip(...)
```

The low-level Writer2 mutation call is unchanged:

```text
applyCiiWriter2Composite({
  targetDocument: currentTarget,
  targetGraph,
  transferPlan: preview.transferPlan
})
```

No new mutation path or intermediate-preimage writer sequence is introduced.

## Qualification authored

### Deterministic partial-only product route

New test:

```text
tests/cii-workspace-writer2-hanger-partial-product.test.js
```

Commit:

```text
51321315ec274996184a06476d08a13e4d015296
CII: qualify partial HANGER product route
```

Source-qualified synthetic case only; it is not labelled real/native:

```text
H=3
DELETE record/node 210
H'=2
retained nodes = 200,220
```

Proves in source:

```text
product plan contract routes HANGER DELETE
readiness = READY
hangerTransactionClass = PARTIAL_H_GT_1
plannerPartialRecordAuthority = true
recordBinding.status = QUALIFIED
semanticAuthority = NONE_POSITIONAL_PHYSICAL_CUSTODY_ONLY
core product apply selects independent partial-composite validator
post HANGER count = 2
retained node order = 200,220
stale target bytes rejected
missing partial-component testimony rejected
ambiguous partial+delete-all testimony rejected
```

### Deterministic tri-family partial product route

New test:

```text
tests/cii-workspace-writer2-hanger-partial-product-trifamily.test.js
```

Commit:

```text
3474fdd57066ece0db8d552fe07980d6223613f6
CII: qualify tri-family partial HANGER product route
```

Product-level transaction:

```text
NODENAME CREATE
+ V11 SIF DELETE
+ H=3 -> H'=2 HANGER partial DELETE
```

Proves in source:

```text
one TARGET0
readiness counts = nodeName 1 / sifDelete 1 / hangerDelete 1
hangerTransactionClass = PARTIAL_H_GT_1
product apply returns independent partial-composite validation
post NODENAME target 80 = N80
post SIF block count = 2
post HANGER count = 2
retained HANGER nodes = 200,220
```

### Existing delete-all product regression preserved

Updated test:

```text
tests/cii-workspace-writer2-composite-product-routing.test.js
```

Commit:

```text
300534834f3db42768682cbad4defd953f3614bf
CII: preserve delete-all product regression under validator dispatch
```

The existing H=1 tri-family delete-all product result remains:

```text
hangerTransactionClass = DELETE_ALL
legacy validation schema = CIIWorkspaceWriter2CompositeHangerValidation.v1
productValidatorClass = DELETE_ALL
post HANGER count = 0
```

Writer1B remains the product default; Writer2 remains explicit-only.

## Source audit / negative assurance

PR diff audit shows `cii-workspace-core.js` differs from baseline only by:

```text
3 additions
4 deletions
```

corresponding to the validator import and Writer2 validation call. No unrelated core orchestration change is present.

No changes to:

```text
physical partial-HANGER Writer
PR1029 one-TARGET0 composite Writer
PR1029 independent partial-composite validator
HANGER CREATE/value editing
SIF CREATE
Writer3
parsers/converters
package.json
package-lock.json
.github/workflows/**
browser/UI redesign
```

## Validation truth

```text
PR1029 merge                                      PASS_REMOTE_EXECUTION
PR1031 readiness source                          PASS_SOURCE_INSPECTION
PR1031 product validator-dispatch source         PASS_SOURCE_INSPECTION
core product diff containment                    PASS_SOURCE_INSPECTION
partial-only product qualification source        AUTHORED / PASS_SOURCE_INSPECTION
tri-family partial product qualification source  AUTHORED / PASS_SOURCE_INSPECTION
delete-all product non-regression source         UPDATED / PASS_SOURCE_INSPECTION
exact current-head focused Node execution        NOT_RUN_ENVIRONMENT
repository-wide npm test                         NOT_RUN_ENVIRONMENT
browser product apply                            NOT_RUN_ENVIRONMENT
real repository H>1 source                       NOT_AVAILABLE
real H>1 product roundtrip                       NOT_RUN_NO_REAL_SOURCE
```

Native execution attempt:

```text
git ls-remote https://github.com/reallaksh19/XML_Compare_Utilities.git HEAD
fatal: Could not resolve host: github.com
```

No authored/source-inspected test is represented as runtime PASS.

## Real-source evidence boundary

Merged PR1027 census established no repository CII with `NOHGRS > 1`. PR1029 and PR1031 do not add a `.CII` source. Therefore:

```text
REAL_REPOSITORY_H_GT_1_CII_SOURCE = NOT_AVAILABLE
REAL_H_GT_1_PRODUCT_ROUNDTRIP = NOT_RUN_NO_REAL_SOURCE
```

The deterministic H=3 tests are source-qualified synthetic physical/product fixtures only. They are not native CAESAR evidence.

First genuine H>1 source remains a dedicated qualification event.

## Changed-file ledger

Intended final paths:

```text
agents/MASTER_INDEX.md
agents/PR1031_workreport.md
agents/claims/PR1031.yaml
agents/status/PR1031.yaml
tabs/cii-workspace/cii-workspace-core.js
tabs/cii-workspace/cii-workspace-writer2-composite-routing.js
tabs/cii-workspace/cii-workspace-writer2-product-validation.js
tests/cii-workspace-writer2-composite-product-routing.test.js
tests/cii-workspace-writer2-hanger-partial-product.test.js
tests/cii-workspace-writer2-hanger-partial-product-trifamily.test.js
```

Expected: **10 paths / 0 unexplained**.

Temporary `agents/WIP-issue1030-product-partial-hanger.md` was retired after PR allocation and does not remain in the final diff.

## Appendix A — takeover questions

1. Why must product readiness classify `DELETE_ALL` and `PARTIAL_H_GT_1` explicitly rather than accept any `hangerPlan.ready`?
2. List every planner/physical field that proves positional-only partial-HANGER record authority.
3. Why is `physicalCustody.recordBinding.semanticAuthority = NONE_POSITIONAL_PHYSICAL_CUSTODY_ONLY` a mandatory product gate?
4. Why does PR1031 not add or alter a Writer mutation implementation?
5. How is partial vs delete-all validator dispatch bound to both counts and component testimony?
6. What failure occurs if both HANGER component classes are present?
7. Why was the historical three-field `familyMutationCounts` readiness shape preserved?
8. Which product-level case proves simultaneous NODENAME CREATE + SIF DELETE + HANGER partial compaction?
9. Which evidence is synthetic/source-qualified and which is real/native?
10. Why must real H>1 product qualification remain `NOT_RUN_NO_REAL_SOURCE` until a genuine source appears?
