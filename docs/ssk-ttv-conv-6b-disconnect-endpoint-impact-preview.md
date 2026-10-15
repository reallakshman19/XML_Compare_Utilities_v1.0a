# SSK-TTV-CONV-6B — Sequential DISCONNECT_ENDPOINT Impact Preview

## Delivered capability

Sequential Draft Edit 3D exposes a visible **Disconnect request preview** panel. The operator imports `TopologySequentialDisconnectEndpointRequest.v1` and explicitly supplies:

```text
sequentialRelationshipKind
sequentialRelationshipId
sequentialEndpointNodeId
sequentialEndpointPortId
```

No Validator identity is reused automatically.

## Relationship authority

The preview accepts only:

```text
INTERNAL_EDGE
COMMITTED_CONNECTION
```

Each preview independently regenerates `SequentialEditableTopologySnapshot.v1`, resolves the current relationship, verifies endpoint node/port ownership and relationship side, derives the opposite endpoint, and gathers component, branch, geometry, connection, support, boundary-cut, and repair evidence.

An `INTERNAL_EDGE` mapping must be owned by the selected endpoint port's component. A `COMMITTED_CONNECTION` mapping must match one exact node-and-port side of the selected connection.

## Impact classification

The immutable `SequentialDisconnectEndpointImpactPreview.v1` returns `REVIEWABLE` or `BLOCKED` and classifies:

```text
INTERNAL_COMPONENT_FRAGMENTATION
REPAIR_MEDIATED_CONTINUITY
EXTERNAL_BOUNDARY
REPAIR_BOUNDARY
SUPPORTED_COMPONENT
SHARED_NODE_FANOUT
PORT_RELATIONSHIP_AMBIGUITY
```

Review flags expose cross-branch impact, boundary cuts, coincident distinct endpoint nodes, a Validator/Sequential side difference, and remaining endpoint relationships.

## Publication boundary

The preview always retains:

```text
applicationDisposition: REQUIRES_QUALIFIED_TOPOLOGY_AUTHORITY
currentNativeDisconnectAuthority: UNAVAILABLE
candidateNativeOperation: null
publicationState: NOT_PUBLISHED
```

No internal edge is detached, no committed connection is removed, and no topology, geometry, connection, construction, command, application, or journal publication path is introduced.

## Lifecycle

The panel is owned by component-edit operations, becomes visible with Draft Edit 3D component editing, clears on mode or authority changes, and is destroyed with the owning operation surface.

## Qualification

Focused tests cover explicit relationship/endpoint mapping, ownership and side validation, affected-record aggregation, internal-fragmentation/repair/support blockers, request tamper rejection, re-fingerprinted preview forgery rejection, deterministic regeneration, visible panel wiring, authority invalidation, and publication-path containment.
