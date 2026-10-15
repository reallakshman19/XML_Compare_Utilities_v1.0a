# PR1184 Work Report

## Mission
Implement issue #1181 `CSV Rev Compare (XML Based)` so flat CSV/table revisions are converted through the governed Table-to-Categorized-XML authority, compared in categorized XML/graph form, projected into typed revision events, and exported back to Support Report CSV/XLSX with machine-auditable provenance.

## Current delivery state
- PR: #1184 (ready for review)
- Branch: `issue-1181-csv-rev-compare-xml-v2`
- Chain: `CSV-REV-COMPARE-1181`
- Active endpoint: `EP-CSVRC-0007`
- Main last reconciled: `906df68d73fd5106b259a2d4a807ec3cb34af9ab`
- Merge authority: OWNER_ONLY; merge authorized TRUE by owner at 2026-09-10T14:44+04:00, conditioned on mergeability
- Completed material legs: LEG-001 conversion; LEG-002 lineage/topology; LEG-003 events/remarks; LEG-004 operational output; LEG-005 Utilities UI; LEG-006 qualification hardening

## Architecture / authority
`CSV/table -> existing Table-to-Categorized-XML parser/profile/graph/export -> support revision semantic XML graph -> candidate/lineage topology -> typed event ledger -> SUPPORT_REV_REMARKS_V1 -> REV2-style CSV/XLSX + audit artifacts`

CSV is ingress/egress only. Persistent primary-support reference is strongest component identity where available. Member suffix and row ordinal are not physical identity. Common-support semantics require graph evidence. Raw coordinate formatting cannot prove relocation. Target remarks are never evidence. Hold automation is excluded.

## Implemented capability
- governed `support-revision-csv-xml/v1` profile;
- duplicate headings preserved by stable parser `columnIds` and ordinals;
- non-truncating aligned parallel-list conversion with diagnostics;
- independent REV1/REV2 graph/XML conversion and fail-closed schema validation;
- graph-derived same-area/scope compatibility gate and explicit/inferred revision ordering;
- semantic pipe parsing and coordinate-frame normalization;
- XML Compare candidate primitive reuse with DETERMINISTIC / LIKELY / AMBIGUOUS / NO_MATCH outcomes;
- persistent-reference-first 1->1 plus explicit 1->N / N->1 / N->M lineage and common-support clusters;
- explicit candidate and structural ambiguity review; no highest-score auto-selection;
- versioned component/load event ledger and deterministic remark renderer;
- REV2 output, source tombstone/replacement rows, CSV/XLSX and JSON/XML/graph/profile audit artifacts;
- XLSX sheets `Rev Compare`, `Rev Compare Audit`, `Lineage`, `Remark Trace`;
- final remark trace links token -> event -> lineage/candidate evidence -> XML nodes -> original CSV row/cells, including candidate-exhaustion evidence for no-successor cases;
- separate Utilities tile `CSV Rev Compare (XML Based)` beside generic Revision Compare, exposing the full 17-stage workflow and fail-closed export gate.

## Validation truth
- LEG-001..LEG-006 executable validation: NOT_RUN
- Focused conversion/lineage/event/operational/pair-validation/UI tests: committed and source-inspected, not executed
- Owner raw REV1/REV2 benchmark: UNRESOLVED / NOT_RUN
- Current PR head status checks: none present at owner merge gate
- Current PR-triggered workflow runs: none present at owner merge gate
- Review threads: none present at owner merge gate

The execution container cannot obtain a local checkout over raw GitHub networking, so Node/browser execution plus repository-local `utils/backup.cjs` and `.agent-worklogs` evidence remain unavailable. No PASS claim is made.

## Base drift / mergeability
The branch point is 38 commits behind current main `906df68d73fd5106b259a2d4a807ec3cb34af9ab`. Main-only changed paths are Support Report typicality/configuration/tests and benchmark ZIPs and do not overlap #1181 production/test paths. PR #1184 appeared non-mergeable while still draft; after the owner requested merge if mergeable and the PR was marked ready for review, GitHub immediately reported `mergeable: true`. Therefore no history rewrite/rebase was required to satisfy the live merge gate.

## Material receipts
- `agents/chains/CSV-REV-COMPARE-1181/material-legs/LEG-001.md`
- `agents/chains/CSV-REV-COMPARE-1181/material-legs/LEG-002.md`
- `agents/chains/CSV-REV-COMPARE-1181/material-legs/LEG-003.md`
- `agents/chains/CSV-REV-COMPARE-1181/material-legs/LEG-004.md`
- `agents/chains/CSV-REV-COMPARE-1181/material-legs/LEG-005.md`
- `agents/chains/CSV-REV-COMPARE-1181/material-legs/LEG-006.md`

## Highest remaining risk
Runtime qualification has not executed and the owner raw benchmark is unavailable. This is disclosed rather than converted to PASS. The owner nevertheless explicitly authorized merge conditioned on GitHub mergeability.

## EXACT_NEXT_ACTION
Publish EP-CSVRC-0007 and synchronize the mutable Issue Active Handover; refresh PR #1184 description; re-read live PR head, main, checks, workflow runs and review threads. If GitHub still reports mergeable TRUE and the expected head SHA is unchanged, merge PR #1184 using owner authorization. Then record the merge SHA and synchronize final issue/chain state.
