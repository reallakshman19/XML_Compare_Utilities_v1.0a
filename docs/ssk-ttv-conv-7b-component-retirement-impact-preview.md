# SSK-TTV-CONV-7B — Sequential whole-component retirement impact preview

## Delivered boundary

Sequential Draft Edit 3D exposes a visible `Retirement request preview` panel while component editing is active. The panel imports `TopologySequentialDeleteEdgeRequest.v1` and requires explicit Sequential component, geometry-part, internal-edge and branch identities.

No Validator identity is mapped automatically.

## Current-authority regeneration

Every preview independently regenerates `SequentialEditableTopologySnapshot.v1`. The mapped internal edge is an explicit anchor only. The impact scope expands to the complete owning component and records all currently owned:

- geometry parts and internal edges;
- nodes and ports;
- committed connections;
- support attachments;
- component boundary cuts;
- repairs and all committed connections incident to owned component nodes;
- open boundaries;
- the component selection group and support carrier.

The preview compares the Validator source edge with the mapped Sequential anchor geometry and reports direction, endpoint and length differences.

## Classification

A preview is `BLOCKED` when current evidence includes:

```text
INCOMPLETE_COMPONENT_ANCESTRY
SUPPORTED_COMPONENT
BOUNDARY_CUT_PRESENT
REPAIR_MEDIATED_CONTINUITY
SHARED_NODE_DEPENDENCY
PROTECTED_EXTERNAL_BOUNDARY
```

Review flags expose whole-component expansion across multiple parts or edges, required connection retirement, neighbouring components, open boundaries and source-geometry differences.

## Authority disposition

```text
candidateNativeOperation: null
currentNativeRetirementAuthority: UNAVAILABLE
retirementQualificationScope: WHOLE_COMPONENT_ONLY
applicationDisposition: REQUIRES_QUALIFIED_STRUCTURAL_RETIREMENT_AUTHORITY
publicationState: NOT_PUBLISHED
```

`WHOLE_COMPONENT_ONLY` is a qualification scope. It does not authorize or implement component retirement.

## Integrity

The immutable `SequentialComponentRetirementImpactPreview.v1` embeds and revalidates the complete Validator request. Its assertion independently checks:

- explicit component, part, edge and branch ownership;
- anchor endpoint order and geometry-part coordinates;
- complete whole-component record sets, including node-incident connections;
- selection-group, support-carrier, repair and open-boundary scope;
- complete construction ancestry and affected identity sets;
- source-edge geometry;
- blocker and review-flag regeneration;
- authority and publication dispositions;
- deterministic preview fingerprint.

Current-topology regeneration remains mandatory before reliance on the evidence.

## Explicit exclusions

This work pack does not remove components, parts, edges, nodes, ports, connections, supports or repairs. It does not replace geometry, invoke an application service, append a structural-topology or geometry journal entry, or change runtime, writer, canvas or renderer behavior.
