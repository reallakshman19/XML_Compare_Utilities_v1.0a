# PR1081 universal auxiliary U1 independent-verifier packet

CHAIN_ID: CII-FIND-REPLACE-V14
PR: 1081
QUESTION_SET_ID: CII-FR-QS-0002
QUALIFICATION_SCOPE_ID: QSCOPE-PR1081-UNIVERSAL-AUX-U1
QUALIFICATION_BASIS_HEAD: 136149b2c0becf13d186c366e67cbb985511a725
CANDIDATE_ID: GPT-5.6-SOL-2026-09-02-B
VERIFIER_REQUIRED: TRUE
SELF_VERIFICATION_ALLOWED: FALSE

## Purpose

This packet is for an independent verifier. It does not contain a verdict and does not grant product/test write authority.

Candidate artifact:

`agents/qualifications/CII-FIND-REPLACE-V14/CII-FR-QS-0002-gpt56sol-answer.md`

Expected verdict artifact:

`agents/qualifications/CII-FIND-REPLACE-V14/CII-FR-QS-0002-gpt56sol-verdict.md`

Required PASS threshold under the active engineering-pr-delivery-v2 qualification model:

- Q1..Q5 each >= 17/20;
- total >= 92/100;
- no automatic-failure condition;
- verifier identity differs from candidate identity;
- verdict basis is reconciled to the qualification material basis;
- PASS authority is limited to the U1 files/tests listed below.

## Qualification boundary

U1 qualifies a read-only universal auxiliary ownership layer only:

```text
From/To
 -> exact 15-row ELEMENTS block
 -> requested v14 auxiliary family
 -> IEL pointer
 -> matching CONTROL count
 -> exact physical section rows
 -> count/cardinality correlation
 -> reverse pointer-owner reconstruction
 -> exact pointer-owned record
```

It does NOT qualify generic mutation claims, UI/CSV expansion, topology changes, pointer rewrites, CONTROL rewrites, Node Name changes, FORCE/FORCMNT, Writer1/Writer2, or merge.

## Independent evidence anchors

Verifier should inspect at minimum:

1. `tabs/cii-workspace/cii-workspace-find-replace-scope-resolver.js`
   - exact 15-row ELEMENTS grouping;
   - current DISPLMNT pointer at zero-based row12/field4;
   - current NODENAME/DISPLACEMENT/FORCE dispatch.

2. `tabs/cii-workspace/cii-workspace-find-replace-nodename-scope.js`
   - NODENAME pointer zero-based row13/field5;
   - CONTROL NONAM correlation;
   - reverse owner map precedent;
   - must remain unchanged by U1.

3. `converters/scripts/cii-v11-v14-upstream/cii_v11_v14_validate.py`
   - `_control_block_counts()` mapping;
   - `V14_AUX_ROWS`;
   - exact `count * rowsPerBlock` v14 validation.

4. `converters/scripts/cii-v11-v14-upstream/cii_v11_v14_records.py`
   - ALLOWBLS v14 = 28 rows;
   - SIF&TEES v14 = 14 rows;
   - REDUCERS v14 = 2 rows.

5. `docs/cii-writer2-v14-native-benchmark-change-isolation-2026-08-26.md`
   - native-v14 physical profile including 112x15 ELEMENTS, 40x24 RESTRANT, 2x14 SIF&TEES, 1x2 REDUCERS.

6. `tabs/cii-workspace/cii-workspace-v14-writer2-fixed-field-authority.js`
   - corroborating NODENAME/RESTRANT/SIF CONTROL and IEL identities;
   - must not be treated as Find & Replace mutation authority.

7. official CAESAR II v14 neutral-file documentation for the 15 IEL positions, CONTROL order and auxiliary record layouts.

## Expected v14 registry

The verifier should independently confirm this table before PASS:

```text
IEL  family       element pointer   CONTROL count   rows/record
1    BEND         r13 f1            r2 f1            3
2    RIGID        r13 f2            r2 f2            1
3    EXPJT        r13 f3            r2 f3            1
4    RESTRANT     r13 f4            r2 f4           24
5    DISPLMNT     r13 f5            r2 f5           20
6    FORCMNT      r13 f6            r2 f6           20 / DE_SCOPED
7    UNIFORM      r14 f1            r3 f1            6
8    WIND         r14 f2            r3 f2            1
9    OFFSETS      r14 f3            r3 f3            1
10   ALLOWBLS     r14 f4            r3 f4           28
11   SIF&TEES     r14 f5            r3 f5           14
12   NODENAME     r14 f6            r1 f4            1 / EXISTING SPECIAL
13   REDUCERS     r15 f1            r1 f5            2
14   FLANGES      r15 f2            r1 f6           12
15   EQUIPMNT     r15 f3            r4 f1            6
```

Rows/fields above are physical 1-based labels. Implementation can derive zero-based pointer location with:

```text
rowIndex   = 12 + floor(pointerIndex / 6)
fieldIndex = pointerIndex % 6
```

for pointerIndex 0..14.

## Mandatory fail-closed cases

A PASS must require focused tests or an implementation plan that blocks:

- zero pointer;
- malformed/non-integral pointer;
- pointer > CONTROL count;
- missing target section when CONTROL/pointer require it;
- `sectionRows != CONTROL count * rowsPerRecord`;
- legacy v11/2019 cardinalities used as v14 cardinalities for ALLOWBLS/SIF&TEES/REDUCERS;
- duplicate exact From/To element identity;
- shared positive auxiliary pointer owned by more than one element for an element-specific operation;
- loss of meaningful blank physical payload rows, especially FLANGES;
- comments or other rows that make fixed-record indexing ambiguous;
- FORCE/FORCMNT admission.

## Regression requirements

### Node Name

U1 must not modify:

`tabs/cii-workspace/cii-workspace-find-replace-nodename-scope.js`

The existing NODENAME resolution/claim behavior must remain unchanged.

### Displacement

The existing endpoint identity checks must remain semantically unchanged. U1 may replace only pointer/cardinality plumbing with the common helper and should strengthen cardinality to CONTROL-derived validation.

## Minimal PASS-authorized material paths

Only after independent PASS:

```text
tabs/cii-workspace/cii-workspace-find-replace-v14-aux-authority.js   NEW
tabs/cii-workspace/cii-workspace-find-replace-scope-resolver.js     MODIFY
tests/cii-workspace-find-replace-scope-resolver.test.js              MODIFY
```

No other product/test path is required for U1.

## Truthful validation boundary

Existing evidence remains exactly:

```text
PR1081 exact-source UI/static closure       PASS 10/10
Merged non-benchmark Find & Replace         PASS 33/33
Merged focused Node Name                   PASS 4/4
SOURCE 3 retained-real authored runtime     NOT_RUN
Full repository suite                       NOT_RUN
Native-v14 archived fixture runtime         NOT_RUN
External CAESAR acceptance                  NOT_RUN
```

The verifier must reject any answer or verdict that upgrades a NOT_RUN gate from documentation/source inspection alone.

## Automatic-failure watchlist

Return FAIL/STALE rather than PASS if the candidate or planned patch:

- uses section-global search instead of element pointer ownership;
- assumes pointer alone is sufficient without CONTROL/cardinality correlation;
- derives v14 ALLOWBLS/SIF&TEES/REDUCERS sizes from legacy 26/10/1 rules;
- treats shared pointers as safe for element-specific mutation;
- modifies NODENAME logic without a concrete defect;
- removes DISPLACEMENT endpoint checks;
- enables or qualifies FORCE/FORCMNT;
- borrows Writer2 mutation authority;
- rewrites CONTROL or IEL pointers to resolve ownership;
- broadens into U2 mutation, UI/CSV, executor/output or merge authority;
- represents retained-real/native-v14/external acceptance as PASS without execution.

## Verdict template

```text
CHAIN_ID: CII-FIND-REPLACE-V14
QUESTION_SET_ID: CII-FR-QS-0002
QUALIFICATION_SCOPE_ID: QSCOPE-PR1081-UNIVERSAL-AUX-U1
QUALIFICATION_BASIS_HEAD: 136149b2c0becf13d186c366e67cbb985511a725
CANDIDATE_ID: GPT-5.6-SOL-2026-09-02-B
VERIFIER_ID: <independent verifier>
VERDICT_BASIS_HEAD: <reconciled head/material basis>

Q1 __/20
Q2 __/20
Q3 __/20
Q4 __/20
Q5 __/20
TOTAL __/100
MINIMUM_QUESTION __/20

AUTOMATIC_FAILURE_REASON: <NONE or reason>
VERDICT: PASS_WRITE_ALLOWED | FAIL_READ_ONLY | STALE_REQUALIFICATION_REQUIRED | INVALID_SELF_VERIFIED
```

If PASS, authority is limited to U1 and does not authorize U2 mutation, NODENAME changes, FORCE, Writer1/Writer2, topology, workflow, direct overwrite, PR merge, or any unrelated path.
