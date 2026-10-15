CHAIN_STATE_VERSION: 3
HANDOVER_PROTOCOL_VERSION: 2
CHAIN_ID: SUPPORT-PRIMARY-1222
ENDPOINT_ID: EP-SUPPORT-PRIMARY-1222-0009
PREVIOUS_ENDPOINT: EP-SUPPORT-PRIMARY-1222-0008
WORK_ITEM_SOURCE: GITHUB_ISSUE
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1222
WORK_ITEM_MODE: EXCLUSIVE
COMMON_PROTOCOL: engineering-pr-delivery-v2
COMMON_PROTOCOL_BASIS: fed57820909f4984a97d67437340df952b73a5ab
COMMON_PROTOCOL_STATUS: CURRENT
ISSUE_BASIS_ID: IB-SUPPORT-PRIMARY-1222-0001
MAIN_OBSERVED: 242fc1b1df7e398b64e15a1fd3e2f87d1ff5b581
BRANCH: feature/support-primary-assembly-graph
PR: 1223
PR_HEAD_OBSERVED: e45dc55d17df8f83846d7ad86b5f0f4b5a2339fc
NEXT_MATERIAL_LEG: LEG-005
ENGINEERING_STATE: ACTIVE
CUSTODY_STATE: HELD
QUALIFICATION_STATE: NOT_REQUIRED
WRITE_AUTHORITY: WRITE_ALLOWED
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
COORDINATION_STATE: SAFE
OWNER_PROGRESSION_COMMAND: proceed next
QUALIFICATION_SCOPE_ID: QSCOPE-SUPPORT-PRIMARY-1222-ASSEMBLY-SEAM
QUESTION_SET_ID: QS-SUPPORT-PRIMARY-1222-0001
QUESTION_SET_STATUS: CURRENT
QUESTION_PACK_ACTION: REUSED
QUESTION_DISPLAY: HIDE
TAKEOVER_QUALIFICATION_READY: TRUE

# Material objective

Implement WP-PSA-005 as a second-pass conservative geometry orphan resolver. Do not widen the normal bore-axis grouping tolerance. The resolver consumes existing canonical location groups plus `SupportPrimaryReconciliation.v1` assignments and may only recover unresolved/provisional (`GEOMETRY_ONLY`) groups.

# Frozen default profile

```text
Enable orphan resolver            ON
Axial tolerance multiplier        1.0
Lateral tolerance multiplier      2.0
Same PS/SL family                 ON
Same PIPE                         ON
Same Bore                         ON
Require unique target             ALWAYS ON
```

The three compatibility gates are user-configurable checkboxes. Axial/lateral multipliers are user-configurable non-negative numeric values. Unique-target enforcement is fixed and cannot be disabled.

# Resolver authority and ordering

```text
normal bore-axis grouping
  -> explicit relationship reconciliation
  -> conservative orphan recovery
  -> final family count projection
```

- Explicit support-member connectivity remains higher authority than geometry.
- `EXPLICIT_ASSEMBLY`, `PARTIAL_EXPLICIT`, `CONFLICT`, and `SYMBOLIC_ONLY` groups are never remapped by orphan recovery.
- Only `GEOMETRY_ONLY` groups may be sources.
- Targets may be exact explicit assemblies or provisional geometry groups when all enabled gates and recovery geometry pass.
- Two different explicit assembly IDs can never be joined.
- If one orphan qualifies for multiple distinct target identities, emit `ORPHAN_AMBIGUOUS` and do not merge.
- Provisional-to-provisional auto-merge requires reciprocal unique targeting; this prevents star/transitive recovery from hiding local ambiguity.
- Multiple provisional orphans may independently recover to one explicit assembly only when each has that one unique explicit target.

# Compatibility / traversal policy

- Same Family compares normalized secondary PS/SL family identity.
- Same PIPE compares exact normalized `fullLineTag`.
- Same Bore compares derived nominal bore (DN/mm).
- Enabled gate with missing evidence fails closed.
- Differing branch/traversal nodes may be overridden only when **all three** Family/PIPE/Bore gates are enabled and pass, and target uniqueness is satisfied, matching Issue #1222.
- If any one of those guard checkboxes is disabled, differing branch nodes are not auto-overridden.

# Geometry policy

Use the existing Support Report pipe-axis authority; do not invent pair-to-pair axes.

For source-to-target representative-point delta and trusted pipe/traversal axis:

```text
axialMm   = |D dot T|
lateralMm = |D - (D dot T)T|

baseAxialToleranceMm   = 4 * Bore
baseLateralToleranceMm = 0.5 * Bore + 25

recoveryAxialToleranceMm   = baseAxialToleranceMm * axialMultiplier
recoveryLateralToleranceMm = baseLateralToleranceMm * lateralMultiplier
```

Audit must retain measured axial/lateral values, base thresholds, recovery thresholds, axis basis/confidence, gate results, candidate target IDs and final recovery status.

If trusted axis, point, family, pipe or bore evidence required by the active policy is unavailable, recovery does not guess.

# Count integration

- Without explicit relationship authority, recovered provisional groups deduplicate by recovered occurrence ID; otherwise existing geometry-group count is preserved.
- With explicit relationship authority, orphan recovered to an explicit assembly contributes no extra geometry occurrence.
- Recovered provisional-to-provisional pairs contribute one geometry occurrence.
- Unrecovered/ambiguous provisional groups remain independently countable.
- Existing PARTIAL/CONFLICT ambiguity floor remains conservative and cannot be reduced by orphan recovery.
- `Multiple primary support` continues to derive only from the final family count.

# UI / audit boundary

Add a compact Support Report orphan-recovery configuration section with the five requested editable controls (enabled, axial multiplier, lateral multiplier, Same Family, Same PIPE, Same Bore) and fixed `Require unique target: Always on` policy text. Configuration changes invalidate the built report.

Expose resolver schema/config/summary at report level and per-row recovery status/basis/target/candidate/geometry metrics in evidence/JSON-debug surfaces. Do not make recovery a Support/Steel carrier authority.

# Required controls

1. Recovery disabled => exact pre-LEG-005 count behavior.
2. Same family/pipe/bore + trusted axis + lateral residual outside base but inside 2x recovery => unique orphan merges.
3. One orphan with two qualifying target identities => `ORPHAN_AMBIGUOUS`, no merge.
4. Distinct explicit assembly IDs at coincident/near XYZ remain separate.
5. Differing branch nodes recover only under all three enabled-and-passing guards plus unique target.
6. Missing required bore/axis evidence remains unresolved.
7. Existing PS-12060=1, PS-12877=4, PS-12860=6, PS-12120=14 remain protected; no real-suite PASS claim until executed.
8. PS-11167=6 and PS-11236=4 remain real-input NOT_RUN until the actual relationship/benchmark input is available.
9. Column 22 matcher/consensus remains unchanged.
10. #1216 Support/Steel producer authority remains unchanged.

# Allowed material paths

- `tabs/support-steel-relationship-builder/support-primary-orphan-recovery.js` (new)
- `tabs/support-steel-relationship-builder/support-primary-counting.js`
- `tabs/support-steel-relationship-builder/support-report-location-grouping.js` only for shared axis/bore measurement exports with no grouping behavior change
- `tabs/support-steel-relationship-builder/support-report-engine.js`
- `tabs/support-steel-relationship-builder/support-report-row-enrichment.js` only if required for audit propagation
- `tabs/support-steel-relationship-builder/support-report-addon.js`
- `tabs/support-steel-relationship-builder/support-steel-relationship-bootstrap.js` cache routing only
- focused `tests/support-primary-orphan-*.test.mjs` / narrow existing UI tests
- chain relay/workreport/material receipt files

# Explicit no-patch boundary

Do not change:
- normal location-group tolerance constants or grouping acceptance;
- relationship graph component semantics;
- zone scope semantics;
- #1216 Support/Steel producer logic;
- Column 22 / typicality matcher or consensus;
- workflow files;
- merge state.

# Validation truth entering LEG-005

PASS:
- live Common skill re-grounded at the Owner-pinned commit;
- Issue #1222 directly specifies the orphan profile and branch-override rule;
- main remains `242fc1b1...`;
- PR #1223 remains draft/open/mergeable at `e45dc55...`;
- EP-0008 issue/repository handover is IN_SYNC;
- qualification scope/Q-set remains current and is reused for this `proceed next`.

NOT_RUN:
- LEG-005 repository tests;
- browser interaction qualification;
- protected real benchmark suite;
- real PS-11167 / PS-11236 relationship benchmark.

# Exact next action

Synchronize EP-0009 to `ACTIVE.md`, `issue-state/CURRENT.md` and Issue #1222 before product mutation. Then implement LEG-005 strictly inside the frozen boundary, run isolated focused qualification where possible, inspect material diff/reviews/checks, create LEG-005 receipt + successor endpoint, synchronize the Issue/PR description, and stop. Do not merge.