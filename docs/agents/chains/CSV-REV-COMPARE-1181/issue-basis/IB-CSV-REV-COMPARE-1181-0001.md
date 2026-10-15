ISSUE_BASIS_ID: IB-CSV-REV-COMPARE-1181-0001
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1181
ISSUE_SOURCE: github:reallaksh19/XML_Compare_Utilities#1181
ISSUE_SOURCE_SNAPSHOT_AT: 2026-09-10T08:41:21Z
PREVIOUS_ISSUE_BASIS: NONE
CHANGE_AUTHORITY: INITIAL_CAPTURE
ISSUE_BASIS_STATUS: CURRENT

# Original task / acceptance ledger

- TASK-001 | Add separate Utilities tile `CSV Rev Compare (XML Based)` without replacing generic Revision Compare | OPEN | issue #1181
- TASK-002 | CSV/table is ingress/egress only; comparison authority is categorized XML/graph | OPEN | issue #1181
- TASK-003 | Reuse existing Table-to-Categorized-XML parser/graph/export/profile/controller authorities; no second CSV parser or one-off XML serializer | OPEN | issue #1181
- TASK-004 | Govern conversion with reusable profile `support-revision-csv-xml/v1` preserving row/cell provenance | OPEN | issue #1181
- TASK-005 | Preserve duplicate headers through stable column IDs and load ordinals | OPEN | issue #1181
- TASK-006 | Convert aligned PIPING PRIMARY SUPPORT / SUPPORT TYPE / REFERENCE parallel lists with many-per-row; never truncate mismatched lists | OPEN | issue #1181
- TASK-007 | Compare SecondarySupport -> logical SupportLocation -> PrimarySupport hierarchy, never spreadsheet row ordinal | OPEN | issue #1181
- TASK-008 | Treat persistent primary-support reference as strongest component identity; member suffix renumbering is continuation | OPEN | issue #1181
- TASK-009 | Reuse/adapt existing candidate/review concepts and expose DETERMINISTIC / LIKELY / AMBIGUOUS / NO_MATCH without silent ambiguous winner selection | OPEN | issue #1181
- TASK-010 | Support 1->1, 1->0, 0->1, 1->N, N->1 and N->M lineage | OPEN | issue #1181
- TASK-011 | Parse PIPE into semantic tokens while retaining raw value and token deltas | OPEN | issue #1181
- TASK-012 | Normalize engineering coordinate direction/sign/frame before relocation; distinguish FORMAT_CHANGED / ROUNDING_ONLY / ACTUAL_POSITION_CHANGED | OPEN | issue #1181
- TASK-013 | Represent common-support topology explicitly; duplicate PREV NAME alone is insufficient | OPEN | issue #1181
- TASK-014 | Compare support types as reference-aware component multisets; duplicates significant | OPEN | issue #1181
- TASK-015 | Preserve repeated load/result columns by ordinal and classify EMPTY/NUMERIC/SYMBOLIC/MIXED under a versioned tolerance policy | OPEN | issue #1181
- TASK-016 | Produce typed structured event ledger before human remarks | OPEN | issue #1181
- TASK-017 | Remarks are outputs only; target benchmark remarks must never be comparison evidence | OPEN | issue #1181
- TASK-018 | Implement deterministic `SUPPORT_REV_REMARKS_V1` precedence/dedup renderer | OPEN | issue #1181
- TASK-019 | Do not automate Support Hold / Hold Removed | OPEN | issue #1181
- TASK-020 | Retain suppressed field diffs in audit with remarkEligible=false unless governed otherwise | OPEN | issue #1181
- TASK-021 | Primary output is later-revision Support Report CSV/XLSX plus policy-required tombstone/replacement rows | OPEN | issue #1181
- TASK-022 | Export comparison audit JSON, both categorized XMLs, both graphs, profile JSON and preferably Rev Compare Audit XLSX | OPEN | issue #1181
- TASK-023 | Every final remark must trace remark token -> event -> lineage/candidate evidence -> XML node -> original CSV row/column | OPEN | issue #1181
- TASK-024 | Implement explicit 17-stage workflow with ambiguous-lineage review before qualified export | OPEN | issue #1181
- TASK-025 | Qualify all owner-listed benchmark behaviors and negative controls | OPEN | issue #1181
- TASK-026 | Keep implementation surgical: no competing parser/candidate ledger/direct CSV matcher/remarks business logic | OPEN | issue #1181
- TASK-027 | Open focused draft PR; never merge without explicit Owner authority | OPEN | issue #1181

# Input ledger

- INPUT-001 | Issue #1181 full specification | AVAILABLE | GitHub issue body
- INPUT-002 | Existing table-categorizer parser/profile/graph/export/controller contracts and tests | AVAILABLE | repository main
- INPUT-003 | Existing XML Compare candidate/review and Revision Compare contracts | AVAILABLE | repository main
- INPUT-004 | Owner-supplied raw REV1/REV2 benchmark files | UNRESOLVED | no attachment/comment/file located in issue/repository during initial inspection
- INPUT-005 | Existing Support Report CSV/XLSX terminology/export patterns | AVAILABLE | repository main

# Benchmark / oracle ledger

- BM-001 | CSV row reordering produces no false changes | NOT_RUN | issue #1181
- BM-002 | Duplicate Fx/Fy/Fz headings survive CSV->XML via stable column IDs | NOT_RUN | issue #1181
- BM-003 | Persistent references survive member renumbering | NOT_RUN | issue #1181
- BM-004 | SL-212 reference =1006649755/4596 removal -> SUPPORT_COMPONENT_SET_CHANGED -> Support Type Changes | NOT_RUN | issue #1181
- BM-005 | SL-212 numeric vector change -> LOAD_SIGNATURE_CHANGED -> Load change | NOT_RUN | issue #1181
- BM-006 | PS02039 EMPTY->NUMERIC -> LOAD_BECAME_NUMERIC -> load standardised | NOT_RUN | issue #1181
- BM-007 | Unchanged numeric vector produces no load remark | NOT_RUN | issue #1181
- BM-008 | Common-support locations with distinct ref sets/coordinates are not collapsed | NOT_RUN | issue #1181
- BM-009 | COMMON_SUPPORT_REPLICATED requires structural graph evidence | NOT_RUN | issue #1181
- BM-010 | N/S/sign formatting alone cannot trigger relocation | NOT_RUN | issue #1181
- BM-011 | Removed support with no successor -> Invalid Support, This pipe no longer supported | NOT_RUN | issue #1181
- BM-012 | Proven replacement -> invalid old row + successor previous-family/line remark | NOT_RUN | issue #1181
- BM-013 | Hold automation absent | NOT_RUN | issue #1181
- BM-014 | Target benchmark remarks never affect event truth | NOT_RUN | issue #1181
- BM-015 | Every generated remark traces to XML and original CSV cells | NOT_RUN | issue #1181

# Roadmap ledger

- RM-001 | GitHub issue #1181 body | ISSUE_EXECUTION_PLAN | PRIMARY | ALIGNED | Owner task authority
- RM-002 | Common engineering-pr-delivery-v2@af4c5c73b87b26187aa6c930b60172cbb1f0f3e2 | PROCESS_CUSTODY | CURRENT | NO_MUTATION
- RM-003 | repository AGENTS.md@main | PROJECT_OVERLAY | CURRENT | stricter backup/new-JS limits apply
- RM-004 | docs/roadmaps/ROADMAP_REGISTRY.md | NOT_APPLICABLE | no registry file/match located for this domain

# Owner qualification baseline

OWNER_QUALIFICATION_BASELINE_DISCOVERY: COMPLETE
OWNER_QUALIFICATION_BASELINE_SOURCE: github:reallaksh19/XML_Compare_Utilities#1181 technical acceptance/benchmark challenges
OWNER_QUALIFICATION_BASELINE_MANIFEST: agents/chains/CSV-REV-COMPARE-1181/qualification-baselines/QB-CSVRC-1181-0001.json
OWNER_QUALIFICATION_BASELINE_STATUS: SATISFIED_BY_PREWORK_QSET_PENDING_VALIDATION
