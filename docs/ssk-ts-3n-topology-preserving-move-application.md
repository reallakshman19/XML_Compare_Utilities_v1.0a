# SSK-TS-3N — Topology-Preserving Move Application

## Status

```text
Work Pack: SSK-TS-3N
Authority: Issue #765
Dependency: SSK-TS-3M merged in PR #763
Mode: supervised prepare / review / accept
Geometry undo/redo: not included
```

## Purpose

SSK-TS-3N converts one qualified component move preview into branch-local geometry authority.

It does not rewrite source evidence, confirmed construction, construction stroke records, or the generic viewer. Accepted geometry is represented by an immutable edit journal layered over the existing certified read authority.

## Authority chain

```text
certified owner snapshot
→ support-adjusted owner/read view
→ SequentialGeometryEditJournal.v1
→ SequentialEffectiveGeometryReadModel.v1
→ effective EngineeringScene.v1
→ effective SequentialEditableTopologySnapshot.v1
```

The base authority remains independently available. The effective authority is regenerated from the base plus the complete geometry journal on every read.

## Application eligibility

A move is eligible only when all of the following remain true at preparation time:

- the preview uses `SequentialSingleEntityMoveDraft.v1`;
- publication state is `NOT_PUBLISHED`;
- canonical preview regeneration is byte-semantically equivalent;
- the selected component target independently revalidates;
- the effective delta is non-zero;
- the component advertises `RIGID_MOVE_ELIGIBLE`;
- the component has no stationary component boundary cuts;
- the component has no attached support;
- the component has no repair lock;
- boundary diagnosis is `PRESERVED`;
- all before geometry, ports, and nodes match the current effective topology;
- every affected node is exclusively owned by the moved component.

Connected, support-bearing, repaired, shared-node, stale, or zero-delta moves fail closed.

## Geometry journal

The branch-local journal uses:

```text
SequentialGeometryEditJournal.v1
SequentialGeometryEditEntry.v1
```

Each entry records:

- sequence and previous journal head;
- component, target, operation, and eligibility identity;
- exact raw and effective delta;
- explicit snap selection evidence, when used;
- exact before and after geometry-part records;
- exact before and after port positions;
- exact before and after node positions;
- authority, topology, geometry, scene, and draft ancestry;
- actor, reason, evidence note, and exact ISO timestamp;
- deterministic entry and journal fingerprints.

Before and after identity sets must match exactly. Extra or missing geometry, port, or node rows are rejected.

An operation ID may appear only once in one journal. Replayed operations are rejected before append.

## Stable identity

An accepted move changes positions and geometry but preserves:

- component ID;
- selection-group ID;
- geometry-part IDs;
- port IDs;
- node IDs;
- internal-edge IDs;
- source and construction ancestry.

The effective authority and geometry fingerprints change because the geometry journal head changes.

## Scene projection

Effective scene projection starts from the certified base scene and applies every journal entry in sequence.

For each entry:

1. Current confirmed geometry must equal the recorded before geometry.
2. The after geometry must equal one exact translation of the before geometry.
3. Only confirmed geometry owned by the journal component is replaced.
4. Journal entry identity is added as scene metadata.
5. The base scene remains immutable.

No support, candidate, repair, active-port, diagnostic, writer, export, or viewer-runtime object is rewritten.

## Topology projection

Effective topology projection starts from the canonical base topology and applies every entry in sequence.

For each entry:

- current geometry parts must match the recorded before records;
- current ports must match the recorded before positions;
- current nodes must match the recorded before positions;
- affected nodes must not be shared by another component;
- the component must remain boundary-free and support-free;
- geometry parts, ports, and nodes receive the exact same translation.

Connectivity and identity do not change in this Work Pack.

## Effective read model

`SequentialEffectiveGeometryReadModel.v1` is carried inside the existing `SequentialScopedEditReadModel.v1` outer schema so existing certified consumers can validate it through the read-model authority boundary.

It retains:

- the complete base read model;
- the complete geometry journal;
- geometry journal head fingerprint;
- a derived engineering revision token;
- a derived authority ID and scene ID;
- selection evidence rebound to the effective authority ID.

Validation independently regenerates the complete effective read model.

## Supervised lifecycle

### Prepare

`Prepare move`:

- requires actor and reason;
- validates the current preview and target;
- validates application eligibility;
- derives the current edit authority;
- appends to a candidate journal without publishing;
- regenerates candidate effective read, scene, and topology evidence;
- produces an immutable prepared ID;
- leaves current journal and scene unchanged.

### Review

The application panel displays:

- prepared ID;
- component and operation;
- exact delta;
- raw or explicit snap source;
- previous and proposed journal heads;
- actor and reason;
- publication state.

### Accept

`Apply prepared`:

- validates prepared identity;
- compares current edit authority with prepared authority;
- compares current journal head with the prepared base head;
- independently regenerates candidate journal, entry, effective read, scene, and topology;
- rejects consumed prepared IDs;
- publishes the candidate journal exactly once;
- clears the active target and preview;
- refreshes the effective Draft Edit view.

## Boundary layering

The geometry boundary is layered after support authority:

```text
SequentialWorkspaceCommandBoundary
→ SequentialSupportAdjustmentBoundary
→ SequentialGeometryEditBoundary
```

Destruction uses the reverse dependency order:

```text
Draft Edit controller
→ Geometry edit boundary
→ Support adjustment boundary
→ Scoped Edit shadow
```

This prevents effective geometry authority from outliving its base authority.

## Fail-closed cases

Publication is rejected for:

- stale owner or journal authority;
- changed target or preview;
- changed geometry, port, or node evidence;
- changed effective scene or topology fingerprints;
- connected component;
- support-bearing component;
- repair-mediated component;
- shared node;
- non-rigid or zero-delta move;
- missing actor or reason;
- invalid timestamp;
- duplicate operation ID;
- replayed prepared ID;
- tampered prepared, entry, or journal fingerprints.

## Explicit exclusions

SSK-TS-3N does not add:

- automatic snap substitution;
- connected-component relocation;
- support reassignment;
- stretch, rotate, break, or split;
- multi-selection;
- geometry undo or redo;
- construction-source mutation;
- persistence or export changes;
- writer changes;
- canvas changes;
- Workbench viewer-runtime changes;
- renderer cutover.

## Qualification evidence

Focused proofs cover:

- deterministic journal append and regeneration;
- exact before/after identity-set validation;
- operation replay rejection;
- two sequential effective moves over one immutable base;
- scene and topology regeneration with stable IDs;
- connected and support-bearing projection rejection;
- deterministic effective read authority;
- raw and explicit-snap application evidence;
- connected, support-bearing, and repair-locked eligibility rejection;
- prepared evidence tamper rejection;
- real route-complete prepare and accept lifecycle;
- journal publication exactly once;
- consumed prepared replay rejection;
- controller, boundary, tab, and export containment;
- module, function, named-export, and prohibited-authority checks.

SSK-TS-3O remains blocked until SSK-TS-3N is merged.
