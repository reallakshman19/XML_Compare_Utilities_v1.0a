# PDF to Markdown utility

Native PDF support is an optional layer beside the dependency-free DOCX path. Install the pinned PDF extra:

```bash
python -m pip install -r requirements-pdf.txt
```

Then use either the PDF-specific entry point or unified dispatcher:

```bash
python scripts/pdf_to_markdown.py input.pdf -o output.md --evidence output.evidence.json
python scripts/document_to_markdown.py input.pdf -o output.md --evidence output.evidence.json
```

The existing DOCX command remains available and does not import `pdfplumber` unless PDF conversion is requested.

## Backend boundary

`scripts/pdf_native.py` contains a small `PdfPlumberBackend` adapter and separate pure layout algorithms. The backend only exposes source objects/signals; Markdown is not built while traversing pdfplumber objects.

The optional runtime is pinned in `requirements-pdf.txt`:

```text
pdfplumber==0.11.10
pdfminer.six==20260107
pypdfium2==5.8.0
Pillow==12.3.0
```

The converter records the actual backend versions in evidence and includes them in the canonical option hash. Running a different backend version therefore cannot masquerade as the same conversion profile.

The native slice does **not** use PyMuPDF and does not create a runtime dependency on Pdf-Hub. See `docs/pdf-dependency-review.md` for the dependency/license decision.

## Positioned source model

For each usable embedded-text character the backend retains:

- text;
- top-left-coordinate bounding box `(x0, top, x1, bottom)` in PDF points;
- font name;
- font size;
- upright/matrix data when available.

Characters are clustered into lines and style-consistent spans. Semantic PDF paragraphs retain:

- block/page bounding box;
- every contributing line bounding box as `sourceProvenance`;
- positioned spans with text, bbox, font, size, bold/italic flags and page;
- extraction method `embedded-text`.

Evidence declares `coordinateSystem: top-left-points`. Coordinates are rounded deterministically to three decimals before semantic use.

## Native text quality and page classification

Native text is evaluated before it is trusted. Current measurable quality gates include:

- at least 20 visible non-whitespace characters for an adequate text layer;
- printable-character ratio at least 0.90;
- Unicode replacement-character ratio at most 0.02;
- disallowed control-character ratio at most 0.01;
- duplicate text-layer ratio at most 0.35 after pdfplumber de-duplication.

Pages are classified using these quality signals plus image coverage and vector-object counts. Current classes are:

```text
BORN_DIGITAL
MIXED
SCANNED
IMAGE_HEAVY
TABLE_HEAVY
ENGINEERING_DRAWING
UNKNOWN
```

Examples of deliberate gates:

- 250+ vector line/rect/curve objects with limited text -> `ENGINEERING_DRAWING`;
- 20+ vector line/rect/curve objects with usable text -> `TABLE_HEAVY`;
- less than 20 visible characters with image coverage >= 60% -> `SCANNED`.

An inadequate native text layer emits `PDF_NATIVE_TEXT_INADEQUATE`. With the controlled OCR layer enabled, that diagnostic/classification becomes the deterministic handoff into `--ocr auto`; healthy born-digital native text remains authoritative and does not invoke OCR.

## Line reconstruction

Characters first cluster by vertical overlap/baseline tolerance. A baseline group is then split when an unusually large horizontal gap exceeds:

```text
max(24 pt, 4 * median font size)
```

This is required for common two-column PDFs where left/right text shares the same y-coordinate. Normal word spacing remains within one line; large gutters become separate line segments.

Superscript/subscript-like characters remain on the same line when their vertical boxes overlap or their centers fall within the font-relative baseline tolerance. This is tested with engineering text such as `m²`.

## Reading order

Reading order is reconstructed from coordinates; plain whole-page text extraction is not used as the only path.

Full-width anchor lines are recognized when they occupy at least 68% of page width, or span approximately the 12%-88% page-width band. Each vertical band between anchors is evaluated independently.

For a two-column decision:

- line centers left of 45% page width form the left candidate;
- line centers right of 55% form the right candidate;
- both sides need at least 3 lines;
- the smaller side must contain at least 30% as many lines as the larger side;
- the median gutter must be at least `max(12 pt, 2.5% page width)`;
- at most one line may remain in the middle band.

A convincing two-column band is emitted left-column top-to-bottom, then right-column top-to-bottom. If two substantial candidate columns exist but the gutter/middle conditions are not convincing, the converter emits `PDF_READING_ORDER_AMBIGUOUS` rather than claiming a confident order. The page remains readable in source y/x order and evidence marks the page mode `ambiguous` with lower confidence.

## Paragraph grouping and heading inference

Lines only join a paragraph when they remain in the same reading-order region and satisfy deterministic spacing/font constraints. A join is rejected when, among other things:

- vertical gap exceeds `max(5 pt, 0.8 * font size)`;
- font-size difference exceeds `max(1 pt, 15% of font size)`;
- bold state changes;
- left edges differ by more than 18 pt.

Heading inference is document-level. It estimates body size from ordinary text, then combines relative font size, boldness, numbering depth and maximum heading length. It deliberately does not use `largest font = H1` as a standalone rule.

## Running headers and footers

Repeated running content is suppressed from body Markdown by default and retained as metadata. Detection is deliberately conservative:

- at least 3 pages are required;
- candidate text must occur in the top 8% or bottom 8% of the page;
- exact normalized text must repeat on at least 80% of pages (minimum 3 pages);
- vertical position ratio may vary by no more than 0.02.

Options:

```text
--headers keep|metadata|drop
--footers keep|metadata|drop
```

`metadata` is the default. `drop` emits stable diagnostics rather than silently deleting the fact that repeated content existed.

## PDF table reconstruction

PDF tables use two independent candidate strategies through `scripts/pdf_tables.py` and are normalized into the **same** `TableBlock` / `TableCell` semantic model used by DOCX. Table text is removed from the ordinary native-line stream only after a candidate passes the reconciliation gates, preventing duplicate Markdown.

### Ruled/grid strategy

The ruled strategy uses PDF line geometry and is preferred when corroborated. It may infer `rowSpan` / `columnSpan` from explicit geometric cell boundaries. The resulting cell provenance retains page, bbox, extraction method `embedded-table-ruled`, and candidate confidence.

### Whitespace/alignment strategy

The text strategy is deliberately more conservative. It treats each accepted source row ordinal as one logical row and **does not infer rowspan from vertical whitespace gaps**. This prevents blank inter-row space from becoming invented merged cells. Missing physical positions become explicit omitted cells.

Text candidates must satisfy all of the following confidence signals before normalization:

- at least 3 source rows and a conservative non-empty density gate of 0.85;
- sufficient column whitespace: median per-column cell-width/text-length score at least 9.0;
- vertical compactness that does not look like prose spread across the page;
- final confidence at least 0.78.

The whitespace score specifically prevents repeated words in ordinary two-column prose from being promoted to a 10- or 15-column table merely because word starts align across lines. A generated two-column regression fixture verifies that this remains prose and continues through the reading-order algorithm.

### Reconciliation / ambiguity

Ruled candidates require confidence at least 0.85. Low-confidence candidates are diagnosed and removed **before** cross-strategy conflict checks, so a weak text false positive cannot veto a strong ruled table.

When two high-confidence candidates overlap by at least 70% IoU:

- same row/column shape -> prefer ruled (when present) and add corroboration confidence;
- different shape -> reject the conflicting reconstruction and emit `PDF_TABLE_AMBIGUOUS`.

Contained duplicate candidates are suppressed with `PDF_TABLE_DUPLICATE_CANDIDATE`. Candidates below their strategy threshold emit `PDF_TABLE_LOW_CONFIDENCE`. Backend strategy failures retain native text and emit `PDF_TABLE_EXTRACTION_FAILED` rather than silently deleting page content.

Accepted tables are recorded in page evidence with strategy, bbox, confidence, row/column count, and reasons. Pages containing accepted tables are classified `TABLE_HEAVY` unless the stronger `ENGINEERING_DRAWING` classification already applies.

### Rendering

PDF tables use the shared table renderer policy:

```text
--table-mode auto|markdown|html|records
```

Simple rectangular PDF tables may render as GFM with synthetic `Column N` labels; merged/omitted structures use HTML; wide tables use record-oriented output. Unsafe explicit Markdown requests fall back via the same `TABLE_RENDER_MODE_FALLBACK` contract used for DOCX.

## Controlled OCR fallback

OCR is a page-level fallback over the native/table semantic document, not a whole-document replacement. The PDF CLI supports:

```text
--ocr auto|always|never
--ocr-language eng
--ocr-confidence-min 0.70
--ocr-scale 2.0
--ocr-max-pixels 16000000
--ocr-memory-mb 64
--ocr-max-pages 100
--ocr-max-job-pixels 250000000
--ocr-timeout 60
```

`auto` is the default. It skips healthy `BORN_DIGITAL`, `MIXED`, and adequately extracted `TABLE_HEAVY` pages. It requests OCR for `SCANNED`, `IMAGE_HEAVY`, `UNKNOWN`, or otherwise inadequate native text. `always` forces OCR for qualification/debug use; `never` disables it. The decision and reason are recorded per page.

### Raster and memory limits

`PdfiumRasterizer` uses the pinned `pypdfium2` runtime and converts the selected page only. The requested scale is clamped before rendering by both the pixel ceiling and a peak-memory working-set estimate. The working-set estimate uses 10 bytes/pixel to reserve headroom for the RGBA bitmap plus PIL/image-conversion and PNG-encoder buffers; the post-render dimensions are checked again. A scale below the configured minimum is rejected with `OCR_RASTER_LIMIT_EXCEEDED` rather than rendering an unbounded page.

The job also enforces page count and total raster-pixel budgets. Exceeding those limits is fatal (`OCR_PAGE_LIMIT_EXCEEDED` / `OCR_JOB_PIXEL_LIMIT_EXCEEDED`) so a hostile or accidentally huge PDF cannot silently consume unbounded OCR resources.

### Tesseract boundary and language policy

OCR recognition uses the Tesseract CLI directly with TSV output; there is no shell invocation and no `pytesseract` runtime dependency. Tesseract is a separately deployed system dependency (5.x in the qualified environment) and its actual version is recorded in evidence/canonical options whenever OCR runs. `pypdfium2`'s actual version is recorded the same way. The selected language expression is restricted to a conservative alphanumeric/`_+.-` grammar before it reaches the CLI.

The pinned Python OCR dependencies are `pypdfium2==5.8.0` and `Pillow==12.3.0`. The qualified local package metadata reports pypdfium2's bundled license set as BSD-3-Clause/Apache-2.0 plus dependency licenses; the deployed Tesseract 5.5.0 package declares Apache-2.0. Release/container builds should pin the system Tesseract package explicitly and rerun the real-backend OCR fixture.

### Confidence, provenance, and native/OCR merge

Tesseract words are converted back from raster pixels to top-left PDF-point coordinates. Evidence retains word/line/paragraph text, bbox and confidence plus engine/rasterizer versions, raster dimensions/scale, pixel count, and the page-level decision reason. Semantic OCR paragraphs use `extraction: ocr` and carry confidence in their provenance.

Native content remains authoritative on overlap. OCR blocks that substantially overlap native paragraphs are discarded when normalized text and engineering numeric tokens agree; materially different overlaps emit `OCR_NATIVE_CONFLICT` and keep the native value. OCR overlapping a native semantic table is treated as duplicate table text, preventing a second flattened copy of engineering cells.

Canonical OCR text is accepted only when page confidence meets `--ocr-confidence-min` (default 0.70). Empty/low-confidence results produce an explicit page marker (`OCR_TEXT_EMPTY` or `OCR_LOW_CONFIDENCE`) rather than guessed text. OCR on layout-unsafe pages such as engineering drawings is not promoted to ordinary paragraphs unless the existing semantic structure makes the merge safe; otherwise `OCR_LAYOUT_UNRESOLVED` is emitted with a visible marker.

The OCR mode, language, thresholds, raster budgets, timeout, OCR revision, and invoked engine/rasterizer versions participate in the canonical option identity. This prevents conversions produced by different OCR engines/versions or policies from masquerading as the same artifact.

## Security and resource gates

The native backend fails closed for:

- encrypted/password-protected PDFs without a valid password -> `PDF_ENCRYPTED`;
- malformed parser failures -> `PDF_MALFORMED`;
- more than 2,000 pages by default -> `PDF_PAGE_LIMIT_EXCEEDED`;
- non-positive or excessive page area (> 200,000,000 point²) -> `PDF_PAGE_DIMENSIONS_EXCESSIVE`;
- more than 1,000,000 extracted characters on one page -> `PDF_CHAR_LIMIT_EXCEEDED`;
- missing optional backend -> `PDF_BACKEND_MISSING`.

An explicit password can be supplied with `--pdf-password`.

## Determinism and evidence

Canonical evidence contains:

- source SHA-256 and Git blob SHA;
- semantic schema / canonicalization / converter revisions;
- backend versions;
- backend versions inside the canonical options hash;
- page quality/classification/reasons;
- reading-order mode/confidence;
- running-content metadata;
- block/line/span PDF provenance and bboxes;
- stable diagnostics.

Runtime timestamps and random UUIDs are not emitted.

## Current limitations

The implemented PDF path now includes native positioned extraction, reading order, conservative ruled/whitespace table normalization, and controlled page-level OCR fallback with native/OCR deduplication.

Still deferred:

- engineering-drawing region extraction;
- figures/images as PDF assets;
- sophisticated side-note/caption graph reconstruction beyond the current column/anchor model.

When native text is inadequate or order is ambiguous, diagnostics expose that uncertainty rather than silently claiming full fidelity.
