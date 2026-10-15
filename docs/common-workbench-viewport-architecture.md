# Common Workbench Viewport Architecture

## Decision

Viewport state, transforms, coordinate grids, persistence, host capabilities, and shell models are repository-wide infrastructure.

Pipeline CAD and the XML Builder are consumers. Neither domain owns the common subsystem.

## Authority rule

The common viewport is view-only. It must never become authoritative for:

- Pipeline profile rows, nodes, edges, commands, raw tables, or exports;
- `CategorizedGraph.v1`, recipes, mappings, source registries, pivot output, or XML output.

Domain models remain authoritative. A host adapter projects domain data into a viewport surface and delegates domain actions back to the owning workflow.

## Dependency direction

```text
Pipeline profile model              CategorizedGraph.v1 / recipe model
          |                                      |
          v                                      v
Pipeline viewport adapter                XML Builder viewport adapter
          |                                      |
          +---------- WorkbenchViewportHost.v1 --+
                                 |
                                 v
                     core/workbench-viewport
                                 |
                                 v
                    Canvas / SVG / DOM surface
```

The common core must not import Pipeline CAD or XML Builder modules.

## Common core

Location:

```text
core/workbench-viewport/
```

The common core owns:

- `WorkbenchViewportState.v1` normalization;
- independent X/Y transforms and inverse transforms;
- Auto Fit and validated custom-range mechanics;
- generic X/Y scale-ratio handling;
- deterministic bounded `1 / 2 / 5 × 10^n` coordinate grids;
- persistence namespaced by consumer, mode, and surface;
- linked-axis range primitives;
- `WorkbenchViewportHost.v1` validation;
- capability-driven shell models;
- lifecycle-neutral palette and attribute helpers.

The common core does not own:

- station, elevation, depth, HLength, hierarchy, node, block, field, or XML semantics;
- selection or edit commands;
- snap policy;
- history or undo/redo;
- graph generation or export;
- rendering-provider selection.

## `WorkbenchViewportState.v1`

The state is presentation-only and contains generic fields:

- `schema`;
- `namespace`;
- `surfaceId`;
- `modeId`;
- `scaleMode`;
- `zoomX`, `zoomY`;
- `panX`, `panY`;
- `xScale`, `yScale`;
- optional `customRange`;
- grid, minor-grid, crosshair, and linked-axis flags.

It must not contain domain rows, graph collections, commands, source text, mappings, recipes, or exports.

## Persistence

The default key shape is:

```text
workbenchViewportStateV1/<namespace>/<modeId>/<surfaceId>
```

Consumers may provide a different storage prefix, but namespace, mode, and surface isolation remain mandatory. Corrupt JSON falls back to normalized defaults.

## `WorkbenchViewportHost.v1`

A host declares:

- stable `namespace`, `surfaceId`, and `modeId`;
- explicit capabilities;
- plot and world bounds;
- world/screen conversion;
- view-transform read and apply operations;
- invalidation;
- pointer formatting;
- status segments;
- subscription and disposal.

The host contract is lifecycle-neutral. It does not scan the document, mount UI, mutate domain data, or select a rendering backend.

## Capabilities

Built-in capabilities are:

- fit;
- custom range;
- scale ratio;
- grid;
- minor grid;
- crosshair;
- linked X;
- linked Y;
- surface selection.

Consumers may declare extension capabilities. A shell action is visible only when its declared capability is present on the host.

## Grid contract

`WorkbenchGridModel.v1` is pure output containing:

- the visible world range;
- major/minor X and Y steps;
- bounded major/minor coordinate arrays.

It contains no DOM, Canvas, Pipeline, or XML references.

## Consumer boundaries

### Pipeline CAD adapter

A later PCAD Work Pack will own:

- `InteractiveGraph`, Table 2X, and Table 3X adaptation;
- station/elevation/HLength/absolute-H/Z formatting;
- Pipeline snap settings;
- Side-by-Side linked-X policy;
- Overlay review-only policy;
- explicit workspace mounting and teardown;
- command, history, raw-table, and Canvas-event compatibility;
- production-shaped browser acceptance.

### XML Builder adapter

A later XMLB Work Pack will own:

- tree, pivot, and graph-surface projection;
- hierarchy path, level, node, block, field, and source-trace formatting;
- XML Builder selection and state transitions;
- recipe, mapping, graph-generation, pivot, and export boundaries;
- XML Builder browser acceptance.

The two adapters must not import each other.

## WV-001 acceptance boundary

WV-001 delivers only the common core, this architecture document, focused tests, and repository test registration.

Its proof uses two immutable synthetic consumers:

1. a Pipeline-profile-shaped host;
2. an XML Builder / `CategorizedGraph.v1`-shaped host.

No production adapter or UI is part of WV-001.

## Dependency guards

Tests must fail when:

- a common module imports `tabs/pipeline-3d-model/**`;
- a common module imports XML Builder production modules;
- common state contains domain model or export data;
- persistence is not isolated by namespace, mode, and surface;
- a shell action is emitted without a declared host capability;
- view operations mutate an immutable synthetic domain model;
- a new core JavaScript file exceeds 300 lines or uses a default export.

## Work-pack sequence

```text
WV-001      Common Workbench Viewport core and contracts
    -> PCAD-001    Pipeline CAD adapter and explicit lifecycle integration
    -> XMLB-VP-001 XML Builder viewport adapter
```

PCAD-001 starts only after WV-001 merges. XMLB-VP-001 starts only after the common contract is merged and the Pipeline adapter proves it in production-shaped acceptance.
