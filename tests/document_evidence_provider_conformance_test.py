import unittest
from document_evidence_observation import make_observation
from document_evidence_provider_conformance import ProviderConformanceError, compare_provider_outputs, conformance_status, make_provider_profile
from document_evidence_surface import canonical_pdf_page_surface

SOURCE="sha256:"+"a"*64
SURFACE=canonical_pdf_page_surface(SOURCE,1,100,80)
GEO={"type":"Quad","coordinates":[[1,1],[9,1],[9,4],[1,4]]}
DET={"semantic":"profile-bound","artifact":"profile-bound","bitwiseRaster":"not-applicable"}

class ProviderConformanceTest(unittest.TestCase):
    def test_geometry_provider_requires_declared_convention(self):
        with self.assertRaises(ProviderConformanceError) as caught: make_provider_profile("ocr","provider","1",determinism=DET,model="m")
        self.assertEqual(caught.exception.code,"PROVIDER_COORDINATE_NONCONFORMANT")
    def test_unknown_provider_convention_is_representable_but_not_coordinate_trusted(self):
        profile=make_provider_profile("ocr","provider","1",determinism=DET,model="m",coordinateConvention="unknown")
        status=conformance_status(profile,geometry_bearing=True,trusted_coordinate_use=True)
        self.assertFalse(status["conformant"]); self.assertIn("PROVIDER_PIXEL_CONVENTION_UNKNOWN",status["diagnosticCodes"])
    def test_two_compliant_providers_may_legitimately_return_different_text(self):
        left=make_observation("ocr",SOURCE,SURFACE,"A","1","10.0",GEO); right=make_observation("ocr",SOURCE,SURFACE,"B","2","100",GEO)
        comparison=compare_provider_outputs(left,right)
        self.assertFalse(comparison["sameText"]); self.assertFalse(comparison["textEqualityRequired"]); self.assertTrue(comparison["bothRetained"])
    def test_missing_observation_lineage_fails_conformance(self):
        with self.assertRaises(ProviderConformanceError) as caught: compare_provider_outputs({"sourceHash":SOURCE},{"sourceHash":SOURCE})
        self.assertEqual(caught.exception.code,"PROVIDER_CONFORMANCE_FAILED")

if __name__=="__main__": unittest.main()
