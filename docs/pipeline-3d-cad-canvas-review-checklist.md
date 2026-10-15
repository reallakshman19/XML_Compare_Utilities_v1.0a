# Pipeline 3D CAD Canvas review checklist

- [ ] PR #243 is merged or otherwise available as the stacked base.
- [ ] Canvas feature flag is disabled by default.
- [ ] Legacy SVG preview remains unchanged when the flag is absent.
- [ ] Table 2X drag updates `Elevation Text`, not `[H vs V] Length`.
- [ ] Table 3X marker drag writes inverse-mapped absolute H to Table 3C.
- [ ] Graph commits preserve Canvas identity, pan, zoom, and retained profile path.
- [ ] Manual raw input reloads the model and clears stale visual overrides.
- [ ] Reload Graph clears dirty-row highlighting.
- [ ] Add, delete, inline rename, undo, and redo are covered by browser validation.
