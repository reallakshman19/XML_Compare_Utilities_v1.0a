# PR1043 work report — Writer2 W2.11 RESTRAINT block DELETE physical writer

## CURRENT RECOVERY STATE — READ FIRST

```text
HANDOVER_READINESS: READY
PR_RECOVERY_STATE: REVIEW_READY / FOCUSED EXECUTION PASS
EXECUTION_MODE: AUTO_MODE
SCOPE_AUTHORITY: ISSUE_1042_COMPONENT_PLUS_INHERITED_AUTHORITY_CORRECTION
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
REPOSITORY: reallaksh19/XML_Compare_Utilities
ISSUE: #1042
PR: #1043
BRANCH: agent/cii-writer2-restraint-delete-physical-w211
BASE_MAIN: f298aa10eba7d2125a9c0f6818e4727b6f4ef0c3
CURRENT_MAIN_AT_RECOVERY: f298aa10eba7d2125a9c0f6818e4727b6f4ef0c3
REBASE: NO-OP / NOT PERFORMED / BASE ALREADY CURRENT
GENERIC_RESTRAINT_CREATE: BLOCKED_UNCHANGED
COMPOSITE_PRODUCT_AUTHORITY: FALSE
WRITER1B_FREE_SLOT_AUTHORITY: PRESERVED
FOCUSED_EXACT_BLOB_RUNTIME: PASS
COMPLETE_CHECKOUT_RUNTIME: NOT_RUN_ENVIRONMENT
REPOSITORY_NPM_TEST: NOT_RUN_ENVIRONMENT
```

## 1. Recovery chronology

The requested rebase was audited first. `main` had not moved since PR1043 was opened:

```text
main    = f298aa10eba7d2125a9c0f6818e4727b6f4ef0c3
PR base = f298aa10eba7d2125a9c0f6818e4727b6f4ef0c3
```

A rebase would therefore have been a meaningless history rewrite and was not performed.

During the source audit a critical inherited W2.10 authority defect was found before continuing W2.11.

### ISS-W2.10-CONTROL-RESTRAINT-COUNT

Merged W2.10 had read:

```js
const rows = sectionRows(raw, 'CONTROL');
const values = decodeCiiNumericRow(rows[0] || '');
const count = Number(values?.[3]);
```

That is `CONTROL` row 1 field 4, which is `NONAM`, not the restraint-block count.

Repository CONTROL authority is:

```text
row 1: NUMELT, NUMNOZ, NOHGRS, NONAM, NORED, NUMFLG
row 2: BENDS, RIGIDS, EXPJTS, RESTRAINTS, DISPLMNT, FORCMNT
row 3: UNIFORM, WIND, OFFSETS, ALLOWBLS, SIF&TEES, IZUP
row 4: EQUIPMNT
```

Therefore RESTRAINT count authority is:

```text
CONTROL row 2
field 4 (zero-based field index 3)
width = I13
```

The initial W2.11 writer and validator repeated the inherited wrong location and would have mutated `NONAM` while leaving the real restraint count unchanged. PR1043 now corrects the planner, writer, validator and test fixtures.

## 2. Narrow W2.10 corrective scope

The W2.10 production correction is intentionally one semantic change:

```diff
- decodeCiiNumericRow(rows[0] || '')
+ decodeCiiNumericRow(rows[1] || '')
```

The W2.10 test fixture now keeps:

```text
NONAM = 0
RESTRAINT count = actual 24-row block count
```

This prevents future tests from hiding the row-selection error by storing the restraint count in the NONAM slot.

No generic CREATE, pointer-sharing, payload-semantic or other W2.10 authority is broadened.

## 3. W2.11 physical mutation model

W2.11 consumes one untouched TARGET0 and creates exactly three original-coordinate claim classes:

```text
1. CONTROL row2/field4 restraint-block-count I13
2. changed ELEMENT restraint-pointer I13 fields
3. one complete RESTRANT section-payload replacement
```

The RESTRANT replacement retains complete old 24-row blocks in old-pointer order and removes only planner-qualified `deletedPointers`.

Pointer rewrites, section compaction and CONTROL count are derived from the same corrected relocation plan.

Writer authority:

```text
CII_WRITER_2_RESTRAINT_BLOCK_DELETE_PHYSICAL_WRITE
```

Consumed physical authority:

```text
PROTECTED_WRITER_RESTRANT_BLOCK_INDEX_24_ROWS
EXACT_PARSED_INDEX_ENDPOINTS_AND_PHYSICAL_RESTRAINT_POINTER_I13
```

Generic restraint CREATE remains blocked:

```text
WRITER_2_RESTRAINT_BLOCK_CREATE_ALLOCATION_NOT_QUALIFIED
```

## 4. ELEMENT pointer custody

The restraint pointer is physically bound to:

```text
ELEMENT rows/block      = 15
pointer row             = 12 zero-based
pointer field index     = 3 zero-based
field width             = 13 bytes
field authority         = exact original physical I13
```

Custody also requires:

```text
parsedElementIndex exact
physical FROM/TO == parsed FROM/TO
semantic auxiliary pointer == physical pointer
pointer integer >= 0
```

Pointer `0` has no owned RESTRANT block and must not produce a relocation claim.

Shared nonzero pointer aliases remain fail-closed.

## 5. Writer fail-closed gates

The physical writer rejects at least:

```text
blocked relocation plan
CREATE authority becoming ready
stale TARGET0 SHA
TARGET byte-length mismatch
wrong CONTROL row2/field4 preimage
stale/raw ELEMENT pointer preimage mismatch
RESTRANT row cardinality mismatch
truncated retained block
missing retained-row line ending
replacement overlap
stale replacement preimage
non-byte postimage code unit
```

A separate recovery defect was also fixed:

```js
const target0HashCustody = target0HashCustody(targetDocument)
```

which would have triggered a temporal-dead-zone failure. The local result is now named separately from the helper.

## 6. Cryptographic and representation custody

Preimage authority:

```text
SHA256_ORIGINAL_TARGET0_BYTES
```

Postimage authority:

```text
SHA256_WRITER2_POSTIMAGE_BYTES
CII_PHYSICAL_POSTIMAGE_REINTAKE_EQUIVALENCE
```

Writer output includes:

```text
byteString
Uint8Array bytes
canonical decoded text
mutation ledger
relocationPlan testimony
target0HashCustody
postimageHashCustody
postimageRepresentationCustody
```

Writer testimony does not define validation authority.

## 7. Independent validator

`cii-workspace-writer2-restraint-delete-validation.js` does not import the physical Writer or its payload/splice helpers.

It independently:

```text
rehashes TARGET0
rebuilds the corrected W2.10 relocation plan
locates CONTROL row2/field4
rebuilds ELEMENT pointer replacements
rebuilds retained RESTRANT blocks directly from TARGET0
checks claim disjointness
runs an independent splice algorithm
requires exact complete final-byte equality
rebuilds postimage SHA
rebuilds canonical physical-file representation
only then checks Writer plan/mutation/hash/representation testimony
```

Primary PASS invariant:

```text
actual final bytes === independently reconstructed expected final bytes
```

## 8. Qualification cases

### Corrected W2.10 planner

```text
D01-D18
H01-H05
```

### W2.11 physical positive cases

```text
P01 sole block -> 0
P02 first of 3
P03 middle of 3
P04 last of 3
P05 delete {2,4} of 5
P06 pointer 0 unchanged
P19 CONTROL row1/NONAM unchanged while row2 RESTRAINT count changes
```

### W2.11 falsifiers

```text
P07 stale TARGET0 hash
P08 forged Writer deletedPointers testimony
P09 forged Writer oldToNewPointer testimony
P10 semantic pointer drift vs physical I13
P11 CONTROL restraint-count drift
P12 stale RESTRANT slot preimage
P13 overlapping replacement claims
P14 unrelated final-byte drift
P15 forged Writer mutation ledger
P16 forged postimage hash testimony
P17 forged representation testimony
P18 CREATE/new-block request
```

## 9. Focused native execution — observed PASS

Direct repository checkout remained unavailable in the runtime because `github.com` DNS resolution failed. To avoid leaving the component gate as authored-only, a sparse execution mirror was assembled from the exact files loaded by these focused suites.

Every loaded source/test file was verified using `git hash-object` against its live PR #1043 GitHub blob SHA before execution.

Execution basis code/test head:

```text
7f00a80e1ab5b87994829977f04eb6fcbcbe84bd
```

Runtime:

```text
Node v22.16.0
npm 10.9.2
```

Exact loaded Git-blob manifest:

```text
485daa43553681ca54f488499e57f36d2239be58  parser/fixed-field.js
6ab30d8dd088225fd89bb729bf9ffdebefe652f6  tabs/cii-workspace/cii-workspace-contracts.js
6435e0eaadc382a18aac6a0bd46318ab6c27c714  tabs/cii-workspace/cii-workspace-byte-sha256.js
0c4c445fbd3d4b929b1f9288b789b244547c8867  tabs/cii-workspace/cii-workspace-physical-file.js
2176ac97eaef84f3aa9073d5eaf73d1530cf09a8  tabs/cii-workspace/cii-workspace-writer2-restraint-delete-custody.js
aedfb3ac78eed2294a88a64af261386f0db65085  tabs/cii-workspace/cii-workspace-writer2-restraint-delete-compaction-plan.js
e8a92417e45c75269a859469e6f51bd577b412cb  tabs/cii-workspace/cii-workspace-writer2-restraint-delete-write.js
1833d9fecc37061eaf2f51f1676e6386e1f9ac3c  tabs/cii-workspace/cii-workspace-writer2-restraint-delete-validation.js
020cae50b42448be2c8d1d9d41952d21be26adfa  tests/cii-workspace-writer2-restraint-delete-fixture.js
e27c65b68cc4e44138c4965b07c85f00893ef0e7  tests/cii-workspace-writer2-restraint-delete-compaction-plan.test.js
437c68d31a518520b37dce44639ee5370a5ef059  tests/cii-workspace-writer2-restraint-delete-physical.test.js
834df00e88b1f0d8bfed04223f676a8f285a9533  tests/cii-workspace-writer2-restraint-delete-physical-falsifiers.test.js
```

Observed commands/results:

```text
node tests/cii-workspace-writer2-restraint-delete-compaction-plan.test.js
  PASS: Writer2 RESTRAINT block DELETE/compaction planner D01-D18 + H01-H05 passed.

node tests/cii-workspace-writer2-restraint-delete-physical.test.js
  PASS: Writer2 RESTRAINT physical DELETE P01-P06 and CONTROL-custody P19 passed.

node tests/cii-workspace-writer2-restraint-delete-physical-falsifiers.test.js
  PASS: Writer2 RESTRAINT physical DELETE P07-P18 falsifiers passed.
```

Evidence classification:

```text
focused component execution          PASS_EXACT_BLOB_VERIFIED_SPARSE
complete Git checkout execution      NOT_RUN_ENVIRONMENT
repository npm test                  NOT_RUN_ENVIRONMENT
PR workflow runs at execution head   NONE
browser/product                      NOT_APPLICABLE_UNCHANGED_ROUTE
```

The focused PASS must not be widened into a repository-wide PASS.

## 10. Current changed-file ledger

Exactly 10 paths are expected:

```text
coordination 3
  agents/PR1043_workreport.md
  agents/status/PR1043.yaml
  agents/claims/PR1043.yaml

production / authority 3
  tabs/cii-workspace/cii-workspace-writer2-restraint-delete-compaction-plan.js
  tabs/cii-workspace/cii-workspace-writer2-restraint-delete-write.js
  tabs/cii-workspace/cii-workspace-writer2-restraint-delete-validation.js

tests 4
  tests/cii-workspace-writer2-restraint-delete-compaction-plan.test.js
  tests/cii-workspace-writer2-restraint-delete-fixture.js
  tests/cii-workspace-writer2-restraint-delete-physical.test.js
  tests/cii-workspace-writer2-restraint-delete-physical-falsifiers.test.js
```

Unexpected paths: 0.

## 11. Negative assurance

```text
CONTROL.NONAM mutation authority     NOT ADDED / MUST REMAIN UNCHANGED
new restraint block allocation      NOT ADDED
GUID generation                      NOT ADDED
default/type synthesis               NOT ADDED
Writer1B free-slot code              UNCHANGED
composite Writer2 route              UNCHANGED
product/core route                   UNCHANGED
UI/browser route                     UNCHANGED
Writer3 topology                     UNCHANGED
SIF CREATE                           UNCHANGED BLOCKED
HANGER CREATE                        UNCHANGED BLOCKED
workflow/package/parser/converter    UNCHANGED
```

## 12. Review and residual validation state

The focused W2.10/W2.11 component gate has executed and passed. PR1043 is therefore suitable for owner review.

Residual validation remains explicit:

```text
complete checkout        NOT_RUN_ENVIRONMENT
repository npm test      NOT_RUN_ENVIRONMENT
```

No claim converts either residual into PASS.

Current disposition:

```text
ready_for_review = true
merge_authorized = false
```

Owner may require the complete-checkout / repository-wide gate before merge. If so, that remains the next validation action. Otherwise the focused component evidence is now complete for review disposition.

## 13. Next phase after separate merge authorization

W2.12 remains the one-TARGET0 composite-adoption phase. It must not start merely because W2.11 is review-ready.

Only after explicit owner merge authorization and merge of PR1043 may W2.12 add RESTRAINT block DELETE to the existing Writer2 composite families while preserving:

```text
one untouched TARGET0
all family claims in original coordinates
overlap arbitration before mutation
one final splice transaction
independent complete-postimage validation
```

## Appendix A — expert takeover gate

1. Which CONTROL row and field own the restraint block count, and what was wrong in merged W2.10?
2. Why must NONAM remain unchanged during a restraint block DELETE?
3. Identify the exact ELEMENT restraint-pointer row/field and I13 width.
4. Derive the pointer map for deleting blocks `{2,4}` from five.
5. Why is one complete RESTRANT payload replacement safer than 24 incremental row splices?
6. How does a deleted block with a later retained owner affect that owner's ELEMENT pointer?
7. Why does pointer `0` generate no relocation claim?
8. Why are shared restraint pointers still fail-closed?
9. Why must metadata residue in an otherwise empty block prevent block deletion?
10. Explain why final-byte equality precedes Writer testimony validation.
11. Explain why the validator may reuse the corrected planner authority but must not import Writer payload/splice helpers.
12. Which tests are now actually PASS, and which repository-wide tests remain NOT_RUN?
13. Why does generic RESTRAINT CREATE remain blocked after DELETE works?
14. Define the W2.12 one-TARGET0 adoption invariant.
