# Pipeline 3D CAD Canvas authoring controls

This layer extends the feature-gated Table 2X / Table 3X Canvas workspace from PR #246. It does not enable the Canvas runtime by default.

## Snap modes

Each graph has independent persisted snap settings.

- **Grid Snap** rounds stations and values to the configured numeric increments.
- **Station Snap** snaps Table 3 horizontal movement to the known cumulative HLength anchors. Table 2 insertion may snap to another valid station only when it is within tolerance and is not one of the segment endpoints.
- Near-grade Table 3 Z values snap to the canonical A/G display position.

Default increments:

| Quantity | Step |
|---|---:|
| H / cumulative station | 0.5 m |
| Table 2 elevation | 0.05 m |
| Table 3 depth | 0.1 m |
| Station snap tolerance | 0.75 m |

Snap settings are stored under `pipeline3dCadSnapV1` in `localStorage`.

## Keyboard controls

| Key | Action |
|---|---|
| `V` | Select |
| `N` | Add V/Z node |
| `M` | Add marker in Table 3X |
| `Delete`, `Backspace`, or `X` | Delete selected entity |
| `H` | Pan tool |
| `F` | Fit graph |
| `R` | Reload committed graph geometry |
| `G` | Toggle Grid Snap |
| `S` | Toggle Station Snap |
| `Ctrl/Cmd+Z` | Undo |
| `Ctrl/Cmd+Shift+Z` or `Ctrl/Cmd+Y` | Redo |

Shortcuts are ignored while an input, textarea, select, button, or content-editable element has focus.

## Context menu

Right-click a V node, Z node, or marker to select it and open the CAD context menu.

- **Edit value / label** opens the existing inline editor.
- **Delete** routes through the canonical command history, so it can be undone.

## Runtime activation

Use the existing shadow flag:

```text
?pipelineCadCanvas=1
```

or:

```js
localStorage.setItem('pipeline3dCadCanvas', '1');
location.reload();
```
