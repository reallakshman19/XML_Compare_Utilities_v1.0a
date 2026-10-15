# SUPPORT-REPORT-1154-QS-0003 — architecture/code-quality boundary

QUALIFICATION_PROTOCOL_VERSION: 3
QUALIFICATION_PROFILE: GENERAL_ENGINEERING
QUALIFICATION_PROFILE_VERSION: 2
CHAIN_ID: SUPPORT-REPORT-1154
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1154
QUALIFICATION_SCOPE_ID: QSCOPE-SUPPORT-REPORT-ARCHITECTURE-CONFORMANCE
QUESTION_SET_ID: SUPPORT-REPORT-1154-QS-0003
QUESTION_SET_STATUS: CURRENT
QUESTION_PACK_ACTION: REFRESHED
QUESTION_DISPLAY: SHOW
BASIS_MAIN: 1ca7ddb01335d11619209975bc392b8d97c287db
COMMON_PROTOCOL_BASIS: af4c5c73b87b26187aa6c930b60172cbb1f0f3e2
OWNER_QUALIFICATION_BASELINE_DISCOVERY: COMPLETE
OWNER_QUALIFICATION_BASELINE_SOURCE: NONE
OWNER_QUALIFICATION_BASELINE_STATUS: NOT_APPLICABLE

This set replaces the WP-001 XML/golden-parity question scope because the Owner's current `proceed next` advances to WP-002 architecture/code-quality conformance. It is prepared for takeover readiness; the current same custodian does not require a takeover qualification run.

## Q1 — Production trace

Starting at `support-steel-relationship-bootstrap.js`, trace the live Support Report production path through `support-report-addon.js`, clash safety/test-context/evidence parsing, `support-steel-evidence-bundle.js`, `support-report-engine.js`, `support-report-field-projection.js`, the canonical contract, and CSV/XLSX/view consumers.

Required evidence:
- identify the exact module that owns each transition;
- identify where `{secondarySupportFamilyId, fullLineTag}` grouping is formed;
- identify where native family/member/carrier evidence enters;
- identify where field values are projected;
- prove that UI/export code never becomes membership or engineering-value authority.

Falsifier: any second production path independently derives family membership or engineering attributes downstream of the canonical report engine.

## Q2 — Current unresolved problem / failure isolation

Reconstruct why the original prototype's maintainability concern no longer requires a size-driven split on current main, while still identifying any legitimate review trigger.

Required derivation:
- prove every `support-report-*.js` production module is below the repository's 300-line new-file limit;
- inspect `projectGroup` in `support-report-engine.js` and decide whether its longer orchestration is a god-function defect or one coherent row-projection seam;
- distinguish meaningful responsibility extraction from artificial helper fragmentation;
- state the first concrete code smell that would justify a future split.

Falsifier: a current Support Report production module at/above 300 physical lines, or one function that owns independently changeable parser + engineering authority + serialization/UI responsibilities.

## Q3 — Authority / invariant

Prove the one-owner boundaries for shared parsing primitives and report-specific semantics.

Required evidence:
- show that `decodeXmlEntities`, `parseNumber`, and `stripLeadingSlash` come from `tabs/ps-family-clash-audit/ps-family-token-utils.js` in the current Support Report parser;
- explain why the report-specific PS/SL family/member regex remains local rather than blindly reusing a narrower family-root recognizer;
- prove Support/Steel staged-model relationship construction remains native enrichment authority;
- prove `support-report-field-projection.js` may project native attributes but cannot authorize family/member inclusion by itself.

Falsifier: duplicated shared XML/numeric primitive implementations in Support Report, or family-only enrichment that bypasses line/branch custody.

## Q4 — Independent validation

Design an implementation-independent conformance check for WP-002 and reconcile it with the existing repository test surface.

Required payload:
- module size check for every Support Report production JS file against `<300` lines;
- no Support Report `export default`;
- critical dependency-edge checks from bootstrap → addon → parser/engine → projection → export/view/XLSX;
- no local Support Report definitions of the shared XML/numeric primitives;
- no unused Support Report production module;
- explicit distinction between source inspection PASS and tests that remain NOT_RUN.

Independent oracle: repository/Common architecture rules plus the live source graph, not Support Report output values.

Falsifier: a conformance result that declares PASS merely because `tests/startup-module-syntax.test.js` exists without executing or inspecting the relevant source.

## Q5 — Next contribution / minimal patch

Given WP-002 is satisfied by Owner-merged main, identify the smallest safe next contribution under issue #1154 without broadening draft PR #1165.

Required reasoning:
- reconcile that #1165 is WP-001-only and must not silently absorb a later work package;
- identify which WP-003 parser obligations are already satisfied on main and which remain independently unproven against the durable Owner fixture;
- preserve the Owner XLSX/current production contract conflict as a separate WP-005/WP-006 authority issue;
- do not introduce another parser, relationship engine, spreadsheet authority, or guessed staged-model data.

Safe-patch boundary: next material change must target one still-failing/unproven parser or qualification invariant and must have a current-main prework endpoint before mutation.

NO-PATCH boundary: no refactor solely to reduce line count, no mutation of the Owner golden oracle to fit production, no merge of #1165, and no staged-model fabrication.