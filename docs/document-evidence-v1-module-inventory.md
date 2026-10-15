# Document Evidence v1 — Current Module Inventory

This inventory is the implementation-time decision record for XML_Compare_Utilities issue #974. It describes current owners and prevents parallel OCR/render/table stacks from being introduced accidentally.

| Module / owner | Decision | Evidence-platform role |
|---|---|---|
| `scripts/document_conversion_api.py` | **REFACTOR** | Keep the single controlled HTTP server. Add v2 evidence routes additively; preserve v1 compatibility. |
| `scripts/document_conversion_service.py` | **REUSE / REFACTOR** | Keep source custody, bounded reads, conversion dispatch, source hashing, search and existing service policy. Evidence routes reuse its path/root/resource controls. |
| `scripts/pdf_page_range.py` | **REUSE** | Exact 1-based source-page scoping. Governed extraction must use explicit pages and reuse range-scoped backends. |
| `scripts/pdf_tables.py` | **REUSE / ADAPT** | Existing ruled/text table discovery, overlap reconciliation, confidence diagnostics and semantic table normalization remain the table parser owners. Generic evidence wraps their outputs. |
| `scripts/pdf_ocr.py` | **REUSE / ADAPT** | Existing PDFium rasterizer, Tesseract CLI engine and bounded OCR runner remain the OCR execution owners. Evidence adapters add source/surface/provider lineage without creating a second OCR engine. |
| `scripts/pdf_ocr_conversion.py` | **ADAPT** | Existing OCR conversion behavior remains compatibility logic; new evidence consumers should prefer explicit observations/decisions rather than treating rendered OCR text as authority. |
| `scripts/pdf_search_index.py` | **REFACTOR LATER** | Search owner remains in place. Future reviewed/effective-text indexing must add evidence/correction-set identities without a parallel index implementation. |
| `scripts/pdf_engineering_conversion.py` | **ADAPT AS CONSUMER** | Engineering conversion consumes generic evidence; it must not own generic coordinate transforms or OCR reconciliation policy. |
| PR #973 `pdf_chart_*` render path | **REFACTOR / REUSE** | Existing explicit-page PDFium render proving ground becomes generic surface/render evidence incrementally. Chart digitization remains outside the generic core. |
| PR #973 `pdf_chart_*` vector path | **REFACTOR / REUSE** | Existing pdfplumber line/rect/curve inspection remains the vector provider; normalization now emits provider-neutral geometry while preserving legacy fields and cubic controls. |
| `scripts/document_evidence_surface.py` | **NEW CANONICAL RUNTIME OWNER** | Provider-neutral surface identity. |
| `scripts/document_evidence_transform.py` | **NEW CANONICAL RUNTIME OWNER** | Provider-neutral affine transform/inverse/round-trip owner. |
| `scripts/document_evidence_geometry.py` | **NEW CANONICAL RUNTIME OWNER** | Provider-neutral geometry normalization; exact cubic controls retained. |
| `scripts/document_evidence_observation.py` | **NEW CANONICAL RUNTIME OWNER** | Immutable source/surface/provider-bound observations. |
| `scripts/document_evidence_decision.py` | **NEW CANONICAL RUNTIME OWNER** | Extraction-only reconciliation; differing numeric values fail closed. |
| `scripts/document_evidence_correction.py` | **NEW CANONICAL RUNTIME OWNER** | Append-only human review events outside deterministic machine evidence. |
| `scripts/document_evidence_table.py` | **NEW CANONICAL COORDINATION OWNER** | Exact per-pass cell identity/alignment; it does not discover table structure itself. |
| `scripts/document_evidence_table_extract.py` | **NEW CANONICAL COORDINATION OWNER** | Discovery-vs-governed-extraction boundary, exact source hash and explicit page enforcement. |
| `scripts/document_evidence_pdf_table_provider.py` | **ADAPTER** | Thin bridge from existing `pdf_tables.py` / `pdf_page_range.py` into evidence providers. No hidden parser algorithm. |
| `scripts/document_evidence_pdf_ocr_provider.py` | **ADAPTER** | Thin surface-aware wrapper around existing OCR results. Current legacy normalized-confidence/derived-raster limitations are labeled explicitly. |
| `scripts/document_evidence_ocr_table_assignment.py` | **NEW BOUNDED COORDINATION OWNER** | Assign OCR words only to already-proven table cells by geometry; ambiguous memberships are not guessed. |
| `scripts/document_evidence_ocr_table_provider.py` | **ADAPTER / COORDINATION** | Builds one OCR observation per reconstructed logical cell and exact OCR TablePass evidence. |
| `scripts/document_evidence_table_http.py` | **THIN TRANSPORT ADAPTER** | Adds `/v2/tables/discover` and `/v2/tables/extract` on the existing server; contains strict request/resource policy but no table parser. |
| `scripts/document_evidence_controlled_fixtures.py` | **QUALIFICATION ONLY** | Generates deterministic reviewable born-digital PDF and OOXML DOCX sources for real parser/render/geometry/semantic tests. It is never a production renderer or parser. |
| `scripts/document_evidence_scanned_fixture.py` | **QUALIFICATION ONLY** | Generates the pinned Pillow image-only low-contrast, rotated/skewed PDF qualification source used to exercise actual PDFium/Tesseract paths. |
| `scripts/document_evidence_broken_tounicode_fixture.py` | **QUALIFICATION ONLY** | Generates a real PDF with a deliberately corrupt ToUnicode mapping so native extraction can be compared with actual rendered OCR. |
| `scripts/profiles/ei_aviff_stage5c/source_targets.py` | **DOMAIN PROFILE (L6 OUTSIDE CORE)** | Semantic source-target mapping only. No engineering/screening/design authority. |
| Pipeline 3D Model OCR table parser(s) | **ADAPT / REFERENCE** | Existing fail-closed reconstruction behavior may inform a reconstruction adapter, but consumer-side parsers are not generic evidence authority. |
| External Word-to-Table implementation | **REFERENCE_ONLY / PENDING_INSPECTION** | No unique inspectable repository/commit has been identified. Do not reuse or adapt until exact source, license, dependencies, tests, coordinate assumptions and failure behavior are proven. No qualification claim depends on it. |
| Pdf-Hub OCR/render modules | **ADAPT AFTER OWNER TASK ACTIVATION** | Future TypeScript conformance implementation only; XML contracts remain schema authority and there is no runtime coupling. |
| 3D_Converters | **CONSUMER ONLY FOR THIS STAGE** | No OCR/reconciliation implementation. Candidate-master/publication/calculation authority remains separate downstream governance. |

## Anti-duplication rule

New functionality must extend one of the owners above or provide a thin schema/provider adapter. A new renderer, OCR engine, table parser, HTTP server, search index, engineering tolerance engine or chart digitizer requires a separately reviewed architecture change.
