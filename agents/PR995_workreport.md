# PR995 — CII independent multi-base correspondence orchestration

# CURRENT RECOVERY STATE — READ FIRST

## Recovery Header

```text
HANDOVER_READINESS: READY_FOR_REVIEW
PR_RECOVERY_STATE: DRAFT_IMPLEMENTATION_COMPLETE_FOCUSED_ARBITRATION_PASS
WORK_INTENT: IMPLEMENT
CRITICALITY: ENGINEERING_CRITICAL
REPOSITORY: reallaksh19/XML_Compare_Utilities
SOURCE_TASK: Issue #993 — workspace-level independent-loop orchestration
PR: 995
BRANCH: agent/cii-multi-base-orchestration
BASE: main@daf3be0a23524c4e25c6adc915f8841732180c36
MERGE_AUTHORITY: OWNER_ONLY
CURRENT_STAGE: VALIDATE / RECONCILE
GROUNDING_EPOCH: GE-002 / 2026-08-19
APPENDIX_A_STATUS: PASS_FOR_CURRENT_INCREMENT
CURRENT_BLOCKER: COMPLETE-CHECKOUT PRODUCTION TESTS NOT_RUN_ENVIRONMENT
HIGHEST_RISK: whole-component Method-B propagation can become unresolved when a valid local base reaches a legitimately revised region; OR isolation must remain fail-closed and local
EXACT_NEXT_ACTION: execute focused production test and SOURCE 3/TARGET 3-1 benchmark in a complete checkout; review PR; do not merge without explicit owner authorization
```

## Handover in 60 Seconds

Merged PR994 supplied Method A/B base qualification. PR995 connects that authority to `createCiiWorkspacePreview()`.

```text
explicit independent A/B base loops
        ↓
qualify each base independently
        ↓
READY A loop -> locked-span correspondence using only that A transform
READY B loop -> existing single-anchor propagation
        ↓
only READY correspondence results enter OR union
        ↓
identical claims collapse + retain loop provenance
contradictory READY node/element claims -> AMBIGUOUS
unresolved loop -> diagnostic only; does not poison another READY loop
```

Existing flat `anchorPairs` are routed through the same orchestration boundary as one `USER_LOCKED_LEGACY` loop. In that one-loop compatibility mode the old correspondence rows, IDs and authority strings are preserved exactly.

No Writer, transfer, fixed-field, UI, workflow or converter code is modified.

## Live ground truth

- live base at last reconciliation: `main@daf3be0a23524c4e25c6adc915f8841732180c36`
- predecessor PR994: merged at that SHA
- PR995: draft/open
- branch: `agent/cii-multi-base-orchestration`
- compare at GE-002: 11 commits ahead / 0 behind before permanent-custody commits
- source task: Issue #993
- coordination: SAFE within declared CII orchestration scope

## Mission / acceptance

### Required production behavior

1. `createCiiWorkspacePreview()` accepts explicit `baseLoops`.
2. Method A and Method B loops remain independent OR authority.
3. Method A local transforms never become a model-wide transform merely because one exists.
4. A READY base loop generates correspondence through existing qualified matching engines.
5. Cross-loop duplicate claims become one canonical claim with provenance.
6. Cross-loop source/target identity or element-custody contradictions fail closed.
7. A READY loop remains usable when another independent loop cannot propagate through a revised region.
8. legacy `anchorPairs` behavior remains materially unchanged.

### Out of scope

- Base Anchor UI/full-screen UX;
- Method A/B suggestion fusion card presentation;
- transfer APPLY/EXCLUDE;
- Writer 1A/1B;
- transfer policy/plan;
- fixed-field parser;
- SIF/Tee and NodeName mutation authority;
- protected external writer/converter;
- workflows.

## Production changes

### `cii-workspace-correspondence-arbitration.js`

New pure arbitration boundary.

- groups exact node/element claims across READY loop correspondences;
- identical claims collapse to one canonical row;
- canonical row stores `evidence.multiBaseProvenance`;
- A+B duplicate agreement reports `basisMethod: METHOD_A_AND_B`;
- source-node -> multiple targets is `SOURCE_NODE_TO_MULTIPLE_TARGETS`;
- target-node -> multiple sources is `TARGET_NODE_TO_MULTIPLE_SOURCES`;
- source-element -> materially different target signatures is `SOURCE_ELEMENT_TO_MULTIPLE_TARGETS`;
- target-element -> materially different source signatures is `TARGET_ELEMENT_TO_MULTIPLE_SOURCES`;
- any such contradiction returns `AMBIGUOUS` with `CROSS_LOOP_CORRESPONDENCE_CONFLICT`;
- unresolved READY-base loop correspondence is retained in `loopResults` but is excluded from the authoritative OR union.

### `cii-workspace-multi-base-correspondence.js`

New orchestration boundary.

- Method A READY loop: `compareLockedCiiAnchorSpan(..., geometryTransform=loop.geometry)`;
- Method B READY loop: existing `propagateSingleCiiAnchorCorrespondence()`;
- invalid explicit multi-base authority stays `BLOCKED`;
- ambiguous base authority stays `AMBIGUOUS`;
- legacy single-loop mode returns original correspondence rows/IDs/authority unchanged and adds only orchestration metadata.

### `cii-workspace-core.js`

Preview now:

```text
intake
 -> normalize accepted base anchors
 -> explicit A/B authority OR legacy compatibility authority
 -> multi-base correspondence
 -> compatibility geometry
 -> existing node custody/components/identity/review/delta/transfer/writer-readiness pipeline
```

`baseLoops` accepted method aliases:

```text
A | METHOD_A | METHOD_A_SPATIAL
B | METHOD_B | METHOD_B_NETWORK
```

Method-A input pairs are enriched from current SOURCE/TARGET graph coordinates and minimum positive incident SOURCE OD before PR994 qualification.

Method-B explicit loop requires exactly one anchor pair.

### Global geometry negative assurance

A local Method-A transform is exposed as global compatibility geometry only when it is the **sole contributing loop**. When multiple independent loops contribute and at least one is Method A:

```text
geometry.status = MULTI_BASE
geometry.mode = INDEPENDENT_LOCAL_TRANSFORMS
registeredWeight = 0
reason = NO_SINGLE_GLOBAL_TRANSFORM_ACROSS_INDEPENDENT_BASES
```

This prevents downstream code from applying one local transform to correspondence produced by another region.

## Real benchmark integration

`tests/cii-workspace-benchmark-base-anchor.test.js` now authors an actual workspace preview with:

```text
SOURCE 3.CII -> TARGET 3-1.CII

REAL_A_60930:
  60920 -> 7290
  60930 -> 7300
  60940 -> 7310

OR

REAL_B_60930:
  60930 -> 7300
```

Expected authority:

```text
Method A READY
Method B READY
multi-base authority READY
workspace correspondence READY via OR
REAL_A_60930 must contribute
REAL_B_60930 result must remain auditable even if its whole-component propagation becomes unresolved after reaching a revised region
```

The test deliberately does not require B whole-component propagation to be READY; doing so would confuse local base validity with unchanged global geometry.

## Numerical / engineering authority retained from PR994

```text
T = x * SOURCE_OD
x default = 2.0 configurable
TARGET OD has no tolerance authority
node-number offset has no identity authority
Method B <2 independent runs cannot gain MEDIUM/HIGH authority
extra 3D weight requires compatible mapped geometry
```

PR995 does not modify those formulas or thresholds.

## Validation ledger

| ID | Check | Status | Observation | Oracle | Notes |
|---|---|---|---|---|---|
| VAL-001 | live-main grounding | PASS | SOURCE_INSPECTION | AUTHORITATIVE_REFERENCE | base `daf3be0a...` |
| VAL-002 | pure arbitration duplicate A+B | PASS | LOCAL_EXECUTION | IMPLEMENTATION_COUPLED | one canonical row, 2 provenance records, METHOD_A_AND_B |
| VAL-003 | pure source-node conflict veto | PASS | LOCAL_EXECUTION | IMPLEMENTATION_COUPLED | returns AMBIGUOUS |
| VAL-004 | unresolved-loop OR isolation | PASS | LOCAL_EXECUTION | IMPLEMENTATION_COUPLED | READY A survives unresolved B |
| VAL-005 | arbitration module syntax | PASS | LOCAL_EXECUTION | NONE | `node --check` |
| VAL-006 | multi-base correspondence module syntax | PASS | LOCAL_EXECUTION | NONE | `node --check` |
| VAL-007 | full synthetic production-module test | NOT_RUN | NOT_OBSERVED | IMPLEMENTATION_COUPLED | complete repository unavailable in execution environment |
| VAL-008 | SOURCE 3/TARGET 3-1 workspace benchmark | AUTHORED_NOT_RUN_ENVIRONMENT | SOURCE_INSPECTION | AUTHORITATIVE_REFERENCE | exact real fixture test committed |
| VAL-009 | inherited CII benchmark/end-to-end suite | NOT_RUN_ENVIRONMENT | NOT_OBSERVED | NONE | legacy path source-reviewed for identity preservation |
| VAL-010 | full repository npm test | NOT_RUN_ENVIRONMENT | NOT_OBSERVED | NONE | no false PASS |
| VAL-011 | browser/Chromium | NOT_RUN_ENVIRONMENT | NOT_OBSERVED | NONE | out of this core slice |
| VAL-012 | Writer lifecycle | NOT_RUN_OUT_OF_SCOPE | NOT_OBSERVED | NONE | Writer files unchanged |

## Negative assurance

Must remain unchanged:

- Writer 1A and Writer 1B implementation;
- transfer policy and transfer plan;
- fixed-field parser;
- protected external CII writer/converter;
- OD/WT/node-number exclusion from identity authority;
- PR994 tolerance/weight formulas;
- existing legacy anchor-pair correspondence IDs/authority;
- no browser/workflow changes.

## Risks / limitations

### RISK-001 — Method A correspondence coverage

Method-A base qualification supports arbitrary non-collinear geometry, but PR995 currently reuses `compareLockedCiiAnchorSpan()` for correspondence expansion. A valid Method-A base whose anchors do not lie on one unique ordered route may therefore produce a READY base but unresolved correspondence. This is fail-closed and retained as a diagnostic; a future qualified coverage expansion may use multiple local spans without changing Method-A identity authority.

### RISK-002 — Method B propagation locality

Existing single-anchor propagation walks the connected component. A local B basis can therefore be READY while correspondence propagation stops at a downstream revision. PR995 deliberately keeps the base READY but excludes unresolved loop correspondence from the OR union. Do not weaken propagation to make the real benchmark green.

### RISK-003 — downstream registered geometry

When multiple loops contribute, no global transform is published. Engineering geometry deltas therefore do not yet consume row-level local transform provenance. This is safer than applying the wrong transform but is a known follow-on for evidence presentation/recovery.

## Changed-file ledger

Expected permanent PR diff after WIP retirement:

```text
agents/MASTER_INDEX.md
agents/PR995_workreport.md
agents/claims/PR995.yaml
agents/status/PR995.yaml
tabs/cii-workspace/cii-workspace-core.js
tabs/cii-workspace/cii-workspace-correspondence-arbitration.js
tabs/cii-workspace/cii-workspace-multi-base-correspondence.js
tests/cii-workspace-multi-base-correspondence.test.js
tests/cii-workspace-benchmark-base-anchor.test.js
```

No other production paths are intended.

## Appendix A — implementation qualification

### A1 Production Trace — PASS

Current pre-PR995 path was `anchorPairs -> one geometry -> one single-anchor propagation OR one locked span`. PR994 multi-base authority was not in `createCiiWorkspacePreview()`. PR995 inserts authority/orchestration before existing node custody and downstream review/delta/transfer stages.

### A2 Current Failure Isolation — PASS

The first wrong boundary was orchestration, not registration math, topology scoring or Writer. A piping revision with independent stable clusters cannot be represented safely by one flat anchor set/one global span.

### A3 Authority / Invariant — PASS

Local A transforms can differ; A and B combine by OR; identical claims corroborate; contradictory READY claims veto; unresolved loops do not silently become authority; OD is tolerance-scale only; node numbers are never identity evidence.

### A4 Independent Validation — PASS_FOR_IMPLEMENTATION

Expected arbitration outcomes were declared independently of production output and locally executed against the arbitration module. Real fixture identities are source-qualified from `SOURCE 3.CII/TARGET 3-1.CII`; full execution remains NOT_RUN rather than inferred.

### A5 Next-Commit / Minimal Patch — PASS

No Writer/transfer/UI/parser changes are required. Remaining work is validation/custody reconciliation only unless a focused test exposes a defect inside these orchestration files.
