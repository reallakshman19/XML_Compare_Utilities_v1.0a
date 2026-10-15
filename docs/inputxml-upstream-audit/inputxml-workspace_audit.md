# InputXML Workspace orchestration audit

Baseline: `f7efffc7a26d63f72e8b33f9dd07608adf37015d`

## Live scope

Primary orchestrator:

- `tabs/inputxml-workspace/inputxml-workspace-tab.js`

Owned flows:

- source node XML → CleanXML;
- manual tables → CleanXML;
- ACCDB/pasted helper tables → sideload text;
- InputXML + sideload text → enriched InputXML;
- CleanXML → Tab 3 XML-to-InputXML panel;
- InputXML ↔ CategorizedInputXML conversion;
- handoff to XML Compare Source/Target.

Shared engines are audited separately. Phase 2 does not duplicate the Phase 1 `XmlCompareSideloadEnricher` audit.

## Findings

### F1 — CleanXML is routed directly into an InputXML-only enrichment engine

The `use-cleanxml-enrichment` action assigns node-based CleanXML to `state.enrichment.inputXmlText`. Tab 2 then calls `applyXmlCompareSideload()`, whose mutation targets are `PIPINGELEMENT` and `RESTRAINT` opening tags. CleanXML contains `Branch` and `Node` records, so this shortcut can complete with no meaningful mutation.

**Correction:** route CleanXML to Tab 3 first. Only a schema-confirmed, non-empty, positive-element InputXML result may be handed to Tab 2.

### F2 — Tab 3 output is not returned to the workspace

The embedded 5C panel stores its result internally and offers download/copy actions, but the InputXML Workspace receives no result callback. The intended CleanXML → InputXML → enrichment flow therefore requires manual download and reload.

**Correction:** add an explicit named `onResult` callback. After a successful 5C build, copy the generated InputXML into Tab 2 and record the element count and detected schema.

### F3 — Workspace inputs are not schema-gated

`detectXmlWorkspaceSchema()` and `XML_WORKSPACE_KINDS` are imported by the workspace but are not used before Tab 2 enrichment. Unknown XML, CleanXML and CategorizedInputXML can be presented to an InputXML mutation action.

**Correction:** reject empty or non-InputXML Tab 2 input with a structured diagnostic. Do not guess or auto-convert an ambiguous input.

### F4 — Stale artifacts survive source changes

Loading a new source XML, enrichment input, ACCDB helper or categorized input does not consistently clear the previously generated downstream output. The UI can therefore display an output produced from an earlier source.

**Correction:** invalidate only the dependent artifacts for the changed source and record what was cleared. Do not reset unrelated workspace configuration.

### F5 — Zero-record operations can report success

Manual-table CleanXML builds, table parsing and sideload generation can produce zero usable rows while still setting success-like status text or an empty XML shell.

**Correction:** block a manual CleanXML build with no branch/node route, and classify zero-row parsing/generation as warning or informational evidence rather than success.

### F6 — Workspace orchestration has no dedicated diagnostics artifact

The workspace uses free-text `status` and `error` fields. Phase 1 diagnostics are available inside the shared sideload result, but the workspace does not record routing, schema decisions, invalidation, zero-record output or the 5C handoff.

**Correction:** add `inputxml-workspace-diagnostics/v1`, a collapsible workspace panel and downloadable `inputxml_workspace_diagnostics.json`.

## Field and route authority

| Workspace output/decision | Authoritative source | Required behavior |
|---|---|---|
| CleanXML build | parsed branch/node tables | require at least one branch and one node route |
| Tab 2 input eligibility | `detectXmlWorkspaceSchema()` | accept only `inputxml` |
| Tab 3 handoff text | `finalInputXmlText`, then `coreInputXmlText` | require InputXML detection and positive element count |
| Sideload mutation details | Phase 1 sideload report | preserve and reference, do not duplicate matching logic |
| stale-output invalidation | changed upstream source | clear dependent artifacts only and diagnose the action |
| categorized handoff | explicit conversion direction/output | no implicit conversion or guessed route |

## Approved Work Pack

1. Add pure workspace diagnostics, orchestration/preflight and diagnostics-view modules.
2. Replace the invalid direct CleanXML → Tab 2 shortcut with a Tab 3 route.
3. Add an explicit 5C result callback and automatic Tab 2 InputXML handoff.
4. Add schema preflight before sideload application.
5. Invalidate dependent stale artifacts on source changes.
6. Block zero-record manual CleanXML output.
7. Extend existing workspace tests with route, preflight, invalidation, diagnostics and UI assertions.

No runtime, writer or canvas switch; no mock production source; no shim; no snapshot/data churn; no unrelated refactor.