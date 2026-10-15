# SSK-3D-P0-A — Exact Pilot Baseline Manifest and Evidence Export

## Status

```text
Roadmap phase: P0 — baseline freeze and pilot harness
Authority issue: #861
Hardening issue: #870
Fixture-catalog issue: #875
Limitation-register issue: #884
Baseline: main @ 19e04711fc54083bd8e622bbd82048839ca8ebfa
Release level: ENGINEERING_DEMO_BASELINE
New editing authority: none
```

## Purpose

This work pack freezes the existing Sequential Draft Edit 3D capability as one reproducible engineering-demo baseline. It does not qualify internal-pilot or production use and does not add an edit operation.

The Sequential Sketcher toolbar gains one visible action:

```text
Download 3D pilot baseline
```

The action is disabled until one authoritative Sequential branch is open. Export reads current authority and runtime state without preparing, applying or publishing any engineering change.

## Release artifact

The action exports:

```text
SequentialDraftEdit3dReleaseManifest.v1
```

The manifest binds:

- repository and exact frozen baseline commit;
- roadmap phase, work pack and engineering-demo release level;
- active branch, source fingerprint, read authority and scene identity;
- owner-shadow mount key and schema identity;
- current command-journal state and head;
- support-adjustment register and history heads;
- geometry-edit journal head and entry count;
- controller availability, mount, active, failure and fallback state;
- viewer runtime snapshot when mounted;
- exact supervised-command vocabulary;
- qualified geometry operations;
- same-carrier support adjustment;
- structural-impact preview capabilities;
- representative fixture catalog and catalog fingerprint;
- owner-attested known-limitation register and register fingerprint;
- qualified runtime paths;
- explicit non-authority disposition.

## Fixed capability inventory

### Supervised construction commands

```text
ADVANCE_ONE
CONNECT_CANDIDATE
DEFER_DECISION
MANUAL_CONNECT
MARK_EXTERNAL_BOUNDARY
MARK_TERMINAL
REDO_LAST_TRANSACTION
REJECT_CANDIDATE
RESUME_DECISION
REVERSE_COMPONENT
RUN_UNTIL_BLOCKED
UNDO_LAST_TRANSACTION
```

### Applied edit authority

```text
MOVE_COMPONENT
STRETCH_NODE
ROTATE_SUBGRAPH
MOVE_SUPPORT_SAME_CARRIER
```

### Structural-impact preview only

```text
ADD_STRAIGHT_ELEMENT
BRIDGE_GAP
DISCONNECT_ENDPOINT
MERGE_NODES
RETIRE_COMPONENT
SPLIT_PIPE
```

Structural-impact preview does not imply structural-topology application authority.

## Deterministic evidence

The release manifest has a canonical `manifestFingerprint`. Validation independently regenerates the complete artifact from current runtime input and rejects any difference in:

- baseline repository or commit;
- branch or read authority;
- owner, scene or revision identity;
- command, support or geometry journal heads;
- controller or viewer state;
- supported capability lists;
- representative fixture inventory or catalog fingerprint;
- limitation inventory, ownership, containment, exit gates or attestation fingerprint;
- runtime path inventory;
- release-disposition records.

A consistently re-fingerprinted forgery is rejected because fixed baseline, fixture-catalog, limitation-register and disposition invariants are asserted independently of the fingerprint.

### Byte-stable authority time

SSK-3D-P0-B derives `createdAt` from the validated current `CommandJournal.v1.updatedAt`. It does not read the wall clock during evidence export. The command journal therefore governs both evidence time and command-journal head identity.

Two exports from unchanged engineering authority are byte-equivalent and have the same `manifestFingerprint`. A changed command-journal timestamp or head changes the payload and fingerprint. Missing or malformed command-journal authority disables export and fails closed instead of inventing a time.

The export feature captures command, support, geometry, view, controller, and shadow evidence once for each export. Manifest assertion copies and deeply freezes caller input before returning canonical evidence.

### Representative fixture catalog

SSK-3D-P0-C adds immutable `SequentialDraftEdit3dFixtureCatalog.v1` evidence. The catalog references the existing real fixture symbols in `tests/helpers/sequential-engineering-svg-fixture.js` and does not embed mutable sessions or introduce production mocks.

The qualified inventory is:

```text
SSK3D-FIXTURE-AMBIGUOUS-BLOCKED
SSK3D-FIXTURE-CANDIDATE-REJECTED
SSK3D-FIXTURE-GAP-REPAIRED
SSK3D-FIXTURE-SUPPORT-CONFIRMED
```

Each scenario records its fixture symbol, purpose, expected session state, required evidence, exercised operations and governing limitations. Scenario order and identity are fixed. Catalog mutation invalidates both `catalogFingerprint` and the enclosing release-manifest fingerprint.

### Owner-attested known-limitation register

SSK-3D-P0-D adds immutable `SequentialDraftEdit3dLimitationRegister.v1` evidence. The register contains the exact six release limitations, one accountable authority role for each limitation, the required operational containment, the evidence needed for closure, and the explicit exit gate.

The ownership attestation uses `SEMANTIC_FINGERPRINT_ROLE_ATTESTATION`. It establishes canonical content integrity and exact role assignment only. Its trust boundary explicitly records:

```text
contentIntegrity: ESTABLISHED_BY_CANONICAL_FINGERPRINT
signerIdentity: NOT_ESTABLISHED
organizationalAuthority: NOT_ESTABLISHED
certificateTrust: NOT_ESTABLISHED
productionApproval: NOT_ESTABLISHED
```

The attestation does not claim a cryptographically verified person, organizational authorization, certificate chain or production approval. Any limitation, owner, containment rule, evidence requirement, exit gate or trust-boundary change invalidates the register and enclosing release-manifest fingerprints.

## Browser harness

The existing real-Workbench fixture now exposes deterministic pilot-harness actions and evidence:

1. open Sequential Sketcher;
2. inspect representative staged records;
3. open one branch;
4. activate Draft Edit 3D;
5. verify real Workbench realization;
6. export the exact release manifest twice and compare the canonical payloads;
7. verify the four representative fixture scenario IDs and catalog fingerprint are bound;
8. verify the six known limitations, accountable roles and attestation trust boundary are bound;
9. return manually to Construction SVG;
10. inject a `scene-apply` failure;
11. verify automatic Construction SVG fallback and reported failure;
12. close without leaked canvas.

The fixture uses the same production controller and Workbench path. Evidence time comes from current command-journal authority. The obsolete pilot wall-clock fixture hook is removed. No engineering-state mock is introduced.

## Known limitations

```text
NO_STRUCTURAL_TOPOLOGY_APPLICATION
NO_GEOMETRY_OR_SUPPORT_PERSISTENCE_IN_PORTABLE_PACKAGE
NO_HETEROGENEOUS_ATOMIC_TRANSACTION
NO_UNRESTRICTED_MULTI_SELECTION
NO_AUTOMATIC_TOPOLOGY_REPAIR
ENGINEERING_DEMO_ONLY
```

Every limitation remains `OPEN` and is bound to an accountable authority role, containment rule, evidence requirement and exit gate. The release is not promoted merely because the register is fingerprinted.

The artifact explicitly records:

```text
internalPilotReady: false
newEditingAuthority: false
structuralTopologyPublication: NOT_AUTHORIZED
packagePersistenceChange: NONE
fallbackSurface: CONSTRUCTION_SVG
```

## Containment

This work pack does not:

- mutate topology, geometry, support or construction state;
- prepare or accept a command;
- publish through command, support or geometry boundaries;
- alter package schemas or persistence;
- change the Workbench viewer, canvas or renderer implementation;
- establish signer identity or production approval;
- promote the release above engineering-demo baseline;
- claim that CI is the release gate.

## Phase 0 continuation

This work pack delivers the exact release manifest, authority diagnostic export, byte-stable authority regeneration, representative fixture catalog, owner-attested limitation register and deterministic launch/fallback harness. Remaining Phase 0 work is the controlled operator walkthrough record.
