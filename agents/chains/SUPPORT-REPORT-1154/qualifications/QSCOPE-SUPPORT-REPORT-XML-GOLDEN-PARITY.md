QUALIFICATION_PROTOCOL_VERSION: 3
QUALIFICATION_PROFILE: PARSER_TOPOLOGY
QUALIFICATION_PROFILE_VERSION: 2
QUALIFICATION_SCOPE_ID: QSCOPE-SUPPORT-REPORT-XML-GOLDEN-PARITY
QUESTION_SET_ID: SUPPORT-REPORT-1154-QS-0001
QUESTION_SET_STATUS: CURRENT
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1154
ISSUE_BASIS_ID: IB-SUPPORT-REPORT-1154-0001
AGENT_INSTANCE_ID: chatgpt:787fb18a-1c45-43d0-b8ad-7f23d3ce2106
TAKEOVER_QUALIFICATION_READY: TRUE
QUALIFICATION_STATE: NOT_REQUIRED_FOR_SAME_CUSTODIAN_SCOPE_CONTINUATION
OWNER_QUALIFICATION_BASELINE_DISCOVERY: COMPLETE
OWNER_QUALIFICATION_BASELINE_SOURCE: NONE
OWNER_QUALIFICATION_BASELINE_STATUS: NOT_APPLICABLE

# Scope

This pack covers the Support Report parser -> family/line grouping -> native Support/Steel enrichment -> 21-column report projection boundary, with the immediate next material work package restricted to durable independent fixture/oracle intake. It is a takeover exam for a replacement agent; the current custodian does not self-admit or self-verify it.

## Q1 — Production Trace

Repository anchors:
- `tabs/support-steel-relationship-builder/support-report-clash-evidence.js`
- `tabs/support-steel-relationship-builder/support-report-engine.js`
- `tabs/support-steel-relationship-builder/support-steel-evidence-bundle.js`
- `tabs/support-steel-relationship-builder/support-steel-source-reader.js`
- `tabs/ps-family-clash-audit/ps-family-token-utils.js`
- `tabs/support-steel-relationship-builder/support-report-export.js`

Production object/case:
- Owner XML SHA256 `7738159bb96e2e38927a52fd6ebe625cf3f16eae0b7ad218652b799648736e62`
- Owner workbook SHA256 `16eb75d84bf31e9fa92ef26c0e73bf2cd6c5e71e1fcd047ffa27bb9094c36d56`
- expected XML evidence `20 clashes -> 10 {secondarySupportFamilyId, fullLineTag} groups`

Concrete payload:
- five PS-007 logical rows and five SL-097 logical rows
- full line examples `ASIM-1885-PL-10"-S8810105-HOT-01` and `ASIM-1885-PL-2"-G8010016-01`

Required technical work / derivation:
Trace one 10-inch clash from XML path nodes through pipe-side member identification, secondary family identification, canonical group creation, Support/Steel family/member filtering by line/branch context, field projection and CSV/XLSX-ready output. Identify the first owner of each semantic decision and prove that UI/export is downstream of the canonical report bundle.

First authority/ownership boundaries:
- XML evidence ownership: Support Report clash adapter
- canonical family/member enrichment: Support/Steel relationship/native source model
- token parsing reuse: PS-family token utilities where semantics match
- presentation/export: report projection only

Fail if:
- family root alone is treated as sufficient member-to-line proof;
- clash point or UI state becomes native engineering authority;
- a parallel family/carrier engine is introduced.

## Q2 — Current Unresolved Problem / Failure Isolation

Repository anchors:
- current merged Support Report modules on main `9fae87ed935d1dfe32d9302140ea414799d26fed`
- Owner workbook oracle INPUT-002
- Owner XML INPUT-001

Concrete payload:
- PS-007 10-inch expected primary supports: `/PS-007.6, /PS-007.4, /PS-007.7`
- XML-visible PS-007 10-inch support member: `/PS-007.7`
- SL-097 10-inch expected: `/SL-097.11, /SL-097.8, /SL-097.12, /SL-097.13`
- XML-visible SL-097 10-inch: `/SL-097.12, /SL-097.13`
- SL-097 2-inch expected: `/SL-097.4, /SL-097.7`
- XML-visible SL-097 2-inch: `/SL-097.7`

Calculation/reconstruction:
Compute the native-only member set for each incomplete case and explain the exact first wrong boundary if production reports only clash-visible members. For the three cases, derive the missing sets as `{PS-007.6, PS-007.4}`, `{SL-097.11, SL-097.8}`, and `{SL-097.4}` respectively.

Predicted intermediate values:
- grouping remains 10 logical rows even though 20 clash records exist;
- total support points on secondary remains 5 for each target family;
- enrichment completeness changes member lists, not the family/line row cardinality.

First wrong boundary:
Native family member selection/filtering by carrier/branch/full-line context if the canonical group is correct but membership remains clash-only.

Falsifier:
Any implementation can produce the expected missing members from family-name heuristics without matching authoritative native line/carrier evidence.

Fail if:
Missing members are synthesized from the workbook, line size, family numbering or clash count rather than recovered from the staged/native model.

## Q3 — Authority / Invariant

Repository anchors:
- `support-steel-evidence-bundle.js`
- `support-carrier-resolution.js`
- `support-carrier-catalog.js`
- `support-report-engine.js`
- issue #1154 protected-boundary section

Concrete payload:
- clash point example near `x=798.424 m, y=-1126.285 m, z=99.900 m`
- expected workbook native coordinate example `E 798423mm, S 1126285mm, U 99900.45mm`
- XML does not contain schedule/reference values such as `PIPE Sch 80` or `=1006649755/9225`.

Required technical work / derivation:
State the field-level precedence for membership, coordinates, schedule, insulation, support type/reference, stress system and node number. Explain why clash coordinates may be a provenance-marked fallback but cannot silently replace native positions where the workbook expects authoritative model coordinates. Identify which missing fields must remain unresolved when native attributes are absent.

Protected invariant:
No engineering value is fabricated or promoted from an evidence class that lacks authority for that field.

Invalid shortcut:
Derive schedule/insulation/reference/stress/node fields from line text, family numbering, expected workbook rows or clash geometry merely to obtain golden parity.

Falsifier:
A report shows a nonblank engineering field whose provenance cannot be traced to an approved native attribute or deterministic authorized derivation.

Fail if:
UNRESOLVED/blank states are converted into permissive defaults to make the spreadsheet look complete.

## Q4 — Independent Validation

Repository anchors:
- Owner workbook `ASIM!A1:U12`
- intended durable oracle `tests/fixtures/support-report/support-report-ps007-sl097.golden.json`
- intended sanitized XML fixture `tests/fixtures/support-report/support-report-ps007-sl097.sanitized.xml`

Concrete payload:
- workbook SHA256 `16eb75d84bf31e9fa92ef26c0e73bf2cd6c5e71e1fcd047ffa27bb9094c36d56`
- original XML SHA256 `7738159bb96e2e38927a52fd6ebe625cf3f16eae0b7ad218652b799648736e62`
- prepared sanitized XML candidate SHA256 `326c0eb9e4bf17b224d63c539600d74ad0f6ffb6a9f4afbcddf2ad3ae29c6348`
- prepared artifact_tool workbook-oracle candidate SHA256 `9097c07a6853173d39d36157eee6d4cac8eda8324e993b3bce6908e69c63be2e`
- workbook contains exactly 21 columns and 10 data rows.

Calculation/reconstruction:
Independently verify the golden structure directly from the frozen oracle: 21 headers; 10 data rows; PS-007=5; SL-097=5; every target row total-support-points value=5. Confirm the sanitized XML differs only by removal of root `exchange@filepath`, with clash/test/path/smarttag engineering content unchanged.

Independent oracle:
Owner workbook extracted directly with artifact_tool and frozen before production comparison; XML structural counts independently parsed from the Owner input. Production report output is not allowed to generate expected values.

Units/sign/tolerance:
String fields require exact normalized equality under an explicitly documented normalization policy. Integer/cardinality fields are exact. Coordinates are exact formatted workbook strings for golden parity unless a separately approved numeric tolerance comparison is introduced.

Falsifier:
Expected JSON changes because production output changed, or sanitization removes/rewrites engineering path/member content.

Fail if:
The test can pass after mutating the oracle from production output or cannot prove fixture provenance by hash.

## Q5 — Next Contribution / Minimal Patch

Repository anchors:
- issue #1154 WP-001 and WP-002
- repository AGENTS.md backup/new-JS constraints
- current main `9fae87ed935d1dfe32d9302140ea414799d26fed`

Concrete payload:
- next material leg is WP-001 only
- add sanitized XML fixture with candidate SHA `326c0eb9e4bf17b224d63c539600d74ad0f6ffb6a9f4afbcddf2ad3ae29c6348`
- add frozen workbook oracle with candidate SHA `9097c07a6853173d39d36157eee6d4cac8eda8324e993b3bce6908e69c63be2e`
- do not edit current production Support Report modules in WP-001.

Required technical work / derivation:
Specify the smallest repository-resident fixture/oracle patch that makes INPUT-001/002 independently recoverable, records original and sanitized hashes, and lets later tests consume frozen expected values without production-code coupling. Explain why this is a prerequisite to refactoring the >300-line engine and why the first production refactor belongs to WP-002, not WP-001.

Safe patch boundary:
New fixture/oracle/provenance files only, plus a focused fixture-integrity test only if it does not edit existing product files. No support-report production module mutation in WP-001.

Expected before/after evidence:
Before: Owner files exist only in conversation/session custody. After: sanitized XML + extracted golden oracle are repository-resident with hashes and deterministic row/header assertions.

Protected unchanged domains:
Merged Support Report production modules, Support/Steel relationship authority, PS-family legacy parser behavior, global family defaults, workflows, benchmark expected values beyond the frozen Owner oracle.

Validation required:
Hash verification, XML structural sanity, golden JSON schema/row/header/family-count assertions; mark full production parity NOT_RUN until staged-model INPUT-005 is available.

Negative test:
Fixture integrity must fail if XML engineering path/member content changes, workbook expected row/column cardinality changes, or the oracle metadata says it was generated by production code.

Rollback/falsifier boundary:
If sanitization cannot be proven to remove only private filepath metadata, do not commit the XML fixture; use a more limited deterministic extracted evidence fixture instead.

No-patch condition:
Do not modify production parser/engine/export code during WP-001 merely to make current output equal the golden workbook.
