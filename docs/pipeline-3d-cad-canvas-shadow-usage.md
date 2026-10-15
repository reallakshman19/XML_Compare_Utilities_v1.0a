# Pipeline 3D CAD Canvas shadow usage

The Table 2X / Table 3X Canvas workspace is feature-gated while benchmark validation is in progress.

Enable it for the current URL:

```text
?pipelineCadCanvas=1
```

Or enable it for the browser profile:

```js
localStorage.setItem('pipeline3dCadCanvas', '1');
location.reload();
```

Disable the stored flag:

```js
localStorage.removeItem('pipeline3dCadCanvas');
location.reload();
```

When disabled, the existing string-generated SVG preview remains the production path.

When enabled, **Preview Table 2X & 3X** mounts persistent `Table2XCanvas` and `Table3XCanvas` instances with Select, Add V/Z, Add Marker, Delete, Pan, Fit, Reload Graph, Undo, and Redo controls. Double-click a V node, Z node, or marker anchor to edit its value or label inline.
