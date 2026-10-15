# Endpoint checkpoint — EP-SUPPORT-PRIMARY-1222-0028

CHAIN_ID: SUPPORT-PRIMARY-1222  
PREDECESSOR: EP-SUPPORT-PRIMARY-1222-0027  
LEG: LEG-015 — browser coverage validation and test-contract drift cleanup  
PR: #1223  
BRANCH: `feature/support-primary-assembly-graph`  
BASE_MAIN: `242fc1b1df7e398b64e15a1fd3e2f87d1ff5b581`  
TEST_MATERIAL_HEAD_VALIDATED: `afcbc421006a50fbcf55b69a5292c0e1b49cf27d`  
PRODUCT_RUNTIME_MUTATION: NONE  
MERGE_AUTHORITY: OWNER_ONLY  
MERGE_AUTHORIZED: FALSE

## State

Engineering: READY / qualification-gated  
Custody: HELD  
Write authority: WRITE_ALLOWED  
PR disposition: HOLD_DRAFT  
Issue Basis: `IB-SUPPORT-PRIMARY-1222-0001`, current

## LEG-015 result

The post-LEG-014 novice browser regression was source-validated. It exercises current exact-zone selection, current relationship XML, reference Support Report XML, independently scoped reference relationship XML, real build/debug-export plumbing, and left/right relationship-input audit assertions.

The novice handover was corrected: relationship topology, Axis Typicality V1, three-channel consensus, Column 22/23 integration/audit, and reference-side relationship input are already implemented and are not pending algorithm work.

One concrete stale test assertion was found and fixed in `afcbc421006a50fbcf55b69a5292c0e1b49cf27d`: the relationship-conflict test now expects the governed retained-candidate Column 23 wording. The fix is test-only and does not alter production semantics.

## Validation truth

Source/diff review: PASS.  
Browser regression coverage: CODED.  
Full Playwright execution: NOT_RUN in this environment.  
Prior independent high-risk production logic pack: PASS 27/27 at LEG-014.

Fresh exact-head Actions after the test-only fix again executed zero steps:
- qualification run `35060224626`: focused-node `104678784345` / browser `104678784495`, both `steps=null`;
- ZIP run `35060224603`: benchmark `104678784187`, `steps=null`.

These are infrastructure NOT_RUN results, not product failures.

## Remaining governed gates

- real `benchmarks/1885.zip` execution on a trusted exact-head checkout;
- browser execution, including independent current/reference scope and multi-popup orphan-config regression;
- authoritative real 1835 Clash-within-Supports input for PS-11167 / PS-11236 qualification;
- fresh focused Node/browser/ZIP CI once jobs actually receive a runner.

## Disposition

Known production blocker: NONE.  
No algorithm reopening justified.  
PR #1223 remains draft/HOLD_DRAFT.

## Exact next action

Obtain a trusted executing runner/served checkout, run the governed browser + 1885 ZIP gates, and separately pin/run the real 1835 relationship XML when available. Then repeat final readiness review. Do not mark ready or merge without separate fresh Owner authorization.