# SUPPORT-REPORT-1154-QS-0004 — parser hardening / real-fixture qualification

QUALIFICATION_PROTOCOL_VERSION: 3
QUALIFICATION_PROFILE: PARSER_TOPOLOGY
QUALIFICATION_PROFILE_VERSION: 2
CHAIN_ID: SUPPORT-REPORT-1154
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1154
QUALIFICATION_SCOPE_ID: QSCOPE-SUPPORT-REPORT-PARSER-HARDENING
QUESTION_SET_ID: SUPPORT-REPORT-1154-QS-0004
QUESTION_SET_STATUS: CURRENT
QUESTION_PACK_ACTION: REFRESHED
QUESTION_DISPLAY: SHOW
BASIS_MAIN: d30f5a2bb4db1c46b8ed135613601a6c2f1584ad
COMMON_PROTOCOL_BASIS: af4c5c73b87b26187aa6c930b60172cbb1f0f3e2
OWNER_QUALIFICATION_BASELINE_DISCOVERY: COMPLETE
OWNER_QUALIFICATION_BASELINE_SOURCE: NONE
OWNER_QUALIFICATION_BASELINE_STATUS: NOT_APPLICABLE

This set replaces the WP-002 architecture-conformance scope because the Owner's current `proceed next` advances to WP-003 parser hardening / real-fixture qualification. It is prepared for takeover readiness; the current same custodian does not require a takeover qualification run.

## Q1 — Production trace

Trace one real Navisworks Support Report clash from `<clashtest>` through `support-report-clash-test-context.js`, `support-report-clash-evidence.js`, and `support-report-clash-safety.js` into one canonical evidence row and one `{secondarySupportFamilyId, fullLineTag}` group.

Required evidence:
- preserve clash-test name/GUID/index context and clash name/GUID/status/distance/point provenance;
- identify the single branch-bearing pipe side independently of the non-pipe CU-SU secondary family side;
- show where PS/SL member/family roots, branch node, full line tag, source units and clash point are derived;
- show where unsafe clashes are rejected and duplicate evidence is deduplicated.

Falsifier: any production path that chooses a non-branch CU-SU/GENSEC object as the pipe-side member, or silently discards a usable real clash without a diagnostic.

## Q2 — Current unresolved problem / failure isolation

Reconcile every WP-003 negative case against current main and the durable Owner fixture.

Required derivation:
- fewer than two clash objects;
- no branch-bearing side;
- multiple branch-bearing sides;
- no PS/SL family root;
- conflicting non-pipe PS/SL family roots;
- duplicate clash-member evidence;
- malformed/truncated XML;
- optional/missing smarttags/pathlinks/numeric point attributes;
- unrelated structural clash.

For the real Owner XML, independently count clash rows, branch-bearing candidates, secondary family roots, valid XYZ points and duplicate signatures.

Falsifier: a required negative case has no fail-visible behavior, or the real fixture contains an unsafe shape that current production would silently drop.

## Q3 — Authority / invariant

Prove parser authority stays evidence-only.

Required evidence:
- shared XML entity/numeric normalization remains owned by `ps-family-token-utils.js`;
- parser output may identify clash-side member/family/line evidence but cannot claim complete native support membership;
- test boundaries and group aggregation cannot manufacture missing staged-model members or engineering field values;
- source units are explicit and clash-point coordinates remain provenance-bearing fallbacks rather than native coordinate authority.

Falsifier: parser output is used as complete support-register authority, or a parser fallback synthesizes missing support engineering attributes.

## Q4 — Independent validation

Construct an implementation-independent XML structural oracle for the Owner input and compare it with the current parser safety contract.

Required payload:
- parse the Owner XML with an independent XML parser, not Support Report production code;
- assert 20 clash results;
- assert every clash has exactly two clash objects, exactly one branch-bearing object, exactly one non-pipe PS/SL family root and complete XYZ clash-point attributes;
- independently group by secondary family + full line tag and prove 10 groups, PS-007=5 and SL-097=5;
- independently count duplicate evidence signatures and reconcile them with the production duplicate-warning/dedup policy.

Independent oracle: raw XML tree structure plus the frozen WP-001 fixture/oracle custody, not Support Report production output.

Falsifier: production and oracle disagree on usable-row count/family-line identities, or duplicate handling changes logical group count.

## Q5 — Next contribution / minimal patch

Determine whether WP-003 requires a new production change after reconciliation.

Safe-patch boundary: patch only a concrete still-failing parser invariant demonstrated by the real fixture or a required negative control, with one owner and a focused test.

NO-PATCH boundary:
- no second parser;
- no parser refactor solely for style/line count;
- no changes to grouping/enrichment/XLSX/UI unless required by a parser contract break;
- no mutation of the Owner oracle;
- no staged-model fabrication;
- no merge of PR #1165.

If all WP-003 requirements are already satisfied by current main plus independent fixture evidence, close WP-003 by adoption/evidence rather than creating redundant product code.
