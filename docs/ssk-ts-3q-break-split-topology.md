# SSK-TS-3Q — Break and Split Straight-Pipe Topology

## Status

```text
Work Pack: SSK-TS-3Q
Authority: Issue #772
Dependency: SSK-TS-3P merged in PR #770
Mode: supervised preview / prepare / review / accept
Structural undo/redo: included through topology-journal cursor
```

## Purpose

SSK-TS-3Q introduces the first structural Sequential geometry edit. It splits one current, eligible, straight `PIPE` component into two deterministic child pipes at one exact interior location.

A split is not represented as a same-identity geometry transformation. It creates new canonical component, geometry-part, port, node, internal-edge and committed-connection identities. The operation therefore uses a separate branch-local topology edit journal layered after the existing support and geometry authorities.

Source evidence, confirmed construction, construction stroke records and the geometry journal remain immutable.

## Authority chain

```text
certified owner snapshot
→ support-adjusted authority
→ SequentialGeometryEditJournal.v1
→ current effective geometry read/scene/topology
→ SequentialTopologyEditJournal.v1
→ SequentialEffectiveTopologyReadModel.v1
→ structurally effective EngineeringScene.v1
→ structurally effective SequentialEditableTopologySnapshot.v1
```

The topology boundary reads the complete current geometry authority. When its cursor is zero it returns that geometry authority unchanged, preserving compatibility with existing move, stretch and rotate workflows. When one or more split entries are active it exposes the independently regenerated structural authority.

## Eligible parent

A split target must satisfy all of the following:

- the selected scene entity is confirmed geometry;
- the canonical component type is `PIPE`;
- the component owns exactly one `segment` geometry part;
- the geometry part has exactly two node bindings;
- the component owns exactly one internal edge;
- the component has exactly two distinct endpoint ports and nodes;
- segment endpoints, endpoint nodes and endpoint ports are exactly coincident;
- source/stroke ancestry is complete;
- no support is attached to the parent;
- neither endpoint is an external boundary;
- neither endpoint or incident connection is repair-mediated;
- current read, scene and topology authority independently regenerate.

A fitting, point geometry, polyline pipe, supported pipe, repaired pipe or external-boundary pipe fails closed.

## Split location

### Exact parameter

The operator may provide a normalized parameter `t`.

```text
0 < t < 1
split = start + t × (end - start)
```

Both child lengths must satisfy the declared minimum end distance.

### Explicit acquired point

The operator may provide an explicit acquired world point. The point is orthogonally projected onto the parent segment. The preview records:

- supplied acquired point;
- canonical segment parameter;
- exact projected position;
- projection residual;
- declared projection tolerance.

The residual must not exceed the tolerance. There is no hidden nearest-point substitution.

## Deterministic identities

The identity material contains:

```text
parent component ID
parent geometry-part ID
split operation ID
canonical parameter
```

From that material the operation derives stable identities for:

- upstream child component;
- downstream child component;
- upstream child geometry part;
- downstream child geometry part;
- upstream child-side split port;
- downstream child-side split port;
- canonical split node;
- committed split connection;
- upstream child internal edge;
- downstream child internal edge.

Every generated identity is included in immutable preview and journal evidence. Projection rejects a generated identity that collides with current effective authority.

## Retained and superseded identity

The original outer endpoint port IDs and node IDs remain active and are reassigned to their respective child component.

The parent component and parent geometry part are removed only from active effective topology. Their identities remain in:

- immutable source and construction authority;
- the topology journal entry;
- child ancestry;
- `topologySupersededComponents` evidence.

No source record is deleted or rewritten.

## Structural replacement

One accepted split replaces the active parent evidence with:

```text
2 child PIPE components
2 child segment geometry parts
4 child ports total
3 affected nodes total
2 child internal edges
1 new committed connection
2 reciprocal child-to-child boundary cuts
```

The two outer ports and outer nodes retain identity. The two new split-side ports are exactly coincident at the new split node.

## Connected-neighbor consistency

A parent may be connected to stationary components at either outer endpoint. Those reciprocal relationships are part of the exact structural transaction.

For each stationary neighbor, the split entry records and regenerates:

- the stationary component before and after neighbor lists;
- the stationary component boundary cut before and after;
- replacement of the superseded parent neighbor ID with the correct child ID;
- unchanged stationary component, port, geometry and connection identities.

The new child-to-child connection receives one boundary-cut record for each child. This prevents either connected child from being incorrectly classified as rigid-move or rotate eligible.

## Child ancestry

Each child retains the parent’s source and construction ancestry and adds:

- parent component ID;
- parent geometry-part ID;
- split operation ID;
- child role: `UPSTREAM` or `DOWNSTREAM`;
- child scene-entity ID.

The original confirmed construction fingerprint and source stroke identity remain available.

## Topology journal

The structural journal uses:

```text
SequentialTopologyEditJournal.v1
SequentialTopologyEditEntry.v1
SPLIT_PIPE
```

The journal contains:

- branch ID;
- base geometry-read authority ID;
- base topology fingerprint;
- base geometry-journal fingerprint;
- immutable entry array;
- active cursor;
- complete journal fingerprint;
- active-prefix head fingerprint.

Each entry records:

- sequence and previous active head;
- operation, target and parent identity;
- canonical location and generated identities;
- complete before and after structural arrays;
- before and after scene entities;
- source, geometry, topology, scene, target and draft ancestry;
- actor, reason, evidence note and exact ISO timestamp;
- deterministic entry ID.

Structural arrays are independently validated for required cardinality, unique IDs and deterministic child identities.

## Undo and redo

Undo and redo move only the topology journal cursor.

```text
undo: cursor = cursor - 1
redo: cursor = cursor + 1
```

Entries are never mutated. Projection uses only `entries.slice(0, cursor)`.

A new accepted split after undo truncates the inactive redo tail before appending the new entry. Operation IDs remain protected against replay across the complete pre-truncation journal.

Undo before cursor zero and redo beyond the stored tail fail closed.

## Geometry-authority compatibility

Existing component move, node stretch and subgraph rotation use the geometry edit boundary. They remain available only when the topology cursor is zero.

When the cursor is greater than zero, the component-operation owner rejects geometry-mode selection and requires the operator to undo all active splits first.

If the cursor is zero and the underlying geometry authority changes, inactive topology redo history is reset because it no longer matches its certified base. An active split journal never silently rebases.

## Effective read model

`SequentialEffectiveTopologyReadModel.v1` retains the outer `SequentialScopedEditReadModel.v1` schema for existing certified consumers. It includes:

- the complete topology-base read model;
- complete topology journal;
- active-head fingerprint;
- full history fingerprint;
- cursor-derived engineering revision;
- derived authority and scene IDs;
- selection authority rebound to the effective authority.

Validation independently regenerates the model.

## Scene projection

For each active entry, scene projection:

1. validates the exact parent entity;
2. rejects child scene-ID collisions;
3. removes the active parent entity;
4. inserts the two deterministic child entities;
5. retains all stationary scene entities unchanged;
6. adds topology-journal metadata;
7. derives the effective scene revision and ID from structural authority.

Preview remains non-publishing and displays the parent as a ghost plus the two child segments as draft geometry.

## Topology projection

For every structural collection, projection:

- validates all recorded before rows against current authority;
- rejects duplicate after IDs;
- rejects collisions with current non-replaced rows;
- replaces same-ID affected rows in place;
- inserts generated rows at the parent position;
- preserves unaffected row ordering;
- appends superseded-parent evidence;
- derives an effective structural fingerprint.

The projected collections include:

- components;
- geometry parts;
- ports;
- nodes;
- internal edges;
- committed connections;
- component boundary cuts;
- selection groups;
- selection candidates;
- edit eligibility;
- support carriers.

## Supervised lifecycle

### Preview

`Preview split` validates target and location, generates deterministic identities, creates two child segment geometries and publishes no authority.

### Prepare

`Prepare split` requires actor and reason and then:

- independently revalidates target and preview;
- reads current topology journal and edit authority;
- generates complete exact before/after replacement evidence;
- appends to a candidate journal only;
- regenerates candidate read, scene and topology authority;
- records candidate fingerprints and prepared ID;
- leaves current authority unchanged.

### Accept

`Apply prepared`:

- validates prepared identity;
- compares current edit authority and journal fingerprint;
- validates the candidate journal against current geometry authority;
- regenerates the active tail entry, read model, scene and topology;
- rejects consumed prepared IDs;
- publishes exactly once;
- refreshes the Draft Edit view and history panel.

## Operator interface

Component operation modes now include:

```text
Move component
Stretch node
Rotate
Split pipe
```

Split mode exposes:

- parameter or acquired-point source;
- exact `t`;
- acquired X/Y/Z;
- minimum end distance;
- projection tolerance;
- preview and cancel;
- actor, reason and evidence note;
- prepare, apply and discard.

A separate history panel exposes:

- active cursor and entry count;
- `Undo split`;
- `Redo split`.

## Fail-closed cases

The implementation rejects:

- non-PIPE or non-segment target;
- incomplete or stale target authority;
- supported parent;
- repair-mediated endpoint or connection;
- external-boundary endpoint;
- duplicate endpoint port or node;
- zero-length parent;
- non-finite parameter or point;
- parameter outside `(0,1)`;
- minimum-end-distance violation;
- acquired-point projection miss;
- generated identity collision;
- incomplete or duplicate structural evidence;
- changed parent, endpoint, reciprocal-neighbor or boundary-cut evidence;
- stale base geometry authority;
- stale topology journal;
- tampered prepared evidence;
- operation replay;
- consumed prepared-ID replay;
- undo/redo outside cursor limits.

## Explicit exclusions

SSK-TS-3Q does not add:

- automatic fitting insertion;
- branch or tee creation;
- automatic snapping or hidden point substitution;
- automatic reconnection or topology repair;
- support reassignment;
- arbitrary component deletion;
- multi-selection;
- persistence or interchange;
- writer or export changes;
- canvas or Workbench viewer-runtime changes;
- renderer cutover.

## Qualification evidence

Focused evidence covers:

- exact parameter split;
- acquired-point projection and residual;
- minimum-distance and projection rejection;
- deterministic identity generation;
- complete parent/child structural evidence;
- connected stationary-neighbor and reciprocal boundary-cut remapping;
- new child-to-child boundary cuts;
- effective topology and scene projection;
- stable outer endpoint and unrelated identities;
- journal regeneration and replay rejection;
- cursor-only undo/redo;
- redo-tail truncation;
- real route-complete prepare/apply/undo/redo;
- stale and tampered evidence rejection;
- module, function, export and prohibited-authority containment.

SSK-TS-3R remains blocked until SSK-TS-3Q is merged.
