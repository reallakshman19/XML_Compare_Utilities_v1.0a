# SSK-TTV-CONV-4B — Sequential BRIDGE_GAP Impact Preview

## Delivered capability

Sequential Draft Edit 3D now displays a **Bridge request preview** panel on the right side of the component-edit view.

The operator loads `TopologySequentialBridgeGapRequest.v1` and explicitly enters:

```text
sequentialFromNodeId
sequentialFromPortId
sequentialToNodeId
sequentialToPortId
```

Validator identities are never reused automatically.

## Current-authority regeneration

Every preview independently rebuilds:

```text
SequentialEditableTopologySnapshot.v1
```

from the current read model. The chosen nodes and ports are then resolved against this regenerated authority.

## Preview evidence

`SequentialBridgeGapImpactPreview.v1` records:

- Validator request fingerprint and context-edge evidence;
- current Sequential authority and topology fingerprints;
- explicit Validator-to-Sequential endpoint mapping;
- exact node and port evidence;
- displacement and separation;
- affected components and branches;
- affected geometry parts and internal edges;
- affected committed connections and supports;
- deterministic blockers and review flags;
- `REVIEWABLE` or `BLOCKED` impact status;
- `REQUIRES_QUALIFIED_CONNECTION_AUTHORITY`;
- `candidateNativeOperation: MANUAL_CONNECT`;
- `candidateNativeOperationIsDecisionBound: true`;
- `publicationState: NOT_PUBLISHED`.

## Fail-closed mapping

The preview rejects missing or unknown nodes and ports, identical nodes or ports, and any port that does not belong to its explicitly selected node.

The preview blocks:

```text
REPAIR_BOUNDARY
EXTERNAL_BOUNDARY
DIRECT_INTERNAL_EDGE_EXISTS
DIRECT_COMMITTED_CONNECTION_EXISTS
SAME_COMPONENT_LOOP
PORT_ALREADY_CONNECTED
SUPPORTED_COMPONENT
```

Review flags identify coincident distinct nodes, cross-branch impact and mixed boundary classes.

## Connection-authority boundary

`REVIEWABLE` is impact evidence only. It does not authorize connection creation.

Sequential `MANUAL_CONNECT` remains decision- and candidate-bound. This work pack does not create a native command, append a command journal entry, call an application service, or publish a topology, geometry or connection transaction.

## Integration

The bridge preview is owned beside the existing merge preview. Both panels are activated and invalidated with the component-edit lifecycle; the bridge panel is positioned on the right to avoid overlap.

## Exclusions

No runtime, writer, canvas, renderer, construction command, application service, geometry journal, topology journal, generated data, package script or CI workflow is changed.
