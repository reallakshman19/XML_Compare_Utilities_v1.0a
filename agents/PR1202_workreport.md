# PR1202 — Support Report deterministic trace/debug sidecars

PARENT_ISSUE: #1154
CHILD_ISSUE: #1201
PR: #1202
BASE_MAIN_AT_START: 0391a88a3df9e480958d663681ac2773374e3bcb
BRANCH: agent/support-report-1201-trace-export
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
PR_STATE: OPEN_DRAFT
RECOVERY_STATE: CONTINUE

## Owner finding / RCA
Owner rebuilt after #1198 and reported no visible output change. The uploaded `support-report-partial (2).csv` contained 1,321 report rows and exactly the Owner 21-column report contract. It contained no POS cluster ID, native POS, observed/resolved member mapping, match basis, source path, field provenance, diagnostics, or unresolved reason.

#1198 had correctly added POS-cluster evidence to the canonical SupportReportBundle/UI, but standard CSV export still serialized only the Owner report contract. Therefore downloaded report CSV review could not prove why rows were grouped/split/enriched/unresolved.

## Implementation
- Added `support-report-trace-export.js`.
- Added deterministic `SupportReportTraceCsv.v1` sidecar with one trace row per report row × POS cluster.
- Emits an explicit `UNRESOLVED_POS` / `NO_JSON_TRACE` trace row when staged trace is absent instead of silently dropping the report row from trace output.
- Trace columns include row/location identity, location clustering metadata, report coordinates and coordinate basis, native POS, observed/resolved IDs, match basis, selected/native-only/missing IDs, curated staged attributes, source paths, line contexts, field provenance, carrier evidence/conflicts, row diagnostics and a resolution-state classification.
- Added `SupportReportDebugExport.v1` JSON containing the canonical report bundle losslessly plus deterministic trace summary.
- Added UI controls: `Download Trace CSV` and `Download Debug JSON`.
- Standard button is explicitly labelled `Download Report CSV`; report CSV serialization is unchanged.
- Run-state exposes POS cluster count, unresolved POS count and unresolved member-match count.
- New exports participate in input invalidation/disabled state.
- Cache-routing advanced through Support/Steel bootstrap.

## Protected invariants
- Owner 21-column report CSV/XLSX remains unchanged.
- No engineering-field authority changed.
- No support-location grouping/tolerance changed.
- No coordinate/base-anchor matching was activated.
- Navisworks report coordinates remain report authority; staged native POS remains trace evidence.

## Validation
Exact implementation head before this handover commit: `6b191d2c49742fa4977340f79a8474e6c0f690f8`.

GitHub Actions:
- Support Report focused qualification: **71/71 PASS**, including all 4 new trace-export tests.
- New trace-export tests prove row-location/native-POS separation, deterministic columns and spreadsheet-safe quoting, unresolved trace summary, and lossless Debug JSON.
- Support/Steel Playwright browser qualification: **PASS**. It verifies new trace/debug controls are enabled after build, disabled on input mutation, and produce the expected partial filenames.
- 1884/1885 ZIP benchmark and diagnostics: **PASS**.

The unrelated known #1192 remark-calibration qualification state on current main is not modified or reclassified by this PR.

## Changed-file ledger
- `.github/workflows/support-report-typicality-qualification.yml`
- `tabs/support-steel-relationship-builder/support-report-addon.js`
- `tabs/support-steel-relationship-builder/support-report-trace-export.js` (new)
- `tabs/support-steel-relationship-builder/support-steel-relationship-bootstrap.js`
- `tests/support-report-trace-export.test.mjs` (new)
- `tests/browser/support-report-typicality.spec.mjs`
- `agents/PR1202_workreport.md`

## Exact next action
Reconcile CI on this documentation head, update #1201/#1202 validation status, and leave the PR ready for Owner review. Do not merge without a fresh explicit Owner merge authorization for PR #1202.
