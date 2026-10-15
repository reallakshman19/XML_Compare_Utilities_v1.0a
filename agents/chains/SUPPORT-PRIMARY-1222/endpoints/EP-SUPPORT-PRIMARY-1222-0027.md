# Endpoint checkpoint — EP-SUPPORT-PRIMARY-1222-0027

CHAIN_ID: SUPPORT-PRIMARY-1222  
PREDECESSOR: EP-SUPPORT-PRIMARY-1222-0026  
LEG: LEG-014 — independent executable qualification  
PR: #1223  
BRANCH: `feature/support-primary-assembly-graph`  
BASE_MAIN: `242fc1b1df7e398b64e15a1fd3e2f87d1ff5b581`  
PRODUCT_MATERIAL_HEAD_QUALIFIED: `efecd8f7cf90e4d5b2dd9d264064f37c3cf50140`  
MERGE_AUTHORITY: OWNER_ONLY  
MERGE_AUTHORIZED: FALSE

## State

Engineering: READY / qualification-gated  
Custody: HELD  
Write authority: WRITE_ALLOWED  
PR disposition: HOLD_DRAFT  
Mergeability entering closeout: TRUE  
Issue Basis: `IB-SUPPORT-PRIMARY-1222-0001`, current  
Qualification scope/question set: reused/current

## LEG-014 result

No product mutation.

A disposable Node 22 qualification workspace was assembled from authenticated GitHub reads of the exact PR-head production modules. Four qualification packs executed the high-risk logic seams independently of GitHub Actions.

Final aggregate result:

```text
27 tests
27 pass
0 fail
```

Covered:
- Primary Support Assembly graph/reconciliation/count authority;
- PS-11167 synthetic explicit dedupe 7 -> 6;
- PS-11236 synthetic explicit unobserved `.4/.5 + DATUM` -> 4;
- ambiguity floor and unsupported-schema fail-closed behavior;
- actual orphan resolver default gates, 2x lateral recovery, ambiguity, reciprocal uniqueness;
- >=3-point branch-override evidence and two-point rejection;
- final cross-traversal geometry withholding while explicit assembly override remains permitted;
- relationship topology MATCH/NO_MATCH/REVIEW/UNAVAILABLE and unique-selection rules;
- Axis Typicality intrinsic invariance, mismatch and unassessed-candidate behavior;
- TypicalityConsensusV1 agreement/conflict/non-promotion rules;
- final-TYPICAL-only Column 22 publication and Column 23 conflict wording.

## Remaining governed gates

NOT_RUN:
- real repository `benchmarks/1885.zip` (`5f27f2d6736693eb21dc2e7981fecad22952819a`) because the isolated execution container cannot receive the private 585,880-byte binary through the available connector/network boundary;
- browser qualification because no executable served PR checkout is available and GitHub Actions still allocates no runner;
- real PS-11167 / PS-11236 Clash-within-Supports qualification because authoritative Owner XML is absent.

GitHub Actions truth remains:
- focused-node `104629105069`: `runner_id=0`, no steps;
- browser `104629105169`: `runner_id=0`, no steps;
- ZIP benchmark `104629105083`: `runner_id=0`, no steps.

These are infrastructure NOT_RUN results, not product failures.

## Drift / review state

At qualification closeout:
- `main` remains `242fc1b1df7e398b64e15a1fd3e2f87d1ff5b581`;
- branch is ahead-only / behind 0;
- PR #1223 remains open/draft/mergeable/unmerged;
- existing reviews are COMMENT-only;
- unresolved review threads: none.

## Disposition

Source/material architecture: PASS.  
Independent executable high-risk logic: PASS 27/27.  
Full governed release qualification: PARTIAL / external gates outstanding.  
PR: HOLD_DRAFT.

## Exact next action

Do not reopen product algorithms absent a concrete failure. Obtain either (a) an executing GitHub-hosted/trusted runner or (b) a trusted connected checkout capable of receiving the governed `1885.zip` and serving browser qualification. Separately provide/pin the real 1835 Clash-within-Supports XML when available. Then execute the remaining governed gates and repeat the ready-for-review disposition.

Mark-ready and merge remain separate fresh Owner-authorized transitions.