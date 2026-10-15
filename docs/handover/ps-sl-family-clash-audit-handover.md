# PS / SL Family Clash Audit — Engineering Handover

## 1. Purpose and current capability

The PS / SL Family Clash Audit converts two Navis clash XML inputs into a structured SupportChangeXML evidence model:

1. **StructureGroup vs Supports XML** — establishes structure-to-support contact evidence.
2. **Clash within Supports XML** — establishes support-to-support continuity evidence.

The utility detects configurable support-family roots, classifies structural and support objects, builds support groups and connectivity, derives line and structure hierarchies, identifies exceptions, and exposes both stable deliverables and review-grade reports.

The workspace currently provides:

- Input, Preview, Config, Run Audit, Reports, and Export Package surfaces;
- six engineering report groups;
- report search and horizontal scrolling;
- sticky table headers and keyboard-focusable report regions;
- direct report CSV export;
- stable export previews and ZIP packaging;
- configurable family prefixes, structural zones, support zones, source side, source-family override, and POS tolerance.

## 2. Structured report model

The six report groups are:

### Support Group

- SupportGroup Summary
- Support Chain Report — Review
- Support Members — Review

### Structure Group Basis

- StructureGroup Line Support Proximity Basis
- Structure Contacts — Review

### Line Tree

- Line Tree

### Structure Tree

- Structure Tree
- Input Evidence

### Clash Summary

- SupportGroup Summary
- Connectivity Matrix — Review
- Clash Detail Rows — Review

### Clash Audit Outcome

- SupportChange Exceptions
- Diagnostics

`SupportGroup Summary` is intentionally cross-listed under Support Group and Clash Summary because it is both the support-group inventory and the high-level clash rollup.

## 3. Architectural map

### UI orchestration

- `tabs/ps-family-clash-audit/ps-family-clash-audit-tab.js`
  - mounts the launcher and modal workspace;
  - owns workspace-tab, report-group, report-selection, search, full-screen, run, and export state;
  - connects file input, sample loading, readiness, audit execution, report rendering, and package downloads.
- `ps-family-clash-audit-professional-ui.js`
  - report-hub layout, responsive behavior, table scrolling, sticky headers, and professional visual treatment.
- `ps-family-clash-audit-view.js`
  - report renderer registry;
  - search filtering;
  - stable HTML table wrapper with accessible scroll regions;
  - summary and readiness views.

### Configuration and ingestion

- `ps-family-clash-audit-config.js`
  - application labels, report catalog, report maturity, inputs, defaults, and packaged exports.
- `ps-family-token-utils.js`
  - configurable PS/SL family-root detection and token normalization.
- `ps-family-clash-audit-file-io.js`
  - text-file ingestion.
- `ps-family-clash-audit-samples.js`
  - official sample inputs for smoke and acceptance workflows.

### Audit construction

- `ps-family-clash-audit-actions.js`
  - creates readiness and audit results from UI text inputs.
- Core parser, classifier, graph, hierarchy, grouping, proximity, and exception modules under `tabs/ps-family-clash-audit/`
  - parse clash objects and paths;
  - classify line, support, and structural evidence;
  - normalize family roots and line identities;
  - build support-support and structure-support edges;
  - derive support groups and representatives;
  - create line/structure reports and SupportChange exceptions.

### Export

- `ps-family-clash-audit-export.js`
  - stable CSV, text, and JSON generators;
  - active-report export mapping;
  - direct CSV conversion for every visible report, including Line Tree and Structure Tree.
- `ps-family-clash-audit-save.js`
  - browser file download and ZIP package generation.

## 4. Data flow and invariants

```text
StructureGroup vs Supports XML
  -> parsed clash evidence
  -> structure/support classification
  -> structure-to-support edges

Clash within Supports XML
  -> parsed clash evidence
  -> support/support classification
  -> support-chain edges

Both evidence sets + configuration
  -> family-root normalization
  -> line/branch attribution
  -> graph construction
  -> connected SupportGroups
  -> representative supports
  -> structure basis
  -> line tree and structure tree
  -> connectivity matrix
  -> SupportChange exceptions
  -> report registry
  -> CSV / JSON / ZIP exports
```

Critical invariants:

- `SupportGroup` is a graph-derived engineering identity, not a display-only label.
- `StructuralGroup` is child evidence attached to a SupportGroup; it must not replace the support representative.
- Support-to-support and structure-to-support edges retain source clash evidence.
- Report rendering and report export must consume the same audit object.
- Review reports may evolve, but stable deliverables require explicit contract changes.
- Family-prefix configuration must affect detection consistently across parsing, grouping, reports, and diagnostics.
- Search changes visibility only; it must not alter audit or export rows.

## 5. Report/export contract

Every report is directly exportable as CSV from the Reports workspace.

Active report export mapping:

- SupportGroup Summary → `supportgroup-summary.csv`
- Support Chain Report → `support-chain.csv`
- Support Members → `support-members.csv`
- StructureGroup Line Support Proximity Basis → `structure-line-proximity.csv`
- Structure Contacts → `structure-contacts.csv`
- Line Tree → `line-tree.csv`
- Structure Tree → `structure-tree.csv`
- Input Evidence → `input-evidence.csv`
- Connectivity Matrix → `connectivity-matrix.csv`
- Clash Detail Rows → `clash-detail-rows.csv`
- SupportChange Exceptions → `supportchange-exceptions.csv`
- Diagnostics → `diagnostics.csv`

The Export Package workspace remains the governed package surface for stable previews, selected deliverables, audit JSON, and the combined ZIP.

## 6. Verification baseline

The repository includes tests for:

- audit engine and configuration;
- report UI smoke and accessibility;
- sample output fixtures;
- active report export;
- hierarchy, filtering, and row details;
- performance benchmark and readiness;
- tabbed workspace and report contracts.

Primary command:

```bash
npm run test:ps-family
```

The complete repository gate is:

```bash
npm test
```

## 7. Known limitations and engineering risks

### In-memory graph construction

The current audit is browser-local and constructs complete evidence collections in memory. Very large clash reports can increase parse time, graph-build time, DOM size, and export-string memory.

### Classification dependence on names and zones

Object classification relies on configurable family prefixes and zone/name tokens. Project naming drift can create false structural/support classifications without a governed profile.

### Report maturity

Support Chain, Support Members, Structure Contacts, Connectivity Matrix, and Clash Detail Rows are explicitly marked Review. Their field semantics need formal stabilization before downstream systems depend on them.

### Duplicate report context

SupportGroup Summary appears in two groups. This is intentional, but analytics or automation must use the report key and active group context rather than label alone.

### Browser-only packaging

ZIP creation and large CSV generation occur in the browser. Large exports can cause peak-memory spikes.

## 8. Implementable improvements

| Priority | Improvement | Implementation approach | Acceptance criteria |
|---|---|---|---|
| P0 | Version report schemas | Define headers, field types, null rules, keys, and maturity for every report. | Each report export declares a schema version and validates before download. |
| P0 | Add run manifest | Hash both XML inputs and normalized config; record schema versions, counts, duration, warnings, and report row counts. | Every ZIP contains a reproducible manifest. |
| P0 | Add classification review | Show every detected family root and object classification before Run, with counts and evidence paths. | Misclassified tokens can be identified before graph construction. |
| P0 | Stabilize Review reports | Document definitions and golden fixtures for chain, members, contacts, matrix, clash detail, and diagnostics. | Each Review report can graduate independently to Stable. |
| P1 | Add graph integrity checks | Detect duplicate nodes, self-edges, disconnected evidence, multi-line group leakage, representative conflicts, and inconsistent edge ownership. | Integrity findings are exported as typed exceptions. |
| P1 | Add project profiles | Import/export governed family prefixes, zone tokens, source-side rules, and tolerances. | A selected profile ID/version appears in the manifest. |
| P1 | Add virtualized reports | Render only visible rows while preserving search, sticky headers, focus, and CSV export from the audit model. | Reports with 100,000 rows remain responsive. |
| P1 | Move audit construction to a Web Worker | Use versioned serializable input/output contracts and progress events. | UI remains responsive during parse and graph build. |
| P1 | Add graph visualization | Provide a focused SupportGroup graph with support, structure, line, and evidence-edge layers. | Selecting a report row focuses the corresponding graph nodes and source clashes. |
| P1 | Add exception triage | Add status, owner, comment, disposition, and exportable review ledger for SupportChange exceptions. | Engineering review state remains separate from computed findings. |
| P2 | Add incremental recomputation | Reuse parsed input and graph stages when only report filters or non-structural config changes. | Re-run avoids rebuilding unaffected stages. |
| P2 | Add service mode | Run large audits in a worker service with immutable input packages and signed outputs. | Browser and service produce contract-equivalent reports. |

## 9. Professional interface roadmap

### Immediate interface refinement

- Keep the six report-group cards in a consistent 3-column × 2-row report catalog on desktop.
- Keep Review badges adjacent to report names, not as separate orphan labels.
- Show active report name, group, row count, maturity, and export action in one header.
- Add column visibility, density, and reset controls.
- Add full-screen mode and preserve Escape-to-exit behavior before closing the dialog.
- Add a small “stable/review” legend.

### Engineering review interface

- Add a right-side evidence drawer for the selected SupportGroup, edge, clash, or exception.
- Add synchronized selection across summary, chain, members, matrix, and clash-detail reports.
- Add saved filters for error severity, family root, line, branch, SupportGroup, and source XML.
- Add row pinning and comparison between two SupportGroups.
- Add “copy report link” using a deterministic local state token.

### Controlled enterprise interface

- Lock governed profile fields while allowing project-authorized overrides.
- Show audit version, profile version, input hashes, and run ID in the header.
- Add review sign-off and export approval state.
- Add accessible high-contrast and print/report themes.
- Preserve stable machine field names even when visible labels are localized.

## 10. Logic roadmap

### Graph model hardening

Introduce explicit contracts:

- `PsFamilyObjectEvidence.v1`
- `PsFamilyEdgeEvidence.v1`
- `PsFamilySupportGroup.v1`
- `PsFamilyStructureBasis.v1`
- `PsFamilyException.v1`
- `PsFamilyAuditManifest.v1`

Each edge should retain:

- source input;
- clash name/ID;
- object identities and paths;
- normalized family/line/branch identities;
- distance and point evidence;
- classification basis.

### Representative support selection

Document and test deterministic representative selection. Recommended ranking:

1. explicit governed support identity;
2. connected support with strongest evidence degree;
3. stable natural-sort identity;
4. deterministic source/path tie-break.

Export the selection basis so the representative is never opaque.

### Exception taxonomy

Maintain a stable typed taxonomy grouped by:

- input/parsing;
- classification;
- graph integrity;
- line/branch ownership;
- SupportGroup construction;
- structure attachment;
- representative selection;
- export/schema validation.

Severity and actionability should be separate fields.

## 11. Scalability strategy

### Target tiers

- **Tier A — normal browser audit:** thousands to tens of thousands of clash rows.
- **Tier B — large browser audit:** hundreds of thousands of rows using workers, compact graph storage, and virtualized reports.
- **Tier C — service audit:** multi-file project workpacks with immutable artifacts, durable review state, and signed exports.

### Required changes for Tier B

1. Parse XML incrementally or in a worker.
2. Normalize strings through intern tables to reduce duplicate memory.
3. Store graph adjacency in compact maps/arrays rather than repeated expanded objects.
4. Partition by line/family before connected-component analysis.
5. Virtualize all report rows.
6. Stream CSV generation.
7. Emit progress and cancellation events.
8. Capture stage timings and peak row/edge counts.

### Service boundary for Tier C

A service implementation should accept:

- two immutable XML inputs;
- normalized configuration/profile;
- expected schema versions.

It should return:

- audit object;
- report CSVs;
- diagnostics and exceptions;
- run manifest;
- source-to-output lineage;
- optional graph projection for UI visualization.

No service result should omit clash-level evidence used to create a SupportGroup or exception.

## 12. Recommended delivery roadmap

### 0–30 days: contract and review hardening

- report schema versions;
- run manifest and input hashing;
- classification preview;
- formal definitions and golden fixtures for Review reports;
- export package inventory;
- column controls and report maturity legend.

### 30–90 days: performance and evidence usability

- Web Worker audit execution;
- report virtualization;
- graph integrity checks;
- selected-row evidence drawer;
- SupportGroup graph visualization;
- exception triage ledger;
- project profile import/export.

### 3–6 months: project-scale operation

- incremental recomputation;
- streamed parsing and exports;
- multi-file workpacks;
- service-assisted execution;
- durable review/sign-off workflow;
- signed result packages and capacity baselines.

## 13. Release and handover checklist

Before changing audit logic:

1. Identify whether the change affects parsing, classification, graph construction, representative selection, report rendering, or export.
2. Add a focused fixture that demonstrates the intended graph and report outcome.
3. Preserve source clash evidence on every derived edge and finding.
4. Update report schema/maturity only through an explicit version change.
5. Verify every visible report remains directly exportable as CSV.
6. Verify the report catalog, horizontal scroll, keyboard focus, sticky headers, and full-screen behavior.
7. Run `npm run test:ps-family` and `npm test`.
8. Compare report row counts and exception counts against the previous release.
9. Record changed configuration defaults and classification rules in release notes.

## 14. Recommended next implementation slice

The highest-value next slice is **Audit Manifest and Report Schema v1**:

- input SHA-256 hashes;
- normalized config/profile snapshot;
- report schema IDs and maturity;
- stage duration and row/edge counts;
- stable run ID;
- all direct report CSVs;
- stable package exports;
- audit JSON;
- one manifest-driven ZIP.

This provides a professional and scalable contract boundary before introducing worker execution or external services.
