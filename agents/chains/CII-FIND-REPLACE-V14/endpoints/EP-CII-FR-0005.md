# EP-CII-FR-0005 — Node Name implementation pre-mutation checkpoint

CHAIN_ID: CII-FIND-REPLACE-V14
LEG_ID: PR-NODENAME-V14
ENDPOINT_ID: EP-CII-FR-0005
PREVIOUS_ENDPOINT: EP-CII-FR-0004
CUSTODY_EPOCH: 5
ENDPOINT_REASON: Owner authorized merge of the foundation and `proceed next`; start the bounded first-priority Node Name implementation leg on merged main.
CHAIN_STATE_VERSION: 3
COMMON_PROTOCOL: engineering-pr-delivery-v2
COMMON_PROTOCOL_BASIS: 293a3db7993a6945c01adc592a7ff14a339c504a
COMMON_PROTOCOL_STATUS: CURRENT
PREWORK_QUALIFICATION_READY: TRUE
QUALIFICATION_PROFILE: FIXED_FORMAT_WRITER
QUALIFICATION_PROFILE_VERSION: 2
WORK_ITEM_SOURCE: OWNER_DIRECT
WORK_ITEM_KEY: owner-direct:XML_Compare_Utilities:CII-FIND-REPLACE-V14:NODENAME
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
OWNER_QUALIFICATION_BASELINE_SOURCE: Owner priority — Node Name first; owner then authorized merge and proceed next
OWNER_QUALIFICATION_BASELINE_MANIFEST: NONE
OWNER_QUALIFICATION_BASELINE_STATUS: SATISFIED
ROADMAPS: NONE — bounded owner-direct Node Name priority
ROADMAP_REVIEW_STATUS: NOT_APPLICABLE
ROADMAP_ALIGNMENT: NOT_APPLICABLE
ROADMAP_MUTATION_AUTHORITY: NONE
HANDOVER_PROTOCOL_VERSION: 2
HANDOVER_CONTENT_READY: TRUE
HANDOVER_VALIDATION_STATUS: PASS
HANDOVER_VALIDATION_EVIDENCE: merged foundation main 168a4c18c3c982fede54f236977526548bd98bcb + retained/source authority from EP-CII-FR-0004
HANDOVER_READY: TRUE
REPORTING_CONTRACT: ACTIVE_HANDOVER_FIRST
HANDOVER_RESPONSE_REQUIRED: ALWAYS
RESPONSE_DELTA_MODE: DELTA_ONLY
TASK / ISSUE: CII v14 Find & Replace; first priority Node Name
PR: PENDING
PR_STATUS: PENDING
MERGEABILITY: UNKNOWN
REVIEW_COUNT: 0
UNRESOLVED_REVIEW_THREADS: 0
REQUIRED_CHECKS_STATUS: NOT_RUN
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
BRANCH: feature/cii-find-replace-nodename-v14
CHECKPOINT_HEAD: 168a4c18c3c982fede54f236977526548bd98bcb
QUALIFICATION_BASIS_HEAD: 168a4c18c3c982fede54f236977526548bd98bcb
MAIN_HEAD_OBSERVED: 168a4c18c3c982fede54f236977526548bd98bcb
MERGE_BASE: 168a4c18c3c982fede54f236977526548bd98bcb
STATE: ACTIVE
ENGINEERING_STATE: READY
CUSTODY_STATE: HELD
QUALIFICATION_STATE: NOT_REQUIRED
WRITE_AUTHORITY: WRITE_ALLOWED
AUTO_STATE: NOT_APPLICABLE

### Mission

Implement native-v14 Find & Replace for the semantic Node Name fields only, using exact TARGET0 physical ownership and equal-width fixed-field claims.

### This leg completed

- Foundation delivered to main through transport PR #1066 at merge commit `168a4c18...`.
- Fresh branch `feature/cii-find-replace-nodename-v14` created from that exact main.
- Same-custodian progression remains within the current Node Name qualification scope.

### Currently in progress

Pre-mutation checkpoint for one coherent Node Name implementation batch.

### Remaining work

1. Admit `NODENAME` at CSV/manual block intake while FORCE stays blocked.
2. Resolve exact element -> row13 item6 -> 1-based NODENAME row -> exact endpoint field.
3. Validate CONTROL NONAM/cardinality, pointer range, ASCII field custody and distinct-node owner ambiguity.
4. Build whole-field padded equal-width claims for exact trimmed semantic matches.
5. Enable NODE NAME in the UI; FORCE remains disabled.
6. Add focused synthetic and retained-real SOURCE3 tests.
7. Record validation truth, material receipt and successor endpoint.

### Exact next action

Open the Draft successor PR after this checkpoint commit, then implement the bounded Node Name product/test batch; stop on ownership ambiguity, source-authority contradiction, unrelated-byte mutation, or required scope expansion.

### Known / proven

- ELEMENT block = 15 rows.
- ELEMENT row13 sixth numeric item is the 1-based NODENAME pointer.
- NODENAME FROM field = `[2,28)` width 26; TO = `[28,53)` width 25.
- Native-v14 fixed-field authority retains NODENAME cardinality = 1 row/unit and the same pointer identity.
- Retained SOURCE3 has `20020 -> 20030`, pointer `1`, row1 TO name `PS-12146`.
- Existing executor/postimage logic accepts equal-width TARGET0-relative physical claims and need not change.

### Not proven

- Node Name production path has not yet been implemented or executed.
- Native-v14 retained runtime remains NOT_RUN.
- Full repository suite remains NOT_RUN.

### NOT_RUN

Node Name implementation tests, native-v14 retained mutation, full repository regression and external CAESAR acceptance.

### Active hypothesis

A specialized NODENAME resolver + whole-field validator claim path is sufficient; executor/session/output do not require semantic Node Name logic.

### Falsifier

Any retained or synthetic case showing pointer/cardinality ambiguity, distinct node IDs sharing one physical field, non-ASCII/overflow acceptance, or bytes outside the authorized field changing invalidates the patch.

### Protected invariants

- TARGET0 is immutable claim authority.
- File length and line endings unchanged.
- CONTROL NONAM unchanged.
- ELEMENT NODENAME pointers unchanged.
- NODENAME row count unchanged.
- Only the selected exact owned FROM/TO field may change.
- FORCE remains fail-closed.
- Writer1/Writer2, converters, benchmarks/oracles/tolerances/workflows and topology unchanged.
- Direct source overwrite remains disabled.
- Merge remains Owner-only.

### Expected next-leg files / domains

Production: Find & Replace CSV intake, scope resolver, validator and UI only; an isolated Node Name helper is permitted only if needed to keep fixed-format logic bounded. Tests: scope resolver, validator, session, UI registration and retained-real.

### Inputs

Merged foundation on `main`; retained `Benchmark/CIICompare/SOURCE 3.CII`; current repository NODENAME physical custody; pinned v14 authority.

### Benchmarks

Retained SOURCE3 isolating oracle: `20020 -> 20030`, pointer 1, NODENAME row1 TO=`PS-12146`; rename target `NODE-20030`.

### Common / governing documents

Current `engineering-pr-delivery-v2@293a3db7993a6945c01adc592a7ff14a339c504a`; repository `AGENTS.md` overlay.

### Authoritative sources

`cii-workspace-nodename.js`; `cii-workspace-v14-writer2-fixed-field-authority.js`; pinned `3D_Converters` V11/V14 profile source; retained SOURCE3.

### Production paths

`tabs/cii-workspace/cii-workspace-find-replace-csv.js`
`tabs/cii-workspace/cii-workspace-find-replace-scope-resolver.js`
`tabs/cii-workspace/cii-workspace-find-replace-validator.js`
`tabs/cii-workspace/cii-workspace-find-replace.js`

### Validation / test paths

`tests/cii-workspace-find-replace-scope-resolver.test.js`
`tests/cii-workspace-find-replace-validator.test.js`
`tests/cii-workspace-find-replace-session.test.js`
`tests/cii-workspace-find-replace-ui-registration.test.js`
`tests/cii-workspace-find-replace-retained-real.test.js`

### Changed during this leg

This pre-mutation endpoint only.

### Validation summary

Protocol/state/source reconciliation: PASS / source and artifact inspection. Product/runtime validation: NOT_RUN.

### Open risks / questions

Native-v14 archive runtime remains unavailable; qualification must therefore preserve the distinction between authoritative source compatibility and retained-real V11 execution evidence.

### Next-agent qualification

Current question pack `CII-FR-QS-0001` is reused unchanged for takeover only.

### Takeover qualification pack

Q1 Production Trace — trace approved NODENAME operation through intake, exact element/pointer/field resolution, validation claim, executor and postimage.
Q2 Failure Isolation — reproduce SOURCE3 `20020 -> 20030`, pointer 1, TO=`PS-12146`; identify the first wrong boundary on mismatch.
Q3 Authority / Invariant — identify fixed-field and v14 pointer/cardinality authorities and protected unchanged bytes.
Q4 Independent Validation — reconstruct the exact 25-byte TO-field claim for `PS-12146 -> NODE-20030` and ambiguity/overflow falsifiers.
Q5 Minimal Patch — bound changes to NODENAME intake/resolution/claim/UI + focused tests; preserve FORCE, Writer1/Writer2, executor/output and direct overwrite boundaries.
