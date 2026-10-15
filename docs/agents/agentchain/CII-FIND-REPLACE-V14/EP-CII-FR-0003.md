# EP-CII-FR-0003 — Node Name implementation packet ready, independent verification deferred

CHAIN_ID: CII-FIND-REPLACE-V14
LEG_ID: PR1065-NODENAME-FIRST
ENDPOINT_ID: EP-CII-FR-0003
PREVIOUS_ENDPOINT: EP-CII-FR-0002

CREATED_AT: 2026-09-02T10:28:00+04:00
ENDPOINT_REASON: BLOCKER_CHANGE

TASK / ISSUE: CII v14 Find & Replace; owner priority = Node Name first
PR: #1065 — Add CII v14 Find & Replace UI, scoped validation and qualified download
BRANCH: feature/cii-find-replace-icon-v14

CHECKPOINT_HEAD: a3fc24de04253ca510e690dd6b8d804cd376e4bd
MAIN_HEAD_OBSERVED: d35f6aa419244585afec2c47c8fbd0584011931a
MERGE_BASE: d35f6aa419244585afec2c47c8fbd0584011931a
MATERIAL_BASIS_HEAD: e28e33aa9e7927d2d8e7f5532660108eb1fe4b7b

STATE: QUALIFICATION_REQUIRED
TAKEOVER_AUTHORITY: READ_ONLY
QUALIFICATION_STATUS: DEFERRED_VERIFICATION
ENGINEERING_CRITICAL_WRITE_AUTHORITY: FALSE
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
COORDINATION_STATE: COORDINATION_REQUIRED_NON_BLOCKING

### Mission

Deliver native-v14 Node Name Find & Replace first, using exact ELEMENT/NODENAME fixed-field ownership and the existing TARGET0 claim/postimage machinery without invoking Writer1/Writer2.

### This leg completed

- Preserved the candidate answer and material-basis reconciliation from EP-CII-FR-0002.
- Created `agents/evidence/PR1065_nodename_verifier_packet.md` with exact Q1-Q5 evidence anchors, automatic-failure watchlist and bounded verdict template.
- Created `agents/evidence/PR1065_nodename_patch_blueprint.md` with the exact production/test patch boundaries, fixed-field model, fail-closed cases and native-v14 post-implementation gate.
- No independent verifier became available in this substrate.
- No verdict artifact was fabricated.
- No production, test, benchmark, oracle, converter, Writer1/Writer2, workflow or topology file was modified.

### Currently in progress

Independent verification is deferred pending a verifier distinct from candidate `GPT-5.6-SOL-2026-09-02-A`.

### Remaining work

1. Independent verifier reviews the candidate answer using the prepared verifier packet.
2. Verifier writes a separate verdict artifact against `CII-FR-QS-0001`.
3. Only a valid `PASS_WRITE_ALLOWED` authorizes the bounded Node Name production/test patch described in the blueprint.
4. After implementation, execute retained-real focused tests and native-v14 qualification without promoting NOT_RUN evidence.
5. Keep FORCE, Writer1/Writer2, topology and direct overwrite outside this authority.

### Exact next action

An independent verifier distinct from `GPT-5.6-SOL-2026-09-02-A` must evaluate `agents/qualifications/CII-FIND-REPLACE-V14/CII-FR-QS-0001-gpt56sol-answer.md` using `agents/evidence/PR1065_nodename_verifier_packet.md` and write `agents/qualifications/CII-FIND-REPLACE-V14/CII-FR-QS-0001-gpt56sol-verdict.md`; until that verdict is `PASS_WRITE_ALLOWED`, do not modify production or test files.

### Known / proven

- Current production/test/source material basis is still `e28e33aa...`; all later chain commits are relay/evidence metadata.
- Existing NODENAME custody establishes 15-row ELEMENT records, row13 sixth-item pointer, 1-based NODENAME row addressing and exact 26-byte FROM / 25-byte TO physical fields.
- Native-v14 fixed-field authority establishes NODENAME cardinality = 1 row/unit, CONTROL row0 field3 and ELEMENT row13 field5 pointer identity.
- Pinned V11/V14 converter authority states NODENAME string record shape is unchanged between the qualified profiles.
- Existing V14 Writer2 bridge is explicitly not equal-cardinality NODENAME payload write authority.
- The proposed first-priority rename uses whole-field same-width claims, so the existing executor can remain unchanged if the validator emits correct claims.

### Not proven

- Candidate qualification has not been independently verified.
- Production/test write authority has not been granted.
- Node Name implementation has not been authored.
- Focused tests have not been executed for this implementation.
- Native-v14 Node Name mutation remains NOT_RUN.
- External CAESAR acceptance remains NOT_RUN.

### NOT_RUN

- independent verifier: NOT_RUN / unavailable;
- Node Name production patch: NOT_RUN / prohibited by current authority;
- Node Name focused tests: NOT_RUN;
- native-v14 Node Name execution: NOT_RUN;
- full repository regressions: NOT_RUN;
- external CAESAR acceptance: NOT_RUN.

### Active hypothesis

After verifier PASS, the minimum safe contribution is exactly the four production paths and five test paths in `PR1065_nodename_patch_blueprint.md`, with no executor/session/Writer changes required. The validator should emit full-field 25/26-byte claims from exact semantic Node Name matches.

### Falsifier

Any independent verifier finding of incorrect ownership trace, unsafe alias handling, borrowed Writer2 write authority, incomplete negative assurance or materially stale source authority invalidates the current patch plan. After implementation, any byte change outside owned NODENAME fields also falsifies the design.

### Protected invariants

- immutable TARGET0/hash custody;
- complete-field NODENAME claims only;
- unique distinct-node identity per physical field;
- unchanged total file length;
- unchanged CONTROL count and ELEMENT pointers for same-cardinality rename;
- byte identity outside approved field claims;
- no Writer1/Writer2 execution dependency;
- FORCE remains fail-closed;
- direct source overwrite remains disabled;
- benchmarks/oracles/tolerances/workflows unchanged;
- candidate cannot self-verify;
- NOT_RUN remains visible.

### Do not redo

Do not repeat Node Name source archaeology or rewrite the candidate answer unless the verifier identifies a concrete deficiency or material authority changes.

### Do not change

Do not change Find & Replace production/tests, canonical NODENAME custody, Writer1/Writer2, pinned converters, FORCE, benchmarks/oracles, topology, workflows or direct-overwrite controls before a valid independent verdict.

### Expected next-leg files / domains

If and only if `PASS_WRITE_ALLOWED` is granted:

Production:

```text
tabs/cii-workspace/cii-workspace-find-replace-csv.js
tabs/cii-workspace/cii-workspace-find-replace-scope-resolver.js
tabs/cii-workspace/cii-workspace-find-replace-validator.js
tabs/cii-workspace/cii-workspace-find-replace.js
```

Tests:

```text
tests/cii-workspace-find-replace-scope-resolver.test.js
tests/cii-workspace-find-replace-validator.test.js
tests/cii-workspace-find-replace-session.test.js
tests/cii-workspace-find-replace-ui-registration.test.js
tests/cii-workspace-find-replace-retained-real.test.js
```

### Inputs

- `agents/agentchain/CII-FIND-REPLACE-V14/EP-CII-FR-0001.md`
- `agents/agentchain/CII-FIND-REPLACE-V14/EP-CII-FR-0002.md`
- `agents/qualifications/CII-FIND-REPLACE-V14/CII-FR-QS-0001-gpt56sol-answer.md`
- `agents/evidence/PR1065_nodename_verifier_packet.md`
- `agents/evidence/PR1065_nodename_patch_blueprint.md`
- `Benchmark/CIICompare/SOURCE 3.CII`

### Benchmarks

- SOURCE3 retained-real V11 structural Node Name oracle: REFERENCE_ONLY / source inspection.
- Existing Writer2 NODENAME benchmark evidence: read-only authority support, not Find & Replace runtime proof.
- Native-v14 retained mutation benchmark: NONE EXECUTED / NOT_RUN.

### Common / governing documents

Pinned `reallaksh19/Common@10d667ce715bb52e1f73035c6fa326db77d0f9dd`:

- `skills/engineering-pr-delivery-v2/SKILL.md`
- `references/relay-model.md`
- `references/agentchain-schema.md`
- `references/qualification.md`
- `references/source-indexing.md`
- `references/engineering-validation.md`
- `references/anti-gaming-rules.md`
- `references/multi-agent-coordination.md`
- `references/git-pr-policy.md`

### Authoritative sources

- `tabs/cii-workspace/cii-workspace-nodename.js@d35f6aa...` — physical NODENAME field/pointer custody.
- `tabs/cii-workspace/cii-workspace-v14-writer2-fixed-field-authority.js@d35f6aa...` — V14 cardinality/pointer identities only.
- `reallaksh19/3D_Converters@ca8d391a.../converters/scripts/cii_v11_v14.py` — NODENAME record shape unchanged between qualified dialects.
- `docs/cii-writer2-v11-v14-lossless-bridge.md@d35f6aa...` — negative boundary: bridge does not authorize equal-cardinality NODENAME payload mutation.

### Production paths

READ_ONLY until verifier PASS. Exact proposed paths are listed above and in the blueprint.

### Validation / test paths

Immediate gate:

`agents/evidence/PR1065_nodename_verifier_packet.md`

Post-PASS implementation validation is fully specified in `agents/evidence/PR1065_nodename_patch_blueprint.md`.

### Changed during this leg

Relay/evidence metadata only:

```text
agents/evidence/PR1065_nodename_verifier_packet.md
agents/evidence/PR1065_nodename_patch_blueprint.md
agents/agentchain/CII-FIND-REPLACE-V14/EP-CII-FR-0003.md
agents/agentchain.md  (next index update)
```

### Validation summary

```text
VERIFIER_PACKET                PASS / ARTIFACT_INSPECTION / prepared
PATCH_BLUEPRINT                PASS / ARTIFACT_INSPECTION / prepared
MATERIAL_SCOPE_CONTAINMENT     PASS / repository compare after index update required
INDEPENDENT_VERIFIER           NOT_RUN
WRITE_AUTHORITY                FALSE
PRODUCTION_IMPLEMENTATION      NOT_RUN
```

### Open risks / questions

Only the independent-verifier gate currently prevents implementation. The engineering patch boundary is otherwise concretely specified. No missing Node Name source-archeology task is known at this material basis.

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
