# SSK-TTV-CONV-7A — DELETE_EDGE retirement request export

## Delivered boundary

Topology Validator Edit Draft exposes a visible edge-inspector action:

```text
Download Sequential retirement request
```

The action exports immutable `TopologySequentialDeleteEdgeRequest.v1` evidence for exactly one selected canonical edge. It does not append the native `DELETE_EDGE` command and does not invoke a Sequential edit.

## Evidence

The request preserves:

- exact edge and endpoint-node records;
- edge and node source ancestry;
- canonical displacement and length;
- complete incident-edge evidence at both endpoints;
- related supports, rigids, junctions, boundaries, bends and point features;
- canonical topology, edit-draft, command-authority and ProjectDocument identity;
- a deterministic request fingerprint.

## Sequential boundary

No native retirement operation is claimed:

```text
requiredOperation: DELETE_EDGE
candidateNativeOperation: null
currentNativeRetirementAuthority: UNAVAILABLE
retirementQualificationScope: WHOLE_COMPONENT_ONLY
automaticIdentityMapping: false
applicationDisposition: REQUIRES_QUALIFIED_STRUCTURAL_RETIREMENT_AUTHORITY
publicationState: NOT_PUBLISHED
```

The downstream authority must explicitly provide:

```text
sequentialComponentId
sequentialGeometryPartId
sequentialInternalEdgeId
sequentialBranchId
```

`WHOLE_COMPONENT_ONLY` is a qualification scope, not an implemented mutation. A selected Validator edge may be rejected downstream when it does not correspond to one independently qualified whole Sequential component.

## Integrity controls

The assertion independently checks command/edge identity, canonical endpoint ownership, endpoint positions, incident-edge records, derived incidence lists, displacement, length, explicit mapping requirements and non-publishing dispositions. Current-authority regeneration remains mandatory for exact completeness.

## Exclusions

This work pack does not add component retirement, node or port deletion, support reassignment, connection removal, repair deletion, geometry replacement, structural-topology journaling, application services, runtime changes, writer changes, canvas changes or renderer changes.
