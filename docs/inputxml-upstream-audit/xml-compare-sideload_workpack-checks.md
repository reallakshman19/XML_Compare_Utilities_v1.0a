# XML Compare sideload Work Pack checks

Baseline: `801958f86db309b1286019cc6a8cd0fa69ef6f83`

## Capability delivered

- Stable `xml-compare-sideload-diagnostics/v1` records.
- Row-level evidence for read, skipped, duplicate, ambiguous and unmatched sideload rows.
- Attribute-level added/replaced/unchanged evidence.
- Coordinate diagnostics carried into the same report.
- Collapsible diagnostics table in both sideload front doors.
- Downloadable `xml_compare_sideload_diagnostics.json` artifact.

## Guardrail checks

- New JS modules are below 300 lines; largest is 289 lines.
- Focused function scan found no new sideload function above 40 lines.
- Named exports only; no default exports.
- No mocks, shims, runtime switch, writer switch or canvas switch.
- No generated snapshots or benchmark data changed.
- Existing edited files have immutable pre-edit blob references in `.backups/20260713_xml_compare_sideload_workpack_backup.json`.

## Local checks

- `node --check` passed for every touched/new JavaScript file.
- Focused functional check passed for duplicate resolution, unmatched rows, ambiguous tag fallback, coordinate propagation, mutation evidence, diagnostics JSON and popup rendering.
- Repository pull-request CI remains the authoritative full-suite gate.
