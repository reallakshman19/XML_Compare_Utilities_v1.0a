# EP-CII-FR-0019 — universal auxiliary U1 requalification opened

CHAIN_ID: CII-FIND-REPLACE-V14
ENDPOINT_ID: EP-CII-FR-0019
PREDECESSOR_ENDPOINT: EP-CII-FR-0018
PR: 1081
BRANCH: feature/cii-find-replace-finish-v14
BASE_MAIN: bfe3abbb67060c1212001f2e9d967c229a057640
PRE_SCOPE_EXPANSION_HEAD: 136149b2c0becf13d186c366e67cbb985511a725
PRODUCT_MATERIAL_HEAD: 43761321967387130988590bc61877a79b632c37
QUALIFICATION_CANDIDATE_COMMIT: adc97e6718e1232a3cb377160187c43f5b7c5aea
VERIFIER_PACKET_COMMIT: 9475f8d02d7f5b18a9c3c518e869060e5e7648b1
STATE: REQUALIFICATION_REQUIRED
ENGINEERING_STATE: QUALIFICATION_PENDING
CUSTODY_STATE: HELD
QUALIFICATION_STATE: REQUALIFICATION_REQUIRED
WRITE_AUTHORITY: READ_ONLY_UNTIL_INDEPENDENT_PASS
AUTO_STATE: NOT_APPLICABLE
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
QUESTION_SET_ID: CII-FR-QS-0002
QUESTION_SET_STATUS: PENDING_INDEPENDENT_VERDICT
QUESTION_PACK_ACTION: NEW_SCOPE_QUESTION_SET
QUESTION_DISPLAY: HIDE
OWNER_PROGRESSION_COMMAND: PROCEED_NEXT

## Owner scope change

Owner expanded the desired product direction from the previously qualified block surface (`NODENAME` + `DISPLACEMENT`) to universal element-owned block Find & Replace, while explicitly preserving these boundaries:

```text
FORCE/FORCMNT          DE_SCOPED
NODENAME logic         PRESERVE unless a concrete defect exists
DISPLACEMENT semantics PRESERVE
From/To block ownership REQUIRED
```

Research established that universal block mapping must be element-pointer driven rather than section-global.

## U0 research result

The v14 ELEMENTS record carries 15 auxiliary pointers across physical rows 13-15. The expanded architecture correlates:

```text
exact From/To element
+ requested IEL pointer
+ matching CONTROL declared count
+ v14 rows-per-record
+ exact physical section cardinality
+ reverse pointer-owner set
```

before an auxiliary record can be considered owned by the selected element.

Version-specific v14 cardinality deltas are material: ALLOWBLS=28, SIF&TEES=14 and REDUCERS=2. Legacy 26/10/1 values must not be used as v14 authority.

Shared positive pointers are fail-closed for element-specific Find & Replace. Resolving shared ownership by cloning/repointing is outside Find & Replace authority.

## Qualification artifacts

Candidate answer:

`agents/qualifications/CII-FIND-REPLACE-V14/CII-FR-QS-0002-gpt56sol-answer.md`

Independent verifier packet:

`agents/evidence/PR1081_universal_auxiliary_u1_verifier_packet.md`

Expected verdict:

`agents/qualifications/CII-FIND-REPLACE-V14/CII-FR-QS-0002-gpt56sol-verdict.md`

The candidate is not allowed to write or self-confirm that verdict.

## Requested U1 authority only

A valid independent PASS may authorize only:

```text
tabs/cii-workspace/cii-workspace-find-replace-v14-aux-authority.js   NEW
tabs/cii-workspace/cii-workspace-find-replace-scope-resolver.js     MODIFY
tests/cii-workspace-find-replace-scope-resolver.test.js              MODIFY
```

U1 is a read-only ownership resolver layer plus focused tests. It does not authorize U2 mutation claims or UI/CSV expansion.

## Protected invariants

```text
TARGET0 overwrite                 DISABLED
Direct Apply-to-source            DISABLED
Writer1/Writer2 invocation        NONE
FORCE/FORCMNT delivery scope      DE_SCOPED
FORCE mutable spans               0
NODENAME resolver/validator       PRESERVE
DISPLACEMENT endpoint checks      PRESERVE
CONTROL / IEL pointer mutation    NONE
validator/executor/output custody PRESERVE
MERGE                             OWNER_ONLY / NOT AUTHORIZED
```

## Validation truth retained

```text
PR1081 exact-source UI/static closure       PASS 10/10
Merged non-benchmark Find & Replace         PASS 33/33
Merged focused Node Name                   PASS 4/4
SOURCE 3 retained-real authored runtime     NOT_RUN
Full repository suite                       NOT_RUN
Native-v14 archived fixture runtime         NOT_RUN
External CAESAR acceptance                  NOT_RUN
```

No product/test validation was executed in this metadata-only requalification transition.

## Exact next action

An independent verifier must evaluate `CII-FR-QS-0002` against the live materially reconciled repository and write the verdict artifact. Until the verdict is `PASS_WRITE_ALLOWED`, keep product/test files READ_ONLY. If PASS, implement only U1, preserve NODENAME/FORCE boundaries, and do not merge PR #1081 without explicit Owner merge authorization.
