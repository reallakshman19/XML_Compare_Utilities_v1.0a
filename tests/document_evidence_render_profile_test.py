import unittest
from document_evidence_render_profile import RenderProfileError, make_render_profile

H=lambda c:"sha256:"+c*64
DET={"semantic":"profile-bound","artifact":"profile-bound","bitwiseRaster":"not-claimed"}

def fields(**overrides):
    base={"rendererBinaryHash":H("1"),"environment":{"osFamily":"Windows","architecture":"x86_64","environmentHash":H("2")},"fontManifestHash":H("3"),"layoutEngine":"Word Layout","layoutEngineVersion":"16.0-build","locale":"en-US","languagePackHashes":[H("4")],"hyphenationDictionaryHashes":[H("5")],"measurementUnit":"twip","trackedRevisionDisplay":"final","commentDisplay":"hidden","hiddenTextDisplay":"hidden","fieldUpdatePolicy":"preserve","externalResourcePolicy":"blocked","compatibilityMode":"word-2019","printerMetricsPolicy":"renderer-default","dpiX":144.0,"dpiY":144.0}
    base.update(overrides); return base

class RenderProfileTest(unittest.TestCase):
    def test_docx_profile_is_deterministic_and_environment_bound(self):
        one=make_render_profile("docx","Microsoft Word","16.0",determinism=DET,**fields()); two=make_render_profile("docx","Microsoft Word","16.0",determinism=DET,**fields()); changed=make_render_profile("docx","Microsoft Word","16.0",determinism=DET,**fields(environment={"osFamily":"Windows","architecture":"x86_64","environmentHash":H("9")}))
        self.assertEqual(one["renderProfileHash"],two["renderProfileHash"]); self.assertNotEqual(one["renderProfileHash"],changed["renderProfileHash"])
    def test_font_manifest_and_layout_engine_affect_identity(self):
        base=make_render_profile("docx","LibreOffice","25.2",determinism=DET,**fields()); font=make_render_profile("docx","LibreOffice","25.2",determinism=DET,**fields(fontManifestHash=H("8"))); layout=make_render_profile("docx","LibreOffice","25.2",determinism=DET,**fields(layoutEngineVersion="25.2.1"))
        self.assertNotEqual(base["renderProfileHash"],font["renderProfileHash"]); self.assertNotEqual(base["renderProfileHash"],layout["renderProfileHash"])
    def test_missing_display_policy_fails_closed(self):
        data=fields(); data.pop("hiddenTextDisplay")
        with self.assertRaises(RenderProfileError) as caught: make_render_profile("docx","Word","16",determinism=DET,**data)
        self.assertEqual(caught.exception.code,"DOCX_RENDER_PROFILE_INCOMPLETE")
    def test_pdf_profile_can_be_smaller_but_determinism_is_explicit(self):
        profile=make_render_profile("pdf","PDFium","commit-x",determinism={"semantic":"profile-bound","artifact":"profile-bound","bitwiseRaster":"profile-bound"},rendererBinaryHash=H("1"),dpiX=144,dpiY=144)
        self.assertEqual(profile["documentKind"],"pdf")

if __name__=="__main__": unittest.main()
