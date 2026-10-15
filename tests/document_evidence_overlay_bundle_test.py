import hashlib
import unittest
from zipfile import ZipFile
from io import BytesIO

from document_evidence_bundle import (
    EvidenceBundleError, build_deterministic_bundle, cache_identity, make_bundle_manifest,
)
from document_evidence_overlay import (
    OverlayEvidenceError, aligned_overlay_geometry, make_overlay, overlay_anchor_status,
)
from document_evidence_migration import classify_legacy_artifact, schema_read_compatibility
from document_evidence_surface import canonical_pdf_page_surface

SOURCE = "sha256:" + "a" * 64
TRANSFORM = "sha256:" + "b" * 64
GEO = {"type": "Quad", "coordinates": [[1, 1], [9, 1], [9, 4], [1, 4]]}


def cache(**changes):
    options = {
        "operation": "table-extract", "selection": {"pages": [1]},
        "canonical_options": {"ocr": "never"},
    }
    options.update(changes)
    return cache_identity(SOURCE, **options)


class OverlayBundleTest(unittest.TestCase):
    def test_overlay_source_and_transform_staleness_fail_closed(self):
        surface = canonical_pdf_page_surface(SOURCE, 1, 100, 100)
        overlay = make_overlay("geometry", surface, TRANSFORM, GEO, ("evidence:1",))
        self.assertTrue(overlay_anchor_status(overlay, surface, TRANSFORM)["aligned"])
        stale_source = canonical_pdf_page_surface("sha256:" + "c" * 64, 1, 100, 100)
        self.assertEqual(overlay_anchor_status(overlay, stale_source, TRANSFORM)["diagnosticCode"], "OVERLAY_STALE_SOURCE")
        with self.assertRaises(OverlayEvidenceError) as caught:
            aligned_overlay_geometry(overlay, surface, "sha256:" + "d" * 64)
        self.assertEqual(caught.exception.code, "OVERLAY_STALE_TRANSFORM")

    def test_bundle_manifest_and_zip_are_deterministic(self):
        entries = {"evidence.json": b"{}\n", "page/1.bin": b"abc"}
        manifest = make_bundle_manifest(entries, source_hash=SOURCE, machine_evidence_hash="sha256:" + "e" * 64)
        first = build_deterministic_bundle(entries, manifest)
        second = build_deterministic_bundle(dict(reversed(list(entries.items()))), manifest)
        self.assertEqual(hashlib.sha256(first).digest(), hashlib.sha256(second).digest())
        with ZipFile(BytesIO(first)) as archive:
            self.assertEqual(archive.namelist(), sorted(archive.namelist()))
            self.assertEqual(archive.getinfo("manifest.json").date_time, (1980, 1, 1, 0, 0, 0))

    def test_bundle_rejects_path_traversal(self):
        with self.assertRaises(EvidenceBundleError):
            make_bundle_manifest({"../secret": b"x"}, source_hash=SOURCE, machine_evidence_hash="sha256:" + "e" * 64)

    def test_cache_key_changes_with_semantic_inputs(self):
        base = cache()
        self.assertNotEqual(base, cache(schema_major=2))
        self.assertNotEqual(base, cache(render_profile_hash="sha256:" + "f" * 64))
        self.assertNotEqual(base, cache(selection={"pages": [2]}))
        self.assertNotEqual(base, cache(operation="search"))
        self.assertNotEqual(base, cache(canonical_options={"ocr": "always"}))

    def test_cache_key_requires_operation_selection_and_options(self):
        with self.assertRaises(EvidenceBundleError):
            cache_identity(SOURCE, operation="", selection={}, canonical_options={})

    def test_legacy_coordinate_artifacts_require_rebuild_when_lineage_missing(self):
        result = classify_legacy_artifact("ocr", {"sourceHash": SOURCE})
        self.assertEqual(result["status"], "rebuild-required")
        self.assertTrue(result["trustedUseBlocked"])
        self.assertIn("MISSING_preprocessingTransformHash", result["diagnosticCodes"])

    def test_future_major_fails_closed(self):
        self.assertEqual(schema_read_compatibility(2)["diagnosticCode"], "EVIDENCE_SCHEMA_FUTURE_MAJOR")


if __name__ == "__main__":
    unittest.main()
