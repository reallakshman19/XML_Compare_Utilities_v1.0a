"""Surface-aware evidence adapter over the existing PDF OCR result model."""
from __future__ import annotations

import hashlib

from document_evidence_observation import make_observation
from document_evidence_provider_conformance import make_provider_profile
from document_evidence_surface import canonical_pdf_page_surface, rendered_raster_surface
from document_evidence_transform import render_scale_transform

OCR_EVIDENCE_PROVIDER = "xml-compare-pdf-ocr-v1"
OCR_EVIDENCE_REVISION = "document-evidence-ocr-adapter-v1"


def adapt_ocr_page(source_hash: str, result, *, language: str = "eng", pass_id: str | None = None) -> dict:
    raster = result.raster
    image_hash = f"sha256:{hashlib.sha256(raster.png_bytes).hexdigest()}"
    page_surface = canonical_pdf_page_surface(
        source_hash, raster.page, raster.page_width, raster.page_height,
        metadata={"coordinateSpace": "displayed-page"},
    )
    raster_surface = rendered_raster_surface(
        source_hash, page_surface, raster.raster_width, raster.raster_height,
        image_sha256=image_hash, renderer="pypdfium2",
        renderer_version=result.rasterizer_version, render_scale=raster.scale,
    )
    transform = render_scale_transform(page_surface, raster_surface, raster.scale)
    profile = _provider_profile(result, language, pass_id)
    observations = [
        _word_observation(
            source_hash, page_surface, raster_surface, transform,
            result, word, image_hash, profile, language,
        )
        for word in result.words
    ]
    return {
        "schema": "DocumentEvidenceOcrPage.v1",
        "sourceHash": source_hash,
        "pageSurface": page_surface,
        "rasterSurface": raster_surface,
        "renderTransform": transform,
        "providerProfile": profile,
        "observations": observations,
        "diagnostics": [_legacy_evidence_diagnostic(result)],
    }


def _word_observation(
    source_hash, page_surface, raster_surface, transform, result, word,
    image_hash, profile, language,
):
    document_geometry = _bbox_quad(word.bbox)
    provider_geometry = _bbox_quad(_document_bbox_to_raster(word.bbox, result.raster.scale))
    extensions = {
        "confidenceScale": "legacy-normalized-0-1",
        "upstreamEngine": "tesseract-cli",
        "upstreamEngineVersion": result.engine_version,
        "rasterizerVersion": result.rasterizer_version,
        "language": language,
        "providerGeometryEvidence": "derived-from-document-bbox-v1",
        "hierarchy": {
            "block": word.block_num,
            "paragraph": word.par_num,
            "line": word.line_num,
            "word": word.word_num,
        },
    }
    return make_observation(
        "ocr", source_hash, page_surface, OCR_EVIDENCE_PROVIDER,
        OCR_EVIDENCE_REVISION, word.text, document_geometry,
        provider_profile=profile, input_raster_hash=image_hash,
        provider_confidence_raw=word.confidence,
        provider_geometry=provider_geometry, provider_surface=raster_surface,
        preprocessing_transform_hashes=(transform["transformHash"],),
        extensions=extensions,
    )


def _provider_profile(result, language, pass_id):
    options = {
        "upstreamEngineVersion": result.engine_version,
        "rasterizerVersion": result.rasterizer_version,
        "confidenceScale": "legacy-normalized-0-1",
    }
    if pass_id is not None:
        options["passId"] = str(pass_id)
    return make_provider_profile(
        "ocr", OCR_EVIDENCE_PROVIDER, OCR_EVIDENCE_REVISION,
        determinism={"semantic": "profile-bound", "artifact": "profile-bound", "bitwiseRaster": "not-claimed"},
        model="tesseract-cli", language=language,
        coordinateConvention="continuous-pixel-edges", options=options,
    )


def _legacy_evidence_diagnostic(result):
    return {
        "code": "OCR_PROVIDER_EVIDENCE_LEGACY_NORMALIZED",
        "severity": "INFO",
        "message": (
            "Current OCR result model exposes normalized confidence and document-space boxes; "
            "raster geometry is deterministically reconstructed through the render transform."
        ),
        "providerVersion": result.engine_version,
        "blocksTrustedUse": False,
    }


def _document_bbox_to_raster(bbox, scale):
    return tuple(round(float(value) * float(scale), 6) for value in bbox)


def _bbox_quad(bbox):
    x0, top, x1, bottom = (float(value) for value in bbox)
    return {
        "type": "Quad",
        "coordinates": [[x0, top], [x1, top], [x1, bottom], [x0, bottom]],
    }
