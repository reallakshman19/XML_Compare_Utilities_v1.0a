import unittest
from document_evidence_resource_policy import OCR_POLICY,OcrJobUsage,OcrResourceError,admit_attempt,admit_job_shape,max_call_bound,pass_profiles,stop_reason

class OcrResourcePolicyTest(unittest.TestCase):
    def test_pass_profiles_are_fixed_and_bounded(self):
        self.assertEqual((len(pass_profiles("single")),len(pass_profiles("auto")),len(pass_profiles("enhanced"))),(1,2,4)); self.assertEqual(max_call_bound(1024,"enhanced"),512)
    def test_raster_limits_fail_closed(self):
        with self.assertRaises(OcrResourceError): admit_attempt(12001,100,OcrJobUsage())
        with self.assertRaises(OcrResourceError): admit_attempt(6000,5000,OcrJobUsage())
    def test_memory_budget_is_admission_controlled(self):
        usage=admit_attempt(4000,3000,admit_job_shape(1,1)); self.assertLessEqual(usage.admitted_memory_bytes,OCR_POLICY["maxJobOcrMemoryBytes"])
    def test_job_shape_and_persisted_output_are_bounded(self):
        with self.assertRaises(OcrResourceError): admit_job_shape(257,1)
        with self.assertRaises(OcrResourceError): admit_job_shape(1,1025)
        with self.assertRaises(OcrResourceError): admit_job_shape(1,1,OCR_POLICY["maxPersistedObservationBytes"]+1)
    def test_low_confidence_is_not_a_search_expansion_signal(self):
        self.assertIsNone(stop_reason()); self.assertEqual(stop_reason(numeric_conflict=True),"review-required-numeric-conflict"); self.assertEqual(stop_reason(profiles_exhausted=True),"profiles-exhausted")

if __name__=="__main__": unittest.main()
