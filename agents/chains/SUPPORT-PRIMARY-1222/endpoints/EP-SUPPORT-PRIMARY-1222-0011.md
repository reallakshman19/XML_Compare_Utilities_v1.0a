CHAIN_STATE_VERSION: 3
HANDOVER_PROTOCOL_VERSION: 2
CHAIN_ID: SUPPORT-PRIMARY-1222
ENDPOINT_ID: EP-SUPPORT-PRIMARY-1222-0011
PREVIOUS_ENDPOINT: EP-SUPPORT-PRIMARY-1222-0010
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1222
COMMON_PROTOCOL: engineering-pr-delivery-v2
COMMON_PROTOCOL_BASIS: fed57820909f4984a97d67437340df952b73a5ab
ISSUE_BASIS_ID: IB-SUPPORT-PRIMARY-1222-0001
MAIN_OBSERVED: 242fc1b1df7e398b64e15a1fd3e2f87d1ff5b581
BRANCH: feature/support-primary-assembly-graph
PR: 1223
MATERIAL_LEG: LEG-006
MATERIAL_BASE: 0da0167750d988ac19b8229af1a451a31be4d35e
ENGINEERING_STATE: ACTIVE
CUSTODY_STATE: HELD
WRITE_AUTHORITY: WRITE_ALLOWED
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
QUALIFICATION_SCOPE_ID: QSCOPE-SUPPORT-PRIMARY-1222-ASSEMBLY-SEAM
QUESTION_SET_ID: QS-SUPPORT-PRIMARY-1222-0001
QUESTION_SET_STATUS: CURRENT
QUESTION_PACK_ACTION: REUSED

# LEG-006 prework — Primary Support Assembly release hardening

Owner progression command: `proceed next`.

This leg is intentionally **no-semantic-change hardening** before Column 22 relationship matching.

Allowed objectives:
1. expose production-named shared bore/axis geometry helpers from the existing location grouper and remove orphan production dependency on the `_test` namespace;
2. read orphan configuration from the active Support Report popup and pass it explicitly as `orphanRecoveryConfig` into `buildSupportReportBundle`, while retaining runtime mirror only for compatibility;
3. align `totalSupportPointsOnSecondary` field provenance with the effective assembly/orphan count basis;
4. propagate nested browser import/cache tokens through addon -> engine -> counting/orphan dependencies;
5. add focused tests for these hardening seams.

Allowed production paths:
- `tabs/support-steel-relationship-builder/support-report-location-grouping.js`
- `tabs/support-steel-relationship-builder/support-primary-orphan-recovery.js`
- `tabs/support-steel-relationship-builder/support-report-addon.js`
- `tabs/support-steel-relationship-builder/support-report-engine.js`
- `tabs/support-steel-relationship-builder/support-report-field-projection.js` and/or row provenance enrichment only if needed for count provenance
- `tabs/support-steel-relationship-builder/support-primary-counting.js` only for cache/import routing; no count-policy change
- `tabs/support-steel-relationship-builder/support-steel-relationship-bootstrap.js`
- focused tests and chain/control-plane files.

Hard prohibitions:
- no change to normal bore-axis thresholds or first-pass clustering decisions;
- no change to orphan matching eligibility/geometry/unique-target semantics;
- no change to explicit relationship topology/reconciliation authority;
- no Column 22 / typicality matcher mutation;
- no #1216 Support/Steel producer mutation;
- no workflow mutation;
- no merge.

Qualification must prove by diff/source review that outputs are semantically unchanged except provenance/cache/config plumbing. Repository execution remains NOT_RUN unless Actions actually runs steps.

Exact next action: synchronize this prework endpoint to Issue #1222, then perform only the release-hardening objectives above and stop with LEG-006 receipt + successor endpoint.