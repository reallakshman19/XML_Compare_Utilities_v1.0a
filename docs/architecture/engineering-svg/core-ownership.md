# Shared Engineering SVG Core Ownership

## Status

```text
Schema: EngineeringSvgCoreOwnership.v1
Mission: ESVG-CORE-P0
Issue: #535
Baseline main: 74156da67ed0304ae0011d490dab9b7188ccfec5
```

This document records the Phase 0 containment boundary. It does not change rendering, selection, projection, fit, export, lifecycle, editing, deployment, or domain behavior.

## Authority direction

```text
Domain authority
  -> domain-owned Engineering SVG integration
  -> immutable EngineeringScene
  -> core/engineering-svg presentation runtime
```

The shared core is domain-neutral. It must not import Pipeline, Sequential Sketcher, Topology Trace, Revision Compare, Workbench3D, or another application consumer. It must not create or mutate domain authority.

## Shared-core ownership

```text
Owned root: core/engineering-svg/**
Public entry point: core/engineering-svg/index.js
Machine-readable baseline: core-ownership.v1.json
```

Any PR changing the owned root must be an explicitly authorized Shared Engineering SVG core Work Pack. Consumer missions may not modify the core incidentally.

The public entry point currently exposes:

```text
engineering-svg-projection.js
engineering-svg-fit.js
engineering-svg-projected-scene.js
engineering-svg-scene-source.js
engineering-svg-renderer.js
engineering-svg-selection.js
engineering-svg-export.js
engineering-svg-workspace.js
```

A public export change must update the machine-readable manifest and pass the ownership guard in the same change.

## Consumer boundaries

| Consumer | Integration | Current source adoption |
|---|---|---|
| Pipeline 3D | Domain adapter and shadow workspace | Read-only shadow |
| Sequential Sketcher | Domain adapter and optional production preview | Read-only production preview; existing construction SVG remains default |
| Topology Trace | Domain adapter and shadow workspace | Read-only shadow |
| Revision Compare | Domain scene and viewer integration | Production read-only SVG backend |

Revision Compare is intentionally recorded as a scene/viewer integration. It is not represented as an adapter-equivalent when current source does not use that architecture.

## Mandatory dependency rules

1. `core/engineering-svg/**` must not import from `tabs/**` or `workbench3d/**`.
2. A declared consumer Engineering SVG integration file must not import another declared consumer root.
3. Consumer commands and engineering mutations must remain outside read-only integrations.
4. WebGL and Three.js backends remain outside the Shared Engineering SVG core.
5. Public export drift must be explicit and reviewed.

## Executable guard

Run:

```text
node tests/engineering-svg-core-ownership.test.js
```

The guard validates the manifest, public exports, declared integration files, core dependency direction, and consumer isolation. It performs no network access and requires no generated artifact.

## Phase 0 exclusions

Phase 0 does not authorize:

```text
core runtime changes
consumer runtime changes
renderer replacement
command gateways
editing
selection reconciliation changes
projection or fit changes
3D/WebGL changes
package or dependency changes
workflow or deployment changes
```
