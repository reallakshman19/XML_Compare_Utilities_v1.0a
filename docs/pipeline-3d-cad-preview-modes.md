# Pipeline CAD preview modes

## Purpose

The floating **Table 2X & 3X Previews** window supports four explicit modes:

1. **Table 2X** — elevation profile only;
2. **Table 3X** — depth/Z and marker profile only;
3. **Side by Side** — both live CAD graphs visible together;
4. **Overlay** — review-only comparison on one physical elevation axis.

The selected mode and the Overlay Z-origin elevation are persisted in browser storage under `pipeline3dCadPreviewModeV1`.

## Side by Side

Side by Side retains the native graph semantics:

| Graph | X axis | Y axis |
| --- | --- | --- |
| Table 2X | Station / Chainage | Elevation |
| Table 3X | HLength Cumulative | Depth / Z |

The Y axes remain independent. Both canvases retain their normal editing toolbars, command history, keyboard controls and raw-table synchronization.

The linked coordinate inspector and linked cumulative-X crosshair continue to operate between the two graphs.

## Overlay

Raw elevation values around `230–233 m` and raw Z values around `0 to -1.5 m` must not be drawn directly on one Y scale. Overlay first converts every Table 3X Z point into an elevation coordinate:

```text
projected elevation = Z-origin elevation + Z
```

Examples:

```text
Z-origin elevation = 231.80 m
Z                  = -1.50 m
Projected elevation = 230.30 m
```

```text
Z-origin elevation = 231.80 m
Z                  = +0.75 m (A/G representation)
Projected elevation = 232.55 m
```

Overlay therefore uses:

- one shared Station / Chainage X axis;
- one Elevation / Projected Z Elevation Y axis;
- solid cyan Table 2X elevation profile;
- dashed orange projected Table 3X Z profile;
- dotted violet Z=0 origin line;
- Table 3C marker reference lines.

Overlay is review-only. Dragging and graph commands remain available in the Table 2X, Table 3X and Side by Side modes, where entity semantics are unambiguous.

## Z-origin control

The Overlay toolbar provides:

- a numeric **Z-origin elevation (m)** field;
- **Use Table 2 start**, which sets the origin to the first valid Table 2X elevation.

Changing the origin moves only the projected Table 3X profile. The Table 2X elevation profile is not changed.

The origin is a display/reference datum. It does not modify Table 3B raw Z values, the profile model, generated XML or command history.

## Coordinate inspector

Overlay hover reports:

- cumulative HLength;
- station / chainage;
- absolute H coordinate;
- Table 2X elevation;
- raw/interpolated Table 3X Z;
- projected Z elevation;
- active Table 3A segment;
- segment HLength;
- nearest marker.

Pointer inspection does not create commands or mutate source data.

## Acceptance coverage

Static tests verify:

- mode normalization and persistence;
- default origin from Table 2X start;
- exact `origin + Z` projection;
- unchanged Table 2X elevations when origin changes;
- uniform projected-profile displacement when origin changes.

Chromium scenarios verify:

- `CAD-M01` — Side by Side displays both independently scaled, editable canvases;
- `CAD-M02` — Overlay is review-only and uses the physical elevation projection;
- `CAD-M03` — Z-origin adjustment shifts only projected Z and persists after reload;
- `CAD-M04` — Overlay inspector reports raw Z and projected elevation without mutation;
- `CAD-M05` — destroy/remount rebinds controls without duplicate modes or listeners.

## Scope boundaries

This feature does not change:

- Table 2A, Table 3A, Table 3B or Table 3C schemas;
- raw-table serialization;
- command-history semantics;
- XML generation;
- Coordinate Tab behavior;
- Canvas/SVG fallback policy;
- legacy SVG implementation.
