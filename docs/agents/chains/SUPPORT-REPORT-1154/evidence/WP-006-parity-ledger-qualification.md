# WP-006 parity-ledger qualification

Material branch: `agent/support-report-1154-wp006`
Base: `agent/support-report-1154-wp005@21344457ce6a2372e6dc110b3097e66eff1fc61f`
Material head: `af776a5e1b636070b034e506018c06882a9becf8`

## Scope

Pure validation-side Support Report parity ledger. No parser, grouping, enrichment, projection, spreadsheet contract, UI, or export-value mutation.

## Result

The helper emits one record per expected-row / Owner-column cell with:

`rowKey, column, columnLabel, expected, actual, provenance, status`

Statuses are exactly `PASS`, `FAIL`, `UNRESOLVED_INPUT`.

Row identity is canonical secondary family + pipe full-line tag. Duplicate expected or actual row keys fail visible. Missing expected-row actuals produce unresolved cells; extra actual rows are diagnostics and cannot replace an expected row.

A blank expected/actual cell is not counted PASS when actual provenance is explicitly `UNRESOLVED` or `CONFLICT`.

## Validation actually executed

- `node --check tests/helpers/support-report-parity-ledger.mjs` — PASS
- `node --check tests/support-report-parity-ledger.test.mjs` — PASS
- `node --test tests/support-report-parity-ledger.test.mjs` — PASS, 7/7
- synthetic complete domain: 10 rows × 21 columns = 210 cells; PASS+FAIL+UNRESOLVED_INPUT reconciles exactly to 210
- helper physical lines: 158
- test physical lines: 129
- compare against WP-005 head: exactly 2 added test/qualification-side files; no production path modified

## Qualification boundary

This is not BM-004 target parity. INPUT-003 remains unresolved, so no authoritative actual PS-007/SL-097 staged-model rows were available. The synthetic 210-cell PASS case proves comparator mechanics only.

Expected workbook values remain oracle-only. No target member/value is hard-coded into the comparator.
