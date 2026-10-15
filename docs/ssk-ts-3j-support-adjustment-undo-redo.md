# SSK-TS-3J — Supervised support-adjustment undo and redo

## Status

```text
Work Pack: #721
Dependency: SSK-TS-3I / PR #720
Authority: branch-local in-memory support-adjustment history
Construction command authority: unchanged
Package persistence: excluded
```

## Purpose

SSK-TS-3J adds explicit undo and redo for accepted support adjustments without using the Sequential construction transaction ledger, construction undo/redo stacks, or construction command journal.

The authority chain is:

```text
immutable base support projection
+ current branch-local support-adjustment history
→ current support-adjustment register
→ effective support projection
→ engineering/read/scene/edit authority
```

## History contract

`SequentialSupportAdjustmentHistory.v1` owns:

- the complete base support-projection fingerprint;
- the current immutable `SequentialSupportAdjustmentRegister.v1`;
- an immutable undo stack of prior register snapshots;
- an immutable redo stack of forward register snapshots;
- a deterministic history fingerprint.

Accepted support adjustment:

```text
undoStack += previous current register
currentRegister = accepted next register
redoStack = []
```

Undo:

```text
current register → redo stack
latest undo register → current register
```

Redo:

```text
current register → undo stack
latest redo register → current register
```

The stacks contain only canonical register snapshots. No inverse geometry command is synthesized.

## Supervised lifecycle

```text
choose Prepare undo or Prepare redo
→ require actor, reason and evidence
→ capture exact current edit authority
→ capture base projection, history and register heads
→ derive next history and effective support projection
→ review affected adjustment and authority evidence
→ Apply prepared or Cancel
```

Preparation is non-publishing. Acceptance independently regenerates the transition and verifies:

- prepared ID;
- current edit authority;
- base projection fingerprint;
- current history fingerprint;
- current register head;
- next history;
- affected adjustment;
- independently regenerated effective support projection.

A stale, replayed or altered prepared transition fails closed.

## Panel behavior

The contained support panel exposes:

```text
Preview move draft
Prepare undo
Prepare redo
Apply prepared
Cancel
```

Undo and redo are disabled when their corresponding stacks are empty. `Apply prepared` is disabled until either a support move or support-history transition has been prepared.

The review surface shows:

- action;
- affected adjustment;
- support and carrier;
- effective from/to coordinates;
- current and next register heads;
- current and next history fingerprints;
- edit authority;
- exact issued time.

## Branch lifecycle

History is held by `SequentialSupportAdjustmentBoundary.v1`, keyed by branch ID and complete base support-projection fingerprint.

- switching branches restores each branch's current register, undo stack and redo stack;
- returning to a branch restores its in-memory support history;
- support-only source refresh clears incompatible history even when confirmed pipe construction is unchanged;
- confirmed-construction changes also clear incompatible history;
- closing the Sequential tile destroys all in-memory support history.

## Authority separation

Support history changes only:

```text
branch-local support-adjustment history
current support-adjustment register
effective support projection
engineering/read/scene/edit authority fingerprints
```

It does not modify:

```text
source support records or evidence indexes
SequentialConstructionSession.v1
ConfirmedSequentialConstruction.v1
construction decision or repair ledgers
construction transaction / undo / redo stacks
construction command journal
workspace package or exported source payload
```

The twelve construction commands remain unchanged, including construction `UNDO_LAST_TRANSACTION` and `REDO_LAST_TRANSACTION`. Those commands do not operate on support-adjustment history.

## Proof catalog

```text
tests/sequential-support-adjustment-history.test.mjs
tests/sequential-support-adjustment-history-service.test.mjs
tests/sequential-support-adjustment-workspace.test.mjs
tests/sequential-draft-edit-support-move-panel.test.mjs
tests/sequential-scoped-edit-3d-static.test.mjs
```

The proofs cover deterministic history identity, stack ordering, redo clearing, prepare/accept, stale/tampered/replayed rejection, branch restoration, source refresh invalidation, UI enablement and construction-authority separation.

## Explicit exclusions

- package, export, local-storage or server persistence;
- source support-record rewriting;
- cross-carrier reassignment;
- drag, snapping UI, axis locks and keyboard nudging;
- component geometry and topology editing;
- SVG retirement or default-renderer changes.

## Validation boundary

Connector-backed source, scope and ancestry inspection is available. Exact-head Node, browser, aggregate and CI execution is not available in this environment because `github.com` cannot be resolved. No unexecuted result is represented as green.
