import json
from pathlib import Path
import unittest

from document_evidence_envelope import EvidenceEnvelopeError, make_machine_evidence
from document_evidence_observation import make_observation
from document_evidence_qualification import run_qualification
from document_evidence_surface import canonical_pdf_page_surface

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "contracts" / "document-evidence" / "v1" / "conformance" / "qualification-v1.json"
SOURCE = "sha256:" + "a" * 64
GEO = {"type": "Quad", "coordinates": [[1, 1], [9, 1], [9, 4], [1, 4]]}


class QualificationTest(unittest.TestCase):
    def test_fixture_passes_all_reference_checks(self):
        result = run_qualification(json.loads(FIXTURE.read_text()))
        self.assertTrue(result["passed"], result)
        self.assertEqual(len(result["checks"]), 5)

    def test_machine_envelope_hash_is_order_independent_for_set_like_evidence(self):
        surface = canonical_pdf_page_surface(SOURCE, 1, 100, 80)
        first = make_observation("ocr", SOURCE, surface, "A", "1", "10", GEO)
        second = make_observation("ocr", SOURCE, surface, "B", "1", "20", GEO)
        source = {"schema": "SourceIdentity.v1", "sourceId": "s", "sha256": SOURCE, "mediaType": "application/pdf", "sizeBytes": 1}
        one = make_machine_evidence(source, surfaces=[surface], observations=[first, second], operation="qualify", selection={"pages": [1]}, canonical_options={})
        two = make_machine_evidence(source, surfaces=[surface], observations=[second, first], operation="qualify", selection={"pages": [1]}, canonical_options={})
        self.assertEqual(one["machineEvidenceHash"], two["machineEvidenceHash"])
        self.assertEqual([item["observationHash"] for item in one["observations"]], sorted([first["observationHash"], second["observationHash"]]))

    def test_envelope_rejects_unbound_surface(self):
        surface = canonical_pdf_page_surface("sha256:" + "b" * 64, 1, 100, 80)
        source = {"schema": "SourceIdentity.v1", "sourceId": "s", "sha256": SOURCE, "mediaType": "application/pdf", "sizeBytes": 1}
        with self.assertRaises(EvidenceEnvelopeError) as caught:
            make_machine_evidence(source, surfaces=[surface], operation="qualify", selection={}, canonical_options={})
        self.assertEqual(caught.exception.code, "EVIDENCE_SOURCE_UNBOUND")


if __name__ == "__main__":
    unittest.main()
