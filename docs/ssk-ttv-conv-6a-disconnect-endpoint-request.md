# SSK-TTV-CONV-6A — DISCONNECT_ENDPOINT Sequential Request

## Delivered capability

The Topology Validator edge inspector now provides:

```text
Download Sequential disconnect request
```

The operator selects exactly one current edge and explicitly chooses its `FROM` or `TO` endpoint. The action downloads `TopologySequentialDisconnectEndpointRequest.v1` without appending the native Validator `DISCONNECT_ENDPOINT` command.

## Request evidence

The immutable artifact contains:

- the exact current edge record and source ancestry;
- the selected endpoint role, node identity, position and source ancestry;
- the opposite endpoint node and position;
- canonical `FROM → TO` displacement and edge length;
- all incident edge IDs at the selected endpoint;
- exact related support, rigid, junction and boundary records;
- canonical-topology and edit-draft hashes;
- command-authority and project-document identity;
- explicit required Sequential relationship kind and ID;
- explicit required Sequential endpoint node and port IDs;
- supported relationship kinds `INTERNAL_EDGE` and `COMMITTED_CONNECTION`;
- `automaticIdentityMapping: false`;
- `candidateNativeOperation: null`;
- `currentNativeDisconnectAuthority: UNAVAILABLE`;
- `REQUIRES_QUALIFIED_TOPOLOGY_AUTHORITY`;
- `publicationState: NOT_PUBLISHED`;
- deterministic request fingerprinting.

## Fail-closed behavior

The request rejects:

- missing canonical, draft, command or project authority;
- missing selected edge or either edge endpoint node;
- invalid endpoint roles other than `FROM` or `TO`;
- non-finite endpoint geometry;
- tampered request evidence;
- regeneration differences from current authority.

The decorator resolves exactly one mounted Edit Draft inspector. Zero or multiple mounted inspectors are rejected rather than guessed.

## Integration boundary

The decorator intercepts only:

```text
DISCONNECT_SEQUENTIAL_REQUEST
```

The existing native `DISCONNECT` action and all merge, bridge, add, move and other native operations delegate unchanged. No command, application service, topology journal, geometry journal, runtime, writer, canvas or renderer is changed.
