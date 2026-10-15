# XML Compare Validation + Transfer Orchestrator

This document records the shadow implementation of **Master Implementation Plan 2** for XML Compare Utilities.

## Boundary

The orchestrator starts only after Source A and Target B are ready for connector/mapping. Input parsing, source profile detection, stable identity generation, coordinate-frame classification, and input readiness audits remain Plan 1 responsibilities.

```text
Input readiness audits
→ MatchCandidateSet.v1
→ MatchDecision.v1
→ ApprovedMatchSet.v1
→ ValidationModel.v2
→ ApprovedTransferCase.v1
→ TransferPlan.v1
→ TransferPatchAudit.v1
→ PostTransferValidation.v1
```

## Non-negotiable rule

Selection is not approval. Auto-map is not approval. Candidate suggestion is not approval. Validation is not transfer. Transfer must only run from approved match/transfer contracts.

## Implemented shadow contracts

The implementation is in:

```text
xml-compare/contracts/phase2-validation-transfer-orchestrator.js
```

It defines the following contracts:

```text
MatchCandidateSet.v1
MatchDecision.v1
ApprovedMatchSet.v1
TransformPolicy.v1
ValidationModel.v2
ValidationAudit.v2
ApprovedTransferCase.v1
TransferPlan.v1
TransferPatchAudit.v1
PostTransferValidation.v1
```

## Guardrails

The orchestrator enforces these rules in shadow mode:

1. Candidate ambiguity is computed, not hardcoded.
2. Target conflicts are computed before approval.
3. Explicit `MatchDecision.v1` is required before a match enters `ApprovedMatchSet.v1`.
4. Ambiguous/conflicted candidates cannot silently become approved matches.
5. Validator v2 consumes approved matches, transform policy, coordinate-frame comparability, identity confidence, and numeric tolerance policy.
6. Duplicate target claims become blockers.
7. Transfer cases are approved only when their validation row is `OK`.
8. TransferPlan.v1 stores source hash, target hash, approved match set hash, transfer plan hash, and workspace revision.
9. Transfer stage validation blocks stale source, stale target, stale plan, and stale workspace revision.
10. Source XML is treated as read-only; transfer plans target only the Target side.

## Current scope

This PR does not replace the current XML Compare UI/runtime path. It adds an auditable orchestration layer and semantic tests so later PRs can route the Auto Map Review and Transfer Apply UI through contracts instead of DOM-rendered JSON and global caches.

## Next integration steps

1. Wire existing auto-map output into `MatchCandidateSet.v1`.
2. Replace selection-created manual connectors with explicit `MatchDecision.v1` approval actions.
3. Make validator consume `ApprovedMatchSet.v1` and `TransformPolicy.v1`.
4. Replace DOM `<pre>` transfer plan parsing with state-backed `TransferPlan.v1`.
5. Replace regex XML patching with DOM/graph-level transfer mutation.
