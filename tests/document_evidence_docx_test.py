import unittest
from document_evidence_docx import (
    DocxEvidenceError,
    classify_docx_render_change,
    effective_docx_location,
    make_docx_page_surface,
    make_semantic_visual_map,
)

SOURCE = "sha256:" + "1" * 64
SEM = "sha256:" + "2" * 64
PROFILE_A = "sha256:" + "3" * 64
PROFILE_B = "sha256:" + "4" * 64
GEO = {"type": "Quad", "coordinates": [[10, 10], [50, 10], [50, 20], [10, 20]]}


def semantic_ref(kind="paragraph"):
    return {"schema": "DocxSemanticRef.v1", "partUri": "/word/document.xml", "nodeKind": kind, "paragraphId": "p1"}


def region(surface, profile=PROFILE_A):
    return {
        "sourceHash": SOURCE,
        "renderProfileHash": profile,
        "surfaceId": surface["surfaceId"],
        "surfaceHash": surface["surfaceHash"],
        "geometry": GEO,
    }


class DocxEvidenceTest(unittest.TestCase):
    def test_page_identity_is_render_profile_bound(self):
        one = make_docx_page_surface(SOURCE, SEM, PROFILE_A, 2, 612, 792)
        two = make_docx_page_surface(SOURCE, SEM, PROFILE_A, 2, 612, 792)
        other = make_docx_page_surface(SOURCE, SEM, PROFILE_B, 2, 612, 792)
        self.assertEqual(one["surfaceHash"], two["surfaceHash"])
        self.assertNotEqual(one["surfaceHash"], other["surfaceHash"])
        self.assertEqual(one["metadata"]["pageAuthority"], "render-profile-bound")

    def test_one_paragraph_can_map_to_multiple_visual_regions(self):
        page = make_docx_page_surface(SOURCE, SEM, PROFILE_A, 1, 612, 792)
        second = {**region(page), "geometry": {"type": "Quad", "coordinates": [[10, 30], [60, 30], [60, 40], [10, 40]]}}
        mapping = make_semantic_visual_map(SOURCE, SEM, PROFILE_A, [semantic_ref()], [region(page), second], mapping_method="renderer-glyph-lineage")
        self.assertEqual(mapping["cardinality"], "one-to-many")
        self.assertTrue(mapping["exactLocationTrusted"])

    def test_ambiguous_mapping_blocks_exact_location(self):
        page = make_docx_page_surface(SOURCE, SEM, PROFILE_A, 1, 612, 792)
        mapping = make_semantic_visual_map(
            SOURCE, SEM, PROFILE_A, [semantic_ref()], [region(page)],
            mapping_method="text-correlation", status="ambiguous",
            diagnostics=("DOCX_SEMANTIC_VISUAL_AMBIGUOUS",),
        )
        self.assertFalse(mapping["exactLocationTrusted"])
        with self.assertRaises(DocxEvidenceError) as caught:
            effective_docx_location(mapping)
        self.assertEqual(caught.exception.code, "DOCX_SEMANTIC_VISUAL_AMBIGUOUS")

    def test_render_profile_change_is_not_content_change(self):
        before = {"semanticContentHash": SEM, "renderProfileHash": PROFILE_A, "surfaceHash": "sha256:" + "5" * 64}
        after = {"semanticContentHash": SEM, "renderProfileHash": PROFILE_B, "surfaceHash": "sha256:" + "6" * 64}
        change = classify_docx_render_change(before, after)
        self.assertEqual(change["kind"], "render_environment_changed")
        self.assertFalse(change["semanticContentChanged"])
        self.assertEqual(change["diagnosticCode"], "DOCX_RENDER_PROFILE_CHANGED")

    def test_same_profile_surface_drift_is_nondeterministic(self):
        before = {"semanticContentHash": SEM, "renderProfileHash": PROFILE_A, "surfaceHash": "sha256:" + "5" * 64}
        after = {**before, "surfaceHash": "sha256:" + "6" * 64}
        change = classify_docx_render_change(before, after)
        self.assertEqual(change["diagnosticCode"], "DOCX_RENDER_NONDETERMINISTIC")

    def test_semantic_change_has_priority(self):
        before = {"semanticContentHash": SEM, "renderProfileHash": PROFILE_A, "surfaceHash": "sha256:" + "5" * 64}
        after = {"semanticContentHash": "sha256:" + "7" * 64, "renderProfileHash": PROFILE_B, "surfaceHash": "sha256:" + "6" * 64}
        self.assertEqual(classify_docx_render_change(before, after)["kind"], "semantic_content_changed")


if __name__ == "__main__":
    unittest.main()
