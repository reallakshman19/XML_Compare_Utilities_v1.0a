# EP-CII-W2-MS-0001 — multi-source NODENAME transfer pre-work

CHAIN_STATE_VERSION: 3
HANDOVER_PROTOCOL_VERSION: 2
CHAIN_ID: CII-WRITER2-MULTISOURCE-NODENAME
ENDPOINT_ID: EP-CII-W2-MS-0001
PREVIOUS_ENDPOINT: NONE
ENDPOINT_REASON: PREWORK_START

WORK_ITEM_SOURCE: OWNER_DIRECT
WORK_ITEM_KEY: owner-direct:reallaksh19/XML_Compare_Utilities:CII-WRITER2-MULTISOURCE-NODENAME-20260903
WORK_ITEM_MODE: EXCLUSIVE
AGENT_INSTANCE_ID: chatgpt:f5648fdf-fcfb-47f2-a243-4eea1a836442

REPO: reallaksh19/XML_Compare_Utilities
BRANCH: agent/cii-writer2-multisource-nodename-transfer
MATERIAL_HISTORY_ROOT_BASE: f3b7429a40b8477397ce3efc5748326da24536d4
PREWORK_BASIS_HEAD: 78a34ee6943fb4e69f84ae7f7d789f324ce37e8a
MAIN_HEAD_OBSERVED: f3b7429a40b8477397ce3efc5748326da24536d4

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
QUESTION_PACK_ACTION: REFRESHED
QUESTION_DISPLAY: HIDE
PREWORK_QUALIFICATION_READY: TRUE
TAKEOVER_QUALIFICATION_READY: TRUE

## Mission

Add a Writer2-only multi-source intake/correspondence path for Owner-supplied S1/S2/S3 against one untouched target T. The product must expose phase evidence for source-set custody, base-anchor selection, correspondence, transfer classification and Writer2 mutation. Only Owner-approved NODENAME **cardinality** operations may enter Writer2 APPLY scope; every unrelated candidate is EXCLUDE. Same-cardinality NODENAME overwrite remains outside Writer2 authority.

## Original task / acceptance obligations

- S1/S2/S3 are independent sources; T is the sole target.
- Expected post-base-selection review contains exactly the Owner-provided 329 NODE NAME CHANGES rows.
- Do not transfer other engineering changes.
- Support three source files without requiring physical source concatenation.
- Reuse existing CII V14 record/profile knowledge where legitimate; do not weaken the frozen V11↔V14 Writer2 bridge or current V14 merge qualification boundary.
- Code and benchmark each phase before advancing.

## Input custody

| ID | File | Bytes | SHA-256 | V14 / CONTROL evidence |
|---|---|---:|---|---|
| INPUT-001 | S1.CII | 108330 | `9a9cb14db4c13f5aac41cc74a60e7e528722eb5003d09f07192762ab6bfb1a2b` | 5/14/1256; E56 N49 B14 RIGID1 REST39 SIF2 |
| INPUT-002 | S2.CII | 90961 | `7ec48b76b65eedfd5ecc9c8e8feca1a45dd8c83721a68b53aa0db3363e6d27fd` | 5/14/1256; E46 N42 B10 RIGID1 REST34 SIF1 |
| INPUT-003 | S3.CII | 90942 | `c2143b31c482158ac5514d2709406c14a9179e656277c654e932bb845d090caa` | 5/14/1256; E45 N40 B9 RIGID1 REST33 SIF3 |
| INPUT-004 | T.CII | 2866002 | `abfa3ffc9281fe75d4170b2d885d554cb1f120dadedae7c7ab609548b63cc060` | 5/14/1256; E1614 N1265; FORCMNT6; ALLOWBLS8; FLANGES16 |

Owner files are current-session external inputs and are not committed to the repository. A replacement without access to these exact bytes must obtain SHA-identical inputs before claiming retained-real execution PASS.

## Benchmark / oracle custody

- BM-MS-001: source-set identity — exact three member hashes above; disjoint source node ranges S2 `40..669`, S3 `1350..1930`, S1 `3790..5229`; combined inventory E147/N131/B33/RIGID3/REST106/SIF6.
- BM-MS-002: Owner acceptance list — normalized 329-row `source_names<TAB>target_name` list; SHA-256 `0d941b97833ad55e9ef634c8a1935b233d57cf8ab6c07ba3fb7e7bef410e037e`. This is independent Owner acceptance evidence and must not be regenerated from production output.
- BM-MS-003: target non-merge negative — T has FORCMNT=6, ALLOWBLS=8, FLANGES=16; current `cii14_multi_merge.py` qualification explicitly fails closed for these nonzero constructs. T remains original Writer2 target custody.
- BM-MS-004: Writer2 scope negative — any non-NODENAME CREATE/DELETE APPLY, same-cardinality NODENAME overwrite, stale target hash, unrelated CONTROL/ELEMENT change or missing same-family pointer claim must block.
- Existing `ciibenchmarkroadmap.md` benchmark/oracle/tolerance authority is read-only and preserved.

## Phase sequence

P1 SOURCE_SET_CUSTODY -> P2 BASE_ANCHOR_CORRESPONDENCE -> P3 TRANSFER_ALLOWLIST -> P4 WRITER2_SCOPE_APPLY -> P5 RETAINED_REAL_END_TO_END.

Every phase requires a material-leg receipt and its own focused benchmark result before the next phase. `NOT_RUN` is never promoted to PASS.

## Current blocker / exact next action

The pinned protocol accepts only exact Owner progression commands `proceed next`, `proceed next, no Qs`, or `proceed next, hand over ready`. The current phrase “Start coding” defines task intent but is not one of those progression commands. No material production/test/benchmark path may be changed yet.

EXACT_NEXT_ACTION: after exact Owner `proceed next`, implement only P1 source-set custody plus its focused benchmark on this branch, record the P1 material receipt/endpoint, then stop before P2 unless a subsequent valid progression command authorizes the next bounded phase.

## Active qualification questions

### Q1 — Production Trace

**Domain challenge:** Trace one source member through current Writer2 inspection to target apply and identify the exact seams needed for a virtual source set without creating a second Writer2 semantics engine.

**Exact repository data required:** `tabs/cii-workspace/cii-workspace-core.js`, `cii-workspace-writer-version-bridge.js`, `cii-workspace-engineering-ui.js`, `cii-workspace-multi-base-correspondence.js`, `cii-workspace-transfer-plan.js`, `cii-workspace-transfer-scope.js`, `cii-workspace-writer2-composite-routing.js`; S1/S2/S3/T hashes below.

**Concrete payload:** S1 `9a9cb14d...` / E56 N49; S2 `7ec48b76...` / E46 N42; S3 `c2143b31...` / E45 N40; T `abfa3ffc...` / E1614 N1265. Current `intakePair()` consumes exactly one `sourceBytes|sourceText` plus one target.

**Required derivation:** Reconstruct the call/data path from file input -> V14/V11 normalization -> `intakePair()` -> topology graphs -> base suggestions -> multi-base correspondence -> engineering deltas -> transfer plan/scope -> Writer2 apply. Identify the earliest new production owner for source-member identity and prove why the target apply path should still receive exactly one untouched T.

**Fail if:** source identity is flattened before correspondence, T is merged/regenerated, or a new independent NODENAME writer is proposed.

### Q2 — Current Unresolved Problem / Failure Isolation

**Domain challenge:** Prove the minimum multi-source arbitration needed before any transfer operation exists.

**Exact repository data required:** existing multi-base OR/conflict-veto code plus BM-MS-001/BM-MS-002.

**Concrete payload:** source node ranges S2 `40..669`, S3 `1350..1930`, S1 `3790..5229`; combined E147/N131; Owner expected review count `329`; acceptance-list SHA `0d941b97833ad55e9ef634c8a1935b233d57cf8ab6c07ba3fb7e7bef410e037e`.

**Calculation/reconstruction:** Define a deterministic member-level arbitration key and calculate the expected source-set member/cardinality inventory. Show how two sources claiming the same target identity with contradictory source identities becomes a target-custody conflict rather than last-writer-wins. Predict the exact phase status when the produced review count is 328, 329, and 330.

**Required numerical/technical evidence:** 3 unique member hashes; E56+46+45=147; N49+42+40=131; expected review count exactly 329.

**First wrong boundary:** member correspondence union/arbitration if the per-member results are individually valid but combined target custody is not deterministic.

**Falsifier:** any selected result produces 329 rows only by dropping a conflict or duplicating one target identity without explicit corroboration semantics.

### Q3 — Authority / Invariant

**Domain challenge:** Separate V14 format/merge evidence from Writer2 mutation authority.

**Exact repository data required:** `docs/cii-writer2-v11-v14-lossless-bridge.md`, `cii-workspace-writer2-nodename-relocation.js`, current `3D_Converters` V14 merge qualification/profile, `ciibenchmarkroadmap.md@7d061341...`.

**Concrete payload:** target CONTROL evidence FORCMNT `6`, ALLOWBLS `8`, FLANGES `16`; Writer2 node policy `CII_WRITER_2_NODENAME_RELOCATION`; NODENAME physical widths FROM `[2,28)`=26 and TO `[28,53)`=25.

**Required derivation:** State which authority proves V14 record shape, which authority permits Writer2 NODENAME CREATE/DELETE, and why the current V14 multi-merger may inform parsing but cannot physically merge T or authorize same-cardinality overwrite. Identify allowed CONTROL/ELEMENT pointer/count coordinates and protected domains.

**Protected invariant:** original T byte custody; topology/connectivity unchanged; only scoped Writer2 cardinality deltas projected; all unrelated operations EXCLUDE.

**Invalid shortcut:** concatenate/merge S1/S2/S3/T and compare the merged output, or reinterpret existing target NODENAME as Writer2 overwrite authority.

**Fail if:** merge/profile support is promoted into mutation semantics or frozen bridge guards are relaxed.

### Q4 — Independent Validation

**Domain challenge:** Independently reconstruct one NODENAME cardinality transaction and its unchanged-byte boundary before trusting product output.

**Exact repository data required:** `cii-workspace-writer2-nodename-relocation.js`, Writer2 benchmark NODENAME oracle, V14 fixed-field/pointer authority.

**Concrete payload:** NODENAME FROM span `[2,28)` width 26; TO span `[28,53)` width 25; ELEMENT NODENAME pointer is 13-column lexical I13; CONTROL NONAM field index `3`; target NODENAME count before `1265`; Owner example rows include `/SL-101.6 -> PS02500.1` and `/SL-106.3 -> PS02494.1`.

**Calculation/reconstruction:** For each example after actual correspondence resolution, determine whether target state implies Writer2 CREATE, DELETE, KEEP, overwrite-required BLOCK, or correspondence BLOCK. For any CREATE candidate, derive new physical NODENAME row allocation, NONAM delta and exact element pointer claim; for DELETE, derive compaction mapping. Do not infer the classification from the expected name string alone.

**Independent oracle:** construct expected CONTROL/NODENAME/ELEMENT postimage claims from target preimage + approved operation, independently of Writer2 writer output; compare all non-claimed bytes unchanged.

**Units/sign/tolerance:** exact fixed columns and lexical integer equality; no floating tolerance for counts/pointers.

**Falsifier:** parser succeeds but an unrelated target byte, topology identity, count, or pointer changes outside the independently authorized claim set.

### Q5 — Next Contribution / Minimal Patch

**Domain challenge:** Name the smallest legitimate P1 contribution and the stop conditions for later phases.

**Exact repository data required:** current single-source `intakePair()`/UI path, Writer2 version bridge, code-quality limits, BM-MS-001..004.

**Concrete payload:** P1 must consume S1/S2/S3 member hashes, preserve member order/identity, keep one T hash `abfa3ffc...`, and make no Writer2 mutation; all later transfer rows default EXCLUDE until approved.

**Required derivation:** Specify the production-consumed source-set contract, exact consumer seam, focused tests with real-input hash/count expectations, negative duplicate-member/conflicting-custody tests, and why Writer2 writer/bridge files should remain unchanged in P1.

**Safe patch boundary:** new cohesive source-set/inspection owner plus minimal Writer2-only UI/intake integration needed to make it a real consumer; no transfer/writer mutation yet.

**Expected before/after evidence:** before Writer2 tile reads one source file; after it can retain three independently hashed source members and report per-member inspection while target identity is unchanged.

**Protected unchanged domains:** Writer1A/B/C; Writer2 NODENAME relocation semantics; V11↔V14 frozen converter blobs; target writer; benchmark oracles/tolerances; workflows; topology.

**Validation required:** syntax/source-contract checks plus real S1/S2/S3/T P1 source-set inspection when exact input bytes are present.

**Negative test:** duplicate source ID/hash, source-target hash alias, unsupported dialect member, or source-member order/custody drift must fail closed.

**Rollback/falsifier boundary:** if P1 requires changing Writer2 mutation semantics or cannot retain member SHA provenance through inspection, stop and redesign before P2.

**No-patch condition:** do not touch transfer scope/writer/bridge in P1 merely to force the known 329-row final outcome.
