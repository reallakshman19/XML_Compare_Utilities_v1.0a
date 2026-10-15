# Workbench3D Table → XML Authority Audit

Audit date: 2026-07-13

Baseline: `c4f69a7bb13de12589f0675b78ab7e3b95511ab0`

Branch: `agent/workbench3d-tablexml-audit-fix`

## Classification verdict

This module is **not** a CAESAR II InputXML producer or mutator.

The live route is:

```text
workbench3d/ui/table-to-xml-tab.js
→ parseTableSource / prepareTableText
→ suggestRoles / createNodeSetMapping
→ resolveGroups
→ buildNodeSetModel
→ serializeNodeSetXml
→ <NodeSet schema="nodeset/v1">
→ nodeset-adapter.js
→ CanonicalObjectGraph.v1 with graphKind="nodeset"
→ node compare engine
```

It does not emit `<CAESARII XML_TYPE="Input">`, `<PIPINGMODEL>`, or `<PIPINGELEMENT>`. It must remain a comparison-only NodeSet exporter. Adding a PSI116/InputXML serializer under the existing button would conflate contracts and is outside this Work Pack.

## Authoritative contracts

1. `workbench3d/tablexml/nodeset-builder.js` defines the current `nodeset/v1` serialization contract.
2. `workbench3d/adapters/nodeset-adapter.js` is the only downstream consumer boundary for this output.
3. Existing Workbench3D table fixtures are regression evidence for parser/mapping behavior, not CAESAR II format authority.
4. Source table coordinates, identifiers, units, tags, support text, load/measure text, revision values, and explicitly mapped properties are authoritative only when present and successfully parsed.
5. Synthetic coordinates, generated IDs, duplicate suffixes, grouping concatenation, and exploded-list zipping are derived comparison decisions and must be disclosed.

## Live field authority matrix

| NodeSet output | Source authority | Transform | Current fallback / loss risk | Required disposition |
|---|---|---|---|---|
| `Node/@id` | first mapped `node-id` column | trim | missing IDs become `N#`; duplicates become `#2`, `#3` silently | keep compatibility, diagnose every generated/suffixed ID |
| `Node/@e,n,u` | mapped coordinate columns or combined coordinate text | numeric extraction, unit scaling, directional sign, 3-decimal output | coordinate-less tables receive fabricated 1000 mm grid | identify as `synthetic-comparison`, never imply source geometry |
| `Node/@bore` | first mapped `bore` column | number extraction; inch NPS→DN lookup | failed extraction silently omits bore; unitless values depend on column override/default | diagnose read, conversion and omission |
| `Node/@tag` | first mapped tag column | trim | additional tag columns become props | disclose primary/additional tag mapping |
| `<Prop>` | mapped prop, load, measure, remarks, revision columns | trim / numeric extraction / classification | ignored columns and failed load/measure extraction are not visible in export evidence | report ignored non-empty columns and field omissions |
| `<Support>` | mapped support-type columns | list split; trailing numeric suffix removed for kind | arbitrary text is accepted as kind; empty/mismatched exploded values can disappear | diagnose support reads and list mismatch/drop decisions |
| model node count | source rows after revision filter/grouping/explosion | grouping or explode | rows can be filtered, grouped, skipped or multiplied | record source→working→emitted counts and row actions |

## Duplicate and alternate paths

- No duplicate NodeSet serializer was found in the live Workbench3D route.
- `parseInputXmlRecords()` can detect both piping XML and NodeSet XML, but `buildNodeSetGraph()` deliberately routes NodeSet to the node compare engine.
- The label “Table to XML” is broader than the actual contract and can be mistaken for InputXML generation. UI wording must state `NodeSet XML (comparison-only)`.

## Fixed-position / bounded structures

There is no CAESAR fixed-array serializer in this path. The high-risk positional structure is exploded grain:

```text
child-list[i] ↔ support-type[i] ↔ child-ref[i]
```

Current behavior zips by index, diagnoses only child/type length mismatch, and can silently omit unmatched references/types. Both type and reference cardinality must be diagnosed, with retained and dropped index evidence.

## Confirmed silent or weakly reported decisions

1. Coordinate-less tables receive a synthetic grid.
2. Missing IDs are generated.
3. Duplicate IDs are suffixed.
4. Non-empty ignored columns disappear from the NodeSet model.
5. Bore parse failure omits `bore` without a dedicated record.
6. Grouping concatenates conflicting source values.
7. Exploded support lists can have child/type/reference cardinality mismatch.
8. Rows with unusable coordinates are skipped.
9. Existing diagnostics are free-text arrays without stable codes, stage, source row/column, action, counts, or downloadable sidecar.
10. Serialized XML does not declare comparison purpose or coordinate provenance.

## Approved Work Pack changes

1. Keep `nodeset/v1`; do not add InputXML output.
2. Add `workbench3d-tablexml-diagnostics/v1` with stable records:

```text
severity, code, message, module, stage, action,
sourceName, sourceRowId, sourceColumnId, outputField,
nodeId, count, context
```

3. Add model metadata for `purpose="comparison-only"` and `coordinateMode="source|synthetic-comparison"` and serialize those root attributes.
4. Diagnose ignored non-empty columns, revision filtering, grouping, synthetic layout, generated/suffixed IDs, coordinate skips, bore omission, support reads, exploded list mismatches, and zero-node output.
5. Preserve existing synthetic-grid compatibility for MTO/Sales/key/measure comparison, but mark it as derived comparison layout in both diagnostics and XML.
6. Add a collapsible diagnostics panel and downloadable `workbench3d_table_to_xml_diagnostics.json` per source/target table.
7. Rename UI and download wording to `NodeSet XML (comparison-only)`.
8. Add focused tests for classification, root metadata, synthetic coordinate disclosure, ignored columns, duplicate/generated IDs, skipped rows, grouping, exploded cardinality, sidecar schema, and UI contracts.
9. Run `npm run test:workbench3d` and full `npm test`; compare failing test names, not counts alone.

## Explicit non-goals

- no CAESAR II InputXML writer;
- no PSI116 schema adapter;
- no changes to piping XML/InputXML parsing;
- no node-compare algorithm change;
- no synthetic-grid removal for non-spatial comparisons;
- no transfer/runtime/canvas switch;
- no frozen benchmark update unless a documented semantic assertion changes.
