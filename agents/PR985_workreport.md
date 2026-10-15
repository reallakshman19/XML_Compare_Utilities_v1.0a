# PR985 — CII anchor-seeded network propagation Work Report

# CURRENT RECOVERY STATE — READ FIRST

## 1. Recovery Header

```text
HANDOVER_READINESS: READY
PR_RECOVERY_STATE: IMPLEMENTATION_COMPLETE_VALIDATION_PARTIAL_STACKED_DRAFT
TAKEOVER_AUTHORITY: OWNER_OR_REQUALIFIED_AGENT
EXECUTION_MODE: MANUAL
AUTO_STATE: NOT_ACTIVE
SCOPE_AUTHORITY: LOCKED_TO_PHASE5_PROPAGATION
MERGE_AUTHORITY: OWNER_ONLY
REPOSITORY: reallaksh19/XML_Compare_Utilities
PR_OR_WIP: PR985
BRANCH: agent/cii-anchor-propagation
VALIDATED_IMPLEMENTATION_HEAD: 6e35a8997d6c2c4dcdc914b634d111277092f633
REPORT_BASIS_HEAD: 6e35a8997d6c2c4dcdc914b634d111277092f633
MAIN_HEAD_LAST_CHECKED: ceb0c0193a4be68b28a913b74bdc453ccf79d336
MERGE_BASE: dd165a4a04b51b15d06322d7f577c88a33641b6c
STACKED_DEPENDENCY: PR982 -> PR983 -> PR984 -> PR985
APPENDIX_A_STATUS: NOT_REQUIRED_SAME_AGENT_CONTINUATION
GROUNDING_EPOCH: GE-985-002
CURRENT_STAGE: HANDOVER_READY
CURRENT_BLOCKER: COMPLETE_AUTHENTICATED_CHECKOUT_UNAVAILABLE_FOR_LITERAL_REPO_TEST COMMANDS
HIGHEST_RISK: INSERTION/SUBDIVISION FRONTIERS REMAIN FAIL_CLOSED IN ONE_ANCHOR MODE
EXACT_NEXT_ACTION: keep draft/unmerged; next separate phase should expose correspondence/property deltas in Compare Review before any target mutation.
```

## 2. Handover in 60 Seconds

PR985 replaces the production one-anchor one-hop preview path with bounded multi-hop graph propagation. It does not modify the existing multi-anchor unique-path algorithm. A frontier is solved as a one-to-one assignment, candidate evidence must be `SUPPORTED`, and target edge/node custody is checked before commit. MEDIUM identity may propagate but remains workflow `REVIEW`; ambiguous or incomplete propagation makes the overall correspondence `UNRESOLVED`, preserving transfer fail-closed behavior.

A benchmark-level correction was discovered during this phase: midpoint-based M1 could hide a 200 mm node displacement as 100 mm midpoint motion. That correction was made in predecessor PR984; M1 now uses maximum orientation-independent endpoint displacement. PR985 was internally updated to that exact stacked base before qualification.

## 3. Implemented production behavior

- new `cii-workspace-propagation.js`:
  - seed node pair custody from locked anchor;
  - BFS-like node-pair queue across the connected component;
  - bounded frontier degree/assignment count;
  - exact one-to-one source-edge/target-edge assignment;
  - assignment winner-gap barrier;
  - per-pair PR984 candidate evidence check;
  - global edge and node custody;
  - custody checked before any edge/node commit;
  - unresolved frontier rows retained with reason/evidence;
  - component-completeness audit;
  - overall `UNRESOLVED` whenever any reachable source/target component portion remains unmatched.
- `cii-workspace-core.js`:
  - one locked anchor routes to propagation engine;
  - two-or-more anchors continue to use existing `compareLockedCiiAnchorSpan` authority unchanged.

## 4. Focused qualification evidence

Reconstructed local Node execution of the current semantics passed:

1. **Multi-hop**: terminal anchor across 4 elements maps all 4 edges / 5 nodes, proving behavior is no longer one-hop.
2. **205 benchmark geometry**: SOURCE `200→205→210` vs TARGET1 `20200→20205→20210`; node 205 shift = 200 mm. Endpoint M1 fails each affected edge at 100 mm, M2 passes, MEDIUM/REVIEW identities propagate through the gang, final correspondence READY.
3. **TARGET1 250-series**: SOURCE OD/WT `60.3/3.9` vs TARGET1 `114.3/4.7752`; both dimension tolerances fail, but all 3 edges propagate as supported MEDIUM.
4. **TARGET2 250-series blind pattern**: target node family is `102xx`; first two internal legs redistribute +200/-200 mm while total span remains unchanged. First two edges M1 FAIL, third M1 PASS, all M2 PASS, all 3 edges propagate. No node-number offset arithmetic exists in production or the test.
5. **Ambiguity barrier**: symmetric branch produces two equal one-to-one assignments; `FRONTIER_WINNER_GAP_NOT_SATISFIED`, only the unique trunk remains matched, and overall result is UNRESOLVED.

Direct full repository execution remains `NOT_RUN` because the container cannot resolve GitHub for a complete authenticated checkout. This environment limitation is not claimed as product PASS or FAIL.

## 5. Active engineering register

| ID | Type | Severity | Status | Summary |
|---|---|---|---|---|
| ISS-985-01 | ISS | HIGH | CLOSED | one-anchor path previously stopped at incident edges |
| ISS-985-02 | ISS | HIGH | CLOSED | independent frontier claims replaced by one-to-one assignment |
| ISS-985-03 | ISS | HIGH | CLOSED | node custody now gates before edge commit |
| DEC-985-01 | DEC | HIGH | ACCEPTED | MEDIUM supported identity may propagate; ambiguity may not |
| DEC-985-02 | DEC | HIGH | ACCEPTED | incomplete component propagation => overall UNRESOLVED |
| RISK-985-01 | RISK | MEDIUM | OPEN_LIMIT | frontier cardinality changes/subdivision remain fail-closed in one-anchor mode |
| RISK-985-02 | RISK | MEDIUM | OPEN_VALIDATION | literal full checkout test not run |

## 6. Authority / invariants

```text
locked anchor
 -> node frontier
 -> PR984 M1/M2 + OD/WT evidence
 -> one-to-one assignment + winner gap
 -> edge/node custody gates
 -> supported propagation
 -> completeness audit
 -> correspondence READY or UNRESOLVED
 -> existing review / transfer fail-closed gates
```

Must remain true:

- no node-number offset establishes identity;
- no OD/WT-only identity;
- ambiguous candidate or frontier does not propagate;
- target custody is one-to-one;
- multi-anchor unique-path authority unchanged;
- Stage06 mutation remains blocked.

## 7. Validation ledger

### VAL-985-01

```text
Status: PASS
Observation: LOCAL_EXECUTION
Oracle: IMPLEMENTATION_COUPLED + HAND-CALC BENCHMARK GEOMETRY
Scope: multi-hop, 205, TARGET1 250, TARGET2 250, ambiguity stop
Limitation: reconstructed focused execution, not full checkout
Origin: RESOLVED_BY_PR
```

### VAL-985-02

```text
Status: NOT_RUN
Observation: NOT_OBSERVED
Oracle: NONE
Scope: literal repository test command / full real-file preview
Limitation: complete authenticated checkout unavailable in current environment
```

## 8. Changed-file ledger

Expected PR985-only production/test scope against current PR984 base:

- `tabs/cii-workspace/cii-workspace-core.js` — one-anchor integration;
- `tabs/cii-workspace/cii-workspace-propagation.js` — new engine;
- `tests/cii-workspace-propagation.test.js` — focused regression;
- PR985 recovery/status/claim/index records.

No parser, converter, candidate/evidence method, multi-anchor topology, transfer, Revision Compare, or model-converter edits belong to PR985.

## 9. Continuation

Next engineering phase should consume the now-qualified correspondence evidence in **Tab 2 Compare Review / engineering property delta presentation**. Do not enable target mutation. Real-file TARGET1 qualification should precede any policy freeze; TARGET2 should remain blind where possible.

# APPENDIX A — IMPLEMENTATION TAKEOVER QUALIFICATION

`NOT_REQUIRED_SAME_AGENT_CONTINUATION`. A different future implementation agent must re-ground and qualify before engineering-critical mutation.
