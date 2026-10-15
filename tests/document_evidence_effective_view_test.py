import unittest
from document_evidence_correction import make_correction_event
from document_evidence_effective_view import EffectiveViewError, make_effective_view, make_search_record
from document_evidence_observation import make_observation
from document_evidence_surface import canonical_pdf_page_surface

SOURCE="sha256:"+"a"*64
SURFACE=canonical_pdf_page_surface(SOURCE,1,100,80)
GEO={"type":"Quad","coordinates":[[1,1],[9,1],[9,4],[1,4]]}

def obs(text="1O.O MPa"):
    return make_observation("ocr",SOURCE,SURFACE,"fixture","1",text,GEO)

def corr(observation,text,status="approved",supersedes=None,ts="2026-08-13T18:00:00Z"):
    return make_correction_event(observation["observationHash"],text,"reviewer",ts,status=status,supersedes_correction_hash=supersedes)

class EffectiveViewTest(unittest.TestCase):
    def test_approved_correction_changes_search_text_without_mutating_observation(self):
        original=obs(); before=dict(original); event=corr(original,"10.0 MPa")
        view=make_effective_view(original,[event]); record=make_search_record(view,document_id="doc",field_id="pressure")
        self.assertEqual(record["text"],"10.0 MPa"); self.assertEqual(record["observationHash"],original["observationHash"]); self.assertEqual(original,before)
    def test_proposed_correction_does_not_change_effective_text(self):
        original=obs(); view=make_effective_view(original,[corr(original,"10.0 MPa",status="proposed")])
        self.assertEqual((view["effectiveText"],view["effectiveSource"]),(original["normalizedText"],"machine-observation"))
    def test_superseding_approved_correction_becomes_terminal(self):
        original=obs(); first=corr(original,"10.0 MPa"); second=corr(original,"10.00 MPa",supersedes=first["eventHash"],ts="2026-08-13T18:01:00Z")
        view=make_effective_view(original,[first,second]); self.assertEqual(view["selectedCorrectionHash"],second["eventHash"])
    def test_conflicting_terminal_approvals_fail_closed(self):
        original=obs(); first=corr(original,"10.0 MPa"); second=corr(original,"100 MPa",ts="2026-08-13T18:01:00Z")
        with self.assertRaises(EffectiveViewError) as caught: make_effective_view(original,[first,second])
        self.assertEqual(caught.exception.code,"CORRECTION_APPROVAL_CONFLICT")
    def test_new_machine_observation_does_not_rewrite_old_correction_lineage(self):
        original=obs(); event=corr(original,"10.0 MPa"); newer=obs("10.0 MPa")
        view=make_effective_view(original,[event]); self.assertEqual(view["observationHash"],original["observationHash"]); self.assertNotEqual(newer["observationHash"],event["targetObservationHash"])

if __name__=="__main__": unittest.main()
