# PR #1211 work report — Support Report PREV NAME semantic boundary

## Chain
- Parent roadmap: #1154
- Child issue: #1210
- Dependency: #1208 / `agent/support-report-1206-location-attribution`
- PR: #1211
- Branch: `agent/support-report-1210-prevname-semantic`
- Owner merge policy: merge only on fresh explicit Owner authorization.

## Owner-output evidence
The Owner-uploaded `support-report-partial (2).csv` contains 1,321 data rows under the standard 21-column report contract.

PREV NAME evidence in that export:
- 459 rows have a nonblank PREV NAME;
- 301 rows contain at least one DBREF-form `=...` token;
- 545 DBREF-form tokens are emitted in total.

The Owner-linked staged JSON (`3D_Converters_v1.78`, commit `c76b4673087647493f3305a3d6492ad76e65a60d`, `Benchmarks/1885_NC/1885_NC.json`) confirms that source `PREV-NAME` is overloaded. It contains both reportable prior support names and internal DBREF identities such as `=1006649732/...`.

The Owner golden PS-007 / SL-097 workbook also proves that reportable previous names are broader than only slash-form PS/SL IDs: legacy values such as `PS02689.1` are legitimate. Therefore the remediation rejects only the typed DBREF form instead of imposing a narrow PS/SL regex.

## Root cause
Two paths trusted any nonblank staged PREV-NAME token:
1. canonical report projection displayed it unless it was an exact no-op alias;
2. JSON-trace rename indexing admitted it as a potential PREVIOUS_NAME_ALIAS.

Internal DBREF values could therefore appear in PREV NAME and participate in rename matching even though they are not support names.

## Remediation
### Shared previous-name semantics
`support-report-field-normalization.js` now exposes one semantic boundary:
- reportable tokens;
- rejected DBREF tokens;
- suppressed current-member/no-op tokens;
- original raw staged value.

DBREF-form values beginning `=` are rejected from report semantics. Legitimate slash PS/SL aliases, legacy names such as `PS02689.1`, and `Copy-of-*` names remain reportable.

### Canonical report
`support-report-row-enrichment.js` applies the shared semantic normalizer to canonical PREV NAME and provenance:
- reportable staged alias -> `AUTHORITATIVE_NATIVE_MEMBER_ATTRIBUTE`;
- DBREF-only/no-op/missing value -> `UNRESOLVED`;
- standard 21-column report layout is unchanged.

### Rename resolution
`support-report-json-trace.js` uses only reportable previous-name aliases for `PREVIOUS_NAME_ALIAS` lookup. DBREF values cannot resolve an observed member. Explicit `/SL-147.1` -> current PS member rename behavior remains supported.

### Audit evidence
JSON Trace advances to `SupportReportJsonTrace.v3` and records:
- `previousName`;
- `previousNameRaw`;
- `previousNameRejectedDbref`;
- `previousNameSuppressedNoOp`.

Trace CSV advances to `SupportReportTraceCsv.v2` with:
- `PREV NAME`;
- `REJECTED PREV NAME DBREF`;
- summary counter `rejectedPreviousNameDbrefCount`.

Debug JSON advances to `SupportReportDebugExport.v2` and remains lossless around the canonical report bundle.

### Browser delivery
Cache routing advances through:
`support-steel-relationship-bootstrap.js` -> `support-report-addon.js` -> `support-report-engine.js` -> `support-report-row-enrichment.js` -> new previous-name/json-trace modules.

## Regression controls
New `tests/support-report-prev-name-semantics.test.mjs` covers:
1. DBREF-only PREV-NAME rejection;
2. mixed DBREF + valid support alias;
3. legacy `PS02689.1` and `Copy-of-*` preservation;
4. canonical row + provenance behavior;
5. rejected raw token retained in trace/export;
6. explicit `/SL-147.1` PREV-NAME rename authority preserved;
7. DBREF-form token never resolving as an alias.

The focused qualification workflow permanently includes this test.

Existing protected controls remain green:
- PS-12154 `.2/.5` same-location behavior;
- PS-12120 five-location repeated-pipe behavior;
- BORE authority and CU-PI Site/Zone controls;
- JSON trace and trace/debug export regressions;
- typicality controls;
- standard report 21-column contract.

## Validation receipt before workreport commit
Validated branch head: `7eb48aeeb170dbd2ba6fafd66ab1fb2da6caf251`.

Results:
- focused Support Report qualification: **80/80 PASS**;
- five new #1210 PREV NAME semantic tests: **PASS**;
- Support/Steel Playwright browser qualification: **PASS**;
- Support Report Typicality ZIP Benchmark and selected diagnostics: **PASS**.

This workreport commit intentionally moves the PR head. Final readiness requires the same exact-head CI gates to rerun successfully after this commit.

## Non-goals / invariants
- No report-row grain change.
- No location-tolerance change.
- No new coordinate authority.
- No use of Owner workbook values as production engineering source data.
- No removal or mutation of the staged source value; rejected DBREF evidence stays auditable.
- No merge without fresh explicit Owner authorization.
