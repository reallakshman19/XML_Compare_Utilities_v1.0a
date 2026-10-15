# SSK-TS-3K — Canonical Editable Topology Snapshot

## Mission

SSK-TS-3K introduces the first topology authority for post-construction piping editing.
It does not enable drag, precision movement, snap, prepare, acceptance, publication,
persistence, export, or renderer cutover.

```text
certified Sequential owner snapshot
+ confirmed construction
+ committed connections and repairs
+ deterministic EngineeringScene projection
+ effective support projection
→ SequentialEditableTopologySnapshot.v1
```

The snapshot is an immutable, deterministic artifact describing what exists, how it
is connected, which scene geometry belongs to which component, and which future edit
capabilities are eligible or blocked.

## Delivered contracts

```text
SequentialEditableTopologySnapshot.v1
SequentialEditEligibility.v1
```

The snapshot contains:

- authority and exact source/session/construction/scene fingerprints;
- branch identity and construction state;
- canonical nodes and resolved ports;
- confirmed components, canonical selection groups, and geometry-part ownership;
- internal component edges;
- committed inter-component connections;
- repair-mediated continuity evidence;
- component-local stationary-topology boundary cuts;
- external, intentional, and open boundary records;
- support carriers and support attachments;
- source, stroke, session, confirmed-construction, and scene ancestry;
- deterministic component selection groups and geometry-part selection handles;
- descriptive component, geometry-part, and node eligibility;
- non-editable candidate and rejected-candidate evidence;
- topology, geometry, ancestry, and whole-snapshot fingerprints.

## Authority rules

### Scene geometry is not authority

EngineeringScene entities are accepted only as deterministic projections of the
certified read model. Scene entity identity and geometry are retained as ancestry,
but the scene cannot independently create or modify topology.

### Exact committed identity only

Ports are assigned to one canonical node only when an accepted committed connection
has exact coincident endpoint coordinates and is not repair-mediated.

```text
coordinate coincidence alone
≠ connected identity
```

Coincident ports without committed connection evidence remain separate nodes.
Repair-mediated endpoints remain distinct nodes linked by explicit repair continuity.

### Geometry-part ownership

A multi-part component remains one component authority.

```text
TEE component
├─ run geometry part
└─ branch geometry part
```

Both parts retain the same `componentId`. A scene geometry part is a selection handle
that resolves to its whole owning component; it is not an independently movable CAD
object.

### Rigid-move eligibility

A single component advertises rigid move and rotation only when its component-local
boundary cut is empty. A connected component does not advertise rigid movement
against stationary neighbours.

Straight pipes may still advertise descriptive stretch and split eligibility. These
capabilities grant no mutation authority in SSK-TS-3K.

### Repair containment

A component or node participating in repair-mediated continuity receives:

```text
LOCKED_CANDIDATE_OR_REPAIR
```

No edit capability is granted for that target in this slice.

### Support containment

Every support attachment must resolve to a confirmed carrier, a resolved support family,
and a finite global position. Incomplete support attachment evidence fails snapshot creation rather than
being omitted or guessed.

## Determinism

Canonical arrays use stable identities and ordering. Fingerprints use the existing
Sequential semantic hash profile:

```text
fnv1a32-canonical-json-v1
```

The snapshot separates:

- topology fingerprint;
- geometry fingerprint;
- ancestry fingerprint;
- complete snapshot fingerprint.

Repeated projection from identical certified authority must produce byte-equivalent
JSON content. Input authority objects remain unchanged.

## Rejection behavior

Snapshot creation fails closed for:

- missing confirmed construction;
- duplicate topology identities;
- missing confirmed port positions;
- conflicting committed coordinates for the same port;
- committed connections referencing unresolved ports;
- confirmed components without owned scene geometry;
- unresolved support families or incomplete carrier/family/position evidence;
- stale or non-canonical certified read models;
- tampered snapshots that differ from independent regeneration.

## Production containment

New production modules are responsibility-separated and remain below 300 lines:

```text
tabs/sequential-sketcher/scoped-edit/sequential-edit-eligibility.js
tabs/sequential-sketcher/scoped-edit/sequential-editable-topology-identity.js
tabs/sequential-sketcher/scoped-edit/sequential-editable-topology-projection.js
tabs/sequential-sketcher/scoped-edit/sequential-editable-topology-snapshot.js
```

The implementation uses named exports, pure projection functions where practical,
immutable JSON outputs, and no runtime, writer, canvas, interaction, publication,
persistence, export, or renderer switch.

## Proof scope

Focused tests cover:

- straight pipe and cap topology;
- elbow and repair-mediated continuity;
- tee run/branch geometry-part ownership;
- olet host/branch port resolution;
- exact committed connection node mapping;
- conflicting multi-connection port-coordinate rejection;
- coincident but unconnected node separation;
- intentional terminal and external boundary classification;
- component boundary-cut evidence;
- rigid-move denial for connected single components;
- support-carrier relationship retention;
- deterministic fingerprints and immutable inputs;
- stale read-model and tampered-snapshot rejection.

## Explicit exclusions

SSK-TS-3K does not add:

- pointer or keyboard interaction;
- numeric movement;
- snap acquisition;
- draft overlays;
- move, stretch, rotate, break, or split execution;
- edit journals or geometry undo/redo;
- support reassignment;
- multi-selection transactions;
- package persistence or interchange export;
- renderer switching or default-renderer promotion.

SSK-TS-3L remains blocked until this snapshot authority is independently qualified
and merged.
