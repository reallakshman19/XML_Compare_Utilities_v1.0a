# SSK-TTV-CONV-1 — Topology Validator / Sequential Edit Convergence

## Status

```text
Work Pack: SSK-TTV-CONV-1
Authority: Issue #787
Mode: capability authority only
Edit behavior changes: none
Active SSK-TS-3Q mutation: prohibited
```

## Purpose

The Topology Validator Edit Draft and Sequential Draft Edit 3D have different authority domains.

```text
Topology Validator
  source/canonical topology correction
  command journal
  attribute ledger
  remarks
  checker and autofix evidence

Sequential Draft Edit 3D
  confirmed-construction-derived geometry
  support adjustment
  same-identity geometry edits
  structural topology edits
```

A feature in one surface is not automatically available in the other. This Work Pack introduces an explicit capability matrix so complete preservation and Sequential parity cannot be claimed from partial operation overlap.

## Authority order

```text
immutable staged/source evidence
→ Topology Validator Edit Draft
→ edited canonical topology
→ edited StagedJSON
→ Sequential confirmed construction
→ support adjustment authority
→ geometry edit journal
→ structural topology journal
→ post-structural operations
→ effective scene and export
```

No layer may silently rewrite an earlier authority.

## Matrix contract

```text
TopologySequentialCapabilityMatrix.v1
```

Every current Edit Draft command records:

- command type and kind;
- owning authority;
- disposition;
- current coverage;
- mapped Sequential operations;
- next implementation gate;
- explicit limitation.

The native vocabulary is imported from `TOPOLOGY_NATIVE_TARGET_RESOLVER_TYPES`. `ATTRIBUTE_EDIT` and `REMARK_SET` are added as journaled non-native Edit Draft commands. A new or removed command makes canonical matrix creation fail until its disposition is updated.

## Dispositions

```text
NATIVE_SEQUENTIAL_OPERATION
ADAPTED_SEQUENTIAL_OPERATION
CONSTRUCTION_AUTHORITY_OPERATION
VALIDATOR_ONLY_OPERATION
EXPLICITLY_UNSUPPORTED
```

## Coverage states

```text
FULL
PARTIAL
PRESERVED_SEPARATELY
MISSING
```

`PRESERVED_SEPARATELY` means the capability remains authoritative and replayable in Topology Validator. It does not mean the same operation is available natively in Sequential.

## Initial matrix

| Edit Draft command | Disposition | Coverage | Sequential mapping / owner |
|---|---|---|---|
| `MOVE_NODE` | adapted | partial | `STRETCH_NODE` subset |
| `MERGE_NODES` | unsupported | missing | unassigned structural merge |
| `BRIDGE_GAP` | unsupported | missing | unassigned connection creation |
| `ADD_STRAIGHT_ELEMENT` | construction authority | missing | Sequential construction adapter required |
| `SPLIT_EDGE` | adapted | partial | `SPLIT_PIPE` straight-PIPE subset |
| `DISCONNECT_ENDPOINT` | unsupported | missing | detach semantics required |
| `DELETE_EDGE` | unsupported | missing | structural retirement required |
| `ADD_BEND_DEFINITION` | Validator only | preserved separately | Topology Validator |
| `ADD_JUNCTION_DEFINITION` | Validator only | preserved separately | Topology Validator |
| `TRIM_EDGE` | adapted | partial | `STRETCH_NODE` subset |
| `TRANSACTION` | adapted | partial | heterogeneous transaction authority required |
| `ATTRIBUTE_EDIT` | Validator only | preserved separately | attribute ledger |
| `REMARK_SET` | Validator only | preserved separately | command journal |

## Release claims

The matrix exposes three independent claims:

```text
explicitCoverageReady
validatorPreservationReady
sequentialParityReady
```

Initial expected state:

```text
explicitCoverageReady:       true
validatorPreservationReady:  false
sequentialParityReady:       false
```

A release must not substitute one claim for another.

## Current blockers

```text
ADD_STRAIGHT_ELEMENT
BRIDGE_GAP
DELETE_EDGE
DISCONNECT_ENDPOINT
MERGE_NODES
MOVE_NODE
SPLIT_EDGE
TRANSACTION
TRIM_EDGE
```

Bend definition, junction definition, attribute edits and remarks are not preservation blockers while their Validator authority remains intact, but they remain Sequential parity gaps.

## Follow-on gates

```text
SSK-TTV-CONV-2   MOVE_NODE / STRETCH_NODE adapter
SSK-TTV-CONV-3   MERGE_NODES structural authority
SSK-TTV-CONV-4   BRIDGE_GAP connection authority
SSK-TTV-CONV-5   ADD_STRAIGHT_ELEMENT construction adapter
SSK-TS-3Q        SPLIT_EDGE / SPLIT_PIPE bounded adapter
SSK-TTV-CONV-6   DISCONNECT_ENDPOINT authority
SSK-TTV-CONV-7   DELETE_EDGE retirement authority
SSK-TTV-CONV-8   bend-definition preservation contract
SSK-TTV-CONV-9   junction-definition preservation contract
SSK-TTV-CONV-10  TRIM_EDGE adapter
SSK-TTV-CONV-11  attribute-ledger package integration
SSK-TTV-CONV-12  remark and audit package integration
SSK-TS-3S        heterogeneous atomic transaction composition
```

Each follow-on gate must update the matrix only after its implementation and qualification are present at the same exact head.

## Qualification

Focused evidence must prove:

- all native command target-resolver types are present exactly once;
- `ATTRIBUTE_EDIT` and `REMARK_SET` are present exactly once;
- duplicate, missing, unknown and tampered matrices fail closed;
- deterministic canonical regeneration;
- immutable matrix values;
- stable blocker summary;
- separate preservation and parity claims.

## Explicit exclusions

This Work Pack does not add or change:

- geometry editing behavior;
- topology mutation behavior;
- source or confirmed-construction authority;
- support reassignment;
- persistence or export formats;
- viewer runtime or renderer;
- active SSK-TS-3Q implementation.
