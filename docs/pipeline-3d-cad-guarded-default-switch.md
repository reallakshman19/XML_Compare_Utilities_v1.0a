# Pipeline 3D CAD guarded default switch

## Runtime policy

Table 2X and Table 3X now resolve the preview renderer through one persisted policy:

1. `pipelineCadRenderer=canvas|svg` query override.
2. Persisted `pipeline3dCadRenderer` preference.
3. Backward-compatible `pipeline3dCadCanvas=1` preference.
4. Default: `canvas`.

The legacy SVG renderer remains in the production bundle and is not deleted or rewritten.

## User rollback

The X-preview modal displays the active renderer and build stamp:

- `Renderer: CAD Canvas`
- `Renderer: Legacy SVG`

The adjacent button switches renderer, persists the choice, removes temporary query overrides, and reloads the page. The available actions are:

- `Use Legacy SVG`
- `Use CAD Canvas`

A direct rollback can also be forced with:

```text
?pipelineCadRenderer=svg
```

## Automatic failure fallback

The runtime policy installs error and unhandled-rejection guards before the Canvas workspace module loads. A Pipeline CAD initialization failure:

1. persists `svg` as the renderer;
2. removes the legacy Canvas-enable key;
3. records the failure reason and build;
4. reloads once;
5. returns through the existing SVG path.

The renderer badge shows `auto-fallback` after this path. Selecting `Use CAD Canvas` clears the fallback record and retries the Canvas runtime.

## Build

```text
2026.07.13-cad-default-1
```

## Acceptance gates

The normal static suite proves policy precedence, preference persistence, fallback loop protection, runtime import order, and browser fixture wiring.

The Chromium suite proves:

- `CAD-R01`: Canvas mounts by default on a clean profile.
- `CAD-R02`: explicit SVG override leaves both legacy SVG previews intact.
- `CAD-R03`: the visible renderer control persists a switch from SVG back to Canvas across navigation.

The original CAD-B01 through CAD-B06 interaction and high-DPI scenarios remain mandatory.

## Non-goals

This switch does not remove SVG code, change raw table schemas, modify Coordinate Tab behavior, or alter XML generation. Legacy cleanup remains a separate later mission after production soak evidence.
