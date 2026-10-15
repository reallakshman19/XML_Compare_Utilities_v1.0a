# PDF dependency review

## Decision

Use `pdfplumber` / `pdfminer.six` as an **optional native positioned-text/layout backend** for the server/CLI PDF slice.

Pinned runtime:

```text
pdfplumber==0.11.10
pdfminer.six==20260107
```

The DOCX path remains Python-stdlib-only. Installing PDF support is opt-in through `requirements-pdf.txt`.

## Why pdfplumber / pdfminer.six

The required native slice needs character-level geometry and layout objects rather than only plain extracted text. The upstream pdfplumber API exposes detailed character objects, line/rectangle/curve/image objects, de-duplication, and table-oriented geometric primitives while building on pdfminer.six.

The architecture does not expose pdfplumber objects above `PdfPlumberBackend`; all line clustering, text-quality scoring, page classification, running-content detection, reading-order reconstruction, paragraph grouping and heading inference are project-owned deterministic functions.

## License boundary

Upstream pdfplumber and pdfminer.six are MIT-licensed. This is suitable for an optional CLI/server dependency boundary.

PyMuPDF was reviewed but is not the default selected backend because its upstream licensing is AGPL/commercial. A dependency name alone is not sufficient justification for this project; the default should not unexpectedly impose an AGPL runtime boundary.

`pypdfium2` is present in pdfplumber's broader ecosystem for some rendering/image workflows and has a liberal Apache-2.0/BSD-3-Clause project license plus PDFium third-party notices. The current native-text slice does not invoke PDF rasterization; raster/OCR dependency review will be performed separately before OCR is enabled.

## Determinism policy

Actual `pdfplumber` and `pdfminer.six` versions are recorded in evidence and incorporated into canonical options identity. The pinned requirements are therefore both deployment controls and provenance inputs.

The converter must not silently change backend versions while claiming an identical canonical conversion profile.

## Runtime / performance boundary

Native extraction is bounded by project-owned limits before higher-level layout reconstruction:

- default 2,000-page maximum;
- maximum page area of 200,000,000 point²;
- maximum 1,000,000 native characters per page;
- deterministic character de-duplication where supported by the backend.

OCR/raster resource budgets are intentionally outside this dependency decision and remain disabled in the native slice.

## Reference-only projects

`reallaksh19/Pdf-Hub` remains reference-only. Useful concepts such as positioned text, page classification and raster resource policy may be adapted, but `XML_Compare_Utilities` does not create a cross-repository runtime dependency on the browser/TypeScript application.
