# Workbench3D Table → NodeSet XML Work Pack checks

Evidence date: 2026-07-13

## Baseline and classification

- Baseline `main`: `c4f69a7bb13de12589f0675b78ab7e3b95511ab0`
- Branch: `agent/workbench3d-tablexml-audit-fix`
- Pull request: `#271`
- Live output contract: `nodeset/v1`
- Purpose: `comparison-only`

This route is not a CAESAR II InputXML producer or mutator. The live output is consumed by `nodeset-adapter.js` and routed to the Workbench3D node compare engine as `CanonicalObjectGraph.v1` with `graphKind="nodeset"`.

## Delivered authority corrections

1. NodeSet XML declares `purpose="comparison-only"`.
2. NodeSet XML declares `coordinateMode="source"` or `coordinateMode="synthetic-comparison"`.
3. NodeSet XML declares `diagnosticsSchema="workbench3d-tablexml-diagnostics/v1"`.
4. Coordinate-less MTO, sales and other non-spatial tables retain the compatibility grid, but the grid is explicitly identified as derived comparison layout rather than source geometry.
5. Non-empty ignored columns are recorded before their values are omitted.
6. Missing node identifiers and duplicate-id suffixes are recorded with source row and emitted identifier.
7. Rows with unusable mapped coordinates are skipped with structured evidence; they are not changed to the origin.
8. Bore reads and unparseable bore omissions are recorded with source column, raw text and extraction rule context.
9. Revision filtering and coordinate grouping record source, working and emitted counts.
10. Exploded child/type/reference lists record both support-type and reference cardinality mismatches, including missing and dropped values.
11. Support reads, emitted nodes, zero-node output and final output readiness are recorded.
12. UI and download wording now states `NodeSet XML (comparison-only)` and explicitly says the route does not generate CAESAR II InputXML or `PIPINGELEMENT` records.
13. The UI exposes a collapsible diagnostics ledger and downloadable `<side>_workbench3d_table_to_xml_diagnostics.json` artifact.

## Diagnostics contract

Schema:

```text
workbench3d-tablexml-diagnostics/v1
```

Record fields:

```text
severity, code, message, module, stage, action,
sourceName, sourceRowId, sourceColumnId, outputField,
nodeId, count, context
```

Representative codes:

```text
TABLEXML_COLUMN_IGNORED
TABLEXML_REVISION_FILTER_APPLIED
TABLEXML_ROWS_GROUPED
TABLEXML_GROUPING_CONFLICT
TABLEXML_SYNTHETIC_COORDINATES
TABLEXML_NODE_ID_GENERATED
TABLEXML_NODE_ID_DUPLICATE_SUFFIXED
TABLEXML_ROW_SKIPPED
TABLEXML_BORE_READ
TABLEXML_BORE_OMITTED
TABLEXML_SUPPORTS_READ
TABLEXML_EXPLODED_TYPE_COUNT_MISMATCH
TABLEXML_EXPLODED_REF_COUNT_MISMATCH
TABLEXML_ZERO_NODES
TABLEXML_NODESET_READY
```

## Focused and repository verification

Permanent workflow: `Workbench3D TableXML`

Green pre-evidence run: `29266390923`, head `fe839611f27f8e0c74630b76dc844db1ac5cc315`.

Passed jobs:

- `Focused NodeSet authority gate`
  - temporary patch tools absent;
  - new modules below 300 lines;
  - JavaScript syntax checks;
  - comparison-only classification;
  - root-purpose and coordinate-provenance attributes;
  - synthetic coordinate disclosure;
  - ignored columns;
  - generated and suffixed identifiers;
  - invalid coordinate row skips;
  - bore provenance;
  - exploded type/reference mismatch evidence;
  - diagnostics sidecar and UI contracts;
  - existing TableXML and profile compatibility tests;
  - full `npm run test:workbench3d`.
- `Named Workbench3D base vs head ledger`
- `Full repository regression gate` using `npm test`.

## Named baseline ledger

Artifact: `workbench3d-tablexml-baseline`, artifact ID `8285567214`.

- Base Workbench3D test files: `14`
- Head Workbench3D test files: `15`
- Base failing names: `0`
- Head failing names: `0`
- Regressions: `0`
- Removed tests: `0`
- Improvements: `0`

The added `tests/workbench3d-tablexml-authority.test.js` passes.

## Recovery and temporary-tool discipline

Immutable recovery manifest:

```text
.backups/20260713_workbench3d_tablexml_workpack_backup.json
```

The temporary exact-patch script and workflow are absent from the final branch tree.

## Explicitly unchanged

- no CAESAR II InputXML writer;
- no PSI116 adapter;
- no changes to piping XML/InputXML detection or parsing;
- no node-compare scoring change;
- no transfer-plan or apply change;
- no runtime, writer, viewer or canvas switch;
- no removal of the non-spatial synthetic comparison layout;
- no frozen benchmark update.
