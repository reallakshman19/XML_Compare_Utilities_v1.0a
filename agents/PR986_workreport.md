# PR986 — CII Compare Review / Engineering Delta Work Report

# CURRENT RECOVERY STATE — READ FIRST

```text
HANDOVER_READINESS: READY
PR_RECOVERY_STATE: IMPLEMENTATION_COMPLETE_VALIDATION_PARTIAL_STACKED_DRAFT
TAKEOVER_AUTHORITY: OWNER_OR_REQUALIFIED_AGENT
EXECUTION_MODE: MANUAL
AUTO_STATE: NOT_ACTIVE
SCOPE_AUTHORITY: LOCKED_TO_PHASE6_COMPARE_REVIEW
MERGE_AUTHORITY: OWNER_ONLY
REPOSITORY: reallaksh19/XML_Compare_Utilities
PR_OR_WIP: PR986
BRANCH: agent/cii-compare-review-deltas
VALIDATED_IMPLEMENTATION_HEAD: 10f999c26368c08224e6efda0bc52e5bec96f39f
MERGE_BASE: 0f9dac7a512266c5a83a7d412f19d679c59136ec
STACKED_DEPENDENCY: PR982 -> PR983 -> PR984 -> PR985 -> PR986
GROUNDING_EPOCH: GE-986-002
CURRENT_STAGE: HANDOVER_READY
CURRENT_BLOCKER: FULL CII WORKSPACE / BROWSER INTEGRATION SUITE NOT_RUN IN CURRENT ENVIRONMENT
HIGHEST_RISK: CROSS-REVISION GEOMETRY DELTA BASIS WHEN A REGISTERED TRANSFORM IS REQUIRED
EXACT_NEXT_ACTION: keep draft; separately qualify parser families/geometry-delta registration before expanding transfer authority.
```

## 1. Mission and result

PR986 implements the read-only Compare Review layer after correspondence has already been established. It does **not** change M1, M2, candidate selection, anchor propagation, or transfer mutation authority.

The product contract is now:

```text
qualified correspondence
  -> engineering delta projection
  -> Compare Review view model
  -> engineer Accept / Reject / Lock review
  -> transfer preview only
```

Engineering deltas have `identityMutationAuthority = NONE_READ_ONLY_DOWNSTREAM`.

## 2. Implemented engineering delta families

For identity-bound rows only:

- node location from parsed node coordinates;
- element vector and length;
- OD;
- wall thickness;
- node name / to-name;
- restraint presence;
- exact numeric restraint-code set;
- raw restraint numeric records;
- element P1/T1 values as PARTIAL process evidence;
- qualified RIGID mass evidence tied to the parent element correspondence.

Unsupported or incomplete authority remains explicit:

- restraint gap/friction semantics: **not qualified**; raw rows are shown without assigning those labels;
- Hangers: capability-limited / NOT_PARSED where applicable;
- SIF/Tee: capability-limited / NOT_PARSED where applicable;
- Line numbers: raw markers only, no qualified semantic compare;
- General weight data: not normalized; RIGID mass is separate;
- P1/T1: PARTIAL element-value evidence, not complete load-case/process authority.

Node-name conflict custody is also preserved: blank/blank from a PARTIAL NODENAME capability is not asserted as equality.

## 3. Compare Review model

`CIIWorkspaceCompareReview.v1` publishes per correspondence:

- workflow status;
- engineering confidence: HIGH / MEDIUM / REVIEW / UNRESOLVED / LOCKED;
- identity-bound state;
- SOURCE / TARGET identity;
- M1 pass, distance, tolerance and basis;
- M2 pass, score, threshold and components;
- OD / wall evidence;
- winner gap and required gap;
- method winners and reasons;
- top alternatives;
- engineering change count/families/rows;
- review decision.

Candidate-set ambiguity overrides an individual winner's HIGH score. Example: winner confidence HIGH with winner gap 2 < required 8 projects to **REVIEW**, and `identityBound=false`.

## 4. UI implementation

The CII Workspace shell now has the permanent top-level workflow:

```text
1 Inputs & Match Basis
2 Compare Review
3 Transfer Preview
```

Tab 2 contains:

1. Executive Summary with HIGH/MEDIUM/REVIEW/UNRESOLVED and engineering-change KPIs;
2. Correspondence Review grid with Decision, Source/Target, M1, M2, OD, WT, winner gap and change families;
3. filters for confidence/search/changed-only;
4. evidence inspector with method details, alternatives and row-level engineering changes;
5. Engineering Delta Grid;
6. capability-limit panel.

Tab 3 remains preview-only and explicitly says target mutation is not implemented. Both the legacy Stage06 control and the new Apply-to-target control remain disabled.

Existing lifecycle selectors were retained intentionally to minimize UI regression risk.

## 5. Export consistency

`cii-correspondence.csv` now exports engineering confidence independently from workflow status:

```text
confidence       = MEDIUM
workflowStatus   = REVIEW
```

It also includes engineering change count and change families. This prevents the export from collapsing the PR984 MEDIUM confidence band back into the review-workflow state.

## 6. Focused validation evidence

### VAL-986-01 — engineering delta / identity separation

```text
Status: PASS
Observation: LOCAL_NODE_EXECUTION
Source integrity: exact current-branch files were materialized and Git blob SHA verified against GitHub before execution
Command: node tests/cii-workspace-engineering-delta.test.js
Result: CII engineering delta / Compare Review separation checks passed.
```

Assertions include:

- upstream confidence is not rewritten by downstream property changes;
- OD and wall changes are independently reported;
- node-name and restraint-code/raw-row changes are reported;
- no delta property is falsely labelled gap/friction;
- 205 node-location delta = exactly 200 mm;
- M2-supported 205 correspondence remains MEDIUM / workflow REVIEW;
- Hanger/SIF/Line limitations remain non-QUALIFIED.

Hand-check values:

```text
OD 60.3 -> 114.3: relative delta = 0.8955223881 = 89.5522%
WT 3.9 -> 4.7752: relative delta = 0.2244102564 = 22.4410%
205 location shift: |-1013.79 - (-1213.79)| = 200 mm
```

### VAL-986-02 — ambiguity projection

```text
Status: PASS
Observation: LOCAL_NODE_EXECUTION
Source integrity: Git blob SHA verified
Command: node tests/cii-workspace-compare-review-ambiguity.test.js
Result: CII Compare Review ambiguity projection checks passed.
```

### VAL-986-03 — CSV confidence/workflow separation

```text
Status: PASS
Observation: LOCAL_NODE_EXECUTION
Source integrity: Git blob SHA verified
Command: node tests/cii-workspace-compare-review-export.test.js
Result: CII Compare Review CSV projection checks passed.
```

Materialized Git blob SHAs matched GitHub exactly for contracts, delta engine, compare-review model, export module, and all three tests.

## 7. Validation not yet claimed

```text
Full CII Workspace repository suite at PR986 head: NOT_RUN
Existing browser/shell lifecycle test at PR986 head: NOT_RUN
Real SOURCE/TARGET1/TARGET2 full intake -> propagation -> delta -> UI flow: NOT_RUN
Chromium visual interaction: NOT_RUN
```

These are not inferred from source inspection or the focused tests.

## 8. Known limitation — geometry comparison basis

Node-location engineering deltas currently compare the parsed SOURCE and TARGET node-coordinate bases directly and record authority as `PARSED_NODE_COORDINATES`.

M1 can separately use a qualified registered transform when one is READY. PR986 does **not** silently reuse that transform for engineering-location delta reporting. Therefore a future qualification step should define whether engineering deltas are:

- raw-model-coordinate deltas;
- registered-coordinate deltas;
- or both, exposed as separate evidence.

Until then, do not describe PR986 node-location deltas as registration-normalized.

## 9. Changed-file boundary

Against PR985 base, the implementation contains only Compare Review/delta/UI/export/recovery files. No edits are made to:

```text
parser/**
converters/**
cii-workspace-candidates.js
cii-workspace-evidence.js
cii-workspace-match-methods.js
cii-workspace-propagation.js
cii-workspace-transfer*.js
```

Target mutation remains blocked.

# APPENDIX A

`NOT_REQUIRED_SAME_AGENT_CONTINUATION`. A different future implementation agent must re-ground before engineering-critical mutation.
