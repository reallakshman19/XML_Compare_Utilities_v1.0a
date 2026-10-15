# SSK-TS-3E — Exact Candidate-Bound Manual Connection

## Status

```text
Work Pack: #692
Dependency: SSK-TS-3D / PR #689
Baseline: ff4ccfa891ba905d3b4ab06d5047d455ec47b261
Implementation branch: agent/ssk-ts-3e-candidate-bound-manual-connect
```

This increment qualifies one additional accepted command for Draft Edit 3D:

```text
MANUAL_CONNECT
```

It does not create arbitrary manual port-pairing authority.

## Purpose

The existing native construction runtime already supports supervised manual connection with deterministic issued-time handling, transaction recording, undo/redo evidence, command-journal mapping and user-manual provenance.

SSK-TS-3E exposes that existing authority through the certified Draft Edit 3D candidate surface without trusting operator-entered port identities.

## Authority flow

```text
certified current candidate scene entity
→ exact current decision candidate
→ live candidate from-port and to-port identities
→ current indexed-port verification
→ actor, reason and evidence
→ prepare immutable native command
→ review candidate, ports and predicted result
→ explicit accept or cancel
```

The 3D pick is non-authoritative. It may select and display a candidate but cannot prepare, accept or publish a command.

## Exact target derivation

The existing `SequentialDraftEditCandidateTarget.v1` remains unchanged. It continues to bind:

- complete accepted-command authority ID;
- certified read-model authority ID;
- active branch;
- current decision;
- current candidate;
- certified scene entity;
- target-selection fingerprint.

At preparation time, the panel re-finds that candidate in the live current decision and derives:

```text
fromPortId = candidate.fromPortId || candidate.targetPortId
toPortId   = candidate.toPortId   || candidate.connectedPortId
```

Preparation is unavailable unless:

- both identities are present;
- the identities are distinct;
- the current workspace exposes an indexed port map;
- both identities exist in that current map;
- the selected target still matches complete command authority;
- the decision is open and not deferred.

The UI contains no editable port fields.

## Native validation

The prepared command carries the exact values as top-level native command fields:

```text
commandType
branchId
decisionId
candidateId
fromPortId
toPortId
payload.reason
payload.evidenceNote
```

The existing command target resolver independently verifies that:

- the decision is the exact current decision;
- the candidate is an exact current candidate;
- the command from-port equals the candidate from-port;
- the command to-port equals the candidate to-port;
- both ports remain current indexed evidence.

Swapped, missing, unindexed, stale or cross-authority port evidence fails closed.

## Supervision

`MANUAL_CONNECT` requires:

- non-empty actor ID;
- operator reason;
- evidence note;
- exact ISO `issuedAt`, generated only during explicit preparation.

Before acceptance, the operator sees:

- command type;
- branch;
- decision;
- candidate;
- certified scene entity;
- from-port;
- to-port;
- issued time;
- predicted native outcome;
- prepared-command ID;
- expected authority ID;
- native transaction mapping.

Cancellation clears only the prepared command. It does not mutate construction authority.

## Accepted evidence

The unchanged native runtime records manual approval using:

```text
resolution.action = MANUAL_CONNECT
resolution.selectedCandidateId
resolution.selectedFromPortId
resolution.selectedToPortId
resolution.provenance = USER_MANUAL
resolution.reason
resolution.evidenceNote
resolution.confirmedAt
```

Newly committed connections receive:

```text
approvalProvenance = USER_MANUAL
approvalReason
approvalEvidenceNote
basis += USER_MANUAL
```

Acceptance still re-derives complete authority, recomputes the native result and publishes atomically through the existing workspace command boundary.

## Lifecycle containment

The candidate target and any prepared command are invalidated when:

- complete command authority changes;
- owner state refreshes;
- branch, decision or candidate changes;
- candidate port identities change;
- either port leaves the current index;
- the 3D surface closes;
- another renderer is selected;
- authority becomes unavailable;
- runtime containment returns to Construction SVG;
- the controller is destroyed.

## Presentation split

`sequential-draft-edit-command-presentation.js` contains only:

- DOM element lookup;
- hidden/inert presentation mechanics;
- bounded inline styling;
- pure target text;
- pure prepared-evidence text.

It has no gateway, workspace-authority, command-construction or publication responsibility.

## Explicit exclusions

SSK-TS-3E does not include:

- arbitrary two-port selection;
- typed or editable port IDs;
- port swapping;
- nearest-port or coordinate inference;
- ray-distance or visual-order inference;
- `REVERSE_COMPONENT` preparation;
- reversal scene projection;
- geometry or topology gestures;
- construction-runtime redesign;
- journal or persistence redesign;
- direct execute-on-click;
- SVG retirement or default-renderer switching.

## Proof

The increment adds proof for:

- deterministic real-service manual preparation;
- exact current candidate and port evidence;
- exact issued-time normalization;
- native manual resolution and provenance;
- command-journal publication;
- swapped-port rejection;
- stale candidate rejection;
- no preparation or publication on candidate pick;
- disabled manual control without both indexed ports;
- actor, reason and evidence validation;
- prepared port-pair review;
- non-mutating cancellation;
- accepted and stale-result presentation;
- exactly eleven visible supervised commands;
- no free-form port entry;
- continued `REVERSE_COMPONENT` exclusion;
- production line limits and named exports.

## Validation limitation

The connected repository source was inspected exactly. The execution environment could not materialize the branch locally because it could not resolve `github.com`; therefore no focused test or CI command is represented as executed or green until GitHub supplies exact-head check evidence.
