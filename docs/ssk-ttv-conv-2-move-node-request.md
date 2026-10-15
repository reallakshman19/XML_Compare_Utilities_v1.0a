# SSK-TTV-CONV-2 — MOVE_NODE Sequential Request Artifact

## Delivered capability

Topology Validator Edit Draft now exposes a node-inspector action:

```text
Download Sequential stretch request
```

The action reads the same exact XYZ fields used by `MOVE_NODE`, but it does not append a Validator command and does not publish a Sequential edit. It downloads one immutable request artifact for supervised continuation in Sequential Draft Edit 3D.

## Artifact

```text
TopologySequentialMoveNodeRequest.v1
```

The artifact contains:

- the exact `MOVE_NODE` source command;
- current and requested node positions;
- canonical topology hash;
- topology edit-draft hash;
- command-authority ID;
- project document ID;
- source and scoped hashes;
- source file name;
- source paths and branch indexes;
- required downstream operation `STRETCH_NODE`;
- explicit `automaticIdentityMapping: false`;
- explicit `publicationState: NOT_PUBLISHED`;
- deterministic request fingerprint.

## Authority boundary

The request does not claim that a Validator node ID equals a Sequential node ID. Sequential construction has a separate identity and ancestry authority.

A consumer must explicitly provide:

```text
selectedObjectId
sequentialNodeId
```

before it can resolve a certified `SequentialNodeStretchTarget.v1` and create a preview.

## Rejections

The request builder rejects:

- non-`CanonicalTopology.v1` input;
- non-`TopologyEditDraft.v1` input;
- invalid project-document authority;
- missing command-authority ID;
- missing node;
- non-finite coordinates;
- no-change movement;
- fingerprint tampering;
- mismatch against current canonical regeneration.

## No behavior changed

This work pack does not change:

- the Topology Validator writer;
- the Sequential writer;
- either canvas or renderer;
- runtime ownership;
- command-journal publication;
- source JSON;
- canonical topology;
- confirmed Sequential construction.

## Qualification

Focused Node tests prove:

1. exact artifact construction;
2. source-branch extraction;
3. immutable output;
4. no-change rejection;
5. tamper rejection;
6. current-authority regeneration;
7. inspector action presence;
8. dispatcher routing;
9. absence of native edit publication during export.
