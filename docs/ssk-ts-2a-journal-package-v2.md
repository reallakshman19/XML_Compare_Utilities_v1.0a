# SSK-TS-2A — Sequential Journal-Aware Workspace Package v2

## Purpose

`SequentialWorkspacePackage.v2` is an additive persistence foundation for accepted-command authority. It carries the validated journal-adoption checkpoint and the exact post-adoption `CommandJournal.v1` without changing package-v1 creation/restoration or enabling production v2 export/import.

```text
SequentialWorkspacePackage.v1 payload
+ explicit v2 createdAt
+ SequentialWorkspaceCommandAuthority.v1
+ minimum-reader declarations
→ SequentialWorkspacePackage.v2
```

## Package contract

The public package fields are:

```text
schema: SequentialWorkspacePackage.v2
revision: 2
minimumReaderRevision: 2
createdAt: exact caller-supplied ISO timestamp
commandAuthority: SequentialWorkspaceCommandAuthority.v1
packageFingerprint: v1 canonical package fingerprint over every other package field
```

`createSequentialWorkspacePackageV2()` requires an explicit ISO `createdAt`. It calls the unchanged `createSequentialWorkspacePackage()` for authoritative v1 input validation, replaces the generated wall-clock timestamp with the supplied value, re-derives the synthetic v1 fingerprint, and validates that package through the unchanged `restoreSequentialWorkspacePackage()` before adding v2 authority.

Readers reject malformed or future declarations with:

- `WORKSPACE_PACKAGE_V2_CREATED_AT_INVALID`
- `WORKSPACE_PACKAGE_V2_SCHEMA_INVALID`
- `WORKSPACE_PACKAGE_V2_READER_INVALID`
- `WORKSPACE_PACKAGE_V2_READER_UNSUPPORTED`
- `WORKSPACE_PACKAGE_V2_FINGERPRINT_MISMATCH`

No migration, compatibility shim, fallback, or silent downgrade is provided.

## Command-authority contract

`SequentialWorkspaceCommandAuthority.v1` declares `readerRevision: 2` and `minimumReaderRevision: 2`. Its authenticated public evidence is:

- `sourceFingerprint`
- `adoptionBranchSetFingerprint`
- `currentBranchSetFingerprint`
- `checkpointId`
- `journalHeadFingerprint`
- exact `SequentialCommandJournalState.v1`
- `authorityFingerprint`

The adoption and current branch identities are intentionally separate. `adoptionBranchSetFingerprint` is read only from the authenticated `SequentialJournalAdoptionCheckpoint.v1`; `currentBranchSetFingerprint` is independently re-derived with `sequentialBranchSetFingerprint()` over the regenerated restored registry. They are not required to be equal.

The authority fingerprint uses the `SWPKGAUTH` comparison domain. The checkpoint, journal identity, journal head, native command, and branch set retain their established `SADOPT`, `SJOURNAL`, `SJHEAD`, `SNATIVE`, and `SBRANCHSET` domains.

Unsupported authority readers fail with `WORKSPACE_COMMAND_AUTHORITY_READER_UNSUPPORTED`. Evidence and fingerprint failures use:

- `WORKSPACE_COMMAND_AUTHORITY_EVIDENCE_MISMATCH`
- `WORKSPACE_COMMAND_AUTHORITY_FINGERPRINT_MISMATCH`

## Journal validation

Before export and after restoration, every journal state must pass `validateSequentialCommandJournalState()`. Restoration additionally calls `assertSequentialJournalAdoptionBasis()` against the v1-restored source and branch registry.

Each `CommandEnvelope.v1` is checked as follows:

1. `basis.documentHash` must equal the restored source fingerprint, otherwise `WORKSPACE_COMMAND_SOURCE_BASIS_MISMATCH`.
2. Its payload is reconstructed with `createSequentialNativeCommand()` and must exactly equal the stored payload, including schema, nullable target fields, nested payload, and `nativeCommandId`. Creation errors and equality failures both become `WORKSPACE_COMMAND_NATIVE_IDENTITY_INVALID`.
3. The reconstructed command branch must exist in the restored registry, otherwise `WORKSPACE_COMMAND_BRANCH_UNKNOWN`.
4. Only `transactionId === null` bypasses ledger lookup. Every other value must match a transaction in that same branch’s native ledger, otherwise `WORKSPACE_COMMAND_TRANSACTION_UNKNOWN`.

Invalid journal structure, identity, active/redo projections, sequence evidence, checkpoints, or adoption evidence fails with `WORKSPACE_COMMAND_JOURNAL_INVALID` or the established command-journal rejection propagated by adoption-basis validation.

## Restoration and derived state

`restoreSequentialWorkspacePackageV2()` verifies the outer package first, synthesizes a package-v1 payload, and delegates source, policy, branch, active-branch, session, transaction-ledger, undo/redo history, and decision-register validation to the unchanged `restoreSequentialWorkspacePackage()`.

After v1 restoration, v2 builds a new branch registry from restored sessions. For every `ROUTE_COMPLETE` session it regenerates:

- confirmed construction with `createConfirmedSequentialConstruction()`;
- support projection with `buildConfirmedConstructionSupportProjection()` and the established fixed support tolerances.

Those derived values are not redundantly serialized. The `indexes` returned by v1 restoration retain their `Map` representation and are passed directly to regeneration; they are never JSON-cloned or passed through `immutableJson()`.

## Mutation boundary

Creation and restoration do not mutate caller-owned records, journal state, registry entries or snapshots, sessions, or input package objects. Persisted outputs are newly cloned/frozen JSON contracts. Runtime restoration values containing `Map` indexes are frozen only at their containing object boundary.

## Scope boundary

This package is not adopted by the production persistence controller in SSK-TS-2A. The work does not change package v1, package receipts, import preview, application receipts, UI, 3D command routing, construction algorithms, renderers, schema registries, CI, writers, exporters, generated files, fixtures, snapshots, or benchmark data.
