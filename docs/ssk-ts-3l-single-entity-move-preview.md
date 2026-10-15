# SSK-TS-3L — Single-Entity Move/Drag Draft Preview

## Mission

SSK-TS-3L adds a usable, non-publishing preview workflow for translating one confirmed
Sequential component. It consumes the canonical topology authority delivered by
SSK-TS-3K and does not create an edit command, journal entry, persistence record,
export mutation, or renderer switch.

```text
SequentialEditableTopologySnapshot.v1
+ selected confirmed geometry part
→ whole-component selection group
+ X / Y / Z or XY / XZ / YZ constraint
+ viewer world ray or exact numeric delta
→ SequentialSingleEntityMoveDraft.v1
→ original and draft overlays
→ exact boundary-disconnection diagnosis
→ cancel only
```

## Delivered contracts

```text
SequentialSingleEntityMoveTarget.v1
SequentialMoveConstraint.v1
SequentialMoveBoundaryDiagnosis.v1
SequentialSingleEntityMoveDraft.v1
SequentialSingleEntityMoveDrag.v1
SequentialSingleEntityMovePanel.v1
SequentialSingleEntityMoveFeature.v1
```

## Whole-component target authority

A confirmed scene geometry part is only a selection handle. Target resolution follows
3K evidence:

```text
sceneEntityId
→ selectionCandidateId
→ selectionGroupId
→ componentId
→ complete geometryPartIds
```

Tee run and branch handles resolve to the same `moveTargetId`. The selected handle is
retained as evidence, but it does not redefine component identity.

Targets fail closed when:

- no canonical selection candidate exists;
- selection-group or component ownership is incomplete;
- the component type is outside the qualified geometry classes;
- eligibility contains repair, ancestry, source, construction-head, or geometry locks;
- a geometry part is absent from the certified scene.

## Qualified geometry

The preview translates complete point, segment, and polyline geometry for:

- pipe;
- elbow;
- tee;
- olet;
- reducer;
- valve;
- flange;
- gasket;
- instrument;
- coupling;
- union;
- cap and blind.

Every part of a multi-part component receives the same exact translation vector.
Input topology, scene, target, and geometry objects remain immutable.

## Constraint model

Qualified constraints are explicit:

```text
Axis:  X, Y, Z
Plane: XY, XZ, YZ
```

Numeric input accepts finite `ΔX`, `ΔY`, and `ΔZ`. Components outside the selected
axis or plane are deterministically zeroed.

Pointer movement uses existing viewer authority only:

- `pickAt(clientX, clientY)` verifies that drag starts on the selected component;
- `screenRay(clientX, clientY)` supplies world-space rays;
- `acquireNavigationLock(owner)` suspends camera navigation for the drag lifecycle;
- `setTransient(overlay)` shows the pivot-to-draft displacement vector.

Axis movement is solved by closest points between the selected axis line and each
pointer ray. Plane movement is solved by exact ray-plane intersection. No nearest
object, tolerance search, object snap, grid snap, or inferred constraint is present.

## Drag lifecycle

```text
idle
→ pointer down on already selected component
→ navigation lock acquired
→ dragging
→ immutable draft updates on pointer move
→ pointer up
→ review
```

Pointer up releases navigation and leaves the draft reviewable. It does not prepare,
accept, execute, apply, or publish geometry.

Cancellation occurs on:

- explicit `Cancel preview`;
- Escape;
- pointer cancellation;
- target replacement;
- owner-authority refresh;
- Draft Edit 3D deactivation;
- feature destruction;
- drag-solving failure.

Every cancellation releases navigation, clears transient feedback, clears the draft
store, and leaves confirmed authority unchanged.

## Boundary diagnosis

Each component boundary cut records:

- selected and stationary component/port identities;
- original selected-port position;
- translated selected-port position;
- stationary-port position;
- exact separation vector and magnitude;
- one of:

```text
PRESERVED
WOULD_DISCONNECT
REPAIR_BOUNDARY_LOCKED
```

Aggregate preview dispositions are:

```text
NO_CHANGE
PREVIEW_ONLY_RIGID_TRANSLATION_CLEAR
PREVIEW_ONLY_BOUNDARY_DISCONNECTION
PREVIEW_ONLY_REPAIR_BOUNDARY_LOCKED
```

This evidence is diagnostic only. A connected single component may be previewed to
show the exact consequence, but SSK-TS-3L grants no application authority.

## Visual and UI behavior

The existing Draft Edit 3D visual projection composes:

1. the authoritative scene;
2. any existing contained support draft;
3. the component move draft.

Changed component parts are rendered as:

- `ORIGINAL COMPONENT` ghost geometry;
- `DRAFT COMPONENT` translated geometry;
- a transient pivot-to-draft vector and endpoint marker.

The contained panel exposes:

- selected component/type/part count;
- axis or plane constraint;
- exact numeric delta fields;
- `Preview numeric`;
- `Cancel preview`;
- exact delta, disposition, and per-boundary gap evidence.

## Production containment

```text
tabs/sequential-sketcher/scoped-edit/sequential-single-entity-move-target.js
tabs/sequential-sketcher/scoped-edit/sequential-single-entity-move-geometry.js
tabs/sequential-sketcher/scoped-edit/sequential-single-entity-move-draft.js
tabs/sequential-sketcher/scoped-edit/sequential-single-entity-move-drag.js
tabs/sequential-sketcher/scoped-edit/sequential-single-entity-move-panel.js
tabs/sequential-sketcher/scoped-edit/sequential-single-entity-move-feature.js
```

All new production modules remain below 300 lines and use named exports. The existing
controller remains below 300 lines. The generic Workbench viewer, construction
command gateway, support publication boundary, writers, canvases, persistence,
packages, and export paths are unchanged.

## Proof scope

Focused tests cover:

- tee run/branch convergence to one target identity;
- locked repair target rejection;
- stale authority rejection;
- X/Y/Z and XY/XZ/YZ filtering;
- axis and plane pointer solutions;
- point, segment, and polyline translation;
- multi-part draft overlays;
- original input immutability;
- preserved, disconnected, and repair boundary diagnosis;
- deterministic target, drag, and draft identities;
- navigation lock acquisition and release;
- wrong-object drag rejection;
- pointer-up without publication;
- explicit cancellation and draft clearing;
- line, function, export, and prohibited-pattern containment.

## Explicit exclusions

SSK-TS-3L does not add:

- object, endpoint, midpoint, grid, or tangent snapping;
- geometry application or publication;
- command prepare/review/accept;
- edit journals or geometry undo/redo;
- stretch, rotate, break, or split;
- support reassignment;
- multi-selection;
- persistence or export changes;
- viewer-runtime changes;
- default-renderer promotion.

SSK-TS-3M remains blocked until this preview-only interaction layer is independently
qualified and merged.
