ISSUE_BASIS_ID: IB-SUPPORT-PRIMARY-1222-0001
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1222
ISSUE_SOURCE: https://github.com/reallaksh19/XML_Compare_Utilities/issues/1222
ISSUE_SOURCE_SNAPSHOT_AT: 2026-09-15T10:29:56Z owner instruction captured in issue #1222
PREVIOUS_ISSUE_BASIS: NONE
CHANGE_AUTHORITY: INITIAL_CAPTURE
ISSUE_BASIS_STATUS: CURRENT
COMMON_PROTOCOL: engineering-pr-delivery-v2
COMMON_PROTOCOL_BASIS: fed57820909f4984a97d67437340df952b73a5ab
COMMON_PROTOCOL_STATUS: CURRENT
HANDOVER_PROTOCOL_VERSION: 2
CHAIN_STATE_VERSION: 3
WORK_ITEM_SOURCE: GITHUB_ISSUE
WORK_ITEM_MODE: EXCLUSIVE
AGENT_INSTANCE_ID: chatgpt:dc64d516-9c68-47d5-98f5-64cc74bb093c
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE

# Mission

Replace Support Report's flat location-first inference with an auditable hierarchical primary-support assembly seam. Optional Clash-within-Supports XML may establish support-member connectivity; canonical staged Support/Steel evidence remains authoritative for carrier/steel relationships; geometry remains fallback/reconciliation evidence. Downstream Support Report counting and Column 22 typicality consume stable assembly IDs.

# Original task / acceptance ledger

| ID | Owner requirement | Status | Source |
|---|---|---|---|
| TASK-001 | Rename user-facing `Pipe supported at multiple locations` to `Multiple primary support`, with assembly-count semantics | OPEN | issue #1222 §2 |
| TASK-002 | Reuse Legacy `Clash within Supports XML` logic as optional member-to-member relationship evidence | OPEN | issue #1222 §§5-6 |
| TASK-003 | Preserve #1216 Support/Steel producer authority; do not create a second support-to-steel resolver | OPEN | issue #1222 §13 |
| TASK-004 | Add exact ancestor-based two-column multi-select zone scope for primary/piping and secondary/support zones | OPEN | issue #1222 §7 |
| TASK-005 | Introduce deterministic `SupportPrimaryRelationshipBundle.v1` and stable assembly IDs | OPEN | issue #1222 §4 |
| TASK-006 | Add conservative orphan resolver: 1x axial, 2x lateral, Same Family/PIPE/Bore gates configurable ON by default, unique target mandatory | OPEN | issue #1222 §10 |
| TASK-007 | Migrate `TOTAL SUPPORT POINTS ON SECONDARY` to distinct countable primary-support assembly IDs with fallback compatibility | OPEN | issue #1222 §9 |
| TASK-008 | Add `RELATIONSHIP_TOPOLOGY_V1` as an independent Column 22 matcher and integrate only through consensus | OPEN | issue #1222 §11 |
| TASK-009 | Preserve and qualify real count/typicality benchmarks and negative controls without tolerance gaming | OPEN | issue #1222 §14 |
| TASK-010 | Leave crash-safe v2 custody, trace/debug provenance, browser/export qualification and Owner-only merge discipline | OPEN | issue #1222 §§15-16 |

# Input ledger

| ID | Input | Status | Authority / evidence |
|---|---|---|---|
| INPUT-001 | `benchmarks/1835.zip` / `1835.xml` Support Report clash evidence | AVAILABLE | repository benchmark; physical-location/count evidence |
| INPUT-002 | Owner workflow `Clash within Supports XML` carrying PS/SL member-to-member clashes | UNRESOLVED_FILE_LOCATOR | Owner-authorized optional Support Report connectivity evidence; production file not yet pinned |
| INPUT-003 | `SupportSteelRelationshipBundle.v1` / combined staged model JSON | AVAILABLE_CONTRACT / REAL_TARGET_INPUT_VARIABLE | canonical staged enrichment and carrier/steel authority owned by #1216 |
| INPUT-004 | Full Navis path ancestry including `/ASIM-...-CU-PI-*` and `/ASIM-...-CU-SU` | AVAILABLE_IN_XML | exact parent-hierarchy zone scope evidence |
| INPUT-005 | `benchmarks/11168.xml`, `benchmarks/14168.xml` | AVAILABLE | positive typicality control owned by #1179 |
| INPUT-006 | Existing bore-axis occurrence grouping merged by PR #1221 | AVAILABLE | fallback/reconciliation geometry authority |

# Benchmark / oracle ledger

| ID | Benchmark / oracle | Status | Authority |
|---|---|---|---|
| BM-001 | PS-11167 expected primary-support count = 6 | NOT_RUN | Owner benchmark requirement, issue #1222 |
| BM-002 | PS-11236 expected primary-support count = 4; `.4 + .5 + DATUM` is one assembly | NOT_RUN | Owner benchmark requirement, issue #1222 |
| BM-003 | PS-12060 expected count = 1 | NOT_RUN | previously governed benchmark |
| BM-004 | PS-12877 expected count = 4; return/revisit over-merge control | NOT_RUN | previously governed benchmark |
| BM-005 | PS-12860 expected count = 6 | NOT_RUN | previously governed benchmark |
| BM-006 | PS-12120 expected count = 14 | NOT_RUN | established independent Support Report control |
| BM-007 | 11168 -> 14168 remains typical | NOT_RUN | #1179 positive control |
| BM-008 | Explicit different assembly IDs at coincident/similar XYZ remain separate | NOT_RUN | required negative control |
| BM-009 | Orphan with >1 compatible target remains ambiguous | NOT_RUN | required negative control |
| BM-010 | DATUM-only/symbolic nodes do not create countable primary support | NOT_RUN | required negative control |

# Roadmap ledger

| ID | Locator | Class | Role | Status / authority |
|---|---|---|---|---|
| RM-001 | github:reallaksh19/XML_Compare_Utilities#1154 | ISSUE_EXECUTION_PLAN / PROGRAM_ROOT | parent Support Report roadmap | ALIGNED; not Owner Roadmap |
| RM-002 | github:reallaksh19/XML_Compare_Utilities#1179 | ISSUE_EXECUTION_PLAN | existing typicality child | ALIGNED; preserve independent matcher design |
| RM-003 | github:reallaksh19/XML_Compare_Utilities#1215 | ISSUE_EXECUTION_PLAN / architecture recovery | release/runtime and canonical-domain authority program | ALIGNED |
| RM-004 | github:reallaksh19/XML_Compare_Utilities#1216 | ISSUE_EXECUTION_PLAN / producer authority | canonical Support/Steel producer boundary | ALIGNED_WITH_EXPLICIT_BOUNDARY: no support-to-steel resolver duplication |
| RM-005 | github:reallaksh19/XML_Compare_Utilities#1222 | ISSUE_EXECUTION_PLAN | this bounded roadmap | CURRENT Owner-authorized execution plan |

No `docs/roadmaps/ROADMAP_REGISTRY.md` exists on current main; no separate repository Owner Roadmap was discovered for this domain.

# Owner qualification baseline

OWNER_QUALIFICATION_BASELINE_DISCOVERY: COMPLETE
OWNER_QUALIFICATION_BASELINE_SOURCE: NONE — current Owner instruction contains engineering requirements/benchmarks but no Owner-authored Q1-Q5 takeover exam
OWNER_QUALIFICATION_BASELINE_MANIFEST: NONE
OWNER_QUALIFICATION_BASELINE_STATUS: NOT_APPLICABLE

# Authority / no-patch boundaries

- Optional Clash-within-Supports XML may establish support-member connectivity only.
- #1216 retains Support/Steel carrier/steel relationship production authority.
- PS/SL Evidence Audit default production mode remains graph-native; its legacy XML mode remains validation/backward-compatibility.
- Geometry thresholds are not to be widened merely to obtain green benchmarks.
- UI/export cannot create engineering relationships.
- Missing/ambiguous evidence remains typed and fail-visible.
- No merge without fresh explicit Owner authorization.