# PR1001 — CII explicit APPLY / EXCLUDE transfer scope

# CURRENT RECOVERY STATE — READ FIRST

## Recovery Header

```text
HANDOVER_READINESS: READY_FOR_REVIEW
PR_RECOVERY_STATE: DRAFT_IMPLEMENTATION_COMPLETE
WORK_INTENT: IMPLEMENT
CRITICALITY: ENGINEERING_CRITICAL_MUTATION_AUTHORITY
REPOSITORY: reallaksh19/XML_Compare_Utilities
SOURCE_TASK: Issue #993 — explicit APPLY / EXCLUDE transfer-scope custody
PR: 1001
BRANCH: agent/cii-explicit-transfer-scope
BASE_AT_GROUNDING: main@0274f63c6e17a0495a63e268b5da0dc0bb0e8a16
PREDECESSOR: PR999 merged -> 0274f63c6e17a0495a63e268b5da0dc0bb0e8a16
REPORT_BASIS_HEAD: 4f04983e71f7bf0795dbfc03de7843c454ff78d0
MERGE_AUTHORITY: OWNER_ONLY
CURRENT_STAGE: HANDOVER / OWNER REVIEW
GROUNDING_EPOCH: GE-001 / 2026-08-19
CURRENT_BLOCKER: COMPLETE_CHECKOUT_REPOSITORY_AND_BROWSER_EXECUTION_NOT_RUN_ENVIRONMENT
FINAL_LEDGER: 14 EXPECTED / 14 ACTUAL / 0 UNEXPLAINED
WIP_RESIDUE: NONE
EXACT_NEXT_ACTION: refresh live PR head/main/reviews/checks; remain draft until explicit owner merge authorization
```

## Handover in 60 Seconds

PR999 clarified SOURCE candidate / Current TARGET / Effective TARGET. PR1001 makes mutation selection authoritative rather than cosmetic:

```text
reviewed correspondence
      ↓
classified transfer candidates
      ↓
EXPLICIT APPLY / EXCLUDE SCOPE
      ↓
APPLY -> transferPlan.operations[]
EXCLUDE -> transferPlan.excludedOperations[]
      ↓
Writer readiness on APPLY set only
      ↓
qualified mutation
```

The scope binds SOURCE hash, TARGET hash and the exact mutable operation-ID set. A missing/new/duplicate operation or hash change invalidates the scope. EXCLUDE never becomes fake KEEP and never weakens Writer policy.

---

# 1. Final grounded state

At final reconciliation before this report commit:

```text
main = 0274f63c6e17a0495a63e268b5da0dc0bb0e8a16
PR999 = MERGED
PR1001 = OPEN / DRAFT / MERGEABLE / UNMERGED
PR1001 branch = agent/cii-explicit-transfer-scope
behind main = 0
changed files = 14 expected / 14 actual / 0 unexplained
temporary WIP files = none
```

Live GitHub state overrides this snapshot. The report commit advances the branch head; `REPORT_BASIS_HEAD` records the pre-report reconciliation head.

---

# 2. Root cause

Identity approval and transfer classification already existed, but the product path had no independent mutation-scope custody. Every reviewed classified operation flowed into Writer readiness. A single unsupported reviewed delta could therefore block unrelated qualified mutations, and there was no authoritative representation of:

```text
identity accepted
but this engineering delta is intentionally NOT transferred
```

A visual checkbox would be insufficient because Writer would still receive the unfiltered operation set.

---

# 3. Implemented authority

## 3.1 Scope schemas

```text
CIIWorkspaceTransferScope.v1
CIIWorkspaceTransferScopeSelection.v1
```

## 3.2 Exact binding

A scope binds:

```text
SOURCE content SHA-256
TARGET content SHA-256
exact candidateOperationIds[]
one decision for every mutable candidate operation
```

Allowed decisions:

```text
APPLY
EXCLUDE
```

Fail-closed blockers:

```text
TRANSFER_SCOPE_EXPLICIT_SELECTION_REQUIRED
TRANSFER_SCOPE_SOURCE_HASH_MISMATCH
TRANSFER_SCOPE_TARGET_HASH_MISMATCH
TRANSFER_SCOPE_OPERATION_SET_MISMATCH
TRANSFER_SCOPE_DUPLICATE_OPERATION:<id>
TRANSFER_SCOPE_DECISION_INVALID
TRANSFER_SCOPE_NO_APPLY_OPERATIONS
```

## 3.3 APPLY

APPLY remains in existing `transferPlan.operations[]`. Existing Writer 1A/1B readiness evaluates it unchanged. PR1001 does not add Writer support for any family.

## 3.4 EXCLUDE

EXCLUDE moves to `excludedOperations[]` with `scopeDecision: EXCLUDE`.

It remains visible in:

- scoped audit JSON;
- applied/excluded IDs and counts;
- excluded-operation UI;
- engineering-delta presentation as `EXCLUDED`;
- SOURCE proposal traceability.

It is absent from Writer `operations[]`.

Thus a blocked SIF/TEE delta may be EXCLUDED while qualified P1 is APPLY. Writer evaluates P1 only. If SIF/TEE is APPLY, Writer remains BLOCKED.

## 3.5 All EXCLUDE

```text
TRANSFER_SCOPE_NO_APPLY_OPERATIONS
=> transfer plan BLOCKED
=> no mutation authority
```

## 3.6 Scoped preview / audit

`bindCiiTransferScopeToPreview()` recalculates:

- scoped transfer plan;
- Writer readiness;
- Stage 06 readiness;
- audit transfer preview;
- audit `transferScope`;
- audit `excludedTransferOperations`;
- mutation-authority status;
- artifact bundle.

After binding, existing Compare-tab CSV/audit controls are intercepted to export the scoped artifacts, avoiding a competing unscoped mutation audit.

---

# 4. Product UI

The CII Workspace tile now mounts `mountCiiWorkspaceScopedEngineeringShell()`.

The wrapper consumes the existing PR997/998 engineering shell; it does not create a second matching or Writer-policy engine.

Transfer Preview provides:

- one APPLY/EXCLUDE decision per mutable operation;
- default EXCLUDE before engineer action;
- APPLY-all-preview-ready and EXCLUDE-all convenience actions;
- explicit Bind APPLY / EXCLUDE scope;
- scope ID and selected/excluded counts;
- separate excluded-operation table;
- scoped audit export;
- Writer Apply disabled until scope is BOUND and Writer readiness is READY.

Correspondence review and mutation scope remain distinct. Changing correspondence decisions makes scope dirty until approvals are rebound through the existing review action.

---

# 5. Authority boundary

Changed authority:

```text
reviewed/classified transfer candidate
    -> explicit operation-level mutation scope
```

Unchanged:

```text
Method A/B mathematics and weighting
base-loop orchestration
correspondence arbitration
engineering-delta calculation
transfer-policy classification
Writer 1A implementation
Writer 1B implementation / whitelist
fixed-field parser
protected converters
GitHub workflows
```

Low-level Writer callers remain compatible. Product CII Workspace is the path that requires explicit scope.

---

# 6. Validation truth

| Validation | Status | Observation / Oracle |
|---|---|---|
| Main/source grounding | PASS | SOURCE_INSPECTION |
| Final 14-file authority-boundary diff | PASS | GIT_COMPARE |
| Standalone scope state machine | PASS | INDEPENDENT_REPRODUCTION |
| APPLY P1 + EXCLUDE blocked SIF | PASS | INDEPENDENT_REPRODUCTION |
| all EXCLUDE blocks mutation | PASS | INDEPENDENT_REPRODUCTION |
| new operation invalidates stale scope | PASS | INDEPENDENT_REPRODUCTION |
| TARGET hash mismatch invalidates scope | PASS | INDEPENDENT_REPRODUCTION |
| Repository transfer-scope JS test | AUTHORED_NOT_RUN_ENVIRONMENT | NOT_OBSERVED |
| Repository scope UI/product-routing test | AUTHORED_NOT_RUN_ENVIRONMENT | NOT_OBSERVED |
| Full CII shell lifecycle | NOT_RUN_ENVIRONMENT | NOT_OBSERVED |
| SOURCE 3 -> TARGET 3-1 browser workflow | NOT_RUN_ENVIRONMENT | NOT_OBSERVED |
| Chromium | NOT_RUN_ENVIRONMENT | NOT_OBSERVED |
| Full repository suite | NOT_RUN_ENVIRONMENT | NOT_OBSERVED |

The runtime failed before checkout because `github.com` DNS resolution was unavailable. No authored repository test is represented as PASS.

---

# 7. Final changed-file ledger

```text
agents/MASTER_INDEX.md
agents/PR1001_workreport.md
agents/claims/PR1001.yaml
agents/status/PR1001.yaml
docs/CIIcompareconceptnote.md
tabs/cii-workspace/cii-workspace-contracts.js
tabs/cii-workspace/cii-workspace-review-presentation.js
tabs/cii-workspace/cii-workspace-tab.js
tabs/cii-workspace/cii-workspace-transfer-scope-ui.css
tabs/cii-workspace/cii-workspace-transfer-scope-ui.js
tabs/cii-workspace/cii-workspace-transfer-scope.js
tests/cii-workspace-transfer-scope-ui.test.js
tests/cii-workspace-transfer-scope.test.js
tests/qualification/cii-workspace-transfer-scope-oracle.md
```

Final: **14 expected / 14 actual / 0 unexplained**.

No `agents/WIP-CII-TRANSFER-SCOPE*` file remains.

---

# 8. Risks / remaining qualification

**RISK-1001-01 — Browser lifecycle not executed.**  
The scoped shell uses a local MutationObserver around Transfer Preview. It disconnects before its own render and reconnects afterward; real Chromium lifecycle remains NOT_RUN.

**RISK-1001-02 — Full Writer round trip not executed through scoped UI.**  
Writer implementation is unchanged and receives only selected operations, but the complete product round trip remains NOT_RUN_ENVIRONMENT.

**RISK-1001-03 — Direct lower-level shell remains compatibility path.**  
The product tile is scoped; direct programmatic use of lower-level shell/Writer APIs is deliberately not silently redefined.

---

# 9. Decision log

**DEC-1001-01:** EXCLUDE is a separate audit collection, never fake KEEP.  
**DEC-1001-02:** Writer policy is unchanged; scope filters before readiness.  
**DEC-1001-03:** Exact operation-set equality prevents stale scope applying new operations.  
**DEC-1001-04:** SOURCE/TARGET hashes are scope custody.  
**DEC-1001-05:** All EXCLUDE has no mutation authority.  
**DEC-1001-06:** Product tile requires explicit scope; low-level compatibility remains.  
**DEC-1001-07:** Bound audit/CSV exports use scoped artifacts.

---

# Appendix A — Expert handover questionnaire

1. **Where is mutation-scope authority applied?**  
   `cii-workspace-transfer-scope.js`, after transfer classification and before Writer readiness.

2. **Does EXCLUDE modify Writer classification?**  
   No. It removes the operation from Writer `operations[]` while retaining the original classified operation in `excludedOperations[]`.

3. **Can an unsupported operation become ready by APPLY?**  
   No. Existing Writer readiness sees it and remains blocked.

4. **What prevents an old scope from applying a newly generated operation?**  
   Exact mutable candidate operation-ID set equality; mismatch is `TRANSFER_SCOPE_OPERATION_SET_MISMATCH`.

5. **What prevents scope reuse on changed TARGET/SOURCE?**  
   Bound content SHA-256 values.

6. **What happens if every mutable operation is EXCLUDE?**  
   `TRANSFER_SCOPE_NO_APPLY_OPERATIONS`; no Writer mutation authority.

7. **What is canonical audit after binding?**  
   Scoped preview audit containing selected transfer plan plus excluded operations. Existing export controls emit scoped artifacts.

8. **Did PR1001 change Writer 1B whitelist/fixed-field logic?**  
   No.

9. **What remains NOT_RUN?**  
   Repository-focused tests, shell lifecycle, real SOURCE 3/TARGET 3-1 browser flow, Chromium and full suite due checkout/DNS limitation.

10. **Falsifier?**  
    If EXCLUDE still reaches Writer `operations[]`, a new operation becomes implicit APPLY under an old scope, or selected unsupported APPLY becomes Writer-ready, PR1001 is invalid.
