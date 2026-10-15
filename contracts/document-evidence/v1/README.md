# Document Evidence Contract v1

This directory is the canonical provider-neutral contract authority for issue #974.

## Scope

DocumentEvidence.v1 covers immutable source identity, named surfaces, invertible transforms, provider-neutral geometry, provider/render/font profiles, DOCX semantic and rendered-page identity, native/OCR observations, diagnostics, extraction decisions, table evidence, overlays, deterministic bundles, bounded OCR resources, storage policy, and append-only corrections/effective views.

`accepted` is extraction authority only. It does not assign downstream publication, benchmark, screening, or design authority.

## Core rules

1. Every coordinate belongs to a named `Surface`.
2. Every geometry-changing step, including crop, deskew, padding, and resample, has explicit forward/inverse `SurfaceTransform` lineage.
3. Observations are immutable. Decisions and corrections never rewrite machine observations.
4. Provider confidence is evidence, not a disagreement tie-breaker.
5. DOCX page numbers are render-profile-bound; OOXML remains semantic authority and the identified rendered surface is visual/page authority.
6. Resolved font-file hashes and substitutions are explicit rendered-layout evidence.
7. Provider-neutral geometry retains exact cubic controls plus style/clip/CTM/image/raw-provider evidence.
8. Stale source/surface/transform overlays fail closed.
9. Persistent evidence is not retrieval-eligible without a content-addressed storage policy defining TTL, access scope, eviction, and retained-byte limits.
10. Diagnostic behavior is governed by `diagnostic-catalog.json`.

## Normative contract files

- source/surface/transform: `source.schema.json`, `surface.schema.json`, `transform.schema.json`
- geometry: `geometry.schema.json`, `geometry-evidence.schema.json`
- provider/rendering: `provider-profile.schema.json`, `render-profile.schema.json`, `resolved-font-manifest.schema.json`
- DOCX: `docx-page-authority.schema.json`, `docx-semantic-content.schema.json`, `docx-semantic-ref.schema.json`, `docx-semantic-visual-map.schema.json`
- text/evidence: `native-quality.schema.json`, `observation.schema.json`, `decision.schema.json`, `diagnostic.schema.json`, `diagnostic-catalog.json`
- tables/UI: `table-pass.schema.json`, `table-discovery.schema.json`, `table-extraction.schema.json`, `overlay.schema.json`
- determinism/portability: `machine-evidence-envelope.schema.json`, `evidence-bundle-manifest.schema.json`, `storage-policy.schema.json`, `ocr-resource-policy.schema.json`
- review lineage: `correction-event.schema.json`, `effective-evidence-view.schema.json`
- catalogs/conformance: `openapi.yaml`, `coordinate-conventions.md`, `canonicalization.md`, `conformance/transform-vectors.json`, `conformance/provider-invariants-v1.json`, `conformance/qualification-v1.json`, `conformance/controlled-real-fixture-v1.json`, `conformance/scanned-real-fixture-v1.json`, `conformance/broken-tounicode-real-fixture-v1.json`

## Portability and qualification

XML_Compare_Utilities owns these contracts; other repositories are conformance implementations and do not become independent schema authorities. Provider conformance is based on source/surface/transform/lineage invariants, not exact equality of OCR output between providers.

Two qualification layers are intentionally retained:

- `qualification-v1.json` plus `scripts/document_evidence_qualification.py` provides deterministic fault injection for transform round-trip, numeric OCR disagreement, DOCX renderer-profile drift/same-profile nondeterminism, cubic controls, envelope ordering, and source-lineage rejection.
- real controlled fixtures exercise actual parser/render/OCR paths: `controlled-real-fixture-v1.json` binds a reviewable born-digital PDF and OOXML DOCX; `scanned-real-fixture-v1.json` binds an image-only low-contrast +2.75 degree skewed PDF with nonzero CropBox and `/Rotate 90`; `broken-tounicode-real-fixture-v1.json` binds a PDF whose visual `T3-1` is corrupted by ToUnicode to native `T3-�` while OCR sees the rendered glyph.

Real fixture byte identities are predeclared before parser assertions. PDF/OCR tests use the pinned optional PDF dependency profile and skip visibly when that profile or the deployed Tesseract CLI is absent; the tests do not replace missing providers with mocks.

No cross-platform bitwise raster guarantee is claimed. Controlled DOCX fixture ZIP entries use stored compression, fixed timestamps, stable ordering, and fixed permissions so its qualification byte identity does not depend on a zlib implementation.

Controlled source targets remain fail-closed until exact source locators are proven against the pinned source. Legacy coordinate artifacts missing source/surface/transform/profile identity require an explicit adapter or rebuild; they are never silently reinterpreted under v1.

## Versioning

The directory name is the schema major version. Breaking coordinate semantics, hash semantics, required identity fields, or decision-state meaning require a new major directory.
