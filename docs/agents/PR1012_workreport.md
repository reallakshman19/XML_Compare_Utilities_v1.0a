# PR1012 — Writer 2 Phase-4B NODENAME Physical Relocation Work Report

## Recovery header

```text
HANDOVER_READINESS: READY
REPOSITORY: reallaksh19/XML_Compare_Utilities
PR: 1012
BRANCH: agent/cii-writer2-nodename-physical-rewrite
BASE: main@a450ab3533089166fa6b8bbe86cab86a6e90ecc1
MISSION: physically apply merged Writer2 Phase-4A NODENAME relocation plan and independently validate the post-layout CII
CURRENT_STAGE: PHASE4B_IMPLEMENTED_AWAITING_REPOSITORY_RUNTIME_QUALIFICATION
MERGE_AUTHORITY: OWNER_ONLY
```

## 1. Authority model

PR1011 Phase-4A is the transaction-planning authority. It derives the complete NODENAME post-layout from the untouched TARGET, including:

```text
old NODENAME rows
+ scoped CREATE / DELETE operations
+ exact physical ELEMENT ownership
+ complete oldPointer -> newPointer mapping
+ every shifted ELEMENT pointer
+ CONTROL.NONAM_after
```

PR1012 does not reinterpret that engineering decision. It physically applies the resulting relocation transaction and independently verifies the final file.

The Writer result is testimony, not authorization.

```text
Phase-4A relocation plan = transaction authority
Writer-2 mutation ledger  = audit testimony
Validator reconstruction  = independent post-layout oracle
```

## 2. Physical mutation classes

Only three physical mutation classes are permitted:

1. `CONTROL.NONAM` fixed-width 13-character integer field;
2. ELEMENT row-13 NODENAME pointer fixed-width 13-byte fields identified by exact physical custody;
3. complete raw `#$ NODENAME` section payload between the NODENAME marker and the next section marker.

Every byte outside those replacements is copied verbatim from the untouched original TARGET byte stream.

## 3. Fixed-format custody

### NODENAME

Protected source authority established before Phase-4A:

```text
NODENAME row = 2X + FROM[26] + TO[25]
row width    = 53 characters
FROM         = [2,28)
TO           = [28,53)
```

PR1012 requires each existing physical NODENAME row to be exactly 53 characters. Blank physical rows inside the section are rejected because the current physical-section API intentionally omits blank semantic rows and a cardinality-changing writer must not silently normalize an unqualified physical layout.

### ELEMENT NODENAME pointer

```text
ELEMENT block rows       = 15
pointer location         = row 13, field 6
pointer width            = 13 bytes
pointer semantic basis   = 1-based NODENAME row index
```

Every pointer that changes must already have exact Phase-4A pointer-field custody.

### CONTROL.NONAM

```text
CONTROL line 1 field 4
JS zero-based field index = 3
width                     = 13 characters
semantic                  = integer NODENAME row count
```

CONTROL.NONAM is deliberately emitted as a fixed-width integer count, not as a G13.6 engineering real. The preimage must already equal the canonical fixed-width integer representation of the pre-mutation row count.

## 4. Cardinality transaction

Writer 2 differs from Writer 1C because byte offsets after the NODENAME section may move.

Supported Phase-4B cases:

```text
CREATE only        -> row/byte count may increase
DELETE only        -> row/byte count may decrease
CREATE + DELETE    -> row count may remain constant while pointers relocate
```

Retained rows preserve their original physical line ending. New rows inherit the existing section-row ending, or the NODENAME marker ending when the section was empty. A new row is blocked if no usable physical ending can be established.

Example:

```text
before ELEMENT NODENAME pointers: 1,2,3,0
delete old row 2
create new row for pointer-0 element

Phase-4A mapping of old rows:
1 -> 1
2 -> 0
3 -> 2

new row appended at pointer 3

final ELEMENT pointers:
1,0,2,3
```

The `3 -> 2` change is a transaction consequence and is authorized only through the Phase-4A relocation map, even though that ELEMENT was not itself the DELETE target.

## 5. Writer implementation

Production module:

```text
tabs/cii-workspace/cii-workspace-writer2-nodename-write.js
```

Primary API:

```js
applyCiiWriter2NodeNameRelocation({ targetDocument, transferPlan })
```

Sequence:

```text
untouched TARGET bytes
 -> rebuild Phase-4A relocation plan
 -> require READY
 -> build CONTROL replacement
 -> build all pointer replacements
 -> build full NODENAME payload replacement
 -> prove replacement spans are disjoint
 -> prove every replacement preimage against untouched bytes
 -> apply replacements in original-byte order exactly once
 -> return variable-length bytes/text plus mutation testimony
```

The writer never performs a whole-CII object reserialization.

## 6. Independent post-layout validator

Production module:

```text
tabs/cii-workspace/cii-workspace-writer2-nodename-validation.js
```

Primary API:

```js
validateCiiWriter2NodeNameRoundTrip(before, after, transferPlan, writerResult)
```

Writer 1C negative assurance can use a same-length authorized-span rule. Writer 2 cannot rely on that rule after row insertion/deletion because all downstream byte offsets may change.

PR1012 therefore uses a stronger cardinality-aware oracle:

```text
untouched TARGET + bound transfer plan
 -> independently rebuild Phase-4A relocation plan
 -> independently derive CONTROL replacement
 -> independently derive every pointer replacement
 -> independently derive complete NODENAME payload replacement
 -> independently construct complete expected post-mutation byte stream

PASS only if:
actual post bytes == independent expected post bytes
```

This proves unchanged later sections by exact copy, even though their offsets may have shifted.

The validator also checks:

- post-write NODENAME physical custody is qualified;
- `CONTROL.NONAM` equals the derived post row count;
- physical NODENAME row count equals the derived post row count;
- all ELEMENT NODENAME pointers equal the independently expected snapshot;
- node-name semantic map equals the CREATE/DELETE postimage;
- element connectivity is unchanged;
- section order is unchanged;
- Writer mutation testimony exactly equals the independent replacement ledger;
- Writer relocation testimony equals the independently rebuilt Phase-4A plan.

### Independent pointer formatting

The validator does not call the production Writer numeric formatter. It carries an independent six-significant-digit formatter for pointer postimages so a Writer formatting defect cannot self-validate.

## 7. Focused regression coverage authored

`tests/cii-workspace-writer2-nodename-write-roundtrip.test.js` covers:

1. mixed DELETE + CREATE with row count unchanged and pointers `1,2,3,0 -> 1,0,2,3`;
2. CREATE-only cardinality increase;
3. DELETE-only cardinality decrease;
4. unrelated later BEND-section byte tamper rejected by `WRITER_2_EXACT_POSTIMAGE_MISMATCH`;
5. forged Writer mutation ledger rejected by `WRITER_2_MUTATION_TESTIMONY_MISMATCH`.

Phase-4A tests remain inherited from merged PR1011 and cover relocation planning, alias custody, pointer shifts, width/ASCII limits and unsupported APPLY operations.

## 8. Validation truth

Executed in this environment:

```text
new Writer-2 physical writer syntax                 PASS_LOCAL_EXECUTION
new Writer-2 independent validator syntax           PASS_LOCAL_EXECUTION
focused round-trip test source syntax               PASS_LOCAL_EXECUTION
isolated exact new writer + validator harness       PASS_ISOLATED_EXACT_NEW_MODULES
forged writer-ledger attack in isolated harness     FAIL_AS_REQUIRED
```

The isolated harness uses the exact current new production module blobs with controlled stubs only at previously merged dependency boundaries. It is evidence for the new orchestration/validation logic, not a substitute for repository execution.

Not executed in a complete exact checkout:

```text
repository focused Phase-4A + Phase-4B tests        AUTHORED_NOT_RUN_ENVIRONMENT
real BM_CII_TARGET1/TARGET2 Writer-2 benchmark      NOT_RUN_ENVIRONMENT
inherited Writer1A/1B/1C regressions                NOT_RUN_ENVIRONMENT
full npm test                                        NOT_RUN_ENVIRONMENT
browser / product flow                               NOT_RUN_ENVIRONMENT
```

No unexecuted item is represented as PASS.

## 9. Explicit exclusions

PR1012 does not authorize:

- Writer-2 product/core routing or UI selection;
- SIF/TEE 10-row block creation/deletion;
- hanger creation/deletion, HGRDAT reconstruction, or packed MISCEL_1 maintenance;
- generic auxiliary-section creation/deletion;
- node or element creation/deletion;
- connectivity or topology changes;
- Writer 3 behavior;
- workflow changes;
- protected external converter modifications.

## 10. Changed-file ledger

Implementation/qualification files before recovery bookkeeping:

```text
tabs/cii-workspace/cii-workspace-writer2-nodename-write.js
tabs/cii-workspace/cii-workspace-writer2-nodename-validation.js
tests/cii-workspace-writer2-nodename-write-roundtrip.test.js
```

Recovery files added in this PR:

```text
agents/PR1012_workreport.md
agents/status/PR1012.yaml
agents/claims/PR1012.yaml
agents/MASTER_INDEX.md
```

## 11. Exact next phase

After explicit acceptance of Phase-4B, the next PR should route Writer 2 through CII Workspace core/product boundaries without expanding engineering semantics:

```text
writerVersion = 2
 -> Writer-2-specific transfer classification for NODENAME CREATE/DELETE
 -> Phase-4A readiness
 -> Phase-4B physical write
 -> re-intake
 -> independent Phase-4B validator
 -> modified-target export / product lifecycle
```

Do not combine that product-routing phase with SIF block or hanger cardinality work.

## Appendix A — next-agent expert qualification questionnaire

1. Why is `D subset S_auth` insufficient as the primary Writer-2 proof when NODENAME cardinality changes?
2. Derive `oldPointer -> newPointer` for deletion of old row 2 from `[1,2,3]` and explain why pointer 3 must change even if its ELEMENT was not selected.
3. Which three physical replacement classes are authorized in Phase-4B, and why is every other byte immutable?
4. Why is CONTROL.NONAM formatted as an integer field while ELEMENT pointer postimages use six-significant-digit numeric formatting?
5. Why does the writer reject existing NODENAME rows that are not exactly 53 characters?
6. Why are blank physical NODENAME rows blocked rather than silently normalized?
7. How are retained-row and appended-row line endings determined?
8. Explain how exact full-postimage reconstruction detects an unrelated BEND-section byte change after a NODENAME insertion shifts downstream offsets.
9. Why is `writerResult.mutations` audit testimony rather than authorization?
10. Why does the validator use an independent pointer formatter?
11. Which semantics remain unresolved for SIF block creation and hangers, and why must they remain later Writer-2 work?
12. Which repository/runtime gates remain NOT_RUN and must be executed before claiming full qualification?
