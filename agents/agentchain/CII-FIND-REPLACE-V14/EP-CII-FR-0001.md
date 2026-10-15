# EP-CII-FR-0001 — Node Name first-priority qualification gate

CHAIN_ID: CII-FIND-REPLACE-V14
LEG_ID: PR1065-NODENAME-FIRST
ENDPOINT_ID: EP-CII-FR-0001
PREVIOUS_ENDPOINT: NONE — chain start

CREATED_AT: 2026-09-02T10:06:00+04:00
ENDPOINT_REASON: CHAIN_START / PRE_MUTATION

TASK / ISSUE: CII v14 Find & Replace; owner priority = Node Name first
PR: #1065 — Add CII v14 Find & Replace UI, scoped validation and qualified download
BRANCH: feature/cii-find-replace-icon-v14

CHECKPOINT_HEAD: 8db1a7bfcd71f5dc204d4c6e11fca255c4544d88
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

Make Find & Replace of CAESAR II **Node Name** the first qualified product scope. The intended implementation is a native-v14, TARGET0-relative, fixed-field NODENAME rename path. It must not invoke or modify Writer1/Writer2 and must not broaden FORCE or topology authority.

### This leg completed

- Loaded `engineering-pr-delivery-v2` from the owner-pinned Common commit.
- Re-grounded PR #1065: open, draft, mergeable, head `e28e33aa9e7927d2d8e7f5532660108eb1fe4b7b`; main/merge-base `d35f6aa419244585afec2c47c8fbd0584011931a`.
- Confirmed no PR reviews, review threads, commit statuses, or PR-triggered workflow runs exist at the material basis head.
- Read the repo-wide active chain index and latest Writer2 endpoint.
- Coordination finding: Writer2 chain owns separate Writer2 runtime qualification and has retained NODENAME evidence; Node Name Find & Replace may inspect that authority but must not call or modify Writer2. Production paths do not overlap if this boundary is preserved.
- Traced current Find & Replace intake/resolver/validator/executor and isolated NODENAME as unsupported at both intake and resolver.
- Established the current repository NODENAME physical model and pinned V14 pointer/cardinality authority.
- Established from pinned upstream V11/V14 converter source that NODENAME string record shape is unchanged between the qualified profiles.
- Identified a retained-real ownership oracle in `Benchmark/CIICompare/SOURCE 3.CII`: element `20020 -> 20030`, NODENAME pointer `1`, NODENAME row 1 TO field `PS-12146`.
- Persisted the detailed read-only trace at `agents/evidence/PR1065_nodename_find_replace_readonly_trace.md`.
- No production, test, benchmark, oracle, workflow, Writer1, or Writer2 file has been changed in this relay leg.

### Currently in progress

Incoming-candidate qualification for the first Node Name implementation contribution.

### Remaining work

1. Answer Q1-Q5 against live repository evidence.
2. Obtain an independent verifier verdict bound to material basis `e28e33aa9e7927d2d8e7f5532660108eb1fe4b7b`.
3. Only after `PASS_WRITE_ALLOWED`, implement the minimal NODENAME patch and focused retained-real tests.
4. Execute focused/current-head tests where an exact checkout substrate is available; preserve `NOT_RUN` otherwise.
5. Create a post-mutation endpoint; do not merge without owner authorization.

### Exact next action

Create `agents/qualifications/CII-FIND-REPLACE-V14/CII-FR-QS-0001-gpt56sol-answer.md` answering Q1-Q5 from live PR/main/source evidence while remaining READ_ONLY; do not modify any Find & Replace production or test file.

### Known / proven

- Current BLOCK intake accepts only DISPLACEMENT and FORCE; NODENAME is unsupported.
- Current scope resolver has no NODENAME route.
- Generic Find & Replace validator requires equal Find/Replace text length.
- Existing executor accepts equal-width claims and independently validates postimage bytes.
- Qualified NODENAME custody uses 15-row ELEMENT blocks, row13 item6 NODENAME pointer, positive pointer = 1-based NODENAME row.
- NODENAME physical fields are FROM `[2,28)` width 26 and TO `[28,53)` width 25; ASCII custody is required.
- V14 authority records NODENAME as one row/unit, CONTROL `0:3` as NONAM count, ELEMENT `13:5` as NODENAME pointer.
- Pinned upstream V11/V14 adapter identifies NODENAME string record shape as unchanged between qualified profiles.
- Retained SOURCE3 proves an exact real pointer/field chain for `20020 -> 20030 -> pointer 1 -> TO=PS-12146`.

### Not proven

- Native-v14 Node Name mutation runtime acceptance.
- Native-v14 retained member byte execution; pinned ZIP remains inaccessible through the current binary-incompatible connector route.
- That the proposed production patch passes current-head focused/full repository tests.
- Any FORCE ownership semantics beyond the existing fail-closed state.
- Direct source-file overwrite authority.

### NOT_RUN

- Node Name Find & Replace production tests: NOT_RUN — production change not yet authorized or authored.
- Native-v14 Node Name mutation: NOT_RUN.
- Full repository suite: NOT_RUN in this execution substrate.
- External CAESAR acceptance: NOT_RUN.

### Active hypothesis

A safe first Node Name implementation requires no Writer2 call and no cardinality/pointer mutation. Exact element identity plus the existing row13 item6 pointer can authorize only the pointed NODENAME FROM/TO fixed fields. A variable-length logical rename can still be a same-width physical mutation by claiming the complete field and space-padding the replacement.

### Falsifier

Any retained/native source where the selected exact element does not uniquely resolve to a positive NODENAME pointer and exact fixed field, where CONTROL NONAM differs from physical NODENAME row count, where one physical field has multiple distinct node identities, where V14 NODENAME payload shape differs from the qualified V11/V14 profile, or where postimage changes any byte outside the authorized field invalidates this hypothesis and must block the implementation/promotion.

### Protected invariants

- immutable TARGET0 and source SHA custody;
- mandatory Preview + explicit row approval before claims;
- original-coordinate claims only;
- no line-ending mutation;
- no NODENAME row-count change for rename;
- no CONTROL NONAM change for rename;
- no ELEMENT NODENAME pointer change for rename;
- no Writer1/Writer2 invocation by Find & Replace;
- no FORCE authority widening;
- no topology/create/delete semantics hidden inside a rename;
- no name overflow beyond 26-byte FROM / 25-byte TO fields;
- no non-ASCII promotion without new authority;
- ambiguous physical ownership fails closed;
- `NOT_RUN` is never promoted to PASS;
- direct source overwrite remains disabled.

### Do not redo

Do not repeat the generic FORCE search, displacement qualification, Writer2 materialization-route audit, or current NODENAME fixed-field source archaeology unless the governing source/head changes materially.

### Do not change

Do not change Writer1/Writer2 modules, V11/V14 converter sources, retained benchmark/oracle files, tolerance/validation rules, `.github/workflows/**`, FORCE fail-closed behavior, topology, or direct source-overwrite controls in the Node Name leg.

### Expected next-leg files / domains

After independent write qualification, expected production/test domain is limited to:

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

No executor change is expected if Node Name logical changes are converted into equal-width whole-field claims.

### Inputs

- Owner task priority: Find & Replace Node Name first.
- `Benchmark/CIICompare/SOURCE 3.CII` — retained-real structural input; current main `d35f6aa419244585afec2c47c8fbd0584011931a`.
- PR #1065 material basis `e28e33aa9e7927d2d8e7f5532660108eb1fe4b7b`.

### Benchmarks

- `Benchmark/CIICompare/SOURCE 3.CII` — REFERENCE/INDEPENDENT retained-real V11 structural ownership oracle for NODENAME pointer/field chain.
- `Benchmark/CIICompare/Writer2/CII_WRITER2_BENCHMARKS.json` — implementation-family qualification ledger; NODENAME focused runtime evidence is reference-only for this independent Find & Replace route.
- Pinned native-v14 archive/member listed in PR1065 workreport — UNQUALIFIED_RUNTIME / NOT_RUN because binary member is not materialized here.

### Common / governing documents

- `reallaksh19/Common@10d667ce715bb52e1f73035c6fa326db77d0f9dd/skills/engineering-pr-delivery-v2/SKILL.md`.
- `references/relay-model.md`.
- `references/agentchain-schema.md`.
- `references/source-indexing.md`.
- `references/qualification.md`.
- `references/engineering-validation.md`.
- `references/anti-gaming-rules.md`.
- `references/multi-agent-coordination.md`.
- `references/git-pr-policy.md`.
- `agents/agentchain.md`.

### Authoritative sources

- `tabs/cii-workspace/cii-workspace-nodename.js@d35f6aa...` — existing exact NODENAME physical custody model.
- `tabs/cii-workspace/cii-workspace-v14-writer2-fixed-field-authority.js@d35f6aa...` — V14 CONTROL/ELEMENT pointer/cardinality identities; does not itself authorize NODENAME payload mutation.
- `tabs/cii-workspace/cii-workspace-writer2-nodename-relocation.js@d35f6aa...` — qualified fixed-field FROM/TO width and ASCII row-rebuild behavior; read-only authority source for format, not execution path.
- `docs/cii-writer2-v11-v14-lossless-bridge.md@d35f6aa...` — explicit authority boundary: equal-cardinality NODENAME payload mutation blocked in existing V14 Writer2 bridge.
- `reallaksh19/3D_Converters@ca8d391ac5f829f53bebb3c37adf0547c34a67b4/converters/scripts/cii_v11_v14.py` — pinned upstream statement that NODENAME string record shape is unchanged across qualified V11/V14 profiles.

### Production paths

Current read-only trace:

```text
cii-workspace-find-replace-csv.js
cii-workspace-find-replace-preview.js
cii-workspace-find-replace-session.js
cii-workspace-find-replace-validator.js
cii-workspace-find-replace-scope-resolver.js
cii-workspace-find-replace-executor.js
cii-workspace-find-replace-output.js
```

Existing NODENAME authority paths are read-only dependencies for reasoning, not planned edits.

### Validation / test paths

- `tests/cii-workspace-find-replace-scope-resolver.test.js`.
- `tests/cii-workspace-find-replace-validator.test.js`.
- `tests/cii-workspace-find-replace-session.test.js`.
- `tests/cii-workspace-find-replace-ui-registration.test.js`.
- `tests/cii-workspace-find-replace-retained-real.test.js`.
- Retained source inspection: `Benchmark/CIICompare/SOURCE 3.CII`.
- Native-v14 member execution: NOT_RUN until binary-capable exact materialization is available.

### Changed during this leg

Relay/evidence metadata only:

```text
agents/evidence/PR1065_nodename_find_replace_readonly_trace.md
agents/agentchain/CII-FIND-REPLACE-V14/EP-CII-FR-0001.md
agents/agentchain.md   (index update follows)
```

### Validation summary

```text
LIVE_PR_MAIN_GROUNDING                 PASS / REMOTE_EXECUTION / GitHub
PR_REVIEWS_THREADS                     PASS / REMOTE_EXECUTION / none present
CURRENT_HEAD_CI_STATUS                 NOT_RUN / no statuses or workflow runs present
NODENAME_CURRENT_UNSUPPORTED           PASS / SOURCE_INSPECTION / implementation
NODENAME_FIXED_FIELD_CUSTODY           PASS / SOURCE_INSPECTION / authoritative repository source
V14_POINTER_CARDINALITY_AUTHORITY      PASS / SOURCE_INSPECTION / authoritative repository source
V11_V14_NODENAME_SHAPE_COMPATIBILITY  PASS / SOURCE_INSPECTION / pinned upstream source
RETAINED_SOURCE3_POINTER_FIELD_CHAIN   PASS / SOURCE_INSPECTION / retained-real source
NATIVE_V14_NODENAME_MUTATION           NOT_RUN
PROPOSED_PRODUCTION_TESTS              NOT_RUN
```

### Open risks / questions

- Independent verifier is not available in the current single-agent substrate; candidate may not self-authorize production mutation.
- Native-v14 retained runtime proof remains absent.
- The minimal implementation must independently detect alias ownership rather than assuming a pointer row belongs to only one element/node.

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