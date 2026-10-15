# WP-003 — Navisworks Support Report parser qualification

CHAIN_ID: SUPPORT-REPORT-1154
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1154
WORK_PACKAGE: WP-003
BASIS_MAIN: d30f5a2bb4db1c46b8ed135613601a6c2f1584ad
FIXTURE_CUSTODY: tests/fixtures/support-report/support-report-ps007-sl097.sanitized.xml
ORIGINAL_XML_SHA256: 7738159bb96e2e38927a52fd6ebe625cf3f16eae0b7ad218652b799648736e62
SANITIZED_FIXTURE_SHA256: 0ed0f84249442f11dcf5a08ce57098b70c88460d90621ebeaf4b90178269b3ba
DISPOSITION: COMPLETE_BY_CURRENT_MAIN_ADOPTION_PLUS_INDEPENDENT_FIXTURE_ORACLE
MATERIAL_LEG: NONE

## Production ownership trace

Current main uses three bounded parser owners:

1. `support-report-clash-evidence.js`
   - raw clash-object/path/smarttag extraction;
   - PS/SL member/family recognition;
   - branch/full-line extraction;
   - clash row construction;
   - canonical grouping by `secondarySupportFamilyId + fullLineTag`.

2. `support-report-clash-test-context.js`
   - isolates individual `<clashtest>` blocks;
   - preserves clash-test name/GUID/index on rows and diagnostics;
   - propagates exchange source units across test-local parsing.

3. `support-report-clash-safety.js`
   - malformed/truncated tag-count guard;
   - fail-closed rejection of multiple branch-bearing objects;
   - fail-closed rejection of conflicting non-pipe PS/SL family roots;
   - duplicate evidence warning/deduplication within logical groups.

Shared `decodeXmlEntities`, `parseNumber`, and `stripLeadingSlash` are imported from `tabs/ps-family-clash-audit/ps-family-token-utils.js`; Support Report does not maintain a second implementation of those primitives.

## WP-003 requirement reconciliation

| Requirement / negative control | Current-main disposition |
|---|---|
| multiple `<clashtest>` blocks | PASS — test-context isolates tests and preserves test metadata; startup regression covers two tests |
| clash GUID/status/distance/point provenance | PASS — evidence row retains clash name, GUID, status, distance in source units, source units and clash point converted to mm |
| XML entity decoding | PASS — governed PS-family primitive reused; encoded test-name regression exists |
| whitespace / optional smarttags | PASS — path remains authoritative; item-name smarttag is optional fallback input |
| absent pathlink / no branch-bearing side | PASS_FAIL_VISIBLE — no branch side produces `SUPPORT_REPORT_MISSING_PIPE_SIDE` and row is not emitted |
| fewer than two clash objects | PASS_FAIL_VISIBLE — missing opposite family side produces explicit missing-secondary-family diagnostics and no usable row |
| two plausible branch-bearing sides | PASS_FAIL_CLOSED — safety emits `SUPPORT_REPORT_AMBIGUOUS_PIPE_SIDE` ERROR and removes the clash |
| no PS/SL family root | PASS_FAIL_VISIBLE — missing primary member or secondary family diagnostic; no usable row |
| conflicting secondary family roots | PASS_FAIL_CLOSED — safety emits `SUPPORT_REPORT_CONFLICTING_SECONDARY_FAMILY` ERROR |
| duplicate clash rows | PASS — duplicate member/family/line/branch signatures are ignored inside the logical group with `SUPPORT_REPORT_DUPLICATE_EVIDENCE` WARN |
| malformed / truncated XML | PASS_FAIL_CLOSED — unbalanced `clashtest`, `clashresult` or `clashobject` counts produce `SUPPORT_REPORT_MALFORMED_XML` ERROR and zero rows |
| incomplete numeric point | PASS — invalid/missing coordinate component yields `clashPointGlobalMm: null`; no numeric synthesis |
| unrelated structural clash | PASS_FAIL_VISIBLE — without the report-specific branch-bearing primary member + opposite PS/SL family pattern it cannot become a usable report row |
| GENSEC/CU-SU role separation | PASS — branch-bearing pipe-side selection is independent of non-pipe secondary-family wording |
| PS and SL report roots | PASS — report grammar accepts both PS-* and SL-* roots within this report scope |

## Independent real-Owner-XML oracle

Validation class: `INDEPENDENT_RAW_XML_TREE_ORACLE`.

The Owner-supplied `/mnt/data/SupportreportXML.xml` was parsed with Python standard-library `xml.etree.ElementTree`; no Support Report production parser code was called.

Observed:

- exchange units: `m`;
- clash tests: `1` (`Test 1`, status `ok`, test_type `clearance`, tolerance `0.002`);
- clash results: `20`;
- usable clashes under the production safety shape: `20/20`;
- clashes with object count != 2: `0`;
- clashes with branch-bearing-object count != 1: `0`;
- clashes with non-pipe PS/SL family-root count != 1: `0`;
- clashes with incomplete XYZ point: `0`;
- independent `{secondary family, full line tag}` groups: `10`;
- family groups: `PS-007 = 5`, `SL-097 = 5`;
- duplicate evidence signatures `(member, secondary family, full line, branch)`: `6` duplicate rows.

Representative first clash independently reconstructs:

```text
clash: Clash1
clash GUID: b6af19db-70d2-4355-9f37-3c3295a07b8f
status: new
distance: -0.010 m
member: PS-007.5
secondary family: PS-007
full line: ASIM-1885-PL-8"-M8810123-PP-01
branch: ASIM-1885-PL-8"-M8810123-PP-01/B4
point: x=798.424, y=-1126.285, z=99.900 m
```

WP-001 committed-fixture integrity independently freezes the sanitized fixture at SHA256 `0ed0f84249442f11dcf5a08ce57098b70c88460d90621ebeaf4b90178269b3ba`, with exactly 20 `<clashresult>` records and 20 `/ASIM-1835-CU-SU` secondary-side paths. The frozen Owner workbook oracle independently fixes the logical target at 10 rows, five PS-007 and five SL-097.

## Silent-drop assessment

No real fixture clash matches a current-main fail-closed unsafe condition. Therefore the real input has no parser-safety-induced row drop: all 20 clash rows are structurally admissible before duplicate-within-group consolidation.

The six duplicate signatures are not silent drops: current safety policy preserves raw `rows` and records an explicit duplicate diagnostic while deduplicating repeated evidence inside each logical group. Logical group count remains 10.

## Authority boundary

This parser qualification proves relationship evidence intake only. It does **not** promote clash XML to a complete support register. Native-only primary-support members and engineering attributes remain authoritative only when proven by Support/Steel staged-model evidence.

The parser may preserve clash-point coordinates as explicit source evidence/fallback, but it cannot outrank native support/carrier coordinates when later field authority resolves a native position.

## Validation truth

- PASS — current-main source reconciliation against every WP-003 required/negative case.
- PASS — independent Owner original XML structural oracle: 20/20 admissible clashes, 10 groups, PS=5, SL=5, 6 duplicate signatures.
- PASS_WP001_REUSED — committed sanitized fixture byte/hash/count custody and Owner 10-row oracle.
- INSPECTED_EXISTING / NOT_RUN_THIS_LEG — current-main startup/parser synthetic tests were inspected but not executed by this chain in WP-003.
- NOT_RUN — browser smoke, staged-model enrichment parity, exact workbook cell parity, XLSX round-trip and shared regression suites remain later packages.

## Patch decision

`NO_PATCH`.

No concrete WP-003 production failure remains after reconciliation. Adding another parser or rewriting the current three-owner parser stack would duplicate authority without improving a demonstrated failing invariant.

The next unresolved material boundary is WP-004 authoritative grouping/enrichment against a real staged-model source. INPUT-003 remains unresolved, so any progression must first re-ground whether authoritative staged-model evidence has become available or whether current-main WP-004 work can be independently qualified without fabricating it.
