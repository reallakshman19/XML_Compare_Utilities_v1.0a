CHAIN_STATE_VERSION: 3
HANDOVER_PROTOCOL_VERSION: 2
CHAIN_ID: SUPPORT-PRIMARY-1222
ENDPOINT_ID: EP-SUPPORT-PRIMARY-1222-0001
PREVIOUS_ENDPOINT: NONE
WORK_ITEM_SOURCE: GITHUB_ISSUE
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1222
WORK_ITEM_MODE: EXCLUSIVE
AGENT_INSTANCE_ID: chatgpt:dc64d516-9c68-47d5-98f5-64cc74bb093c
COMMON_PROTOCOL: engineering-pr-delivery-v2
COMMON_PROTOCOL_BASIS: fed57820909f4984a97d67437340df952b73a5ab
COMMON_PROTOCOL_STATUS: CURRENT
ISSUE_BASIS_ID: IB-SUPPORT-PRIMARY-1222-0001
ISSUE_CURRENT_STATE_FILE: agents/chains/SUPPORT-PRIMARY-1222/issue-state/CURRENT.md
MAIN_OBSERVED: 242fc1b1df7e398b64e15a1fd3e2f87d1ff5b581
BRANCH: feature/support-primary-assembly-graph
MATERIAL_HISTORY_ROOT_BASE: 242fc1b1df7e398b64e15a1fd3e2f87d1ff5b581
PREWORK_QUALIFICATION_READY: TRUE
MATERIAL_LEG_PREWORK_ENDPOINT_FILE: agents/chains/SUPPORT-PRIMARY-1222/endpoints/EP-SUPPORT-PRIMARY-1222-0001.md
ENGINEERING_STATE: READY
CUSTODY_STATE: HELD
QUALIFICATION_STATE: NOT_REQUIRED
WRITE_AUTHORITY: WRITE_ALLOWED
AUTO_STATE: NOT_APPLICABLE
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
COORDINATION_STATE: SAFE
DEPENDENCIES: #1154 parent; #1179 typicality; #1216 producer authority; #1215 release/runtime program

# Scope admitted for next material leg

The next bounded material leg is limited to the first slice from issue #1222:

1. user-facing semantic rename `Pipe supported at multiple locations` -> `Multiple primary support` while retaining backward trace evidence;
2. shared support-member pair parser seam that can retain explicit member connectivity without requiring pipe context, without changing PS/SL legacy wrapper semantics unless explicitly tested;
3. pure deterministic primary-support connected-component / assembly-ID builder;
4. focused tests for explicit connectivity, DATUM non-countability and explicit-component non-merge safety;
5. no migration of `TOTAL SUPPORT POINTS ON SECONDARY` or Column 22 decision authority in this material leg.

# Authority reconciliation

- #1216 remains owner of Support/Steel carrier/steel relationship production semantics.
- Optional Clash-within-Supports XML under #1222 is authorized only for Support Report support-member connectivity.
- PS/SL Evidence Audit default graph-native mode is unchanged.
- Existing bore-axis occurrence logic from merged PR #1221 remains fallback/reconciliation authority and is not retuned in this slice.
- Active PR #1219 changes chain/docs/fixture/authority-test files and has no exact production-file overlap with the first slice; semantic authority dependency is preserved.

# Owner roadmap / plan state

No repository `docs/roadmaps/ROADMAP_REGISTRY.md` was found. Applicable execution plans #1154, #1179, #1215, #1216 and #1222 were reviewed. They are aligned for this bounded slice under the current Owner instruction. No roadmap mutation is authorized or required.

# Qualification state

QUALIFICATION_SCOPE_ID: QSCOPE-SUPPORT-PRIMARY-1222-ASSEMBLY-SEAM
QUESTION_SET_ID: QS-SUPPORT-PRIMARY-1222-0001
QUESTION_SET_FILE: agents/qualifications/SUPPORT-PRIMARY-1222/QS-SUPPORT-PRIMARY-1222-0001.md
QUESTION_SET_STATUS: CURRENT
QUESTION_PACK_ACTION: REFRESHED_INITIAL
OWNER_QUALIFICATION_BASELINE_DISCOVERY: COMPLETE
OWNER_QUALIFICATION_BASELINE_STATUS: NOT_APPLICABLE
TAKEOVER_QUALIFICATION_READY: TRUE

This is an originating-custodian prework endpoint, not a takeover. Future replacement custody must perform normal admission/qualification before writes.

# Validation truth

- Common protocol/reference grounding: PASS by source inspection.
- Repository overlay grounding: PASS by source inspection.
- Exact work-item collision search for #1222: PASS, no pre-existing canonical chain found.
- Current main reconciliation: PASS, main `242fc1b1...` observed.
- Active PR overlap reconciliation: PASS for first-slice exact paths; #1216 authority dependency retained.
- Product/domain tests for #1222: NOT_RUN.
- Real Owner Clash-within-Supports input for 1835: NOT_RUN / INPUT-002 locator unresolved.

# Current hypothesis and falsifier

Hypothesis: explicit support-member connectivity can be modeled as deterministic family-scoped connected components without granting carrier/steel authority, then later reconciled with geometric occurrence evidence.

Falsifier: if retaining a member-pair edge without pipe context necessarily alters existing PS/SL legacy report semantics or creates carrier/steel truth, the parser change must be split lower into a shared raw member-edge primitive while the legacy wrapper keeps its current behavior.

# Exact next action

Synchronize this prework endpoint to issue #1222 control-plane comments. Then begin the first material slice only. First material commit must occur strictly after this endpoint commit.