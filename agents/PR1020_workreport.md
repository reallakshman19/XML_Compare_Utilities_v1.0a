# PR1020 — Writer 2 HANGER delete-all physical rewrite

# CURRENT RECOVERY STATE — READ FIRST

```text
HANDOVER_READINESS: READY
REPOSITORY: reallaksh19/XML_Compare_Utilities
PR: #1020
BRANCH: agent/cii-writer2-hanger-delete-all-physical
BASE: main@663423670dd6f0b198b02d97d66148d35edb1024
MISSION: physically apply only qualified HANGER delete-all transactions and independently validate the complete postimage
CURRENT_STAGE: PHYSICAL_WRITER_AND_INDEPENDENT_VALIDATOR_AUTHORED
TAKEOVER_AUTHORITY: WRITE_ALLOWED
MERGE_AUTHORITY: OWNER_ONLY
```

## 1. Inherited authority

Merged PR1019 deliberately narrowed HANGER DELETE authority after QF-1019-001:

```text
H = 1                         DELETE eligible
H > 1 and delete all records  DELETE eligible
H > 1 and retain any record   BLOCK
```

Partial H>1 remains blocked by:

```text
WRITER_2_HANGER_PARTIAL_MULTI_RECORD_TAIL_ORDER_UNQUALIFIED
```

because repository emitters disagree on HGRDAT/TAG-GUID order after IHGRNODE. HANGER CREATE remains blocked by:

```text
WRITER_2_HANGER_CREATE_PAYLOAD_SEMANTICS_NOT_QUALIFIED
```

PR1020 does not broaden either boundary.

## 2. Physical mutation model

Only two original-preimage replacement classes exist:

```text
CONTROL_HANGER_COUNT
MISCEL_1_HANGER_DELETE_ALL_PAYLOAD
```

Execution flow:

```text
untouched TARGET0
 + bound PR1019 delete-all plan
 -> prove countAfter = 0 and compaction.deleteAll = true
 -> rewrite exact CONTROL.NOHGRS 13-byte field to integer zero
 -> locate complete MISCEL_1 physical envelope
 -> retain original RRMAT/VFLEX prefix rows byte-for-byte
 -> remove complete hanger payload
 -> retain original four execution rows byte-for-byte
 -> patch TARGET0 once
 -> emit byteString/Uint8Array
```

No HGRDAT, TAG, GUID, IHGRFREE or packed-array record is individually interpreted or retained in this phase.

## 3. Why H>1 tail-order conflict cannot affect this writer

For delete-all, every hanger-specific row is removed. The only retained MISCEL_1 rows are:

```text
prefix = ceil(NUMELT/6) RRMAT rows + 4*NUMNOZ VFLEX rows
suffix = 4 execution rows
```

Therefore both disputed tail layouts produce the same authorized postimage without choosing either ordering.

## 4. Physical preimage gates

The writer requires:

```text
PR1019 delete plan READY
compaction.deleteAll == true
countAfter == 0
createAuthority.ready == false
original byte custody
canonical CONTROL.NOHGRS before field
exact MISCEL_1 pre-row count from PR1019 custody
complete next-section marker
retained row line endings present
CONTROL and MISCEL replacement spans disjoint
exact beforeField equality at patch time
```

CONTROL canonicalization is intentionally stricter than the planner: the 13-byte preimage must equal the right-aligned integer count exactly before mutation.

## 5. Independent validator

`validateCiiWriter2HangerDeleteAllRoundTrip()` does not import physical replacement helpers from the writer.

It independently:

1. reruns `buildCiiWriter2HangerDeletePlan()` on untouched TARGET0 + bound transfer plan;
2. requires independent delete-all proof and countAfter zero;
3. independently locates CONTROL row1 field3 using fixed-field widths;
4. independently derives `prefixRows = ceil(NUMELT/6) + 4*NUMNOZ`;
5. independently derives `hangerRows = 2 + 5*H + 5*ceil(H/6)`;
6. independently locates the MISCEL_1 envelope;
7. reconstructs the retained prefix and four execution rows directly from TARGET0 bytes;
8. reconstructs the full expected variable-length postimage;
9. requires actual post bytes to equal that expected postimage exactly;
10. rechecks CONTROL.NOHGRS=0, MISCEL row count, zero-hanger custody, connectivity and section order;
11. checks writer mutation/result/delete-plan testimony only after independent byte authorization.

Writer testimony is never primary authorization.

## 6. Validation/falsifier coverage authored

`tests/cii-workspace-writer2-hanger-delete-all-physical.test.js` contains:

```text
H=1 synthetic delete-all
H=3 interleaved-tail delete-all
H=3 grouped-tail delete-all
partial H>1 physical invocation -> BLOCK
unrelated postimage byte tamper -> validator BLOCK
forged mutation ledger -> validator BLOCK
stale authorized-span preimage -> patch BLOCK
real BM_CII_SOURCE node-205 delete-all -> writer + validator oracle
```

The real benchmark expectation remains:

```text
NOHGRS 1 -> 0
MISCEL_1 rows 23 -> 11
7 RRMAT rows retained
4 execution rows retained
hanger node 205 removed from hanger custody
```

## 7. QF-1020-001 — validator testimony hardening

Source audit found that the first validator draft authorized bytes independently but was permissive if `writerResult.byteString` or `writerResult.deletePlan` testimony was omitted.

Fixed:

```text
writerResult.byteString must exactly equal actual post bytes
writerResult.deletePlan must be present and match independent plan testimony
writer result schema/status/writer/family required
mutation count required
hanger count testimony required
before/after byte-length testimony required
```

Exact postimage authorization remains independent of all writer testimony.

## 8. Changed-file ledger

```text
tabs/cii-workspace/cii-workspace-writer2-hanger-delete-all-write.js
  new physical two-span delete-all writer

tabs/cii-workspace/cii-workspace-writer2-hanger-delete-all-validation.js
  new independent complete-postimage validator

tests/cii-workspace-writer2-hanger-delete-all-physical.test.js
  focused synthetic + adversarial + real-benchmark regression

agents/PR1020_workreport.md
agents/status/PR1020.yaml
agents/claims/PR1020.yaml
agents/MASTER_INDEX.md
  recovery/continuity only
```

No parser, converter, benchmark CII, current product/core Writer2 route, Writer1 code or UI file is modified.

## 9. Validation truth

```text
PR1019 merge / PR1020 base grounding                    PASS
physical writer source audit                           PASS_SOURCE_INSPECTION
independent validator source audit                     PASS_SOURCE_INSPECTION
QF-1020-001 testimony hardening                        PASS_SOURCE_INSPECTION
exact repository checkout                              BLOCKED_ENVIRONMENT_DNS
focused PR1020 JS regression                           AUTHORED_NOT_RUN_ENVIRONMENT
merged PR1019 planner regression                       NOT_RUN_ENVIRONMENT
Writer2 NODENAME/SIF regressions                       NOT_RUN_ENVIRONMENT
full repository tests                                  NOT_RUN_ENVIRONMENT
browser/product                                        NOT_RUN_ENVIRONMENT
```

Observed checkout failure:

```text
fatal: unable to access 'https://github.com/reallaksh19/XML_Compare_Utilities.git/':
Could not resolve host: github.com
```

No unexecuted test is represented as PASS.

## 10. Exact next phase after acceptance

Do not route this as a sequential fourth Writer2 pass after existing NODENAME/SIF product mutation.

A successor must first decide between:

```text
A. extend the existing one-original-preimage Writer2 composite to include HANGER_DELETE_ALL
   - all NODENAME/SIF/HANGER physical claims must originate from the same untouched TARGET0
   - original-coordinate overlap arbitration
   - patch once
   - independent full-postimage reconstruction

or

B. keep HANGER DELETE as a separately selected Writer2 transaction until composite adoption is implemented
```

Product/core routing must not invoke NODENAME/SIF composite and then run HANGER deletion using stale original offsets.

Partial H>1 deletion remains blocked until tail ordering is source-qualified.

## Appendix A — takeover qualification

1. Why are only two physical replacement spans authorized in PR1020?
2. Why does delete-all avoid the H>1 HGRDAT/TAG-GUID ordering dispute?
3. Derive the H>0 hanger-row formula.
4. For BM_CII_SOURCE derive 23 rows before and 11 after.
5. Why must CONTROL.NOHGRS preimage be canonical before physical mutation?
6. Why are RRMAT/VFLEX and execution rows copied from original bytes rather than reserialized?
7. What independently authorizes the final postimage?
8. Why is writerResult.mutations testimony rather than authority?
9. Why may PR1020 not be sequentially appended after the current NODENAME/SIF product writer?
10. Which unresolved fact still blocks partial H>1 deletion?
