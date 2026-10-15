# Canvas Audit Results

## Scope resolution

The requested legacy entry files were audited first:

- `tabs/pipeline-3d-model/pipeline-3d-model-preview.js`
- `tabs/pipeline-3d-model/pipeline-3d-model-samples.js`

They retain the legacy preview/SVG path. The production HTML5 Canvas runtime is implemented by the `pipeline-3d-model-cad-*` modules, principally `pipeline-3d-model-interactive-graph.js`, `pipeline-3d-model-table2x-canvas.js`, `pipeline-3d-model-table3x-canvas.js`, `pipeline-3d-model-cad-controller.js`, and `pipeline-3d-model-cad-workspace.js`.

## Checklist

### 1. State Decoupling & Immutability — [PASS]

- `PipelineCanvasManager` exposes immutable aggregate `nodes[]` and `edges[]` snapshots for Table 2X and Table 3X.
- Pointer movement changes graph override objects only; raw textareas are not mutated during preview.
- Raw serialization occurs only after the controller reports a successful committed command.
- Node records, edge records, event payloads, and nested `before` / `after` records are frozen before publication.

### 2. Performance & Render Loop Constraints — [PASS]

- Repeated `render()` calls are coalesced into one `requestAnimationFrame` paint per graph.
- No constant animation loop is introduced.
- Pointer preview broadcasts are independently coalesced to one manager update per frame.
- Immutable geometry snapshots are rebuilt only for geometry/model changes and preview overrides.
- Pan, zoom, resize, selection, and other viewport-only paints reuse the existing geometry snapshot.

### 3. Memory and Cancellation Lifecycle — [PASS]

- Canvas pointer listeners are removed by `InteractiveGraph.destroy()`.
- Global keyboard, blur, and visibility listeners remain governed by the existing lifecycle cleanup stack.
- A detached-popup observer destroys the controller, manager, graph instances, pending paint frames, pending preview frames, and event listeners.
- Escape, pointer cancellation, blur, and visibility-loss cancellation remove queued preview broadcasts and republish canonical geometry.
- A rejected controller commit removes the temporary visual override and emits a cancelled operation rather than a false committed event.

### 4. Public Event Contracts — [PASS]

Two versioned schemas are published:

- `PipelineCanvasNodeMoved.v1`
- `PipelineCanvasGeometryUpdated.v1`

`PipelineCanvasNodeMoved.v1` normalizes Table 2X elevation moves, Table 3X depth moves, and Table 3X marker moves into a stable shape containing:

- `operationId`
- `phase`: `preview`, `committed`, or `cancelled`
- graph and entity identity
- normalized `before` / `after`
- reason and model revision
- immutable node and edge snapshots

Committed movement is emitted only after the controller dispatches the matching `commandCommitted` event.

DOM dispatch occurs once per logical event:

- `canvas:nodeMoved` is dispatched from the source graph Canvas and bubbles upward.
- `canvas:geometryUpdated` is dispatched once from the Pipeline dialog host.
- Both events are also available directly from `PipelineCanvasManager`.

This avoids duplicate document-level notifications when both Table 2X and Table 3X canvases are attached.

## Constraints verification

- Production modules remain below 300 lines each.
- New functions and methods remain below 40 lines.
- Named exports only.
- No production polyfills or runtime compatibility shims were added.
- The legacy preview files were not expanded or removed.

## Regression coverage

`tests/pipeline-3d-model-canvas-audit-hardening.test.js` verifies:

- two attached graph canvases and immutable aggregate geometry;
- one-frame render coalescing;
- no raw mutation during pointer preview;
- successful commit correlation and shared operation identity;
- one source-canvas movement dispatch with no duplicate sibling-canvas dispatch;
- one dialog-host geometry dispatch;
- versioned normalized Table 2X and Table 3X payloads;
- cancellation before the queued preview frame;
- rejected-commit visual rollback;
- no geometry rebuild during pan and zoom paints;
- detached popup destruction, listener cleanup, and pending-frame cancellation.
