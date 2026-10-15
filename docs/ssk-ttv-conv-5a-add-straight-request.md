# SSK-TTV-CONV-5A — ADD_STRAIGHT_ELEMENT Sequential Request

## Delivered capability

The Topology Validator node inspector now provides:

```text
Download Sequential add request
```

The action uses the existing explicit Add inputs:

- exactly one selected start node;
- target X, Y and Z;
- one explicit engineering context edge.

It downloads `TopologySequentialAddStraightRequest.v1` without appending the Validator `ADD_STRAIGHT_ELEMENT` command.

## Request evidence

The immutable artifact contains:

- exact source-node identity, position and ancestry;
- exact target position;
- displacement vector and segment length;
- exact context-edge canonical record and ancestry;
- canonical topology and edit-draft hashes;
- command-authority and project-document identity;
- explicit required Sequential start-node and start-port identities;
- explicit new-component type and target-branch requirements;
- `automaticIdentityMapping: false`;
- `candidateNativeOperation: null`;
- `currentNativeConstructionAuthority: UNAVAILABLE`;
- `REQUIRES_QUALIFIED_CONSTRUCTION_AUTHORITY`;
- `publicationState: NOT_PUBLISHED`;
- deterministic request fingerprint.

## Fail-closed behavior

The request rejects missing authority, source node, context edge or target coordinates. It also rejects a zero-length proposed segment and tampered fingerprint evidence.

The add-request decorator resolves exactly one mounted Edit Draft inspector. Zero or multiple mounted inspectors are rejected rather than guessed.

## Integration boundary

The decorator intercepts only:

```text
ADD_SEQUENTIAL_REQUEST
```

The existing `ADD` action and all merge/bridge/native operations delegate unchanged. No construction command, application service, journal, runtime, writer, canvas or renderer is changed.
