CHAIN_STATE_VERSION: 3
HANDOVER_PROTOCOL_VERSION: 2
CHAIN_ID: SUPPORT-PRIMARY-1222
ENDPOINT_ID: EP-SUPPORT-PRIMARY-1222-0014
PREVIOUS_ENDPOINT: EP-SUPPORT-PRIMARY-1222-0013
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1222
RELATED_TYPICALITY_ISSUE: github:reallaksh19/XML_Compare_Utilities#1179
COMMON_PROTOCOL: engineering-pr-delivery-v2
COMMON_PROTOCOL_BASIS: fed57820909f4984a97d67437340df952b73a5ab
ISSUE_BASIS_ID: IB-SUPPORT-PRIMARY-1222-0001
MAIN_OBSERVED: 242fc1b1df7e398b64e15a1fd3e2f87d1ff5b581
BRANCH: feature/support-primary-assembly-graph
PR: 1223
MATERIAL_LEG: LEG-008
MATERIAL_BASE: fefa4d24ac2bd3254252a38d516abbb6e389153b
ENGINEERING_STATE: ACTIVE
CUSTODY_STATE: HELD
WRITE_AUTHORITY: WRITE_ALLOWED
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
QUALIFICATION_SCOPE_ID: QSCOPE-SUPPORT-PRIMARY-1222-ASSEMBLY-SEAM
QUESTION_SET_ID: QS-SUPPORT-PRIMARY-1222-0001
QUESTION_SET_STATUS: CURRENT
ISSUE_ENDPOINT_COMMENT_ID: 5683638328
RELATED_TYPICALITY_STATUS_COMMENT_ID: 5683641129
ISSUE_HANDOVER_SYNC_STATUS: IN_SYNC

# LEG-008 prework — Axis Typicality V1

Owner progression command: `proceed next`.

This leg adds a third independent family-level typicality evidence channel named `AXIS_TYPICALITY_V1`. It reuses the canonical Support Report pipe-axis primitive but compares only intrinsic translation/rotation/reflection-safe descriptors. The existing structural matcher and `RELATIONSHIP_TOPOLOGY_V1` remain read-only decision channels.

## Core invariants

- NEVER compare raw global axis vectors between XMLs.
- NEVER require the two models to share global orientation or origin.
- Reuse production-named geometry helpers from `support-report-location-grouping.js`; do not duplicate PCA/power-iteration math.
- Axis ambiguity or insufficient evidence is `UNAVAILABLE`, not `NO_MATCH`.
- Axis evidence alone must not promote an existing structural `NO_MATCH`/`AMBIGUOUS` into a Column 22 match in this leg.
- No mutation of first-pass support grouping, orphan recovery, count policy, #1216 producer authority, or structural typicality scoring/gates.

## Intended intrinsic family signature

- trusted local traversal axis evidence from canonical Support Report axis geometry;
- DN-normalized along-axis/lateral support-spacing spectrum (`A/Bore`, `L/Bore`);
- unsigned relative traversal-axis angle spectrum `acos(|T1 dot T2|)` computed only within each model;
- traversal cardinality / locations-per-traversal / return-revisit descriptors;
- trusted/unavailable axis counts and normalized-pair availability metadata.

## Decision contract

Schema: `SupportReportAxisTypicalityAudit.v1`; profile: `AXIS_TYPICALITY_V1`.
Result enum: `MATCH | NO_MATCH | REVIEW | UNAVAILABLE`.

- insufficient trusted axis/pair evidence on either side -> `UNAVAILABLE`;
- materially incomplete informed evidence -> `REVIEW`;
- intrinsic topology exact + spectra within named/versioned tolerances -> `MATCH`;
- informed hard descriptor mismatch -> `NO_MATCH`.

## Consensus integration

- structural + relationship + axis same candidate -> strongest confidence;
- structural + axis same candidate while relationship unavailable -> confidence rises over structural-only;
- axis unavailable -> retain prior structural/relationship consensus;
- informed axis contradiction -> `REVIEW / CONFLICT`;
- relationship/axis-only candidate cannot promote structural rejection in LEG-008.

## Allowed paths

- new `support-report-axis-typicality.js`;
- `support-report-typicality-projection.js` consensus attachment only;
- addon/bootstrap cache routing only if required;
- focused tests and engineering control-plane files.

## Required controls

1. arbitrary rigid rotation + translation preserves `MATCH`;
2. axis sign reversal/reflection preserves `MATCH`;
3. DN-normalized spacing mismatch -> `NO_MATCH`;
4. relative traversal-angle mismatch -> `NO_MATCH`;
5. insufficient axis evidence -> `UNAVAILABLE`;
6. traversal/return mismatch -> informed mismatch/review;
7. structural matcher output invariant;
8. relationship matcher output invariant;
9. structural candidate + axis contradiction -> conflict review;
10. axis-only candidate cannot promote structural rejection.

No workflows and no merge.