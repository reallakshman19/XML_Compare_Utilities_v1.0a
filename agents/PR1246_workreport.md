# PR1246 work report — anchor proposal Approve / Inspect / Reject

## Mission

Implement Slice 4 for #1239 after audit: make the proposal rationale surface actionable while preserving the existing Writer2 manual-anchor authority path as the single USER LOCKED mechanism.

## Stack / live basis

- Issue: `reallaksh19/XML_Compare_Utilities#1239`
- PR: `reallaksh19/XML_Compare_Utilities#1246`
- Base dependency: PR #1245 / branch `fix/cii-writer2-benchmark-overlay-1239`
- Stack base SHA: `876ce9e85e58947f69de1108818bdd78493a1331`
- Branch: `fix/cii-writer2-anchor-proposal-actions-1239`
- Merge authority: OWNER_ONLY / NOT_GRANTED

## Audit-first result

The proposal rationale table was display-only. The existing review-only evidence-card path could prefill the manual editor, and the authoritative manual path already flowed through `manualBySource` to `USER LOCKED` rows. Therefore this slice reuses that exact path instead of introducing parallel authority state.

## Implemented semantics

- `Inspect`: prefill/focus the existing manual editor only; no authority mutation.
- `Approve anchor`: prefill and invoke the existing `Add reviewed anchor` control; exact pair becomes `USER LOCKED` through existing Writer2 logic.
- `Reject`: session review disposition only; no authority/correspondence mutation.
- approval clears prior rejection for the same proposal.
- rejection cannot silently remove an already USER LOCKED row; removal remains explicit in the master ledger.
- one-axis Method-B evidence remains REVIEW; automatic Method-B still requires the existing ≥2/2 gate.

## Additional presentation correction

The master-ledger headline now separates:

- manual locked pair count;
- selected automatic base count;
- expanded automatic anchor-pair count.

The prior “method-qualified” number counted expanded automatic pair rows and could be mistaken for selected bases.

## Files

- `tabs/cii-workspace/cii-workspace-anchor-proposal-actions.js`
- `tabs/cii-workspace/cii-workspace-multisource-anchor-ledger-ui.js`
- `tests/cii-workspace-anchor-proposal-actions.test.js`

## Falsifiers / tests authored

- Inspect command is prefill-only.
- Approve is duplicate-safe and requests the existing manual-add path.
- Reject creates no authority and cannot silently remove approved authority.
- one-axis Method-B proposal continues to state automatic ≥2/2 requirement.
- approved proposal projects `APPROVED · USER LOCKED`.
- automatic base count is not expanded pair count.
- static integration check proves runtime invokes `[data-ciiw-ms-manual-add]`, whose existing Writer2 handler writes `manualBySource` and clears `selectedBySource` for that SOURCE.

## Validation truth

- architecture/source audit: PASS;
- stacked diff scope: PASS — three files only;
- focused test: AUTHORED / NOT_RUN in connector-only execution context;
- browser interaction: NOT_RUN;
- retained S1/S2/S3→T Chromium benchmark: NOT_RUN;
- exact-head GitHub status/workflow evidence: pending final-head query;
- merge: NOT AUTHORIZED.

## MATERIAL_FRONTIER

Proposal-review UX -> existing manual anchor authority path only.

## SEMANTIC_EVIDENCE_FRONTIER

Explicit user approval can create one exact USER LOCKED pair. Automatic Method-A/B evidence qualification is unchanged.

## EXACT_NEXT_ACTION

Check exact-head provider state, publish TASK_EVIDENCE on #1239, then begin the empirical anchor-cardinality/propagation slice using census + benchmark instrumentation. No merge.