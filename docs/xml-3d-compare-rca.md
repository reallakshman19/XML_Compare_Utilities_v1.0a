# RCA — Why the 3D XML Compare UI failed on large files

Date: 2026-07-17 · Scope: `workbench3d/ui/workbench3d-tab.js` (tab id `workbench-3d`,
"3D Data Compare Workbench") + `workbench3d/viewer/workbench-viewer.js`.
Purpose: root-cause the hangs / zooming difficulty / unusable connector-anchor UI
before building the staged-JSON Revision Compare tab on the same foundation.

## Symptoms (as reported)

1. Loading a real, large file hangs the canvas and the whole tab.
2. Zooming is difficult (jumps, loses the point of interest).
3. Connector / anchor UI is hard to use.

## Root causes

### RC1 — Per-object mesh explosion (primary cause of the hang) — FIXED
Every segment produced 1–5 individual `THREE.Mesh` objects (a valve alone was
2 discs + ball + tube; each restraint arrow another mesh). A real model with
thousands of components produced tens of thousands of meshes → tens of
thousands of draw calls per frame plus massive geometry allocation at build
time. WebGL cannot survive that; the GPU/driver queue is what "hangs".
**Fix shipped:** the viewer now renders everything as instanced batches of 4
unit primitives with per-instance color and pick ids. The 10-branch benchmark
scope renders 1,342 instances in 8 draw batches; the full file stays in the
tens of batches.

### RC2 — Full scene rebuild ×4 per push — FIXED
`setStatusStyles`, `setModels`, `setStatuses`, `setColorOverrides` each
triggered a complete teardown-and-rebuild, and the tab calls all four
back-to-back on every "Run Compare" and on every settings tweak. One user
action = 4 full rebuilds of RC1's mesh explosion.
**Fix shipped:** rebuilds are coalesced through a microtask queue; recolor /
filter / selection changes are now per-instance buffer writes, no rebuild.

### RC3 — CPU raycast over the whole scene on every interaction — FIXED
Click, hover (every 80 ms), and `recalibrateOrbitDepth` on every `pointerup`
**and every wheel tick** raycast recursively against every visible mesh. With
RC1's mesh counts, each wheel tick cost hundreds of ms → "zooming is
difficult" was partly this: the app froze mid-gesture.
**Fix shipped:** GPU color-ID picking (`gpu-picker.js`) — one 5×5-pixel render
pass, cost independent of model size.

### RC4 — Zoom model itself — FIXED
The dolly was a blind `radius *= 1.12` toward a fixed orbit target. On a large
plant model the target is rarely where the user is looking, so zooming flew
past or away from the area of interest, and the depth recalibration that was
supposed to help was itself RC3-slow.
**Fix shipped:** cursor-anchored dolly (the point under the cursor stays put),
Shift+wheel fine zoom, double-click recenters, `F` fits selection.

### RC5 — Synchronous multi-MB parsing on the main thread — PARTIALLY FIXED
`rebuildGraphs()` runs `parseInputXmlRecords` ×2 + graph build ×2 + compare
synchronously; the regex XML tokenizer walks the full document. A 25 MB input
freezes the tab for the whole duration — the browser offers "page unresponsive".
Worse, the schema badge re-parsed both full documents on **every render**, and
the textareas re-serialized up to 400 KB per render.
**Fixed so far:** the schema-badge re-parse is now cached; the staged-JSON
worker (`workbench3d/workers/staged-json-worker.js`) proves the off-main-thread
pattern and is what Revision Compare will use. **Still open for the XML tab:**
`parseInputXmlRecords`/`runCompare` still run on the main thread — acceptable
for the legacy tab, but Revision Compare must (and will) parse in the worker.

### RC6 — Connector/anchor interaction design — PARTIALLY FIXED
Connectors were thin `THREE.Line`s: hover-only (no click handler at all),
hidden by default until you had already selected an endpoint, with a 40 mm
world-space hit threshold that shrinks to nothing when zoomed out. Anchors were
faint gray lines with no handles. So the feature was invisible unless you knew
it existed, and untargetable when you found it.
**Fixed so far:** connectors now have clickable instanced endpoint handles
(picking selects the endpoint object), merged line geometry, and GPU-pickable
hit areas. **Still open:** the Revision Compare tab should add an explicit
connector list/panel as the primary affordance, with the 3D lines as secondary
visualization — 3D line-picking should never be the only way to act on a match.

### RC7 — No load scoping
The XML tab loads whole files or nothing; there was no way to reduce a 25 MB
model to the branches under review. Every other cause was amplified by always
operating on the full model.
**Fix shipped (for staged JSON):** the branch-scope popup filters before load;
Revision Compare gets it on both slots.

## Why Revision Compare will not inherit the failure

| Failure | Legacy XML tab | Revision Compare design |
|---|---|---|
| Mesh explosion | per-object meshes | shared instanced viewer (already live) |
| Rebuild storms | ×4 per push | coalesced invalidate (already live) |
| Interaction raycasts | CPU, whole scene | GPU pick (already live) |
| Zoom | blind dolly | cursor-anchored (already live) |
| Main-thread parse | full XML parse per run | staged-JSON worker parse + filter |
| Full-model load | always | branch-scope popup on each revision slot |
| Connector UX | hover-only hidden lines | diff table + handles; lines are secondary |

## Verification evidence

- 10-branch benchmark scope: 8 draw batches / 1,342 instances; orbit, zoom,
  GPU pick, and selection verified interactively; no console errors.
- 25 MB file: worker parse + scope popup + filtered load end-to-end in the
  browser; `npm run test:topology-validator` (19 green) and
  `npm run test:workbench3d` (15 green) gate the shared modules.
