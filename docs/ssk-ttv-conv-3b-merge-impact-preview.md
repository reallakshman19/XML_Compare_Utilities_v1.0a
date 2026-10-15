# SSK-TTV-CONV-3B — Sequential MERGE_NODES Impact Preview

## Delivered capability

Sequential Draft Edit 3D now shows a **Merge request preview** panel whenever component editing is active.

The operator:

1. loads `TopologySequentialMergeNodesRequest.v1`;
2. enters an explicit Sequential source node ID;
3. enters an explicit Sequential retained target node ID;
4. creates current structural-impact evidence.

No Validator node ID is automatically reused as a Sequential identity.

## Current-authority regeneration

Every preview independently rebuilds:

```text
SequentialEditableTopologySnapshot.v1
```

from the current Sequential read model. The request is then evaluated against the regenerated node, component, connection, support and boundary evidence.

## Preview evidence

`SequentialMergeNodesImpactPreview.v1` contains:

- Validator request fingerprint;
- current Sequential authority and topology fingerprints;
- explicit Validator-to-Sequential mapping;
- retired and retained node evidence;
- displacement vector and separation;
- affected component IDs;
- affected geometry-part IDs;
- affected port IDs;
- affected internal-edge IDs;
- affected committed-connection IDs;
- affected support-attachment IDs;
- affected branch IDs;
- deterministic blockers and review flags;
- `REVIEWABLE` or `BLOCKED` impact status;
- `REQUIRES_QUALIFIED_STRUCTURAL_JOURNAL`;
- `publicationState: NOT_PUBLISHED`.

## Deterministic blockers

The preview reports:

```text
REPAIR_BOUNDARY
EXTERNAL_BOUNDARY
SHARED_COMPONENT_COLLAPSE
INTERNAL_EDGE_COLLAPSE
COMMITTED_CONNECTION_COLLAPSE
SUPPORTED_COMPONENT
```

Review flags separately identify coincident distinct nodes, cross-branch impact and mixed boundary classes.

## Authority boundary

`REVIEWABLE` means only that the currently visible impact evidence has no listed blockers. It does not authorize publication.

Structural acceptance remains unavailable until a qualified structural topology journal supports identity retirement, connection remapping, support disposition, undo/redo and exact replay.

## Scope exclusions

This work pack does not add or change:

- topology or geometry journal publication;
- application or acceptance services;
- runtime, writer, canvas or renderer ownership;
- component move, node stretch or rotation behavior;
- automatic cross-authority identity mapping;
- generated snapshots or data;
- CI workflows or package scripts.
