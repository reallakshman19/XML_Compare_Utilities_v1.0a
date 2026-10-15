# SSK-TTV-CONV-8 — Bend-definition preservation contract

## Delivered boundary

Topology Validator Edit Draft exposes a visible bend-inspector action:

```text
Download bend preservation evidence
```

The action exports immutable `TopologyBendDefinitionPreservation.v1` evidence for exactly one selected explicit bend definition.

## Authority

The bend remains owned by Topology Validator:

```text
commandType:                 ADD_BEND_DEFINITION
authorityOwner:              TOPOLOGY_VALIDATOR
disposition:                 VALIDATOR_ONLY_OPERATION
coverage:                    PRESERVED_SEPARATELY
completedGate:               SSK-TTV-CONV-8
replayState:                 ACTIVE_DRAFT_COMMAND
exportDisposition:           DEDICATED_IMMUTABLE_EVIDENCE
candidateSequentialOperation: null
sequentialPublicationState:  NOT_APPLICABLE
```

`PRESERVED_SEPARATELY` means the bend definition remains authoritative and replayable in the Validator. It does not imply a native or adapted Sequential bend operation.

## Evidence

The artifact binds:

- exact canonical bend identity and record;
- exact active `ADD_BEND_DEFINITION` command and normalized payload;
- active-versus-redo command state;
- exact bend node, position and canonical record;
- exactly two named current incident route arms;
- positive radius, angle and radius authority;
- deterministic `EDIT-BEND-<command-id>` identity;
- source entity IDs and first-arm InputXML element ancestry;
- target entity IDs, source paths and source branch indexes;
- canonical topology, edit draft, command authority and ProjectDocument identity;
- deterministic preservation fingerprint.

## Matrix update

The `ADD_BEND_DEFINITION` capability remains:

```text
disposition: VALIDATOR_ONLY_OPERATION
coverage:    PRESERVED_SEPARATELY
```

Its next gate is now `COMPLETE`. Sequential parity remains unavailable and is not claimed.

## Fail-closed conditions

Preservation export is rejected when:

- the selected bend is missing or selection is not exactly one bend;
- the creating command is missing, inactive, redo-only or duplicated in redo history;
- command ancestry is not exactly one active `ADD_BEND_DEFINITION` command;
- two distinct route arms are not named;
- route arms are missing, nonincident or differ from current node incidence;
- radius is nonpositive or engineering values are nonfinite;
- canonical bend identity, position, radius, angle or authority differs from the command;
- source entity or InputXML ancestry differs;
- target evidence or authority hashes are forged;
- current-canonical regeneration differs.

## Exclusions

This work pack does not add bend geometry mutation, bend editing, Sequential bend construction, command append, application service, structural-topology journal, geometry journal, source writer, runtime, canvas or renderer behavior.
