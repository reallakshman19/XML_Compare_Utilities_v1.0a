# M24 — Transfer Receipt and History Evidence Truth

## Focus

Only:

```text
XML Compare → Transfer & Compare Review → Transfer Output Dashboard → receipt/history evidence
```

## Dependency

This work follows:

- M21 / PR #146 — dashboard state truth
- M23 / PR #155 — Tab 2 tile layout foundation
- M22 / PR #159 — runtime export command gate

## Problem

Receipt/history evidence must remain truthful after a command is blocked, fails, or exports history itself.

The expected evidence chain is:

```text
visible + allowed command
→ command executes successfully
→ one receipt is created
→ one history row is appended
→ dashboard/history panels reflect the same state
```

A blocked, failed, or empty receipt append must not erase or rewrite prior history.

## Root bug fixed

`appendTransferExportHistory(history, receipt)` returned a brand-new empty history when the receipt was empty or invalid. That meant a future blocked/failed command path that accidentally called append with an empty receipt could wipe existing history rows.

M24 changes this behavior:

```text
invalid/empty receipt append
→ preserve existing history rows
→ append nothing
```

## Behavior clarified by tests

- each successful export/copy action appends exactly one history row;
- artifact bundle appends one bundle-level history row;
- empty/null receipt append preserves existing history;
- failed history export with empty history does not mutate receipt/history;
- successful history JSON export does not create a recursive receipt/history row;
- clear history clears only history and leaves last receipt/patched output evidence untouched;
- history cap remains 20 rows;
- Candidate Review and workspace shell markup remain unaffected.

## Files changed

```text
xml-compare/XmlCompareTransferExportHistory.js
tests/xml-compare-transfer-export-history.test.js
docs/m24-transfer-receipt-history-evidence-truth.md
```

## Non-goals

No changes to:

```text
Transfer matching engine
Transfer applier
Export payload schemas
Line-wise workflow
Table-to-Categorized runtime
Universal XML Categorizer runtime
Pivot runtime
Canvas handoff
```

## Validation target

```bash
npm run test:xml
npm run test:table
npm test
```
