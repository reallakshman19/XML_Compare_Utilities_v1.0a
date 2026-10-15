# SSK-TS-3D — Exact Draft Edit 3D Boundary-Decision Classification

## Status

```text
Work Pack: SSK-TS-3D
Authority issue: #685
Dependency: merged SSK-TS-3C / PR #683
Baseline: 61a434c87c1e463900a971ee8d0a21bbc1674cb3
Implementation branch: agent/ssk-ts-3d-boundary-decision-classification
```

This increment qualifies supervised boundary classification in Draft Edit 3D. It does not authorize geometry editing, manual port pairing, component reversal, or SVG retirement.

## Mission boundary

SSK-TS-3D adds accepted-command access to exactly:

- `MARK_TERMINAL`;
- `MARK_EXTERNAL_BOUNDARY`.

The accepted-command preparation list now contains ten commands:

```text
ADVANCE_ONE
RUN_UNTIL_BLOCKED
CONNECT_CANDIDATE
REJECT_CANDIDATE
MARK_TERMINAL
MARK_EXTERNAL_BOUNDARY
DEFER_DECISION
RESUME_DECISION
UNDO_LAST_TRANSACTION
REDO_LAST_TRANSACTION
```

`MANUAL_CONNECT` and `REVERSE_COMPONENT` remain blocked.

## Authority flow

```text
SequentialEngineeringSvgOwnerSnapshot.v1
→ SequentialScopedEditReadModel.v1
→ independently regenerated EngineeringScene.v1
→ complete Sequential edit authority
→ exact current decision
→ SequentialDraftEditDecisionTarget.v1
→ operator evidence
→ prepare immutable command
→ review predicted native result
→ explicit acceptance or cancellation
```

Decision-target creation is read-only. It cannot prepare, accept, publish, adopt a journal, mutate the workspace, or alter construction state.

## Exact decision-target contract

`SequentialDraftEditDecisionTarget.v1` binds:

- complete accepted-command authority ID;
- certified read-model authority ID;
- active root branch ID;
- exact current decision ID;
- decision scope;
- decision reason;
- active port ID, when present;
- pending junction ID, when present;
- reference target, when present;
- deterministic semantic target fingerprint.

Validation regenerates the target from current certified inputs and compares complete immutable contract values.

## Boundary-classifiable policy

A decision is classifiable only when:

1. the current session state is `USER_DECISION_REQUIRED`;
2. a current decision exists;
3. the decision is not deferred;
4. the decision contains zero candidates;
5. certified read-model branch and session fingerprints match current complete command authority;
6. the exact reason is one of:
   - `UNEXPLAINED_TERMINAL`;
   - `REFERENCE_TARGET_MISSING`;
   - `REFERENCE_TARGET_PORT_UNRESOLVED`;
   - `UNRESOLVED_PENDING_BRANCH`;
   - `HEAD_REFERENCE_CANDIDATES_REJECTED`.

The resolver fails closed for:

- missing decisions;
- deferred decisions;
- candidate-bearing decisions;
- unsupported reasons;
- stale session authority;
- cross-branch authority;
- invalid read-model or scene ancestry.

## No visual inference

Boundary classification does not use:

- world coordinates;
- screen coordinates;
- ray distance;
- nearest-object selection;
- object names;
- entity ordering;
- missing visual geometry;
- camera orientation;
- pick proximity.

The authority source is the current native decision request, not the rendered appearance.

## Draft Edit command panel

The panel maintains two separate target categories:

- exact current candidate target for connect/reject;
- exact current zero-candidate boundary decision for terminal/external classification.

Candidate and boundary targets are mutually exclusive in the panel. Both are bound to the complete current command authority ID.

Boundary classification requires:

- operator actor ID;
- operator reason;
- evidence note.

The visible action performs only:

```text
gateway.prepare(command)
```

The prepared review displays:

- command type;
- branch ID;
- decision ID;
- decision reason and scope;
- active port, junction, and reference context;
- exact issued time;
- predicted native outcome;
- prepared command ID;
- expected authority ID;
- native transaction mapping.

Authority changes only through:

```text
gateway.accept(prepared)
```

The panel contains no direct `gateway.execute()` path.

## Lifecycle containment

Candidate targets, decision targets, and prepared commands are invalidated when:

- complete command authority changes;
- owner state refreshes;
- branch or decision identity changes;
- decision reason, state, or candidate membership changes;
- Draft Edit 3D closes;
- another renderer becomes active;
- authority becomes unavailable;
- viewer/runtime failure falls back to Construction SVG;
- the controller is destroyed.

Cancellation discards only prepared evidence and does not mutate authority. Accepted-command stale-work checks and native recomputation remain authoritative at acceptance time.

## Native-runtime qualification

No construction-engine semantics were changed.

The existing native runtime already:

- maps `MARK_TERMINAL` and `MARK_EXTERNAL_BOUNDARY` to their established decision actions;
- accepts the explicit command `issuedAt`;
- normalizes decision-resolution evidence to that issued time;
- records one supervised transaction;
- returns the existing boundary-classification outcome;
- participates in command-journal mapping and atomic workspace publication.

SSK-TS-3D changes only deterministic command qualification, target certification, supervised presentation, and proof.

## Proof contract

Focused proof covers:

- all five approved decision reasons;
- deferred, candidate-bearing, unsupported, missing, stale, and cross-branch rejection;
- read-only automatic decision-target derivation;
- disabled classification controls without exact target;
- actor, reason, and evidence requirements;
- deterministic preparation for both classifications;
- explicit issued-time normalization;
- predicted-result and target review evidence;
- non-mutating cancellation;
- explicit accepted publication;
- target invalidation and lifecycle cleanup;
- continued candidate-target behavior;
- absence of manual connection, reversal, geometry gestures, direct execution, and positional inference.

## Explicit non-goals

SSK-TS-3D does not include:

- `MANUAL_CONNECT`;
- `REVERSE_COMPONENT`;
- manual port-pair selection;
- component-entry selection;
- drag, move, rotate, stretch, break, or topology editing;
- coordinate mutation;
- construction-engine redesign;
- persistence redesign;
- automatic journal adoption;
- default-renderer switching;
- SVG retirement.

Those capabilities require separate Work Packs and qualification evidence.
