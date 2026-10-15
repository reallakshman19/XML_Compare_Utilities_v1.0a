# EP-CII-W2-MS-0002 — repository-resident input pre-work

CHAIN_STATE_VERSION: 3
HANDOVER_PROTOCOL_VERSION: 2
CHAIN_ID: CII-WRITER2-MULTISOURCE-NODENAME
ENDPOINT_ID: EP-CII-W2-MS-0002
PREVIOUS_ENDPOINT: EP-CII-W2-MS-0001
ENDPOINT_REASON: PREWORK_REGROUND_AFTER_OWNER_INPUT_COMMIT

WORK_ITEM_SOURCE: OWNER_DIRECT
WORK_ITEM_KEY: owner-direct:reallaksh19/XML_Compare_Utilities:CII-WRITER2-MULTISOURCE-NODENAME-20260903
WORK_ITEM_MODE: EXCLUSIVE
AGENT_INSTANCE_ID: chatgpt:f5648fdf-fcfb-47f2-a243-4eea1a836442

REPO: reallaksh19/XML_Compare_Utilities
PR: 1082
BRANCH: agent/cii-writer2-multisource-nodename-transfer
MAIN_HEAD_OBSERVED: af73cada60031984182155f3fa362261b97379ec
MATERIAL_HISTORY_ROOT_BASE: af73cada60031984182155f3fa362261b97379ec
PREWORK_BASIS_HEAD: dad968c6a717c0dacc7042c43a2051017a86a784

COMMON_PROTOCOL: engineering-pr-delivery-v2
COMMON_PROTOCOL_BASIS: e3ace4802a022f565f95b4af7f01a203df82dbcd
COMMON_PROTOCOL_STATUS: CURRENT

ENGINEERING_STATE: READY
CUSTODY_STATE: HELD
QUALIFICATION_STATE: NOT_REQUIRED
WRITE_AUTHORITY: READ_ONLY
AUTO_STATE: NOT_APPLICABLE
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
COORDINATION_STATE: SAFE_WITH_READONLY_PR1064_WRITER2_RUNTIME_OVERLAP
OWNER_PROGRESSION_COMMAND: NOT_SET
MATERIAL_PROGRESSION_AUTHORITY: BLOCKED_EXACT_OWNER_PROGRESSION_COMMAND_REQUIRED

ROADMAPS: ciibenchmarkroadmap.md@7d061341a8c038316752007a3d4ed02b7ea66b58
ROADMAP_REVIEW_STATUS: COMPLETE
ROADMAP_ALIGNMENT: ALIGNED
ROADMAP_MUTATION_AUTHORITY: NONE

OWNER_QUALIFICATION_BASELINE_DISCOVERY: COMPLETE
OWNER_QUALIFICATION_BASELINE_SOURCE: OWNER_DIRECT:2026-09-03 CII Writer2 S1/S2/S3 -> T NODE NAME CHANGES task
OWNER_QUALIFICATION_BASELINE_MANIFEST: agents/chains/CII-WRITER2-MULTISOURCE-NODENAME/qualification-baselines/QB-CII-W2-MS-0001.json
OWNER_QUALIFICATION_BASELINE_STATUS: SATISFIED

QUALIFICATION_PROTOCOL_VERSION: 3
QUALIFICATION_PROFILE: FIXED_FORMAT_WRITER
QUALIFICATION_PROFILE_VERSION: 2
QUALIFICATION_SCOPE_ID: QSCOPE-CII-W2-MS-MULTISOURCE-NODENAME-CARDINALITY
QUESTION_SET_ID: CII-W2-MS-QS-0001
QUESTION_SET_STATUS: CURRENT
QUESTION_PACK_ACTION: REUSED_AFTER_INPUT_CUSTODY_REGROUND
QUESTION_DISPLAY: HIDE
PREWORK_QUALIFICATION_READY: TRUE
TAKEOVER_QUALIFICATION_READY: TRUE

## Drift reconciliation

Current main advanced from `f3b7429a...` to `af73cada...` by exactly one Owner input commit adding:

```text
Benchmark/S1.CII  git blob 73c49165b9d33a8c776ef76f480efec3a90e0c93
Benchmark/S2.CII  git blob a04622553720cb41a6fc2a4b85d8290eac7a3b0a
Benchmark/S3.CII  git blob a20b1ab87dd4e854cf2f453f8fd206be4b566b42
Benchmark/T.CII   git blob 96b4a4b12bf66bcb0264c56e7767a857c4cc11e6
```

Those Git blob IDs exactly equal the Git blob IDs independently calculated from the four uploaded bytes. Their SHA-256 values remain:

```text
S1  9a9cb14db4c13f5aac41cc74a60e7e528722eb5003d09f07192762ab6bfb1a2b
S2  7ec48b76b65eedfd5ecc9c8e8feca1a45dd8c83721a68b53aa0db3363e6d27fd
S3  c2143b31c482158ac5514d2709406c14a9179e656277c654e932bb845d090caa
T   abfa3ffc9281fe75d4170b2d885d554cb1f120dadedae7c7ab609548b63cc060
```

POST_BASIS_DRIFT: MATERIAL_WITHIN_QUALIFIED_BOUNDARY
DRIFT_DISPOSITION: OWNER_INPUT_CUSTODY_STRENGTHENING_ONLY
PRODUCTION_TRACE_CHANGED: FALSE
WRITER_AUTHORITY_CHANGED: FALSE
ORACLE_EXPECTATION_CHANGED: FALSE

The branch incorporated `af73cada...` as a merge parent without modifying any input blob. This endpoint resets the future material-history root to that current main, so P1 starts with the real benchmark inputs already in baseline ancestry.

## Mission / acceptance

S1/S2/S3 are three independent V14 sources; T is the sole untouched target. After accepted base-anchor selection, the Owner-known NODE NAME CHANGES review has exactly **329 rows**; normalized acceptance-list SHA-256 is `0d941b97833ad55e9ef634c8a1935b233d57cf8ab6c07ba3fb7e7bef410e037e`. Product output may be compared to this oracle but may not generate or rewrite it.

Phase order remains:

`P1 SOURCE_SET_CUSTODY -> P2 BASE_ANCHOR_CORRESPONDENCE -> P3 TRANSFER_ALLOWLIST -> P4 WRITER2_SCOPE_APPLY -> P5 RETAINED_REAL_END_TO_END`.

P1 is the next and only material phase eligible after a valid progression command.

## Protected invariants

- T remains one original target; no physical merge/regeneration of T.
- S1/S2/S3 retain independent member/hash provenance through correspondence.
- Existing Writer2 NODENAME policy remains `CII_WRITER_2_NODENAME_RELOCATION`: CREATE/DELETE cardinality only.
- Same-cardinality NODENAME overwrite remains Writer2-blocked.
- Every unrelated mutable operation defaults to EXCLUDE before Writer2 apply.
- Frozen V11↔V14 bridge, V14 CONTROL/ELEMENT pointer/cardinality guard and final downgrade proof remain unchanged.
- `ciibenchmarkroadmap.md`, existing Writer2 benchmark oracles/tolerances, PR #1064 runners, workflows, Writer1 and Writer3/topology are read-only.
- `NOT_RUN` is never promoted to PASS.

## Exact next action

The pinned Common revision recognizes only `proceed next`, `proceed next, no Qs`, or `proceed next, hand over ready` as Owner material-progression commands. Current Owner text did not contain one of these exact forms.

EXACT_NEXT_ACTION: after exact Owner `proceed next`, change only the minimum production-consumed P1 source-set/intake surface and its focused source-set benchmark; execute against repository `Benchmark/S1.CII`, `S2.CII`, `S3.CII`, `T.CII`; record P1 material receipt + successor endpoint; do not begin P2 in the same bounded progression.

## Active qualification questions

### Q1 — Production Trace

**Domain challenge:** Trace existing single-source Writer2 from browser input through frozen V14/V11 normalization, `intakePair()`, topology graph, base suggestions/correspondence, engineering deltas, transfer scope, Writer2 apply and V14 projection.

**Exact repository data required:** `cii-workspace-engineering-ui.js`, `cii-workspace-writer-version-bridge.js`, `cii-workspace-core.js`, `cii-workspace-multi-base-correspondence.js`, `cii-workspace-transfer-scope.js`, Writer2 composite routing.

**Concrete payload:** three source Git blobs `73c49165...`, `a0462255...`, `a20b1ab8...`; target blob `96b4a4b1...`; current `intakePair()` owns exactly one source plus one target.

**Required derivation:** identify the first new owner that can preserve `sourceMemberId + sourceSha256` without changing one-target Writer2 apply semantics; trace one source member to a target correspondence and state where member provenance must still be present.

**Fail if:** T is merged, source identity is flattened before arbitration, or a second Writer2 semantics path is introduced.

### Q2 — Current Unresolved Problem / Failure Isolation

**Domain challenge:** Define deterministic multi-source arbitration before transfer construction.

**Concrete payload:** S2 nodes `40..669`, S3 `1350..1930`, S1 `3790..5229`; element count `56+46+45=147`; NODENAME count `49+42+40=131`; expected review rows `329`.

**Calculation/reconstruction:** derive member inventory and a target-custody key. Show outcomes for corroborating duplicate target claims versus contradictory source identities. Predict benchmark result for 328/329/330 produced rows.

**First wrong boundary:** source-member correspondence union/arbitration when individually valid source results cannot be combined without conflict loss or duplicate target custody.

**Falsifier:** 329 is reached by last-writer-wins, silent conflict deletion or duplicated target identity.

### Q3 — Authority / Invariant

**Domain challenge:** Separate V14 structural/merge knowledge from Writer2 mutation authority.

**Concrete payload:** T CONTROL includes FORCMNT `6`, ALLOWBLS `8`, FLANGES `16`; NODENAME FROM `[2,28)` width 26 and TO `[28,53)` width 25; Writer2 node policy `CII_WRITER_2_NODENAME_RELOCATION`.

**Required derivation:** state why current V14 merger can inform record parsing but cannot merge T or authorize same-count NODENAME replacement; enumerate Writer2-authorized count/pointer mutation families and protected target domains.

**Invalid shortcut:** physical source/target merge or treating V14 parser acceptance as Writer2 semantic authority.

**Fail if:** frozen bridge guards or same-cardinality blocker are weakened.

### Q4 — Independent Validation

**Domain challenge:** Reconstruct one target NODENAME cardinality transaction independently of writer output.

**Concrete payload:** target NODENAME before `1265`; CONTROL NONAM field index 3; ELEMENT NODENAME pointer is lexical 13-column I13; Owner rows include `/SL-101.6 -> PS02500.1` and `/SL-106.3 -> PS02494.1`.

**Calculation/reconstruction:** after actual correspondence, classify each example as CREATE/DELETE/KEEP/overwrite-required BLOCK/correspondence BLOCK. For CREATE derive row allocation, NONAM change and exact pointer claim; for DELETE derive row compaction and pointer mapping.

**Independent oracle:** build expected CONTROL/NODENAME/ELEMENT claim set from T preimage + approved operation, not from Writer2 output, then prove all non-claimed bytes identical.

**Falsifier:** parse succeeds while unrelated byte/topology/count/pointer changes outside independent claims.

### Q5 — Next Contribution / Minimal Patch

**Domain challenge:** Bound P1 to source-set custody only.

**Concrete payload:** three exact repository source blobs plus one exact T blob; no Writer2 mutation in P1; later operations default EXCLUDE until approved.

**Required derivation:** specify a production-consumed source-set contract, its minimal Writer2-only UI/intake consumer, duplicate/member-target alias/dialect/order fail-closed tests, and real-input P1 inspection benchmark.

**Safe patch boundary:** new cohesive source-set/inspection owner plus only the minimum existing Writer2 tile intake integration needed to consume it; Writer2 transfer/writer/bridge semantics unchanged.

**Expected before/after evidence:** before one source file; after three independently hashed source members can be inspected against one unchanged target.

**Negative test:** duplicate source identity/hash, source==target hash, unsupported member dialect or custody/order drift blocks.

**Rollback/NO-PATCH:** if P1 requires changing transfer/writer semantics or cannot preserve member SHA provenance, stop before P2; do not patch the writer to force the known 329 final result.
