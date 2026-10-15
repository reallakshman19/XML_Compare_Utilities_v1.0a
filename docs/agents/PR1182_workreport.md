# PR1182 — Support Report location-aware staged JSON trace enrichment

WORK_ITEM: github:reallaksh19/XML_Compare_Utilities#1154
PR: https://github.com/reallaksh19/XML_Compare_Utilities/pull/1182
BRANCH: agent/support-report-1154-jsontrace
BASE_MAIN_AT_PR_OPEN: 6064e6de25cff7d4ad034cbf0d4b90cf73cb1647
MERGE_BASE: b6737f45365dbabaf86e71c070166e3c293afe90
PREWORK_ENDPOINT: EP-SUPPORT-REPORT-1154-0015
OWNER_INSTRUCTION: 2026-09-10T07:54:47Z `ok update PR, push and merge.`
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: TRUE_FOR_PR1182_PACKAGE
RECOVERY_STATE: CONTINUE

## Mission

Deliver the Owner-approved Support Report semantics for real benchmark location splitting, staged JSON trace enrichment, Bore authority, and discipline-neutral Site/Zone without weakening clash/native/workbook evidence boundaries.

## Delivered behavior

- report row grain is secondary family + full pipe + physical clash-location cluster;
- default report-location merge tolerance is 50 mm and is separate from structural/contact tolerances;
- PS-12154 `/PS-12154.2` + `/PS-12154.5` stays one row, both members, no multi-location remark;
- PS-12120 complete benchmark is governed as 19 clash rows -> 14 report rows across 9 pipes;
- PS-12120 `P8810365` produces five location rows and `W8810126` produces two; split rows carry exactly `Pipe supported at multiple locations`;
- staged JSON can be chosen directly in the Support Report panel and is written into the same shared Combined Staged Model source as the Input tab;
- direct current PS/SL member ID is the preferred staged mapping basis; explicit previous-name alias is second; coordinate/base-anchor identity mapping remains inactive/later;
- family mismatch remains visible unless staged JSON explicitly proves a rename;
- JSON trace exposes observed/resolved IDs, match basis, native POS basis, source path, line context and curated attribute evidence;
- `BORE` from authoritative staged carrier/pipe evidence owns report `SIZE`; alternate bore aliases are consulted only when no `BORE` evidence exists; line-name regex is last fallback only when staged bore evidence is absent;
- conflicting authoritative `BORE` stays blank/conflict and never falls through to regex;
- Primary Support Site/Zone is hierarchy-based and discipline-neutral, preferring native staged member `sourcePath` then clash primary path;
- conflicting native Site/Zone stays blank/conflict rather than being overwritten by clash fallback;
- `INSU` is accepted as staged insulation-thickness evidence;
- concept note documents the authority model, benchmark controls and future coordinate/base-anchor placeholder.

## Protected invariants

- expected workbook cells are never engineering source data;
- clash XML remains relationship/location evidence;
- staged JSON remains native identity/attribute/position evidence;
- direct ID with contradictory explicit line context cannot silently enrich a row;
- no hard-coded benchmark answer is present in production;
- no runtime, writer, canvas, workflow or geometry-authority switch;
- merge is only under the explicit Owner authorization above.

## RCA findings incorporated

1. The earlier five-row PS-12120 CSV was a focused sample, not a full report. The real benchmark has 19 clashes -> 14 location-aware rows across 9 pipes.
2. PS-12154 Site/Zone was blank because the prior field projector recognized only CU-PL / CU-PL-S. Real evidence uses CU-PI / CU-PI-D, -P, -W, -A. The fix is hierarchy-based, not PI-specific.
3. Support/Steel source reading already preserves native `sourcePath`; the defect was projection, not source ingestion.
4. When staged JSON has `BORE`, it must outrank ABORE and pipe-name-derived nominal size.

## Validation status

PASS — local syntax check of exact RCA field-projection semantics.
PASS — focused independent field-projection RCA suite 6/6:
- BORE beats ABORE and pipe-name regex;
- regex is fallback only without staged bore evidence;
- CU-PI clash hierarchy populates Site/Zone;
- native staged sourcePath outranks clash path;
- conflicting native Site/Zone is blank/conflict;
- explicit BORE on one authoritative carrier outranks alternate ABORE-only evidence elsewhere.
PASS — independent benchmark reconstruction during RCA: PS-12120 19 clashes -> 14 rows, with 5 + 2 multi-location controls; PS-12154 all six rows recover CU-PI Site/Zone and `.2/.5` has blank remarks.
PASS — branch test graph now imports the RCA projection, location benchmark, JSON trace, and JSON trace UI suites through `test:ps-family` benchmark readiness.
PASS — PR #1182 was mergeable before PR-workreport relay.
PASS — reviews 0; unresolved review threads 0.
NOT_RUN — attached CI/status checks: none exist for the pre-relay PR head.
NOT_RUN — PR workflow runs: none exist for the pre-relay PR head.
NOT_RUN — full repository `npm test` in this connector-only environment.
NOT_RUN — browser end-to-end smoke.
BLOCKED_INPUT003 — exact PS-007/SL-097 210-cell staged-model parity still requires its corresponding authoritative staged-model input.

## Changed-file ledger

Production / UI:
- `tabs/support-steel-relationship-builder/support-report-addon.js`
- `tabs/support-steel-relationship-builder/support-report-clash-safety.js`
- `tabs/support-steel-relationship-builder/support-report-clash-test-context.js`
- `tabs/support-steel-relationship-builder/support-report-engine.js`
- `tabs/support-steel-relationship-builder/support-report-field-projection.js`
- `tabs/support-steel-relationship-builder/support-report-json-trace.js`
- `tabs/support-steel-relationship-builder/support-report-location-grouping.js`
- `tabs/support-steel-relationship-builder/support-report-row-enrichment.js`
- `tabs/support-steel-relationship-builder/support-report-view.js`
- `tabs/support-steel-relationship-builder/support-steel-relationship-bootstrap.js`

Tests / evidence:
- `tests/ps-family-clash-audit-benchmark-readiness.test.js`
- `tests/support-report-field-projection-rca.test.mjs`
- `tests/support-report-json-trace-ui.test.mjs`
- `tests/support-report-json-trace.test.mjs`
- `tests/support-report-location-benchmarks.test.mjs`
- `docs/SupportReportconceptnote.md`
- this PR work report.

## Base drift

Current PR base is `main@6064e6de...`. The branch merge base is `b6737f...`; the one intervening main commit adds only `benchmarks/11168.xml` and `benchmarks/14168.xml`. It has no path overlap with PR #1182.

## Recovery / connector note

This execution uses GitHub connector writes. Repository `.agent-worklogs/` and `.backups/` are local-only recovery facilities and could not be created because no authenticated local repository checkout is available. Durable recovery artifacts are the issue/chain endpoint, PR work report, content-SHA-guarded commits, PR diff and validation records.

HIGHEST_RISK: browser deployment and complete repository regression have not been executed; do not reinterpret absence of CI as PASS.

EXACT_NEXT_ACTION: remove the superseded WIP work report, re-ground PR #1182 at its new head, inspect exact changed-file boundary/reviews/checks/mergeability, and merge only if still mergeable under the explicit Owner authorization.