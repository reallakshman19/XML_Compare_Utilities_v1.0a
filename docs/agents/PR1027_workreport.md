# PR1027 — Writer 2 partial H>1 HANGER physical compaction

# CURRENT STATE — READ FIRST

```text
HANDOVER_READINESS: READY
PR_RECOVERY_STATE: HEALTHY
TAKEOVER_AUTHORITY: WRITE_ALLOWED
EXECUTION_MODE: MANUAL
SCOPE_AUTHORITY: LOCKED_TO_ISSUE_1026
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
REPOSITORY: reallaksh19/XML_Compare_Utilities
SOURCE_TASK: Issue #1026
PR: #1027
BRANCH: agent/cii-writer2-hanger-partial-physical
BASE_MAIN: ae1de402db129e32cd6d7811a4e4707d64512bd4
GROUNDING_EPOCH: GE-1027-002
CURRENT_STAGE: POSTIMAGE_REPRESENTATION_CUSTODY_HARDENED_REVIEW_READY
CURRENT_BLOCKER: NONE_FOR_COMPONENT_REVIEW
EVIDENCE_LIMITATION: NO_REAL_REPOSITORY_H_GT_1_CII_PREIMAGE
RUNTIME_LIMITATION: CURRENT_HEAD_NATIVE_EXECUTION_NOT_AVAILABLE
```

PR1027 remains the single Issue #1026 component stack. Merged PR1025 positional HANGER record-binding authority is consumed read-only.

## Handover in 60 seconds

The component now proves one continuous custody chain:

```text
canonical BOUND transaction
+ untouched TARGET0 physical bytes
  -> SHA256_ORIGINAL_TARGET0_BYTES
-> merged PR1025 partial H>1 HANGER plan
-> exactly two original-coordinate replacements
   CONTROL.NOHGRS + complete MISCEL_1 payload
-> final byteString
  -> SHA256_WRITER2_POSTIMAGE_BYTES
  -> canonical createCiiPhysicalFile(final bytes)
  -> Writer Uint8Array/text + representation testimony
-> independent validator
  -> rehash TARGET0
  -> independently rebuild complete expected postimage
  -> exact final-byte equality
  -> independently rehash actual postimage
  -> independently re-intake physicalFile from actual postimage bytes
  -> prove Writer bytes/text and caller physical metadata are the same representation
```

`countAfter == 0` remains the unchanged delete-all route. Product/composite/UI partial HANGER remains blocked. Semantic authority remains `NONE_POSITIONAL_PHYSICAL_CUSTODY_ONLY`.

# CURRENT BATCH — POSTIMAGE REPRESENTATION CUSTODY

## Finding

The previous batch closed postimage SHA custody, but two secondary representation surfaces remained independently trusted:

```text
writerResult.bytes
writerResult.text

after.physicalFile.text
after.physicalFile.lines
after.physicalFile.lineEndings
after.physicalFile byte/encoding metadata
optional after text/encoding metadata
```

The validator used `after.physicalFile.originalByteString` for the primary byte oracle, but used caller-supplied `lines`/metadata for structural checks. Therefore a byte-perfect, hash-perfect postimage could still carry stale or forged derived representations without an explicit fail-closed representation proof.

This is a custody/audit defect, not a mutation-layout defect.

## Writer hardening

Commit:

```text
79f8fec0df92572dba66a5a4fdba40fe24935198
CII: bind partial HANGER result representations to postimage bytes
```

Writer now creates a canonical physical-file view from the exact final `Uint8Array`:

```text
canonicalPostimage = createCiiPhysicalFile(final bytes)
```

It requires canonical `originalByteString` to equal the final Writer byte string, exposes `text` from that canonical re-intake, and adds:

```text
postimageRepresentationCustody = {
  authority: CII_PHYSICAL_POSTIMAGE_REINTAKE_EQUIVALENCE,
  byteLength,
  textLength,
  textEncodingAuthority,
  lineCount,
  lineEndingStyle,
  finalLineTerminated
}
```

This testimony is secondary; the validator does not trust it as authority.

## Independent validator hardening

Commit:

```text
2c2d4ecd0ea7cc4f91438572c7d0ea59a5ec6eca
CII: independently bind postimage physical representations
```

The validator independently reconstructs canonical physical-file metadata from the authoritative postimage byte string:

```text
canonical = createCiiPhysicalFile(
  ciiPhysicalFileBytes(after.physicalFile)
)
```

It then requires:

```text
canonical.originalByteString == after.physicalFile.originalByteString

physicalFile.schema
physicalFile.byteAuthority
physicalFile.writer1CByteEligible
physicalFile.textEncodingAuthority
physicalFile.byteLength
  == canonical values

physicalFile.text        == canonical.text
physicalFile.lines       == canonical.lines
physicalFile.lineEndings == canonical.lineEndings

optional after.byteAuthority
optional after.textEncodingAuthority
optional after.textLength
  == canonical values

writerResult.bytes is Uint8Array
writerResult.bytes == canonical physical bytes
writerResult.text  == canonical text
writerResult.postimageRepresentationCustody
  == independently rebuilt custody
```

PASS checklist now contains:

```text
INDEPENDENT_POSTIMAGE_REPRESENTATION
WRITER_RESULT_BYTE_TEXT_EQUIVALENCE
```

The validator does not import a Writer representation helper. Both sides use the neutral repository physical-file primitive as the canonical representation authority.

## F51-F58

Primary falsifier extension:

```text
7b622609ec8da738c41ebe2d6e7b02305bc4e13d
```

Integrated roundtrip extension:

```text
ddf98d2b79ee98822eb0ce7b3e537d2468dc5fc5
```

Cases:

```text
F51 WRITER_BYTE_ARRAY_CONTENT_MISMATCH
  Writer byteString/postimage remain correct
  Writer Uint8Array contains a changed byte
  -> reject RESULT_BYTE_ARRAY_MISMATCH

F52 WRITER_BYTE_ARRAY_TYPE_MISMATCH
  equal-value plain array substituted for Uint8Array
  -> reject exact Writer result contract

F53 WRITER_TEXT_MISMATCH
  Writer bytes correct, decoded text forged
  -> reject RESULT_TEXT_MISMATCH

F54 POSTIMAGE_PHYSICAL_TEXT_MISMATCH
  originalByteString/hash correct, physicalFile.text forged
  -> reject

F55 POSTIMAGE_PHYSICAL_LINES_MISMATCH
  original bytes correct, line scan testimony forged
  -> reject

F56 POSTIMAGE_PHYSICAL_LINE_ENDINGS_MISMATCH
  original bytes correct, line-ending summary forged
  -> reject

F57 POSTIMAGE_PHYSICAL_METADATA_MISMATCH
  byteAuthority / encoding / eligibility / byte-length metadata disagrees with re-intake
  -> reject

F58 POSTIMAGE_DOCUMENT_REPRESENTATION_METADATA_MISMATCH
  optional top-level text/encoding representation metadata disagrees with canonical postimage
  -> reject
```

F51/F53/F54/F58 are also exercised through the complete `validateCiiWriter2HangerPartialRoundTrip()` path, not only the helper-level falsifier.

Observation class:

```text
Writer representation source                    PASS_SOURCE_INSPECTION
validator independent re-intake source          PASS_SOURCE_INSPECTION_INDEPENDENT_REINTAKE
F51-F58 source                                  AUTHORED / PASS_SOURCE_INSPECTION
F51-F58 exact current-head runtime              NOT_RUN_ENVIRONMENT
```

No runtime PASS is inferred from source inspection.

# RETAINED AUTHORITY

## Postimage cryptographic custody — F46-F50

```text
SHA256_WRITER2_POSTIMAGE_BYTES
b93835388b5f27c2044ecd20c91084c7a5f1b38c  Writer
c2cd7bd114d09027feb3a413a7ec244751ba56e2  independent validator
09864fcb3df5c70146c8c093cfefdcb43a057c34  F46-F49
cd6bd81105e00cf2513ae5d2cf9520501080161c  F50
```

The validator independently requires actual postimage SHA-256 and physical/document byte lengths to match the final bytes before checking Writer testimony.

## TARGET0 cryptographic custody — F40-F45

```text
SHA256_ORIGINAL_TARGET0_BYTES
3470e9871469fae1a2a13cbc916c6c328bd8168c  byte-string SHA-256 primitive
39e6770a70f284c0f36400425f19789e430fb9fa  Writer TARGET0 gate
4d34f7699f46fd1025c3cba52ae16335dff87448  independent validator TARGET0 rehash
3c820eb73639c76be22c1cde824c911732728ea8  F40-F44
3652e38832f626755e1f99c308f94fe42b558682  F45
```

SOURCE physical bytes are not supplied to this component API; independent SOURCE-byte rehash is not claimed.

## Canonical BOUND operation-container custody — F31-F39

```text
4a9f2f7daf6b7c50f776a4b8ad569df76ada1106  Writer gate
c6fb4d2c1b8d415581eb14d876f4d84f7a70708b  independent validator
4def181b64e70b348bd3540d505765090ece02c2  F31-F39
```

Rules:

```text
operations[] required
excludedOperations[] required
mutable operations -> APPLY only
KEEP operations -> KEEP only
excludedOperations -> mutable EXCLUDE only
KEEP forbidden in excludedOperations
PLAN APPLY ∩ EXCLUDE = empty
SCOPE APPLY ∩ EXCLUDE = empty
operationId globally unique across both containers
```

## Physical HANGER compaction authority

Merged PR1025 binds positional record `i` across:

```text
IHGRNODE[i]
HGRDAT1/HGRDAT2 + TAG/GUID record i
IHGRFREE row i
IHGRNUM[i]
IHGRTABLE[i]
IHGRSHORT[i]
IHGRCN[i]
```

PR1027 compacts the five packed families using exact retained 13-byte fields. It never parses retained integer values and reserializes them.

Packed-row authority:

```text
SYNCHRONIZER_PACK_I_ACTIVE_FIELDS_ONLY
non-final row = exactly 2X + 6*I13
final row     = exactly 2X + active I13 fields
trailing source bytes = 0
```

INTERLEAVED/GROUPED HGRDAT/TAG/GUID order is preserved. H'=1 is `SINGLE_RECORD_ORDER_EQUIVALENT` postimage while Writer testimony retains the qualified preimage class.

## Real-source census

```text
repository CII assets = 9
H=0 = 7
H=1 = 2
H>1 = 0
REAL_REPOSITORY_H_GT_1_CII_SOURCE = NOT_AVAILABLE
REAL_H_GT_1_PARTIAL_DELETE_ROUNDTRIP = NOT_RUN_NO_REAL_SOURCE
```

First real H>1 discovery must trigger dedicated qualification. Synthetic evidence is not real-source authority.

# HISTORICAL QUALIFICATION — DO NOT UPGRADE

```text
mandatory H=2/3/6/7/8/12/13 packing matrix     PASS_RECONSTRUCTED_DEPENDENCY_CLOSURE
INTERLEAVED/GROUPED representative cases        PASS_RECONSTRUCTED_DEPENDENCY_CLOSURE
raw-I13 +12 preservation                        PASS_RECONSTRUCTED_DEPENDENCY_CLOSURE
frozen independent postimage SHA oracles        PASS_RECONSTRUCTED_DEPENDENCY_CLOSURE
F01-F27 / F29-F30                               PASS / FAIL_CLOSED as recorded
F28 product/composite gate                      PASS_SOURCE_INSPECTION_AT_TIME
deleted-record testimony falsifier              PASS_FAIL_CLOSED_RECONSTRUCTED_AT_TIME
real BM_CII_SOURCE HANGER slice                 PASS_RECONSTRUCTED_BENCHMARK_HANGER_SLICE
F31-F39 source                                  PASS_SOURCE_INSPECTION_TEST_AUTHORED_NOT_RUN
F40-F45 source                                  PASS_SOURCE_INSPECTION_TEST_AUTHORED_NOT_RUN
F46-F50 source                                  PASS_SOURCE_INSPECTION_TEST_AUTHORED_NOT_RUN
F51-F58 source                                  PASS_SOURCE_INSPECTION_TEST_AUTHORED_NOT_RUN
```

Historical PASS remains historical; none of it is relabelled as exact current-head native execution.

# CHANGED-FILE LEDGER

Current intended Issue #1026 paths:

```text
agents/MASTER_INDEX.md
agents/PR1027_workreport.md
agents/claims/PR1027.yaml
agents/status/PR1027.yaml
docs/cii-writer2-hanger-partial-physical.md
docs/cii-writer2-hanger-real-source-census.csv
tabs/cii-workspace/cii-workspace-byte-sha256.js
tabs/cii-workspace/cii-workspace-writer2-hanger-partial-validation.js
tabs/cii-workspace/cii-workspace-writer2-hanger-partial-write.js
tests/cii-workspace-byte-sha256.test.js
tests/cii-workspace-writer2-hanger-partial-deleted-testimony.test.js
tests/cii-workspace-writer2-hanger-partial-frozen-oracle.test.js
tests/cii-workspace-writer2-hanger-partial-packed-tail.test.js
tests/cii-workspace-writer2-hanger-partial-physical.test.js
tests/cii-workspace-writer2-hanger-partial-scope-disjoint.test.js
tests/cii-workspace-writer2-hanger-real-source-census.test.js
tests/fixtures/cii-writer2-hanger-partial-postimage-oracles.json
```

Expected reconciliation:

```text
actual: 17
intended: 17
unexplained: 0
new paths this batch: 0
production paths hardened this batch: 2
existing test paths expanded this batch: 2
intake implementation changes: 0
physical-file implementation changes: 0
transfer-scope/planner changes: 0
workflow changes: 0
package.json changes: 0
product/composite/UI changes: 0
protected parser/converter changes: 0
```

# CURRENT VALIDATION TRUTH

```text
production intake SHA basis                       PASS_SOURCE_INSPECTION
neutral physical-file representation basis       PASS_SOURCE_INSPECTION
SHA primitive                                     PASS_SOURCE_INSPECTION
Writer TARGET0 hash gate                          PASS_SOURCE_INSPECTION
validator TARGET0 hash gate                       PASS_SOURCE_INSPECTION_INDEPENDENT_IMPLEMENTATION
Writer postimage hash custody                     PASS_SOURCE_INSPECTION
validator postimage hash custody                  PASS_SOURCE_INSPECTION_INDEPENDENT_IMPLEMENTATION
Writer postimage representation custody           PASS_SOURCE_INSPECTION
validator postimage representation re-intake      PASS_SOURCE_INSPECTION_INDEPENDENT_REINTAKE
F40-F58 exact committed runtime                   NOT_RUN_ENVIRONMENT
F31-F39 exact committed runtime                   NOT_RUN_ENVIRONMENT
packed-tail integrated test                       NOT_RUN_ENVIRONMENT
real-source census test                           NOT_RUN_ENVIRONMENT
focused current-head native tests                 NOT_RUN_ENVIRONMENT
full BM_CII_SOURCE exact intake/write/re-intake   NOT_RUN_ENVIRONMENT
broader Writer2/product integration               NOT_RUN_ENVIRONMENT
repository-wide npm test                          NOT_RUN_ENVIRONMENT
real repository H>1 source                        NOT_AVAILABLE
real H>1 physical partial-delete roundtrip        NOT_RUN_NO_REAL_SOURCE
browser/product                                   NOT_APPLICABLE_UNCHANGED_ROUTE
```

# NEGATIVE ASSURANCE

No new authority for:

```text
SOURCE-byte cryptographic rehash without SOURCE bytes
intake implementation mutation
physical-file implementation mutation
transfer-scope builder mutation
merged HANGER planner mutation
product/core partial-HANGER apply
composite partial HANGER
UI execution
HANGER CREATE/value editing
HGRDAT engineering semantics
SIF CREATE
Writer3 topology
protected parser/converter mutation
package scripts
workflows
```

The returned `Uint8Array` remains a JavaScript mutable view; this batch does not claim impossible deep immutability of typed-array elements. It requires validation-time byte equality and explicit representation custody.

Existing product/composite partial HANGER remains blocked by `WRITER_2_HANGER_DELETE_ALL_SCOPE_REQUIRED`.

# REVIEW / MERGE DISPOSITION

```text
COMPONENT IMPLEMENTATION                    COMPLETE
INDEPENDENT VALIDATOR                       COMPLETE
TARGET0 CRYPTOGRAPHIC BYTE CUSTODY          HARDENED
POSTIMAGE CRYPTOGRAPHIC BYTE CUSTODY        HARDENED
POSTIMAGE REPRESENTATION CUSTODY            HARDENED
F40-F58                                     AUTHORED / NOT_RUN_ENVIRONMENT
CANONICAL OPERATION-CONTAINER CUSTODY       HARDENED
F31-F39                                     AUTHORED / NOT_RUN_ENVIRONMENT
PACKED SOURCE-SHAPE AUTHORITY               QUALIFIED
REAL-SOURCE CENSUS                          COMPLETE
REAL H>1 SOURCE                             NOT_AVAILABLE
REAL H>1 ROUNDTRIP                          NOT_RUN_NO_REAL_SOURCE
CURRENT-HEAD NATIVE TEST EXECUTION          NOT_RUN_ENVIRONMENT
RUNTIME ADOPTION                            NONE / COMPONENT_ISOLATED
HANDOVER READINESS                          READY
REVIEW READINESS                            READY_WITH_EXPLICIT_EVIDENCE_LIMITATIONS
MERGE AUTHORITY                             OWNER_ONLY
MERGE AUTHORIZED                            FALSE
```

Do not merge without fresh owner authorization.

# APPENDIX A — TAKEOVER QUALIFICATION

1. Explain why a correct SHA-256 of `after.physicalFile.originalByteString` does not by itself prove `after.physicalFile.lines` or `writerResult.text` are truthful.
2. Trace exactly how Writer obtains `postimageRepresentationCustody` from final bytes and identify the neutral authority primitive.
3. Explain why validator re-intake through `createCiiPhysicalFile(ciiPhysicalFileBytes(after.physicalFile))` is independent of Writer testimony while still sharing canonical repository infrastructure.
4. Distinguish F51, F53 and F54: forged Writer bytes, forged Writer text, and forged postimage physical text.
5. Explain F55/F56 and why line spans/line-ending summaries must be functions of physical bytes rather than trusted metadata.
6. State why the batch does not claim deep immutability of returned `Uint8Array` and what validation guarantee replaces that claim.
7. Distinguish `SHA256_ORIGINAL_TARGET0_BYTES`, `SHA256_WRITER2_POSTIMAGE_BYTES`, and `CII_PHYSICAL_POSTIMAGE_REINTAKE_EQUIVALENCE`.
8. Derive H=7 -> H'=6 and explain why all five packed arrays are field-repacked using exact raw I13 custody.
9. Explain why `semanticAuthority = NONE_POSITIONAL_PHYSICAL_CUSTODY_ONLY` remains unchanged by cryptographic and representation hardening.
10. Enumerate every current NOT_RUN/NOT_AVAILABLE evidence class that must not be upgraded without new evidence.

Threshold: 92/100 overall and every answer >=17/20.

# DURABLE HISTORY

- 2026-08-22: Issue #1026 grounded; PR1027 allocated as the single component stack.
- 2026-08-22: PR1025 merged at `ae1de402...`; PR1027 re-grounded before production coding.
- 2026-08-22: physical partial writer, independent validator, mandatory matrix/F01-F30 and frozen postimage SHA oracles authored.
- 2026-08-23: deleted-record Writer testimony gap fixed and falsified.
- 2026-08-23: packed-row source shape narrowed fail-closed to active-fields-only using synchronizer emitter + real H=1 evidence.
- 2026-08-23: repository real-source census frozen; H>1 source absent; future H>1 discovery made a qualification trigger.
- 2026-08-23: canonical APPLY/EXCLUDE and operation-container custody hardened through F31-F39.
- 2026-08-23: TARGET0 declared-hash-only trust gap closed through `SHA256_ORIGINAL_TARGET0_BYTES`, F40-F45.
- 2026-08-23: final postimage hash/length custody closed through `SHA256_WRITER2_POSTIMAGE_BYTES`, F46-F50.
- 2026-08-23: postimage derived-representation drift closed through `CII_PHYSICAL_POSTIMAGE_REINTAKE_EQUIVALENCE`, F51-F58.
