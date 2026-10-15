# Endpoint EP-CSVRC-0007 — owner-authorized merge gate

CHAIN_ID: CSV-REV-COMPARE-1181
PREDECESSOR: EP-CSVRC-0006
MATERIAL_LEG: LEG-006
MATERIAL_HEAD: 3cad67abbc923411cd301db1445ed4e40315ce96
MAIN_OBSERVED: 906df68d73fd5106b259a2d4a807ec3cb34af9ab
PR: 1184
PR_STATE_AT_GATE: OPEN_READY
PR_MERGEABLE_AT_GATE: TRUE
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: TRUE
OWNER_AUTHORIZATION: 2026-09-10T14:44+04:00 — "merge if mergable"

## Delivered capability
Issue #1181 is implemented as CSV/table ingress -> governed Table-to-Categorized-XML profile/graph/XML -> XML-domain lineage/topology comparison -> typed event ledger -> deterministic remark projection -> REV2-style CSV/XLSX plus audit/XML/graph/profile artifacts.

The separate `CSV Rev Compare (XML Based)` Utilities tile is wired beside the existing generic Revision Compare. The UI consumes `runSupportRevisionCompare()` and export/review APIs only; it does not parse or compare CSV rows itself. All 17 specified workflow stages are surfaced, and candidate plus N->M structural ambiguity require explicit review before final CSV/XLSX export.

## LEG-006 hardening
- fail-closed same-area/scope pair gate derived from categorized graph semantics;
- explicit/inferred earlier-to-later revision-order validation;
- structural-review accounting and rejection cleanup;
- candidate-exhaustion evidence on add/remove events;
- pair-validation evidence in audit output;
- governed event IDs plus concrete profile/policy/load-policy versions.

## Validation truth
STATUS: NOT_RUN
OBSERVATION: repository/source inspection only; no executable local checkout was available.
No status checks or PR-triggered workflow runs were present on the #1181 head at the merge gate. Owner raw REV1/REV2 benchmark remains UNRESOLVED / NOT_RUN. No PASS claim is made.

## Drift / mergeability
Current main is 38 commits beyond the original branch point. The main-only changed paths are Support Report typicality/configuration/tests and benchmark ZIPs; they do not overlap the #1181 production/test paths. The PR became GitHub-mergeable immediately after leaving draft state; no rebase was required to satisfy GitHub mergeability.

## Next action
Synchronize CURRENT/ACTIVE/PR handover to this endpoint, re-read live PR head/main/check/review state, then execute the owner-authorized merge only if GitHub still reports mergeable and the head has not moved unexpectedly.
