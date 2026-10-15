CHAIN_STATE_VERSION: 3
HANDOVER_PROTOCOL_VERSION: 2
CHAIN_ID: SUPPORT-PRIMARY-1222
ENDPOINT_ID: EP-SUPPORT-PRIMARY-1222-0005
PREVIOUS_ENDPOINT: EP-SUPPORT-PRIMARY-1222-0004
WORK_ITEM_SOURCE: GITHUB_ISSUE
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1222
WORK_ITEM_MODE: EXCLUSIVE
COMMON_PROTOCOL: engineering-pr-delivery-v2
COMMON_PROTOCOL_BASIS: fed57820909f4984a97d67437340df952b73a5ab
ISSUE_BASIS_ID: IB-SUPPORT-PRIMARY-1222-0001
MAIN_OBSERVED: 242fc1b1df7e398b64e15a1fd3e2f87d1ff5b581
BRANCH: feature/support-primary-assembly-graph
PR: 1223
PREWORK_FOR_MATERIAL_LEG: LEG-003
PREWORK_BRANCH_HEAD: 966ff3ce319867e6c06d4844f29b674b89f88568
ENGINEERING_STATE: ACTIVE
CUSTODY_STATE: HELD
QUALIFICATION_STATE: NOT_REQUIRED
WRITE_AUTHORITY: WRITE_ALLOWED
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
COORDINATION_STATE: SAFE
QUALIFICATION_SCOPE_ID: QSCOPE-SUPPORT-PRIMARY-1222-ASSEMBLY-SEAM
QUESTION_SET_ID: QS-SUPPORT-PRIMARY-1222-0001
QUESTION_SET_STATUS: CURRENT
QUESTION_PACK_ACTION: REUSED

# Purpose

Prework checkpoint for WP-PSA-006 count migration. This leg may change `TOTAL SUPPORT POINTS ON SECONDARY` and the `Multiple primary support` trigger, but only through the already-established primary-support topology/reconciliation seam.

# Live-state reconciliation

- Main is unchanged at `242fc1b1df7e398b64e15a1fd3e2f87d1ff5b581`.
- PR #1223 remains open, draft and mergeable.
- No submitted reviews or unresolved review threads were present at the previous completed endpoint.
- GitHub Actions remains infrastructure-blocked: latest jobs expose zero executed steps / runner_id=0, so repository qualification remains NOT_RUN.
- Real Owner 1835 Clash-within-Supports XML remains unpinned; PS-11167=6 and PS-11236=4 cannot be claimed as real-input PASS in this leg unless that input becomes available.

# Leg diagnosis

Current location grouping writes family totals by counting geometry/location groups. LEG-001 created explicit primary-support assemblies and LEG-002 reconciles each existing location group into one of:

- `EXPLICIT_ASSEMBLY`
- `GEOMETRY_ONLY`
- `PARTIAL_EXPLICIT`
- `CONFLICT`
- `SYMBOLIC_ONLY`

The final count consumer is still missing. This leg will add that consumer without changing the underlying bore-axis grouping algorithm.

# Count policy frozen before mutation

1. If no valid `SupportPrimaryRelationshipBundle.v1` evidence exists for a family, preserve the existing geometry-family count exactly.
2. If valid explicit topology exists for a family, count every countable explicit assembly in that family, including explicit assemblies not represented by a current Support Report location group.
3. Add one fallback occurrence for each existing geometry group whose concrete members have no explicit assembly mapping (`GEOMETRY_ONLY`).
4. Exact explicit mappings that land on the same assembly ID deduplicate to one occurrence even when current geometry produced multiple groups.
5. `DATUM` / symbolic-only evidence never increments the count.
6. If a family contains `PARTIAL_EXPLICIT` or `CONFLICT` assignment state, do not silently reduce below current geometry evidence. Use a fail-visible conservative floor: final count is at least the existing geometry-group count and at least the explicit+unmapped derived minimum; retain an ambiguity count basis/diagnostic.
7. Geometry-only fallback remains one occurrence per existing location group; provisional identity must not collapse two distinct pre-existing location groups merely because their content is similar.
8. `Multiple primary support` is driven by final family assembly count > 1, not by `multipleLocationsOnPipe`.

# Protected controls

The following established no-explicit-input cases must remain unchanged:

- PS-12060 = 1
- PS-12877 = 4
- PS-12860 = 6
- PS-12120 = 14

Synthetic count controls to add in this leg:

- separated `/PS-11167.2` and `/PS-11167.11` groups + explicit edge => one assembly contribution instead of two;
- explicit unobserved `/PS-11236.4 <-> /PS-11236.5` assembly still contributes to family total;
- DATUM-only evidence does not add count;
- conflict/partial states fail visible and do not reduce below legacy geometry count;
- unsupported relationship schema has no count authority.

# Allowed product paths

- `tabs/support-steel-relationship-builder/support-primary-reconciliation.js` only if provisional identity needs correction for count preservation;
- a new focused count-projection module under `tabs/support-steel-relationship-builder/`;
- `support-report-engine.js` for wiring the count projection before row projection;
- `support-report-row-enrichment.js` and/or `support-report-field-projection.js` only for final remark/provenance semantics;
- focused tests and relay/workreport files.

# Explicitly out of scope

- bore-axis tolerance changes;
- orphan resolver implementation;
- zone-selection UI;
- optional relationship-XML UI ingestion;
- Column 22 / typicality decision logic;
- #1216 Support/Steel carrier/steel production authority;
- merge.

# Falsifiers

- Any no-explicit-input benchmark changes count.
- A DATUM/reference node increases family count.
- An unsupported/unversioned relationship object changes count.
- A partial/conflict family is silently assigned a lower count than legacy geometry evidence.
- Two different explicit assembly IDs are merged by geometry.
- Count code begins parsing Clash-within-Supports XML directly rather than consuming the typed relationship bundle.

# Exact next action

Commit this prework endpoint and synchronize ACTIVE/CURRENT + issue Active Handover. Then implement LEG-003 within the allowed paths, add isolated/focused count tests, inspect the material diff, and record a receipt/end endpoint. Do not touch Column 22 and do not merge.