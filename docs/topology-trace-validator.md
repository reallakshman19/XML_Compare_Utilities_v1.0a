# Topology Trace Validator

## Purpose and authority

Topology Trace Validator is a browser-only, read-only utility under **Utilities**. It independently checks the evidence chain:

```text
managed source JSON → canonical topology → trace ledger → topology InputXML
```

The source JSON, canonical topology JSON, trace-ledger JSON, and optional topology InputXML remain authoritative. `TopologySvgViewModel.v1`, SVG paths, DOM attributes, filters, and selections are projections only. The utility does not import or call the 3D_Converters topology builder and does not repair missing IDs, axes, connections, or ledger references.

## Required artifacts

The primary workflow requires one selection:

1. Select **Load Source JSON · Auto artifacts**.
2. The utility resolves the matching canonical topology, trace ledger, and topology InputXML by filename.
3. Validation runs automatically after the required companions load.

For `1885_NC.json`, the expected companions are `1885_NC.canonical-topology.json`, `1885_NC.topology-trace-ledger.json`, and `1885_NC.topology.input.xml`. Discovery checks a `topologyArtifactBase` query parameter first, the sibling `3D_Converters/Benchmarks/<source-stem>/` static path second, and a colocated `topology-artifacts/<source-stem>/` path third. It reads producer artifacts only and never runs the production topology builder.

The remaining toolbar controls are manual recovery options when a static host does not expose the companions:

1. **Load Canonical Topology** — required `CanonicalTopology.v1` JSON.
2. **Load Trace Ledger** — required `TopologyTraceLedger.v1` JSON.
3. **Load Topology InputXML** — optional for the first phase.

Manual loading still requires **Validate** after files 1–3 are loaded. If InputXML is absent, every output/projection gate is reported as `NOT_EVALUATED`, never passed.
If InputXML is loaded but contains no component-aware projection lineage, general XML graph checks may run while `componentInputXmlStatus` remains `NOT_EVALUATED`; component gates are not fabricated from generic elements.

## Producer contracts

The validator preserves producer IDs and does not create engineering identities. Source JSON may carry IDs directly, or `TopologyTraceLedger.v1` may carry the producer-owned `sourceIdentity` and `sourcePorts` manifest derived by 3D_Converters from `SourceEnvelope.v1` / `UniversalSourceGraph.v1`. The validator binds that manifest to exact source paths in a new immutable read model, checks conflicts and duplicates, and leaves the original JSON unchanged. A genuinely missing ID receives only an internal `viewKey` and remains a blocking finding.

`CanonicalTopology.v1` uses these collections:

```json
{
  "schema": "CanonicalTopology.v1",
  "nodes": [{ "id": "N1", "position": { "x": 0, "y": 0, "z": 0 }, "sourcePortIds": ["PORT-1"] }],
  "edges": [{ "id": "E1", "fromNodeId": "N1", "toNodeId": "N2", "sourceEntityIds": ["SRC-1"], "sourceTypes": ["VALVE"] }],
  "pointFeatures": [],
  "junctions": [],
  "boundaries": []
}
```

`TopologyTraceLedger.v1` has one final record per semantic source entity:

```json
{
  "schema": "TopologyTraceLedger.v1",
  "records": [{
    "id": "L1",
    "sourceEntityId": "SRC-1",
    "sourcePath": "$[0].children[0]",
    "sourceType": "VALV",
    "sourceRef": "VALVE-1",
    "primaryDisposition": "EMIT_INLINE_COMPONENT_EDGE",
    "operation": "emit-inline-component",
    "canonicalNodeIds": ["N1", "N2"],
    "canonicalEdgeIds": ["E1"],
    "inputXmlElementIds": ["PE-1"],
    "inputXmlChildIds": [],
    "affectedSourceEntityIds": [],
    "projectionCardinality": "ONE_TO_ONE",
    "deferredProperties": ["RIGID", "WEIGHT", "MATERIAL", "PROCESS"],
    "lossClassification": "LOSSLESS_TOPOLOGY",
    "evidence": { "geometryAuthority": "APOS_LPOS" },
    "status": "ACCEPTED"
  }]
}
```

Allowed primary dispositions are `EMIT_ROUTE_EDGE`, `EMIT_INLINE_COMPONENT_EDGE`, `EMIT_BEND_EDGE_SET`, `EMIT_POINT_FEATURE`, `EMIT_TEE_JUNCTION`, `EMIT_OLET_JUNCTION`, `SPLIT_HEADER_AT_JUNCTION`, `MERGE_IN_CII_PROJECTION`, `DEFER_SUPPORT`, `EXTERNAL_BOUNDARY`, and `BLOCK_AMBIGUOUS`.

Allowed projection cardinalities are `ONE_TO_ONE`, `ONE_TO_MANY`, `MANY_TO_ONE`, `POINT_ONLY`, `JUNCTION_ONLY`, `DEFERRED`, and `BLOCKED`. The validator requires the full ledger benchmark field set even when an ID collection is empty. It does not infer a missing field from coordinates or neighboring records.

## Component-aware topology policy

Topology-only InputXML is component-aware, not PIPE-only. The validator independently enforces these producer mappings without creating them:

| Source category | Canonical evidence required | InputXML evidence |
| --- | --- | --- |
| PIPE | Route edge set; explicit splits are allowed | `PIPINGELEMENT` mapping |
| VALVE, finite FLANGE/GASK/INST | Dedicated component edge retaining source type | Dedicated element or explicit many-to-one merge |
| REDUCER | Dedicated transition edge; guessed diameter authority is rejected | `PIPINGELEMENT` mapping |
| ELBO/BEND | Explicit one-or-many edge set | One-or-many mapped elements |
| TEE | TEE junction with run-in, run-out, and branch/boundary evidence | Common node connectivity |
| OLET | OLET tap junction; internal header split IDs when applicable | Common tap node connectivity |
| Point/zero-length object | Point feature or blocked disposition | No zero-length element |
| SUPPORT | `DEFER_SUPPORT` only | No topology element |

A finite inline object cannot be silently retyped as generic PIPE. A gasket may merge only in the later CII projection: its canonical edge and individual source lineage must remain. Direct and explicit many-to-one vector checks are evaluated independently. Review symbols and their DOM attributes remain non-authoritative.

## Independent checks

The validator calculates source inventory and reference resolution directly from the managed source. It checks duplicate/missing identities, required ledger fields, primary-disposition and projection-cardinality semantics, component-type retention, finite/point policy, explicit split/merge evidence, source/canonical/InputXML referential integrity, source-port and source-component ancestry, orphan topology objects, edge endpoints, self-edges, node and junction degree, connected-component counts, child projection ancestry, and direct/merged canonical-to-InputXML vectors.

The documented vector tolerance is **0.5 mm Euclidean residual**:

```text
residual = length((canonical end - canonical start) - InputXML delta)
pass when residual ≤ 0.5 mm
```

Source coordinates are retained as finite decimals. Coordinates are not rounded to form identities. A point with a missing axis is invalid geometry and remains visible through findings; the missing axis is not replaced with zero.

## SVG modes

- **Spatial Overlay** provides XY, XZ, and YZ auto-fit projections.
- **Source ↔ Canonical** renders lineage lanes and disposition-specific connectors.
- **Junctions / Boundaries** shows branch and CREF/HREF/TREF relationships.
- **Issues Only** renders exactly one SVG issue object per findings-table row. When the blocking count is zero it displays `No blocking topology issues`.

Click selection follows immutable lookup groups across source geometry, canonical objects, ledger rows, and InputXML projection rows. Wide transparent hit paths make thin source and canonical lines selectable without becoming topology data. Drag pans the fixed SVG viewBox, the wheel and `+`/`−` controls zoom around the pointer or viewport centre, and **Fit**/the `0` key restores the original view. These interactions change browser coordinates only. Synthetic `CREF_BRANCH_CONNECTION` spans remain traceable but are excluded from the default spatial view and its auto-fit bounds; **Reference connection spans** displays them explicitly. Labels are off initially and remain available through the Labels toggle.

The validated workspace opens at **All branches**; it does not silently select the first branch. NAME, REF, and source-path searches operate across the branch tree, but typing changes only the immutable search slice, result list, and match status; it does not reconstruct the spatial SVG. The current SVG scope and auto-fit bounds remain unchanged. Selecting a result explicitly focuses its owning branch, enables branch-level component symbols, highlights its lineage, and opens the normal inspector. This prevents broad queries such as `PS-12` from replacing the spatial view with thousands of deferred-support markers.

Spatial Overlay includes a `Show component symbols` toggle. It is on for the selected branch and off when the full model is selected. The Summary tab contains ten component-accountability cards and a completion scorecard. Source Disposition contains the full component contract, including a view-only `Focus in SVG` action.

## 1885_NC fixture

The acceptance test reads the real fixture without copying or modifying it:

```text
F:\CODE-5\3D_Converters\Benchmarks\1885_NC\1885_NC.json
```

Run:

```powershell
npm run test:topology-validator
```

The test verifies 278 branches, 4,320 children, 2,939 route components, and 1,381 supports. The route total independently reconciles as PIPE 880 + GASK 599 + FLANGE 571 + ELBO/BEND 351 + VALVE 203 + TEE 148 + INST 77 + OLET 58 + REDUCER 52 = 2,939. It also calculates 44 finite and 33 point instruments from exact source geometry, verifies 203 resolved CREF relationships, 416 HREF/TREF references, 391 internally resolved HREF/TREF references, and reports all 25 external-reference source paths.

Generate the real producer artifacts from `3D_Converters`:

```powershell
node scripts/build-component-topology-artifacts.mjs --input Benchmarks/1885_NC/1885_NC.json --output-dir Benchmarks/1885_NC
```

This produces:

```text
1885_NC.canonical-topology.json
1885_NC.topology-trace-ledger.json
1885_NC.topology.input.xml
```

The real acceptance result is 3,409 canonical nodes, 3,429 canonical edges, 63 point features, 206 junctions, 28 boundaries, and 3,429 topology InputXML elements. All 4,598 branch/component entities and 12,634 component/branch coordinate ports receive producer identities through the ledger manifest. Source disposition, canonical node ancestry, canonical edge ancestry, and InputXML element ancestry are 100%; silent drops, orphan objects, zero-length InputXML elements, vector mismatches, connectivity mismatches, and blocking issues are zero.

The 28 boundaries comprise the 25 externally unresolved HREF/TREF relationships plus three TEE branch ports with no CREF, explicitly classified as external or unmodeled rather than hidden. The source has 44 finite instruments that exactly overlap an `AUTO_GENERATED_PIPE` carrier span. 3D_Converters records these as 44 shared canonical/InputXML elements and 88 explicit `MANY_TO_ONE` ledger participants; neither source record is silently absorbed. One `$[113]` branch-head relationship has a 0.502 mm source residual. It is retained as a non-blocking producer diagnostic under the documented 1 mm source-connection precision allowance; canonical-to-InputXML vector validation remains at 0.5 mm.

## Static hosting

All production modules are ES modules with relative imports. Source loading uses browser `File.text()` and companion discovery uses static HTTP `fetch()`. There is no application server, database, token, Node production API, runtime shim, CDN dependency, or editing command. The utility is compatible with GitHub Pages when producer artifacts are published at the sibling or configured static URL. Browser security does not expose arbitrary sibling files from a local file-picker selection, so a local static host must serve the companions or the user must use the manual recovery controls.
