# SSK-TTV-CONV-2B — Sequential Stretch-Request Consumer

## Delivered capability

Sequential Draft Edit 3D now provides a visible import panel in **Stretch node** mode:

```text
Import Validator move request
```

The operator loads a `TopologySequentialMoveNodeRequest.v1` file, supplies an explicit Sequential component object ID and Sequential node ID, and creates the existing certified-node stretch preview.

## Explicit identity boundary

The consumer does not infer that the Topology Validator node ID equals any Sequential identity.

The preview plan requires:

```text
selectedObjectId
sequentialNodeId
```

The operator may type these values or use the explicit **Use current stretch selection** action after selecting the component and node in Sequential.

## Preview flow

```text
validated Validator request
→ explicit Sequential identities
→ SequentialNodeStretchRequestPlan.v1
→ current component selection regeneration
→ current certified node target regeneration
→ existing STRETCH_NODE draft store
→ preview overlay
```

The resulting preview remains:

```text
publicationState: NOT_PUBLISHED
```

Application still requires the existing separate prepare-and-accept controls. Importing a request never invokes acceptance or journal publication.

## Validation

The pure adapter rejects:

- malformed or fingerprint-tampered request JSON;
- non-`STRETCH_NODE` request intent;
- missing component identity;
- missing node identity;
- invalid numeric profile;
- tampered request-plan fingerprints;
- plan mismatch against canonical regeneration.

## Scope exclusions

This work pack does not change:

- geometry application or acceptance;
- geometry journal publication;
- runtime or writer ownership;
- canvas or renderer selection;
- Validator source or canonical topology;
- automatic identity mapping;
- generated data or snapshots;
- CI workflow or package scripts.
