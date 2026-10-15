# PDF figure/image asset extraction

This slice adds deterministic PDF figure assets on top of the native-text, table, and OCR pipeline.

## Source contract

`pdfplumber` is used only to discover PDF image-object geometry and source metadata. It does **not** provide the canonical asset bytes. Accepted image-object regions are rendered through `pypdfium2` into PNG assets so masks, transforms, clipping, and PDF compositing are represented as they appear on the page.

Coordinates remain in the shared top-left PDF-point system `(x0, top, x1, bottom)`. The PDFium crop conversion is deterministic: left=`x0`, bottom=`pageHeight-bottom`, right=`pageWidth-x1`, top=`top`.

## Conservative candidate policy

An image object is not automatically a semantic figure.

Rejected candidates include:

- page/background scans covering at least 85% of the page;
- image objects covering at least 50% of a page already classified as `SCANNED` with inadequate native text;
- objects below 36 x 36 points or below 0.3% of page area;
- small objects in the running header/footer bands;
- image objects substantially overlapping an accepted semantic table;
- duplicate image objects with essentially identical page geometry.

Rejected objects remain visible in diagnostics. Full-page scans are deliberately handed to the OCR layer rather than duplicated as figures.

## Canonical assets

Accepted figures are rendered to PNG with deterministic resource gates. Asset identity is SHA-256 of the rendered PNG bytes and the logical Markdown path is:

```text
assets/pdf-figure-<24 hex chars>.png
```

`--assets DIR` controls only physical materialization. It is not included in canonical options or evidence identity.

Existing files at the deterministic hash-derived path are reused only when their bytes match. A different payload at the same deterministic path fails closed with `PDF_FIGURE_ASSET_COLLISION`.

## Caption association

Captions are associated only when a paragraph:

- is on the same page;
- begins with a conservative caption token such as `Figure`, `Fig.`, `Chart`, `Diagram`, or `Image`;
- horizontally overlaps the figure;
- begins between 4 points above and 48 points below the figure bottom.

Caption text is retained as ordinary document text as well as figure metadata; extraction does not delete the source paragraph.

## Reading-order placement

Figure blocks are inserted relative to existing page blocks using source bboxes. Two-column pages compare only blocks in the same visual half. If the native reading-order layer already marked a page ambiguous, the figure is retained but `PDF_FIGURE_ORDER_AMBIGUOUS` is emitted instead of claiming high-confidence placement.

## CLI

```bash
python scripts/pdf_to_markdown.py input.pdf \
  --images extract \
  --assets output-assets \
  --figure-scale 2.0 \
  --figure-max-pixels 8000000 \
  --figure-memory-mb 64 \
  --figure-max-assets 200 \
  --figure-max-job-pixels 100000000
```

`--images skip` keeps accepted figure locations visible as explicit `FIGURE_SKIPPED` markers and emits `PDF_FIGURE_SKIPPED_BY_POLICY`; the rasterizer is not invoked.

## Resource defaults

```text
figure scale             2.0
pixels / figure          8,000,000
peak memory / figure     64 MiB
accepted figures / job   200
figure pixels / job      100,000,000
peak working estimate    10 bytes / pixel
minimum raster scale     0.75
```

The rasterizer and Pillow versions are evidence-visible and participate in the canonical options identity whenever figure rendering is invoked.

## Deliberate limitations

This slice handles PDF **image objects**. It does not label arbitrary vector paths as figures and it does not segment full engineering drawings into regions. Vector charts, drawing title blocks, and regional engineering-drawing OCR remain the next isolated stage.
