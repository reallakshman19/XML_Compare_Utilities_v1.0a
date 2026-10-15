# SSK-TS-3C — Exact 3D candidate targeting and supervised connect/reject

## Status

This increment introduces the first target-bearing accepted commands from the Sequential Draft Edit 3D surface.

It does not introduce geometry editing.

The enabled target commands are limited to:

```text
CONNECT_CANDIDATE
REJECT_CANDIDATE
```

The previously qualified non-target commands remain available:

```text
ADVANCE_ONE
RUN_UNTIL_BLOCKED
DEFER_DECISION
RESUME_DECISION
UNDO_LAST_TRANSACTION
REDO_LAST_TRANSACTION
```

## Authority chain

The target chain is:

```text
SequentialEngineeringSvgOwnerSnapshot.v1
→ SequentialScopedEditReadModel.v1
→ deterministic EngineeringScene.v1
→ exact scene entity ID
→ exact current decision candidate
→ SequentialDraftEditCandidateTarget.v1
→ SequentialNativeCommand.v1
→ SequentialPreparedCommand.v1
→ acceptance-time recomputation
→ atomic workspace publication
```

No target is derived from screen coordinates, spatial proximity, visual order, object labels, approximate positions, ray distance or nearest-object search.

## Exact candidate target

`SequentialDraftEditCandidateTarget.v1` records:

- full accepted-command authority ID;
- certified read-model authority ID;
- exact branch ID;
- exact current decision ID;
- exact current candidate ID;
- exact certified scene entity ID;
- semantic target-selection fingerprint.

The target resolver independently regenerates and validates:

1. the scoped edit read model;
2. scene ancestry against that read model;
3. current accepted-command authority;
4. branch and session agreement;
5. current open decision;
6. scene entity category;
7. candidate membership in the current decision.

A valid target entity must have:

```text
domainRef.category = candidate
domainRef.candidateId = currentDecision.candidates[*].candidateId
```

Confirmed components, repairs, supports, active ports and rejected candidates can remain visually selectable but cannot become candidate command targets.

## Two-step supervision

A viewer pick only establishes target evidence.

```text
pick
→ visual selection
→ exact target resolution
→ target display
```

It does not call command preparation or acceptance.

The operator must then provide:

- actor ID;
- engineering reason;
- evidence note.

The command flow remains:

```text
prepare
→ review immutable evidence
→ accept or cancel
```

The prepared review identifies:

- command type;
- branch ID;
- decision ID;
- candidate ID;
- scene entity ID;
- issued time;
- predicted native outcome;
- prepared command ID;
- expected authority ID;
- native transaction mapping.

## Deterministic command qualification

`SEQUENTIAL_PREPARATION_ENABLED_COMMAND_TYPES` is expanded only by:

```text
CONNECT_CANDIDATE
REJECT_CANDIDATE
```

The native construction runtime already accepts an explicit command-issued time and normalizes generated transaction and decision evidence to that time.

Qualification therefore proves:

- repeated preparation against equivalent authority is semantically identical;
- current decision and candidate evidence is exact;
- one native transaction maps to one accepted command;
- journal envelope transaction identity matches native recomputation;
- acceptance revalidates authority and target evidence;
- stale candidate work is rejected before publication.

The following remain outside the deterministic preparation allowlist:

```text
MANUAL_CONNECT
MARK_TERMINAL
MARK_EXTERNAL_BOUNDARY
REVERSE_COMPONENT
```

## Target lifetime

Candidate target evidence is invalidated when:

- accepted-command authority ID changes;
- owner state publishes a refresh;
- branch or current decision changes;
- candidate membership changes;
- Draft Edit 3D closes;
- another renderer is selected;
- Draft Edit authority becomes unavailable;
- runtime containment returns to Construction SVG;
- the controller is destroyed.

Prepared command evidence is invalidated with the target on the same boundaries.

Cancellation discards the prepared command without publishing authority. The still-current reviewed target may remain selected after ordinary cancellation, but it is revalidated against exact authority before another preparation.

## Publication boundary

The panel calls:

```text
gateway.prepare(...)
gateway.accept(prepared)
```

The visible panel never calls `gateway.execute()`.

Acceptance continues through the merged command service:

1. validate prepared identity;
2. compare exact current authority;
3. recompute complete result;
4. compare target, scope and candidate result;
5. recheck authority before publication;
6. publish through the workspace restoration boundary;
7. verify complete committed state and owner revision advancement.

## Changed production surface

```text
tabs/sequential-sketcher/scoped-edit/sequential-command-contracts.js
tabs/sequential-sketcher/scoped-edit/sequential-draft-edit-target-selection.js
tabs/sequential-sketcher/scoped-edit/sequential-draft-edit-command-panel.js
tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-3d-controller.js
tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-index.js
tabs/sequential-sketcher/sequential-sketcher-markup.js
```

## Explicit exclusions

SSK-TS-3C does not add:

- manual port-pair connection;
- component reversal;
- terminal classification;
- external-boundary classification;
- coordinate editing;
- drag, move, rotate, stretch or break operations;
- topology mutation gestures;
- automatic command execution on pick;
- journal adoption or persistence migration;
- command-service or workspace-publication redesign;
- SVG retirement or renderer-default change.

Those capabilities require separate Work Packs and evidence contracts.
