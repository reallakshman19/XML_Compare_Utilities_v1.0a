# Navis Tag → ISONOTE Utility — Engineering Handover

## 1. Purpose and current capability

The Navis Tag → ISONOTE utility converts Navis comment-tag evidence into auditable support ISONOTE instructions. It combines three evidence sources:

1. Navis XML comments and tag coordinates.
2. Managed staged JSON/ZIP hierarchy and identity records.
3. An optional support table or workbook for table-led resolution.

The current workflow supports direct proximity resolution, coordinate-frame transformation, evidence-led identity selection, `applies to (...)` propagation to parallel pipes, configurable keyword expansion, final CSV generation, diagnostics, and browser-local restoration of configuration and restorable source values.

The current user journey is:

- **Home** — load or restore inputs and inspect readiness.
- **Config** — coordinate frames, source columns, keyword vocabulary, propagation tolerances, and pipe parsing.
- **1. JSON Trace** — staged hierarchy, coordinate grouping, and identity trace.
- **2. Navis Tag Coordinates** — raw Navis values, units, configured offsets, applied offsets, and transformed coordinates.
- **3. Tag ↔ JSON Match** — selected candidate, rejected-nearest evidence, deltas, confidence, and basis.
- **Final Output / Export Results** — final ISONOTE rows and CSV actions.
- **Diagnostics** — parser, index, readiness, matching, and export evidence.

## 2. Architectural map

### Orchestration and browser state

- `tabs/navis-tag-isonote/navis-tag-isonote-tab.js`
  - owns the browser state machine;
  - coordinates parsing, index creation, readiness, resolution, rendering, local persistence, and downloads;
  - invalidates derived evidence when source or configuration values change;
  - rebuilds stale evidence before resolution.

### Contracts and configuration

- `navis-tag-isonote-contracts.js`
  - default configuration;
  - normalization and contract boundaries;
  - coordinate, matching, pipe, and keyword configuration.
- `navis-tag-readiness.js`
  - evaluates whether resolution can run;
  - separates blocking conditions from warnings and information.

### Input ingestion

- `navis-tag-xml-parser.js`
  - parses Navis XML tags and comment evidence;
  - applies unit conversion and configured E/N/EL offsets.
- `navis-tag-table-source.js`
  - parses delimited support tables;
  - normalizes records and exports row arrays to CSV.
- `navis-tag-isonote-ui-io.js`
  - loads XML, text, workbook, JSON, and ZIP inputs;
  - owns browser download actions.

### Staged hierarchy and identity evidence

- `navis-tag-staged-tree.js`
  - builds the staged document hierarchy and support index.
- `navis-tag-index-refinement.js`
  - removes duplicate or mirrored index evidence and refines candidates.
- `navis-tag-resolution-source.js`
  - selects the staged-JSON or support-table resolution source.
- `navis-tag-identity-trace.js`
  - produces the end-to-end identity trace and attaches resolution evidence.

### Resolution and final output

- `navis-tag-proximity-engine.js`
  - resolves direct Tag-to-support proximity;
  - evaluates tolerances, candidate ranking, ambiguity, and rejection evidence;
  - performs applies-to propagation using pipe identity and geometric checks.
- `navis-tag-applies-to.js`
  - parses and normalizes applies-to directives and target-pipe references.
- `navis-tag-final-output.js`
  - creates the final delivery table;
  - selects deterministic support identity;
  - expands abbreviated Tag keys;
  - preserves unmatched Navis tags with the instruction `Refer Navis file to locate Tag`.

### User interface

- `navis-tag-isonote-ui-workflow.js`
  - Home, Config, and Final Output workflow surfaces.
- `navis-tag-isonote-ui-evidence.js`
  - three-stage evidence reports.
- `navis-tag-isonote-ui-view.js`
  - supporting views and diagnostics.
- `navis-tag-isonote-ui-style.js`
  - shared styling.

## 3. Data flow and invariants

```text
Support table/workbook (optional) ─┐
                                   ├─> normalized resolution records
Staged JSON/ZIP hierarchy ─────────┘

Staged hierarchy
  -> raw support index
  -> refined support index
  -> identity trace

Navis XML
  -> parsed tags
  -> unit conversion
  -> configured E/N/EL offsets
  -> comparison-frame coordinates

Resolution records + identity trace + Navis tags + normalized config
  -> readiness gate
  -> direct proximity resolution
  -> applies-to pipe propagation
  -> final output rows
  -> CSV / JSON evidence exports
```

Critical invariants:

- Derived coordinates and match evidence are stale after any material input or configuration change.
- The Run action must rebuild stale evidence before matching.
- Direct match state and propagated ISONOTE state remain separate.
- A support identity is selected deterministically: grouped `/DATUM` first, then the smallest numeric suffix.
- The original abbreviated Tag text remains traceable even when the ISONOTE vocabulary is expanded.
- An unmatched Navis tag is not silently discarded.
- Oversized local-storage values are omitted entirely and marked for reload; partial source restoration is not allowed.

## 4. Output contracts

The final delivery table uses this column order:

```text
Name of the element
PIPE
POS
Navis Tag ID
Navis Tag POS
Tag
Support ISONOTE
confidence
Basis
```

Primary downloads:

- `navis-tag-final-isonote.csv`
- `navis-tag-support-isonote-audit.csv`
- `navis-tag-end-to-end-identity-trace.csv`
- `navis-tag-support-isonote-ambiguous.csv`
- `navis-tag-support-isonote-rejected.csv`
- `navis-tag-support-isonote-audit.json`

Browser persistence keys:

- configuration: `navisTagIsonote.config.v4`
- source/session state: `navisTagIsonote.session.v1`

Current source-size protections:

- support table or Navis XML: 900,000 characters per source;
- staged JSON: 1,400,000 characters;
- complete stored session: 3,600,000 characters.

## 5. Verification baseline

The repository includes focused test groups for:

- core resolution and contracts;
- applies-to parsing and propagation;
- final output and unmatched-tag behavior;
- readiness and coordinate profiles;
- workbook ingestion;
- index refinement and coordinate grouping;
- bore/OD rules;
- static UI contracts;
- ASIM-1836 acceptance and performance benchmarks.

Primary command:

```bash
npm run test:navis-tag-isonote
```

The full repository gate is:

```bash
npm test
```

## 6. Known limitations and engineering risks

### Browser memory and persistence

Large staged models are held in browser memory and are serialized for session persistence when below configured limits. The current design is appropriate for controlled engineering workpacks, but it will not scale indefinitely with model size or concurrent workspaces.

### Main-thread processing

Parsing, hierarchy construction, indexing, proximity evaluation, and final-row generation are synchronous orchestration steps. Large inputs can temporarily block rendering.

### Configuration discoverability

The Config surface is comprehensive, but advanced coordinate, pipe-axis, line-key, and keyword settings require domain knowledge. Incorrect settings can produce technically valid but operationally inappropriate results.

### Evidence volume

Audit JSON can become large because it preserves multiple evidence layers. Consumers need a documented retention and redaction policy before using it as a formal project record.

### Geometric assumptions

Applies-to propagation relies on inferred N–S or E–W support-axis behavior and configured station, parallel-offset, and elevation windows. Non-orthogonal routing and irregular support layouts require a stronger geometric model.

## 7. Implementable improvements

| Priority | Improvement | Implementation approach | Acceptance criteria |
|---|---|---|---|
| P0 | Add a run manifest | Export input names, hashes, config hash, application schema versions, timestamp, and row counts with every run. | Every final CSV package has a reproducible manifest and stable run ID. |
| P0 | Add configuration validation | Validate datum magnitude, tolerance relationships, regex compilation, duplicate keyword keys, and empty expansion values before Build/Run. | Invalid settings block Run with field-specific messages. |
| P0 | Add deterministic golden fixtures | Store small direct, ambiguous, rejected, propagated, and unmatched workpacks with expected final CSV and evidence summaries. | Golden results are byte-stable across releases. |
| P1 | Move parsing/indexing to a Web Worker | Define serializable input/output contracts and transfer only normalized records back to the UI thread. | Large benchmark remains interactive during Build and Run. |
| P1 | Add spatial indexing | Replace broad candidate scans with grid, R-tree, or k-d-tree indexing partitioned by pipe/line and elevation band. | Candidate evaluation grows approximately logarithmically or by local density rather than total row count. |
| P1 | Add coordinate-profile presets | Version named project profiles with units, datum offsets, axis mapping, and pipe parsing rules. | A user can select a governed profile and see its version in the run manifest. |
| P1 | Add visual match inspection | Provide a lightweight 2D E/N and elevation-delta plot for selected Tag, accepted support, nearest rejected candidates, and propagation targets. | Users can visually validate every selected or rejected match. |
| P1 | Add batch workpack mode | Accept multiple Navis XML files and produce file-scoped and consolidated outputs. | Results retain source-file identity and collision-safe Tag IDs. |
| P2 | Support oblique pipe axes | Infer a principal axis vector from support coordinates and compute along-axis/perpendicular distance in that frame. | Propagation works for non-cardinal pipe routing with test fixtures. |
| P2 | Add review decisions | Permit Accept, Override, Reject, and Comment decisions without mutating source evidence. | Manual decisions are exported in a separate signed review ledger. |
| P2 | Add schema migration | Version and migrate saved configuration/session payloads instead of relying only on normalization defaults. | Older saved configurations migrate with a visible change summary. |
| P2 | Add project vocabulary packs | Externalize Tag expansion maps, pipe regexes, and naming rules into importable JSON profiles. | Vocabulary changes do not require source-code edits. |

## 8. Professional interface roadmap

### Immediate interface refinement

- Add a persistent workflow progress indicator: Inputs → Evidence → Resolve → Review → Export.
- Show a compact readiness badge and stale-evidence badge in every tab.
- Add a selected-Tag evidence drawer so users do not lose context while moving between Stage 2, Stage 3, and Final Output.
- Keep primary actions fixed at the top of long evidence reports.
- Add a full-screen workspace mode and column visibility controls.

### Review-grade interface

- Add saved filters for unresolved, ambiguous, propagated, unmatched, and overridden rows.
- Add row pinning and cross-tab focus by Tag ID or support identity.
- Add inline explanations for confidence and Basis codes.
- Add a before/after preview when configuration changes would alter coordinates or matching.
- Add an export checklist showing whether evidence, final CSV, config, and manifest have been generated.

### Controlled enterprise interface

- Add project profile selection with locked governed fields.
- Add user/action timestamps to manual review decisions.
- Add export approval status and package signature metadata.
- Add localization-ready labels while keeping exported field names stable.

## 9. Scalability strategy

### Target tiers

- **Tier A — desktop workpack:** up to tens of thousands of staged identities and hundreds of Navis tags.
- **Tier B — large project package:** hundreds of thousands of identities and thousands of tags using workers and spatial indexes.
- **Tier C — service-assisted processing:** browser UI submits immutable workpacks to a server-side resolver and receives signed result artifacts.

### Required technical changes for Tier B

1. Stream or incrementally parse staged JSON/ZIP inputs.
2. Store normalized records in typed or compact structures.
3. Partition candidates by project/line/pipe before geometric search.
4. Execute parsing and proximity work in workers.
5. Virtualize every evidence table.
6. Generate large CSV files through streaming writers rather than one in-memory string.
7. Measure peak memory, stage duration, candidate count, and rejected-candidate count in the run manifest.

### Service boundary for Tier C

Keep browser and service implementations aligned through versioned pure-data contracts:

- `NavisTagInputWorkpack.v1`
- `NavisTagConfig.v1`
- `NavisTagResolutionEvidence.v1`
- `NavisTagFinalOutput.v1`
- `NavisTagRunManifest.v1`

The service must not return opaque decisions. It must return the same evidence, deltas, basis codes, and source identities currently available in the browser audit.

## 10. Recommended delivery roadmap

### 0–30 days: hardening

- run manifest and input hashing;
- configuration validation;
- golden workpacks;
- full-screen and sticky action bar;
- export package checklist;
- explicit schema/version display.

### 30–90 days: review productivity

- Web Worker processing;
- table virtualization;
- spatial candidate index;
- selected-Tag evidence drawer and 2D visual inspection;
- governed coordinate-profile presets;
- manual review ledger.

### 3–6 months: project-scale operation

- oblique pipe-axis propagation;
- batch Navis processing;
- importable vocabulary/profile packs;
- streaming exports;
- performance telemetry and capacity baselines;
- optional server-side resolver using the same contracts.

## 11. Release and handover checklist

Before modifying resolution logic:

1. Record the current schema constants and benchmark result.
2. Add or update a focused fixture before changing behavior.
3. Keep direct matching, propagation, and manual review as separate state dimensions.
4. Preserve final CSV column order unless a versioned output contract is introduced.
5. Verify stale-input rebuilding and local-storage migration.
6. Run `npm run test:navis-tag-isonote` and `npm test`.
7. Run the full Navis benchmark workflow.
8. Document any tolerance, identity-selection, or vocabulary behavior change in the run manifest and release notes.

## 12. Recommended next implementation slice

The highest-value next slice is **Reproducible Run Package v1**:

- input SHA-256 hashes;
- normalized configuration JSON;
- schema versions;
- run ID and timestamp;
- readiness and result counts;
- final CSV;
- identity trace CSV;
- audit JSON;
- manifest JSON;
- one ZIP download.

This creates a professional, reviewable boundary before increasing algorithmic complexity or model size.
