import sys
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))

from document_model import DocumentModel, ParagraphBlock, SourceRef
from pdf_engineering_conversion import (
    _compare_existing, _engineering_pages, _global_ocr_policy, _restore_page_metadata,
)
from pdf_engineering_regions import (
    EngineeringPageGeometry, EngineeringRegion, VectorObject,
    choose_region_scale, offset_ocr_bbox, plan_engineering_regions, region_needs_ocr,
)


def line(x0, top, x1, bottom):
    return VectorObject((x0, top, x1, bottom), "line")


def engineering_geometry():
    values = []
    for row in range(8):
        for col in range(8):
            x, y = 30 + col * 28, 35 + row * 25
            values.extend((line(x, y, x + 20, y), line(x, y, x, y + 18)))
    for row in range(5):
        for col in range(5):
            x, y = 390 + col * 35, 570 + row * 35
            values.extend((line(x, y, x + 30, y), line(x, y, x, y + 25)))
    return EngineeringPageGeometry(1, 600, 800, tuple(values))


class EngineeringRegionsTest(unittest.TestCase):
    def test_detects_bounded_title_and_drawing_regions(self):
        plan = plan_engineering_regions(engineering_geometry())
        self.assertTrue(any(region.region_type == "title_block" for region in plan.regions))
        self.assertTrue(any(region.region_type == "drawing_zone" for region in plan.regions))
        self.assertTrue(all(
            (region.bbox[2] - region.bbox[0]) * (region.bbox[3] - region.bbox[1]) < 600 * 800 * 0.55
            for region in plan.regions
        ))

    def test_native_text_suppresses_auto_region_ocr(self):
        native = ParagraphBlock(
            "p", "A" * 40,
            SourceRef("pdf", page=1, bbox=(20, 20, 300, 300), extraction="embedded-text"),
        )
        plan = plan_engineering_regions(engineering_geometry(), native_blocks=(native,))
        region = max(
            (value for value in plan.regions if value.region_type == "drawing_zone"),
            key=lambda value: value.native_text_chars,
        )
        self.assertFalse(region_needs_ocr(region, mode="auto")[0])

    def test_always_and_never_region_modes_are_explicit(self):
        region = EngineeringRegion(1, 0, "drawing_zone", (0, 0, 100, 100), 0.9, 50, 100)
        self.assertTrue(region_needs_ocr(region, mode="always")[0])
        self.assertFalse(region_needs_ocr(region, mode="never")[0])

    def test_insufficient_vector_geometry_is_fail_visible(self):
        plan = plan_engineering_regions(EngineeringPageGeometry(1, 600, 800, tuple([line(0, 0, 10, 0)] * 5)))
        self.assertFalse(plan.regions)
        self.assertEqual(plan.diagnostics[0]["code"], "PDF_ENGINEERING_REGION_INSUFFICIENT_GEOMETRY")

    def test_region_scale_clamps_for_working_memory(self):
        self.assertEqual(choose_region_scale(
            1000, 1000, requested_scale=4,
            max_pixels=16_000_000, max_memory_bytes=10_000_000,
        ), 1.0)

    def test_local_ocr_coordinates_map_back_to_page_region(self):
        self.assertEqual(
            offset_ocr_bbox((0, 0, 100, 50), (200, 300, 400, 400), 100, 50),
            (200.0, 300.0, 400.0, 400.0),
        )

    def drawing_document(self):
        return DocumentModel("pdf", (), metadata={"pages": [
            {"page": 1, "classification": "ENGINEERING_DRAWING", "nativeTextQuality": {"adequate": False, "visibleCharCount": 4}},
            {"page": 2, "classification": "BORN_DIGITAL", "nativeTextQuality": {"adequate": True, "visibleCharCount": 50}},
        ]})

    def test_engineering_page_is_removed_from_global_always_ocr(self):
        source = self.drawing_document()
        drawing_pages = _engineering_pages(source)
        prepared, mode = _global_ocr_policy(source, drawing_pages, "auto", "always")
        self.assertEqual(mode, "auto")
        self.assertEqual(prepared.metadata["pages"][0]["classification"], "BORN_DIGITAL")
        self.assertTrue(prepared.metadata["pages"][0]["nativeTextQuality"]["adequate"])
        self.assertEqual(prepared.metadata["pages"][1]["classification"], "SCANNED")
        self.assertFalse(prepared.metadata["pages"][1]["nativeTextQuality"]["adequate"])
        restored = _restore_page_metadata(prepared, source)
        self.assertEqual(restored.metadata["pages"][0]["classification"], "ENGINEERING_DRAWING")

    def test_numeric_conflict_is_not_silently_deduplicated(self):
        native = ParagraphBlock(
            "native", "LOF 3.15",
            SourceRef("pdf", page=1, bbox=(0, 0, 100, 30), extraction="embedded-text"),
        )
        duplicate, conflict = _compare_existing("LOF 8.15", (0, 0, 100, 30), 1, (native,))
        self.assertFalse(duplicate)
        self.assertTrue(conflict)

    def test_near_duplicate_region_text_is_suppressed(self):
        native = ParagraphBlock(
            "native", "Pump discharge pressure",
            SourceRef("pdf", page=1, bbox=(0, 0, 100, 30), extraction="embedded-text"),
        )
        duplicate, conflict = _compare_existing("Pump discharge pressure", (0, 0, 100, 30), 1, (native,))
        self.assertTrue(duplicate)
        self.assertFalse(conflict)


if __name__ == "__main__":
    unittest.main()
