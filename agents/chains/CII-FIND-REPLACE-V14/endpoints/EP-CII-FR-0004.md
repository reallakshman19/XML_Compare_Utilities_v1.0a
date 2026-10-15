# EP-CII-FR-0004 — Adopt current protocol and unblock Node Name bounded progression

CHAIN_ID: CII-FIND-REPLACE-V14
LEG_ID: PR1065-NODENAME-FIRST
ENDPOINT_ID: EP-CII-FR-0004
PREVIOUS_ENDPOINT: EP-CII-FR-0003
CUSTODY_EPOCH: 4
ENDPOINT_REASON: Owner requested workflow and plan revision after the legacy pinned takeover gate incorrectly blocked the same active custodian.
CHAIN_STATE_VERSION: 3
COMMON_PROTOCOL: engineering-pr-delivery-v2
COMMON_PROTOCOL_BASIS: 293a3db7993a6945c01adc592a7ff14a339c504a
COMMON_PROTOCOL_STATUS: CURRENT
PREWORK_QUALIFICATION_READY: TRUE
QUALIFICATION_PROFILE: FIXED_FORMAT_WRITER
QUALIFICATION_PROFILE_VERSION: 2
WORK_ITEM_SOURCE: OWNER_DIRECT
WORK_ITEM_KEY: owner-direct:XML_Compare_Utilities:PR1065:CII-FIND-REPLACE-V14:NODENAME
WORK_ITEM_MODE: EXCLUSIVE
AGENT_INSTANCE_ID: chatgpt:80d7024f-7775-4281-bc05-fe610b044e8f
OWNER_PROGRESSION_COMMAND: PROCEED_NEXT
QUALIFICATION_SCOPE_ID: QSCOPE-PR1065-NODENAME-FIXED-FIELD-RENAME
QUESTION_SET_ID: CII-FR-QS-0001
QUESTION_SET_STATUS: CURRENT
QUESTION_PACK_ACTION: REUSED
QUESTION_DISPLAY: HIDE
CHAIN_HANDOVER_READY: TRUE
TAKEOVER_QUALIFICATION_READY: TRUE
OWNER_QUALIFICATION_BASELINE_DISCOVERY: COMPLETE
OWNER_QUALIFICATION_BASELINE_SOURCE: conversation owner priority — Node Name first
OWNER_QUALIFICATION_BASELINE_MANIFEST: NONE
OWNER_QUALIFICATION_BASELINE_STATUS: SATISFIED
ROADMAPS: NONE — owner-direct bounded task; no separate roadmap identified
ROADMAP_REVIEW_STATUS: NOT_APPLICABLE
ROADMAP_ALIGNMENT: NOT_APPLICABLE
ROADMAP_MUTATION_AUTHORITY: NONE
HANDOVER_PROTOCOL_VERSION: 2
HANDOVER_CONTENT_READY: TRUE
HANDOVER_VALIDATION_STATUS: PASS
HANDOVER_VALIDATION_EVIDENCE: live PR/source reconciliation plus preserved legacy relay artifacts
HANDOVER_READY: TRUE
REPORTING_CONTRACT: ACTIVE_HANDOVER_FIRST
HANDOVER_RESPONSE_REQUIRED: ALWAYS
RESPONSE_DELTA_MODE: DELTA_ONLY
TASK / ISSUE: CII v14 Find & Replace; first priority Node Name
PR: 1065
PR_STATUS: OPEN_DRAFT
MERGEABILITY: MERGEABLE
REVIEW_COUNT: 1 COMMENT_ONLY
UNRESOLVED_REVIEW_THREADS: 0
REQUIRED_CHECKS_STATUS: NOT_RUN
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
BRANCH: feature/cii-find-replace-icon-v14
CHECKPOINT_HEAD: 014eb8c9cbd9cb73dfcf6e4e86d5b751e7f45445
QUALIFICATION_BASIS_HEAD: e28e33aa9e7927d2d8e7f5532660108eb1fe4b7b
MAIN_HEAD_OBSERVED: d35f6aa419244585afec2c47c8fbd0584011931a
MERGE_BASE: d35f6aa419244585afec2c47c8fbd0584011931a
STATE: ACTIVE
ENGINEERING_STATE: READY
CUSTODY_STATE: HELD
QUALIFICATION_STATE: NOT_REQUIRED
WRITE_AUTHORITY: WRITE_ALLOWED
AUTO_STATE: NOT_APPLICABLE

### Active handover snapshot

Repo: reallaksh19/XML_Compare_Utilities
Task: Native-v14 CII Find & Replace; Node Name first
Chain: CII-FIND-REPLACE-V14
Endpoint: EP-CII-FR-0004
PR: #1065 Draft/open
PR status: mergeable; no merge authorization
Branch / PR head / main: feature/cii-find-replace-icon-v14 / 014eb8c9... / d35f6aa...
Mergeability: MERGEABLE
Reviews: one COMMENT handoff created under obsolete takeover interpretation; no approval
Unresolved review threads: 0
Required checks: NOT_RUN / no attached Actions run
Merge authority: OWNER_ONLY
Merge authorized: FALSE
Engineering / custody / qualification / write state: READY / HELD / NOT_REQUIRED / WRITE_ALLOWED
AUTO: NOT_APPLICABLE
Protocol basis / status: Common@293a3db7993a6945c01adc592a7ff14a339c504a / CURRENT
Work item / source: owner-direct:XML_Compare_Utilities:PR1065:CII-FIND-REPLACE-V14:NODENAME / OWNER_DIRECT
Issue basis: NOT_APPLICABLE
Owner roadmap(s): Node Name first
Other governing roadmaps: NONE
Roadmap alignment / drift: NOT_APPLICABLE
Roadmap mutation authority: NONE
Original task status: Find & Replace foundation delivered; Node Name is first priority enhancement
Inputs: CII v14 target; CSV/manual From, To, Find Text, Replace Text, Block=NODENAME
Benchmarks / oracles: retained Benchmark/CIICompare/SOURCE 3.CII plus fixed-field NODENAME custody and pinned v11/v14 record-shape authority
Qualification: current custodian; takeover qualification NOT_REQUIRED
Scope: QSCOPE-PR1065-NODENAME-FIXED-FIELD-RENAME
Question set: CII-FR-QS-0001
Question status: CURRENT
Question action: REUSED
Takeover qualification ready: TRUE
Chain handover ready: TRUE
Current blocker: none for bounded Node Name implementation; native-v14 execution substrate remains a validation limitation, not a coding-authority blocker
Leg diagnosis: prior verifier deadlock came from applying old incoming-takeover rules to the same active custodian; current Common explicitly separates same-custodian progression from replacement takeover
Exact next action: implement the bounded Node Name Find & Replace patch and focused retained-real falsifiers only; preserve FORCE and direct overwrite fail-closed.

### Mission

Deliver native-v14 Find & Replace of existing Node Name fields as the first priority semantic scope, with exact TARGET0 fixed-field custody and no Writer1/Writer2 execution dependency.

### This leg completed

- Re-grounded live `Common/main` at `293a3db7993a6945c01adc592a7ff14a339c504a`.
- Confirmed current protocol recognizes exactly three Owner progression commands and allows the current custodian to complete one bounded Owner-authorized progression without takeover qualification.
- Closed obsolete Common Draft PR #107 because current Common already contains the required same-custodian progression model.
- Reclassified this leg from incoming takeover to continuous current custody.
- Reused existing Node Name qualification scope/question pack for future takeover readiness; questions remain hidden this progression.

### Currently in progress

Bounded Node Name implementation is the next material batch.

### Remaining work

1. Admit `NODENAME` in BLOCK intake while FORCE remains blocked.
2. Resolve exact `From/To -> 15-row ELEMENT -> row13 item6 -> NODENAME row` ownership.
3. Restrict mutation spans to exact NODENAME FROM `[2,28)` or TO `[28,53)` field.
4. Require exact trimmed semantic match, ASCII replacement, and replacement length <= field width.
5. Build full-field equal-width claims by right-padding replacement.
6. Add UI `NODE NAME` option.
7. Add retained-real SOURCE3 and synthetic falsifiers.
8. Run focused tests where executable substrate permits; retain NOT_RUN otherwise.

### Exact next action

Implement one coherent Node Name batch limited to the authorized production/test files below, then create a material-leg receipt and successor endpoint.

### Known / proven

- NODENAME physical row has FROM `[2,28)` width 26 and TO `[28,53)` width 25 under existing custody code.
- ELEMENT row13 item6 is the 1-based NODENAME row pointer.
- Native-v14 fixed-field authority retains NODENAME pointer/cardinality identity and pinned converter authority states NODENAME string record shape is compatible between qualified V11/V14 profiles.
- Retained SOURCE3 element `20020 -> 20030` has NODENAME pointer `1`; NODENAME row 1 TO is `PS-12146`.
- Existing executor can remain unchanged if validator emits equal-width physical claims.

### Not proven

- Native-v14 runtime execution of Node Name Find & Replace remains NOT_RUN.
- External CAESAR acceptance remains NOT_RUN.
- Current-head complete repository suite remains NOT_RUN.

### NOT_RUN

- native-v14 retained Node Name runtime;
- full repository suite;
- external CAESAR acceptance.

### Active hypothesis

A dedicated NODENAME BLOCK resolver plus specialized full-field validator claim builder is sufficient; executor/session/output need no change.

### Falsifier

If retained SOURCE3 does not resolve `20020 -> 20030 -> pointer 1 -> row1 TO=PS-12146`, or any postimage byte outside the owned fixed field changes, stop and revert the Node Name production batch.

### Protected invariants

- immutable TARGET0/source hash custody;
- exact total file length;
- NODENAME row count unchanged;
- CONTROL NONAM unchanged;
- ELEMENT NODENAME pointers unchanged;
- line endings unchanged;
- unrelated bytes unchanged;
- FORCE remains fail-closed;
- Writer1/Writer2 untouched and uninvolved;
- direct overwrite remains disabled;
- benchmarks/oracles/tolerances/workflows unchanged;
- merge remains Owner-only.

### Do not redo

Do not repeat Node Name source archaeology unless material authority changes. Reuse the existing read-only trace and retained SOURCE3 reconstruction.

### Do not change

Do not change Writer1/Writer2, `cii-workspace-nodename.js`, converter sources, benchmarks/oracles, FORCE authority, topology, workflows, output overwrite controls, or generic executor unless a falsifier proves the bounded design insufficient.

### Expected next-leg files / domains

Production:
- `tabs/cii-workspace/cii-workspace-find-replace-csv.js`
- `tabs/cii-workspace/cii-workspace-find-replace-scope-resolver.js`
- `tabs/cii-workspace/cii-workspace-find-replace-validator.js`
- `tabs/cii-workspace/cii-workspace-find-replace.js`

Focused tests:
- `tests/cii-workspace-find-replace-scope-resolver.test.js`
- `tests/cii-workspace-find-replace-validator.test.js`
- `tests/cii-workspace-find-replace-session.test.js`
- `tests/cii-workspace-find-replace-ui-registration.test.js`
- `tests/cii-workspace-find-replace-retained-real.test.js`

### Owner roadmaps

Owner priority: Node Name first. No separate roadmap artifact identified for this bounded owner-direct task.

### Inputs

- PR #1065 current branch and material basis.
- `Benchmark/CIICompare/SOURCE 3.CII` retained-real source.
- Existing `cii-workspace-nodename.js` physical custody implementation.
- Existing v14 fixed-field authority and pinned converter record-shape evidence.

### Benchmarks

Primary retained-real falsifier: `Benchmark/CIICompare/SOURCE 3.CII`, element `20020 -> 20030`, pointer `1`, NODENAME row1 TO=`PS-12146`.

### Common / governing documents

- `reallaksh19/Common@293a3db7993a6945c01adc592a7ff14a339c504a/skills/engineering-pr-delivery-v2/SKILL.md`
- `references/owner-progression-commands.md`
- `references/authority-state-model.md`
- `references/agentchain-template.md`
- repository `AGENTS.md` project overlay.

### Authoritative sources

- `tabs/cii-workspace/cii-workspace-nodename.js` for exact NODENAME physical custody.
- `tabs/cii-workspace/cii-workspace-v14-writer2-fixed-field-authority.js` for v14 pointer/cardinality identities only.
- pinned `3D_Converters` v11/v14 adapter for compatible NODENAME string record shape.
- retained SOURCE3 for real element/pointer/name ownership falsifier.

### Production paths

Current Find & Replace intake -> preview/approval -> validator -> scope resolver -> immutable claim -> executor -> postimage validator -> qualified download.

### Validation / test paths

Focused Node Name scope/validator/session/UI/retained-real tests listed above. Full suite remains required before final PR completion where executable substrate permits.

### Changed during this leg

Workflow/relay metadata only. No Node Name product/test mutation is recorded in this endpoint.

### Validation summary

```text
CURRENT_COMMON_PROTOCOL        PASS / source inspection / authoritative reference
SAME_CUSTODIAN_CLASSIFICATION  PASS / protocol reconciliation
PR_BASE_DRIFT                  NONE / main d35f6aa unchanged
NODE_NAME_SOURCE_TRACE         PASS / source inspection
RETAINED_SOURCE3_ORACLE        PASS / source inspection
NODE_NAME_PRODUCT_IMPLEMENTATION NOT_RUN at endpoint creation
NATIVE_V14_RUNTIME             NOT_RUN
FULL_SUITE                     NOT_RUN
```

### Open risks / questions

The repository overlay still describes an older delivery path, but current Common policy explicitly states reusable policy is centralized in Common and downstream `AGENTS.md` is a project overlay. Project-specific backup/worklog requirements remain applicable when an executable filesystem substrate is available.

### Next-agent qualification

A replacement must use current Common takeover qualification. The current custodian does not self-qualify and does not need a verifier to continue this same bounded progression.

### Takeover qualification pack

PURPOSE: QUALIFICATION_ONLY
NOT_AN_IMPLEMENTATION_TASK: TRUE
QUALIFICATION_PROTOCOL_VERSION: 3
QUALIFICATION_PROFILE: FIXED_FORMAT_WRITER
QUALIFICATION_PROFILE_VERSION: 2
QUALIFICATION_BASIS_HEAD: e28e33aa9e7927d2d8e7f5532660108eb1fe4b7b
QUALIFICATION_SCOPE_ID: QSCOPE-PR1065-NODENAME-FIXED-FIELD-RENAME
QUESTION_SET_ID: CII-FR-QS-0001
QUESTION_SET_STATUS: CURRENT
QUESTION_SET_AUTHOR: legacy relay endpoint / preserved
QUESTION_SET_ADMISSION_REQUIREMENT: REQUIRED_ON_TAKEOVER
OWNER_QUALIFICATION_BASELINE_SOURCE: owner priority — Node Name first
OWNER_QUALIFICATION_BASELINE_MANIFEST: NONE
OWNER_QUALIFICATION_BASELINE_STATUS: SATISFIED

Q1: Trace approved NODENAME BLOCK intake through preview/session, preimage validation, exact element/pointer/field scope resolution, equal-width claim construction, executor, postimage validation and qualified output; identify the first wrong boundary.
Q2: Reconstruct retained SOURCE3 ownership for `20020 -> 20030`, pointer `1`, row1 TO=`PS-12146`; define pointer-zero/out-of-range/count/alias falsifiers.
Q3: Identify v14 NODENAME pointer/cardinality authority versus Find & Replace payload authority; state mutable and immutable bytes and reject global DOCUMENT replacement as an invalid shortcut.
Q4: Independently derive the 25-byte TO field claim for `PS-12146 -> NODE-20030`, including exact match, ASCII, right-padding, owner ambiguity and postimage invariants.
Q5: Specify the minimal bounded patch/test files, protected Writer/Force/output domains, rollback condition and NO-PATCH boundaries.
