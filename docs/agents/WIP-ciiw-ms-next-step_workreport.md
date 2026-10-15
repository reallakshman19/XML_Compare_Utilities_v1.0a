# WIP — CII Writer2 multi-source next-step / stage-chrome correction

## Mission
Correct the live post-anchor workflow confusion after all S1/S2/S3 manual anchors are USER LOCKED:
- make the actual `Compare models →` execution action visible beside the master anchor ledger;
- distinguish the navigation tab from the compare execution action;
- suppress the unrelated legacy Writer1A Stage 06 chrome in multi-source Writer2 mode;
- show a Writer2-specific waiting/next-step placeholder in Transfer before a preview exists.

## Live basis
- main at branch creation: `c44a564d5f487c4f7ed2664196c267e3a0996b9a`
- branch: `fix/cii-writer2-multisource-next-step-stage-chrome`
- Owner observation: master ledger reports `3 / 3 SOURCE members covered · 3 manual locked · 0 method-qualified`; Compare tab appears inert; Transfer shows `BLOCKED_WRITER_1A` / `Build an approved WRITER 1A transfer plan...`.

## RCA
1. `2 Compare Review` is a navigation tab only. The operation that builds correspondence is the separate `[data-ciiw-analyze]` button labeled `Compare models →`, still located at the bottom of the long Inputs panel.
2. `authorityReady()` is already true when all 3 members have manual anchors; therefore the compare execution button is eligible.
3. The Transfer panel also contains legacy `[data-ciiw-stages]` produced by the single-source shell. Before the multi-source preview is built, its null/default readiness is rendered as `BLOCKED_WRITER_1A`, which is unrelated to the S1/S2/S3 Writer2 route.
4. Multi-source Writer2 has its own `transferMarkup()` and writer readiness; the legacy stage chrome is not authority for this route.

## Implemented patch
- `tabs/cii-workspace/cii-workspace-multisource-anchor-ledger-ui.js`
  - adds a master-ledger next-step block;
  - when all SOURCE members are covered it shows `Anchor authority READY` and an enabled `Compare models →` CTA;
  - explicitly says the Compare Review tab is navigation only;
  - incomplete coverage shows a disabled CTA.
- `tabs/cii-workspace/cii-workspace-multisource-writer2-ui.js`
  - binds the master-ledger CTA to the existing `[data-ciiw-analyze]` compare path;
  - hides legacy `[data-ciiw-stages]` only while multi-source mode is active and restores it in single-source mode;
  - renders a Writer2-specific pre-preview Transfer placeholder (`READY FOR COMPARE` / `WAITING FOR ANCHORS`);
  - gives the Transfer placeholder the same existing compare action when authority is ready;
  - explicitly states Writer1A is not used by the S1/S2/S3 Writer2 route;
  - keeps the actual Compare Review tab as navigation only.
- `tabs/cii-workspace/cii-workspace-transfer-scope-ui.css`
  - hides legacy stage chrome when its `hidden` attribute is set;
  - styles the next-step row and Writer2 waiting placeholder.
- `tests/cii-workspace-multisource-next-step-ui.test.js`
  - covers ready/incomplete master-ledger CTA state;
  - covers pre-Compare Transfer Writer2 state and absence of `BLOCKED_WRITER_1A`;
  - asserts stage hide/restore wiring.

## Protected invariants
- Manual anchors remain reviewed USER LOCKED base authority only.
- One-axis propagated rows remain REVIEW unless independently reviewed/qualified.
- Method B >=2-axis automatic gate unchanged.
- No Writer2 mutation, NODENAME relocation, V11/V14 converter, target shadow, projector, BM-001 binding, or workflow change.
- Navigation tabs remain navigation; no tab click silently executes engineering computation.

## Validation executed
Against the exact Pages artifact produced from `main@c44a564d5f487c4f7ed2664196c267e3a0996b9a`:
- `node --check tabs/cii-workspace/cii-workspace-multisource-writer2-ui.js` — PASS
- `node --check tabs/cii-workspace/cii-workspace-multisource-anchor-ledger-ui.js` — PASS
- `node tests/cii-workspace-multisource-next-step-ui.test.js` — PASS
- exact retained example in test: S1 `3870→870`, S2 `120→40070`, S3 `1890→21890` gives 3/3 coverage and enabled Compare CTA.

Not run / not claimed:
- browser/Worker end-to-end product flow;
- full repository test suite;
- GitHub CI/workflow for this branch.

## Coordination
Open Writer2 PR #1064 is runtime/oracle qualification and is read-only for this task. No planned exact-file overlap.

## Current branch head before PR
- product commit: `605744730f22ffce16bea7aa46832fe78a75881f`
- production files changed: 3
- focused test added: 1
- WIP report: 1

## EXACT_NEXT_ACTION
Compare branch to current `main`. If clean, open a PR with this exact UI-routing correction. Browser acceptance remains the next product check. Merge remains Owner-only and requires a fresh explicit Owner merge command.