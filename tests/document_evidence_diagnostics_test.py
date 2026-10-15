import unittest

from document_evidence_decision import (
    DiagnosticError,
    blocked_downstream,
    diagnostic,
    fail_closed_matrix,
    reviewer_can_resolve,
)


class DiagnosticMatrixTest(unittest.TestCase):
    def test_matrix_has_at_least_twelve_complete_fail_closed_cases(self):
        cases = fail_closed_matrix()["cases"]
        self.assertGreaterEqual(len(cases), 12)
        self.assertEqual(len({item["code"] for item in cases}), len(cases))
        for item in cases:
            self.assertTrue(item["detection"])
            self.assertTrue(item["retainedEvidence"])
            self.assertTrue(item["blockedDownstream"])
            self.assertTrue(item["reviewerResolution"])

    def test_numeric_conflict_is_reviewer_resolvable_and_blocks_trusted_value(self):
        self.assertTrue(reviewer_can_resolve("OCR_NUMERIC_DISAGREEMENT"))
        self.assertIn("trusted-numeric-value", blocked_downstream("OCR_NUMERIC_DISAGREEMENT"))

    def test_invalid_math_cannot_be_approved_away(self):
        for code in ("TRANSFORM_NONINVERTIBLE", "TRANSFORM_ROUNDTRIP_FAILED", "EVIDENCE_HASH_INVALID"):
            self.assertFalse(reviewer_can_resolve(code))

    def test_diagnostic_retains_matrix_policy(self):
        value = diagnostic("TABLE_CELL_PASS_MISSING", subject_id="cell:r0:c1")
        self.assertEqual(value["severity"], "REVIEW_REQUIRED")
        self.assertEqual(value["subjectId"], "cell:r0:c1")
        self.assertIn("ordinal-cell-shift", value["blockedDownstream"])

    def test_unknown_diagnostic_code_fails_closed(self):
        with self.assertRaises(DiagnosticError):
            diagnostic("NOT_A_REAL_CODE")


if __name__ == "__main__":
    unittest.main()
