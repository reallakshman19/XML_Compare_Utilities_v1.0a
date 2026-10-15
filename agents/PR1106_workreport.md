# PR1106 — CII Writer2 compare-action cache refresh

## Mission
Ensure the merged #1104 multi-source next-step UI is actually loaded by GitHub Pages/browser module graphs.

## Live RCA
- #1104 merge: `f336c8677c75cec8255c8ffe0a4b17d9715cd0a2`
- Pages run `33763871452`: SUCCESS
- deployed artifact contains `Anchor authority READY`, `Compare models →`, and `READY FOR COMPARE`
- deployed startup/Utilities graph still advertised `standalone-20260903-ciiw-ms-review-refresh-1`
- therefore an existing browser module graph could continue showing the pre-#1104 ledger despite correct deployed product bytes.

## Correction
Shared build token is bumped coherently to:

`standalone-20260903-ciiw-ms-compare-action-refresh-1`

Affected cache/deployment graph:
- `index.html`
- `main-rhbg-fitguard.js`
- `core/app.js`
- `core/app-standalone-runtime.js`
- `tabs/psnm-utility-pages-entry.js`
- `tabs/psnm-utility-tab.js`
- `.github/workflows/deploy.yml`
- `tests/deploy-workflow-pages-artifact.test.js`

Visible build marker becomes:

`CII Writer2 compare-action refresh · 2026-09-03`

## Workflow boundary
The workflow delta is one build-token value only. Triggers, permissions, action versions, steps, staging behavior and deployment semantics are unchanged.

## Protected invariants
No CII correspondence, Method A/B, manual-anchor authority, Writer2 mutation, NODENAME relocation, V11/V14 converter, target shadow, projector or BM-001 logic changes.

## Validation
- exact #1104 Pages artifact inspection: PASS; new UI present, old token present
- local Pages graph contract after token replacement: PASS
- JavaScript syntax checks for guarded startup/app/runtime/Utilities entry/orchestrator: PASS
- exact runtime blob pinned: `cae56b638b313a0d53ceceecc7f2463e37d743ac`
- branch relation at PR creation: 0 behind current main
- changed paths at PR creation: eight cache/deployment graph paths + this handover path

Not run / not claimed:
- post-merge Pages deployment for PR1106
- browser end-to-end product acceptance
- full repository suite

## Expected product verification after merge/deploy
1. Reload the whole application page.
2. Confirm build stamp: `CII Writer2 compare-action refresh · 2026-09-03`.
3. Re-enter exact S1/S2/S3 + T flow.
4. With 3/3 anchors covered, master ledger must show `Anchor authority READY` and an enabled `Compare models →` action.
5. Pre-compare Transfer must show `READY FOR COMPARE` and must not show `BLOCKED_WRITER_1A`.

## Merge authority
Owner-only. PR remains open until an explicit Owner merge instruction.
