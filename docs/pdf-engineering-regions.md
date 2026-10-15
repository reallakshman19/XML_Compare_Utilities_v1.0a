# PDF engineering-drawing regional extraction

This layer prevents vector-heavy engineering drawings from being flattened by ordinary whole-page OCR.

## Pipeline ownership

When a page is classified `ENGINEERING_DRAWING` and `--engineering-regions` is enabled, the regional layer owns OCR for that page.

```text
native PDF geometry/text
        ↓
page classification
        ↓
ENGINEERING_DRAWING
        ↓
vector-region planning
   ┌────┴─────────┐
   ↓              ↓
title block   dense drawing zones
   ↓              ↓
native text sufficiency check
        ↓
regional OCR only where text-poor
        ↓
numeric-aware native/OCR merge
```

This means `--ocr always` still forces whole-page OCR on ordinary pages, but does **not** pre-empt engineering regional extraction on drawing pages. The global OCR layer is internally switched to its auto decision path while non-drawing pages are forced eligible and engineering pages are forced ineligible.

`--ocr never` plus the default `--engineering-regions auto` performs no OCR. An explicit `--engineering-regions always` is a deliberate regional override.

## Region detection

`scripts/pdf_engineering_regions.py` uses pdfplumber line/rectangle/curve geometry. It does not infer engineering semantics from OCR text.

A page must have at least 20 meaningful vector objects before segmentation is trusted. The first implementation identifies:

- **title block** — bounded vector concentration in the lower-right engineering-title-block area;
- **drawing zone** — bounded high-density vector tiles across a 3 x 3 spatial partition.

The planner pads detected vector extents slightly, rejects page-scale zones, removes overlapping duplicate regions, and caps the number of accepted regions per page. Failure to produce bounded regions emits `PDF_ENGINEERING_REGION_AMBIGUOUS` or `PDF_ENGINEERING_REGION_INSUFFICIENT_GEOMETRY` rather than falling back to unordered whole-page OCR.

## Native-text sufficiency

Each region counts native semantic text whose source bbox substantially overlaps the region. In `auto` mode a region with at least 20 native non-whitespace characters is retained as native and is not OCRed.

This prevents regional OCR from re-reading already reliable embedded labels.

## Regional OCR and coordinates

Text-poor regions are cropped through the same PDFium visual-rendering contract used by figure assets. The crop is recognized through the existing Tesseract TSV engine.

Tesseract coordinates are first expressed in the regional point space and then offset/scaled back into the document's top-left PDF-point coordinate system. Added paragraphs therefore carry page-level source bboxes such as:

```json
{
  "source_type": "pdf",
  "page": 4,
  "bbox": [318.0, 512.0, 465.0, 532.0],
  "extraction": "ocr-engineering-title_block",
  "confidence": 0.91
}
```

## Merge policy

Regional OCR never blindly replaces native content.

- >= 0.90 normalized text similarity in an overlapping source region: OCR duplicate is suppressed;
- overlapping numeric/identifier disagreement: OCR is retained separately and `PDF_ENGINEERING_REGION_NATIVE_CONFLICT` is emitted;
- low-confidence or empty regional OCR: emit an explicit marker and diagnostic rather than guessed canonical text.

For example, native `LOF 3.15` and regional OCR `LOF 8.15` are a **conflict**, not a duplicate.

## CLI

```bash
python scripts/pdf_to_markdown.py drawing.pdf \
  --ocr auto \
  --engineering-regions auto \
  --engineering-scale 2.0 \
  --engineering-max-pixels 8000000 \
  --engineering-memory-mb 64 \
  --engineering-max-pages 100 \
  --engineering-max-regions-per-page 12 \
  --engineering-max-job-pixels 200000000 \
  --engineering-timeout 60 \
  --engineering-confidence-min 0.72
```

Modes:

- `auto` — regional OCR only for text-poor detected regions on pages already classified `ENGINEERING_DRAWING`;
- `always` — OCR every accepted engineering region;
- `never` — disable engineering regional OCR/merge.

## Resource defaults

```text
regional raster scale      2.0
pixels / region            8,000,000
peak memory / region       64 MiB
engineering pages / job    100
regions / page             12
region pixels / job        200,000,000
Tesseract timeout           60 s / region
minimum confidence          0.72
peak working estimate       10 bytes / pixel
minimum raster scale        0.75
```

Resource violations fail closed. There is no silent downgrade from a bounded regional plan to full-page engineering OCR.

## Evidence and determinism

Evidence records the region type, source bbox, vector count, region confidence, native text count, OCR decision reason, raster dimensions/scale/pixels, confidence, engine/rasterizer versions, merge action and conflicts.

The regional mode, thresholds, resource policy, `engineering-regions-v1` revision and invoked engine/rasterizer versions participate in canonical options identity.

## Deliberate limitations

The initial segmentation is intentionally conservative. It does not yet claim semantic understanding of process-flow connectivity, equipment symbols, leader-line ownership, dimension arrows, P&ID tags, or CAD layers. Those require a graph-level engineering-drawing model and fixtures rather than broader OCR heuristics.
