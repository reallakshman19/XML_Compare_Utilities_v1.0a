# SSK-TS-2B — Production journal-aware workspace persistence

## Scope

This Work Pack adopts the already-certified `SequentialWorkspacePackage.v2` contract in the shipped Sequential workspace persistence flow. It does not create journal authority, enable commands, change package-core contracts, or alter construction, rendering, markup, CSS, 3D, workflow, package, lockfile, generated, fixture, snapshot, or benchmark files.

The baseline for this mission is `501a43cc4f0fedefec04eab31bd219f24990c90a`.
The approved baseline blob for `sequential-sketcher-workspace.js` is `7274b817b713db7af81c8dc8953e3edbabfb1a9b`.

## Receipt-aware dispatch

`createSequentialWorkspacePackageWithReceipts(options)` is the single creation boundary.

- `journalState === null` or `journalState === undefined` dispatches to the unchanged package-v1 creator.
- A present journal is validated by `validateSequentialCommandJournalState()` before package creation.
- A valid present journal dispatches to `createSequentialWorkspacePackageV2()` and requires explicit ISO `createdAt`.
- An invalid present journal fails as `WORKSPACE_COMMAND_JOURNAL_INVALID`; it never falls back to v1.
- Falsey values such as `false`, `0`, and `''` are present invalid authority, not absence.
- Neither the wrapper, controller, preview, receipt, nor workspace restoration imports or calls a journal-adoption creator.

Application receipts are validated, cloned, included in either package schema, and authenticated by the package fingerprint.

## Receipt-aware parsing

`restoreSequentialWorkspacePackageWithReceipts(input)` parses without mutating caller input and switches only on the outer schema.

- `SequentialWorkspacePackage.v1` uses `restoreSequentialWorkspacePackage()`.
- `SequentialWorkspacePackage.v2` uses `restoreSequentialWorkspacePackageV2()`.
- Unknown schemas fail as `WORKSPACE_PACKAGE_SCHEMA_UNSUPPORTED`.
- Malformed wrapper JSON fails as `WORKSPACE_PACKAGE_RECEIPTS_JSON_INVALID`.
- Package and authority future-reader checks remain authoritative in their existing restore contracts.
- Receipts are validated only after the package restore succeeds.

Every returned restoration exposes normalized `packageSchema`, `packageRevision`, and frozen `applicationReceipts`. A v2 restoration also exposes the exact authenticated `journalState`.

## Current-state and preview identity

`sequentialWorkspaceCurrentStateFingerprint(model)` retains the v1 identity material:

- source fingerprint;
- sorted branch IDs;
- active branch ID;
- sorted branch workspace session fingerprints;
- selected candidate IDs.

When `model.journalState` exists, identity additionally contains:

- `journalStateSchema`;
- `adoptionCheckpointId`;
- `journalHeadFingerprint`.

Only `null` and `undefined` represent absent authority. Absent authority adds no property, preserving deterministic non-adopted v1 identity. Any other invalid value fails as `WORKSPACE_IMPORT_JOURNAL_STATE_INVALID`; invalid package authority fails as `WORKSPACE_IMPORT_PACKAGE_JOURNAL_INVALID`.

`SequentialWorkspaceImportPreview.v1` exposes package schema/revision, current and package authority presence, journal schemas, checkpoint IDs, journal heads, and one journal impact:

- `ABSENT`: neither side has authority;
- `INSTALL`: only the package has authority;
- `UNCHANGED`: schema, checkpoint, and journal head match;
- `REPLACE`: both sides have authority but identity differs;
- `REMOVE`: only the current workspace has authority.

`REPLACE` and `REMOVE` are destructive. Existing approval validation therefore requires an evidence note. Because the current-state fingerprint contains the journal head, a journal-head-only change after preview causes `WORKSPACE_IMPORT_PREVIEW_STALE` before application.

## Atomic application boundary

The persistence controller validates the pending preview and approval, computes the candidate after-state fingerprint, creates the candidate receipt, and appends imported receipt history before calling `workspace.restorePackage()`.

`restorePackage()` then:

1. accepts only restoration v1 or v2;
2. treats only `null` or `undefined` as absent journal authority and rejects other invalid values as `WORKSPACE_RESTORE_JOURNAL_IDENTITY_INVALID`;
3. compares current and incoming journal schema, adoption checkpoint ID, and journal-head fingerprint to verify the expected impact;
4. rejects unapproved v1 journal removal;
5. regenerates `confirmedConstruction` and support projection for every restored `ROUTE_COMPLETE` branch, including package-v1 rows;
6. builds and validates a fresh branch registry;
7. derives the candidate active snapshot, freezes the candidate receipt history, and serializes source text before mutation;
8. commits source, evidence, runtime indexes, branch registry, active session, derived active state, selected candidate, decision register, journal authority, and receipts through one non-validating assignment boundary;
9. performs post-commit UI synchronization in contained non-throwing steps, so rendering, DOM, approval-field, summary, button, or toast failure cannot be reported as a failed application after live state changed.

A failed parse, preview, approval, receipt construction, journal-identity check, derived-state preparation, source serialization, or fresh-registry validation occurs before live mutation. Cancellation clears only pending controller state.

## Application receipts

New `SequentialWorkspaceApplicationReceipt.v1` values include:

- `packageSchema`;
- `packageRevision`;
- `impact.journalImpact`.

Schema and revision form exact pairs: `SequentialWorkspacePackage.v1` requires revision `1`, and `SequentialWorkspacePackage.v2` requires revision `2`. Receipt creation validates restoration and preview identities independently, never masks an explicitly invalid restoration value with preview fallback, and requires both valid sources to agree exactly. Invalid identity fails as `WORKSPACE_APPLY_PACKAGE_IDENTITY_REQUIRED`; disagreement fails as `WORKSPACE_APPLY_PACKAGE_IDENTITY_MISMATCH`. Authenticated legacy receipts without all three additive values remain valid. A partially populated or mismatched stored receipt identity fails as `WORKSPACE_APPLY_RECEIPT_PACKAGE_IDENTITY_INVALID:<index>`. An unknown journal impact fails as `WORKSPACE_APPLY_RECEIPT_JOURNAL_IMPACT_INVALID:<index>`.

## Mutation and proof boundary

Creation and parsing clone JSON-owned package, receipt, and journal values. Runtime `Map` indexes come from authoritative package restoration and are not JSON-cloned. The fresh registry is prepared independently before replacing the model registry. Caller-owned package, receipt, journal, and model values are read-only inputs.

The additive tests preserve the original policy, hydration, preview-total, matching/empty-state, source/branch/active-state staleness, destructive-evidence, markup, CSS, tab-wiring, and receipt-field assertions. Dynamic production-boundary proof exercises package-v1 derived regeneration, package-v2 install, unchanged authority, replacement, explicit removal, journal-head staleness, falsey authority rejection, cancellation, injected preparation/restoration failure, receipt-history preservation, `lastReceipt` ordering, caller-input immutability, invalid restoration identity without preview fallback, and restoration/preview identity disagreement.

## Line and export controls

All edited production modules use named exports only. The four persistence modules remain below 300 lines. The Owner-approved workspace exception records a 446-line baseline and permits at most 40 net new lines; the corrected implementation is 478 lines, a net increase of 32. New and materially changed functions remain below 40 lines where practical.

## Main synchronization

The Owner-authorized synchronization target is `42b54c7619b4d63300dce3ffdfc736d30e221fb3`. Its only changes are the disjoint Pipeline 3D CAESAR writer files; they are incorporated through branch synchronization and do not appear in the SSK-TS-2B pull-request diff.

## Non-goals retained

This Work Pack does not perform implicit journal adoption, command execution, command UX enablement, Draft Edit 3D routing, coordinate or drag editing, package-core redesign, SVG retirement, construction-algorithm changes, or any SSK-TS-3A/3B work.
