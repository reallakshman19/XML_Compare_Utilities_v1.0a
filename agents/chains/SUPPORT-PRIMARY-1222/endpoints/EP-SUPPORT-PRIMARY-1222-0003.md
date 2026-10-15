CHAIN_STATE_VERSION: 3
HANDOVER_PROTOCOL_VERSION: 2
CHAIN_ID: SUPPORT-PRIMARY-1222
ENDPOINT_ID: EP-SUPPORT-PRIMARY-1222-0003
PREVIOUS_ENDPOINT: EP-SUPPORT-PRIMARY-1222-0002
WORK_ITEM_SOURCE: GITHUB_ISSUE
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1222
WORK_ITEM_MODE: EXCLUSIVE
AGENT_INSTANCE_ID: chatgpt:dc64d516-9c68-47d5-98f5-64cc74bb093c
COMMON_PROTOCOL: engineering-pr-delivery-v2
COMMON_PROTOCOL_BASIS: fed57820909f4984a97d67437340df952b73a5ab
COMMON_PROTOCOL_STATUS: CURRENT
ISSUE_BASIS_ID: IB-SUPPORT-PRIMARY-1222-0001
ISSUE_CURRENT_STATE_FILE: agents/chains/SUPPORT-PRIMARY-1222/issue-state/CURRENT.md
MAIN_OBSERVED: 242fc1b1df7e398b64e15a1fd3e2f87d1ff5b581
BRANCH: feature/support-primary-assembly-graph
PR: 1223
PR_STATE: OPEN_DRAFT
PR_HEAD_OBSERVED: cc074770646882ccb9c8852bb72755e106eae9ae
PR_MERGEABLE: TRUE
REVIEWS: NONE
UNRESOLVED_REVIEW_THREADS: NONE
REQUIRED_CHECKS: workflow runs present but jobs failed before steps; engineering validation status remains NOT_RUN
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE

ENGINEERING_STATE: ACTIVE
CUSTODY_STATE: HELD
QUALIFICATION_STATE: NOT_REQUIRED
WRITE_AUTHORITY: WRITE_ALLOWED
AUTO_STATE: NOT_APPLICABLE
COORDINATION_STATE: SAFE

QUALIFICATION_SCOPE_ID: QSCOPE-SUPPORT-PRIMARY-1222-ASSEMBLY-SEAM
QUESTION_SET_ID: QS-SUPPORT-PRIMARY-1222-0001
QUESTION_SET_STATUS: CURRENT
QUESTION_PACK_ACTION: REUSED
PREWORK_QUALIFICATION_READY: TRUE

MATERIAL_LEG: LEG-002
MATERIAL_LEG_BASE: cc074770646882ccb9c8852bb72755e106eae9ae
PREVIOUS_MATERIAL_LEG: LEG-001
MATERIAL_SCOPE: Pure reconciliation of existing Support Report geometry groups against explicit SupportPrimaryRelationshipBundle assemblies; no final count migration and no Column 22 authority change.

# Re-grounding

- `main` is unchanged from the prior endpoint.
- PR #1223 is open, draft and mergeable.
- No PR reviews or review threads exist.
- Both Support Report workflows still fail before any job steps are emitted. This is infrastructure/non-execution evidence and is retained as `NOT_RUN`, not a product-code failure.
- Real 1835 Clash-within-Supports input remains unpinned, so PS-11167=6 and PS-11236=4 cannot be promoted to PASS.
- #1216 producer authority remains protected; LEG-002 will consume only the canonical assembly bundle and existing Support Report location groups.

# LEG-002 bounded design

Introduce one pure reconciliation seam that maps each existing geometry/location group to explicit primary-support assembly evidence without changing the report decision owner yet.

Required behavior:

1. If every concrete observed member in a location group maps to the same explicit assembly, return `EXPLICIT_ASSEMBLY` with that stable assembly ID.
2. If concrete observed members map to multiple explicit assemblies, return `CONFLICT` and do not choose one.
3. If only some observed concrete members map to one explicit assembly, return `PARTIAL_EXPLICIT` and do not silently absorb unmapped members.
4. If no observed member maps to explicit evidence, retain a deterministic provisional geometry-group identity with `GEOMETRY_ONLY` basis.
5. Symbolic/DATUM members never make an assignment countable by themselves.
6. No geometry tolerance, grouping, final family count, report remark trigger, Column 22 matcher, zone UI or Support/Steel producer behavior changes in this leg.

# Validation plan

Focused synthetic tests must cover:
- two geometry groups whose members resolve to one explicit assembly;
- one geometry group spanning two explicit assemblies -> conflict;
- partial explicit membership remains partial;
- no explicit evidence -> deterministic geometry-only provisional ID;
- DATUM/symbolic evidence does not create countable assignment.

Repository execution may remain NOT_RUN if Actions does not execute; committed tests are not PASS by existence.

# Falsifier / rollback

If reconciliation requires changing existing location grouping or tolerances to work, stop: the new seam is incorrectly scoped. If a location group crosses explicit assembly IDs, it must stay a visible conflict rather than selecting the nearest/first assembly.

# Exact next action

Commit this prework endpoint before any LEG-002 product change, synchronize PR #1223 into ACTIVE/current issue state and issue comments, then implement only the pure reconciliation module and focused tests. Do not merge.