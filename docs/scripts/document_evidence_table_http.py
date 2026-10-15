"""Thin HTTP-operation adapters for governed DocumentEvidence table routes."""
from __future__ import annotations

import hashlib

from document_evidence_pdf_table_provider import (
    make_pdf_table_candidate_provider,
    make_pdf_table_page_provider,
)
from document_evidence_table_extract import (
    GovernedTableError,
    discover_table_candidates,
    extract_table_evidence,
)

DISCOVER_ROUTE = "/v2/tables/discover"
EXTRACT_ROUTE = "/v2/tables/extract"
_TABLE_OCR_MODES = {"never", "always"}
_TABLE_OCR_MAX_PAGE_PIXELS = 24_000_000
_TABLE_OCR_MAX_DIMENSION = 12_000
_TABLE_OCR_MAX_JOB_OUTPUT_BYTES = 128 * 1024 * 1024
_TABLE_OCR_MAX_TIMEOUT_SECONDS = 30.0


def table_route_operations(config) -> dict:
    return {
        DISCOVER_ROUTE: lambda body: _as_conversion_api_error(
            discover_tables_request, body, config,
        ),
        EXTRACT_ROUTE: lambda body: _as_conversion_api_error(
            extract_tables_request, body, config,
        ),
    }


def discover_tables_request(
    payload,
    config,
    *,
    source_loader=None,
    candidate_provider=None,
) -> dict:
    request = _parse_payload(payload, required=("sourcePath",), allowed=("sourcePath",))
    source_bytes, raw_source = (source_loader or _default_source_loader)(request, config)
    source = _source_identity(source_bytes, raw_source)
    provider = candidate_provider or make_pdf_table_candidate_provider(
        max_source_pages=config.max_source_pages,
    )
    result = discover_table_candidates(source_bytes, provider)
    return {**result, "source": source}


def extract_tables_request(
    payload,
    config,
    *,
    source_loader=None,
    page_provider=None,
    ocr_runner=None,
) -> dict:
    request = _parse_payload(
        payload,
        required=("sourcePath", "sourceHash", "pages"),
        allowed=("sourcePath", "sourceHash", "pages", "options"),
    )
    options = _table_options(request.get("options"))
    source_bytes, raw_source = (source_loader or _default_source_loader)(request, config)
    source = _source_identity(source_bytes, raw_source)
    provider = page_provider or make_pdf_table_page_provider(
        max_source_pages=config.max_source_pages,
    )
    result = extract_table_evidence(
        source_bytes,
        request["sourceHash"],
        request["pages"],
        provider,
        max_selected_pages=config.max_range_pages,
    )
    if options["ocr"] == "always":
        result = _add_ocr_passes(
            result, source_bytes, options, config, ocr_runner or _default_table_ocr_runner,
        )
    return {**result, "source": source, "options": options}


def table_api_capabilities() -> dict:
    return {
        "documentEvidenceTables": {
            "discoveryEndpoint": DISCOVER_ROUTE,
            "extractionEndpoint": EXTRACT_ROUTE,
            "governedExtractionRequires": ["sourceHash", "pages"],
            "ocr": ["never", "always"],
            "ocrAttemptsPerPage": 1,
            "ocrMaxPagePixels": _TABLE_OCR_MAX_PAGE_PIXELS,
            "encryptedPdf": False,
            "engineeringAuthority": "NONE",
        }
    }


def _add_ocr_passes(result, source_bytes, options, config, ocr_runner):
    from document_evidence_ocr_table_assignment import assign_ocr_words_to_cells
    from document_evidence_ocr_table_provider import make_ocr_table_pass, reconcile_table_evidence_passes

    pages = tuple(result["pages"])
    max_pixels = min(
        _TABLE_OCR_MAX_PAGE_PIXELS,
        config.search_ocr_max_job_pixels // max(1, len(pages)),
    )
    max_output = _TABLE_OCR_MAX_JOB_OUTPUT_BYTES // max(1, len(pages))
    ocr_by_page = {
        page: ocr_runner(
            source_bytes, page, options["ocrLanguage"], max_pixels,
            max_output, min(config.search_ocr_timeout_seconds, _TABLE_OCR_MAX_TIMEOUT_SECONDS),
        )
        for page in pages
    }
    return _merge_ocr_tables(result, ocr_by_page, assign_ocr_words_to_cells, make_ocr_table_pass, reconcile_table_evidence_passes)


def _merge_ocr_tables(result, ocr_by_page, assigner, pass_builder, reconciler):
    tables = []
    for table in result["tables"]:
        page = table["candidate"]["page"]
        assignment = assigner(table["tablePass"], ocr_by_page[page].words)
        ocr_bundle = pass_builder(
            result["sourceHash"], ocr_by_page[page], table["candidate"]["candidateId"],
            assignment["cells"], pass_id="ocr:base",
        )
        decisions = reconciler(
            [table, ocr_bundle],
            required_pass_ids=(table["tablePass"]["passId"], "ocr:base"),
        )
        tables.append({
            **table,
            "ocrPass": ocr_bundle,
            "ocrAssignmentDiagnostics": assignment["diagnostics"],
            "cellDecisions": list(decisions),
        })
    return {**result, "tables": tables}


def _default_table_ocr_runner(source_bytes, page, language, max_pixels, max_output, timeout):
    from pdf_ocr import PdfiumPageRasterizer, TesseractCliEngine, run_ocr_page

    return run_ocr_page(
        source_bytes, page,
        rasterizer=PdfiumPageRasterizer(),
        engine=TesseractCliEngine(),
        language=language,
        scale=3.0,
        max_pixels=max_pixels,
        max_dimension=_TABLE_OCR_MAX_DIMENSION,
        max_output_bytes=max_output,
        timeout_seconds=timeout,
    )


def _table_options(raw):
    value = dict(raw or {})
    unknown = sorted(set(value) - {"ocr", "ocrLanguage"})
    if unknown:
        raise GovernedTableError(
            "TABLE_API_OPTION_UNKNOWN",
            f"unsupported table option(s): {', '.join(unknown)}",
        )
    mode = value.get("ocr", "never")
    language = value.get("ocrLanguage", "eng")
    if mode not in _TABLE_OCR_MODES:
        raise GovernedTableError("TABLE_OCR_MODE_INVALID", "table OCR must be never or always")
    if not isinstance(language, str) or not language.strip():
        raise GovernedTableError("TABLE_OCR_LANGUAGE_INVALID", "ocrLanguage must be a non-empty string")
    return {"ocr": mode, "ocrLanguage": language.strip()}


def _parse_payload(payload, *, required, allowed):
    if not isinstance(payload, dict):
        raise GovernedTableError("TABLE_API_PAYLOAD_INVALID", "request body must be an object")
    unknown = sorted(set(payload) - set(allowed))
    if unknown:
        raise GovernedTableError(
            "TABLE_API_OPTION_UNKNOWN",
            f"unsupported request field(s): {', '.join(unknown)}",
        )
    missing = [key for key in required if payload.get(key) in (None, "", [])]
    if missing:
        raise GovernedTableError(
            "TABLE_API_FIELD_REQUIRED",
            f"required request field(s): {', '.join(missing)}",
        )
    return dict(payload)


def _source_identity(source_bytes, raw_source):
    value = dict(raw_source or {})
    digest = hashlib.sha256(source_bytes).hexdigest()
    source_hash = f"sha256:{digest}"
    if value.get("sizeBytes") not in (None, len(source_bytes)):
        raise GovernedTableError(
            "TABLE_SOURCE_METADATA_MISMATCH",
            "source metadata size does not match source bytes",
        )
    if value.get("schema") == "SourceIdentity.v1":
        if value.get("sha256") != source_hash or value.get("mediaType") != "application/pdf":
            raise GovernedTableError(
                "TABLE_SOURCE_IDENTITY_MISMATCH",
                "provided SourceIdentity.v1 does not match PDF source bytes",
            )
        return value
    result = {
        "schema": "SourceIdentity.v1",
        "sourceId": f"source:{digest[:24]}",
        "sha256": source_hash,
        "mediaType": "application/pdf",
        "sizeBytes": len(source_bytes),
    }
    if isinstance(value.get("logicalPath"), str) and value["logicalPath"]:
        result["logicalPath"] = value["logicalPath"]
    return result


def _default_source_loader(request, config):
    from document_conversion_service import _read_bounded, resolve_source_path

    resolved = resolve_source_path(request["sourcePath"], config.allowed_roots)
    if resolved.suffix.lower() != ".pdf":
        raise GovernedTableError("TABLE_PDF_SOURCE_REQUIRED", "table evidence routes require a PDF source")
    source_bytes = _read_bounded(resolved, config.max_source_bytes)
    return source_bytes, {
        "logicalPath": request["sourcePath"],
        "type": "pdf",
        "sizeBytes": len(source_bytes),
    }


def _as_conversion_api_error(operation, payload, config):
    try:
        return operation(payload, config)
    except GovernedTableError as exc:
        from document_conversion_service import ConversionApiError
        raise ConversionApiError(exc.code, str(exc), 422) from exc
