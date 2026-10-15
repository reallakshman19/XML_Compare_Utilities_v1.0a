# PR996 — CII Base Anchor Method A/B discovery and fusion

# CURRENT RECOVERY STATE — READ FIRST

## Recovery Header

```text
HANDOVER_READINESS: READY_FOR_REVIEW
PR_RECOVERY_STATE: DRAFT_IMPLEMENTATION_COMPLETE_INDEPENDENT_NUMERICAL_ORACLE_PASS
WORK_INTENT: IMPLEMENT
CRITICALITY: ENGINEERING_CRITICAL
REPOSITORY: reallaksh19/XML_Compare_Utilities
SOURCE_TASK: Issue #993 — method-qualified Base Anchor suggestions
PR: 996
BRANCH: agent/cii-base-anchor-method-fusion
BASE: main@d28e33c1b4fd4facf559c218a36367149e270777
MERGE_AUTHORITY: OWNER_ONLY
CURRENT_STAGE: VALIDATE / RECONCILE
GROUNDING_EPOCH: GE-004 / 2026-08-19
APPENDIX_A_STATUS: PASS_FOR_CURRENT_INCREMENT
CURRENT_BLOCKER: COMPLETE-CHECKOUT JAVASCRIPT TESTS NOT_RUN_ENVIRONMENT
EXACT_NEXT_ACTION: execute focused JS and benchmark tests in a complete checkout; owner review; do not merge without explicit authorization
```

## Handover in 60 Seconds

PR994 qualified Method A/B mathematics. PR995 connected explicit independent A/B base loops to workspace correspondence. PR996 upgrades Base Anchor suggestions from Method-B-only labels to independent automatic Method A discovery plus A/B evidence fusion.

The key authority correction is that Method A is **not restricted to the structural mutual-best winner**. Structural evidence generates a bounded bidirectionally plausible candidate pool; local rigid registration then independently selects spatially consistent source-target pairs. A spatially proven structural runner-up can therefore surface as `METHOD_A_SPATIAL`. Method B remains stricter: it requires the structural mutual-best candidate, the existing two-independent-run basis, and the configured winner-gap gate.

## Live ground truth

- base at GE-004: `main@d28e33c1b4fd4facf559c218a36367149e270777`
- predecessor PR995: merged by squash at that SHA
- PR996: draft/open
- branch: `agent/cii-base-anchor-method-fusion`
- source task: Issue #993
- coordination: SAFE; no active CII anchor-discovery/fusion PR found
- merge authority: OWNER_ONLY

## Required production behavior

Every Base Anchor suggestion exposes an evidence-derived basis label:

```text
METHOD_A_SPATIAL
METHOD_B_NETWORK
METHOD_A_AND_B
LANDMARK_ONLY
```

Method A qualification requires membership in at least one READY non-collinear local spatial base. A single point never becomes Method A.

## Production architecture

```text
structural/landmark evidence
       ↓ candidate generation only
bounded forward + reverse plausible candidates
       ↓
round-robin SOURCE-rank seed selection
       ↓
one-to-one non-collinear triplet seeds
       ↓
PR994 rigid registration qualification
       ↓
all selected pairs tested against seed transform with x*SOURCE_OD tolerance
       ↓
unique minimum-residual candidate per SOURCE
AND unique minimum-residual candidate per TARGET
       ↓
mutual spatial winners
       ↓
re-qualify complete local base with PR994 multi-basis consistency
       ↓
READY independent Method-A bases
       ↓
map base membership back to pair suggestions

public suggestion pool:
  structural mutual-best candidates
        OR
  pairs independently surfaced by READY Method A bases
```

Per pair:

```text
A READY + fully qualified B     -> METHOD_A_AND_B
A READY only                    -> METHOD_A_SPATIAL
fully qualified B only          -> METHOD_B_NETWORK
neither                         -> LANDMARK_ONLY
```

A fully qualified B pair means:

```text
Method-B run basis READY
AND structural mutual-best
AND winnerGap >= requiredWinnerGap
```

## `cii-workspace-anchor-method-a.js`

New bounded Method-A discovery module.

- default selected seed-pair limit: 16;
- max raw triplets before one-to-one/geometry rejection: C(16,3)=560;
- seed selection is `ROUND_ROBIN_BY_SOURCE_CANDIDATE_RANK`, so high-scoring first candidates from one SOURCE do not crowd out all other SOURCE identities and runner-up evidence;
- duplicate spatial expansions are cached by canonical base membership before full-base requalification;
- default returned base limit: 24;
- seed triplets must be one-to-one in SOURCE and TARGET;
- seed qualification reuses `qualifyCiiGeometryTransform()` from PR994;
- expansion tolerance remains `x * SOURCE_OD`, default x=2;
- compatible candidates must be unique minimum normalized residual winners for both SOURCE and TARGET identity;
- equal residual ties within configurable normalized tolerance (`1e-9` default) are excluded rather than broken by topology score or iteration order;
- the expanded base is re-qualified by PR994 so `METHOD_A_AMBIGUOUS_BASES` remains fail-closed;
- three non-collinear pairs can establish registration, but automatic suggestion confidence is capped at REVIEW until at least four pairs are present (`methodAAutoConfidenceMinAnchorCount=4` default);
- each base retains independent rotation/translation; bases are never globally averaged.

## `cii-workspace-anchor-suggestions.js`

- structural score remains candidate-generation evidence only;
- Method B keeps existing `baseAnchorMinimumScore` default 65;
- Method A has a separate broader candidate-search floor `methodAMinimumCandidateScore`, default 55; passing 55 grants no identity authority, it only permits the pair to enter spatial hypothesis testing;
- Method-A discovery considers the source nodes that can be surfaced by the suggestion result (`methodASourceCandidateLimit`, default suggestion limit), with top 3 forward and reverse top 3 candidate plausibility by default;
- structural mutual-best candidates remain visible for engineer review even when spatial evidence rejects them;
- a non-mutual structural runner-up becomes visible only if a READY Method-A base independently proves it;
- Method B may retain local run diagnostics for surfaced candidates but obtains `METHOD_B_NETWORK` authority only when run basis + mutual-best + winner-gap all pass;
- non-authoritative Method-B weight is excluded from suggestion ranking;
- A+B scores are not summed; suggestion confidence is the strongest independently qualified method;
- candidate metadata records source rank, target rank, mutual-best state, Method-A search floor, and candidate-only authority role;
- node-number offset, OD-as-identity and WT remain excluded.

## Focused regressions authored

`tests/cii-workspace-base-anchor-method-fusion.test.js`:

1. 4-point rigid local base -> Method A HIGH with one validation anchor;
2. 3-point rigid base -> registration exists but automatic confidence REVIEW;
3. two independent 4-point regions with translations `(0,+100,0)` and `(0,-1200,0)` -> both local HIGH bases, no HIGH mixed/global base;
4. public A-only / A+B / B-only / LANDMARK_ONLY labels;
5. topology rank-1 spatial decoy versus topology rank-2 true pair -> rank-2 pair is surfaced as Method A only; rank-1 decoy remains visible for review.

`tests/cii-workspace-benchmark-base-anchor.test.js` now requires public benchmark suggestions to expose only the four qualified basis labels and to retain candidate-generation/OD/identity-boundary metadata.

## Independent numerical reproduction

Independent Python oracle, not importing production JavaScript.

OD = 100 mm, x = 2 -> tolerance = 200 mm.

Two local regions:

```text
Region A translation = (0, +100, 0) mm
Region B translation = (0, -1200, 0) mm
local max residuals  = 0 mm
```

Applying Region-A transform to Region-B anchors:

```text
residual per anchor = 1300 mm
normalized residual = 1300 / 200 = 6.5
```

Runner-up case:

```text
true transform translation = (7000, -2500, 300) mm
true fourth-point residual  ≈ 1.14e-13 mm
structural decoy normalized residual ≈ 298.37
```

This independently falsifies hidden global registration and topology-decoy promotion.

## Validation ledger

| ID | Check | Status | Observation | Oracle | Notes |
|---|---|---|---|---|---|
| VAL-001 | current-main grounding | PASS | SOURCE_INSPECTION | AUTHORITATIVE_REFERENCE | base d28e33c1 |
| VAL-002 | two-local-transform numerical reproduction | PASS | LOCAL_EXECUTION | INDEPENDENT_REPRODUCTION | 1300 mm / 6.5 normalized cross-region residual |
| VAL-003 | topology-decoy / spatial-runner-up numerical reproduction | PASS | LOCAL_EXECUTION | INDEPENDENT_REPRODUCTION | true residual ~0; decoy ~298.37 tolerance units |
| VAL-004 | focused JS production-module test | NOT_RUN_ENVIRONMENT | NOT_OBSERVED | IMPLEMENTATION_COUPLED | complete checkout unavailable |
| VAL-005 | benchmark Base Anchor test | AUTHORED_NOT_RUN_ENVIRONMENT | SOURCE_INSPECTION | AUTHORITATIVE_REFERENCE | public contract assertions committed |
| VAL-006 | inherited CII suite | NOT_RUN_ENVIRONMENT | NOT_OBSERVED | NONE | no false PASS |
| VAL-007 | full repository suite | NOT_RUN_ENVIRONMENT | NOT_OBSERVED | NONE | no false PASS |
| VAL-008 | browser/Chromium | NOT_RUN_ENVIRONMENT | NOT_OBSERVED | NONE | UI out of scope |
| VAL-009 | GitHub CI | REFRESH_REQUIRED_EXACT_HEAD | NOT_OBSERVED | NONE | refresh at final head |

A complete checkout attempt failed before product execution because the execution environment could not resolve `github.com`. No product PASS is inferred from that environment failure.

## Negative assurance

Must remain unchanged:

- PR994 `cii-workspace-geometry.js`, Method B run/tolerance/weight code and multi-base anchor authority;
- PR995 correspondence arbitration/orchestration;
- Writer 1A/1B;
- transfer policy/plan;
- fixed-field parser;
- protected converters;
- UI and workflows;
- OD remains tolerance-scale only; TARGET OD and node-number offset remain non-authoritative.

## Risks

- RISK-001 chance congruent triplets: mitigated by bidirectional structural plausibility, one-to-one seeds, mutual spatial winner expansion, full PR994 requalification and 3-anchor REVIEW cap.
- RISK-002 hidden global base: independent local bases are retained; mixed transform evidence is rejected by PR994 basis consistency. Independent oracle demonstrates a 6.5x cross-region residual.
- RISK-003 combinatorial growth: default seed pool is 16 pairs / 560 raw triplets; duplicate expansions are cached before full requalification.
- RISK-004 spatially correct structural runner-up: allowed to surface through Method A only; Method B authority remains unavailable until its own run-basis, mutual-best and winner-gap gates pass.

## Changed-file ledger

Expected permanent PR diff:

```text
agents/MASTER_INDEX.md
agents/PR996_workreport.md
agents/claims/PR996.yaml
agents/status/PR996.yaml
tabs/cii-workspace/cii-workspace-anchor-method-a.js
tabs/cii-workspace/cii-workspace-anchor-suggestions.js
tests/cii-workspace-base-anchor-method-fusion.test.js
tests/cii-workspace-benchmark-base-anchor.test.js
```

No other production paths are intended.

## Appendix A

### A1 Production Trace — PASS

`inspectCiiWorkspaceModels()` calls `suggestCiiBaseAnchorPairs()`. Before PR996 that path builds structural mutual-best pairs, qualifies one Method-B loop per pair and can label only Method B/Landmark. PR996 inserts bounded independent Method-A discovery before final suggestion projection.

### A2 Current Failure Isolation — PASS

The missing boundary is automatic Method-A base discovery and A/B suggestion fusion. PR994 registration/run mathematics and PR995 workspace orchestration are reused unchanged.

### A3 Authority / Invariant — PASS

One point cannot establish Method A. Structural candidate generation cannot masquerade as spatial authority. Method A and Method B remain independent OR evidence; Method B retains run-basis + mutual-best + winner-gap authority gates.

### A4 Independent Validation — PASS_FOR_IMPLEMENTATION

Independent numerical cases prove two local transforms cannot collapse and a structural rank-1 decoy can be rejected while a rank-2 spatially true pair is recovered.

### A5 Minimal Patch — PASS

New discovery module + anchor-suggestion fusion + focused tests only; no Writer/transfer/UI/parser/geometry-core/arbitration changes.
