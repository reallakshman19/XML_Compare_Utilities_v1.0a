# Pipeline CAD floating Table 2X / Table 3X preview

## Purpose

`Table 2X & 3X Previews` is a modeless floating application window instead of a full-screen blocking overlay.

The change affects window presentation only. It does not change:

- Table 2A, 3A, 3B or 3C parsing;
- Table 2X or Table 3X derived data;
- Canvas model/controller contracts;
- undo/redo or raw-table synchronization;
- renderer fallback policy;
- XML generation or Coordinate Tab behavior.

## Window behavior

The preview window is:

- fixed to the browser viewport;
- movable by dragging the title bar;
- movable with the arrow keys while the title bar is focused;
- moved in 32 px increments with Shift + Arrow;
- resizable from the lower-right browser resize grip;
- clamped so the complete window remains inside the viewport;
- assigned an application-level z-index of `2147483000`;
- modeless, so uncovered areas of the Pipeline workspace remain interactive;
- restored to its last position and size from local storage.

Double-clicking the title bar or selecting **Reset Window** restores the default position and size.

## Persistence

Geometry is stored under:

```text
pipeline3dCadFloatingPreviewV1
```

The persisted contract is:

```text
PipelineCadFloatingPreviewRect.v1
```

Fields:

- `left`
- `top`
- `width`
- `height`
- build identifier

Stored geometry is validated and clamped every time it is read. Corrupt JSON, oversized dimensions and off-screen coordinates fall back to safe viewport-relative values.

## Accessibility

The floating preview is exposed as a modeless dialog:

- `role="dialog"`
- `aria-modal="false"`
- title-based `aria-labelledby`
- keyboard-movable title bar
- visible drag/resize hint
- focus-visible outline on the title bar

Controls inside the title bar are excluded from drag initiation.

## Acceptance coverage

Static tests verify:

- default geometry;
- minimum and maximum dimensions;
- viewport clamping;
- corrupt-storage fallback;
- persistence round-trip;
- fixed positioning, resize support and topmost z-index contract.

Chromium scenarios verify:

- `CAD-F01` — drag movement, keyboard movement, topmost stacking and modeless access;
- `CAD-F02` — resize persistence across reload and Reset Window behavior;
- `CAD-F03` — stale off-screen geometry is restored inside the current viewport.

All existing Pipeline CAD browser scenarios remain mandatory.
