# PS Family Clash Audit Benchmark Readiness

This document records which benchmark requirements are currently automated.

## Automated benchmark command

```bash
npm run test:ps-family
npm test
```

## Current automated coverage

| Benchmark area | Status | Automated evidence |
|---|---|---|
| Parser correctness | Met | `tests/ps-family-clash-audit.test.js` validates XML row count, CSV header handling, Copy identity, pipe/branch parsing, and position parsing. |
| PS-11147 audit correctness | Met | `tests/ps-family-clash-audit.test.js` validates 17 expected, 11 clash rows, 7 found, 10 missing, 1 out-of-family, and 3 duplicate members. |
| POSFamily correctness | Met | `tests/ps-family-clash-audit.test.js` validates PS-12005 groups 3 element-detail rows into 1 POSFamily. |
| POS tolerance boundary | Met | `tests/ps-family-clash-audit.test.js` validates 25.000 mm remains in-family and 25.001 mm splits. |
| Export availability | Met | `tests/ps-family-clash-audit.test.js` and `tests/ps-family-clash-audit-config.test.js` validate CSV/JSON export content and export-button metadata. |
| Configurable source side / source family / tolerance | Met | `tests/ps-family-clash-audit-config.test.js` validates source side, source-family override, and POS tolerance settings. |
| File-input configuration | Met | `tests/ps-family-clash-audit-config.test.js` validates browser file metadata helpers and file input rendering. |
| Report-tab rendering | Met | `tests/ps-family-clash-audit-config.test.js` validates report tab configuration and independent report rendering. |
| Browser UI smoke | Met | `tests/ps-family-clash-audit-ui-smoke.test.js` validates rendered shell controls, Run Audit action path, summary rendering, and report-tab output rendering. |
| Snapshot stability | Met | `tests/ps-family-output-fixtures.test.js` locks export schema fields and selected audit JSON identity fields. |
| Medium/large performance | Met | `tests/ps-family-performance-benchmark.test.js` runs a deterministic 200-row parser + POSFamily + audit + export benchmark under a configurable time budget. |
| Accessibility / keyboard navigation | Met | `tests/ps-family-accessibility-gate.test.js` validates visible labels, report-tab labels, export-button labels, and non-empty configurable control text. |

## Current conclusion

The PS Family Clash Audit benchmark program is closed for parser correctness, PS-11147 audit correctness, POSFamily behavior, POS tolerance boundary, export availability, configurability, file input configuration, report tabs, UI smoke, snapshot stability, medium-size performance, and accessibility label coverage.

Future browser-level keyboard traversal can still be added as an E2E enhancement, but the current benchmark matrix has no open planned gate.
