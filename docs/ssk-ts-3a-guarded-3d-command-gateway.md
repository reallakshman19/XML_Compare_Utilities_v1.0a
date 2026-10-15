# SSK-TS-3A — Guarded Draft Edit 3D command gateway

## Scope

SSK-TS-3A introduces a non-visual programmatic gateway between the existing Draft Edit 3D controller and Sequential accepted-command authority.

Baseline:

```text
ddb7d59f72680d0fadf01dec3e321604f0fae968
```

Authoritative Work Pack: issue #664.

The implementation does not add command buttons, gestures, coordinate editing, decision-target controls, implicit journal adoption, or SVG retirement.

## Authority routing

```text
Draft Edit 3D controller programmatic API
→ SequentialDraftEditCommandGateway.v1
→ Sequential command service
→ preparation and acceptance-time recomputation
→ SequentialWorkspaceCommandBoundary.v1
→ existing workspace restorePackage() atomic boundary
→ refreshed read-only production shadow
```

The gateway delegates command preparation and acceptance to `createSequentialCommandService()`. It does not duplicate native construction execution.

## Readiness

A gateway is ready only when:

- an active `SequentialConstructionSession.v1` branch exists;
- source evidence is initialized;
- persisted journal authority is present and structurally valid;
- the journal adoption source fingerprint matches current source evidence;
- the adoption branch set matches the current registry;
- every adopted legacy transaction prefix remains intact;
- a valid current SVG owner revision exists.

The gateway proves the complete condition by deriving the same exact `SequentialEditAuthorityBasis.v1` used by command preparation. It does not equate a structurally valid journal with live authority readiness.

Only `null` and `undefined` mean journal authority is absent. Invalid present authority, stale adoption evidence, uninitialized source, or missing owner revision fails closed. Readiness remains safely inspectable before a branch is opened.

Readiness reports the exact active branch and the existing `SEQUENTIAL_PREPARATION_ENABLED_COMMAND_TYPES` allowlist.

## Request binding

Each request requires:

- a command in the existing deterministic preparation allowlist;
- the active branch ID, either supplied exactly or injected by the gateway;
- `USER` origin;
- non-empty `actorId`;
- exact round-tripping ISO `issuedAt`.

The gateway JSON-validates, copies, and freezes caller command and origin values before delegation. It never mutates caller input. Malformed command and origin failures are coded as `COMMAND_SCHEMA_INVALID`.

Commands outside the deterministic allowlist fail as `COMMAND_RUNTIME_NOT_DETERMINISTIC`. Branch disagreement fails as `COMMAND_BRANCH_MISMATCH`.

## Publication boundary

`SequentialWorkspaceCommandBoundary.v1` derives the exact current authority again immediately before publication. Stale authority fails before workspace mutation.

The command-boundary owner revision combines:

- the actual current SVG owner revision; and
- the exact current journal-head fingerprint.

This ensures that an accepted no-change native result which still appends a journal command advances command publication authority. It cannot be misclassified as partial publication merely because the visual session revision is unchanged.

Before commit, the boundary:

1. validates the complete candidate branch-entry set using a fresh registry;
2. verifies that the candidate active branch snapshot contains the exact candidate session;
3. creates a package-v2-shaped restoration over the existing records, evidence, indexes, decision register, receipt history, and candidate journal state;
4. supports an injected pre-commit failure gate for proof.

Commit reuses the merged `workspace.restorePackage()` boundary with expected journal impact `REPLACE`. This preserves its fresh-registry validation, downstream regeneration, coherent state assignment, 2D repaint containment, and receipt-history preservation.

After commit, the tab explicitly observes the new owner snapshot through the production shadow and schedules a Draft Edit 3D refresh. Draft Edit activation has already returned the Engineering SVG preview to Construction SVG. Synchronization failure is recorded as a publication warning but does not reverse or misreport an already committed accepted command.

## Controller surface

The Draft Edit 3D controller adds only these programmatic methods:

```text
getCommandGatewayState()
prepareCommand(input)
acceptCommand(prepared)
executeCommand(input)
```

No click handler issues a command. Existing picks remain read-only and continue to announce `Read-only; no command issued.`

## Enabled command types

SSK-TS-3A inherits, without expanding, the current deterministic preparation allowlist:

- `ADVANCE_ONE`;
- `RUN_UNTIL_BLOCKED`;
- `DEFER_DECISION`;
- `RESUME_DECISION`;
- `UNDO_LAST_TRANSACTION`;
- `REDO_LAST_TRANSACTION`.

This Work Pack does not enable candidate, manual-connect, reject, terminal, external-boundary, or component-reversal decision commands.

## Proof

The additive dynamic test covers:

- uninitialized readiness;
- valid complete authority readiness;
- structurally valid but adoption-stale authority;
- deterministic preparation;
- successful coherent publication;
- absent and invalid journal authority;
- active-branch mismatch;
- non-deterministic command rejection;
- malformed command/origin evidence;
- stale prepared-command rejection;
- journal-only owner-revision advancement;
- repeated `RUN_UNTIL_BLOCKED` with a no-change native result and committed journal append;
- injected pre-commit failure with unchanged authority;
- post-commit synchronization failure with committed acceptance;
- caller-input immutability.

The static test proves:

- no visible command markup;
- no topology gesture or drag path;
- no implicit journal-adoption creator;
- complete authority derivation during readiness;
- journal-bound command owner revision;
- use of the existing workspace restoration boundary;
- named exports;
- all edited production modules remain below 300 lines;
- the unchanged workspace remains within its approved 486-line exception.

## Deferred to SSK-TS-3B

- visible command controls;
- command confirmation and evidence UX;
- decision-command target resolution;
- candidate selection to command mapping;
- geometry and topology editing;
- production user enablement.
