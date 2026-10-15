# Pivot XLSX Decision Gate

Current decision: **No XLSX dependency and no XLSX export implementation are approved in Mission 074.**

The Pivot Designer currently supports deterministic JSON, CSV, and safe HTML preview/download artifacts through the existing `PivotViewModel.v1` exporter path. XLSX is intentionally held behind an owner approval gate.

Before XLSX can be added, the owner must explicitly approve:

- dependency scope and package choice,
- browser bundle/file-size impact,
- static GitHub Pages compatibility,
- security and escaping rules for workbook cell values,
- test burden for workbook structure and regression coverage,
- whether XLSX is mandatory or optional compared with CSV/HTML.

No spreadsheet library is added by this mission. No XLSX code path is implemented by this mission.
