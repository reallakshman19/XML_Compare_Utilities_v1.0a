# Document search, OCR indexing, conversion API and UI

This capability is a thin HTTP/UI layer over the existing deterministic DOCX/PDF -> Markdown engine. It does not create a second parser, table engine, OCR engine, or Markdown renderer.

For PDF discovery it adapts useful search/index concepts from `reallaksh19/Pdf-Hub@162274faf8f8badf01148978e8b1b4b54b724ce3`: positioned page-text indexing, page/bbox-aware OCR records, deterministic search ordering, and a page-grouped search workflow. The reviewed Pdf-Hub frontend code is MIT-licensed. There is no Pdf-Hub runtime dependency.

## Start the API and browser workspace

At least one controlled source root is required:

```bash
python scripts/document_conversion_api.py \
  --host 127.0.0.1 \
  --port 8765 \
  --allow-root /Common
```

Open:

```text
http://127.0.0.1:8765/document-conversion/
```

For a sibling Common checkout:

```bash
python scripts/document_conversion_api.py --allow-root ../Common
```

`DOCUMENT_CONVERSION_ALLOWED_ROOTS` may contain multiple platform-path-separated roots.

The browser workspace and API use the same origin. No wildcard CORS policy is required.

## Intended workflow

```text
controlled PDF
  -> search/index native text + controlled OCR fallback
  -> return every trusted match with original page/bbox/provenance
  -> user/app chooses the required page range
  -> convert only that explicit range
  -> Markdown + evidence + diagnostics
```

Search never silently chooses or expands the conversion range. The user/application remains the authority for the range passed to conversion.

## Browser UI

The `/document-conversion/` workspace provides three explicit stages:

1. **Search PDF** — source path, optional password, query, case/whole-word options, OCR mode/language/confidence.
2. **Choose pages** — results are grouped by original PDF page and labeled `Native` or `OCR`; OCR hits show confidence. Selecting result pages sets the min/max conversion range, while a manually typed range clears chip selection so the authority remains unambiguous.
3. **Convert to Markdown** — choose table/OCR/engineering-region/header/footer policies, convert the bounded range, inspect Markdown or evidence, then copy/download Markdown or evidence JSON.

The UI does not use `innerHTML` for extracted document text. Search snippets are built using DOM text nodes and `<mark>` elements.

## Search `T2.3`

```bash
curl --fail --silent --show-error \
  http://127.0.0.1:8765/v1/search \
  -H 'Content-Type: application/json' \
  --data-binary @- <<'JSON'
{
  "sourcePath": "/Common/EI - AVIFF Guidelines 2nd Edition.pdf",
  "query": "T2.3",
  "options": {
    "caseSensitive": false,
    "wholeWord": false,
    "useRegex": false,
    "ocr": "auto",
    "ocrLanguage": "eng",
    "ocrConfidenceMin": 0.70
  }
}
JSON
```

For encrypted PDFs, add a top-level `password` field. Passwords are not returned in response identity or logged by application code.

### Search response

The response contains:

- source SHA-256 and size;
- deterministic search/index identities;
- index cache source (`built`, `memory`, or `disk`);
- original total page count;
- native/OCR indexed page information;
- pages that remain without trusted searchable text;
- every trusted match;
- `pagesWithMatches` for caller navigation/selection;
- diagnostics.

Representative hit:

```json
{
  "id": "pdf-search:...",
  "page": 56,
  "itemId": "ocr:p56:l3",
  "matchText": "T2.3",
  "lineText": "...",
  "snippet": "... T2.3 ...",
  "bbox": [72.0, 118.0, 410.0, 131.0],
  "bboxPrecision": "line",
  "extraction": "ocr",
  "confidence": 0.93
}
```

The page number above only illustrates the schema. It is not asserted as an EI source locator until the API is run against the exact controlled PDF.

## Native + OCR search policy

Search uses the same source stack as conversion:

```text
existing pdfplumber/pdfminer positioned native extraction
  -> native text quality gate
  -> existing PdfiumRasterizer when OCR is required
  -> existing TesseractCliEngine
  -> confidence gate
  -> geometric/text dedup against native text
  -> deterministic search index
```

Search OCR modes:

```text
auto    OCR pages whose native text quality is inadequate
always  OCR every page, then deduplicate against native text
never   index native text only
```

Default minimum OCR confidence is `0.70`. OCR lines below the configured threshold do not enter the search index.

Native/OCR duplicate suppression requires overlapping geometry plus high normalized-text similarity. Native text remains the preferred search representation when equivalent OCR text overlaps it.

Resource gates are fail-closed. Defaults include:

```text
source PDF pages            2000
search OCR pages             100
search OCR job pixels        250,000,000
search OCR timeout/page       60 seconds
search index characters       20,000,000
search result matches          5,000
```

If the result limit would be exceeded, search fails with `PDF_SEARCH_RESULT_LIMIT_EXCEEDED`; it never silently truncates the result set.

Regex execution remains disabled. Literal search supports case-sensitive and whole-word modes.

## Persistent search indexes

Persistent PDF search indexing is enabled by default. Unless overridden, indexes are written to:

```text
~/.cache/xml-compare-utilities/pdf-search
```

Override it with:

```bash
python scripts/document_conversion_api.py \
  --allow-root /Common \
  --search-index-dir /var/cache/xml-compare/pdf-search
```

Or set:

```text
DOCUMENT_CONVERSION_SEARCH_INDEX_DIR
```

For memory-only operation:

```bash
python scripts/document_conversion_api.py \
  --allow-root /Common \
  --no-persistent-search-index
```

Persistent-index properties:

- deterministic hashed filenames, not source filenames;
- canonical JSON payloads with no timestamps;
- atomic temp-file replacement;
- best-effort owner-only `0600` file permissions;
- bounded persisted document count, default `32`;
- key partitioning by source SHA-256, index revision, password fingerprint, OCR mode, OCR language, and confidence threshold;
- corrupt/mismatched stored indexes are ignored and rebuilt from the authoritative PDF;
- the plaintext index contains extracted source text and should therefore be stored with the same confidentiality controls as the source document.

A successful response identifies the source used for that request:

```text
cacheSource = built | memory | disk
```

## Choose pages, then convert

After search, the caller may determine that pages 56-68 are the required section. Conversion remains a separate request:

```bash
curl --fail --silent --show-error \
  http://127.0.0.1:8765/v1/convert \
  -H 'Content-Type: application/json' \
  --data-binary @- <<'JSON'
{
  "sourcePath": "/Common/EI - AVIFF Guidelines 2nd Edition.pdf",
  "pages": { "start": 56, "end": 68 },
  "options": {
    "tableMode": "auto",
    "ocr": "auto",
    "ocrLanguage": "eng",
    "images": "skip",
    "headers": "metadata",
    "footers": "metadata",
    "engineeringRegions": "auto"
  }
}
JSON
```

Page ranges are **1-based and inclusive**. The range layer injects page-aware native/table/figure/engineering adapters into the existing conversion stack; it does not create a temporary subset PDF. Source page 56 therefore remains page 56 in text, tables, OCR, figures, engineering regions, diagnostics, and evidence.

The response includes Markdown, source identity, explicit page range, deterministic request hash, converter options hash, evidence, diagnostics, and conversion statistics.

Range conversion emits `PDF_PAGE_RANGE_CONTEXT_LIMITED` because document-level heading/running-content inference is necessarily scoped to the requested range.

## Conversion options

```text
headers             keep | metadata | drop
footers             keep | metadata | drop
tableMode           auto | markdown | html | records
ocr                 auto | always | never
ocrLanguage         Tesseract language expression, e.g. eng
images              skip
engineeringRegions  auto | always | never
revisions           accepted | rejected | markup   (DOCX)
```

API v1 intentionally requires `images=skip`. Binary figure-asset transport is not silently improvised; `images=extract` fails with `API_ASSET_TRANSPORT_NOT_IMPLEMENTED`.

## DOCX

`POST /v1/convert` accepts `.docx` and routes through the existing DOCX conversion engine. DOCX conversion is whole-document in this API version; PDF-style `pages` are rejected with `DOCX_PAGE_RANGE_UNSUPPORTED`.

`POST /v1/search` remains PDF-only. DOCX search is not part of this slice.

## Security boundary

The server is an application/backend service, not an unrestricted filesystem or network proxy.

- source paths must resolve under explicit `--allow-root` roots;
- symlink/path-traversal escapes are rejected after canonical resolution;
- remote source URLs are never fetched;
- search is PDF-only;
- conversion accepts PDF/DOCX only;
- request, source, range, page, search-index, OCR, result, cache, and concurrency limits are explicit;
- invalid search queries/options fail before expensive indexing where possible;
- arbitrary regex is disabled;
- password-bearing index caches are partitioned by a one-way password fingerprint;
- UI/API responses use `Cache-Control: no-store`;
- UI assets are served from a fixed allowlist only;
- browser responses use `nosniff`, `no-referrer`, and a self-only Content Security Policy;
- no wildcard CORS headers are emitted.

## Server flags

```text
--allow-root PATH                    repeatable controlled source root
--max-source-mb N
--max-range-pages N
--max-source-pages N
--max-search-index-chars N
--max-search-results N
--max-search-cache-documents N
--search-index-dir PATH
--no-persistent-search-index
--max-search-persisted-documents N
--search-ocr-confidence-min N
--search-ocr-max-pages N
--search-ocr-max-job-pixels N
--search-ocr-timeout-seconds N
--max-request-kb N
--max-concurrency N
```

## Routes

```text
GET  /                         -> redirects to the workspace
GET  /document-conversion/     browser workspace
GET  /healthz
GET  /v1/capabilities
POST /v1/search
POST /v1/convert
```

## Current limitations

- Search is PDF-only.
- Regex search is disabled.
- Search indexing is line-oriented; returned bbox precision is `line`.
- Low-confidence OCR lines are deliberately excluded and may leave pages marked unsearchable.
- The API does not transport extracted binary figure assets yet (`images=skip`).
- The browser workspace consumes mounted/allowed server paths; it does not upload arbitrary local browser files.
