# SSK-TS-1B — Sequential Read-Only Draft Edit 3D

## Status

This document records the contained read-only 3D migration slice for Sequential Sketcher.

```text
Sequential owner snapshot
→ independently certified read model
→ deterministic EngineeringScene.v1
→ EngineeringScope.v1
→ read-only Draft Edit host
→ Workbench 3D visual projection
→ fail-open production view
```

## Included

- exact owner-snapshot authority regeneration;
- existing Sequential EngineeringScene projection reuse;
- deterministic selection and structural scopes;
- finite read-only geometry anchors;
- explicit denial of every edit command;
- stale-authority rejection and same-authority selection/projection remounting;
- fail-open subscription from the existing Sequential owner bridge;
- deterministic EngineeringScene-to-VisualGeometryModel projection;
- a visible `Draft Edit 3D` renderer surface using the existing Workbench viewer;
- read-only local picking, navigation, projection switching, and fit behavior;
- renderer lifecycle coordination with Construction SVG and Engineering SVG preview;
- diagnostics, invalidation, remount, and destroy evidence;
- integration and static containment tests.

## Excluded

- shared drag or scoped-edit mutation runtime;
- command routing or acceptance from the 3D surface;
- coordinate mutation;
- SVG replacement or retirement;
- workspace-package migration;
- persistence changes;
- HPOS/APOS/LPOS or construction-algorithm changes.

## Next controlled batch

Prove browser-observed scene, selection, support, branch-switch, renderer-switch, and lifecycle parity. Only after that evidence may a separately qualified `COMMAND_ONLY` runtime be considered. Drag-based command fabrication remains prohibited.
