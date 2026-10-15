import unittest
from document_evidence_geometry_evidence import GeometryEvidenceError, make_geometry_evidence
from document_evidence_surface import canonical_pdf_page_surface

SOURCE="sha256:"+"1"*64
SURFACE=canonical_pdf_page_surface(SOURCE,1,100,80)
PATH={"type":"Path","segments":[{"op":"M","to":[1,2]},{"op":"C","c1":[3,4],"c2":[5,6],"to":[7,8]}]}

class GeometryEvidenceTest(unittest.TestCase):
    def test_cubic_and_raw_provider_lineage_are_preserved(self):
        evidence=make_geometry_evidence(SOURCE,SURFACE,"path",PATH,provider="pdfplumber",provider_object_id="curve:7",effective_ctm=[1,0,0,1,10,20],raw_evidence_ref="raw:curve:7",style={"lineWidth":1.5,"stroke":True})
        cubic=evidence["geometry"]["segments"][1]
        self.assertEqual((cubic["c1"],cubic["c2"]),([3,4],[5,6])); self.assertEqual(evidence["rawEvidenceRef"],"raw:curve:7"); self.assertEqual(len(evidence["effectiveCtm"]),9)
    def test_clip_stack_retains_geometry_and_ctm(self):
        clip={"geometry":{"type":"Quad","coordinates":[[0,0],[10,0],[10,10],[0,10]]},"operation":"intersect","fillRule":"evenodd","ctm":[1,0,0,1,2,3]}
        evidence=make_geometry_evidence(SOURCE,SURFACE,"path",PATH,provider="fixture",clip_stack=[clip])
        self.assertEqual(evidence["clipStack"][0]["fillRule"],"evenodd"); self.assertEqual(len(evidence["clipStack"][0]["ctm"]),9)
    def test_image_metadata_is_provider_neutral(self):
        quad={"type":"Quad","coordinates":[[1,1],[9,1],[9,7],[1,7]]}
        image={"intrinsicWidth":640,"intrinsicHeight":480,"imageHash":"sha256:"+"2"*64,"colorSpace":"DeviceRGB","hasAlpha":True}
        evidence=make_geometry_evidence(SOURCE,SURFACE,"image",quad,provider="fixture",image=image)
        self.assertEqual(evidence["image"]["intrinsicWidth"],640)
    def test_invalid_ctm_fails_closed(self):
        with self.assertRaises(GeometryEvidenceError) as caught: make_geometry_evidence(SOURCE,SURFACE,"path",PATH,provider="fixture",effective_ctm=[1,2,3])
        self.assertEqual(caught.exception.code,"GEOMETRY_CTM_INVALID")

if __name__=="__main__": unittest.main()
