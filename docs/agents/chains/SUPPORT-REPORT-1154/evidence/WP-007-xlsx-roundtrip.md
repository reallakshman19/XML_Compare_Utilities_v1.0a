# WP-007 XLSX round-trip evidence

WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1154
WORK_PACKAGE: WP-007
MATERIAL_BRANCH: agent/support-report-1154-wp007
MATERIAL_HEAD: 9b309763485c163a0666461346d20ce748244165
STACK_BASE: agent/support-report-1154-wp006@af776a5e1b636070b034e506018c06882a9becf8
DRAFT_PR: #1176
RUNTIME_PRODUCTION_CHANGE: NONE

## Scope

Qualify Support Report XLSX serialization/read-back fidelity without changing engineering-value authority, parser/grouping/enrichment behavior, production writer code, or Owner expected values.

## Added validation assets

- `tests/helpers/simple-ooxml-xlsx.mjs` — 226 physical lines; test-only minimal standards-compliant OOXML adapter + independent stored-ZIP XLSX reader using Node built-ins.
- `tests/support-report-xlsx-roundtrip.test.mjs` — 92 physical lines; invokes `supportReportToXlsxBytes` through its existing `importModule` seam and reads the resulting XLSX package back independently.

Git blob identity was checked against the locally executed bytes:
- helper blob: `c98208a55e3a61906ad505e9c744d079dfad9718`
- test blob: `7a1d96fe08d3cf138903b4f7b9a5418c19fb186c`

## Validation actually executed

- `node --check tests/helpers/simple-ooxml-xlsx.mjs` — PASS.
- `node --check tests/support-report-xlsx-roundtrip.test.mjs` — PASS.
- `node --test tests/support-report-xlsx-roundtrip.test.mjs` — PASS, 4/4.
- Branch diff against WP-006 head — exactly two added files, 226 + 92 lines; no production file changed.
- Generated package was identified by the host as Microsoft Excel 2007+.
- Independent `artifact_tool` import opened `Support Report!A1:U3` and reproduced the exact 3x21 ordinal/header/data values.
- `artifact_tool` formula inspection found no formulas in `A1:U3`.

## Round-trip assertions

- production dynamic-import seam requested `https://esm.sh/xlsx@0.18.5`;
- output starts with ZIP/XLSX signature;
- default sheet name: `Support Report`;
- dimension: `A1:U3` for one data row with ordinal row enabled;
- autofilter: `A2:U3` with ordinal row, `A1:U2` without ordinal row;
- ordinal row is exactly integers 1..21;
- Owner header is exactly 21 cells and H2 is blank;
- all matrix cells round-trip value-equivalent;
- primary-support reference text beginning `=` remains literal text;
- formula count is zero;
- custom sheet name and no-ordinal mode round-trip.

## Qualification boundary

The execution environment could not fetch the external esm.sh module itself. The round-trip therefore uses a test-only standards-compliant XLSX adapter injected through the same `importModule` seam; it does not prove network availability or the exact byte encoding produced by remote SheetJS.

Status classification:
- SUPPORT_REPORT_XLSX_WORKBOOK_MODEL_ROUNDTRIP: PASS
- INDEPENDENT_OOXML_READBACK: PASS
- ARTIFACT_TOOL_INDEPENDENT_READBACK: PASS
- FORMULA_LIKE_REFERENCE_LITERAL_SAFETY: PASS_ON_INJECTED_OOXML_ADAPTER
- DEFAULT_SHEETJS_MODULE_URL_ROUTING: PASS
- DEFAULT_SHEETJS_NETWORK_MODULE_AVAILABILITY: NOT_RUN_ENVIRONMENT_NETWORK_UNAVAILABLE
- DEFAULT_SHEETJS_REMOTE_SERIALIZATION_BYTES: NOT_RUN
- BM-006: PARTIAL_PASS_XLSX_ROUNDTRIP; final target workbook equivalence remains coupled to BM-004 real-row generation
- BM-004: BLOCKED_INPUT003

No Owner expected-output cell was used as native/staged engineering input.
