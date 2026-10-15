# 3D Data Compare Workbench — Requirement Traceability Matrix

Status legend: **DONE** = source module + UI evidence + test/benchmark assertion.
**PARTIAL** = implemented with a named limitation. **PENDING** = not implemented; do not claim.

Test commands:

```
npm run test:workbench3d
# = tests/workbench3d-contracts.test.js
#   tests/workbench3d-benchmark.test.js
#   tests/workbench3d-connectors.test.js
#   tests/workbench3d-static-smoke.test.js
```

UI entry: `index.html` → tab **3D Compare Workbench** (`workbench-3d`).

## A. The 12 workbench functions

| ID | Function | Status | Source module | UI evidence | Test evidence |
|---:|----------|--------|---------------|-------------|---------------|
| 1 | Variance-first view | DONE | `compare/compare-engine.js` (summary derived from diff rows only) | Dashboard tiles; status tiles filter 3D + tables | benchmark: dashboard reconciliation (every object in exactly one diff row) |
| 2 | Side-by-side comparison | PARTIAL | `viewer/workbench-viewer.js` (scissor split, one synced camera) | "Side-by-side" mode button | engine-side only; see Visual V4/V5. Limitation: selection highlight renders in both halves, no per-half candidate panel |
| 3 | Match/mapping engine | DONE | `compare/evidence-scorer.js`, `compare/path-aligner.js`, `compare/compare-engine.js` | Selection panel: score, confidence, reason list, evidence breakdown, next-best, gap | benchmark: 20/20 matched with breakdown asserted on every matched row |
| 4 | Difference classification | DONE | `contracts/contracts.js` `DIFF_STATUS`, `compare/compare-engine.js` | 3D status colors + legend + diff table | benchmark: status vocabulary validated by CompareAudit validator |
| 5 | Transfer feature | DONE | `compare/transfer-planner.js`, `apply/transfer-apply.js` | Transfer preview table, approve/reject, apply → download | benchmark T6.x/T7.x: FILL_BLANK block, approved-only apply, rollback rows |
| 6 | Conflict resolver | DONE | `compare/compare-engine.js` manual overrides (LINK/REJECT re-run) | Selection panel: Link candidate / Reject match; conflict table rows clickable | connectors test: AMBIGUOUS rows produce CONFLICT_CONNECTORs linked to diff rows |
| 7 | Duplicate handling | DONE | `adapters/canonical-graph-builder.js` short/zero consume + packet re-attach | Normalization audit tables (consumed rows) | benchmark T1.2/T1.3: 23 raw → 20 canonical, 3 consumed, packets preserved |
| 8 | Data cleaning/normalization | DONE | same as 7 + sentinel cleaning in `adapters/inputxml-adapter.js` | Raw vs canonical counts on dashboard; "canonical normalization" toggle (raw when off) | benchmark parse counts; sentinel handling exercised by real-schema fixtures |
| 9 | Pivot/summary comparison | DONE | `ui/workbench3d-tab.js` `pivotSection` (derived from diff rows) | Pivot card: line × status matrix, counts click-isolate in 3D | counts derive from the same diff rows covered by reconciliation test |
| 10 | Transfer preview audit | DONE | `compare/transfer-planner.js` rows (old/new/rule/confidence/reason/approval/blockedReason) | Transfer table + per-object before/after list in selection panel | benchmark T6.x; transfer CSV exporter |
| 11 | Reconciliation summary | DONE | `compare/compare-engine.js` summary counts | Dashboard tiles tied to visible objects via status filters | benchmark: source/target objects each appear in exactly one diff row; counts reconcile |
| 12 | Rule-based alerts | DONE | `ui/workbench3d-tab.js` `buildAlerts` (registration residual, ambiguity, weak match, geometry conflict, evidence conflict, missing, blocked transfer, unmatched paths) | Rule alerts card with severity badges + "Show in 3D" | alert inputs are audit fields asserted in benchmark/connectors tests |

## B. Visual requirements

| ID | Visual requirement | Status | Evidence |
|---:|--------------------|--------|----------|
| V1 | Source ghost overlay | DONE | grey transparent source materials; opacity slider |
| V2 | Target active model | DONE | separate `targetGroup`; never merged with source |
| V3 | Status-based colors | DONE | `STATUS_STYLES` single source of truth; legend |
| V4 | Side-by-side synced camera | DONE | single camera, scissor split render |
| V5 | Side-by-side synced selection | DONE | `setSelection` highlights object + matched counterpart in both halves |
| V6 | Difference-only mode | DONE | `diff-only` mode hides unchanged/ghosts |
| V7 | Object picking | DONE | raycaster → canonical objectId (connectors test: id mapping) |
| V8 | Matched-object highlight | DONE | emissive highlight of selection + related ids |
| V9 | Visual connectors (5 classes, audit-linked) | DONE | `viewer/connector-model.js` + connector layer; hidden by default, per-mode/selection visibility, hover tooltip with reason + audit row id; connectors test validates audit links |
| V10 | Path review mode | PARTIAL | Path alignment audit table (MATCH/INSERT/DELETE/SPLIT/MERGE) + hierarchy path isolate incl. matched counterparts. PENDING: dedicated station-lane visual |
| V11 | Transfer preview highlight | DONE | TRANSFER_CONNECTORs (ready/pending/blocked colors) + selection highlight of receiver |
| V12 | Fit all / fit selected | DONE | toolbar + `fitObject` on selection |
| V13 | Axis/grid/origin/registration display | DONE | grid + axes helpers; registration anchors connector mode; residual warning banner + dashboard tiles |

## C. Contracts

| Contract | Status | Where |
|----------|--------|-------|
| CanonicalObjectGraph.v1 | DONE | `contracts/contracts.js` validator; built by `adapters/canonical-graph-builder.js` |
| VisualGeometryModel.v1 | DONE | validator + `adapters/visual-model-builder.js` |
| GeometryBufferStore.v1 | DONE (build+validate) | `adapters/geometry-buffer-store.js`; PENDING: viewer instanced consumption (Phase 9) |
| MatchCandidate.v1 | DONE | rows in CompareAudit; rejected candidates stay visible |
| ObjectDiff.v1 | DONE | rows in CompareAudit |
| TransferPlan.v1 | DONE | `compare/transfer-planner.js` + validator |
| ConflictLedger.v1 | DONE | rows in CompareAudit |
| ManualOverrideLedger.v1 | DONE | override rows persisted in state + embedded in CompareAudit |
| RegistrationAudit.v1 | DONE | `compare/registration-engine.js` (translation-only; rotation PENDING, residual warning covers it) |
| CompareAudit.v1 | DONE | cross-reference validator (T0.2) |
| ViewerStateSnapshot.v1 | DONE | `viewer.getStateSnapshot()` + validator; PENDING: restore-from-snapshot |
| BenchmarkResult.v1 | DONE | validator; emitted by connectors test |
| ConnectorModel.v1 (extra) | DONE | `viewer/connector-model.js` + audit-link validator |

## D. Phase status

| Phase | Status | Gate evidence |
|-------|--------|---------------|
| 0 contracts + traceability | DONE | this document; contracts test |
| 1 canonical adapter | DONE | benchmark T1.x; real CategorizedInputXML fixtures parse (40/37 elements) |
| 2 viewer shell | DONE | picking→canonical id, fit, separate layers; no matching in viewer |
| 3 overlay / side-by-side / diff-only | DONE | mode buttons + legend + selection sync |
| 4 match engine + explanation | DONE | score/confidence/reason/breakdown/next-best/gap on every row; ambiguity gate |
| 5 connector + layer manager | DONE | 5 connector classes, audit-linked, mode-gated visibility, hover |
| 6 dashboard / reconciliation / alerts | DONE | dashboard + pivot + alerts, all derived from audit rows |
| 7 conflict resolver + transfer preview | DONE | manual link/reject; approval workflow; blocked rows visible |
| 8 apply/export/rollback | DONE | approved-only apply, geometry preservation assertion, rollback ledger, export bundle |
| 9 benchmark hardening / performance | PENDING | large-model thresholds, workers, instancing (GeometryBufferStore ready), memory regression test |
| 10 clash extension | PENDING | ClashRule/ClashResult contracts not started |
| 11 3D dashboard / visual analytics extension | PENDING | heatmap/KPI-card contracts not started |

### Vision-document phases (W1–W6)
| Phase | Status | Evidence |
|-------|--------|----------|
| **W1 drill-down backbone** | DONE | `DrilldownContext.v1` contract + validator; pure `ui/drilldown.js` resolver (severity sort, status/confidence/objectIds/group filters); `ui/preview-drawer.js` Level-2 drawer; KPI tiles, alerts, pivot cells emit contexts; drawer isolate + filtered CSV export. Tests: `workbench3d-drilldown.test.js` (counts reconcile with dashboard); browser: tile→drawer 5 rows == count, row click selects in 3D |
| **W3 node-domain intelligence** | DONE | Revision role + `discoverRevisions` + revision-filtered builds + one-click "Generate Rev pair → compare"; **reference-first key ladder** in node compare (REF → support id → spatial; unique-key gate; HIGH confidence; survives moves beyond spatial tolerance); `remarks-classifier.js` (7 flags incl. LINE_NO_CHANGED / DELETED_SUPPORT / INVALID_ROW) → FLAGS props + row reasons + alert; `load-cases.js` (rank-based Fx/Fy/Fz grouping, LC props + resultants, `loadDeltaBetween`) → loadDeltaPct on rows, LOAD_CHANGED alert, dashboard tiles; REVISION/REMARKS/FLAGS excluded from property diff. Tests: `workbench3d-noderevision.test.js` (PS-27161 scenario: 5 key-matched, .5 deleted, load Δ 25%); browser: full one-click Rev1→Rev5 run |
| **W2 dashboard tab shell** | DONE | Dashboard view in switcher; `ui/dashboard-view-models.js` (pure: KPI strip Total/Matched/Added/Deleted/Changed/Review, severity-ordered review queue incl. critical-load ≥25%, group×status heatmap with line/parent/tag group-by, top exception cards, auto visual-mode rule) + `ui/dashboard-panel.js`; every widget emits DrilldownContext → W1 drawer. Tests: `workbench3d-dashboard.test.js` (KPI/queue filters resolve to their displayed counts; heatmap cell sums == diff rows; cards exclude unchanged); browser: rev-pair data → KPIs 6/5/0/1/5/0, queue 5 groups, parent heatmap PS-27161/62, cell→drawer 4 rows, KPI→drawer 1 row |
| **W4 node support workspace visuals** | DONE | `ui/node-workspace-view-models.js` (pure: 2.5D East/North map, parent→child support tree, load matrix over LC*_R cases, support-type flow links, ambiguity match matrix) + `ui/node-workspace-panel.js` (mode-tab board in Dashboard, node-wise only); `availableNodeViews` hides empty modes; every item emits DrilldownContext → W1 drawer. Tests: `workbench3d-nodeviz.test.js` (map point per row, tree reconciles rows, load Δ 33%, flow same/removed/added counts, ambiguity matrix); browser: rev-pair → 4 modes (matrix hidden, no ambiguity), 6 map nodes, 5 hot load cells, flow REST→REST/GUIDE→(removed), map/load click → drawer |
| **W5 full evidence layer** | DONE | `ui/evidence-view-models.js` (pure: Level-3 Source A / Target B / Delta / Basis / Raw-traceability model with NODE_SUPPORT / XML_ELEMENT / GENERIC domain templates; connector ledger model) + `ui/evidence-panel.js` (modal overlay + ledger card). Opened from drawer rows and connector-ledger rows; changed fields highlighted; actions reuse manual-link/reject; evidence + ledger CSV export. Role-map audit (`ui/role-map-audit.js`) shows detected field→universal-role per domain with an editable **ignore-in-diff** toggle threaded into both compare engines. Tests: `workbench3d-evidence.test.js` + `workbench3d-profiles.test.js` (role-map ignore excludes a prop from the diff); browser: ledger→overlay "PS-27161.1 ↔ PS-27161.1", 4 changed fields, traceability, reject action |
| **W6 setup wizard + profiles** | DONE | `core/profiles.js` (pure: XML_ELEMENT/NODE_SUPPORT/MTO/SALES/GENERIC with universal-term labels, role hints, header/schema auto-detect); `tablexml/measures.js` (generic measure props + delta) wired through builder → node compare (measureDeltaPct/measureChangedElements, coordinate-less tables laid on a synthetic grid, matched by key); profile-aware `suggestRoles`; `ui/setup-wizard.js` (5-step Sources→Roles→Grain→Relationships→Workspace banner routing to existing views + profile picker). MTO/Sales = profiles over the same node engine. Tests: `workbench3d-profiles.test.js` (profile detection, MTO qty-delta end-to-end matched by item code, wizard step model, role-map ignore) |
_(W6 delivered — see the W6 row above.)_

### End-to-end platform verification (2026-07-11)
- `npm run test:workbench3d` — 14 workbench test files green; full `npm test` green (no regressions in the 300+ existing tests).
- Node E2E driver (`scratchpad/e2e-platform.mjs`) — 39 assertions across **XML element** (real 40v37 sample files), **node-support** (Rev1→Rev5 register, key-matched, load deltas, remark flags), and **MTO** (coordinate-less, matched by item code, qty delta) domains, through every W1–W6 view-model layer.
- Browser (dev server) — wizard banner + 5 steps + profile picker render and auto-hide at completion; role-map audit renders with working ignore-in-diff toggle that re-runs compare; drill-down drawer, dashboard, node board, and evidence overlay all verified in prior turns; no console errors.
- **Known dev-server caching note:** workbench sub-modules are imported by unversioned relative paths, so a long-lived browser session can serve a stale copy of a shared module after a code change (observed once for `column-mapper.js`'s new `profileHints` arg — proven correct via cache-busted import + Node E2E). A fresh page load / real deploy revalidates. If cross-deploy staleness becomes a concern, version the internal imports.

## E. Settings, panels, Table-to-XML, node-wise compare (2026-07-11 extension)

| Feature | Status | Source module | UI evidence | Test evidence |
|---------|--------|---------------|-------------|---------------|
| Settings persistence (single `wb3d.settings.v1` key) | DONE | `core/wb3d-settings.js` | ⚙ Settings popup; survives reload | settings test: roundtrip, clamp, corrupt-fallback |
| Tooltip/marker packet-kind checkboxes (dynamic) | DONE | `discoverPacketKinds` + `packetKindVisible` | settings popup section 1; filters tooltips + markers | settings + visual-markers tests |
| Per-status color + alpha (all 12 statuses) | DONE | `effectiveStatusStyles` + viewer `setStatusStyles` (material pool rebuild) | 12 color+alpha rows; legend/dashboard recolor live | settings test; browser: custom #00ffcc in legend |
| Packet marker placement From/To/Mid/Text | DONE | `adapters/visual-model-builder.js` `resolvePacketPosition` | settings select; ⚠ fallback flag in hover tip | visual-markers test: all 4 modes, global NODE lookup, fallback |
| Node-wise resolver + node spheres + click panel | DONE | `adapters/node-resolver.js` (`PACKET_NODE_RULES`, `buildNodeInfoIndex`) | "render all nodes" toggle; node click → node info panel | visual-markers test: degree/connected/packets-per-node |
| Block-wise collapsible right panel | DONE | `adapters/block-grouper.js` + `ui/block-inspector.js`; adapter retains categorized blocks | selection panel "Blocks" (Name / Restraint [1][2]…, sentinels hidden) | visual-markers test: pseudo + retained blocks |
| Floating panels (move/collapse/on-top, column picker, persisted) | DONE | `ui/floating-panels.js` + `ui/panel-view-models.js` | 3 toggle buttons; drag persists x/y; ⚙ column picker | settings test (view-models/filters); browser: drag saved 188/230 |
| Panel 1 Object diff (icon filters status+confidence, stripped ids) | DONE | `objectDiffPanelRows` + `applyPanelFilters` | chips filter 40→4 rows in browser | settings test |
| Panel 2 Conflicts (kind+status filters) | DONE | `conflictPanelRows` (status joined via diffId) | chips + stripped detail | settings test |
| Panel 3 Approval override | DONE | `approvalPanelRows` + `approve-element` action | per-row ✔/✖ + "✔ all"; feeds TransferPlan approvals | browser: 1 row approved, blocked rows refuse override |
| Table-to-XML sub-tab (view switcher) | DONE | `ui/table-to-xml-tab.js` | header Compare / Table to XML switcher | browser end-to-end |
| Table parsing (reuse) | DONE | `parseTableSource` (table-categorizer) | Load card diagnostics | tablexml test: formats 1/2/5 |
| Text-to-number smart extraction | DONE | `tablexml/text-to-number.js` (data-driven rules) | live preview column; unit override select | tablexml test: `E 3000mm`, `2in`, `4"`, `106500mm`, metre columns, negatives |
| Column role detection + assignment | DONE | `tablexml/column-mapper.js` `suggestRoles` | role selects + Auto-detect | tablexml test: psE/rawX/CO-ORDINATE(X)(m) heuristics |
| Grouping resolver (duplicate coords, `|` concat) | DONE | `tablexml/grouping-resolver.js` (reuses `assignCoordinateCluster`) | Detect duplicates → clusters + basis chips | tablexml test: 4 rows → 3 nodes, `PS-02|PS-02B` |
| Visual graph/mapping builder | DONE | SVG two-column node-link canvas in `table-to-xml-tab.js` | click port→port connect, click edge remove; synced with role table | browser: 17 ports, 6 auto edges |
| Dynamic/editable field ports | DONE | `column-mapper.js` `dynamicFields`/`fieldIdForColumn` | right column = base fields + one port per named Prop + user "+ Add field" (dashed) / remove chips; hint before parse | tablexml test: prop:SCOPE port, custom prop:SCHEDULE, edges target named ports; browser: SIZE→Prop:SCHEDULE via ports |
| Auto-parse on paste + role preservation | DONE | `autoParseActiveTable` (600ms debounce, paste-sized delta gate); `reparse` keeps roles/units/props/grain for surviving columnIds | paste → columns appear without clicking Parse | browser: autoParsed=true, 11 column ports |
| Exploded support-point grain (vision doc §Appendix C) | DONE | `NODESET_GRAINS`, `nodeset-builder.js` explode path (child-list × support-type × reference zipped by index, PARENT/REF props, length-mismatch warning) | Grain select in card 3; child-list/child-ref roles auto-detected from "PIPING PRIMARY SUPPORT (REFERENCE)" | tablexml test: 2 rows → 5 support points, LINE-STOP zip, PARENT/REF props; browser same |
| NodeSet XML schema + adapter | DONE | `tablexml/nodeset-builder.js` + `adapters/nodeset-adapter.js` (`nodeset/v1`, graphKind) | generate/download/Load into compare | tablexml test: build→serialize→parse→graph passes contract |
| Node-wise compare engine | DONE | `compare/node-compare-engine.js` (spatial grid, ambiguity gate, positionDeltaMm, full CompareAudit envelope) | auto-routes when both sides nodeset | nodecompare test: exact/moved/missing/new/ambiguous/manual-link/reconciliation |
| Heatmap by position delta | DONE | `viewer/heatmap.js` + viewer `setColorOverrides` | settings toggle + max Δ | nodecompare test: ramp endpoints, both sides colored |
| Node hover before/after tooltip | DONE | `objectHoverTooltipLines` + viewer `onHoverObject` | hover tip over elements/nodes | settings test: packet allowlist respected |
| Canvas ✓/✗ approval overlay | DONE | viewer `worldToScreen`/`onCameraChange` + tab overlay | ✓/✗ above selected matched node | browser: approve 1 row; BLOCKED rows correctly refused |

## F. Known limitations (explicit)

- Registration estimates translation only; rotated models are reported via residual warning, not auto-rotated.
- Path review is table + isolate, not a dedicated station-lane visual.
- Connector hover requires the connector to be visible in the active mode.
- Side-by-side uses one shared camera (by design); independent-camera sync is not offered.
- ViewerStateSnapshot is export-only (no restore yet).
- Duplicate handling covers short/zero elements and node aliasing; exact duplicate-record detection (same FROM/TO twice) surfaces as a path/topology effect, not a named audit row.
