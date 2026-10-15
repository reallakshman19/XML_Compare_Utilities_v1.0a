# WP-008 — UI / export-state qualification

CHAIN_ID: SUPPORT-REPORT-1154
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1154
MAIN_BASIS_BEFORE: fd25a7eeb3512a13fda73d4e9d7c67ac6e333fd5
MATERIAL_BRANCH: agent/support-report-1154-wp008
MATERIAL_HEAD: 3c9ab1f7fa80e5e2b98639bdf7755684c21dab23
PR: #1177
MERGE_COMMIT: eaa322cbaf4c0aa0ff4e813a21e6812cdc05cf4d
DISPOSITION: MERGED_BY_EXPLICIT_OWNER_AUTHORITY

## Problem qualified

Before WP-008, XML-only or partially enriched Support Report bundles were displayed as simply `Support Report ready` and downloaded using the same neutral filenames as bundles with no XML-only rows. XML-only export was intentionally allowed, but the presentation could imply completeness after the artifact left the UI.

## Result

A single pure completeness owner now derives presentation state from `summary.xmlOnlyRowCount`.

- `xmlOnlyRowCount > 0` -> PARTIAL presentation state;
- partial run state explicitly says `Support Report ready — partial enrichment`;
- partial view includes `data-ssr-completeness="partial"` and explains that unresolved native members/attributes are not complete engineering output;
- partial downloads use `support-report-partial.xlsx` and `support-report-partial.csv`;
- reports with no XML-only rows retain `support-report.xlsx` and `support-report.csv`;
- XML-only/partial export remains allowed for evidence review;
- input invalidation still clears cached report state and disables all exports;
- parser/build blocking behavior is unchanged;
- no row values, grouping, member selection, carrier resolution, field provenance, Owner oracle, CSV/XLSX field contract, or staged-model authority changed.

Cache routing keeps the governed Owner-contract token prefix and adds a fresh WP-008 UI dimension, so deployed browsers receive the changed addon/view without rewriting the existing cache-authority checks.

The active Support Report regression graph now imports the WP-006 parity ledger, WP-007 XLSX round-trip, and WP-008 UI/export-state suites.

## Exact branch boundary

Compared with `main@fd25a7eeb3512a13fda73d4e9d7c67ac6e333fd5`, WP-008 changed exactly six files:

1. `tabs/support-steel-relationship-builder/support-report-addon.js`
2. `tabs/support-steel-relationship-builder/support-report-ui-state.js` (new, 31 lines)
3. `tabs/support-steel-relationship-builder/support-report-view.js`
4. `tabs/support-steel-relationship-builder/support-steel-relationship-bootstrap.js`
5. `tests/ps-family-clash-audit-benchmark-readiness.test.js`
6. `tests/support-report-ui-export-state.test.mjs` (new, 56 lines)

No parser, relationship-engine, carrier-resolution, field-projection, XLSX writer, CSV serializer, or oracle file changed.

## Validation actually executed

- exact `support-report-ui-state.js`: `node --check` PASS;
- exact changed `support-report-addon.js`: `node --check` PASS;
- exact changed `support-report-view.js`: `node --check` PASS;
- exact changed `support-steel-relationship-bootstrap.js`: `node --check` PASS;
- exact changed active-test aggregator: `node --check` PASS;
- exact committed `tests/support-report-ui-export-state.test.mjs`: 5/5 PASS;
- focused helper semantics: PASS;
- GitHub compare: exactly six intended paths;
- PR #1177 mergeability before merge: TRUE;
- PR reviews: 0;
- unresolved review threads: 0;
- attached commit status checks: none;
- PR workflow runs: none.

## Not executed / not claimed

- complete repository `npm test`: NOT_RUN;
- full Support/Steel regression run under this leg: NOT_RUN;
- full PS-family regression run under this leg: NOT_RUN;
- browser workflow smoke against deployed WP-008: NOT_RUN;
- default external SheetJS network availability: NOT_RUN;
- BM-004 real 210-cell Owner parity: BLOCKED_INPUT003.

INPUT-003 remains unresolved. Expected workbook values remain expected-output authority only and were not used to synthesize staged-model source data.
