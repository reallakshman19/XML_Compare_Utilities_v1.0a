"""Executable qualification checks for the DocumentEvidence.v1 reference runtime."""
from __future__ import annotations

from document_evidence_decision import reconcile_cell
from document_evidence_docx import classify_docx_render_change
from document_evidence_geometry import normalize_pdfplumber_primitive
from document_evidence_observation import make_observation
from document_evidence_surface import canonical_pdf_page_surface, make_surface
from document_evidence_transform import make_transform


def run_qualification(fixture: dict) -> dict:
    checks = [
        _transform_check(fixture), _numeric_conflict_check(fixture),
        _docx_profile_check(fixture), _docx_nondeterminism_check(fixture),
        _cubic_check(fixture),
    ]
    return {"schema": "DocumentEvidenceQualificationResult.v1", "passed": all(item["passed"] for item in checks), "checks": checks}


def _transform_check(fixture):
    item = fixture["pdfTransform"]
    source = canonical_pdf_page_surface(fixture["sourceHash"], 1, item["source"]["width"], item["source"]["height"])
    target = make_surface(fixture["sourceHash"], "ocr-preprocessed-raster", item["target"]["width"], item["target"]["height"], "px", "top-left", "right", "down", page_number=1)
    scale = float(item["scale"])
    transform = make_transform(source, target, "qualification-scale", [scale, 0, 0, 0, scale, 0, 0, 0, 1])
    error = transform["numericValidation"]["continuousRoundTripMaxError"]
    return _check("transform-roundtrip", error <= item["continuousTolerancePt"], {"maxError": error})


def _numeric_conflict_check(fixture):
    item = fixture["ocrNumericConflict"]
    surface = canonical_pdf_page_surface(fixture["sourceHash"], 1, 100, 80)
    geometry = {"type": "Quad", "coordinates": [[1, 1], [9, 1], [9, 4], [1, 4]]}
    left = make_observation("ocr", fixture["sourceHash"], surface, "qual-a", "1", item["leftText"], geometry, provider_confidence_raw=item["leftConfidence"])
    right = make_observation("ocr", fixture["sourceHash"], surface, "qual-b", "1", item["rightText"], geometry, provider_confidence_raw=item["rightConfidence"])
    decision = reconcile_cell([left, right], logical_cell_id="qualification-cell")
    passed = decision["state"] == item["expectedState"] and item["expectedDiagnostic"] in decision["diagnosticCodes"] and "selectedObservationHash" not in decision
    return _check("ocr-numeric-conflict", passed, {"state": decision["state"], "diagnostics": decision["diagnosticCodes"]})


def _docx_profile_check(fixture):
    item = fixture["docx"]
    before = {"semanticContentHash": item["semanticContentHash"], "renderProfileHash": item["profileA"], "surfaceHash": item["surfaceA"]}
    after = {"semanticContentHash": item["semanticContentHash"], "renderProfileHash": item["profileB"], "surfaceHash": item["surfaceB"]}
    result = classify_docx_render_change(before, after)
    return _check("docx-render-profile-drift", result["diagnosticCode"] == "DOCX_RENDER_PROFILE_CHANGED" and not result["semanticContentChanged"], result)


def _docx_nondeterminism_check(fixture):
    item = fixture["docx"]
    before = {"semanticContentHash": item["semanticContentHash"], "renderProfileHash": item["profileA"], "surfaceHash": item["surfaceA"]}
    after = {**before, "surfaceHash": item["surfaceB"]}
    result = classify_docx_render_change(before, after)
    return _check("docx-same-profile-drift", result["diagnosticCode"] == "DOCX_RENDER_NONDETERMINISTIC", result)


def _cubic_check(fixture):
    item = fixture["cubic"]
    primitive = normalize_pdfplumber_primitive(fixture["sourceHash"], 1, 0, "curve", {"x0": 10, "top": 10, "x1": 90, "bottom": 70, "path": [tuple(command) for command in item["path"]]})
    cubic = next(segment for segment in primitive["geometry"]["segments"] if segment["op"] == "C")
    passed = cubic["c1"] == item["expectedC1"] and cubic["c2"] == item["expectedC2"]
    return _check("cubic-control-points", passed, {"c1": cubic["c1"], "c2": cubic["c2"]})


def _check(name, passed, details):
    return {"name": name, "passed": bool(passed), "details": details}
