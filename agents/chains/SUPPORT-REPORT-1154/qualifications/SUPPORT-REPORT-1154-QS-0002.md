QUALIFICATION_PROTOCOL_VERSION: 3
QUALIFICATION_PROFILE: PARSER_TOPOLOGY
QUALIFICATION_PROFILE_VERSION: 2
QUALIFICATION_SCOPE_ID: QSCOPE-SUPPORT-REPORT-XML-GOLDEN-PARITY
QUESTION_SET_ID: SUPPORT-REPORT-1154-QS-0002
QUESTION_SET_STATUS: CURRENT
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1154
ISSUE_BASIS_ID: IB-SUPPORT-REPORT-1154-0001
AGENT_INSTANCE_ID: chatgpt:787fb18a-1c45-43d0-b8ad-7f23d3ce2106
QUALIFICATION_BASIS_HEAD: 28bb79ccdcfc229bbff51c1bd8e59806f64760a5
TAKEOVER_QUALIFICATION_READY: TRUE
QUALIFICATION_STATE: NOT_REQUIRED_FOR_SAME_CUSTODIAN_SCOPE_CONTINUATION
OWNER_QUALIFICATION_BASELINE_DISCOVERY: COMPLETE
OWNER_QUALIFICATION_BASELINE_SOURCE: NONE
OWNER_QUALIFICATION_BASELINE_STATUS: NOT_APPLICABLE
QUESTION_PACK_ACTION: REFRESHED
QUESTION_DISPLAY: SHOW

# Scope and drift basis

This refreshed pack covers the current Support Report parser -> grouping -> Support/Steel native enrichment -> field projection/export boundary while the authorized material leg remains WP-001 fixture/oracle custody only. Since EP-0001, Owner-merged #1156, #1157 and #1158 changed the Support Report output-contract/refactor/export domain on main. That is material downstream drift, so QS-0001 is retained as history and this pack binds current main.

The current custodian remains the same agent instance. This pack is for takeover readiness; it does not self-admit or self-verify a replacement candidate.

## Q1 — Production Trace

Repository anchors:
- `tabs/support-steel-relationship-builder/support-report-clash-evidence.js`
- `tabs/support-steel-relationship-builder/support-report-engine.js`
- `tabs/support-steel-relationship-builder/support-report-field-projection.js`
- `tabs/support-steel-relationship-builder/support-report-contract.js`
- `tabs/support-steel-relationship-builder/support-report-export.js`
- `tabs/support-steel-relationship-builder/support-steel-evidence-bundle.js`
- `tabs/ps-family-clash-audit/ps-family-token-utils.js`

Production object/case:
- Owner XML SHA256 `7738159bb96e2e38927a52fd6ebe625cf3f16eae0b7ad218652b799648736e62`
- Owner workbook SHA256 `16eb75d84bf31e9fa92ef26c0e73bf2cd6c5e71e1fcd047ffa27bb9094c36d56`
- expected evidence `20 clashes -> 10 {secondarySupportFamilyId, fullLineTag} groups`, five PS-007 + five SL-097.

Concrete payload:
- `ASIM-1885-PL-10"-S8810105-HOT-01`
- `ASIM-1885-PL-2"-G8010016-01`

Required derivation:
Trace one 10-inch case from clash XML object/path evidence through pipe-side member detection, secondary-family detection, grouping, native member/carrier selection, field projection, contract projection and spreadsheet export. Identify the semantic owner at each stage and prove that report UI/export remains downstream of canonical evidence and native model authority.

Fail if:
- family root alone establishes member-to-line membership;
- `.preview-samples`, UI or export formatting becomes engineering/native source authority;
- a second relationship engine is proposed.

## Q2 — Current Unresolved Problem / Failure Isolation

Repository anchors:
- current main `support-report-contract.js`
- PR #1156 retained-workbook projection change
- Owner workbook oracle INPUT-002
- Owner XML INPUT-001

Concrete payload A — incomplete clash membership:
- PS-007 10-inch expected `/PS-007.6, /PS-007.4, /PS-007.7`; XML-visible `/PS-007.7`.
- SL-097 10-inch expected `/SL-097.11, /SL-097.8, /SL-097.12, /SL-097.13`; XML-visible `/SL-097.12, /SL-097.13`.
- SL-097 2-inch expected `/SL-097.4, /SL-097.7`; XML-visible `/SL-097.7`.

Concrete payload B — output-contract conflict now visible on current main:
- Owner XLSX first header is `SCOPE`; current production first header is `PREV PRIMARY SUPPORT NAME`.
- Owner XLSX columns 5/6/7 are `PIPE SCHEDULE`, `PIPE INSULATION THICKNESS`, `PIPE INSULATION TYPE`; current production moves schedule to column 17 and combines insulation into one column.
- Owner XLSX column 8 header is blank and carries primary-support data; current production column 8 is `PIPING PRIMARY SUPPORT REFERENCE`.
- Owner XLSX contains no `REVISION` column; current production column 21 is `REVISION`.

Required reconstruction:
Derive the native-only member sets `{PS-007.6, PS-007.4}`, `{SL-097.11, SL-097.8}`, `{SL-097.4}`. Then identify the first wrong authority boundary when a repository-retained sample is used to redefine the Owner-supplied expected workbook contract.

Predicted intermediate values:
- grouping remains 10 logical rows;
- PS-007 groups = 5; SL-097 groups = 5;
- total support points on secondary = 5 for both families;
- fixing output-column authority must not alter grouping or native member selection.

Falsifier:
The current production 21-column order can be shown byte/cell-equivalent to the Owner XLSX A:U contract. If it cannot, the output-contract authority conflict remains open.

Fail if:
Expected values are synthesized from the workbook into runtime engineering state, or the Owner workbook is silently replaced by `.preview-samples/wb3d-table7.txt` as the acceptance oracle.

## Q3 — Authority / Invariant

Repository anchors:
- issue #1154 task/input/oracle ledgers
- `support-steel-evidence-bundle.js`
- `support-carrier-resolution.js`
- `support-report-field-projection.js`
- `support-report-contract.js`

Concrete payload:
- clash example `x=798.424 m, y=-1126.285 m, z=99.900 m`
- Owner workbook native example `E 798423mm, S 1126285mm, U 99900.45mm`
- XML lacks authoritative values such as schedule `PIPE Sch 80` and support reference `=1006649755/9225`.

Required derivation:
State field-level precedence for membership, coordinates, schedule, insulation, support type/reference, stress system, node number and previous name. State separately the authority for workbook column order/header semantics. Explain why clash evidence may be an explicit fallback for some spatial values but cannot supply absent native engineering fields, and why a repository sample cannot override an explicit Owner expected-output artifact.

Protected invariants:
- no fabricated engineering value;
- native/staged model owns complete membership and authoritative native attributes;
- Owner-supplied expected workbook owns #1154 golden output semantics unless the Owner changes it;
- presentation/export cannot redefine those authorities.

Invalid shortcut:
Reorder the Owner oracle or derive missing engineering fields merely to match current production output.

Falsifier:
Any nonblank report engineering value lacks authoritative provenance, or the production column contract differs from the frozen Owner oracle without an Owner-authorized disposition.

## Q4 — Independent Validation

Repository anchors:
- intended fixture `tests/fixtures/support-report/support-report-ps007-sl097.sanitized.xml`
- intended oracle `tests/fixtures/support-report/support-report-ps007-sl097.golden.json`
- intended independent test `tests/support-report-fixture-integrity.test.mjs`

Concrete payload:
- original XML SHA256 `7738159bb96e2e38927a52fd6ebe625cf3f16eae0b7ad218652b799648736e62`
- sanitized XML candidate SHA256 `326c0eb9e4bf17b224d63c539600d74ad0f6ffb6a9f4afbcddf2ad3ae29c6348`
- workbook SHA256 `16eb75d84bf31e9fa92ef26c0e73bf2cd6c5e71e1fcd047ffa27bb9094c36d56`
- artifact_tool oracle candidate SHA256 `9097c07a6853173d39d36157eee6d4cac8eda8324e993b3bce6908e69c63be2e`
- exact workbook shape: 21 columns, 10 data rows, PS-007=5, SL-097=5.

Calculation/reconstruction:
Independently verify fixture/oracle hashes, 20 `<clashresult>` records, no root `filepath=` metadata, exact 21-header/10-row oracle shape, family counts and support-point count=5. Prove the expected 10-inch primary-support member list contains native-only members absent from the clash XML.

Independent oracle:
Owner workbook extracted directly with artifact_tool before production comparison. Production Support Report code must not be imported by the integrity test.

Tolerance:
Hashes/cardinalities exact. Golden strings exact except for an explicitly documented future normalization rule approved for production parity.

Falsifier:
The integrity test can still pass after mutating engineering path/member content, changing golden row/column cardinality, or regenerating expected values from production output.

## Q5 — Next Contribution / Minimal Patch

Repository anchors:
- issue #1154 WP-001
- current main `28bb79ccdcfc229bbff51c1bd8e59806f64760a5`
- repository AGENTS.md code/backup policy

Concrete payload:
WP-001 adds only:
1. sanitized Owner XML fixture;
2. frozen artifact_tool Owner workbook oracle;
3. independent fixture-integrity test.

Required derivation:
Define how those three files remove chat-only oracle custody and expose a deterministic gate for later parser/contract work. Explain why no Support Report production file is needed in this leg even though current main now has a column-contract conflict.

Safe patch boundary:
New fixture/oracle/test only. No `tabs/support-steel-relationship-builder/**` production mutation; no workflow changes; no staged-model fabrication.

Expected before/after evidence:
Before: expected XML/XLSX truth exists only in conversation/session custody. After: sanitized XML and direct-extraction workbook oracle are repository recoverable and independently integrity-tested.

Validation required:
`node --check tests/support-report-fixture-integrity.test.mjs` and focused execution of that exact test against the committed fixture/oracle; full production parity remains NOT_RUN.

Negative test:
Fail on hash drift, removed engineering paths/members, incorrect 21x10 workbook shape, or production-generated oracle provenance.

Rollback/falsifier boundary:
If the XML cannot be sanitized without changing engineering content, do not commit it; use a narrower deterministic evidence fixture.

No-patch condition:
Do not change current production contract/export/grouping/enrichment in WP-001 merely to force parity.
