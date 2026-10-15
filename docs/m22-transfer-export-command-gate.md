# M22 — Transfer Export Command Gate

## Focus

Only:

```text
XML Compare → Transfer & Compare Review → Transfer Output Dashboard / export visibility → runtime export/copy command gate
```

## Problem

M21 aligned dashboard/export visibility. M23 stabilized the Tab 2 tile layout. The remaining runtime risk is that a stale DOM node or programmatic click event could still reach generic export/copy action dispatch even when the visible dashboard/preflight model would not show or enable that command.

Button visibility must not be the only safety mechanism.

## Fix strategy

Add a small Transfer-only runtime gate module:

```text
tabs/xml-compare-transfer-export-command-gate.js
```

It installs a capture-phase click guard before the main app runtime handles actions.

The gate blocks Transfer export/copy commands when:

- the command is outside Tab 2 Transfer & Compare;
- transfer evidence is `none`;
- the command is not visible in the current Transfer review DOM;
- the command is disabled;
- the command has a non-ready export preflight status.

Blocked commands call `preventDefault`, `stopPropagation`, and `stopImmediatePropagation`, then show a warning message inside the Transfer modal. This prevents receipt/history/export side effects from running.

## Gated commands

```text
export-patched-target-xml
export-transfer-audit-json
download-transfer-proof-json
copy-patched-target-preview
export-transfer-artifact-bundle
export-transfer-diff-summary-json
export-transfer-change-ledger-json
export-transfer-change-ledger-csv
export-transfer-history-json
```

## Files changed

```text
core/app.js
tabs/xml-compare-transfer-export-command-gate.js
tests/xml-compare-transfer-export-command-gate.test.js
package.json
```

## Non-goals

No changes to:

```text
Transfer engine
Transfer applier
Export payload formats
Line-wise workflow
Table-to-Categorized runtime
Universal XML Categorizer runtime
Pivot runtime
Canvas handoff
```

## Acceptance

- No-stage export/copy commands are blocked before generic action dispatch.
- Stale/programmatic hidden commands are blocked.
- Disabled export-history command is blocked when no history rows exist.
- Blocked preflight commands are blocked.
- Visible enabled ready commands are allowed.
- Non-transfer commands pass through.

## Validation target

```bash
npm run test:xml
npm run test:table
npm test
```
