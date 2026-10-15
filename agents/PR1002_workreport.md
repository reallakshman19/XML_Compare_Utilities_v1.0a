# PR1002 — CII Writer 1C authority and future upgrade roadmap

# CURRENT RECOVERY STATE — READ FIRST

## Recovery Header

```text
HANDOVER_READINESS: READY_FOR_OWNER_REVIEW
PR_RECOVERY_STATE: DRAFT_DOCUMENTATION_NORMALIZED_PHASE1_AUTHORITY
WORK_INTENT: DESIGN_AUTHORITY / ROADMAP
CRITICALITY: ENGINEERING_CRITICAL_WRITER_AUTHORITY
REPOSITORY: reallaksh19/XML_Compare_Utilities
PR: 1002
IMPLEMENTATION_ISSUE: 1003
IMPLEMENTATION_PR: 1004
BRANCH: agent/cii-writer-1c-roadmap
BASE: main@5a5fa0ae5068a7c15eecc1a57557e71336b9754c
PREDECESSOR: PR1001 merged -> 5a5fa0ae5068a7c15eecc1a57557e71336b9754c
MERGE_AUTHORITY: OWNER_ONLY
CURRENT_STAGE: DOCUMENTATION AUTHORITY NORMALIZED TO PHASE1 EVIDENCE
CURRENT_BLOCKER: NONE INSIDE PR1002
EXACT_NEXT_ACTION: confirm stacked PR1004 contains this final PR1002 head as an ancestor; then PR1002 awaits owner review/merge decision only; do not merge without explicit owner authorization
```

## Handover in 60 Seconds

PR1002 is documentation-only. It freezes Writer 1C as pointer-stable, row-count-stable mutation of already-existing auxiliary records and incorporates the stronger authority proven during PR1004 Phase 1.

Governing Phase-1 authority:

```text
original TARGET bytes are physical authority
+ exact persisted NODENAME physical custody
+ apply-time custody re-proof
+ independently derived authorized span set S_auth
+ Writer-reported spans are audit testimony only
+ actual byte changes D must satisfy D ⊆ S_auth
+ exact preimage/postimage
+ fixed-width in-place replacement
+ structural and semantic negative assurance
```

Writer 1C does **not** reconstruct or reserialize the complete CII file merely to edit NODENAME.

Phase-1 transaction authority is NODENAME-only Writer1C APPLY. Mixed Writer1A/1B APPLY + Writer1C APPLY remains blocked until separately qualified as one original-byte transaction. Long-term lower-writer delegation remains roadmap intent, not current Phase-1 authority.

Shared physical ownership is fail-closed:

```text
same span + different desired bytes -> BLOCK
same span + identical desired bytes -> canonicalize only with complete compatible owner set
unselected alias changed by mutation -> BLOCK
```

SIF/TEE remains closed while `FIELD_2_SEMANTICS_UNQUALIFIED` is true. Hanger mutation remains outside Writer 1C.

---

# 1. Live Ground Truth

Latest PR1002 branch authority is documentation/custody only and must remain exactly five paths:

```text
agents/MASTER_INDEX.md
agents/PR1002_workreport.md
agents/claims/PR1002.yaml
agents/status/PR1002.yaml
docs/CIIcompareconceptnote.md
```

No parser, Writer, UI, converter or workflow production file belongs in PR1002.

PR1004 is the stacked implementation follow-on. Because any PR1002 documentation update advances the stacked base, the final coordination rule is:

```text
current PR1002 head must be an ancestor of PR1004
PR1002 -> PR1004 compare behind_by must equal 0
PR1004 review diff must remain its exact 20-file implementation/recovery ledger
```

Live GitHub state overrides any older SHA snapshot in history.

---

# 2. NODENAME Authority

Qualified physical layout:

```text
ELEMENT block rows                  15
NODENAME pointer row                13 zero-based within ELEMENT block
NODENAME pointer fixed field        [67,80) zero-based
NODENAME FROM slice                 [2,28)
NODENAME TO slice                   [28,53)
```

Writable custody requires TARGET element/index, pointer, referenced NODENAME row, FROM/TO identity, absolute byte span, exact preimage and complete physical owner/alias set.

Creation/deletion/pointer allocation remains Writer 2.

---

# 3. Independent Negative Assurance

Definitions:

```text
S_auth = independently derived authorized byte spans
B      = Writer-reported spans / testimony
D      = actual byte-difference indices
```

PASS requires:

```text
D ⊆ S_auth
B consistent with expected report for S_auth
exact TARGET preimage at S_auth
exact expected postimage at S_auth
all bytes outside S_auth identical
pointer/cardinality/topology drift = 0
unexpected semantic delta count = 0
```

A requested edit that succeeds while an unrelated pointer, whitespace, padding, comment byte or line ending changes is FAIL even when the CII reparses.

At least one independent oracle is required per Writer1C family.

---

# 4. SIF / TEE Boundary

Known structural custody:

```text
SIF/TEE block = 10 rows
ELEMENT pointer = 1-based block index
existing block ownership = pointer-bound
```

Known blocker:

```text
FIELD_2_SEMANTICS_UNQUALIFIED
```

Before any SIF/TEE field becomes writable, the next qualification must establish:

```text
section
block-relative row
field/byte span
fixed width
numeric/text encoding
engineering meaning
unit basis where applicable
zero/blank semantics
allowed domain
pointer ownership
preimage rule
source locator / authority path
```

No raw 10-row payload COPY is authorized.

---

# 5. Writer 2 / Writer 3 Boundaries

Writer 2 owns pointer/cardinality transactions, including:

- NODENAME row create/delete and pointer update;
- SIF/TEE block create/delete/reindex;
- hanger create/delete and packed-array/count maintenance;
- auxiliary section expansion/compaction;
- CONTROL count changes.

Writer 3 owns node/element/connectivity/topology mutation.

---

# 6. Implementation Evidence from PR1004

Durable PR1004 evidence records:

```text
exact TARGET1 original-byte identity                     PASS
production NEUTRAL intake + physical custody             PASS
production core Writer1C benchmark round trip            PASS
unauthorized-byte falsifier                              PASS
stale-target SHA falsifier                               PASS
shared/redundant NODENAME ownership                      PASS
independent Python fixed-column oracle                   PASS
Writer1A/1B focused regressions                          PASS
Chromium Writer1C routing/binary path                    PASS
PR1002 authority normalization                           PASS
stacked-base reconciliation                              PASS at previous PR1002 head; must be refreshed after this final doc checkpoint
full repository npm test                                 NOT_RUN
GitHub qualifying PR checks/workflows                    NONE OBSERVED
```

The implementation PR remains draft because its full repository suite is still NOT_RUN in the current execution environment. PR1002 does not convert that limitation to PASS.

---

# 7. Validation Truth for PR1002

```text
main/source grounding                    PASS / SOURCE_INSPECTION
authority-boundary audit                 PASS / SOURCE_INSPECTION
branch concept-note normalization        PASS / REMOTE_SOURCE_UPDATE
workreport/status/index normalization    PASS / REMOTE_SOURCE_UPDATE
production code execution in PR1002      NOT_APPLICABLE
browser execution in PR1002              NOT_APPLICABLE
PR1004 implementation evidence           REFERENCED, not reclassified as PR1002 execution
```

---

# 8. Decisions / Risks / Debt

- `DEC-1002-01` Writer1C is defined by physical ownership and cardinality stability, not UI family name.
- `DEC-1002-02` Original TARGET bytes are physical mutation authority.
- `DEC-1002-03` Independent validator-derived `S_auth` is authorization; Writer reports are testimony only.
- `DEC-1002-04` Phase-1 mixed lower-writer mutation is blocked pending separate transaction qualification.
- `DEC-1002-05` SIF/TEE raw field2 remains blocked while engineering semantics are unqualified.
- `RISK-1002-01` PR1004 is stacked on PR1002; any PR1002 head movement requires one final ancestry reconciliation before owner review.
- `DEBT-1002-01` PR1004 full repository execution remains NOT_RUN because the current runtime cannot materialize a complete exact checkout.

---

# 9. Historical Roadmap

```text
Phase 0  close retained repository-wide qualification debt
Phase 1  Writer 1C existing NODENAME rows
Phase 2  source-qualify SIF/TEE field semantics, then one field family at a time
Phase 3  optional existing auxiliary text after separate qualification
Phase 4  Writer 2 pointer/cardinality transaction engine
Phase 5  Writer 3 topology transaction engine
Phase 6  mutation manifest / rollback / batch automation
```

Issue #1003 remains the implementation task. Phase 2 must begin with engineering-data qualification, not SIF writer coding.

---

# Appendix A — Expert Handover Gate

1. Trace original TARGET bytes through physical custody, NODENAME pointer/row ownership, Writer1C patch and independent validation. Identify exactly where decoded text ceases to be authority.
2. Given `S_auth`, `B`, and `D`, construct a falsifier where the requested NODENAME edit is correct but an unrelated SIF pointer byte changes. Explain why the output must fail even if it reparses.
3. Explain the three shared-span cases: identical selected requests, divergent selected requests, and selected mutation affecting an unselected alias.
4. Explain why individually qualified Writer1A/1B operations cannot automatically be combined with Writer1C Phase-1 APPLY in one transaction.
5. Identify the minimum authoritative evidence required before SIF/Tee raw field 2 can receive any Writer1C mutation token.
