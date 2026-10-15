# M20 Transfer Tab 2 progressive disclosure

Purpose: fix the poor Tab 2 empty-state layout where all downstream panels were visible before a transfer stage existed.

## Problem

Before this change, opening Transfer and Compare Tab 2 with no staged transfer displayed output actions, patched preview placeholders, diff summary, change ledger, receipt/history, workflow evidence, and many repeated `not available` rows. This made the UI look like a long wall of boxes and stripes.

## Delivered

- Added a `data-transfer-evidence` mode to Tab 2.
- When no transfer evidence exists, Tab 2 now shows only:
  - Transfer Output Dashboard
  - Start transfer panel
  - Advanced readiness evidence expander
- Output/export/diff/ledger/receipt/history panels now appear only after transfer evidence exists.
- Export buttons are not shown before stage/apply evidence exists.
- Patched Target preview placeholder is not shown before patched output exists.
- Downstream dashboard status pills are hidden in the no-evidence state.
- Existing detailed evidence remains available through an advanced expander.

## User check

Open:

```text
XML Compare → Transfer & Compare Review → Tab 2
```

Before staging, the visible page should be short and should not show export, patched preview, diff, ledger, receipt, or history blocks.
