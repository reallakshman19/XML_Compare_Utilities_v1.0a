# SSK-TS-3H — Exact Support-Point Move Draft Preview

## Status

SSK-TS-3H establishes the first bounded geometry-draft capability in Sequential Draft Edit 3D.

It is intentionally a preview-only capability. It does not alter accepted construction, support projection, source evidence, command journal, transaction history, workspace persistence, or exported project data.

## Scope

The only editable scene category in this increment is:

```text
SEQUENTIAL_CONFIRMED_SUPPORT
category: support
edit capability: MOVE_DRAFT
geometry: point
```

Confirmed components, repairs, connection candidates, reversal candidates, active ports, rejected candidates, and all other scene entities remain non-editable.

## Authority chain

```text
current Sequential owner state
→ certified SequentialScopedEditReadModel.v1
→ deterministic scoped EngineeringScene.v1
→ exact confirmed-support entity
→ current SequentialConfirmedSupportProjection.v1 glyph
→ immutable SequentialDraftEditSupportMoveTarget.v1
→ typed absolute X/Y/Z + operator provenance
→ EngineeringEditIntent.v1 / MOVE_ENTITY
→ EngineeringSvgDraftSnapshot.v1
→ original-and-draft visual overlay
```

No caller-provided object name, screen position, proximity, ray distance, visual order, or prior selection is accepted as support identity.

## Scoped scene capability

The base Sequential Engineering SVG remains read-only.

The scoped Draft Edit scene adapter independently rebuilds the certified scene and adds `MOVE_DRAFT` only to entities whose exact category is `support`. The scoped scene continues to report `editing: false`; its capability records only that a support move draft preview is available.

This distinction prevents the read-only preview from being interpreted as a general editing or publication authority.

## Exact support target

`SequentialDraftEditSupportMoveTarget.v1` binds:

- accepted-command authority ID;
- certified read authority ID;
- branch ID;
- exact scene revision;
- support glyph ID;
- support family ID;
- carrier ID;
- scene entity ID;
- original engineering position;
- semantic support-move target ID.

Target construction independently verifies:

1. the read model and scoped scene ancestry;
2. the complete current command authority;
3. scene domain type `SEQUENTIAL_CONFIRMED_SUPPORT`;
4. scene category `support`;
5. `MOVE_DRAFT` capability;
6. current `SequentialConfirmedSupportProjection.v1` evidence;
7. exact glyph, family, carrier, and point identity;
8. equality between scene point geometry and `centerlinePointGlobal`.

Any mismatch fails closed.

## Draft creation

The operator must explicitly select Preview after entering:

- absolute X;
- absolute Y;
- absolute Z;
- operator actor ID;
- operator reason;
- evidence note.

Blank, non-finite, or unchanged coordinates are rejected.

Preview creates exactly one:

```text
EngineeringEditIntent.v1
  type: MOVE_ENTITY
  entityIds: [one support entity]
  baseRevision: exact scoped scene revision
```

and exactly one `EngineeringSvgDraftSnapshot.v1` geometry entry containing immutable original and draft point geometry.

The preview record is `SequentialDraftEditSupportMovePreview.v1` and includes:

- target evidence;
- edit intent;
- draft snapshot;
- original position;
- draft position;
- XYZ delta and magnitude;
- `publicationState: NOT_PUBLISHED`.

## Visual overlay

The authoritative scoped scene is validated before overlay composition.

When a draft exists, the shared Engineering SVG overlay composer produces:

- an `ORIGINAL SUPPORT` ghost marker at the current confirmed position;
- a `DRAFT SUPPORT` marker at the requested position.

The ghost and draft use distinct marker sizes and colors. The overlay does not replace or mutate the certified source scene.

## User interaction

```text
pick cyan confirmed support
→ command targets are cleared
→ exact support target is certified
→ current coordinates populate the numeric fields
→ typing alone changes no draft state
→ Preview stages a non-publishing overlay
→ Cancel clears the overlay
```

The panel reuses the existing Draft Edit operator actor, reason, and evidence fields. It does not add a second provenance form.

There is no Apply, Accept, Commit, Publish, or Execute control for the support draft.

## Lifecycle invalidation

The target and draft are cleared when:

- Sequential owner authority changes;
- the read model or scene is regenerated;
- support projection evidence changes;
- another command or support target is selected;
- Draft Edit 3D closes;
- the renderer changes;
- containment fallback occurs;
- the feature or controller is destroyed.

Cancel and invalidation do not mutate accepted authority.

## Command coexistence

All twelve supervised construction commands remain unchanged:

```text
ADVANCE_ONE
RUN_UNTIL_BLOCKED
CONNECT_CANDIDATE
MANUAL_CONNECT
REJECT_CANDIDATE
MARK_TERMINAL
MARK_EXTERNAL_BOUNDARY
REVERSE_COMPONENT
DEFER_DECISION
RESUME_DECISION
UNDO_LAST_TRANSACTION
REDO_LAST_TRANSACTION
```

Support draft preview is not a thirteenth construction command and does not enter the accepted-command journal.

## Explicit exclusions

SSK-TS-3H does not provide:

- support-draft application or publication;
- support-projection mutation;
- component or pipe movement;
- candidate or diagnostic movement;
- pointer drag or axis locking;
- keyboard nudging;
- snapping or nearest-object inference;
- connect, merge, add, split, delete, disconnect, rotate, stretch, or break;
- multi-entity editing;
- SVG retirement or a default-renderer change.

## Validation record

Focused source proof covers:

- real confirmed-support projection and exact target regeneration;
- wrong-category, missing-support, carrier mismatch, position mismatch, and stale-authority rejection;
- blank, non-finite, and unchanged coordinate rejection;
- immutable `MOVE_ENTITY` intent and one-entity draft snapshot;
- distinct original/draft overlay markers;
- non-mutating selection and typing;
- explicit Preview and Cancel behavior;
- lifecycle containment and absence of publication APIs;
- production line limits and named exports;
- preservation of all twelve construction commands.

The current execution environment cannot resolve `github.com`, so no exact-checkout Node, browser, aggregate, npm, or CI pass is claimed.

## Successor boundary

SSK-TS-3I may define an explicit support-draft apply contract only after SSK-TS-3H is reviewed and merged.

Component geometry editing, topology editing, broad gesture tooling, and SVG retirement remain separate blocked increments.
