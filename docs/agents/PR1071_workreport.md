# PR1071 Work Report — CII v14 explicit Apply-to-new-copy gate

CHAIN: CII-FIND-REPLACE-V14
PR: #1071
BRANCH: `feature/cii-find-replace-apply-copy-v14`
BASE_MAIN: `511d186926b67a71efa8163e85497f489ef3a3ed`
PRODUCT_CHECKPOINT_HEAD: `ff3639503728d2246746b343d3e9c5c803e1ed79`
EXACT_EXECUTION_BASIS_HEAD: `a1b5de0e82a53e5b2e82f253fecafd45d9b4d714`
STATE: DRAFT
ENGINEERING_STATE: IMPLEMENTED_EXACT_CHECKOUT_VALIDATION_BLOCKED_BY_ENVIRONMENT
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
WORK_ITEM_SOURCE: OWNER_DIRECT
OWNER_COMMAND: `proceed next`

## Mission and delivered behavior

Deliver **Preview → Apply to New Copy → Download** for CII v14 Find & Replace without direct source overwrite authority.

1. `Validate & Preview` builds an independently validated in-memory TARGET1.
2. Qualified preview exposes `canApplyToNewCopy=true`; direct `canApply` remains `false`.
3. `Apply to New Copy` validates the output candidate and records a frozen TARGET1 release hash/receipt only.
4. Download is unavailable until that release exists.
5. Final download independently revalidates TARGET0/TARGET1 and requires the exact Apply release/hash.
6. Target/CSV/mode/row/review/qualification changes clear release state.
7. Output receipt states `originalFileOverwritten=false`, `writerInvoked=false`, `appliedToNewCopy=true`.

## Authority / protected invariants

- TARGET0 immutable; unchanged bytes outside claims remain unchanged.
- direct mutation `canApply: false` remains authoritative.
- `canApplyToNewCopy` is release authority only, not overwrite authority.
- no Writer1/Writer2 invocation or parser/converter/runtime switch.
- FORCE/FORCMNT remains fail-closed and unqualified.
- no workflow, benchmark, oracle, tolerance, or deployment change.
- merge remains Owner-only.

## Changed-file ledger

| File | Preimage blob | Current blob | Change |
|---|---|---|---|
| `tabs/cii-workspace/cii-workspace-find-replace-session.js` | `062cab0367d0959e936ae8762e40a2ba7d2a3804` | `8cc27dbc232e2c8f9eca70cf99c9e54a13221d1b` | Apply-to-new-copy release state; direct `canApply=false`; `canApplyToNewCopy`/`canDownload` |
| `tabs/cii-workspace/cii-workspace-find-replace-output.js` | `6cd10fd4c9f9dac8b07bf83b9eec915973e2b374` | `51848496ce4918aa8561aa86bc0f6a5ddda63d02` | candidate validation separated from final download; release/hash required |
| `tabs/cii-workspace/cii-workspace-find-replace-ui.js` | `2aab16841a17dd3f050a568df42e983fe3efa777` | `773356d869bd79ade6e44eb105fea189afa384fd` | Apply action and download gating; no writer/filesystem route |
| `tabs/cii-workspace/cii-workspace-find-replace.js` | `3dcb5da7f9f9597b423206d9541e404834f91b64` | `6470248222f37fc767028587039b59237a382be3` | user-facing Apply-to-new-copy wording |
| `tests/cii-workspace-find-replace-session.test.js` | `6ec216ca8b7b77c1057d1d90372089ef34a5ae00` | `7ee0f9f86c8f555077e96aa670ff8ae6786fb105` | Preview→Apply→Download and invalidation assertions |
| `tests/cii-workspace-find-replace-output.test.js` | `61dade3eaa2fa86227ab031454a4daddc93ecb81` | `c86c075657941c81ea1198a357a9931f27c93670` | pre-Apply download blocker and post-Apply custody assertions |
| `tests/cii-workspace-find-replace-ui-registration.test.js` | `f35a83806b548d84bc37dbc2aaddc458a6e5b91c` | `10c24332a8ccf7f49a3de49cc104956919dabd16` | UI gate and no-writer/FORCE assertions |
| `agents/evidence/PR1071_exact_checkout_execution_capsule.md` | new | committed | exact-head/test/fixture identity gate and one-shot execution sequence |
| `agents/PR1071_workreport.md` | new | current report | durable recovery state |

`tests/cii-workspace-find-replace-foundation.test.js` remains unchanged at blob `f6f2a50aac9483c7f4cfa51f8be3a6fe05acb02a`; its direct mutation boundary must continue asserting `canApply === false`.

## Validation ledger

### Focused Apply/output delta harness

STATUS: **PASS**
OBSERVATION: isolated Node delta harness executed 10 changed-behavior assertions.
RESULT: **10/10 PASS**.
LIMITATION: locally equivalent document-scope validation/SHA dependencies, not a complete authenticated checkout.

### Exact current-source inspection

STATUS: **PASS**
OBSERVATION: current branch blob `8cc27dbc...` confirms `applyFindReplaceToNewCopy()` calls `qualifyFindReplaceOutputCandidate()`, not the post-Apply download builder. An earlier preimage `8daf121b...` contained the circular route but is not the current branch state.

### Authored PR1071 exact-checkout focused tests

STATUS: **NOT_RUN / ENVIRONMENT**
EXPECTED TEST BLOBS:
- session `7ee0f9f86c8f555077e96aa670ff8ae6786fb105`
- output `c86c075657941c81ea1198a357a9931f27c93670`
- UI registration `10c24332a8ccf7f49a3de49cc104956919dabd16`
- unchanged foundation `f6f2a50aac9483c7f4cfa51f8be3a6fe05acb02a`

OBSERVATION: the connected GitHub API can return exact small-file content and identities, but the execution container cannot resolve `github.com`/`raw.githubusercontent.com` and has no authenticated checkout. No GitHub status/check exists on basis head `a1b5de0...`. A materialization stop before authored assertions is therefore NOT_RUN, not FAIL.

### Retained real `SOURCE 3.CII`

STATUS: **NOT_RUN / ENVIRONMENT**
FIXTURE: `Benchmark/CIICompare/SOURCE 3.CII`
EXPECTED SIZE: `393008`
EXPECTED GIT BLOB: `20c0c37014004fb9de46e3e4d01f0c62535495d5`
RETAINED TEST BLOB: `6bdb9909df2a942d89c7f8f5a6cfb6dc643f6f02`
OBSERVATION: connector confirms exact size/blob but its blob endpoint truncates this oversized private file to empty content, so byte-preserving runtime materialization is unavailable.

### Full repository / native / external / FORCE

- full repository suite: **NOT_RUN**
- native-v14 archived fixture runtime: **NOT_RUN**
- external CAESAR acceptance: **NOT_RUN**
- nonzero FORCMNT/FORCE ownership: **NOT_QUALIFIED**

## Execution capsule

`agents/evidence/PR1071_exact_checkout_execution_capsule.md`

The capsule verifies exact head, all focused/retained test blobs, `SOURCE 3.CII` blob and 393008-byte size, and clean worktree before running:
1. the four PR1071 focused tests;
2. the current non-benchmark Find & Replace test group;
3. the retained-real test.

Classification is explicit: materialization/runtime stop before authored assertions = NOT_RUN; first authored assertion/product exception = FAIL; clean completion = candidate PASS for those gates only.

## Highest remaining risk

PR1071 behavior has focused PASS evidence but not exact-checkout execution. The principal uncertainty is execution substrate/integration, not a currently observed current-head product defect.

## Exact next action

In any environment with exact authenticated checkout access, execute unchanged:

```bash
bash -c "$(sed -n '/^```bash$/,/^```$/p' agents/evidence/PR1071_exact_checkout_execution_capsule.md | sed '1d;$d')"
```

Prefer running the capsule commands directly from the file if shell extraction policy disallows the convenience form. Preserve the first authored failure unchanged. Do not modify product code unless exact authored execution reveals a real failure. Do not widen FORCE, Writer1/Writer2, direct-overwrite, workflow, benchmark, or oracle authority.
