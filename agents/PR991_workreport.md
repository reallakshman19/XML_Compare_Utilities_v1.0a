# PR991 — CII Target Writer 1A

## Recovery header

- WORK_INTENT: IMPLEMENT
- CRITICALITY: ENGINEERING_CRITICAL
- MUTATION_AUTHORITY: WRITE_ALLOWED
- EXECUTION_MODE: MANUAL
- PR: 991
- BRANCH: `agent/cii-writer-1a`
- BASE_DEPENDENCY: PR990 `agent/cii-writer-roadmap-doc` @ `b0285e28274ae951e5b85a2a0dc3c38e765a510c`
- LIVE_MAIN_AT_START: `13e7c0e653e6d61ef2f2217068e1010bd5a53bf6`
- COORDINATION: SAFE_STACKED_ON_PR990
- TARGET_MUTATION_SCOPE: WRITER_1A_CARDINALITY_PRESERVING_ONLY
- MERGE_AUTHORITY: OWNER_ONLY
- MERGE_READY: false

## Handover in 60 Seconds

Writer 1A now supports approved cardinality-preserving mutation of ELEMENT WT/P1/T1/T2, existing pointer-bound RIGID weight, and existing RESTRANT numeric fields through an explicit deterministic source-record → target pointer/slot pairing contract. Multi-restraint pairing is exhaustive over at most `6! = 720` assignments and never uses slot order or mutable type/stiffness/gap/friction values to manufacture identity. Ambiguous best assignments fail closed. The target restraint node, pointer, slot, tag and GUID remain target-native. Source connecting-node references are translated through bound node correspondence before mutation. Generated TARGET CII is reparsed and rejected unless semantic negative assurance reports zero unexpected changes.

PR991 remains draft/unmerged because the real TARGET1/TARGET2 round-trip tests and inherited full CII Workspace/browser suite are still NOT_RUN in a complete checkout.

## Live ground truth

- PR991 remains on `agent/cii-writer-1a`, stacked on PR990.
- PR989 and predecessor #982-#988 are merged historical foundations.
- Protected external writer remains `reallaksh19/3D_Converters/converters/scripts/inputxml_to_cii2019.py`; inspected as format authority, never modified.
- No workflow-file changes are authorized or present in this workstream.

## Implemented production path

```text
approved / locked correspondence
  -> engineering delta set
  -> restraint pointer/slot pairing augmentation
  -> transfer policy
  -> Writer 1A readiness
  -> exact fixed-field patch
  -> reparse modified target
  -> semantic negative assurance
  -> export Modified_<target>.CII only on PASS
```

### ELEMENT and RIGID Writer 1A

Executable existing-record fields:

```text
ELEMENT row 2: WT, T1, T2
ELEMENT row 4: P1
RIGID: pointer-bound weight
```

Existing protections remain:

```text
node numbers
FROM / TO
DX / DY / DZ
OD
element count/order
section cardinality
auxiliary pointer ownership
```

### Deterministic existing-restraint pairing

Files:

- `tabs/cii-workspace/cii-workspace-restraint-pairing.js`
- `tabs/cii-workspace/cii-workspace-restraint-transfer.js`

Source authority already established by `cii-workspace-auxiliary.js` and protected writer:

```text
RESTRANT pointer = 1-based 24-row block index
6 slots per block
4 rows per slot:
  line 1 numeric
  line 2 direction cosines
  tag
  guid
```

Qualified record fields retained before pairing:

```text
pointer
slot
node
typeCode
stiffness
gap
friction
connectingNode
directionCosines
tag
guid
```

#### Pairing rules

1. SOURCE/TARGET restraint record count at the approved node must be equal for Writer 1A existing-record mutation.
2. Zero/zero is trivially qualified but produces no mutation.
3. One/one is uniquely paired by cardinality: `SINGLETON_EQUAL_CARDINALITY`.
4. For 2..6 records, all one-to-one assignments are evaluated globally; maximum search is `6! = 720`.
5. Multi-record stable evidence is:
   - exact nonblank GUID;
   - exact nonblank tag;
   - approved source connecting-node → target connecting-node correspondence;
   - equal direction cosines within tolerance.
6. Identity score hierarchy:

```text
GUID exact                 1,000,000
tag exact                     10,000
mapped connecting node exact   1,000
direction exact                  100
both connecting nodes zero         1  (not strong by itself)
```

The hierarchy prevents all lower-level evidence across six slots from outweighing one higher-level exact cue.

7. The following contribute ZERO pairing score and are deliberately excluded from identity:

```text
slot number
typeCode
stiffness
gap
friction
```

8. Raw source/target node-number equality is never used as restraint identity evidence.
9. Multi-record candidates require at least one strong cue.
10. A tied best global assignment is rejected with `RESTRAINT_RECORD_PAIRING_AMBIGUOUS`; slot order is never a tie-breaker.
11. If a positive SOURCE connecting node cannot be mapped through bound node correspondence, executable pairing fails closed.
12. Cardinality change is blocked from Writer 1A (`RESTRAINT_RECORD_CARDINALITY_CHANGE`) and belongs to Writer 1B/2 depending on required allocation/pointer changes.

#### Target-native proposal

For each qualified pair:

```text
TARGET pointer       preserved
TARGET slot          preserved
TARGET node          preserved
TARGET tag           preserved
TARGET GUID          preserved

SOURCE typeCode      -> target existing slot
SOURCE stiffness     -> target existing slot
SOURCE gap           -> target existing slot
SOURCE friction      -> target existing slot
SOURCE direction XYZ -> target existing slot
SOURCE connecting node -> mapped TARGET node number -> target existing slot
```

The writer never copies SOURCE pointer, SOURCE slot, or SOURCE node number into TARGET.

### Restraint transfer authority

The normal engineering-delta set is augmented with one row per bound node that has restraint evidence:

```text
category: RESTRAINT
property: Qualified restraint record pairing
authority: PROTECTED_WRITER_RESTRANT_POINTER_SLOT_PAIRING:<pairing authority>
```

This pairing row is now the sole restraint mutation authority.

Older aggregate rows remain visible evidence only:

```text
Restraint code set
Restraint gap values
Restraint friction values
Restraint stiffness values
Restraint direction-cosine set
Qualified restraint numeric record set
```

They classify as `KEEP / PROTECTED` with `CII_RESTRAINT_AGGREGATE_EVIDENCE_ONLY`; they cannot independently write the same raw slot fields.

### Exact RESTRANT writer fields

For each paired existing target slot Writer 1A patches only changed fixed spans:

```text
line 1 field 2  typeCode
line 1 field 3  stiffness
line 1 field 4  gap
line 1 field 5  friction
line 1 field 6  connectingNode
line 2 field 1  direction X
line 2 field 2  direction Y
line 2 field 3  direction Z
```

Before every patch:

- raw target field must equal the recorded `before` value;
- pointer/slot must equal the target custody in the pairing contract;
- raw line1 node must equal the target-native node in both `before` and `proposed`;
- duplicate field claims are rejected;
- fixed-field overflow is rejected.

No tag/GUID row is rewritten.

## Post-write negative assurance

After Writer 1A, the modified CII is reparsed and must satisfy all existing checks plus:

```text
RESTRANT pointer/slot set unchanged
RESTRANT section row cardinality unchanged
restraint target node unchanged
tag unchanged
guid unchanged
every numeric field = original unless an exact approved writer mutation exists
```

Any violation raises `CII_WRITER_1A_NEGATIVE_ASSURANCE_FAILED`; export is not returned.

## Real benchmark contract committed

Benchmark authority remains:

```text
SOURCE node130 -> restraint block 5, type 15, friction 0
TARGET1 node20130 -> block 5, type 9, friction 0.3
TARGET2 node10130 -> block 6, type 9, friction 0
```

`tests/cii-workspace-benchmark-transfer-preview.test.js` is updated so:

- aggregate restraint code/friction rows are evidence-only;
- `Qualified restraint record pairing` is `COPY/PREVIEW_READY`;
- pairing is singleton-qualified;
- target pointer/slot/node stay target-native.

New `tests/cii-workspace-benchmark-writer-1a-restraint.test.js` reviews only node130 and requires:

- TARGET1 block 5 retained;
- TARGET2 block 6 retained;
- type `9 -> 15` in both;
- TARGET1 friction `0.3 -> 0`;
- TARGET2 friction `0 -> 0` is not rewritten;
- only RESTRANT fields mutate;
- post-write validation PASS with `unexpectedSemanticDeltaCount = 0`;
- stale target bytes reject apply.

This real benchmark test is COMMITTED BUT NOT_RUN in a complete checkout.

## Validation ledger

### PASS — observed execution

1. Protected-writer source inspection:
   - ELEMENT row2/row4 fixed-field layout;
   - RESTRANT six-slot / 24-row block layout;
   - line1 node/type/stiffness/gap/friction/connecting-node;
   - line2 X/Y/Z cosines.
2. Existing focused Writer 1A test:
   - WT/P1/T1/T2/RIGID exact fixed-field mutation PASS.
3. `tests/cii-workspace-restraint-pairing.test.js`:
   - singleton cardinality pairing;
   - swapped multi-slot direction pairing;
   - GUID pairing despite direction change;
   - mapped connecting-node pairing;
   - ambiguous multi-record fail-closed;
   - cardinality mismatch fail-closed.
   - Re-run output: `CII deterministic restraint pairing checks passed.`
4. `tests/cii-workspace-target-writer-restraint.test.js`:
   - source slots 1/5 paired to target slots 6/2;
   - target pointer differs from source;
   - source connecting node `510 -> 9510` through node map;
   - exactly 9 numeric fixed fields rewritten;
   - target node/pointer/slot/tag rows preserved;
   - exact output length preserved.
   - Re-run output: `CII Writer 1A paired restraint slot mutation checks passed.`

Two focused test-oracle corrections were made during implementation and then rerun PASS:

- pairing test originally expected a positive winner gap although every alternative assignment was invalid; correct authority is unique assignment with no runner-up;
- raw writer synthetic fixture originally declared target pointer 7 with only one 24-row block; fixture corrected to valid target pointer 1 before execution.

### NOT_RUN — complete repository/runtime unavailable

```text
tests/cii-workspace-transfer-preview-policy.test.js
tests/cii-workspace-placeholder-gate.test.js
tests/cii-workspace-transfer-preview-ui.test.js
tests/cii-workspace-anchor-approval-ui.test.js
tests/cii-workspace-benchmark-transfer-preview.test.js
tests/cii-workspace-benchmark-end-to-end.test.js
tests/cii-workspace-benchmark-writer-1a.test.js
tests/cii-workspace-benchmark-writer-1a-restraint.test.js
full inherited CII Workspace regression/browser lifecycle
```

Repo-local `utils/backup.cjs` remains `NOT_RUN_ENVIRONMENT` because the complete repository was not materialized in the container. GitHub writes used exact current blob SHAs; do not represent that as backup-script PASS.

## Changed-file ledger

Coordination:

- `agents/MASTER_INDEX.md`
- `agents/PR991_workreport.md`
- `agents/status/PR991.yaml`
- `agents/claims/PR991.yaml`

Production:

- `tabs/cii-workspace/cii-workspace-core.js`
- `tabs/cii-workspace/cii-workspace-engineering-delta.js`
- `tabs/cii-workspace/cii-workspace-placeholders.js`
- `tabs/cii-workspace/cii-workspace-shell.js`
- `tabs/cii-workspace/cii-workspace-target-writer.js`
- `tabs/cii-workspace/cii-workspace-topology-adapter.js`
- `tabs/cii-workspace/cii-workspace-transfer-plan.js`
- `tabs/cii-workspace/cii-workspace-transfer-policy.js`
- `tabs/cii-workspace/cii-workspace-restraint-pairing.js`
- `tabs/cii-workspace/cii-workspace-restraint-transfer.js`

Tests:

- `tests/cii-workspace-anchor-approval-ui.test.js`
- `tests/cii-workspace-benchmark-end-to-end.test.js`
- `tests/cii-workspace-benchmark-transfer-preview.test.js`
- `tests/cii-workspace-benchmark-writer-1a.test.js`
- `tests/cii-workspace-benchmark-writer-1a-restraint.test.js`
- `tests/cii-workspace-placeholder-gate.test.js`
- `tests/cii-workspace-target-writer-1a.test.js`
- `tests/cii-workspace-target-writer-restraint.test.js`
- `tests/cii-workspace-restraint-pairing.test.js`
- `tests/cii-workspace-transfer-preview-policy.test.js`
- `tests/cii-workspace-transfer-preview-ui.test.js`

## Risks / decisions

- RISK-1: a restraint may legitimately change direction and metadata between revisions. Direction is therefore positive evidence, not a mandatory equality gate; stronger GUID/tag/connecting-node evidence can preserve identity while direction changes.
- RISK-2: GUID/tag can be regenerated. Exact match is positive evidence only; nonmatch is not treated as automatic contradiction.
- RISK-3: indistinguishable multiple restraints cannot be safely paired from mutable values; ambiguity stays blocked.
- DEC-1: exhaustive assignment is acceptable because the physical format limits the set to six slots (`<=720` permutations).
- DEC-2: slot order is custody after pairing, never identity evidence before pairing.
- DEC-3: aggregate restraint deltas are evidence only; only explicit pointer/slot pairing authorizes mutation.
- DEC-4: free-slot creation/cardinality change is not smuggled into Writer 1A.
- DEC-5: no correspondence/M1/M2 thresholds or weights were changed for this writer increment.

## Exact continuation state

EXACT_NEXT_ACTION:

1. obtain a complete checkout/runner at the exact PR991 head;
2. run `tests/cii-workspace-benchmark-writer-1a-restraint.test.js` for real TARGET1/TARGET2;
3. run existing `tests/cii-workspace-benchmark-writer-1a.test.js`;
4. run `tests/cii-workspace-benchmark-transfer-preview.test.js` and end-to-end benchmark;
5. run transfer-policy/Stage06/UI and inherited browser lifecycle regressions;
6. fix only genuine defects; do not tune correspondence policy to benchmark numbering;
7. keep PR991 draft/unmerged until required gates are observed PASS.

## Appendix A — implementation qualification

A1 Production trace: `bound node correspondence -> auxiliary restraint byNode -> deterministic global pairing -> pairing engineering delta -> transfer policy -> Writer 1A readiness -> target pointer/slot patch -> reparse -> negative assurance` is implemented.

A2 Failure isolation: unequal cardinality, invalid fixed-field custody, missing connecting-node mapping, no stable multi-record assignment, tied assignment, stale target SHA, target before-value mismatch, pointer/slot mismatch, target-node mismatch, duplicate field claim, overflow and post-write semantic mismatch all fail closed.

A3 Authority/invariant: protected writer establishes the six-slot 24-row RESTRANT layout; Writer 1A preserves target node/pointer/slot/tag/GUID/cardinality and only patches qualified numeric spans.

A4 Independent validation: pairing logic is tested independently from the writer; writer raw-slot mutation is separately tested; the real TARGET1/TARGET2 core round-trip benchmark is committed but NOT_RUN.

A5 Minimal patch: no changes to M1/M2 candidate scoring, topology propagation, node-offset policy, external protected writer, parser authority, or workflow files.

QUALIFICATION_RESULT: CONTINUE — deterministic single/multi existing-restraint Writer 1A implementation and focused validation are complete; real benchmark/full regression execution remains the merge blocker.
