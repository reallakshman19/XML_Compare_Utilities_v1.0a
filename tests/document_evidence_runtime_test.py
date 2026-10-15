import unittest

from document_evidence_geometry import normalize_pdfplumber_primitive
from document_evidence_surface import canonical_hash, canonical_pdf_page_surface, rendered_raster_surface
from document_evidence_transform import (
    SurfaceTransformError,
    apply_matrix,
    make_transform,
    map_geometry,
    render_scale_transform,
)

SOURCE_HASH = "sha256:" + "1" * 64
IMAGE_HASH = "sha256:" + "2" * 64


class DocumentEvidenceRuntimeTest(unittest.TestCase):
    def test_render_scale_round_trip_and_quantized_bound(self):
        page = canonical_pdf_page_surface(SOURCE_HASH, 7, 100, 200)
        raster = rendered_raster_surface(
            SOURCE_HASH, page, 400, 800, image_sha256=IMAGE_HASH,
            renderer="fixture", renderer_version="1", render_scale=4,
        )
        transform = render_scale_transform(page, raster, 4)
        self.assertEqual(apply_matrix(transform["forwardMatrix"], [10, 20]), [40.0, 80.0])
        self.assertEqual(apply_matrix(transform["inverseMatrix"], [40, 80]), [10.0, 20.0])
        self.assertLessEqual(transform["numericValidation"]["continuousRoundTripMaxError"], 0.01)
        quantified = make_transform(
            page, raster, "render-scale", transform["forwardMatrix"],
            pixel_convention="continuous-pixel-edges", provider_quantization_error_px=0.5,
        )
        self.assertEqual(quantified["numericValidation"]["quantizedBackProjectionMaxError"], 0.125)

    def test_non_axis_geometry_is_mapped_as_geometry(self):
        page = canonical_pdf_page_surface(SOURCE_HASH, 1, 100, 100)
        raster = rendered_raster_surface(
            SOURCE_HASH, page, 200, 200, image_sha256=IMAGE_HASH,
            renderer="fixture", renderer_version="1", render_scale=2,
        )
        transform = render_scale_transform(page, raster, 2)
        quad = {"type": "Quad", "coordinates": [[1, 2], [3, 1], [4, 5], [2, 6]]}
        mapped = map_geometry(transform["forwardMatrix"], quad)
        self.assertEqual(mapped["coordinates"], [[2.0, 4.0], [6.0, 2.0], [8.0, 10.0], [4.0, 12.0]])

    def test_singular_transform_fails_closed(self):
        page = canonical_pdf_page_surface(SOURCE_HASH, 1, 100, 100)
        with self.assertRaises(SurfaceTransformError) as caught:
            make_transform(page, page, "other", [1, 0, 0, 0, 0, 0, 0, 0, 1])
        self.assertEqual(caught.exception.code, "TRANSFORM_NONINVERTIBLE")

    def test_pdfplumber_cubic_controls_are_preserved(self):
        page = canonical_pdf_page_surface(SOURCE_HASH, 1, 100, 100)
        item = {
            "x0": 10, "top": 10, "x1": 90, "bottom": 70,
            "path": [("m", (10, 30)), ("c", (30, 10), (60, 70), (90, 30))],
            "stroke": True,
        }
        primitive = normalize_pdfplumber_primitive("1" * 64, 1, 0, "curve", item, surface=page)
        cubic = primitive["geometry"]["segments"][1]
        self.assertEqual(cubic, {"op": "C", "c1": [30.0, 10.0], "c2": [60.0, 70.0], "to": [90.0, 30.0]})
        self.assertEqual(primitive["path"][1]["points"][0], [30.0, 10.0])
        self.assertEqual(primitive["surfaceId"], page["surfaceId"])

    def test_docx_render_profile_is_hash_checked_and_bound_to_surface(self):
        identity = {
            "schema": "RenderProfile.v1", "documentKind": "docx", "renderer": "writer",
            "rendererVersion": "1", "rendererBinaryHash": "sha256:" + "3" * 64,
            "environment": {"osFamily": "linux", "architecture": "x86_64"},
            "fontManifestHash": "sha256:" + "4" * 64, "locale": "en-US",
            "trackedRevisionDisplay": "final", "fieldUpdatePolicy": "preserve",
            "determinism": {"semantic": "profile-bound", "artifact": "profile-bound", "bitwiseRaster": "not-claimed"},
        }
        profile_hash = canonical_hash(identity)
        profile = {**identity, "renderProfileId": f"render-profile:{profile_hash[7:31]}", "renderProfileHash": profile_hash}
        page = canonical_pdf_page_surface(SOURCE_HASH, 1, 100, 100)
        raster = rendered_raster_surface(
            SOURCE_HASH, page, 200, 200, image_sha256=IMAGE_HASH, renderer="fixture",
            renderer_version="1", render_scale=2, render_profile=profile,
        )
        self.assertEqual(raster["renderProfileHash"], profile_hash)

    def test_incomplete_docx_render_profile_fails_closed(self):
        identity = {
            "schema": "RenderProfile.v1", "documentKind": "docx", "renderer": "writer",
            "rendererVersion": "1",
            "determinism": {"semantic": "profile-bound", "artifact": "profile-bound", "bitwiseRaster": "not-claimed"},
        }
        profile_hash = canonical_hash(identity)
        profile = {**identity, "renderProfileId": "render-profile:test", "renderProfileHash": profile_hash}
        page = canonical_pdf_page_surface(SOURCE_HASH, 1, 100, 100)
        with self.assertRaises(ValueError) as caught:
            rendered_raster_surface(
                SOURCE_HASH, page, 200, 200, image_sha256=IMAGE_HASH, renderer="fixture",
                renderer_version="1", render_scale=2, render_profile=profile,
            )
        self.assertIn("DOCX_RENDER_PROFILE_INCOMPLETE", str(caught.exception))


if __name__ == "__main__":
    unittest.main()
