# EP-CII-FR-0006 — Node Name implementation checkpoint

CHAIN_ID: CII-FIND-REPLACE-V14
LEG_ID: PR1067-NODENAME-V14
ENDPOINT_ID: EP-CII-FR-0006
PREVIOUS_ENDPOINT: EP-CII-FR-0005
CUSTODY_EPOCH: 6
ENDPOINT_REASON: Freeze first-priority Node Name implementation after coherent product/test batch and source/runtime qualification available in current substrate.
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
OWNER_QUALIFICATION_BASELINE_SOURCE: Owner priority — Node Name first; owner authorized foundation merge and bounded continuation
OWNER_QUALIFICATION_BASELINE_MANIFEST: NONE
OWNER_QUALIFICATION_BASELINE_STATUS: SATISFIED
ROADMAPS: NONE — bounded owner-direct Node Name priority
ROADMAP_REVIEW_STATUS: NOT_APPLICABLE
ROADMAP_ALIGNMENT: NOT_APPLICABLE
ROADMAP_MUTATION_AUTHORITY: NONE
HANDOVER_PROTOCOL_VERSION: 2
HANDOVER_CONTENT_READY: TRUE
HANDOVER_VALIDATION_STATUS: PASS
HANDOVER_VALIDATION_EVIDENCE: agents/chains/CII-FIND-REPLACE-V14/material-legs/ML-CII-FR-0001.md
HANDOVER_READY: TRUE
REPORTING_CONTRACT: ACTIVE_HANDOVER_FIRST
HANDOVER_RESPONSE_REQUIRED: ALWAYS
RESPONSE_DELTA_MODE: DELTA_ONLY
TASK / ISSUE: CII v14 Find & Replace; first priority Node Name
PR: 1067
PR_STATUS: OPEN_DRAFT
MERGEABILITY: MERGEABLE
REVIEW_COUNT: 0
UNRESOLVED_REVIEW_THREADS: 0
REQUIRED_CHECKS_STATUS: NOT_RUN
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
BRANCH: feature/cii-find-replace-nodename-v14
CHECKPOINT_HEAD: 72e17a743baa198edaedbbf730d400e3d82c79a6
QUALIFICATION_BASIS_HEAD: 72e17a743baa198edaedbbf730d400e3d82c79a6
MAIN_HEAD_OBSERVED: 168a4c18c3c982fede54f236977526548bd98bcb
MERGE_BASE: 168a4c18c3c982fede54f236977526548bd98bcb
STATE: ACTIVE
ENGINEERING_STATE: READY
CUSTODY_STATE: HELD
QUALIFICATION_STATE: NOT_REQUIRED
WRITE_AUTHORITY: WRITE_ALLOWED
AUTO_STATE: NOT_APPLICABLE

### Mission

Deliver semantic Node Name Find & Replace using exact TARGET0 fixed-field custody while leaving FORCE, Writer1/Writer2 and direct overwrite unchanged.

### This leg completed

- Added NODENAME block intake aliases while keeping FORCE blocked.
- Added isolated read-only NODENAME scope helper.
- Added CONTROL count and global pointer-owner validation.
- Added exact NODENAME FROM/TO field spans and distinct-node alias rejection.
- Added semantic exact-name matching with ASCII/field-width enforcement.
- Added complete fixed-width padded replacement claims.
- Enabled NODE NAME in the UI.
- Added synthetic and retained-real regression tests.
- Existing executor/postimage/output modules were not changed.

### Currently in progress

Execution qualification of the authored tests on an exact checkout.

### Remaining work

1. Run new Node Name test on exact PR checkout.
2. Run retained-real SOURCE3 test on exact PR checkout.
3. Run complete Find & Replace test group and then broader repository suite as available.
4. Isolate and patch only the first authored failure if a test fails.
5. Keep native-v14 retained ZIP runtime and external CAESAR acceptance explicitly NOT_RUN until executed.

### Exact next action

Run the Node Name and retained-real test files on an exact checkout of PR #1067, followed by the complete Find & Replace test group. Do not expand scope on failure; isolate the first wrong boundary.

### Known / proven

- Material implementation head is `72e17a743baa198edaedbbf730d400e3d82c79a6`.
- PR branch is based directly on merged foundation main `168a4c18...`.
- SOURCE3 CONTROL reports NONAM=186.
- SOURCE3 element `20020 -> 20030` has NODENAME pointer 1.
- SOURCE3 NODENAME row1 TO field is `PS-12146`.
- SOURCE3 physical NODENAME row count is 186.
- Local reconstructed module execution passes the synthetic Node Name ownership/claim/executor falsifiers.

### Not proven

- Authored tests have not run from an exact private checkout.
- Native-v14 retained mutation runtime has not run.
- Full repository regression has not run.
- External CAESAR acceptance has not run.

### NOT_RUN

Exact-checkout Node Name/retained-real/complete suite, native-v14 retained mutation, full repository suite and external CAESAR acceptance.

### Active hypothesis

The implementation is complete at the ownership/claim boundary; remaining risk is execution-substrate integration rather than unresolved authority design.

### Falsifier

Any exact-checkout result showing wrong pointer/cardinality handling, owner ambiguity leakage, incorrect field width/offset, unrelated postimage mutation, session/UI integration failure, or FORCE/direct-overwrite widening invalidates the implementation.

### Protected invariants

TARGET0 immutable authority; equal total length; line endings unchanged; CONTROL NONAM unchanged; ELEMENT NODENAME pointers unchanged; NODENAME cardinality unchanged; unrelated bytes unchanged; FORCE fail-closed; Writer1/Writer2 and converters unchanged; direct overwrite disabled; merge Owner-only.

### Do not redo

Do not repeat NODENAME format archaeology unless execution produces evidence contradicting the recorded authority.

### Do not change

Do not change executor/output, Writer1/Writer2, `cii-workspace-nodename.js`, converters, FORCE authority, topology, benchmarks/oracles/tolerances/workflows or direct overwrite during execution qualification.

### Expected next-leg files / domains

Normally no product change if tests pass. On failure, modify only the first isolated Node Name boundary and its focused test.

### Owner roadmaps

NONE — direct Owner priority.

### Inputs

Merged foundation, current Node Name implementation, SOURCE3 retained CII, fixed-field parser and existing independent executor/postimage validator.

### Benchmarks

SOURCE3 `20020 -> 20030`, pointer 1, NODENAME row1 TO `PS-12146`, expected rename `NODE-20030` with complete 25-byte TO-field claim.

### Common / governing documents

Current Common `engineering-pr-delivery-v2@293a3db7993a6945c01adc592a7ff14a339c504a`; repository AGENTS overlay.

### Authoritative sources

`cii-workspace-nodename.js`; `cii-workspace-v14-writer2-fixed-field-authority.js`; pinned V11/V14 converter profile; retained SOURCE3.

### Production paths

`cii-workspace-find-replace-csv.js`; `cii-workspace-find-replace-nodename-scope.js`; `cii-workspace-find-replace-scope-resolver.js`; `cii-workspace-find-replace-validator.js`; `cii-workspace-find-replace.js`.

### Validation / test paths

`tests/cii-workspace-find-replace-nodename.test.js`; `tests/cii-workspace-find-replace-retained-real.test.js`; existing Find & Replace tests.

### Changed during this leg

See `ML-CII-FR-0001.md` for the exact product/test file ledger.

### Validation summary

Source authority and local reconstructed focused execution PASS. Exact-checkout and full-suite execution remain NOT_RUN.

### Open risks / questions

Only exact runtime integration and native-v14 retained execution remain open; no scope expansion is justified by current evidence.

### Next-agent qualification

Reuse `CII-FR-QS-0001` for takeover while the technical boundary remains Node Name fixed-field rename.

### Takeover qualification pack

Q1 Production Trace — trace approved NODENAME operation through intake, exact element/pointer/field resolution, validation claim, executor and postimage.
Q2 Failure Isolation — reproduce SOURCE3 `20020 -> 20030`, pointer 1, TO=`PS-12146`; identify first wrong boundary on mismatch.
Q3 Authority / Invariant — identify fixed-field and v14 pointer/cardinality authorities and protected unchanged bytes.
Q4 Independent Validation — reconstruct exact 25-byte TO-field claim for `PS-12146 -> NODE-20030` and ambiguity/overflow falsifiers.
Q5 Minimal Patch — if execution fails, patch only the first isolated Node Name boundary; preserve FORCE, Writer1/Writer2, executor/output and direct overwrite.
