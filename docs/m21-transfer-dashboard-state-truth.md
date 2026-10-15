# M21 — Transfer Dashboard State Truth Alignment

## Scope

Focused only on:

```text
XML Compare → Transfer & Compare Review → Transfer Output Dashboard / export visibility
```

This patch does not change the transfer engine, export generation, Line-wise workflow, Table-to-Categorized runtime, UXC, pivot, or canvas handoff behavior.

## Problem

After M18/M19/M20, the Transfer & Compare Review UI was visually cleaner, but the dashboard state could still disagree with the actual app state:

- Start Transfer could display weak or wrong blocker text because the popup read `nextSafeAction` / `reason`, while the gate exposes `nextAction` / `message`.
- Pending workflow steps could be counted like hard blockers, so a ready-to-stage workflow could still look blocked.
- Staged-only preflight could mark some artifacts ready while export buttons were intentionally hidden until apply/patched evidence existed.
- The dashboard Exports card could tell the user to use export buttons before those buttons were visible.
- No-stage downstream cards were hidden mainly by CSS, not by source-state rendering.
- The visible build stamp still showed the older M18 stamp even after M20 progressive disclosure.

## Changes

- Bumped Transfer modal schema to `xml-compare-transfer-modal-popup/v12-state-truth`.
- Added hard-blocker filtering for pending workflow steps:
  - `TRANSFER_STAGE_REQUIRED`
  - `TRANSFER_APPLY_REQUIRED`
  - `TRANSFER_PROOF_REQUIRED`
- Start panel now uses `gate.nextAction` and blocker `message` fields.
- Start panel shows `Ready to stage` when `okForTransferStage` is true, even if later workflow steps remain pending.
- No-evidence dashboard now renders only the Stage card at the source level; CSS remains a defensive fallback.
- Staged-only view now says export buttons unlock after applying staged transfer instead of implying hidden buttons are usable.
- Dashboard export readiness is based on visible export actions, not raw preflight ready count.
- Applied/patched state still shows export actions and detailed panels.
- Cache-bust chain updated through:
  - `index.html`
  - `main-rhbg-fitguard.js`
  - `core/app.js`
  - `core/app-standalone-runtime.js`
  - XML Compare tab module import
- Visible build stamp updated to `M21 transfer-state-truth · 2026-07-08`.
- Build stamp remains visible at compact widths instead of being hidden.

## Validation target

```bash
npm run test:xml
npm run test:table
npm test
```

## Expected behavior

### No stage

- Transfer Output Dashboard is visible.
- Only Stage dashboard state is rendered.
- Start Transfer panel is visible.
- Advanced readiness evidence is available behind one expander.
- No export/diff/ledger/receipt/history panels are rendered.
- No patched preview placeholder is rendered.

### Ready to stage

- Start panel says `Ready to stage` when the gate allows staging.
- Pending apply/proof steps are treated as workflow next steps, not hard blockers.

### Staged only

- Dashboard says to apply staged transfer before patched XML/export buttons are available.
- Detailed preflight remains visible for evidence.
- Export buttons remain hidden until apply/patched result evidence exists.

### Applied / patched

- Export action buttons are visible.
- Patched Target preview is visible.
- Diff, ledger, receipt, history, and workflow evidence panels remain available.

## Non-goals

- No transfer plan logic change.
- No patch applier change.
- No export payload format change.
- No Line-wise / Table / UXC / pivot / canvas runtime change.
