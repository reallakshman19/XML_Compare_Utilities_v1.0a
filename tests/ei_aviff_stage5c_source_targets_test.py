import unittest
from profiles.ei_aviff_stage5c.source_targets import SOURCE_PROFILE, make_source_target_decision

ACCEPTED = {"state": "accepted", "decisionHash": "sha256:" + "1" * 64, "diagnosticCodes": []}


class SourceTargetTest(unittest.TestCase):
    def test_source_pin(self):
        self.assertEqual(SOURCE_PROFILE["gitBlobSha1"], "sha1:9d3eccc56429411e17c07a579bdebbd13cb0bdc5")
        self.assertEqual(SOURCE_PROFILE["sizeBytes"], 10348594)

    def test_locator_required(self):
        result = make_source_target_decision("EI_AVIFF.T3.SBC.GEOMETRY_SCORES", ACCEPTED)
        self.assertEqual((result["state"], result["diagnosticCodes"]), ("blocked", ["SOURCE_LOCATOR_UNVERIFIED"]))

    def test_t3_figure_not_a_table_locator(self):
        with self.assertRaises(ValueError):
            make_source_target_decision(
                "EI_AVIFF.T3.SBC.GEOMETRY_SCORES", ACCEPTED,
                source_locator={"pdfPage": 12, "printedIdentifier": "Figure T3-1"},
            )


if __name__ == "__main__":
    unittest.main()
