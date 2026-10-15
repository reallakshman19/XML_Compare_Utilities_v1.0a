# Pipeline 3D CAD Canvas benchmark mapping

| Benchmark | Workspace implementation |
|---|---|
| Table 2X vertical drag | `Table2XCanvas` emits `nodeMoved`; `PipelineCadController` updates `Elevation Text`, preserves the render snapshot, and highlights the derived row. |
| Table 3X depth drag | `Table3XCanvas` emits depth Z and formatted A/G or depth text; the controller serializes Table 3B. |
| Table 3X marker drag | Cumulative X is inverse-mapped to absolute H before Table 3C serialization. Markers remain independent Table 3C entities. |
| Range-label stability | Dirty-row matching uses structured Table 3B coordinates plus Z text rather than a display label as identity. |
| Manual typing | Raw textarea input rebuilds `PipelineProfileModel` while retaining the existing Canvas objects. |
| Reload Graph | Replaces the retained profile snapshots, clears visual overrides, and clears dirty-row highlighting. |

The Canvas workspace remains disabled by default until browser interaction validation is complete.
