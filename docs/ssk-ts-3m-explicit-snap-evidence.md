# SSK-TS-3M — Explicit Snap and Inference Evidence

## Mission

SSK-TS-3M extends the SSK-TS-3L component move-preview workflow with explicit,
reviewable snap evidence.

```text
raw move preview
+ canonical editable topology
+ confirmed scene geometry
+ explicit snap profile
→ ordered candidate acquisition
→ explicit candidate selection
→ explicit Use candidate
→ snapped preview only
```

The slice does not publish geometry, prepare a command, append an edit journal,
change persistence, modify export, or change the viewer runtime.

## Governing rule

A suggested candidate is evidence only.

```text
acquired suggestion
≠ selected candidate
≠ applied preview candidate
```

The move preview changes only after the operator selects an exact candidate and
activates **Use candidate**. Candidate cycling and selection leave the current draft
fingerprint unchanged.

## Delivered contracts

```text
SequentialMoveSnapProfile.v1
SequentialMoveSnapAcquisition.v1
SequentialMoveSnapSelection.v1
SequentialMoveSnapReviewState.v1
SequentialMoveSnapFeature.v1
```

The existing move draft retains:

```text
rawDelta
rawTargetPoint
delta
effectiveTargetPoint
snapSelection
snapApplied
publicationState: NOT_PUBLISHED
```

This preserves the unsnapped operator request alongside the explicitly selected
effective preview.

## Candidate modes

### Endpoint

Endpoint candidates derive from canonical confirmed topology nodes. The selected
component is excluded. Node, port, component, geometry-part, source point, and
fingerprint ancestry remain in candidate evidence.

### Midpoint

Midpoint candidates derive from exact confirmed segment endpoints. Multi-segment
polylines produce one deterministic source segment identity per segment.

### Centerline

Centerline candidates use a clamped closest point on an exact confirmed segment.
The normalized segment parameter and source point remain in metadata. Endpoint-
equivalent centerline results are excluded so endpoint evidence remains authoritative.
Zero-length source segments fail closed.

### Axis inference

Axis candidates copy exactly one X, Y, or Z coordinate from a confirmed node anchor.
Only axes permitted by the active movement constraint are offered. No candidate can
silently lock multiple axes under an axis-inference mode.

### Grid

Grid snapping exists only when explicitly enabled in the profile. Spacing and origin
are retained as evidence. Only axes permitted by the active constraint are rounded.
There is no default or hidden grid fallback.

### Intersection

Intersection candidates are derived only for active XY, XZ, or YZ plane constraints.
The source segments must be coplanar, non-parallel, non-collinear, and intersect within
both finite segments. Segment-pair identity is canonical. Pair-envelope overflow fails
closed instead of truncating candidates.

## Deterministic ordering

Raw source candidates receive semantic IDs independent of source-array order.
Engineering snap ranking uses:

```text
priority
→ screen distance
→ mode
→ provider ID
→ candidate ID
```

The acquisition retains the complete ordered candidate list, suggested candidate ID,
ranking evidence, source counts, unprojectable IDs, topology fingerprint, geometry
fingerprint, scene revision, constraint, profile, and exact raw world/screen point.

## Explicit review lifecycle

```text
Acquire
→ suggestion visible, selection null
→ Select / Previous / Next
→ selection visible, geometry unchanged
→ Use candidate
→ revalidate target + scene + topology + acquisition + selection
→ restage preview with raw and effective deltas
```

**Clear snap** removes the selection and restores the raw preview delta. Target change,
authority refresh, cancellation, Escape, feature close, and destruction clear acquisition
and selection evidence.

## Revalidation

Before a candidate can be used, the implementation regenerates the acquisition from:

- the current certified move target;
- the current read model and canonical editable topology;
- the current certified scene;
- the original raw world and screen point;
- the acquisition profile and constraint;
- the current world-to-screen projection.

The regenerated acquisition must be byte-equivalent to the reviewed acquisition.
The selection must independently regenerate from the current candidate evidence.
Stale, missing, changed, or tampered evidence fails closed.

## UI behavior

The component move panel exposes:

- enabled snap modes;
- aperture in pixels;
- explicit grid enablement and spacing;
- ordered candidate list;
- suggestion and selected candidate IDs;
- acquisition fingerprint;
- Previous and Next actions;
- Use candidate;
- Clear snap.

The existing viewer transient API renders the raw target, all candidate points, the
selected candidate, and the effective movement vector. The generic viewer is not
modified and does not derive candidates.

## Production modules

```text
tabs/sequential-sketcher/scoped-edit/sequential-move-snap-contracts.js
tabs/sequential-sketcher/scoped-edit/sequential-move-snap-sources.js
tabs/sequential-sketcher/scoped-edit/sequential-move-snap-intersections.js
tabs/sequential-sketcher/scoped-edit/sequential-move-snap-acquisition.js
tabs/sequential-sketcher/scoped-edit/sequential-move-snap-review-store.js
tabs/sequential-sketcher/scoped-edit/sequential-move-snap-feature.js
```

Existing 3L integration remains responsibility-bounded in:

```text
sequential-single-entity-move-draft.js
sequential-single-entity-move-feature.js
sequential-single-entity-move-panel.js
```

Every production module remains below 300 lines. Named production functions remain
at or below 40 lines.

## Proof scope

Focused proof covers:

- profile validation and exact numeric normalization;
- stable semantic candidate IDs;
- endpoint, midpoint, centerline, axis, grid, and intersection derivation;
- selected-component exclusion;
- deterministic source ordering;
- zero-length and envelope rejection;
- generic ranked ordering and deduplication evidence;
- suggestion without automatic selection;
- explicit exact selection and previous/next cycling;
- stale and tampered selection rejection;
- real confirmed-construction acquisition;
- raw versus effective draft retention;
- explicit use and raw-preview restoration;
- non-publication and static authority containment.

## Explicit exclusions

SSK-TS-3M does not add:

- automatic snap substitution;
- geometry publication or command acceptance;
- a geometry edit journal or geometry undo/redo;
- stretch, rotate, break, or split operations;
- support reassignment;
- multi-entity editing;
- persistence or export changes;
- viewer-runtime or renderer switching;
- default-renderer promotion.

SSK-TS-3N remains blocked until SSK-TS-3M is independently qualified and merged.
