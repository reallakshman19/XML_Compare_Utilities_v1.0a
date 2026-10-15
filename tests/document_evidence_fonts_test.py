import unittest
from document_evidence_fonts import FontManifestError, bind_font_manifest, make_font_manifest

HASH_A="sha256:"+"a"*64
HASH_B="sha256:"+"b"*64

class FontManifestTest(unittest.TestCase):
    def test_order_is_deterministic(self):
        first=make_font_manifest([{"requestedFamily":"Arial","resolvedFamily":"Arial","fileHash":HASH_A},{"requestedFamily":"Calibri","resolvedFamily":"Carlito","fileHash":HASH_B,"substituted":True}])
        second=make_font_manifest(list(reversed(first["entries"])))
        self.assertEqual(first["fontManifestHash"],second["fontManifestHash"])
    def test_substitution_blocks_trusted_layout(self):
        manifest=make_font_manifest([{"requestedFamily":"Calibri","resolvedFamily":"Carlito","fileHash":HASH_B,"substituted":True,"fallbackReason":"missing requested font"}])
        profile={"documentKind":"docx","fontManifestHash":manifest["fontManifestHash"]}
        status=bind_font_manifest(profile,manifest)
        self.assertFalse(status["trustedLayout"]); self.assertEqual(status["diagnosticCode"],"DOCX_FONT_SUBSTITUTION")
    def test_exact_font_resolution_is_layout_eligible(self):
        manifest=make_font_manifest([{"requestedFamily":"Arial","resolvedFamily":"Arial","fileHash":HASH_A}])
        self.assertTrue(bind_font_manifest({"documentKind":"docx","fontManifestHash":manifest["fontManifestHash"]},manifest)["trustedLayout"])
    def test_manifest_hash_mismatch_fails_closed(self):
        manifest=make_font_manifest([{"requestedFamily":"Arial","resolvedFamily":"Arial","fileHash":HASH_A}])
        with self.assertRaises(FontManifestError) as caught: bind_font_manifest({"documentKind":"docx","fontManifestHash":HASH_B},manifest)
        self.assertEqual(caught.exception.code,"DOCX_FONT_MANIFEST_MISMATCH")

if __name__=="__main__": unittest.main()
