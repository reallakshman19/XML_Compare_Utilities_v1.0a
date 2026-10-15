# SSK-TTV-CONV-3 — MERGE_NODES Sequential Request

## Delivered capability

Topology Validator Edit Draft now provides an **Export Merge** toolbar action only when exactly two nodes—and no other objects—are selected.

Selection order is authoritative:

```text
first selected node  → RETIRED / sourceNodeId
second selected node → RETAINED / targetNodeId
```

The action downloads `TopologySequentialMergeNodesRequest.v1` and does not append the Validator `MERGE_NODES` command.

## Artifact evidence

The request records:

- exact retired and retained node IDs;
- exact current positions;
- node separation in millimetres;
- source paths and source branch indexes;
- incident edge IDs;
- canonical topology and edit-draft hashes;
- current command-authority ID;
- project-document, source and scoped identities;
- required downstream operation `MERGE_NODES`;
- required explicit Sequential source and target node identities;
- `automaticIdentityMapping: false`;
- `publicationState: NOT_PUBLISHED`;
- deterministic request fingerprint.

## Integration boundary

A narrow `TopologySequentialMergeNodesController.v1` decorator is applied when the workspace composes the existing Edit Draft controller.

The decorator intercepts only:

```text
MERGE_SEQUENTIAL_REQUEST
```

Every other method and operation delegates to the unchanged base controller. The native operation dispatcher, writer, command journal, runtime and canvas remain unchanged.

## Authority boundary

The artifact does not assert that either Validator node ID exists in Sequential. A future Sequential consumer must resolve explicit Sequential source and target node identities and independently regenerate structural eligibility.

## Rejections

The request builder rejects:

- non-canonical input;
- invalid draft or project authority;
- missing nodes;
- identical source and target nodes;
- non-finite node positions;
- tampered fingerprints;
- mismatch against current canonical regeneration.

## Scope exclusions

This work pack does not change:

- Validator merge publication;
- Sequential structural topology;
- geometry or topology journals;
- runtime, writer, canvas or renderer ownership;
- automatic identity mapping;
- generated snapshots or data;
- CI workflows or package scripts.
