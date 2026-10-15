"""Build exact OCR TablePass evidence from an external reconstruction adapter."""
from __future__ import annotations

from document_evidence_observation import make_observation
from document_evidence_pdf_ocr_provider import adapt_ocr_page
from document_evidence_provider_conformance import make_provider_profile
from document_evidence_table import TableEvidenceError, make_table_pass, reconcile_table_passes

_CELL_PROVIDER = "document-evidence-ocr-cell-reconstruction"
_CELL_PROVIDER_VERSION = "v1"


def make_ocr_table_pass(
    source_hash,
    ocr_result,
    table_candidate_id,
    reconstructed_cells,
    *,
    pass_id,
    language="eng",
) -> dict:
    ocr_evidence = adapt_ocr_page(
        source_hash, ocr_result, language=language, pass_id=pass_id,
    )
    raw_observations = ocr_evidence["observations"]
    profile = _cell_provider_profile(pass_id, language)
    cells, cell_observations = _reconstructed_cells(
        source_hash, ocr_evidence["pageSurface"], reconstructed_cells,
        raw_observations, profile, pass_id,
    )
    table_pass = make_table_pass(
        table_candidate_id, pass_id, ocr_evidence["pageSurface"], cells,
    )
    return {
        "schema": "DocumentEvidenceOcrTablePass.v1",
        "ocrEvidence": ocr_evidence,
        "cellProviderProfile": profile,
        "cellObservations": cell_observations,
        "tablePass": table_pass,
    }


def reconcile_table_evidence_passes(pass_evidence, *, required_pass_ids=None) -> tuple[dict, ...]:
    bundles = tuple(pass_evidence)
    table_passes = [item["tablePass"] for item in bundles]
    observations = {}
    for item in bundles:
        for observation in _bundle_observations(item):
            observations[observation["observationHash"]] = observation
    return reconcile_table_passes(
        table_passes, observations, required_pass_ids=required_pass_ids,
    )


def _reconstructed_cells(source_hash, surface, cells, raw_observations, profile, pass_id):
    table_cells, cell_observations = [], []
    for cell in cells:
        observation = _cell_observation(
            source_hash, surface, cell, raw_observations, profile, pass_id,
        )
        table_cells.append({
            "rowIndex": cell["rowIndex"], "columnIndex": cell["columnIndex"],
            "geometry": cell["geometry"], "observations": [observation],
        })
        cell_observations.append(observation)
    return table_cells, cell_observations


def _cell_observation(source_hash, surface, cell, raw_observations, profile, pass_id):
    selected = _selected_words(cell, raw_observations)
    text = " ".join(item["normalizedText"] for item in selected).strip()
    if not text:
        raise TableEvidenceError("OCR_TABLE_CELL_TEXT_REQUIRED", "OCR reconstructed cell text is empty")
    raster_hashes = {item.get("inputRasterHash") for item in selected if item.get("inputRasterHash")}
    raster_hash = next(iter(raster_hashes)) if len(raster_hashes) == 1 else None
    return make_observation(
        "ocr", source_hash, surface, _CELL_PROVIDER, _CELL_PROVIDER_VERSION,
        text, cell["geometry"], provider_profile=profile,
        input_raster_hash=raster_hash,
        extensions={
            "passId": str(pass_id), "reconstructionMethod": "ordered-word-space-join-v1",
            "wordObservationHashes": [item["observationHash"] for item in selected],
        },
    )


def _selected_words(cell, observations):
    indexes = tuple(cell.get("wordIndexes") or ())
    if not indexes:
        raise TableEvidenceError(
            "OCR_TABLE_CELL_WORD_REQUIRED",
            "OCR reconstructed cell requires at least one word index",
        )
    selected = []
    for index in indexes:
        if isinstance(index, bool) or not isinstance(index, int) or index < 0 or index >= len(observations):
            raise TableEvidenceError(
                "OCR_TABLE_WORD_INDEX_INVALID",
                f"OCR word index is outside observation range: {index}",
            )
        selected.append(observations[index])
    return selected


def _cell_provider_profile(pass_id, language):
    return make_provider_profile(
        "ocr", _CELL_PROVIDER, _CELL_PROVIDER_VERSION,
        determinism={"semantic": "guaranteed", "artifact": "not-applicable", "bitwiseRaster": "not-applicable"},
        model="ordered-word-space-join-v1", language=language,
        coordinateConvention="document-surface", options={"passId": str(pass_id)},
    )


def _bundle_observations(bundle):
    values = list(bundle.get("observations", ()))
    if "ocrEvidence" in bundle:
        values.extend(bundle["ocrEvidence"]["observations"])
    values.extend(bundle.get("cellObservations", ()))
    return values
