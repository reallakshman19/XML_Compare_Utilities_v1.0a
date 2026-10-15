# PR984 — CII M1 Spatial / M2 Network evidence Work Report

# CURRENT RECOVERY STATE — READ FIRST

## 1. Recovery Header

```text
HANDOVER_READINESS: READY
PR_RECOVERY_STATE: IMPLEMENTATION_COMPLETE_VALIDATION_PARTIAL_STACKED_DRAFT
TAKEOVER_AUTHORITY: OWNER_OR_REQUALIFIED_AGENT
EXECUTION_MODE: MANUAL
AUTO_STATE: NOT_ACTIVE
SCOPE_AUTHORITY: LOCKED_TO_APPROVED_M1_M2_EVIDENCE_PHASE
MERGE_AUTHORITY: OWNER_ONLY
REPOSITORY: reallaksh19/XML_Compare_Utilities
PR_OR_WIP: PR984
BRANCH: agent/cii-m1-m2-evidence
VALIDATED_IMPLEMENTATION_HEAD: dd165a4a04b51b15d06322d7f577c88a33641b6c
REPORT_BASIS_HEAD: dd165a4a04b51b15d06322d7f577c88a33641b6c
MAIN_HEAD_LAST_CHECKED: ceb0c0193a4be68b28a913b74bdc453ccf79d336
MERGE_BASE: 070ef9038a9fc2af87a1e7a49b0e8f600d98d3ba
STACKED_DEPENDENCY: PR982 -> PR983 -> PR984
REPORT_SYNC: GE-984-003_ENDPOINT_QUALIFIED
APPENDIX_A_STATUS: NOT_REQUIRED_SAME_AGENT_CONTINUATION
CURRENT_STAGE: HANDOVER_READY
CURRENT_BLOCKER: COMPLETE_AUTHENTICATED_CHECKOUT_UNAVAILABLE_FOR_LITERAL_REPOSITORY_TESTS
HIGHEST_RISK: FULL_REAL_FILE_QUALIFICATION_NOT_RUN
EXACT_NEXT_ACTION: keep PR984 draft/unmerged; propagation is isolated in PR985.
```

## 2. Handover in 60 Seconds

PR984 separates CII correspondence evidence into **M1 Spatial** and **M2 Network/Gang**. OD and wall are independent supporting revision evidence, not identity blockers. Candidate confidence and candidate/path ranking are separate authorities, and M1/M2 disagreement is retained as REVIEW rather than averaged away.

A material correction was made during downstream propagation qualification: M1 is now **node/endpoint-coordinate based**, not midpoint based. For each candidate element, M1 evaluates direct and reversed endpoint custody and uses the **maximum matched-endpoint Euclidean displacement**. This is necessary for the benchmark 205 pattern: one endpoint stays fixed while the other moves 200 mm; midpoint movement is only 100 mm and would be an unsafe false pass at the configured 100 mm tolerance.

## 3. Current implementation

### M1 Spatial

- default tolerance: 100 mm;
- direct/reversed endpoint pairing evaluated deterministically;
- source points are registered when geometry transform is `READY`, raw-global otherwise;
- authoritative distance = maximum matched-endpoint Euclidean displacement;
- missing endpoint coordinates => M1 `UNAVAILABLE`, not a false FAIL.

### M2 Network/Gang

- topology, neighbourhood, ordered path/component context, station and bounded local-length evidence;
- OD/WT removed from topology tokens and stripped from legacy-style tokens before comparison;
- branch-topology and rigid-kind contradictions remain structural hard blockers.

### Dimensions / confidence

- OD relative tolerance: ±10%; weight 30;
- wall relative tolerance: ±10%; weight 30;
- identity weight: 50;
- M1+M2 PASS with dimensions PASS => HIGH;
- M1+M2 PASS with dimensional revision => MEDIUM;
- M1 FAIL + M2 PASS => MEDIUM;
- M1 PASS + M2 FAIL => REVIEW;
- both identity methods fail => UNRESOLVED, score/rankingScore 0;
- dimensions alone can never establish identity.

### Candidate ranking / custody compatibility

- M1 and M2 select their own winners;
- different winners => `METHOD_A_B_DISAGREE` / REVIEW;
- method-specific winner gaps prevent 50/30/30 confidence ties from erasing network discrimination;
- `score` is engineering confidence; `rankingScore` adds method quality only for ordering;
- MEDIUM projects to existing workflow `REVIEW` until engineer approval, preserving existing custody/transfer gates.

## 4. Focused validation evidence

Reconstructed local Node execution passed:

1. 90/90/90 mm endpoint translation => Euclidean ~155.9 mm => M1 FAIL at 100 mm.
2. Benchmark-faithful 205 edge: endpoint distances `[0, 200] mm` => M1 FAIL; reversed element storage gives the same physical result.
3. 205 concept with M2 PASS and OD/WT PASS => MEDIUM, not hard fail.
4. 250 concept with OD `60.3→114.3` and WT `3.9→4.7752` outside ±10% => identity remains MEDIUM when M1/M2 support it.
5. dimensions-only candidate => UNRESOLVED, hardFail=true, score=0, rankingScore=0.
6. repeated-network discrimination => correct M2 90.0/rank95.0 versus wrong M2 84.8/rank92.4 while confidence remains 100 for both.
7. branch and rigid-kind contradictions remain hard fail.
8. existing topology-only alignment remains valid when M1 coordinates are unavailable.

Literal current-head repository tests from a complete authenticated checkout remain **NOT_RUN**. The local container cannot resolve GitHub for a complete checkout; this is an environment limitation, not a product PASS or FAIL.

## 5. Active engineering register

| ID | Type | Status | Summary |
|---|---|---|---|
| ISS-984-01 | ISS | CLOSED | OD/WT hard identity blockers removed |
| ISS-984-02 | ISS | CLOSED | dimensions removed from M2 topology tokens |
| ISS-984-03 | ISS | CLOSED | M1/M2 independently exposed |
| ISS-984-04 | ISS | CLOSED | confidence tie no longer erases network-quality ranking |
| ISS-984-05 | ISS | CLOSED | midpoint M1 replaced by endpoint-coordinate M1 |
| DEC-984-01 | DEC | ACCEPTED | M1/M2 establish identity; OD/WT support confidence only |
| DEC-984-02 | DEC | ACCEPTED | MEDIUM remains workflow REVIEW until engineer approval |
| DEC-984-03 | DEC | ACCEPTED | confidence and ranking are separate authorities |
| DEC-984-04 | DEC | ACCEPTED | M1 authoritative distance = maximum matched-endpoint displacement |
| RISK-984-01 | RISK | OPEN_VALIDATION | literal full-checkout current-head tests not run |

## 6. Authority / invariants

```text
parsed endpoint coordinates + topology
 -> M1 endpoint spatial evidence / M2 network evidence
 -> independent OD/WT evidence
 -> identity confidence + confidence score
 -> separate ranking score / method winner gap
 -> candidate review / existing target custody gates
```

Must remain true:
- no dimensions-only identity;
- no node-offset identity;
- no midpoint-only M1 authority;
- method disagreement cannot be averaged away;
- M1 unavailable is neutral;
- branch/rigid contradictions remain fail-closed;
- Stage06 target mutation remains blocked.

## 7. Validation ledger

### VAL-984-01 — M1 endpoint benchmark semantics
```text
Status: PASS
Observation: LOCAL_EXECUTION
Oracle: HAND-CALC GEOMETRY
Expected: [0,200] mm endpoint displacement for 205 pattern; FAIL at 100 mm
Actual: PASS, including reversed storage
Origin: RESOLVED_BY_PR
```

### VAL-984-02 — method/fusion and repeated-network regression
```text
Status: PASS
Observation: LOCAL_EXECUTION
Oracle: IMPLEMENTATION_COUPLED + hand-calculated geometry assertions
Actual: focused assertions passed
Origin: RESOLVED_BY_PR
```

### VAL-984-03 — literal full repository current-head tests
```text
Status: NOT_RUN
Observation: NOT_OBSERVED
Oracle: NONE
Limitation: complete authenticated checkout unavailable
```

## 8. Changed-file ledger

Stacked diff against PR983 base is **12 intended files**:
- `agents/MASTER_INDEX.md`
- `agents/PR984_workreport.md`
- `agents/claims/PR984.yaml`
- `agents/status/PR984.yaml`
- `tabs/cii-workspace/cii-workspace-alignment.js`
- `tabs/cii-workspace/cii-workspace-candidates.js`
- `tabs/cii-workspace/cii-workspace-evidence.js`
- `tabs/cii-workspace/cii-workspace-match-methods.js`
- `tabs/cii-workspace/cii-workspace-topology-adapter.js`
- `tests/cii-workspace-hard-conflict.test.js`
- `tests/cii-workspace-m1-m2-evidence.test.js`
- `tests/cii-workspace-m1-endpoint-spatial.test.js`

Unexplained files: 0. No parser, converter, propagation, transfer, Revision Compare or model-converter edits belong to PR984.

## 9. Continuation

Propagation is no longer a PR984 responsibility; it is isolated in PR985. Keep PR984 draft/unmerged unless owner explicitly authorizes merge.

# APPENDIX A — IMPLEMENTATION TAKEOVER QUALIFICATION

`NOT_REQUIRED_SAME_AGENT_CONTINUATION`. A different future implementation agent must re-ground and qualify before engineering-critical mutation.
