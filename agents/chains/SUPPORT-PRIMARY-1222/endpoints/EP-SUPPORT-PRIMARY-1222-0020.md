# EP-SUPPORT-PRIMARY-1222-0020 — LEG-011 prework

CHAIN: SUPPORT-PRIMARY-1222
WORK_ITEM: github:reallaksh19/XML_Compare_Utilities#1222
RELATED_TYPICALITY_ISSUE: #1179
PR: #1223
BRANCH: feature/support-primary-assembly-graph
OWNER_PROGRESSION_COMMAND: proceed next
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE

## Purpose

Bounded release-readiness / qualification-consolidation leg for PR #1223. This leg is primarily an audit and qualification leg, not a new authority-source or matcher-development leg.

## Grounded starting state

- current `main`: `242fc1b1df7e398b64e15a1fd3e2f87d1ff5b581`;
- PR #1223 head at prework: `001f82f7ec7058efdf0296afc4dfeebe6ae40ef1`;
- compare state: branch is 179 commits ahead, 0 behind, no base drift;
- PR: open, draft, mergeable, unmerged;
- latest material leg: LEG-010 at `a47af97cda0539751bfad2de5f8ee0844ce83fc6`;
- active endpoint entering this leg: EP-SUPPORT-PRIMARY-1222-0019.

## Frozen scope

1. Re-ground the complete PR diff against current `main` and classify product vs control-plane changes.
2. Audit protected authority invariants:
   - #1216 remains Support/Steel producer authority;
   - explicit support-member topology outranks geometric recovery;
   - DATUM/reference nodes do not inflate count;
   - normal occurrence tolerance remains unchanged;
   - explicit distinct assemblies cannot be orphan-merged;
   - structural, relationship and axis matchers remain independent;
   - secondary matchers cannot promote structural rejection/ambiguity;
   - Column 22 only publishes final `TYPICAL`.
3. Audit the Owner operational report contract:
   - 21-column base report unchanged;
   - comparison columns 22–24 unchanged in identity/order;
   - intentional Trace/Debug version advance to v4 is isolated to diagnostic exports.
4. Sweep protected oracles from source/tests and report exact execution status:
   - PS-11167 = 6;
   - PS-11236 = 4;
   - PS-12060 = 1;
   - PS-12877 = 4;
   - PS-12860 = 6;
   - PS-12120 = 14;
   - PS-11168 -> PS-14168 positive structural typicality.
5. Review UI/browser contracts for current/reference relationship inputs, exact zone scope, orphan controls, Column 22/23 publication and multi-popup isolation.
6. Re-check PR reviews/threads and Actions at the exact release-readiness head. If jobs still have no steps, record execution as `NOT_RUN`, not product failure.
7. Produce a readiness disposition:
   - `READY_FOR_REVIEW` only if no source/material blocker remains;
   - otherwise `HOLD_DRAFT` with exact blockers.

## Explicit non-goals

- no matcher threshold retuning;
- no new authority source;
- no global tolerance widening;
- no merge;
- no mark-ready transition without a separate fresh Owner instruction even if the technical disposition is READY_FOR_REVIEW;
- no benchmark claim for real PS-11167/PS-11236 relationship evidence while the actual Owner Clash-within-Supports input remains unpinned.

## Allowed material changes

Only release-readiness fixes discovered by this audit may be patched, and only if they are clearly correctness/contract defects within already-authorized Support Report paths. Any such patch must preserve matcher/count semantics unless the defect itself is a publication/contract violation. Control-plane/test-only additions are allowed for audit evidence.

## Qualification truth at prework

Repository execution is still `NOT_RUN`: prior Actions jobs fail before any steps (`steps=null`). Source/material review through LEG-010 is PASS. Real Owner relationship benchmark input remains unavailable.

## Exact next action

Audit the complete PR product diff and contract invariants. If a concrete correctness defect is found, patch the smallest possible seam and add a focused regression. Otherwise close LEG-011 as a qualification/readiness receipt. Do not merge or mark ready.