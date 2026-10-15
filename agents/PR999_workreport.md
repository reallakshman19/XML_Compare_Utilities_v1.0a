# PR999 — CII Compare Review / Delta / Transfer clarity

# CURRENT RECOVERY STATE — READ FIRST

## Recovery Header

```text
HANDOVER_READINESS: READY_FOR_REVIEW_AND_OWNER_MERGE_DECISION
PR_RECOVERY_STATE: DRAFT_IMPLEMENTATION_COMPLETE
WORK_INTENT: IMPLEMENT
CRITICALITY: ENGINEERING_CRITICAL_UI_PRESENTATION
REPOSITORY: reallaksh19/XML_Compare_Utilities
SOURCE_TASK: Issue #993 — Compare Review / Engineering Delta / Transfer Preview clarity
PR: 999
BRANCH: agent/cii-review-transfer-clarity
BASE: main@7d63abe83a2fe4307ea518986683d823926d281c
PREDECESSORS: PR997 merged a2b8b055; PR998 merged 7d63abe8
REPORT_BASIS_HEAD: 0a728f26f536dc1d50c72de3e2b3f3681223aeb0
MERGE_AUTHORITY: OWNER_ONLY
CURRENT_STAGE: HANDOVER / MERGE DECISION
GROUNDING_EPOCH: GE-001 / 2026-08-19
APPENDIX_A_STATUS: PASS_FOR_CURRENT_INCREMENT
CURRENT_BLOCKER: NONE FOR APPROVED IMPLEMENTATION; COMPLETE-CHECKOUT SHELL/BROWSER/FULL-SUITE EXECUTION REMAINS NOT_RUN_ENVIRONMENT
EXACT_NEXT_ACTION: owner review / merge decision only; do not merge without explicit authorization
```

## Handover in 60 Seconds

PR999 is a presentation-only successor to merged PR997/998. It does not alter engineering-delta calculation, transfer classification, Writer readiness, matching or mutation.

It makes this distinction explicit:

```text
SOURCE candidate
Current TARGET
Effective TARGET after apply
```

Effective TARGET is conservative and comes only from the **bound review ledger + existing transfer operation + Writer 1B readiness**:

```text
PENDING / REJECTED                  -> Current TARGET
local approval not rebound          -> Current TARGET · REBUILD PREVIEW
no qualified operation              -> Current TARGET
KEEP / PROTECTED / BLOCKED          -> Current TARGET
PREVIEW_READY + Writer blocked      -> Current TARGET + proposal visible
PREVIEW_READY + Writer ready        -> proposed value · WILL APPLY
```

Structured engineering values such as XYZ vectors and restraint records are rendered as labelled engineering text instead of raw JSON.

---

# 1. Final observed ground truth

Observed before final report commit:

```text
main: 7d63abe83a2fe4307ea518986683d823926d281c
PR997: MERGED -> a2b8b055e858d0cc324257de1c51a21e75ca5205
PR998: MERGED -> 7d63abe83a2fe4307ea518986683d823926d281c
PR999: open / draft / mergeable / unmerged
PR999 report-basis head: 0a728f26f536dc1d50c72de3e2b3f3681223aeb0
base drift: 0 behind main
changed files: 7 expected / 7 actual / 0 unexplained
reviews: none
review threads: none
status checks: none
PR workflow runs: none
```

Live GitHub state overrides this snapshot. The report commit advances the head; use `REPORT_BASIS_HEAD` rather than an impossible self-referential report-head rule.

---

# 2. Mission / acceptance result

| Requirement | Result |
|---|---|
| Human-readable structured engineering values | IMPLEMENTED |
| No raw JSON in primary Delta/Transfer presentation | IMPLEMENTED |
| Delta Grid: SOURCE / current TARGET / effective TARGET | IMPLEMENTED |
| Transfer Preview: SOURCE / current TARGET / effective TARGET | IMPLEMENTED |
| Pending/rejected decision cannot look applied | IMPLEMENTED |
| Approval not rebound cannot look applied | IMPLEMENTED (`REBUILD PREVIEW`) |
| Protected/blocked operation keeps current TARGET effective | IMPLEMENTED |
| Row PREVIEW_READY but overall Writer blocked keeps current TARGET effective | IMPLEMENTED |
| Effective changes only when operation and Writer are ready | IMPLEMENTED |
| Engineering delta / transfer policy / Writer authority unchanged | VERIFIED |
| Per-delta APPLY/EXCLUDE transfer scope | OUT OF SCOPE |

---

# 3. Root cause and falsifier

## ISS-999-01 — generic JSON-like presentation

`cii-workspace-shell.js` used `stableStringify()` for object-valued engineering data. The values were present but not shown in an engineering-readable form.

## ISS-999-02 — proposal was not clearly separated from effective TARGET

The authoritative transfer contract already had:

```text
before
proposed
action
status
blockers
engineeringDeltaId
matchAuthority
```

but the UI did not state whether the proposal would actually be written under current Writer readiness.

### Falsifiers

PR999 fails if any is possible:

```text
Writer blocked -> proposed value displayed as effective TARGET
PROTECTED/BLOCKED -> proposed value displayed as effective TARGET
local unbound Accept -> proposed value displayed as effective TARGET
XYZ/restraint structured value -> primary UI dumps JSON
```

Focused regression covers all four.

---

# 4. Production implementation

## `cii-workspace-review-presentation.js`

New read-only presentation module.

Human-readable formatting:

- XYZ: `X … · Y … · Z …`;
- element vector: `ΔX … · ΔY … · ΔZ …`;
- numeric lists: concise comma-separated values;
- structured records: labelled field groups;
- booleans: YES/NO;
- nested rendering depth bounded;
- numeric delta sign explicitly labelled `TARGET − SOURCE`.

Effective TARGET projection uses only existing authorities. It never modifies the plan or Writer state.

## `cii-workspace-shell.js`

Existing workflow shell remains owner of decisions, review refresh and Writer apply. PR999 only delegates:

- inspector engineering-change table;
- Engineering Delta Grid;
- Transfer Preview rendering.

The existing handlers and mutation path remain unchanged.

---

# 5. Negative assurance / protected authority

Not modified by PR999:

```text
Method A/B geometry, pipe-run and automatic discovery modules
multi-base authority / correspondence / arbitration
cii-workspace-engineering-delta.js
cii-workspace-transfer-policy.js
cii-workspace-transfer-plan.js
Writer 1A / Writer 1B readiness and mutation
fixed-field parser
protected 3D_Converters writer
GitHub workflows
```

No APPLY/EXCLUDE transfer-scope control is introduced in PR999.

---

# 6. Validation ledger

| Check | Status | Observation / oracle |
|---|---|---|
| presentation module syntax | PASS | LOCAL_EXECUTION / Node `--check` |
| focused presentation regression | PASS | LOCAL_EXECUTION / exact GitHub blobs |
| module blob custody | PASS | `525798bfda60c6c2ab85719d507524e7b679ac16` |
| test blob custody | PASS | `5c95a0e18a2a90d3c16801b90ce197dc3282d6b3` |
| implementation authority diff | PASS | initial 3 production/test files, 0 behind main |
| shell integration | PASS | SOURCE_INSPECTION; rendering delegation only |
| final changed-file ledger | PASS | 7 expected / 7 actual / 0 unexplained |
| review/thread state | PASS | none observed |
| status/workflow observation | PASS | no status checks / no PR workflow runs observed |
| full shell lifecycle | NOT_RUN | complete checkout unavailable |
| SOURCE 3 / TARGET 3-1 browser flow | NOT_RUN | browser/checkout unavailable |
| Chromium | NOT_RUN | browser unavailable |
| full repository suite | NOT_RUN | complete checkout unavailable |

The focused regression proves READY, blocked, protected, pending and unbound-review outcomes and verifies the new SOURCE/current/effective columns. No NOT_RUN check is represented as PASS.

---

# 7. Changed-file ledger

```text
agents/MASTER_INDEX.md
agents/PR999_workreport.md
agents/claims/PR999.yaml
agents/status/PR999.yaml
tabs/cii-workspace/cii-workspace-review-presentation.js
tabs/cii-workspace/cii-workspace-shell.js
tests/cii-workspace-review-presentation.test.js
```

Final observed ledger: **7 expected / 7 actual / 0 unexplained**.

---

# 8. Decisions / risk / debt

## DEC-999-01 — conservative effective TARGET

A proposal becomes effective only when the row is `PREVIEW_READY` **and** overall Writer 1B readiness is true. This matches the actual all-plan Writer gate and prevents visually implying partial mutation.

## DEC-999-02 — current UI decision is not bound plan authority

Until `Apply approvals to Transfer Preview` rebuilds the review/plan, a newly selected Accept/Lock is shown as `REBUILD PREVIEW`; current TARGET remains effective.

## RISK-999-01 — browser layout remains unexecuted

The wide tables need Chromium qualification in a complete checkout. This is retained as NOT_RUN, not hidden.

## DEBT-999-01 — APPLY/EXCLUDE must be a separate authority slice

If engineers are to select individual approved transfer operations, the selection must become explicit transfer-plan custody and Writer readiness input. UI-only hiding/filtering is not sufficient.

---

# 9. Continuation

If PR999 is not yet merged:

1. re-ground live main/head/checks/reviews;
2. execute shell/browser suites if environment becomes available;
3. do not change Writer or transfer policy to satisfy presentation expectations;
4. do not add APPLY/EXCLUDE to this PR;
5. do not merge without explicit owner authorization.

After PR999 merge, the next coherent PR is **explicit per-delta/operation APPLY vs EXCLUDE transfer-scope custody**, with the Writer consuming the selected operation set and fail-closed behavior for unsupported selected operations.

---

# Appendix A — implementation takeover qualification

A new engineering-critical implementation agent must answer repository-specifically before modifying production behavior.

**A1 — Production Trace (20):** Trace one `engineeringDeltaId` from `engineeringDeltas.changedRows` through `transferPlan.operations` into the PR999 effective-TARGET cell. Explain why a live UI Accept is insufficient.

**A2 — Failure Isolation (20):** Construct a plan where one row is `PREVIEW_READY` but another row blocks Writer 1B. State the effective TARGET for the first row and the falsifier for an unsafe UI.

**A3 — Authority / Invariant (20):** Name the modules that own delta calculation, transfer classification and Writer readiness, and explain why PR999 must not modify them.

**A4 — Independent Validation (20):** For SOURCE P1=10 and TARGET P1=20, state signed delta and effective TARGET for pending, ready Writer, protected and Writer-blocked cases.

**A5 — Minimal Patch (20):** If direction-cosine rendering is poor in Chromium, identify the smallest presentation-only change and negative-assurance checks.

Qualification threshold: total >=92/100 and every question >=17/20. Generic answers without repository anchors fail.
