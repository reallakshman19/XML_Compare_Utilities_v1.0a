# SSK-TTV-CONV-5B — Sequential ADD_STRAIGHT_ELEMENT Impact Preview

## Delivered capability

Sequential Draft Edit 3D now displays an **Add straight request preview** panel while component editing is active.

The operator loads `TopologySequentialAddStraightRequest.v1` and explicitly enters:

```text
sequentialFromNodeId
sequentialFromPortId
newComponentCanonicalType
targetBranchId
```

Validator identities are never reused automatically.

## Current-authority regeneration

Every preview independently rebuilds `SequentialEditableTopologySnapshot.v1` from the current read model before resolving the selected node, port, branch, components, connections, geometry, and supports.

## Type boundary

`ADD_STRAIGHT_ELEMENT` is intentionally restricted to:

```text
PIPE
```

Other component types require their own construction semantics and are rejected rather than treated as straight pipe.

## Preview evidence

`SequentialAddStraightImpactPreview.v1` records:

- Validator request and context-edge evidence;
- current Sequential authority and topology fingerprints;
- explicit Validator-to-Sequential start mapping;
- selected node and port evidence;
- selected `PIPE` type and target branch;
- Sequential start position, Validator target position, displacement, and length;
- Validator-to-Sequential source-position offset;
- affected components, branches, geometry parts, edges, connections, and supports;
- deterministic blockers and review flags;
- `REVIEWABLE` or `BLOCKED` impact status;
- `REQUIRES_QUALIFIED_CONSTRUCTION_AUTHORITY`;
- `currentNativeConstructionAuthority: UNAVAILABLE`;
- `candidateNativeOperation: null`;
- `publicationState: NOT_PUBLISHED`.

## Fail-closed behavior

Preview creation rejects missing or unknown nodes, ports, branches, unsupported component types, and port-to-node mismatches.

It blocks:

```text
REPAIR_BOUNDARY
EXTERNAL_BOUNDARY
PORT_ALREADY_CONNECTED
SUPPORTED_START_COMPONENT
TARGET_BRANCH_DISCONTINUITY
TARGET_NODE_COLLISION
```

Review flags document source-position mismatch, selected-port branch mismatch, multi-branch start nodes, and connected nodes with an explicitly open selected port.

## Construction-authority boundary

A `REVIEWABLE` result is evidence only. Current Sequential construction commits source-indexed components and does not expose arbitrary new-component creation.

This work pack does not import or call the construction engine, create a component, append a command, call an application service, or publish a construction, connection, topology, or geometry journal entry.

## Integration

The add-straight preview is owned beside the existing merge and bridge previews. It is activated, cleared, invalidated, and destroyed through the same component-edit lifecycle. Its panel is positioned at the upper right to avoid the existing lower-left and lower-right preview panels.
