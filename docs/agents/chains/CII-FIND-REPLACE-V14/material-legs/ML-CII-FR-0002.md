# ML-CII-FR-0002 — CSV/manual synchronization material receipt

CHAIN_ID: CII-FIND-REPLACE-V14
MATERIAL_LEG_ID: ML-CII-FR-0002
PREVIOUS_MATERIAL_LEG: ML-CII-FR-0001
MATERIAL_LEG_BASE: aaa3604e2b642b1b5f571229ec5f51217f6180de
MATERIAL_LEG_PREWORK_ENDPOINT_FILE: agents/chains/CII-FIND-REPLACE-V14/endpoints/EP-CII-FR-0017.md
MATERIAL_LEG_HEAD: 43761321967387130988590bc61877a79b632c37
MATERIAL_LEG_HISTORY_STATUS: RECORDED
MATERIAL_SCOPE: Preserve synchronized editable-manual-table rows when CSV is loaded/reloaded inside the supported CII v14 Find & Replace app

## Changed production paths

- `tabs/cii-workspace/cii-workspace-find-replace-ui.js`

## Changed test paths

- `tests/cii-workspace-find-replace-ui-registration.test.js`

## Root cause and correction

Before this leg, `onCsvChange()` rebuilt `session.rows` from CSV operations only. A clean, already-synchronized manual grid could therefore remain visibly populated while its rows disappeared from Preview/Validate custody after a CSV load or reload.

The correction snapshots manual inputs only when the manual grid is clean, applies the CSV update, then restores the synchronized manual inputs with the existing `replaceFindReplaceManualRows()` path. Dirty manual-grid values are not auto-admitted; the existing Update Preview gate remains mandatory.

## Preserved domains

FORCE/FORCMNT, TARGET0 overwrite, Node Name fixed-field authority, Displacement authority, validator/executor/output custody, Writer1/Writer2, parser/converter, benchmark/oracle, workflow and release-receipt semantics were not modified.

## Validation truth

- UI JavaScript syntax check: PASS;
- exact-source Find & Replace UI/static closure: PASS 10/10;
- new CSV/manual synchronization regression: PASS;
- existing pending-FORCE absence and unsupported-input fail-closed assertions: PASS;
- Writer/file-system mutation import absence: PASS;
- SOURCE 3 retained-real authored runtime: NOT_RUN;
- full repository suite: NOT_RUN;
- native-v14 archived fixture runtime: NOT_RUN;
- external CAESAR acceptance: NOT_RUN.

Evidence: `agents/evidence/PR1081_csv_manual_sync_exact_execution.md`.

No NOT_RUN result is promoted to PASS.

## Falsifier preserved

Any exact runtime showing that loading/reloading CSV silently drops clean synchronized manual rows, auto-admits dirty manual rows, enables validation while the manual grid is dirty, widens FORCE support, invokes Writer1/Writer2, or changes TARGET0 directly invalidates this material leg and requires an isolated correction.