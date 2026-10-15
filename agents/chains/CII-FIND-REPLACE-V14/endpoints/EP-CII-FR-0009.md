# EP-CII-FR-0009 — Exact-checkout execution substrate handoff

CHAIN_ID: CII-FIND-REPLACE-V14
LEG: PR1071-EXACT-CHECKOUT-EXECUTION
PREVIOUS_ENDPOINT: EP-CII-FR-0008
PR: #1071
BRANCH: `feature/cii-find-replace-apply-copy-v14`
BASE_MAIN: `511d186926b67a71efa8163e85497f489ef3a3ed`
PRODUCT_CHECKPOINT_HEAD: `ff3639503728d2246746b343d3e9c5c803e1ed79`
QUALIFICATION_BASIS_HEAD: `a1b5de0e82a53e5b2e82f253fecafd45d9b4d714`
HANDOFF_CHECKPOINT_HEAD: `d1f2175bbff61bea7c7c3198e7436db7a05771d5`
STATE: READY_FOR_EXTERNAL_EXACT_EXECUTION
ENGINEERING_STATE: IMPLEMENTED_FOCUSED_PASS_EXACT_CHECKOUT_NOT_RUN
CUSTODY_EPOCH: 9
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE

## Progress in this leg

- Re-grounded Draft PR #1071 and active chain before action.
- Confirmed current product session blob `8cc27dbc232e2c8f9eca70cf99c9e54a13221d1b` already uses `qualifyFindReplaceOutputCandidate()` for Apply-to-new-copy; an inspected earlier blob `8daf121b...` was stale and is not current product state.
- Confirmed no GitHub status/check exists for qualification basis head `a1b5de0...`.
- Confirmed exact authored test identities:
  - session `7ee0f9f86c8f555077e96aa670ff8ae6786fb105`;
  - output `c86c075657941c81ea1198a357a9931f27c93670`;
  - UI registration `10c24332a8ccf7f49a3de49cc104956919dabd16`;
  - unchanged foundation `f6f2a50aac9483c7f4cfa51f8be3a6fe05acb02a`;
  - retained-real `6bdb9909df2a942d89c7f8f5a6cfb6dc643f6f02`.
- Reconfirmed retained `SOURCE 3.CII` identity: 393008 bytes, Git blob `20c0c37014004fb9de46e3e4d01f0c62535495d5`.
- Exhausted current exact-materialization routes without weakening provenance: container cannot resolve GitHub DNS/network; connector can read small private files but truncates the 393008-byte retained blob to empty content.
- Added `agents/evidence/PR1071_exact_checkout_execution_capsule.md` with hard precondition checks and focused → non-benchmark group → retained-real execution sequence.
- Updated `agents/PR1071_workreport.md` with explicit PASS/NOT_RUN separation.

## Validation classification

```text
PR1071 isolated changed-behavior harness          PASS 10/10
current exact-source inspection                   PASS
PR1071 authored exact-checkout focused tests      NOT_RUN / environment
current non-benchmark Find & Replace group        NOT_RUN in this leg
retained-real SOURCE3 test                        NOT_RUN / environment
full repository suite                             NOT_RUN
native-v14 archive runtime                        NOT_RUN
external CAESAR acceptance                        NOT_RUN
FORCE/FORCMNT ownership                           NOT_QUALIFIED
```

No authored assertion was reached in an exact checkout during this leg, so no exact-checkout PASS or FAIL is claimed.

## Protected authority

- direct mutation `canApply === false`;
- Apply is new-copy release only;
- TARGET0 immutable;
- no Writer1/Writer2;
- no parser/converter/runtime switch;
- FORCE/FORCMNT fail-closed;
- no workflow/benchmark/oracle/tolerance mutation;
- merge Owner-only.

## Exact next action

Run `agents/evidence/PR1071_exact_checkout_execution_capsule.md` unchanged from an authenticated exact checkout. Preserve the first authored failure. Only an authored product failure may reopen product code; materialization/runtime failure remains NOT_RUN.

If focused + non-benchmark group + retained-real all exit 0, promote only those gates and then run the full repository suite as the next separate qualification. Do not infer native-v14 or external CAESAR acceptance from Node test success.

## Handover

Recovery sources:
- `agents/PR1071_workreport.md`
- `agents/evidence/PR1071_exact_checkout_execution_capsule.md`
- this endpoint

PR remains Draft and unmerged. No merge authority was granted by `proceed next`.
