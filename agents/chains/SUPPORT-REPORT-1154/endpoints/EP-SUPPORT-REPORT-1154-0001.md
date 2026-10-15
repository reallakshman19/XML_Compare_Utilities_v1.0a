# EP-SUPPORT-REPORT-1154-0001 — Support Report v2 pre-work adoption

CHAIN_STATE_VERSION: 3
HANDOVER_PROTOCOL_VERSION: 2
CHAIN_ID: SUPPORT-REPORT-1154
ENDPOINT_ID: EP-SUPPORT-REPORT-1154-0001
PREVIOUS_ENDPOINT: NONE
ENDPOINT_REASON: ISSUE_V2_ADOPTION_PREWORK
CUSTODY_EPOCH: 1

WORK_ITEM_SOURCE: GITHUB_ISSUE
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1154
WORK_ITEM_MODE: EXCLUSIVE
AGENT_INSTANCE_ID: chatgpt:787fb18a-1c45-43d0-b8ad-7f23d3ce2106

REPO: reallaksh19/XML_Compare_Utilities
BRANCH: agent/support-report-1154
MAIN_HEAD_OBSERVED: 9fae87ed935d1dfe32d9302140ea414799d26fed
MATERIAL_HISTORY_ROOT_BASE: 9fae87ed935d1dfe32d9302140ea414799d26fed
PREWORK_BASIS_HEAD: d9d552fb7cf77545bc73879d53b3e1a553b0b359
MATERIAL_LEG_PREWORK_ENDPOINT_FILE: agents/chains/SUPPORT-REPORT-1154/endpoints/EP-SUPPORT-REPORT-1154-0001.md

ISSUE_BASIS_ID: IB-SUPPORT-REPORT-1154-0001
ISSUE_BASIS_FILE: agents/chains/SUPPORT-REPORT-1154/issue-basis/IB-SUPPORT-REPORT-1154-0001.md
ISSUE_CURRENT_STATE_FILE: agents/chains/SUPPORT-REPORT-1154/issue-state/CURRENT.md
ISSUE_CHAIN_ROOT_COMMENT_ID: 5605124994
ISSUE_ACTIVE_HANDOVER_COMMENT_ID: 5605121164
ISSUE_ENDPOINT_COMMENT_ID: 5605129153
PREVIOUS_ISSUE_ENDPOINT_COMMENT_ID: NONE
ISSUE_HANDOVER_SYNC_STATUS: PENDING_ACTIVE_MD_FINALIZATION_AT_ENDPOINT_COMMIT

COMMON_PROTOCOL: engineering-pr-delivery-v2
COMMON_PROTOCOL_BASIS: af4c5c73b87b26187aa6c930b60172cbb1f0f3e2
COMMON_PROTOCOL_STATUS: CURRENT

ENGINEERING_STATE: READY
CUSTODY_STATE: HELD
QUALIFICATION_STATE: NOT_REQUIRED
WRITE_AUTHORITY: READ_ONLY
AUTO_STATE: NOT_APPLICABLE
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
COORDINATION_STATE: SAFE_SERIALIZED; merged PR1153 is adopted foundation and no duplicate #1154 chain was found

OWNER_PROGRESSION_COMMAND: NOT_SET
OWNER_INSTRUCTION: 2026-09-09T16:10:53Z "start coding"
MATERIAL_PROGRESSION_AUTHORITY: BLOCKED_EXACT_OWNER_PROGRESSION_COMMAND_REQUIRED

ROADMAPS: issue #1154 execution plan @ snapshot 2026-09-09T16:10:53Z; Common@af4c5c73b87b26187aa6c930b60172cbb1f0f3e2; repository AGENTS.md@main 9fae87ed935d1dfe32d9302140ea414799d26fed
ROADMAP_REVIEW_STATUS: COMPLETE
ROADMAP_ALIGNMENT: ALIGNED_AFTER_STATUS_ONLY_DRIFT
ROADMAP_MUTATION_AUTHORITY: NONE

OWNER_QUALIFICATION_BASELINE_DISCOVERY: COMPLETE
OWNER_QUALIFICATION_BASELINE_SOURCE: NONE
OWNER_QUALIFICATION_BASELINE_MANIFEST: NONE
OWNER_QUALIFICATION_BASELINE_STATUS: NOT_APPLICABLE

QUALIFICATION_PROTOCOL_VERSION: 3
QUALIFICATION_PROFILE: PARSER_TOPOLOGY
QUALIFICATION_PROFILE_VERSION: 2
QUALIFICATION_SCOPE_ID: QSCOPE-SUPPORT-REPORT-XML-GOLDEN-PARITY
QUESTION_SET_ID: SUPPORT-REPORT-1154-QS-0001
QUESTION_SET_STATUS: CURRENT
QUESTION_PACK_ACTION: REFRESHED
QUESTION_DISPLAY: HIDE
PREWORK_QUALIFICATION_READY: TRUE
TAKEOVER_QUALIFICATION_READY: TRUE

## Mission

Adopt merged Support Report foundation #1153 under issue #1154 v2 custody, preserve independent Owner XML/XLSX evidence, and prepare the smallest safe next material leg. The immediate next material package is WP-001 only: repository-resident sanitized XML + frozen workbook oracle + focused integrity validation. Production Support Report modules remain untouched in WP-001.

## Live drift reconciliation

- PR #1153 moved from OPEN to MERGED while this adoption was being grounded.
- Merge commit: `9fae87ed935d1dfe32d9302140ea414799d26fed`.
- Two material commits after the earlier roadmap snapshot are explicitly adopted as pre-chain foundation evidence:
  - `0d24a46710ba7557bc0e23372e4ffc4babb8915c` stale-export invalidation on XML/model/rules input changes;
  - `adebf3732aef1200bf3f516775c6348bd4e6dfee` focused UI contract assertions for invalidation.
- Drift class: STATUS_ONLY_DRIFT for roadmap/PR state; Owner mission and engineering authority are unchanged.
- No retroactive v2 qualification or validation PASS is inferred from the merge.

## Input custody

- INPUT-001 Owner XML SHA256: `7738159bb96e2e38927a52fd6ebe625cf3f16eae0b7ad218652b799648736e62` — external/session custody only.
- INPUT-002 Owner XLSX SHA256: `16eb75d84bf31e9fa92ef26c0e73bf2cd6c5e71e1fcd047ffa27bb9094c36d56` — `ASIM!A1:U12`, external/session custody only.
- Prepared sanitized XML candidate: remove only root `exchange@filepath`; SHA256 `326c0eb9e4bf17b224d63c539600d74ad0f6ffb6a9f4afbcddf2ad3ae29c6348`; NOT COMMITTED.
- Prepared artifact_tool golden JSON candidate: exact 21 headers + 10 workbook data rows; SHA256 `9097c07a6853173d39d36157eee6d4cac8eda8324e993b3bce6908e69c63be2e`; NOT COMMITTED.
- INPUT-005 combined staged-model JSON required for full native enrichment remains UNRESOLVED.

## Benchmark / validation truth

- BM-001 READY_EXTERNAL: Owner XML independently establishes 20 usable clash rows -> 10 family/line groups.
- BM-002 READY_EXTERNAL: Owner workbook has 21 columns.
- BM-003 READY_EXTERNAL: 10 logical rows; PS-007=5; SL-097=5; total support points on secondary=5.
- BM-004..BM-009: NOT_RUN.
- Merged #1153 focused test claims are historical foundation evidence; this issue has not yet independently rerun production/golden qualification.

## Current blocker / exact next action

`start coding` is not one of the exact Owner progression commands defined by the adopted v2 protocol. Do not invent an alias.

EXACT_NEXT_ACTION: after exact Owner `proceed next`, commit WP-001 only: sanitized XML fixture + frozen artifact_tool workbook oracle + focused integrity validation. Do not edit Support Report production modules. Freeze the WP-001 material receipt/endpoint before WP-002.

## Active qualification questions

### Q1 — Production Trace

Repository anchors: `support-report-clash-evidence.js`, `support-report-engine.js`, `support-steel-evidence-bundle.js`, `support-steel-source-reader.js`, `ps-family-token-utils.js`, `support-report-export.js`.

Production object/case: Owner XML `7738159b...`; Owner workbook `16eb75d8...`; expected `20 clashes -> 10 {secondarySupportFamilyId, fullLineTag} groups` with five PS-007 and five SL-097 rows.

Concrete payload: include the 10-inch line `ASIM-1885-PL-10"-S8810105-HOT-01` and 2-inch line `ASIM-1885-PL-2"-G8010016-01`.

Required derivation: trace one 10-inch XML clash through pipe-side member detection, secondary-family detection, canonical grouping, Support/Steel native member filtering by line/branch context, field projection and export. Identify the owner of each semantic decision and prove UI/export stays downstream.

Fail if: family root alone proves member-to-line membership, clash/UI state becomes native engineering authority, or a parallel relationship engine is proposed.

### Q2 — Current Unresolved Problem / Failure Isolation

Concrete payload:
- PS-007 10-inch expected `/PS-007.6, /PS-007.4, /PS-007.7`; XML-visible `/PS-007.7`.
- SL-097 10-inch expected `/SL-097.11, /SL-097.8, /SL-097.12, /SL-097.13`; XML-visible `/SL-097.12, /SL-097.13`.
- SL-097 2-inch expected `/SL-097.4, /SL-097.7`; XML-visible `/SL-097.7`.

Calculation/reconstruction: derive native-only missing sets `{PS-007.6, PS-007.4}`, `{SL-097.11, SL-097.8}`, `{SL-097.4}` and explain why group cardinality stays 10 while member completeness changes.

Predicted intermediate values: PS-007 groups=5; SL-097 groups=5; total support points on secondary=5 for both families.

First wrong boundary: native family member selection/filtering by carrier/branch/full-line context if grouping is correct but membership remains clash-only.

Falsifier: expected members can be produced without authoritative staged/native line/carrier evidence.

Fail if: workbook values, family numbering or line size are used to synthesize missing runtime members.

### Q3 — Authority / Invariant

Concrete payload: clash point example `x=798.424 m, y=-1126.285 m, z=99.900 m`; expected native workbook coordinate `E 798423mm, S 1126285mm, U 99900.45mm`; XML lacks schedule/reference values such as `PIPE Sch 80` and `=1006649755/9225`.

Required derivation: define field precedence for membership, coordinates, schedule, insulation, support type/reference, stress system and node number. Explain when clash coordinate is only a provenance-marked fallback and which absent fields must remain unresolved.

Protected invariant: no engineering value is fabricated or promoted from an evidence class lacking authority for that field.

Invalid shortcut: infer missing engineering attributes from expected workbook, line text or clash geometry solely to obtain parity.

Falsifier: any populated field cannot be traced to approved native attributes or an authorized deterministic derivation.

### Q4 — Independent Validation

Concrete payload:
- workbook SHA256 `16eb75d84bf31e9fa92ef26c0e73bf2cd6c5e71e1fcd047ffa27bb9094c36d56`;
- original XML SHA256 `7738159bb96e2e38927a52fd6ebe625cf3f16eae0b7ad218652b799648736e62`;
- sanitized XML candidate `326c0eb9e4bf17b224d63c539600d74ad0f6ffb6a9f4afbcddf2ad3ae29c6348`;
- artifact_tool oracle candidate `9097c07a6853173d39d36157eee6d4cac8eda8324e993b3bce6908e69c63be2e`;
- workbook structure 21 columns / 10 rows.

Calculation/reconstruction: independently verify 21 headers, 10 rows, five PS-007, five SL-097, total-support-points=5 and prove XML sanitization removes only root `exchange@filepath` while engineering clash/path/smarttag content is unchanged.

Independent oracle: Owner workbook extracted directly with artifact_tool before production comparison; raw XML structure independently parsed. Production output cannot generate expected values.

Falsifier: expected JSON is rewritten from production output or sanitization modifies engineering path/member content.

### Q5 — Next Contribution / Minimal Patch

Concrete payload: WP-001 only; sanitized XML candidate hash `326c0eb9...`; frozen oracle candidate hash `9097c07a...`; no production Support Report module edits.

Required derivation: specify new fixture/oracle/provenance files and focused integrity tests that make INPUT-001/002 durable without production coupling. Explain why the >300-line engine refactor is WP-002 rather than WP-001.

Safe patch boundary: new fixture/oracle/provenance files only, plus focused integrity validation if it can be added without product mutation.

Expected before/after evidence: before, Owner files are session-only; after, sanitized XML and extracted golden oracle are repository-resident with hashes and deterministic structural assertions.

Protected unchanged domains: merged Support Report production modules, Support/Steel relationship authority, PS-family Legacy Clash behavior, global family defaults, workflows and independent expected values.

Negative test: fail on changed XML engineering content, changed golden row/column cardinality, or oracle metadata claiming generation by production code.

Rollback/falsifier boundary: if sanitization cannot be proven metadata-only, do not commit full XML; use a narrower extracted evidence fixture.

No-patch condition: do not touch production parser/engine/export merely to make output equal the golden workbook during WP-001.
