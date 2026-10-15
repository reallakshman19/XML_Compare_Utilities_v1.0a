# XML Compare sideload enrichment audit

## Scope

Live callers:

- `tabs/xml-compare-tab.js` — Source A / Target B sideload popup.
- `xml-compare/XmlCompareLinewiseWorkflowActions.js` — Line-wise XML Enrichment popup.
- `tabs/inputxml-workspace/inputxml-workspace-tab.js` — InputXML Workspace ACCDB/manual sideload path.

Shared engine:

- `xml-compare/XmlCompareSideloadEnricher.js`
- `xml-compare/XmlCompareCoordinateSideload.js`

`InputXmlImportRoutes.js` is not an execution boundary for this engine.

## Findings

### F1 — Parsed rows can be silently overwritten

`buildXmlCompareSideloadIndex()` stores LINE_ID, name and restraint-tag rows in `Map` objects. Duplicate keys overwrite earlier rows without recording which row won. This affects exact element pairs and exact/node-type restraint keys.

**Required behavior:** preserve the deterministic last-row-wins result for compatibility, but emit a structured warning containing the key and involved source rows.

### F2 — Valid source rows can remain unapplied without evidence

The existing report counts parsed and applied values, but does not identify individual LINE_ID/name/tag rows that matched no element or restraint. Empty output fields and ignored incomplete rows are also not reported.

**Required behavior:** produce row-level diagnostics for read, applied, skipped, duplicate, ambiguous and unmatched actions.

### F3 — Restraint fallback can hide ambiguity

The restraint path falls back from exact match to node/type and then unique-node matching. A node with multiple candidate tags simply has no node fallback; the reason is not surfaced.

**Required behavior:** report ambiguous node fallback and record which matching tier supplied each applied tag.

### F4 — Attribute mutations are not traceable

`setAttr()` adds or replaces attributes, but the report does not distinguish added, replaced, unchanged or skipped-empty actions.

**Required behavior:** record mutation action, source field, output field, element/restraint identity and previous/new values without changing output semantics.

### F5 — Diagnostics are not a dedicated artifact

The popup footer exposes aggregate counts only. Coordinate diagnostics are mixed into the report and there is no stable sideload diagnostics schema or dedicated JSON download.

**Required behavior:** add `xml-compare-sideload-diagnostics/v1`, a collapsible diagnostics panel and a downloadable `xml_compare_sideload_diagnostics.json` artifact.

### F6 — XML mutation remains regex-based

The engine patches opening tags through regular expressions. This preserves the current byte-oriented behavior but is not a namespace-aware DOM transformation.

**Decision for this Work Pack:** do not refactor the mutation architecture. Add diagnostics and regression coverage only. A DOM migration would be a broad refactor outside this phase.

## Field authority matrix

| Output | Source | Match authority | Existing default | Audit action |
|---|---|---|---|---|
| `PIPINGELEMENT@LINE_ID` | line-id table | exact normalized `FROM_NODE->TO_NODE` | unchanged source XML | diagnose duplicate/unmatched/added/replaced |
| `PIPINGELEMENT@FROM_NAME` | node-name table | exact normalized pair | unchanged source XML | diagnose empty/unmatched/added/replaced |
| `PIPINGELEMENT@TO_NAME` | node-name table | exact normalized pair | unchanged source XML | diagnose empty/unmatched/added/replaced |
| `RESTRAINT@TAG` | restraint table | exact, then node/type, then unique node | unchanged source XML | diagnose tier, ambiguity and unmatched rows |
| global coordinate attributes | Table 4 coordinates + element deltas | coordinate solver, 1 mm tolerance | unchanged source XML | preserve solver diagnostics and add mutation evidence |

## Approved implementation

1. Add a pure diagnostics module with stable record creation, summaries and JSON serialization.
2. Refactor the enricher into readable named functions while preserving public exports and last-row-wins compatibility.
3. Add source-row identity to parsed rows and track consumed rows.
4. Render a collapsed diagnostics table in the existing popup; auto-open when warnings/errors exist.
5. Add a diagnostics download action to both the main sideload popup and the native line-wise workflow.
6. Add focused tests for duplicate rows, unmatched rows, ambiguous tag fallback, mutation actions and UI artifact availability.

No runtime/writer/canvas switch, mock source, shim, generated benchmark update or unrelated refactor is approved.