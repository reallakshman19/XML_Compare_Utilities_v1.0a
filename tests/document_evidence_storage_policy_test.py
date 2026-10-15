import unittest
from document_evidence_storage_policy import EvidenceStoragePolicyError, make_storage_policy, retrieval_eligible

class EvidenceStoragePolicyTest(unittest.TestCase):
    def test_ephemeral_policy_is_not_retrieval_eligible(self):
        policy=make_storage_policy("ephemeral"); self.assertFalse(retrieval_eligible(policy)["retrievalEndpointEligible"])
    def test_persistent_policy_requires_ttl_scope_eviction_and_limit(self):
        with self.assertRaises(EvidenceStoragePolicyError) as caught: make_storage_policy("content-addressed-persistent")
        self.assertEqual(caught.exception.code,"EVIDENCE_STORAGE_POLICY_INCOMPLETE")
    def test_complete_persistent_policy_is_content_addressed(self):
        one=make_storage_policy("content-addressed-persistent",ttl_seconds=86400,access_scope="workspace",eviction="lru-with-ttl",encryption_at_rest="platform-managed",max_retained_bytes=1073741824)
        two=make_storage_policy("content-addressed-persistent",ttl_seconds=86400,access_scope="workspace",eviction="lru-with-ttl",encryption_at_rest="platform-managed",max_retained_bytes=1073741824)
        self.assertEqual(one["storagePolicyHash"],two["storagePolicyHash"]); self.assertTrue(retrieval_eligible(one)["retrievalEndpointEligible"])
    def test_policy_change_changes_identity(self):
        one=make_storage_policy("content-addressed-persistent",ttl_seconds=86400,access_scope="workspace",eviction="lru-with-ttl",max_retained_bytes=1000)
        two=make_storage_policy("content-addressed-persistent",ttl_seconds=3600,access_scope="workspace",eviction="lru-with-ttl",max_retained_bytes=1000)
        self.assertNotEqual(one["storagePolicyHash"],two["storagePolicyHash"])

if __name__=="__main__": unittest.main()
