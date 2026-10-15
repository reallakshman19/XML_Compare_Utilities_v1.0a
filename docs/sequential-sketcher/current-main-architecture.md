# Sequential Sketcher current-main architecture

Baseline branch: `main`

Baseline commit: `b090f1fd5bb77185c5ee6fdf8a6b736a55fb32eb`

Merged sequence reviewed:

- PR #349 — supervised Sequential Sketcher integration
- PR #350 — analytical support-member-to-carrier attachment evidence
- PR #351 — carrier topology component and port catalog
- PR #352 — fail-closed carrier topology continuity
- PR #353 — complete carrier-to-structure path audit
- current-main support restraint-function evidence — `b090f1fd5bb77185c5ee6fdf8a6b736a55fb32eb`

## Construction authority

```text
sequential-sketcher-workspace.js
  -> source/sequential-evidence-model.js
  -> source/sequential-reference-normalization.js
  -> source/sequential-reference-resolver.js
  -> construction/sequential-construction-runtime.js
       -> sequential-source-boundary-engine.js
       -> sequential-gated-construction-engine.js
       -> sequential-construction-engine.js
       -> sequential-boundary-resolver.js
       -> sequential-connection-resolver.js
       -> sequential-terminal-classifier.js
       -> sequential-connection-audit.js
  -> construction/sequential-construction-acceptance.js
  -> canvas/sequential-construction-svg.js
  -> integration/sequential-carrier-evidence-adapter.js
  -> support/sequential-confirmed-support-projection.js
```

Construction remains evidence-first:

```text
immutable source evidence
-> explicit branch/component/port model
-> head-boundary validation
-> one component placement
-> one connection resolution
-> exact/reference commit, strict unique small-gap repair, or user decision
-> route and confirmed branch completion
-> ConfirmedSequentialConstruction.v1
-> downstream adapters and support projection
```

Only `ConfirmedSequentialConstruction.v1` may cross the downstream boundary. Open decisions, failed sessions, unaudited connections, identity-only external references, or position-unconfirmed boundaries are rejected.

## External reference versus physical boundary

The runtime separates:

```text
EXTERNAL_REFERENCE_CLASSIFIED
EXTERNAL_PHYSICAL_BOUNDARY_CONFIRMED
```

An equipment-shaped identifier is diagnostic evidence only. Automatic boundary confirmation requires a controlled nozzle or connection suffix, an active source endpoint, a branch head/tail position, and endpoint-to-boundary distance within the exact boundary tolerance.

## Support and PS/SL boundary

Current XML-free support evidence remains independently owned by:

- `tabs/support-steel-relationship-builder/`
- `tabs/ps-family-clash-audit/`

The current-main support path includes structural member classification, carrier attachment, fail-closed topology, complete carrier-to-structure paths, and restraint-function evidence. Sequential construction imports none of those mutable internals.

```text
ConfirmedSequentialConstruction.v1
-> buildSequentialCarrierEvidenceCatalog()
-> SequentialCarrierEvidenceCatalog.v1
-> future support/attachment consumer
```

The adapter exposes analytical-geometry and mass-property readiness explicitly. Confirmed connectivity does not imply complete geometry or mass properties. Shadow carriers remain searchable and support-reference-addressable but are not separately rendered, exported, or mass-counted.

## Overlap review

| Concept | Sequential construction | Support/PS-SL audit |
| --- | --- | --- |
| component and port catalog | immutable supervised construction evidence | staged carrier topology evidence |
| analytical geometry | accepted route geometry with readiness status | support attachment carrier geometry |
| repair evidence | strict route continuity repair | topology-specific audit repair |
| aliases | component and shadow-carrier identities | carrier-object resolution aliases |
| route/path | accepted construction order | carrier-to-structure audit path |
| restraint functions | downstream support evidence only | current-main PS/SL authority |

No duplicate geometry, transform, restraint, or mutable carrier abstraction is introduced by this branch.

## Validation entry points

- `.github/workflows/sequential-sketcher.yml`
- `.github/workflows/xml-compare-utilities.yml`
- `.github/workflows/deploy.yml`
- `.github/workflows/support-steel-relationship-builder.yml`
- `.github/workflows/ps-family-native-audit-pipeline.yml`
- `.github/workflows/ps-family-evidence-graph-audit.yml`
- `.github/workflows/ps-family-offline-validation.yml`

The final validation must be reported against the rebased PR head and its current-main merge result, not against historical PR #353 runs.
