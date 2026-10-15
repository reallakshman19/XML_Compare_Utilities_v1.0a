import unittest

from document_evidence_decision import diagnostic, fail_closed_matrix, reviewer_can_resolve


RUNTIME_BACKED_CODES = (
    "PROVIDER_COORDINATE_NONCONFORMANT",
    "PROVIDER_REPRODUCIBILITY_INCOMPLETE",
    "PROVIDER_CONFORMANCE_FAILED",
    "EVIDENCE_SOURCE_CONFLICT",
    "EVIDENCE_STORAGE_POLICY_INCOMPLETE",
    "EVIDENCE_STORAGE_NOT_PERSISTENT",
)


class DiagnosticCoverageTest(unittest.TestCase):
    def test_provider_and_storage_runtime_codes_are_catalogued(self):
        for code in RUNTIME_BACKED_CODES:
            value = diagnostic(code)
            self.assertEqual(value["code"], code)
            self.assertTrue(value["blockedDownstream"])

    def test_runtime_backed_codes_are_fail_closed_matrix_cases(self):
        matrix_codes = {item["code"] for item in fail_closed_matrix()["cases"]}
        self.assertTrue(set(RUNTIME_BACKED_CODES).issubset(matrix_codes))

    def test_provider_and_storage_failures_cannot_be_approved_away(self):
        for code in RUNTIME_BACKED_CODES:
            self.assertFalse(reviewer_can_resolve(code))


if __name__ == "__main__":
    unittest.main()
