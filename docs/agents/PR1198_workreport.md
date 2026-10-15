# PR1198 — Support Report staged POS-cluster trace remediation

PARENT_ISSUE: #1154
CHILD_ISSUE: #1196
PR: #1198
BASE_AT_PR_OPEN: 2b473ae1c4e93d92ad2af8e0716bd8e72ac2eab0
CURRENT_MAIN_AT_VALIDATION: d00ff0d0e094eff52b16d339105573ada9c0f9c7
BRANCH: agent/support-report-1196-pos-trace
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: TRUE_CONDITIONAL_DONE
PR_STATE: READY_FOR_OWNER_AUTHORIZED_MERGE
RECOVERY_STATE: COMPLETE_PENDING_MERGE

## Mission
Correct Support Report staged-JSON trace and coordinate/member authority after Owner browser acceptance exposed that JSON trace was member-oriented rather than POS-cluster-oriented.

## Final implementation
- `SupportReportJsonTrace.v2` retains member-level rows and adds deterministic `posClusters`.
- Native positions are clustered at 0.001 mm normalization precision; missing native POS is explicit `UNRESOLVED_POS`.
- POS clusters aggregate observed IDs, resolved native IDs and match bases without collapsing Support Report rows.
- Support Report UI renders one trace row per POS cluster and separately displays the Navisworks report location.
- only real selected native staged members may become `FAMILY_LINE_ENRICHMENT`; synthetic fallback objects never enter that trace path.
- family-only PS/SL tokens remain observed evidence but are filtered from proven primary-support membership.
- report E/W, N/S and BOP use Navisworks clash/report-location coordinates; staged native POS remains trace evidence until coordinate-frame/base-anchor qualification exists.
- staged `BORE` is normalized to numeric-mm SIZE; accepted fallback bore aliases are secondary; line-tag fallback uses the standard NPS→DN map.
- PREV NAME values equal to the current member ID are suppressed; genuine prior identities remain.
- cache routing was advanced through engine/view/addon/bootstrap.
- Support Report CI now permanently covers POS trace, JSON trace/UI, field projection/RCA, location benchmarks, typicality and browser qualification.

## Protected invariants
- direct PS/SL identity remains preferred; PREV-NAME remains explicit rename evidence;
- coordinate/base-anchor identity matching remains inactive;
- native POS clustering is evidence grouping, not row/member matching authority;
- separate Navisworks report locations are never merged by native POS;
- PS-12154 same-location behavior and PS-12120 multi-location behavior remain protected;
- CU-PI/CU-PL Site/Zone hierarchy remains unchanged;
- Owner workbook values are never production engineering input.

## Changed-file ledger
Production:
- `support-report-json-trace.js`
- `support-report-row-enrichment.js`
- `support-report-engine.js`
- `support-report-field-normalization.js` (new)
- `support-report-field-projection.js`
- `support-report-view.js`
- `support-report-addon.js`
- `support-steel-relationship-bootstrap.js`

Qualification / tests:
- `.github/workflows/support-report-typicality-qualification.yml`
- `support-report-pos-trace-remediation.test.mjs` (new)
- `support-report-json-trace-ui.test.mjs`
- `support-report-field-projection.test.mjs`
- `support-report-field-projection-rca.test.mjs`
- `ps-family-clash-audit-benchmark-readiness.test.js`

## Validation status
Validated on PR merge-ref containing #1198 plus current `main@d00ff0d0e094eff52b16d339105573ada9c0f9c7`.

- Support Report focused qualification: PASS — 67/67 tests, 0 failures.
- #1196 POS-remediation tests: PASS — same-POS clustering, Navisworks report-coordinate authority, family-only evidence filtering, PREV NAME and SIZE normalization.
- PS-12154 controls: PASS — same-location REST/GUIDE remains one row with no multi-location remark; CU-PI Site/Zone recovered.
- PS-12120 controls: PASS — full 19-clash benchmark -> 14 location-aware rows across 9 pipes; five-location repeated pipe preserved.
- JSON trace UI POS-cluster rendering: PASS.
- staged BORE / Site-Zone RCA tests: PASS.
- Support/Steel Playwright browser qualification: PASS.
- Support Report Typicality ZIP Benchmark + relaxed and selected-family diagnostics: PASS.
- PR reviews: 0; review threads: 0.
- Full repository-wide test suite outside the Support Report qualification scope: NOT_RUN; not a package merge blocker because changed runtime paths are covered by the focused Node, browser and ZIP gates above.

## Validation repairs
The first expanded focused run exposed two stale assertions rather than runtime defects:
1. a pre-existing global startup test still expected an obsolete July cache token no longer present on current main; it was removed from this Support Report workflow rather than changing unrelated startup behavior;
2. an older field-provenance test expected clash-path Site/Zone authority although merged RCA #1182 intentionally made native staged `sourcePath` authoritative; the expectation was corrected to `NATIVE_MEMBER_PATH`.
The rerun passed 67/67.

## Base drift
The branch started at `e1ccdf236588018f304be5942c92b587e3145f6e`. During validation main advanced through #1199 to `d00ff0d0e094eff52b16d339105573ada9c0f9c7` (25 mm typicality envelope tolerance). GitHub Actions checked out the PR merge ref against that newer main, and the focused/browser/ZIP validation passed on the integrated state.

## Merge gate
Owner instruction: `merge if done, anything pending?`, followed by `proceed next`.
The package-scoped completion condition is satisfied. Merge is authorized only for the validated #1198 head after final mergeability re-check and exact-head-SHA guard.

EXACT_NEXT_ACTION: re-check #1198 mergeability/head; mark ready for review; merge with expected head SHA; then close #1196 and update #1154 with the merge receipt.
