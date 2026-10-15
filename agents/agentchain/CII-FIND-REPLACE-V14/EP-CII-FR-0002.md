# EP-CII-FR-0002 — Node Name candidate qualified for review, verifier pending

CHAIN_ID: CII-FIND-REPLACE-V14
LEG_ID: PR1065-NODENAME-FIRST
ENDPOINT_ID: EP-CII-FR-0002
PREVIOUS_ENDPOINT: EP-CII-FR-0001

CREATED_AT: 2026-09-02T10:06:00+04:00
ENDPOINT_REASON: QUALIFICATION_CANDIDATE_ANSWERED

TASK / ISSUE: CII v14 Find & Replace; owner priority = Node Name first
PR: #1065 — Add CII v14 Find & Replace UI, scoped validation and qualified download
BRANCH: feature/cii-find-replace-icon-v14

CHECKPOINT_HEAD: 377eac44f2a4d602af32563fb52c00e6372fe319
MAIN_HEAD_OBSERVED: d35f6aa419244585afec2c47c8fbd0584011931a
MERGE_BASE: d35f6aa419244585afec2c47c8fbd0584011931a
MATERIAL_BASIS_HEAD: e28e33aa9e7927d2d8e7f5532660108eb1fe4b7b

STATE: QUALIFICATION_REQUIRED
TAKEOVER_AUTHORITY: READ_ONLY
QUALIFICATION_STATUS: ANSWERED_VERIFIER_PENDING
ENGINEERING_CRITICAL_WRITE_AUTHORITY: FALSE
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
COORDINATION_STATE: COORDINATION_REQUIRED_NON_BLOCKING

### Mission

Deliver native-v14 Find & Replace of Node Name as the first qualified entity/block scope, with exact TARGET0 field custody and no Writer1/Writer2 execution dependency.

### This leg completed

- Created chain start endpoint EP-CII-FR-0001 before production mutation.
- Indexed the chain in `agents/agentchain.md`.
- Persisted the read-only authority trace in `agents/evidence/PR1065_nodename_find_replace_readonly_trace.md`.
- Candidate `GPT-5.6-SOL-2026-09-02-A` answered CII-FR-QS-0001 at `agents/qualifications/CII-FIND-REPLACE-V14/CII-FR-QS-0001-gpt56sol-answer.md`.
- Candidate answer reconciles live PR metadata drift to unchanged material basis `e28e33aa9e7927d2d8e7f5532660108eb1fe4b7b`.
- No verifier verdict exists. Candidate has made no authorization claim.
- No production/test/benchmark/oracle/workflow file has been modified under this chain.

### Currently in progress

Independent verification of CII-FR-QS-0001.

### Remaining work

1. Independent verifier evaluates the candidate answer against EP-CII-FR-0001 questions and material basis `e28e33aa...`.
2. Verifier writes a separate verdict artifact with `candidate_id != verifier_id`, total >= 92/100 and every question >= 17/20 for `PASS_WRITE_ALLOWED`.
3. If PASS, create a fresh pre-mutation endpoint if material state has drifted; then implement only the minimal NODENAME patch.
4. If FAIL/STALE, remain read-only and address only the verdict's specific deficiencies.
5. Preserve native-v14 runtime and repository test `NOT_RUN` state until actual execution occurs.

### Exact next action

An independent verifier must evaluate `agents/qualifications/CII-FIND-REPLACE-V14/CII-FR-QS-0001-gpt56sol-answer.md` against EP-CII-FR-0001 and write `agents/qualifications/CII-FIND-REPLACE-V14/CII-FR-QS-0001-gpt56sol-verdict.md`; until that artifact grants `PASS_WRITE_ALLOWED`, do not modify Find & Replace production or test files.

### Known / proven

- The current candidate answer contains a concrete production trace, retained-real isolating case, V14 authority split, independent fixed-field reconstruction, and minimal patch boundary.
- Current material production basis remains `e28e33aa...`; all commits after it in this relay are metadata/evidence only.
- Node Name physical ownership route is independently anchored to exact ELEMENT pointer and fixed NODENAME fields.
- The proposed whole-field-claim design preserves executor/postimage same-width invariants without executor changes.

### Not proven

- Candidate competence has not been independently verified.
- Engineering-critical write authority has not been granted.
- Proposed Node Name production behavior has not been authored or run.
- Native-v14 retained mutation execution remains NOT_RUN.

### NOT_RUN

- Independent verifier verdict: NOT_RUN / not available in current single-agent substrate.
- Node Name production implementation: NOT_RUN / not authorized.
- Node Name focused tests: NOT_RUN.
- Native-v14 Node Name mutation: NOT_RUN.
- Full repository regression: NOT_RUN.
- External CAESAR acceptance: NOT_RUN.

### Active hypothesis

The candidate's proposed minimal patch is sufficient: add `NODENAME` intake, exact pointer/field resolver, specialized fixed-width whole-field validator claims and UI option; executor/session/output remain unchanged. This hypothesis cannot authorize mutation until independent verification passes.

### Falsifier

A verifier finding that the candidate mis-traced ownership, silently borrowed Writer2 write authority, failed to protect alias ambiguity, or proposed an incomplete negative test set invalidates the patch plan. Material repository drift affecting NODENAME authority also makes the current question set stale.

### Protected invariants

- all EP-CII-FR-0001 protected invariants remain active;
- candidate cannot self-authorize;
- no production/test mutation before independent PASS_WRITE_ALLOWED;
- FORCE remains fail-closed;
- direct overwrite remains disabled;
- Writer1/Writer2 remain unchanged and uninvolved;
- no benchmark/oracle/tolerance/workflow mutation;
- `NOT_RUN` remains visible.

### Do not redo

Do not repeat the source-authority archaeology captured by EP-CII-FR-0001 and the candidate answer unless the material basis changes or the verifier identifies a specific gap.

### Do not change

Do not change production, tests, benchmarks, oracles, Writer1/Writer2, pinned converters, workflows, FORCE authority, topology, or direct-overwrite controls before independent verification.

### Expected next-leg files / domains

If and only if verifier grants write authority, expected production/test scope remains:

```text
tabs/cii-workspace/cii-workspace-find-replace-csv.js
tabs/cii-workspace/cii-workspace-find-replace-scope-resolver.js
tabs/cii-workspace/cii-workspace-find-replace-validator.js
tabs/cii-workspace/cii-workspace-find-replace.js

tests/cii-workspace-find-replace-scope-resolver.test.js
tests/cii-workspace-find-replace-validator.test.js
tests/cii-workspace-find-replace-session.test.js
tests/cii-workspace-find-replace-ui-registration.test.js
tests/cii-workspace-find-replace-retained-real.test.js
```

### Inputs

- EP-CII-FR-0001.
- Candidate answer `CII-FR-QS-0001-gpt56sol-answer.md`.
- Retained `Benchmark/CIICompare/SOURCE 3.CII`.
- PR1065 material basis `e28e33aa...`.

### Benchmarks

Same as EP-CII-FR-0001; no benchmark was changed or promoted.

### Common / governing documents

Same pinned `engineering-pr-delivery-v2` document set as EP-CII-FR-0001 at `reallaksh19/Common@10d667ce715bb52e1f73035c6fa326db77d0f9dd`.

### Authoritative sources

Same authority set as EP-CII-FR-0001. No new engineering source authority is introduced by the candidate answer.

### Production paths

Read-only only until verifier PASS. Expected minimal patch paths are listed above.

### Validation / test paths

- qualification verifier artifact is the immediate gate;
- retained SOURCE3 is the first post-write structural falsifier;
- focused Find & Replace tests remain NOT_RUN until authorized implementation exists.

### Changed during this leg

Relay/qualification metadata only:

```text
agents/qualifications/CII-FIND-REPLACE-V14/CII-FR-QS-0001-gpt56sol-answer.md
agents/agentchain/CII-FIND-REPLACE-V14/EP-CII-FR-0002.md
agents/agentchain.md   (latest endpoint update follows)
```

### Validation summary

```text
CANDIDATE_ANSWER_ARTIFACT      PASS / ARTIFACT_INSPECTION / present
MATERIAL_BASIS_RECONCILIATION PASS / SOURCE_INSPECTION / metadata-only drift
INDEPENDENT_VERIFIER          NOT_RUN / unavailable
WRITE_AUTHORITY               FALSE
PRODUCTION_IMPLEMENTATION     NOT_RUN
```

### Open risks / questions

The only current process blocker is verifier independence. Engineering questions remain fully captured in CII-FR-QS-0001; no additional production archaeology is required before verification unless live material state changes.

### Next-agent qualification

QUALIFICATION_BASIS_HEAD: e28e33aa9e7927d2d8e7f5532660108eb1fe4b7b
QUESTION_SET_ID: CII-FR-QS-0001
QUESTION_SET_STATUS: CURRENT

#### Q1 — Production Trace

Trace an approved BLOCK operation from `cii-workspace-find-replace-csv.js` through session/preview, `validateFindReplacePreimage()`, `resolveFindReplaceScope()`, claim creation, `buildValidatedFindReplacePostimage()`, and output qualification. Identify the first two current production boundaries that prevent `Block=NODENAME`, and trace the exact existing NODENAME physical custody from a 15-row ELEMENT block through row13 item6 to the 26-byte FROM / 25-byte TO fields.

#### Q2 — Current Unresolved Problem / Failure Isolation

Using retained `Benchmark/CIICompare/SOURCE 3.CII`, define the minimum isolating test for `From=20020`, `To=20030`, `Block=NODENAME`, `Find Text=PS-12146`. State the predicted pointer, row, endpoint field, claim width, and adjacent/ambiguous failure cases. Name the first wrong boundary if the predicted ownership is not reproduced.

#### Q3 — Authority / Invariant

Identify the authoritative sources for V14 NODENAME cardinality/pointer identity and for NODENAME field widths/ASCII custody. Explain why the existing V14 Writer2 bridge is not write authority for this Find & Replace change. State what a same-cardinality Node Name rename may change, what must remain byte-identical, and one plausible but invalid shortcut.

#### Q4 — Independent Validation

Independently reconstruct the expected retained SOURCE3 ownership chain `20020 -> 20030 -> NODENAME pointer 1 -> row 1 TO=PS-12146`. For a logical rename `PS-12146 -> NODE-20030`, define the exact physical before/after field model, field width, padding rule, match rule, owner-ambiguity rule, and postimage invariant. Distinguish which evidence is retained-real V11, which is pinned V14 authority, and which remains NOT_RUN.

#### Q5 — Next Contribution / Minimal Patch

Specify the smallest legitimate production/test patch for first-priority Node Name Find & Replace. Name exact files/functions/domains, why executor/session should or should not change, protected unchanged domains, focused falsifiers, and the rollback/stop condition. The answer must preserve FORCE fail-closed behavior and direct-overwrite prohibition.