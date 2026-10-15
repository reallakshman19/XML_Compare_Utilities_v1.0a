# SSK-TS-3O — Stretch Endpoint and Certified Node Editing

## Status

```text
Work Pack: SSK-TS-3O
Authority: Issue #767
Dependency: SSK-TS-3N merged in PR #766
Mode: exact preview + supervised prepare / review / accept
Geometry undo/redo: excluded
```

## Purpose

SSK-TS-3O adds one explicit topology operation to Draft Edit 3D: move a certified, port-bearing topology node to an exact target position while regenerating only the geometry vertices and port positions bound to that node.

The operation is not a visual override and does not rewrite source evidence, confirmed construction, stroke records, component identity, connection identity, or the generic viewer. An accepted stretch is an immutable `STRETCH_NODE` entry in the existing branch-local `SequentialGeometryEditJournal.v1` authority.

## Operator workflow

```text
select confirmed component
→ choose Stretch node mode
→ choose qualified node
→ enter exact target X/Y/Z
→ preview original and regenerated geometry
→ Prepare stretch
→ review evidence
→ Apply prepared
→ regenerate effective scene and topology
```

`Move component` remains the default component operation. Component picks are delegated only to the active operation mode.

## Canonical node semantics

A canonical node can own one or more confirmed ports and can be incident to geometry from one or more confirmed components.

A stretch moves the node as one atomic identity group:

- every port whose `nodeId` equals the selected node receives the same exact target point;
- every incident geometry vertex explicitly bound to the selected node receives the same target point;
- every other geometry vertex remains unchanged;
- effective committed-connection endpoint positions are updated for moved ports;
- the selected node ID and every component, geometry-part, port, internal-edge, and connection ID remain stable.

No implicit pipe, fitting, port, node, or connection is created.

## Target qualification

`SequentialNodeStretchComponentSelection.v1` resolves one confirmed scene handle to one component and lists only qualified nodes belonging to that component.

`SequentialNodeStretchTarget.v1` independently regenerates:

- current read authority and scene revision;
- canonical topology, geometry, and snapshot fingerprints;
- selected component and selected scene handle;
- selected node, node eligibility, and original position;
- complete canonical node port group;
- complete incident geometry-part set and node bindings;
- affected component set;
- incident committed-connection identities.

A target is rejected when:

- the selected object is not confirmed component geometry;
- the node is not port-bearing or does not belong to the selected component;
- any canonical port is not exactly coincident with the node;
- geometry/node binding is incomplete;
- an incident geometry part is missing or unsupported;
- an incident component carries a certified support attachment;
- the node is an external boundary;
- the node or an incident connection is repair-mediated;
- current authority differs from deterministic target regeneration.

## Geometry regeneration

Supported geometry kinds are:

```text
point
segment
polyline
```

For each affected geometry part, the node-binding sequence must have the same length as the geometry point sequence. Only indexes whose binding equals the selected node ID may change.

The draft retains:

- original and target node position;
- exact delta and magnitude;
- original and regenerated geometry for every affected part;
- unchanged node-binding sequences;
- segment-length diagnostics;
- straight-pipe collinearity diagnostics;
- the visible qualification profile.

## Qualification profile

`SequentialNodeStretchProfile.v1` carries explicit values for:

- minimum segment length in millimetres;
- zero-length tolerance in millimetres;
- collinearity tolerance.

The default profile is visible in the panel and is part of draft and journal identity. Empty numeric values are rejected rather than coerced to zero.

The geometry draft fails closed for:

- non-finite coordinates or profile values;
- zero-length segments;
- segments below the explicit minimum length;
- changed geometry kind or point count;
- incomplete node bindings;
- a moved internal vertex that kinks a previously straight pipe;
- unsupported geometry.

A no-change target may be previewed for diagnosis but cannot be prepared or published.

## Draft authority

`SequentialNodeStretchDraft.v1` is immutable and non-publishing.

It contains:

- selected target and authority ancestry;
- exact target point;
- qualification profile;
- delta and no-change classification;
- regenerated geometry-part records;
- original-and-draft overlay state;
- deterministic operation and draft fingerprints;
- publication state `NOT_PUBLISHED`.

Preview, node change, component change, mode change, authority refresh, cancel, Escape, and feature close invalidate pending application evidence.

## Journal extension

`SequentialGeometryEditEntry.v1` now supports:

```text
MOVE_COMPONENT
STRETCH_NODE
```

Existing move-entry canonical regeneration remains unchanged.

A `STRETCH_NODE` entry adds:

- selected node ID;
- affected component IDs;
- exact target position;
- qualification profile;
- geometry-part node-binding sequences;
- exact before and after geometry;
- exact complete moved-port group;
- exact before and after selected-node position.

Before and after identity sets and geometry bindings must match exactly. A changed or omitted binding is rejected.

The journal remains anchored to one immutable base topology fingerprint. Mixed move and stretch entries are applied in sequence, so every entry validates against the effective state produced by all earlier entries.

## Effective scene projection

For `STRETCH_NODE` entries, scene projection:

1. verifies every affected scene entity is confirmed geometry owned by an affected component;
2. verifies current geometry equals the entry’s before geometry;
3. independently regenerates after geometry from the selected node binding and target point;
4. replaces only the affected geometry;
5. records immutable entry, operation, type, selected component, and node metadata.

Candidate, repair, support, active-port, diagnostic, writer, export, and viewer-runtime entities remain unchanged.

## Effective topology projection

Topology projection independently verifies:

- current node identity, position, boundary class, and affected component set;
- exact complete incident geometry-part evidence;
- exact complete canonical port-group evidence;
- current node bindings and before geometry;
- support-free affected components;
- absence of repair-mediated continuity;
- exact regenerated after geometry and target positions.

It then updates:

- affected geometry-part geometry;
- every canonical node port position;
- selected node position and position ancestry;
- effective committed-connection endpoint positions.

Topology and connection identity do not change.

## Supervised application

`Prepare stretch` requires:

- one current non-published stretch draft;
- a non-zero qualified target;
- current deterministic target regeneration;
- current edit authority and journal head;
- actor and reason;
- exact ISO application timestamp.

Preparation appends to a candidate journal only. It does not modify the live branch journal.

The prepared candidate includes independently regenerated effective read, scene, and topology fingerprints.

`Apply prepared` revalidates current edit authority, journal head, prepared fingerprint, candidate journal tail, effective scene, and effective topology. A consumed prepared ID cannot be replayed.

Accepted publication uses `SequentialNodeStretchPublication.v1` and refreshes the effective Draft Edit view.

## Component operation containment

`SequentialComponentEditOperations.v1` owns the explicit operation mode:

```text
MOVE_COMPONENT
STRETCH_NODE
```

Only the active child feature is enabled. Switching modes clears targets, drafts, snap evidence, and prepared evidence in both child workflows before enabling the selected mode.

The controller consumes the orchestration boundary and remains below the existing 300-line ceiling. It does not directly own stretch geometry or application logic.

## Fail-closed evidence

Qualification covers:

- pipe endpoint stretch;
- connected pipe/fitting node stretch;
- point, segment, and polyline regeneration;
- exact complete port-group movement;
- effective connection endpoint projection;
- stable IDs and node bindings;
- minimum-length, zero-length, and collinearity rejection;
- supported-component, repair-boundary, external-boundary, and stale-target rejection;
- prepared evidence tamper, stale authority, operation replay, and prepared replay rejection;
- mixed `MOVE_COMPONENT` and `STRETCH_NODE` journal regeneration;
- mode-switch and existing move containment;
- module, function, named-export, path, and prohibited-authority checks.

## Explicit exclusions

SSK-TS-3O does not add:

- automatic snap substitution for stretch;
- hidden projection or topology repair;
- implicit component or fitting creation;
- arbitrary fitting reshaping beyond node-bound vertices;
- rotate, break, split, support reassignment, or multi-selection;
- geometry undo or redo;
- source-evidence or confirmed-construction mutation;
- persistence or export changes;
- writer or canvas changes;
- viewer-runtime changes;
- renderer cutover.

SSK-TS-3P remains blocked until SSK-TS-3O is merged.
