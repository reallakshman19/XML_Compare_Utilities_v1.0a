# DOCX to Markdown utility

`scripts/docx_to_markdown.py` converts DOCX packages to deterministic Markdown using only the Python standard library.

The DOCX path now builds an OOXML package graph before parsing the Word body. It indexes package parts, content types and per-part relationships; resolves `word/styles.xml` inheritance and `word/numbering.xml`; walks paragraphs, tables and content controls in source order; and keeps external relationships as data without performing network fetches. No Office application, OCR, Pandoc, or third-party Python package is required.

The historical `scripts/docx_to_markdown.py` path remains the public compatibility facade. Rendering now lives in `scripts/docx_rendering.py`, while conversion/evidence/CLI orchestration lives in `scripts/docx_conversion.py`.

## Usage

Legacy HTML table rendering remains the no-flag/default behavior:

```bash
python scripts/docx_to_markdown.py input.docx --output output.md --stats-json
```

The compatibility flags remain available:

```bash
python scripts/docx_to_markdown.py input.docx --table-format html
python scripts/docx_to_markdown.py input.docx --table-format tsv
```

Comparison-grade semantic table policy is opt-in through:

```bash
python scripts/docx_to_markdown.py input.docx --table-mode auto
python scripts/docx_to_markdown.py input.docx --table-mode markdown
python scripts/docx_to_markdown.py input.docx --table-mode html
python scripts/docx_to_markdown.py input.docx --table-mode records
```

`--table-format` and `--table-mode` are mutually exclusive. The legacy default remains HTML so existing users do not silently receive a different canonical document.

## Table renderer policy

`scripts/table_rendering.py` classifies the already-normalized semantic table; it does not re-parse OOXML or infer a header row.

Deterministic `auto` policy:

- `SIMPLE`: rectangular table with no merges, omissions or nested tables -> GFM Markdown;
- `WIDE_ENGINEERING`: at least 8 logical columns, otherwise structurally simple -> record-oriented rendering;
- `COMPLEX_MERGED`: any rowspan, colspan or omitted logical position -> HTML;
- `NESTED`: nested table content -> HTML.

GFM output uses synthetic `Column 1`, `Column 2`, ... labels and emits every source row as data. This deliberately avoids inventing table-header semantics merely because GFM syntax requires a header row.

Record-oriented output preserves logical coordinates such as `C1-C2 (R1-R2)` and uses explicit `⟦EMPTY⟧` / `⟦OMITTED⟧` markers. An explicit unsafe request, such as `--table-mode markdown` for a merged table, falls back to HTML and emits `TABLE_RENDER_MODE_FALLBACK`; it never flattens spans into shifted pipe columns.

Evidence emitted with `--table-mode` includes a deterministic `tableRendering` decision for each table: requested mode, resolved renderer, classification and reasons. Renderer fallback diagnostics are also added to canonical evidence diagnostics.

## Integrity gates

The converter can fail closed when a controlled source or generated artifact does not match an expected identity:

```bash
python scripts/docx_to_markdown.py input.docx \
  --output output.md \
  --expected-git-blob-sha <40-character-git-blob-sha> \
  --expected-output-sha256 <64-character-sha256> \
  --stats-json
```

The reported statistics include:

- DOCX byte count;
- `word/document.xml` byte count and ZIP CRC32;
- source Git blob SHA-1;
- source SHA-256;
- generated Markdown SHA-256 and byte count;
- top-level paragraph and table counts;
- count of non-empty Word text nodes;
- legacy table format and optional semantic table mode;
- resolved table renderers and fallback count;
- semantic schema and canonicalization versions;
- canonical options hash;
- package part, relationship, style, numbering-instance and content-type counts.

The Git blob identity is calculated using Git's canonical `blob <size>\0<bytes>` hashing rule, so it can be compared directly with a repository blob SHA.

## Semantic model and evidence

Issue #960 introduces `scripts/document_model.py` as the versioned semantic contract between source parsing and rendering. The existing `scripts/docx_to_markdown.py` entry point remains the compatibility wrapper; it parses into semantic paragraph, page-break and table objects before rendering Markdown.

Deterministic evidence can be emitted without changing normal Markdown output:

```bash
python scripts/docx_to_markdown.py input.docx \
  --output output.md \
  --evidence output.evidence.json \
  --table-mode auto
```

Evidence contains the source SHA-256 and Git blob SHA, converter revision, semantic schema/canonicalization versions, profile/options identity, stable source-derived block IDs, DOCX part/index provenance, effective style/list metadata, hyperlink targets, table cell coordinates/spans, package metadata and stable diagnostics. Table evidence distinguishes physical `sourceRows`, placeholder-expanded `positionRows`, and normalized logical `rows`; canonical evidence is serialized with sorted keys and contains no runtime timestamp or random UUID.

The renderer-policy slice changed the converter revision while keeping semantic schema/canonicalization at v3 because existing `--table-format html|tsv` behavior was unchanged. Revision/note semantics advanced the contract to v4. Embedded image semantics below advance it to v5.

## OOXML package, styles and numbering

The primary `convert_docx_bytes()` path resolves package context instead of treating `word/document.xml` as the whole document. `convert_document_xml()` remains available as a compatibility path for callers that intentionally supply only the main XML part; it cannot resolve package relationships, styles or numbering that are absent from that input.

Heading inference uses deterministic priority: direct `w:outlineLvl`, inherited style `w:outlineLvl`, then recognized `Heading1`-`Heading6` style identifiers/names. A large/bold formatting heuristic is intentionally not used. Style `w:basedOn` inheritance is retained in evidence.

Numbering resolves `numId -> w:num -> abstractNumId -> w:abstractNum -> ilvl`, including `startOverride` and level overrides. Markdown uses `-` for bullet levels and `1.` for ordered levels while evidence retains Word `numFmt`, `lvlText`, start and level so source semantics are not invented.

Paragraph parsing is child-order aware. Content controls (`w:sdt`) are expanded in place; external hyperlinks are rendered from relationship targets without fetching them; complex field instructions are suppressed while displayed field results are retained. Revision selection is handled explicitly by the revision layer described below. Missing relationships/styles/numbering produce stable diagnostics rather than guessed values.

## Word table grid normalization

Word tables are parsed in two stages rather than rendered directly from `w:tc` order. The source parser first records physical rows/cells, `w:tblGrid`, `w:gridSpan`, `w:vMerge`, and row-level `w:gridBefore`/`w:gridAfter`. `scripts/table_grid.py` then derives deterministic logical `(row, column, rowSpan, columnSpan)` coordinates.

The semantic table keeps three deliberately different views:

- `sourceRows`: physical source cells only, with row `gridBefore`/`gridAfter` retained separately;
- `positionRows`: a source-position view with explicit omitted placeholders inserted so empty/omitted positions cannot shift following values;
- `rows`: the normalized logical grid. `vMerge` continuations are attached to the restart cell, increment its `rowSpan`, retain all contributing source provenance, and are not emitted as duplicate logical cells.

An explicit empty `w:tc` remains a cell. A missing position implied by `gridBefore`, `gridAfter`, or a shorter irregular row becomes an `omitted` logical placeholder. A continuation without a matching restart emits `TABLE_VERTICAL_MERGE_ORPHAN`; malformed merge values and irregular row widths also emit stable diagnostics instead of moving values to guessed columns.

HTML rendering uses the normalized grid and emits `rowspan`/`colspan`. Legacy `--table-format tsv` intentionally remains a compact compatibility transcription based on `positionRows`; evidence is the authoritative source for merged-cell coordinates.

## Revisions, notes, comments, fields and running content

The DOCX package path supports `--revisions accepted|rejected|markup` (default `accepted`). Revision selection is performed before the normal OOXML traversal so deleted and moved content is never accidentally included by descendant-text extraction.

- `accepted`: `w:ins` / `w:moveTo` are retained; `w:del` / `w:moveFrom` are removed.
- `rejected`: `w:del` / `w:moveFrom` are retained; `w:ins` / `w:moveTo` are removed.
- `markup`: all four are retained. Inline revisions become semantic revision nodes and render as deterministic `<ins>` / `<del>` markup. Author/date metadata stays in evidence rather than readable prose. Block-level revisions are retained but emit `DOCX_BLOCK_REVISION_MARKUP_LIMITED` when an inline tag cannot safely span block boundaries.

Footnote and endnote references are typed semantic references. Definitions are parsed from `word/footnotes.xml` / `word/endnotes.xml`, skip separator pseudo-notes, respect the selected revision mode, and render as deterministic `[^fnN]` / `[^enN]` definitions. Comments are parsed from `word/comments.xml` and remain evidence-only by default; comment author/date are retained.

Complex and simple Word field instructions/results are recorded in forensic metadata (`metadata.fields`). Readable Markdown still uses the displayed field result; instructions such as `REF`, `PAGEREF`, `SEQ`, `PAGE`, etc. do not leak into the readable text merely because they exist in `w:instrText`.

Running headers/footers use explicit policy flags:

```bash
--headers keep|metadata|drop
--footers keep|metadata|drop
```

The default is `metadata`: running content is retained with source-part provenance but not duplicated in body Markdown. `keep` emits clearly labeled source-part blocks before/after the document body; this deliberately does **not** claim section-placement reconstruction. `drop` removes the running text from evidence and emits stable `DOCX_HEADER_DROPPED` / `DOCX_FOOTER_DROPPED` diagnostics so the loss is intentional rather than silent.

## Embedded drawings and deterministic assets

Embedded Word drawings are resolved through `w:drawing -> a:blip -> r:embed -> document.xml.rels -> word/media/*`. External linked images are **never fetched**. Missing/external relationships produce stable diagnostics rather than invented assets.

Asset identity uses full SHA-256 evidence and a deterministic logical filename `asset-<sha256-prefix>.<ext>`. Markdown always references the canonical logical `assets/<filename>` path; `--assets DIR` controls only where bytes are materialized, so machine-specific filesystem paths never enter canonical Markdown or evidence.

```bash
--images extract|skip
--assets DIR
```

`extract` is the default. Supported raster/web formats (`png`, `jpg/jpeg`, `gif`, `webp`, `svg`) render inline and are materialized byte-for-byte. EMF/WMF and other unsupported formats are still preserved as hashed assets but render as explicit `⟦IMAGE_UNSUPPORTED:...⟧` markers with `DOCX_IMAGE_FORMAT_UNSUPPORTED`. `skip` emits `⟦IMAGE_SKIPPED:...⟧`, performs no asset write, and records `DOCX_IMAGE_SKIPPED_BY_POLICY`. Existing files with the deterministic name but different bytes cause a hard collision error rather than overwrite.

Alt text is taken conservatively from `wp:docPr` (`descr`, then `title`, then `name`). Caption association occurs only when the immediately following paragraph in the **same OOXML parent container** is explicitly styled `Caption` or contains a `SEQ Figure` / `SEQ Table` field; the caption paragraph remains normal source content and the association is additional evidence. A drawing that cannot be replaced by the semantic transport token emits `DOCX_DRAWING_TOKENIZATION_FAILED` rather than disappearing silently.

This asset slice advances semantic schema/canonicalization to v5 because drawings become typed image semantics and canonical Markdown can now contain stable asset links instead of the previous deferred drawing marker. Images in ancillary note/header/footer parts and section-aware header/footer association remain documented limitations. Native PDF extraction and OCR are subsequent issue #960 slices.

## EI AVIFF conversion provenance

This utility captures the conversion logic used to recover the controlled EI AVIFF worked-examples DOCX that was later saved to `3D_Converters/docs/`.

That controlled source was identified as:

- repository: `reallaksh19/Common`;
- commit: `fb549185b9b27edc2379734240320a85c5bef9f6`;
- path: `Energy-Institute-AVIFF---Worked-Examples.doc.docx`;
- Git blob SHA: `ceee15ed5f7f320045d5f3979024e2e8664613f2`.

For source-review work, use `--table-mode auto` when mixed simple/complex/wide tables should select the safest representation. Use explicit HTML for source-faithful span review, and legacy TSV only when compact compatibility transcription is specifically required.

## Focused validation

Run the standalone suites:

```bash
python tests/docx_to_markdown_test.py
python tests/table_rendering_test.py
python tests/table_mode_wiring_test.py
python tests/docx_ancillary_test.py
python tests/docx_revision_semantics_test.py
python tests/docx_revision_rendering_test.py
python tests/docx_revision_notes_integration_test.py
python tests/docx_assets_test.py
python tests/docx_assets_rendering_test.py
python tests/docx_assets_integration_test.py
```

The existing DOCX suite covers legacy byte-exact HTML/TSV outputs plus deterministic evidence, style inheritance, direct outline overrides, numbering/start overrides, package content types/root relationships, content-control order, hyperlink resolution, complex field display results, accepted revisions, symbols, missing-relationship diagnostics, unresolved-style behavior, ZIP path-traversal rejection, `gridSpan` + `vMerge` interaction, physical empty cells, omitted positions from `gridBefore`, logical-column invariants, and orphan vertical-merge diagnostics.

The renderer suites cover simple GFM selection without header inference, merged/nested HTML selection, wide record rendering, explicit empty/omitted markers, span coordinates, unsafe explicit-mode fallback, legacy HTML default wiring and semantic table-mode CLI exposure.

The advanced-DOCX suites cover accepted/rejected/markup revision selection, revision author/date evidence, block-markup ambiguity diagnostics, footnote/endnote/comment provenance, note revision behavior, complex-field forensic instruction/result evidence, metadata/keep/drop running-header/footer policies, and canonical option separation across revision/policy modes.

The DOCX asset suites cover relationship resolution without network fetches, deterministic SHA-256 identity/naming, byte-identical materialization, alt text and same-container conservative caption association, tokenization failure diagnostics, unsupported EMF preservation, inline/table rendering, explicit skip policy, and canonical image-option identity.
