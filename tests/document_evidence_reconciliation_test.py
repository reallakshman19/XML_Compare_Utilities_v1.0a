import unittest
from document_evidence_correction import make_correction_event
from document_evidence_decision import reconcile_cell
from document_evidence_observation import ObservationError, make_observation
from document_evidence_surface import canonical_hash, canonical_pdf_page_surface

SOURCE = "sha256:" + "a" * 64
GEO = {"type": "Quad", "coordinates": [[1, 1], [9, 1], [9, 4], [1, 4]]}
SURFACE = canonical_pdf_page_surface(SOURCE, 1, 100, 100)


def provider_profile(role="native-text", provider="fixture", options=None):
    identity = {
        "schema": "ProviderProfile.v1", "role": role, "provider": provider,
        "providerVersion": "1",
        "determinism": {"semantic": "profile-bound", "artifact": "not-claimed", "bitwiseRaster": "not-applicable"},
    }
    if options:
        identity["options"] = options
    value_hash = canonical_hash(identity)
    return {**identity, "profileId": f"profile:{value_hash[7:31]}", "profileHash": value_hash}


def native_quality(status, profile_hash, **evidence):
    identity = {"schema": "NativeTextQuality.v1", "status": status, "assessmentProfileHash": profile_hash, **evidence}
    value_hash = canonical_hash(identity)
    return {**identity, "nativeQualityHash": value_hash}


def obs(text, confidence, kind="ocr", quality=None, profile=None):
    return make_observation(
        kind, SOURCE, SURFACE, "fixture", "1", text, GEO,
        provider_confidence_raw=confidence, native_quality=quality, provider_profile=profile,
    )


class ReconciliationTest(unittest.TestCase):
    def test_numeric_conflict_ignores_confidence(self):
        decision = reconcile_cell([obs("10.0", 0.88), obs("100", 0.97)], logical_cell_id="cell-B")
        self.assertEqual(decision["state"], "review_required")
        self.assertEqual(decision["diagnosticCodes"], ["OCR_NUMERIC_DISAGREEMENT"])
        self.assertNotIn("selectedObservationHash", decision)

    def test_exact_numeric_agreement(self):
        decision = reconcile_cell([obs("10.0", 0.40), obs("10", 0.99)])
        self.assertEqual((decision["state"], decision["effectiveNumericValue"]), ("accepted", 10.0))

    def test_strong_native_wins_confusable_text(self):
        profile = provider_profile()
        quality = native_quality("strong", profile["profileHash"], toUnicodeStatus="present", validUnicodeFraction=1.0)
        native = obs("T3-1", 0.10, "native-text", quality, profile)
        decision = reconcile_cell([native, obs("T3-l", 0.99)], logical_cell_id="label")
        self.assertEqual((decision["state"], decision["effectiveText"]), ("accepted", "T3-1"))
        self.assertEqual(decision["selectedObservationHash"], native["observationHash"])

    def test_corrupt_native_mapping_allows_unanimous_ocr(self):
        profile = provider_profile()
        quality = native_quality("mapping_corrupt", profile["profileHash"], toUnicodeStatus="corrupt", replacementCharacterCount=1)
        native = obs("�3-1", 1.0, "native-text", quality, profile)
        ocr = obs("T3-1", 0.65)
        decision = reconcile_cell([native, ocr], logical_cell_id="label")
        self.assertEqual((decision["state"], decision["effectiveText"]), ("accepted", "T3-1"))
        self.assertEqual(decision["selectedObservationHash"], ocr["observationHash"])

    def test_decisive_quality_requires_supporting_evidence(self):
        profile = provider_profile()
        quality = native_quality("strong", profile["profileHash"])
        with self.assertRaises(ObservationError) as caught:
            obs("T3-1", 0.5, "native-text", quality, profile)
        self.assertEqual(caught.exception.code, "NATIVE_QUALITY_EVIDENCE_REQUIRED")

    def test_native_quality_hash_tampering_is_rejected(self):
        profile = provider_profile()
        quality = native_quality("strong", profile["profileHash"], toUnicodeStatus="present")
        tampered = {**quality, "toUnicodeStatus": "corrupt"}
        with self.assertRaises(ObservationError) as caught:
            obs("T3-1", 0.5, "native-text", tampered, profile)
        self.assertEqual(caught.exception.code, "NATIVE_QUALITY_HASH_INVALID")

    def test_native_quality_profile_must_match_observation_profile(self):
        profile, other = provider_profile(), provider_profile(options={"pass": "B"})
        quality = native_quality("strong", other["profileHash"], toUnicodeStatus="present")
        with self.assertRaises(ObservationError) as caught:
            obs("T3-1", 0.5, "native-text", quality, profile)
        self.assertEqual(caught.exception.code, "NATIVE_QUALITY_PROFILE_CONFLICT")

    def test_provider_profile_must_match_observation_identity(self):
        wrong = provider_profile(role="ocr", provider="other")
        with self.assertRaises(ObservationError) as caught:
            obs("T3-1", 0.5, profile=wrong)
        self.assertEqual(caught.exception.code, "OBSERVATION_PROVIDER_PROFILE_CONFLICT")

    def test_unknown_native_quality_keeps_confusable_text_under_review(self):
        profile = provider_profile()
        identity = {"schema": "NativeTextQuality.v1", "status": "unknown"}
        quality = {**identity, "nativeQualityHash": canonical_hash(identity)}
        decision = reconcile_cell([obs("T3-1", 0.1, "native-text", quality, profile), obs("T3-l", 0.99)])
        self.assertEqual(decision["state"], "review_required")

    def test_correction_does_not_mutate_observation(self):
        original = obs("1O.O MPa", 0.91)
        before = original["observationHash"]
        event = make_correction_event(before, "10.0 MPa", "reviewer", "2026-08-13T17:20:00Z", status="approved")
        self.assertEqual(original["observationHash"], before)
        self.assertEqual(event["targetObservationHash"], before)


if __name__ == "__main__":
    unittest.main()
