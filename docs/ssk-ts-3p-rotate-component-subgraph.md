# SSK-TS-3P — Rotate Component and Connected Subgraph

## Status

```text
Work Pack: SSK-TS-3P
Authority: Issue #769
Dependency: SSK-TS-3O merged in PR #768
Mode: supervised prepare / review / accept
Geometry undo/redo: not included
```

## Purpose

SSK-TS-3P adds one explicit rigid-rotation operation to the Sequential Draft Edit 3D component-operation surface.

The operation rotates either:

- one selected confirmed component; or
- one deterministically resolved connected subgraph.

The operator must declare the scope, pivot, axis vector, and angle. The system does not infer a pivot, substitute an axis, reconnect a boundary, or repair topology.

## Authority chain

```text
certified owner snapshot
→ support-adjusted read authority
→ effective geometry journal authority
→ canonical editable topology snapshot
→ explicit rotation target
→ immutable rotation preview
→ prepared rotation evidence
→ explicit acceptance
→ ROTATE_SUBGRAPH journal entry
→ regenerated effective scene and topology
```

Confirmed construction, source evidence, and construction strokes remain immutable.

## Explicit operation mode

The component-operation owner now exposes:

```text
MOVE_COMPONENT
STRETCH_NODE
ROTATE_SUBGRAPH
```

Only the active child operation receives a confirmed-component pick.

Changing the active operation:

1. clears move, stretch, and rotation targets;
2. clears all current draft previews;
3. invalidates all prepared operation evidence;
4. activates only the selected child feature.

This preserves the merged move and stretch lifecycle boundaries.

## Rotation scope

### Component only

`COMPONENT_ONLY` contains exactly the selected canonical component.

The target retains all geometry parts, ports, nodes, internal edges, and connections associated with that component. Any selected-to-stationary committed connection becomes an explicit boundary cut.

### Connected subgraph

`CONNECTED_SUBGRAPH` starts from the selected component and performs deterministic breadth-first traversal through current committed connections.

Traversal crosses a connection only when:

- it is not repair-mediated;
- its from/to node identity is exact;
- the neighboring component exists;
- the neighboring component has no certified support attachment.

Selected component IDs are sorted after traversal. The target fingerprint therefore does not depend on traversal insertion order.

Repair-mediated, support-bearing, missing, or otherwise locked neighbors remain outside the selected set and are exposed as explicit target locks or boundary evidence.

## Rotation target contract

The target uses:

```text
SequentialRotationTarget.v1
```

It records:

- selected scene object ID;
- seed component ID and canonical type;
- explicit scope;
- ordered affected component IDs;
- ordered geometry-part, port, node, internal-edge, and connection IDs;
- complete supported point/segment/polyline geometry;
- geometry-part node bindings;
- selected-to-stationary boundary cuts;
- target locks and rotation eligibility;
- scene, topology, geometry, and geometry-journal ancestry;
- deterministic target identity.

Different geometry handles belonging to the same seed component and scope resolve to the same rotation target identity.

## Transform contract

The transform uses:

```text
SequentialRotationProfile.v1
SequentialRotationTransform.v1
```

Required input:

- pivot X/Y/Z;
- axis X/Y/Z;
- angle in degrees;
- explicit numeric precision profile;
- explicit boundary tolerance.

The axis is normalized deterministically. A zero-length axis is rejected. An axis that cannot retain direction at the declared precision is rejected.

The angle is reduced to the canonical interval:

```text
[-180 degrees, 180 degrees)
```

Angles equivalent to zero are rejected.

Rotation uses the canonical Rodrigues formula. The same transform is applied to every affected:

- point geometry position;
- segment start/end point;
- polyline vertex;
- port position;
- topology-node position.

No geometry kind, point count, vertex order, or node binding may change.

## Boundary compatibility

Boundary diagnosis uses:

```text
SequentialRotationBoundaryDiagnosis.v1
```

Each selected-to-stationary boundary record contains:

- boundary and connection identity;
- selected and stationary port identity;
- original selected position;
- rotated selected position;
- stationary position;
- exact separation vector;
- separation magnitude;
- disposition.

Disposition is:

```text
PRESERVED
WOULD_DISCONNECT
```

A boundary is preserved only when the rotated selected position remains within the explicit boundary tolerance of stationary authority.

A boundary point on the declared rotation axis is unchanged by the transform and may remain compatible. A boundary away from the axis normally becomes disconnecting.

No closest-point projection, automatic reconnection, hidden snap, or topology repair is performed.

## Draft preview

The preview uses:

```text
SequentialRotationDraft.v1
```

The draft records:

- exact target and transform;
- original and rotated geometry parts;
- original and rotated port/node evidence;
- complete boundary diagnosis;
- deterministic operation and draft fingerprints;
- publication state `NOT_PUBLISHED`.

Preview dispositions are:

```text
NO_CHANGE
PREVIEW_ONLY_ROTATION_LOCKED
PREVIEW_ONLY_ROTATION_CLEAR
PREVIEW_ONLY_BOUNDARY_DISCONNECTION
```

Original/draft overlays use the existing Engineering SVG draft store and overlay composition. No viewer-runtime change is introduced.

## Supervised application

### Prepare

`Prepare rotation` requires:

- current independently regenerated target;
- current canonical preview;
- target eligibility with no locks;
- non-zero effective transform;
- `PREVIEW_ONLY_ROTATION_CLEAR`;
- all boundaries preserved;
- current affected component identity set;
- operator ID and reason;
- exact ISO application timestamp.

Preparation appends to a candidate journal only. Current geometry remains unchanged.

### Review

The application panel exposes:

- prepared ID;
- scope and seed component;
- affected component IDs;
- pivot;
- normalized axis;
- angle;
- boundary count and dispositions;
- previous and proposed journal heads;
- operator and reason;
- publication state.

### Accept

`Apply prepared`:

1. validates the prepared fingerprint;
2. compares current edit authority;
3. compares the current geometry-journal head;
4. independently regenerates the journal entry;
5. independently regenerates the effective scene and topology;
6. rejects consumed prepared IDs;
7. publishes the candidate journal exactly once;
8. clears the current rotation target and preview.

## Geometry journal extension

`SequentialGeometryEditEntry.v1` now supports:

```text
MOVE_COMPONENT
STRETCH_NODE
ROTATE_SUBGRAPH
```

Existing move and stretch entry shapes remain unchanged.

A rotation entry adds:

- seed component ID;
- scope;
- affected component IDs;
- pivot and normalized axis;
- canonical angle in degrees and radians;
- rotation profile and transform fingerprint;
- boundary compatibility diagnosis;
- exact before/after geometry, ports, and nodes.

Before and after identity sets must match exactly. Geometry-part node bindings must remain stable.

Journal canonical regeneration independently rebuilds the transform and boundary diagnosis. A rotation entry with a disconnecting boundary cannot be canonicalized.

## Effective projection

### Scene

Every affected confirmed scene entity must:

- belong to an affected component;
- match the recorded before geometry;
- regenerate to the exact recorded after geometry.

Scene metadata records entry, operation, type, seed component, and scope evidence.

### Topology

Effective topology projection verifies:

- every affected component exists and remains support-free;
- every recorded geometry part, port, and node matches current effective authority;
- the affected identity sets equal the complete selected-subgraph authority;
- shared nodes move only when every incident component is selected;
- boundary diagnosis is wholly preserved.

Shared selected nodes are compared as unique canonical identities. Duplicate membership through multiple components does not create duplicate journal rows.

Effective committed-connection endpoint positions are updated from rotated port evidence without changing connection identity.

## Publication receipt

Accepted rotation returns:

```text
SequentialSubgraphRotationPublication.v1
```

The receipt contains:

- prepared, entry, and operation IDs;
- seed and affected component IDs;
- scope;
- pivot, axis, and angle;
- expected edit-authority ID;
- geometry-journal head;
- effective read, scene, and topology fingerprints.

Existing move and stretch receipt schemas remain unchanged.

## Fail-closed cases

Rotation is rejected for:

- blank or non-finite input;
- zero-length or precision-degenerate axis;
- zero-equivalent angle;
- unsupported geometry;
- incomplete geometry/node binding;
- changed identity set, geometry kind, point count, or binding;
- support-bearing affected component;
- repair boundary or repair-mediated continuity;
- external boundary in selected authority;
- locked stationary neighbor;
- shared node movement while an incident component remains stationary;
- any disconnecting boundary;
- stale scene, topology, journal, target, or edit authority;
- tampered prepared evidence;
- duplicate operation ID;
- consumed prepared-ID replay.

## Explicit exclusions

SSK-TS-3P does not add:

- automatic pivot or axis inference;
- automatic snap substitution;
- automatic reconnection;
- topology repair;
- implicit component, fitting, port, node, or connection creation;
- arbitrary fitting reshaping beyond rigid transformation;
- break or split;
- support reassignment;
- multi-selection;
- geometry undo/redo;
- source mutation;
- persistence or export changes;
- viewer-runtime, writer, or canvas changes;
- renderer cutover.

## Qualification evidence

Focused evidence covers:

- X/Y/Z and arbitrary-axis Rodrigues rotation;
- point, segment, and polyline regeneration;
- component-only and connected-subgraph targeting;
- deterministic traversal and target identity;
- preserved and disconnecting boundaries;
- exact immutable draft regeneration;
- supervised prepare and accept;
- stable component, part, port, node, edge, and connection identities;
- mixed MOVE_COMPONENT, STRETCH_NODE, and ROTATE_SUBGRAPH journal replay;
- shared-node unique-identity handling;
- support and stale-authority rejection;
- operation and prepared-ID replay containment;
- module, function, export, path, and prohibited-authority checks.

SSK-TS-3Q remains blocked until SSK-TS-3P is merged.
