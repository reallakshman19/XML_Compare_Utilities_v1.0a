# SSK-TTV-CONV-4A — BRIDGE_GAP Sequential Request Export

## Delivered capability

Topology Validator Edit Draft exposes **Export Bridge** only when:

```text
exactly two nodes are selected
and
one explicit current context edge is established
```

Selection order is authoritative:

```text
first node  → FROM
second node → TO
```

The action downloads `TopologySequentialBridgeGapRequest.v1`. It does not append the native Validator `BRIDGE_GAP` command and does not publish a Sequential edit.

## Request evidence

The artifact records:

- exact endpoint IDs, roles and current positions;
- endpoint source paths, branch indexes and incident edges;
- exact gap displacement and separation;
- the complete current canonical context-edge record;
- context-edge source paths and branch indexes;
- canonical topology and edit-draft hashes;
- command-authority and project-document identity;
- explicit required Sequential node and port identities;
- `automaticIdentityMapping: false`;
- `REQUIRES_QUALIFIED_CONNECTION_AUTHORITY`;
- `publicationState: NOT_PUBLISHED`;
- deterministic request fingerprint.

## Connection-authority boundary

Sequential `MANUAL_CONNECT` is decision- and candidate-bound. This work pack does not treat it as authority to connect arbitrary current nodes or ports.

The request therefore records:

```text
requiredOperation: BRIDGE_GAP
candidateNativeOperation: MANUAL_CONNECT
candidateNativeOperationIsDecisionBound: true
```

A future consumer must independently resolve explicit Sequential endpoint nodes and ports, regenerate current topology, classify candidate compatibility, and use qualified connection publication authority.

## Fail-closed behavior

Request creation rejects:

- invalid canonical, draft, command or project authority;
- missing endpoint or context-edge identity;
- identical endpoints;
- missing canonical node or context edge;
- an existing direct edge between the proposed endpoints;
- non-finite endpoint positions;
- tampered fingerprints;
- mismatch against canonical regeneration.

## Integration

A narrow bridge controller wraps the existing merge-request decorator. It intercepts only:

```text
BRIDGE_SEQUENTIAL_REQUEST
```

Merge export and every other Edit Draft operation delegate unchanged.

## Exclusions

No runtime, writer, canvas, renderer, command journal, native bridge publication, Sequential connection publication, generated data, package script or CI workflow is changed.
