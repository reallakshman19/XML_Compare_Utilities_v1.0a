# PR987 — CII auxiliary custody and benchmark qualification Work Report

# CURRENT RECOVERY STATE — READ FIRST

```text
HANDOVER_READINESS: READY
PR_RECOVERY_STATE: IMPLEMENTATION_COMPLETE_VALIDATION_PARTIAL_STACKED_DRAFT
TAKEOVER_AUTHORITY: OWNER_OR_REQUALIFIED_AGENT
EXECUTION_MODE: AUTO
AUTO_STATE: RUNNING
PHASE_PROGRESSION: AUTO
SCOPE_AUTHORITY: LOCKED_TO_APPROVED_CII_COMPARE_MISSION
MERGE_AUTHORITY: OWNER_GRANTED_IF_ALL_APPROVED_PHASES_COMPLETE_AND_QUALIFIED
REPOSITORY: reallaksh19/XML_Compare_Utilities
PR_OR_WIP: PR987
BRANCH: agent/cii-aux-custody-benchmark
REPORT_BASIS_HEAD: b47a7cbc6227ef8432b9fa2796ca2e64f6949fe9
STACKED_BASE_PR: PR986
STACKED_DEPENDENCY: PR982 -> PR983 -> PR984 -> PR985 -> PR986 -> PR987
GROUNDING_EPOCH: GE-987-004
CURRENT_STAGE: HANDOVER_AND_SUCCESSOR_PHASE
CURRENT_BLOCKER: FULL THREE-FILE/FROZEN-POLICY EXECUTION NOT OBSERVED
HIGHEST_RISK: REAL SOURCE->TARGET1/TARGET2 END-TO-END CORRESPONDENCE REMAINS UNEXECUTED
EXACT_NEXT_ACTION: continue automatically into read-only Transfer Preview qualification; do not enable target mutation.
```

## Handover in 60 seconds

PR987 establishes CII auxiliary engineering custody that the generic parser cannot safely infer. It does not change M1/M2 policy, propagation policy, or target-write authority.

The protected writer is read-only authority. Key corrected record rules are:

```text
ELEMENT                 15-row blocks
RESTRANT pointer        1-based 24-row block index
SIF&TEES pointer        1-based 10-row block index
RIGID pointer           1-based single-row record index
RESTRANT line 1         node, type, stiffness, gap, friction, connecting node
RESTRANT line 2         X/Y/Z direction cosines
```

A previous Phase7 implementation incorrectly treated RESTRANT and SIF pointers as raw row numbers. This was found by source audit and corrected before qualification.

## Current implementation

### Auxiliary pointer custody

`tabs/cii-workspace/cii-workspace-auxiliary.js` now:

- reads raw 15-row ELEMENT blocks and row12/13/14 pointer fields;
- binds auxiliary evidence to parsed elements by index + FROM/TO custody;
- treats RESTRANT pointers as 24-row block indices;
- treats SIF&TEES pointers as 10-row block indices;
- treats RIGID pointers as single-row indices;
- fail-closes pointer/decode conflicts;
- preserves SIF field 2 as raw/partial evidence only.

### RIGID authority

CII Workspace no longer uses generic `parsed.rigids` node/mass guesses to classify topology. A RIGID component exists only when ELEMENT pointer custody reaches a qualified RIGID record. If RIGID auxiliary capability is `PARSE_ERROR`, topology adaptation throws `CII_WORKSPACE_RIGID_AUXILIARY_PARSE_BLOCKED`.

### SIF/TEE identity separation

SIF/TEE remains downstream engineering evidence only. It is excluded from M2 packet/neighbourhood identity so a SIF revision cannot alter correspondence identity.

### Restraint engineering deltas

Pointer-qualified real CII can report:

- restraint presence;
- numeric type-code set;
- gap values;
- friction values;
- stiffness values;
- direction cosines;
- normalized numeric record set.

Human-readable meanings of all CAESAR type codes remain intentionally unresolved.

### Hanger custody

`tabs/cii-workspace/cii-workspace-hanger.js` qualifies hanger **node presence/count only** from CONTROL + MISCEL_1.

Two observed layouts are supported explicitly:

1. `CAESAR_SYNCHRONIZER_IHGRNODE_FIRST` — defaults then IHGRNODE;
2. `INPUTXML_CURRENT_HGRDAT_FIRST` — defaults, five per-hanger rows, then IHGRNODE.

A layout is accepted only when:

- CONTROL `NOHGRS` is valid;
- CONTROL `NUMELT` matches parsed element count;
- calculated MISCEL_1 offset is valid;
- packed IHGRNODE value count equals `NOHGRS` exactly;
- every decoded node is a positive integer present in parsed topology;
- competing layouts either reduce to the same node set or one uniquely qualifies.

Ambiguous/invalid layouts fail closed. HGRDAT/TAG/GUID semantics are still not normalized.

## Quantitative benchmark custody

### Node 130 restraint block arithmetic

```text
SOURCE 120->130      restraint pointer 5
TARGET1 20120->20130 restraint pointer 5
TARGET2 10120->10130 restraint pointer 6

block-start row = (pointer - 1) * 24 + 1
SOURCE/TARGET1 pointer 5 -> row 97
TARGET2 pointer 6        -> row 121
```

Expected numeric evidence:

```text
SOURCE 130     type 15, friction 0.0
TARGET1 20130  type 9,  friction 0.3
TARGET2 10130  type 9,  friction 0.0
```

### Node 70 SIF/Tee block arithmetic

The actual branch correspondence is:

```text
SOURCE   70->250
TARGET1  20070->20250
TARGET2  10070->10250
```

Pointers:

```text
SOURCE  SIF pointer 1 -> SIF rows 1-10
TARGET1 pointer 8     -> SIF rows 71-80
TARGET2 pointer 8     -> SIF rows 71-80
```

Pointer-bound raw field2 values:

```text
SOURCE 70      3
TARGET1 20070  5
TARGET2 10070  5
```

### 113->116 weight note

```text
SOURCE pointer 9   -> writer weight 111.2
TARGET1 pointer 11 -> writer weight 111.2
TARGET2 pointer 11 -> writer weight 111.2
```

The historical claim “weight changed” remains QUARANTINED. Pointer-number change is not an engineering weight change.

### Hanger at node 205

SOURCE CONTROL:

```text
NUMELT = 40
NUMNOZ = 0
NOHGRS = 1
RRMAT rows = ceil(40/6) = 7
vendor/synchronizer IHGRNODE row = 7 + 2 + 1 = MISCEL_1 row 10
MISCEL_1 row 10 = 205
```

TARGET1/TARGET2 both declare `NOHGRS=0`.

Therefore the benchmark now source-qualifies:

```text
SOURCE node 205    hanger present, count 1
TARGET1 node 20205 hanger absent,  count 0
TARGET2 node 10205 hanger absent,  count 0
semantic delta     REMOVED_IN_TARGET
```

This remains downstream property evidence; it does not alter M1/M2 identity confidence.

## Benchmark oracle

`Benchmark/CIICompare/CII_COMPARE_EXPECTED.json` now includes qualified expectations for:

- restraint 130 TARGET1/TARGET2;
- SIF/Tee raw field2 at node70 TARGET1/TARGET2;
- hanger node205 deletion TARGET1/TARGET2;
- explicit source/target node and gang mappings.

Still quarantined:

- `10 -> 20000` as node identity;
- `30 -> 20130`;
- unvalidated `50 -> 20050`;
- 113-116 weight-change claim.

Number offsets remain non-authoritative hints and are never used to derive expected targets.

## Validation ledger

### VAL-987-01 protected-source inspection

```text
STATUS: PASS
OBSERVATION: SOURCE_INSPECTION
ORACLE: AUTHORITATIVE_REFERENCE
```

### VAL-987-02 block-index hand qualification

```text
STATUS: PASS
OBSERVATION: SOURCE_INSPECTION + INDEPENDENT_REPRODUCTION
Checked: restraint block 5/6, SIF block 1/8, RIGID pointer 9/11
```

### VAL-987-03 focused hanger layout test

```text
STATUS: PASS
OBSERVATION: LOCAL_EXECUTION
SOURCE INTEGRITY: exact GitHub blobs SHA-verified before execution
TEST: tests/cii-workspace-hanger-custody.test.js
COVERS: both supported layouts, NOHGRS=0, invalid-node fail closed
```

### VAL-987-04 focused hanger delta test

```text
STATUS: PASS
OBSERVATION: LOCAL_EXECUTION
SOURCE INTEGRITY: exact GitHub blobs SHA-verified before execution
TEST: tests/cii-workspace-hanger-delta.test.js
COVERS: REMOVED_IN_TARGET, count 1->0, identity unchanged, PARSE_ERROR suppresses assertion
```

### VAL-987-05 auxiliary pointer runtime suite

```text
STATUS: NOT_RUN
Tests include:
  tests/cii-workspace-auxiliary-custody.test.js
  tests/cii-workspace-auxiliary-delta.test.js
  tests/cii-workspace-auxiliary-sif-identity-separation.test.js
  tests/cii-workspace-rigid-custody.test.js
```

### VAL-987-06 real three-file benchmark qualification

```text
STATUS: NOT_RUN
TEST: tests/cii-workspace-benchmark-qualification.test.js
```

### VAL-987-07 full frozen-policy preview

```text
STATUS: NOT_RUN
TEST: tests/cii-workspace-benchmark-end-to-end.test.js
Requirement: SOURCE->TARGET1 and TARGET2 under identical policy
```

No GitHub status checks/workflow runs were observed for the reconciled head. An unavailable runner is not counted as product PASS.

## Negative assurance / invariants

PR987 intentionally does not change:

```text
M1 scoring
M2 scoring
winner gap
anchor propagation
number-offset policy
protected writer
parser/sections/elements.js
parser/sections/restraints.js
target CII writer/mutation
```

Stage06/modified-target export remain blocked.

## AUTO continuation

Owner enabled autonomous phase progression and subsequently authorized merge **only if all approved phases are complete and qualified**. This is conditional merge authority, not permission to bypass validation.

Next phase: transfer-preview qualification on a successor stacked draft. Actual target mutation remains a separate hard-gated phase and may not be enabled unless the complete acceptance programme passes.

# APPENDIX A

`NOT_REQUIRED_SAME_AGENT_CONTINUATION` while current qualified agent continues in AUTO mode. Any different implementation agent must re-ground live repository state and the protected format authority before engineering-critical mutation.
