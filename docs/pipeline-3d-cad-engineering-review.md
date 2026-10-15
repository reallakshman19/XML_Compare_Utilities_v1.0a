# Pipeline CAD engineering review

## Purpose

This feature turns Table 2X and Table 3X from unlabeled interactive plots into a linked engineering-review surface.

It does not change raw Table 2A/3A/3B/3C data, profile-model contracts, command history, XML generation, Coordinate Tab logic, the floating-window contract, or the legacy SVG rollback path.

## Axis semantics

### Table 2X

- X axis: **Station / Chainage (m)**
- Y axis: **Elevation (m)**
- X ticks use station notation such as `0+000`, `0+020` and `0+040`.
- Y ticks use engineering decimal values derived from the visible zoom range.

### Table 3X

- X axis: **HLength Cumulative (m)**
- Y axis: **Depth / Z (m)**
- X and Y ticks are recalculated from the current visible zoom/pan range.

The existing cumulative-HLength title remains the authoritative Table 3X X-axis title. The engineering-review layer adds the numeric ticks and the Depth/Z Y-axis title.

## Linked inspection

Pointer movement or entity selection on either graph creates one shared cumulative inspection position.

The same orange vertical crosshair is rendered on both graphs. The inspector reports:

- cumulative HLength;
- formatted station / chainage;
- interpolated absolute H coordinate;
- interpolated Table 2X elevation;
- interpolated Table 3X depth/Z;
- active Table 3A segment range;
- segment HLength;
- nearest Table 3C marker within the review tolerance.

The common cursor is clamped to the shared Table 2X/Table 3X cumulative domain. It never changes the engineering model or command history.

## Coordinate inspector contract

The DOM inspector uses:

```text
[data-p3d-cad-coordinate-inspector]
```

Fields use:

```text
[data-p3d-cad-inspector-field="cumulative"]
[data-p3d-cad-inspector-field="station"]
[data-p3d-cad-inspector-field="absoluteH"]
[data-p3d-cad-inspector-field="elevation"]
[data-p3d-cad-inspector-field="depth"]
[data-p3d-cad-inspector-field="segment"]
[data-p3d-cad-inspector-field="segmentLength"]
[data-p3d-cad-inspector-field="item"]
```

Each Canvas exposes:

```text
data-p3d-cad-x-axis-label
data-p3d-cad-y-axis-label
data-p3d-cad-x-tick-count
data-p3d-cad-y-tick-count
data-p3d-cad-inspection-cumulative
```

The inspection attribute is present only while a linked review position is active.

## Mathematical basis

- Table 2X elevation is linearly interpolated between station/elevation anchors.
- Table 3X depth is linearly interpolated between cumulative depth anchors.
- Absolute H is resolved through the existing monotonic Table 3A coordinate map.
- Table 3A segments are resolved from their cumulative HLength intervals.
- Marker proximity uses a bounded tolerance based on the cumulative domain.

No alternative coordinate graph is introduced.

## Acceptance coverage

Static tests verify:

- `1/2/5 × 10^n` engineering tick steps;
- visible tick generation;
- profile interpolation;
- cumulative segment resolution;
- the sample `PM-001` inspection result.

Chromium scenarios verify:

- `CAD-E01` — complete Table 2X/Table 3X axis labels and numeric ticks;
- `CAD-E02` — Table 2X hover drives the linked crosshair and inspector;
- `CAD-E03` — Table 3X hover drives the same linked position and pointer exit clears both graphs.

All earlier Pipeline CAD acceptance scenarios remain mandatory.

## Deferred scope

The proposed side-by-side **Both** view is deliberately deferred until this common inspection contract is proven. That future view should reuse this linked cumulative cursor rather than introducing a second synchronization mechanism.
