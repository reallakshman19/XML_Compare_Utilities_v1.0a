# PR1208 — Support Report physical-location and per-row member attribution remediation

PARENT_ISSUE: #1154
DEPENDENCY_ISSUE: #1201
DEPENDENCY_PR: #1202
CHILD_ISSUE: #1206
PR: #1208
BASE_BRANCH: agent/support-report-1201-trace-export
BRANCH: agent/support-report-1206-location-attribution
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
PR_STATE: OPEN_DRAFT
RECOVERY_STATE: VALIDATED_RUNTIME_AWAIT_FINAL_HEAD

## Mission
Correct two defects exposed by the Owner-uploaded 1,321-row Support Report: clash contact points from one concrete PS/SL support member could be over-split into multiple physical report locations, and staged members matching the same family+line could be broadcast into every location row after a genuine split.

## Root cause
1. `support-report-location-grouping.js` used only Euclidean clash-point distance <= 50 mm as its connected-components adjacency rule.
2. `support-report-engine.js::selectMembersForGroup()` found the full family-line staged member set before location-specific row enrichment; the old enrichment path did not narrow that set for multi-location rows.

## Implemented behavior
- Same concrete member identity (`/PS-xxxxx.n` or `/SL-xxxxx.n`) is now an additional physical-location clustering edge, independent of contact-point spread.
- Different concrete members continue to use the governed report-location tolerance, default 50 mm.
- Family-only and unresolved tokens never force identity clustering.
- Multi-location rows restrict family-line staged enrichment to directly observed member identities for that row; PREV-NAME resolution can still map an observed prior ID to the authoritative current staged member.
- Single-location pipes retain family-line staged enrichment so established complete-member enrichment is not globally weakened.
- `TOTAL SUPPORT POINTS ON SECONDARY` continues to derive from the resulting physical report-row grain.
- Trace CSV / Debug JSON now expose `LOCATION GROUPING BASIS` and `MEMBER ATTRIBUTION BASIS`.
- Trace summary adds same-concrete-member, within-50-mm, and multi-location observed-only attribution counters.
- Browser/runtime cache routing is advanced through clash safety, engine, row enrichment, trace exporter, addon and Support/Steel bootstrap.

## Protected invariants
- PS-12154 `/PS-12154.2` + `/PS-12154.5` remains one report row by the <=50 mm location rule and receives no multi-location remark.
- PS-12120 repeated `P8810365` remains five distinct physical locations and retains `Pipe supported at multiple locations` on each affected row.
- Navisworks clash/report location remains report E/W, N/S and BOP authority.
- Native JSON POS remains trace evidence only; coordinate/base-anchor identity matching remains inactive.
- Direct PS/SL identity remains preferred; PREV-NAME remains explicit rename evidence.
- The normal Support Report remains the Owner 21-column contract.

## Validation on runtime head c2c90b89899d0e74627d572e5fa43160bfd2fb8c
- Focused Support Report qualification: PASS — 75/75 tests.
- New #1206 location/attribution tests: PASS.
- Same-member >50 mm contact points collapse: PASS.
- Different members 80 mm apart remain split: PASS.
- Different members 38 mm apart merge under 50 mm rule: PASS.
- Multi-location staged member attribution is row-local: PASS.
- Single-location family-line enrichment remains available: PASS.
- PS-12154 real benchmark: PASS.
- PS-12120 real benchmark: PASS — 19 clashes -> 14 report rows across 9 pipes; governed five-location repeated pipe preserved.
- Support/Steel Playwright browser qualification: PASS.
- 1884/1885 ZIP benchmark and selected diagnostics: PASS.
- Initial expanded run had one stale exact trace-summary assertion; runtime behavior passed. The assertion was updated to include the three new summary counters and the rerun passed 75/75.

## Owner-uploaded output evidence
The uploaded CSV was a 21-column report artifact and therefore could not by itself reconstruct all source clash contacts or staged member traces. It nevertheless exposed the defect signature: examples such as PS-12005 emitted two rows for the same `/PS-12005.1` with different clash contact coordinates and the multi-location remark, while many genuine multi-location rows repeated the same broad staged member list. The production fix is qualified against parser evidence and explicit benchmark controls rather than reverse-inference from the lossy report CSV.

## Final-head note
This work-report commit changes the PR head after the validated runtime head above. GitHub qualification must be rechecked on the exact final head before promotion from draft. No merge is authorized by the Owner instruction to `proceed next`.

EXACT_NEXT_ACTION: wait for exact-head Support Report Node/browser/ZIP qualification; if all pass, update PR/issue status and leave #1208 ready-for-review but unmerged until fresh explicit Owner merge authorization.