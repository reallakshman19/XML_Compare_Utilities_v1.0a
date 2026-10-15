ISSUE_BASIS_ID: IB-SUPPORT-REPORT-1154-0001
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1154
ISSUE_SOURCE: https://github.com/reallaksh19/XML_Compare_Utilities/issues/1154
ISSUE_SOURCE_SNAPSHOT_AT: 2026-09-09T16:10:53Z
PREVIOUS_ISSUE_BASIS: NONE
CHANGE_AUTHORITY: INITIAL_CAPTURE + OWNER_DIRECT:2026-09-09T16:10:53Z "start coding"
ISSUE_BASIS_STATUS: CURRENT

ROADMAP_CLASS: ISSUE_EXECUTION_PLAN
ISSUE_ROLE: PROGRAM_ROOT_SINGLE_CHAIN
CURRENT_WORK_PACKAGE: WP-000
WORK_ITEM_MODE: EXCLUSIVE

# Mission

Deliver the production-grade Support Report Builder defined by issue #1154 under Utilities -> Support / Steel Relationship Builder. Navisworks Support Report clash XML is relationship evidence; the existing Support/Steel staged-model relationship architecture remains the enrichment authority. Output must match the Owner-supplied PS-007 / SL-097 workbook wherever authoritative inputs exist and must never fabricate engineering values.

# Original task / acceptance ledger

- TASK-001 | Add a new Support Report module inside Support / Steel Relationship Builder. | OPEN | issue #1154
- TASK-002 | Reuse existing Support/Steel relationship logic rather than build a parallel relationship engine. | OPEN | issue #1154
- TASK-003 | Reuse PS / SL Family Evidence Audit Legacy Clash XML logic where applicable. | OPEN | issue #1154
- TASK-004 | Correctly consume SupportreportXML.xml. | OPEN | durable sanitized fixture + parser golden result required
- TASK-005 | Produce the expected logical PS-007 and SL-097 report set. | OPEN | exact 10-row golden comparison required
- TASK-006 | Recover complete primary-support membership only from authoritative native/staged evidence when clash XML is incomplete. | OPEN | native-only member golden cases required
- TASK-007 | Match the expected 21-column contract, ordering, formatting and legacy header behavior. | OPEN | independent workbook oracle required
- TASK-008 | Produce downloadable spreadsheet output suitable for the expected workflow. | OPEN | XLSX validation required
- TASK-009 | Never fabricate missing schedule/insulation/reference/stress/node/coordinate engineering data. | OPEN | negative tests + provenance required
- TASK-010 | Leave crash-safe v2 custody, validation truth and Owner-only merge discipline. | IN_PROGRESS | this chain establishes v2 custody

# Input ledger

- INPUT-001 | Owner SupportreportXML.xml | AVAILABLE_EXTERNAL | original SHA256 7738159bb96e2e38927a52fd6ebe625cf3f16eae0b7ad218652b799648736e62 | not yet repository-resident
- INPUT-002 | Owner SL-097 and PS-007.xlsx | AVAILABLE_EXTERNAL | SHA256 16eb75d84bf31e9fa92ef26c0e73bf2cd6c5e71e1fcd047ffa27bb9094c36d56 | sheet ASIM A1:U12; not yet repository-resident
- INPUT-003 | Candidate sanitized XML fixture | PREPARED_EXTERNAL_NOT_COMMITTED | removes only root exchange@filepath; candidate SHA256 326c0eb9e4bf17b224d63c539600d74ad0f6ffb6a9f4afbcddf2ad3ae29c6348
- INPUT-004 | Candidate extracted workbook oracle | PREPARED_EXTERNAL_NOT_COMMITTED | artifact_tool extraction only; 21 headers, 10 data rows; candidate SHA256 9097c07a6853173d39d36157eee6d4cac8eda8324e993b3bce6908e69c63be2e
- INPUT-005 | Combined staged-model JSON with complete support/carrier attributes | UNRESOLVED | required for full field/member enrichment
- INPUT-006 | Existing Support/Steel relationship owners on main | AVAILABLE | tabs/support-steel-relationship-builder/**
- INPUT-007 | Existing PS/SL Legacy Clash parser/token utilities on main | AVAILABLE | tabs/ps-family-clash-audit/**

# Benchmark / oracle ledger

- BM-001 | raw XML structural/grouping oracle | READY_EXTERNAL | expected 20 usable clash rows -> 10 family/line groups
- BM-002 | workbook column contract | READY_EXTERNAL | exact 21 columns from INPUT-002
- BM-003 | logical row/family oracle | READY_EXTERNAL | 10 rows total; PS-007=5; SL-097=5; total support points on secondary=5
- BM-004 | exact cell-by-cell workbook parity | NOT_RUN | Owner workbook is independent oracle; production output may not rewrite it
- BM-005 | missing-data negative controls | NOT_RUN | blanks/UNRESOLVED/diagnostics required instead of fabricated values
- BM-006 | CSV/XLSX round-trip equivalence | NOT_RUN
- BM-007 | Support/Steel regression suite | NOT_RUN
- BM-008 | PS-family/Legacy Clash regression suite | NOT_RUN
- BM-009 | browser Support Report workflow smoke | NOT_RUN

# Current production foundation

PR #1153 was merged to main as commit 9fae87ed935d1dfe32d9302140ea414799d26fed on 2026-09-09T16:16:02Z. It is adopted as PRECHAIN_FOUNDATION_EVIDENCE, not retroactively qualified v2 material. The merged foundation includes SupportReportBundle.v1, clash-evidence parsing/grouping, staged-model enrichment, UI addon, CSV export, focused tests, and stale-export invalidation when XML/model/rules change.

The two post-roadmap material commits before merge are explicitly adopted as pre-chain foundation:
- 0d24a46710ba7557bc0e23372e4ffc4babb8915c — invalidate stale exports when inputs change
- adebf3732aef1200bf3f516775c6348bd4e6dfee — cover input invalidation contract

# Roadmap ledger

- RM-001 | GitHub issue #1154 body @ snapshot 2026-09-09T16:10:53Z | ISSUE_EXECUTION_PLAN | PRIMARY | ALIGNED | agent-maintained inside Owner task authority
- RM-002 | Common engineering-pr-delivery-v2 @ af4c5c73b87b26187aa6c930b60172cbb1f0f3e2 | PROCESS_CUSTODY | CURRENT | NO_MUTATION
- RM-003 | repository AGENTS.md @ main 9fae87ed935d1dfe32d9302140ea414799d26fed | PROJECT_OVERLAY | CURRENT | stricter backup/new-JS limits apply
- RM-004 | Owner Roadmap registry | NOT_APPLICABLE | no docs/roadmaps/ROADMAP_REGISTRY.md match found for this domain

# Owner qualification baseline

OWNER_QUALIFICATION_BASELINE_DISCOVERY: COMPLETE
OWNER_QUALIFICATION_BASELINE_SOURCE: NONE
OWNER_QUALIFICATION_BASELINE_MANIFEST: NONE
OWNER_QUALIFICATION_BASELINE_STATUS: NOT_APPLICABLE

# Protected boundaries

- Clash XML remains relationship/linkage evidence, not a complete support register.
- Support/Steel relationship/native model remains the complete-member and native-attribute enrichment authority.
- Production output cannot become its own independent benchmark/oracle.
- Missing engineering fields remain blank/UNRESOLVED with diagnostics unless an approved deterministic derivation exists.
- UI/export cannot redefine engineering membership, coordinates or attribute authority.
- PS+SL family recognition required by Support Report remains report-scoped unless separately authorized.
- Existing merged #1153 behavior is foundation evidence only; no merge-ready/qualification claim is inferred from its merge.
- Merge authority for all follow-on work remains Owner-only.
