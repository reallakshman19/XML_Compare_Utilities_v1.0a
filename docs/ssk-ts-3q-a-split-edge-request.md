# SSK-TS-3Q-A — SPLIT_EDGE Sequential Request Export

## Delivered capability

The Topology Validator edge inspector exposes **Download Sequential split request** beside the existing native Split action. The operator selects exactly one canonical edge and supplies a split fraction strictly inside `(0, 1)`.

The action exports immutable `TopologySequentialSplitEdgeRequest.v1` evidence and does not append the Validator `SPLIT_EDGE` command.

## Evidence

The artifact records the exact edge and endpoint nodes, source ancestry, canonical geometry, displacement, total length, split position, left/right segment lengths, and related supports, rigids, junctions, boundaries, bends, and point features. Canonical topology, draft, command, and project-document authority are retained.

## Sequential boundary

```text
candidateNativeOperation: SPLIT_PIPE
candidateNativeOperationIsBounded: true
currentNativeSplitAuthority: BOUNDED_ADAPTER_UNQUALIFIED
automaticIdentityMapping: false
applicationDisposition: REQUIRES_QUALIFIED_STRUCTURAL_TOPOLOGY_AUTHORITY
publicationState: NOT_PUBLISHED
```

The downstream preview must explicitly identify the Sequential component, geometry part, internal edge, and branch and qualify the selected component as a straight `PIPE` segment.

## Exclusions

No Validator split is applied. No Sequential structural topology command, construction decision, application service, geometry journal, topology journal, support reassignment, runtime, writer, canvas, or renderer path is changed.
