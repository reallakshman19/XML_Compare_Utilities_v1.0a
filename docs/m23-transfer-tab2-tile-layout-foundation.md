# M23 — Transfer Tab 2 Tile Layout Foundation

## Focus

Only:

```text
XML Compare → Transfer & Compare Review → Tab 2: Transfer & Compare → tile layout / export visibility surface
```

## Problem

The Tab 2 tile interface could visually block or overlap itself because the earlier visual-noise reduction layer compressed dashboard cards and action buttons into inline flex/pill layouts. That made long labels, long file names, long block names, and many action buttons compete in the same row.

This was not a transfer-engine problem. It was a layout-contract problem.

## Root cause

The base dashboard stylesheet defined a grid, but the later noise-reduction stylesheet overrode it with:

- inline flex dashboard cards
- nowrap action pills
- hidden card details as a spacing workaround
- narrow output body columns that could squeeze action controls

Those are fragile behaviors for a variable-width modal with long engineering labels.

## Fix strategy

Replace the fragile compression layer with a real layout foundation:

- Tab 2 gets a bounded root grid.
- Dashboard cards use CSS Grid tiles with internal named areas.
- Export/action controls use bounded auto-fit CSS Grid columns.
- Text wraps with `overflow-wrap: anywhere` instead of blocking neighboring tiles.
- Action buttons use `white-space: normal`, not nowrap.
- The output band stays non-sticky to avoid overlaying downstream panels.
- Detail groups/tables/previews are width-contained.
- Medium and narrow breakpoints collapse to one-column layout before collision can occur.

## Files changed

```text
tabs/xml-compare-transfer-noise-reduction.css
tests/xml-compare-transfer-dashboard-css-build-stamp.test.js
tests/xml-compare-transfer-tab2-layout-foundation.test.js
package.json
index.html
main-rhbg-fitguard.js
core/app.js
core/app-standalone-runtime.js
```

## Non-goals

No changes to:

```text
Transfer engine
Transfer applier
Export payload formats
Line-wise workflow
Table-to-Categorized runtime
Universal XML Categorizer
Pivot runtime
Canvas handoff
```

## Acceptance

- No dashboard flex row compression.
- No export-action flex row compression.
- No nowrap action pills.
- Long export labels wrap inside their own tile.
- Long file names/block names do not force horizontal collision.
- M23 build stamp and cache bust confirm the deployed layout version.

## Validation target

```bash
npm run test:xml
npm run test:table
npm test
```
