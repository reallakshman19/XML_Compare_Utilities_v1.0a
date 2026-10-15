# SSK-TTV-CONV-9 — Junction-definition preservation contract

## Status

```text
Work Pack: SSK-TTV-CONV-9
Authority: Issue #858
Mode: dedicated immutable preservation evidence
Sequential junction operation: not available
```

## Purpose

This work pack preserves one explicit Topology Validator junction definition without claiming that Sequential Draft Edit 3D can create, reshape, or publish a junction.

The operator selects exactly one canonical junction and downloads:

```text
TopologyJunctionDefinitionPreservation.v1
```

## Preserved authority

The artifact binds:

- one current `CanonicalTopology.v1` and its topology hash;
- one current `TopologyEditDraft.v1` and its draft hash;
- one command-authority ID and valid `ProjectDocument.v1` identity;
- one active `ADD_JUNCTION_DEFINITION` command;
- one deterministic `EDIT-JUNCTION-<command-id>` record;
- one exact junction node and finite XYZ position;
- the complete current incident route-arm set;
- source entity IDs, source paths, branch indexes, and InputXML element IDs;
- active-versus-redo replay evidence;
- a deterministic preservation fingerprint.

## Complete incidence rule

`ADD_JUNCTION_DEFINITION` must name at least three distinct route arms. The normalized command arm IDs must equal the complete current set of canonical edges incident to the junction node.

The contract rejects:

- a missing, duplicated, inactive, or redo-only creating command;
- fewer than three or duplicated route arms;
- a missing, nonincident, extra, or omitted current arm;
- a junction/node position mismatch;
- changed junction, node, route-arm, source, InputXML, target, replay, or authority evidence;
- stale current-canonical regeneration;
- any Sequential operation or publication claim.

## Authority boundary

```text
commandType:                  ADD_JUNCTION_DEFINITION
authorityOwner:               TOPOLOGY_VALIDATOR
disposition:                  VALIDATOR_ONLY_OPERATION
coverage:                     PRESERVED_SEPARATELY
completedGate:                SSK-TTV-CONV-9
replayState:                  ACTIVE_DRAFT_COMMAND
exportDisposition:            DEDICATED_IMMUTABLE_EVIDENCE
candidateSequentialOperation: null
sequentialPublicationState:   NOT_APPLICABLE
```

`PRESERVED_SEPARATELY` means that the junction remains replayable and auditable through Topology Validator authority. It does not establish Sequential parity.

## UI integration

The junction inspector exposes one action:

```text
Download junction preservation evidence
```

A 62-line controller decorator intercepts only:

```text
JUNCTION_PRESERVATION_EXPORT
```

All existing native actions, Sequential request exports, and bend preservation export delegate unchanged.

## Capability matrix

The `ADD_JUNCTION_DEFINITION` row remains:

```text
VALIDATOR_ONLY_OPERATION
PRESERVED_SEPARATELY
TOPOLOGY_VALIDATOR
```

Only its implementation gate changes from `SSK-TTV-CONV-9` to `COMPLETE`. `sequentialParityReady` remains false.

## Explicit exclusions

This work pack does not add:

- topology mutation or command append;
- a Sequential junction command;
- fitting or branch reconstruction;
- application-service invocation;
- topology, geometry, or construction journal publication;
- source, runtime, writer, canvas, renderer, or package changes.

## Qualification

Focused evidence proves successful creation, immutable regeneration, complete route-arm matching, exact source and InputXML ancestry, visible export action, fail-closed selection, unchanged delegation, capability-matrix completion, and rejection of consistently re-fingerprinted command, junction, node, arm, target, replay, authority, and disposition forgeries.
