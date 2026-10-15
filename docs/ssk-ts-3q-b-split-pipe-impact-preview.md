# SSK-TS-3Q-B — Sequential SPLIT_PIPE structural-impact preview

## Status

```text
Work Pack: SSK-TS-3Q-B
Authority: Issue #840
Mode: evidence-only bounded structural-impact preview
Native split publication: prohibited
```

## Delivered capability

Sequential Draft Edit 3D displays a visible **Split request preview** panel while component editing is active. The operator imports `TopologySequentialSplitEdgeRequest.v1` and explicitly supplies:

```text
sequentialComponentId
sequentialGeometryPartId
sequentialInternalEdgeId
sequentialBranchId
```

No Validator identity is mapped automatically.

Each preview independently regenerates `SequentialEditableTopologySnapshot.v1` and verifies the exact current component, geometry part, internal edge, endpoint nodes, branch and ownership chain. The request fraction is projected onto the mapped Sequential internal edge to produce the exact Sequential split position and left/right lengths.

## Bounded qualification

The downstream candidate remains:

```text
candidateNativeOperation: SPLIT_PIPE
candidateNativeOperationIsBounded: true
currentNativeSplitAuthority: BOUNDED_ADAPTER_UNQUALIFIED
applicationDisposition: REQUIRES_QUALIFIED_STRUCTURAL_TOPOLOGY_AUTHORITY
publicationState: NOT_PUBLISHED
```

A reviewable mapping requires one `PIPE` component, one geometry part, one internal edge and `segment` geometry. The preview does not claim that a native structural-topology operation is qualified or available.

## Evidence

The immutable preview contains:

- request and current topology fingerprints;
- explicit Validator-to-Sequential mapping;
- canonical component, geometry-part and internal-edge records;
- endpoint node, port and boundary evidence;
- Sequential split geometry;
- affected branches, connections, supports, boundary cuts and repairs;
- blockers and source-to-Sequential geometry review flags.

## Blockers

```text
NON_PIPE_COMPONENT
MULTI_PART_COMPONENT
MULTI_SEGMENT_COMPONENT
UNSUPPORTED_GEOMETRY
SUPPORTED_COMPONENT
BOUNDARY_CUT_PRESENT
REPAIR_MEDIATED_CONTINUITY
PROTECTED_ENDPOINT_BOUNDARY
SPLIT_POSITION_COLLISION
```

Review flags identify source-length differences, source split-position differences, reversed direction, multiple neighbour components and multiple endpoint connections.

## Integrity

Request fingerprint validation is mandatory. The preview assertion independently verifies component/part/edge/branch ownership, edge order and endpoint identity, endpoint evidence positions, source command and source split geometry, mapped Sequential split geometry, affected identity sets, impact status and all authority dispositions. Consistently re-fingerprinted ownership, endpoint-position or source-geometry forgery is rejected.

## Exclusions

This work pack does not split a component, add a node or port, replace geometry, update confirmed construction, append a structural-topology or geometry journal entry, call an application service, or change runtime, writer, canvas or renderer behavior.
