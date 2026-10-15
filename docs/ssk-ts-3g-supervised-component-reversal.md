# SSK-TS-3G — Exact Supervised Component Traversal Reversal

## Status

```text
Authority issue: #700
Dependency: merged SSK-TS-3F / PR #699
Dependency merge: 8daaf1dd3986c3d287d871a12c730c579fc95803
Clean baseline: 96c44c97f1f89636a69d369f3d9734f87c0c7ac1
Implementation branch: agent/ssk-ts-3g-supervised-component-reversal-clean
```

SSK-TS-3G qualifies only `REVERSE_COMPONENT` through the existing accepted-command boundary. It does not add automatic reversal, arbitrary component or port selection, geometry editing, or SVG retirement.

## Operator flow

```text
pick one certified purple REVERSE ENTRY marker
→ validate exact current reversal target
→ provide actor, reason and evidence note
→ prepare immutable REVERSE_COMPONENT command
→ review predicted native result and transaction mapping
→ explicitly accept or cancel
```

Picking a marker changes selection evidence only. It does not prepare, accept, execute, publish, or mutate construction authority.

## Reversal target authority

`SequentialDraftEditReversalTarget.v1` binds:

- complete current command authority ID;
- certified read-model authority ID;
- branch ID;
- current decision ID;
- native reversal-candidate ID;
- component ID;
- exact entry-port ID;
- certified scene entity ID;
- exact indexed source position;
- semantic `reversalTargetId`.

Target creation independently regenerates the read model and scene ancestry, derives current command authority, and regenerates native reversal candidates from the current session and current indexes.

A valid entity must use:

```text
domainType: SEQUENTIAL_REVERSAL_CANDIDATE
category: reversalCandidate
id: ssk:reversal:<candidateId>
```

The target fails closed for missing or stale authority, wrong branch, missing or deferred decision, wrong scene category, stale candidate identity, confirmed component, missing entry port, cross-component entry port, or source-position mismatch.

No coordinate tolerance, nearest-object search, ray distance, screen position, visual order, or object-name parsing participates in authority.

## Native command target resolution

Before SSK-TS-3G, the generic target resolver treated `REVERSE_COMPONENT` as though its candidate lived in `currentDecisionRequest.candidates`. Native reversal candidates are generated separately by `buildSequentialReversalCandidates()`.

SSK-TS-3G repairs that boundary:

```text
current session + indexes
→ projectSequentialReversalCandidates()
→ exact candidate ID match
→ exact component ID match
→ exact entry-port ID match
→ indexed component and port ownership validation
→ SequentialCommandTargetEvidence.v1
```

Connection-candidate commands continue to resolve only against the ordinary current decision candidate list.

## Deterministic preparation

`REVERSE_COMPONENT` is added to `SEQUENTIAL_PREPARATION_ENABLED_COMMAND_TYPES` because the native runtime already accepts exact issued-time evidence.

The visible command request is constructed only from the validated reversal target:

```text
commandType
branchId
decisionId
candidateId
componentId
entryPortId
payload.reason
payload.evidenceNote
payload.targetEntityId
payload.reversalTargetId
```

The UI exposes no component or entry-port input field. The operator cannot type, swap, infer, or independently choose an unrelated component or port.

Preparation remains:

```text
gateway.prepare()
→ exact authority verification
→ exact target resolution
→ native result recomputation
→ transaction mapping
→ immutable prepared evidence
```

Preparation does not publish authority.

## Native evidence and time normalization

The unchanged construction runtime records:

- `resolution.action = REVERSE_COMPONENT`;
- selected component and entry port;
- `SequentialComponentTraversalOverride.v1`;
- `provenance = USER_MANUAL`;
- operator reason and evidence note;
- resulting component traversal state;
- one native construction transaction;
- command-journal transaction mapping.

The command envelope's exact `issuedAt` is normalized into:

- decision resolution `confirmedAt`;
- component traversal override `confirmedAt`;
- transaction `createdAt`;
- command journal entry origin.

No wall-clock timestamp generated inside native reversal semantics survives accepted-command preparation.

## Review evidence

Before acceptance, the command panel displays:

- command and branch;
- decision ID;
- reversal-candidate ID;
- component ID;
- entry-port ID;
- certified scene entity;
- exact issued time;
- predicted native outcome;
- prepared ID;
- expected authority ID;
- transaction mapping.

Cancellation clears the prepared command without publication or authority mutation.

Acceptance remains:

```text
gateway.accept(prepared)
→ re-derive complete current authority
→ validate immutable prepared evidence
→ recompute native reversal result
→ compare complete result
→ atomically publish or reject
```

A changed owner revision, branch set, journal head, decision, candidate, component, port, or session rejects stale prepared work.

## Lifecycle containment

The selected reversal target and any pending command are invalidated on:

- owner refresh;
- complete command-authority change;
- decision or native reversal-candidate change;
- component or entry-port change;
- renderer exit;
- Draft Edit 3D closure;
- authority loss;
- contained viewer failure;
- controller destruction.

Selection remains mutually exclusive with connection-candidate and boundary targets.

## Visible surface

Draft Edit 3D now exposes exactly twelve supervised command buttons. The only new button is:

```text
REVERSE_COMPONENT — Reverse selected component traversal
```

The command panel calls `gateway.prepare()` and `gateway.accept()` only. No visible control calls `gateway.execute()`.

## Production containment

Authority responsibilities are separated across bounded named-export modules:

- reversal target selection and validation;
- panel target validation and request construction;
- command panel lifecycle;
- presentation-only evidence formatting;
- 3D selection routing;
- native command-target resolution.

Production files remain below 300 lines. No workflow, package, lockfile, CSS, generated, browser-fixture, snapshot, benchmark, construction-runtime, transaction, journal, or persistence file changes are included.

## Proof

Focused proof covers:

- exact reversal target creation and canonical regeneration;
- missing entity, stale authority, deferred decision and missing port rejection;
- non-publishing target selection;
- actor, reason and evidence requirements;
- exact request construction from the selected target;
- prepared review evidence;
- non-mutating cancellation;
- accepted and stale-result presentation;
- deterministic real-service reversal preparation;
- exact decision, candidate, component and entry-port target evidence;
- traversal override and timestamp normalization;
- transaction and journal mapping;
- explicit accepted publication;
- stale authority and tampered target rejection;
- exactly twelve controls with no free-form reversal fields;
- absence of direct execute and geometry gesture paths.

## Deferred work

The following remain blocked for later Work Packs:

- arbitrary component selection;
- arbitrary or free-form entry-port selection;
- port swapping;
- automatic reversal;
- drag, move, rotate, stretch, break, or other geometry/topology editing;
- default-renderer change;
- SVG retirement.
