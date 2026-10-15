# SSK-TS-3F — Exact Reversal-Candidate Scene Projection

## Status

```text
Authority issue: #697
Dependency: merged SSK-TS-3E / PR #695
Baseline: 01d114d9ad15bdc7fdf15c88c69b1bfd706c3239
Implementation branch: agent/ssk-ts-3f-reversal-candidate-projection-clean
```

SSK-TS-3F adds read-only reversal-candidate evidence to the certified Sequential EngineeringScene and Draft Edit 3D visual model. It does not enable or target `REVERSE_COMPONENT`.

## Authority flow

```text
SequentialConstructionSession.v1
+ current indexed branches, components and ports
→ buildSequentialReversalCandidates(session, indexes)
→ independent indexed component/entry-port reconciliation
→ immutable reversalCandidates authority rows
→ exact EngineeringScene point entities
→ read-only VisualGeometryModel.v2 markers
```

The native reversal helper remains the semantic source. Scene code cannot invent candidates from coordinates, visual order, names, nearest-object searches, ray distance or operator selection history.

Certified owner-snapshot regeneration preserves the branch index as well as component and port indexes. This retains the native helper's valid branch-root fallback when an open reversal decision does not carry an explicit component ID.

## Exact projected evidence

Each valid native row retains:

- candidate ID;
- component ID and source-component ID;
- branch ID;
- exact entry-port ID;
- exact port role;
- exact indexed source position.

The authority projection rejects missing or cross-component indexed evidence and rejects any candidate whose component, branch, role or position differs from the current indexes.

A valid scene row uses:

```text
id: ssk:reversal:<candidateId>
domainType: SEQUENTIAL_REVERSAL_CANDIDATE
category: reversalCandidate
layer: sequential-reversal-candidate
geometry: point at the indexed entry-port position
domainRef.sourcePosition: exact indexed entry-port position
contributesToFit: false
editCapabilities: []
```

A non-finite or absent entry-port position is not rendered and is recorded as `REVERSAL_ENTRY_PORT_POSITION_MISSING` in parity evidence.

## Draft Edit 3D presentation

Reversal rows are rendered as distinct `REVERSE ENTRY` issue-badge markers. They preserve engineering XYZ across ISO, XY, XZ and YZ views and never contribute to fit bounds.

The fit exclusion is scoped to `reversalCandidate` entities. Existing connection-candidate, active-port and rejected-candidate visual behavior is unchanged by this increment.

The read-model selection resolver recognizes exact `ssk:reversal:*` entity identity. Selection remains presentation-only: the SSK-TS-3E controller still treats non-connection-candidate picks as non-authoritative and establishes no command target.

## Parity

`SequentialEngineeringSvgParityReport.v1` now includes:

- `reversalCandidateCount` from native authority;
- `mappedCountByCategory.reversalCandidate`;
- explicit reversal-candidate omissions.

Parity validation requires mapped rows plus explicit omissions to equal the native reversal-candidate count.

## Containment

The following remain absent and unauthorized:

- a reversal target contract;
- controller reversal-target integration;
- `REVERSE_COMPONENT` in the Draft Edit preparation list or command panel;
- prepare, accept, execute or publish behavior from a reversal marker;
- component traversal mutation;
- arbitrary component or entry-port selection;
- geometry editing and SVG retirement.

Those capabilities require SSK-TS-3G or later Work Packs.

## Proof

Focused proof covers all four native reversal reasons, exact entry-port identity and source position, stable point entities, parity counts, missing-position omission, confirmed-component exclusion, indexed-evidence mismatch rejection, branch-root fallback through certified owner-snapshot regeneration, exact reversal selection identity, standard-view determinism, read-only visual markers, reversal-only fit exclusion and continued `REVERSE_COMPONENT` exclusion.
