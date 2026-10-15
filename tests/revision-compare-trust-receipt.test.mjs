import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { stableStringify } from '../tabs/revision-compare/revision-contract-utils.js';
import { sha256Text } from '../tabs/revision-compare/revision-hash.js';
import {
  REVISION_COMPARE_TRUST_ALGORITHM, REVISION_COMPARE_TRUST_RECEIPT_ID_PREFIX,
  REVISION_COMPARE_TRUST_RECEIPT_SCHEMA, REVISION_COMPARE_TRUST_STATE_SCHEMA,
  REVISION_COMPARE_TRUST_STATEMENT, REVISION_COMPARE_TRUST_STATUS,
  createRevisionCompareTrustReceiptState, reconcileRevisionCompareTrustReceiptState,
  revisionCompareSignOffSignaturePayload, revisionCompareSignOffSignatureSubject,
  revisionCompareTrustReceiptHashMaterial, serializeRevisionCompareSignOffSignaturePayload,
  verifyRevisionCompareTrustReceipt, verifyRevisionCompareTrustReceiptJson,
} from '../tabs/revision-compare/revision-trust-receipt.js';

const report = Object.freeze({
  schema: 'RevisionCompareSignOffReport.v1', reportId: `revision-sign-off:${'a'.repeat(64)}`,
  contentSha256: 'a'.repeat(64), sourceEvidence: Object.freeze({
    packageId: `revision-evidence-package:${'b'.repeat(64)}`, packageContentSha256: 'b'.repeat(64),
    sessionId: 'revision-session-trust',
  }),
});
const base64Url = (bytes) => Buffer.from(bytes).toString('base64url');
async function keyPair(modulusLength = 2048, publicExponent = new Uint8Array([1, 0, 1])) {
  return webcrypto.subtle.generateKey({ name: 'RSA-PSS', modulusLength, publicExponent, hash: 'SHA-256' }, true, ['sign', 'verify']);
}
async function receiptFor(sourceReport = report, options = {}) {
  const keys = options.keys ?? await keyPair(); const publicKeyJwk = await webcrypto.subtle.exportKey('jwk', keys.publicKey);
  const subject = revisionCompareSignOffSignatureSubject(sourceReport);
  const payload = serializeRevisionCompareSignOffSignaturePayload(subject);
  const signatureBytes = new Uint8Array(await webcrypto.subtle.sign({ name: 'RSA-PSS', saltLength: 32 }, keys.privateKey, new TextEncoder().encode(payload)));
  const receipt = {
    schema: REVISION_COMPARE_TRUST_RECEIPT_SCHEMA, receiptId: '', contentSha256: '', subject,
    signerClaim: { displayName: 'External Reviewer', role: 'Verifier', organization: 'Example Engineering', issuer: null, keyId: 'rsa-key-001' },
    signature: {
      algorithm: REVISION_COMPARE_TRUST_ALGORITHM, publicKeyJwk,
      publicKeySha256: await sha256Text(stableStringify(publicKeyJwk), webcrypto),
      signedPayloadSha256: await sha256Text(payload, webcrypto), signatureBase64Url: base64Url(signatureBytes),
      signedAt: '2026-07-22T04:00:00.000Z',
    },
    trustBoundary: { identityStatus: 'EXTERNALLY_ASSERTED', trustStatus: 'NOT_ESTABLISHED' },
  };
  receipt.contentSha256 = await sha256Text(stableStringify(revisionCompareTrustReceiptHashMaterial(receipt)), webcrypto);
  receipt.receiptId = `${REVISION_COMPARE_TRUST_RECEIPT_ID_PREFIX}${receipt.contentSha256}`;
  return { receipt, keys };
}
async function rehash(value) {
  value.contentSha256 = await sha256Text(stableStringify(revisionCompareTrustReceiptHashMaterial(value)), webcrypto);
  value.receiptId = `${REVISION_COMPARE_TRUST_RECEIPT_ID_PREFIX}${value.contentSha256}`;
  return value;
}

assert.equal(REVISION_COMPARE_TRUST_STATE_SCHEMA, 'RevisionCompareTrustReceiptState.v1');
assert.equal(REVISION_COMPARE_TRUST_STATEMENT, 'The detached signature is cryptographically valid for the identified completion report and supplied public key. Signer identity, organizational authority, certificate trust and approval are not established.');
assert.deepEqual(revisionCompareSignOffSignaturePayload(revisionCompareSignOffSignatureSubject(report)), {
  schema: 'RevisionCompareSignOffSignaturePayload.v1', signOffReportId: report.reportId,
  signOffContentSha256: report.contentSha256, evidencePackageId: report.sourceEvidence.packageId,
  evidencePackageContentSha256: report.sourceEvidence.packageContentSha256, sessionId: report.sourceEvidence.sessionId,
});
const source = await receiptFor(); const before = structuredClone(source.receipt);
const verified = await verifyRevisionCompareTrustReceipt(source.receipt, report, webcrypto);
assert.deepEqual(source.receipt, before); assert.deepEqual(verified, source.receipt);
assert(Object.isFrozen(verified) && Object.isFrozen(verified.signature.publicKeyJwk));
assert.equal((await verifyRevisionCompareTrustReceiptJson(JSON.stringify(source.receipt), report, webcrypto)).receiptId, verified.receiptId);
await assert.rejects(() => verifyRevisionCompareTrustReceiptJson('{"schema":"RevisionCompareExternalSignatureReceipt.v1","schema":"RevisionCompareExternalSignatureReceipt.v1"}', report, webcrypto), /duplicate field/);
await assert.rejects(() => verifyRevisionCompareTrustReceipt(source.receipt, null, webcrypto), /retained RevisionCompareSignOffReport/);
assert.equal(verified.receiptId, `${REVISION_COMPARE_TRUST_RECEIPT_ID_PREFIX}${verified.contentSha256}`);

for (const [mutate, pattern, shouldRehash = true] of [
  [(value) => { value.extra = true; }, /unsupported or missing fields/],
  [(value) => { value.schema = 'RevisionCompareExternalSignatureReceipt.v2'; }, /schema must be/],
  [(value) => { value.receiptId = `${REVISION_COMPARE_TRUST_RECEIPT_ID_PREFIX}${'0'.repeat(64)}`; }, /Receipt ID/, false],
  [(value) => { value.contentSha256 = '0'.repeat(64); }, /content SHA-256/, false],
  [(value) => { value.signature.signedPayloadSha256 = '0'.repeat(64); }, /Signed-payload/],
  [(value) => { value.signature.publicKeySha256 = '0'.repeat(64); }, /Public-JWK/],
  [(value) => { value.signature.algorithm = 'RSA_PKCS1_SHA256'; }, /Only RSA_PSS/],
  [(value) => { value.signature.publicKeyJwk.d = 'private'; }, /unsupported or missing fields|Private RSA/],
  [(value) => { value.signature.publicKeyJwk.e = 'Aw'; }, /exponent must be 65537/],
  [(value) => { value.signature.signatureBase64Url = `${value.signature.signatureBase64Url}=`; }, /unpadded base64url/],
  [(value) => { value.subject.sessionId = 'other-session'; }, /does not match the retained/],
  [(value) => { value.subject.evidencePackageId = 'other-package'; }, /does not match the retained/],
  [(value) => { value.subject.evidencePackageContentSha256 = 'c'.repeat(64); }, /does not match the retained/],
  [(value) => { value.signature.signedAt = 'not-an-iso-time'; }, /exact ISO timestamp/],
]) {
  const value = structuredClone(source.receipt); mutate(value);
  if (shouldRehash) await rehash(value);
  await assert.rejects(() => verifyRevisionCompareTrustReceipt(value, report, webcrypto), pattern);
}
const weak = await receiptFor(report, { keys: await keyPair(1024) });
await assert.rejects(() => verifyRevisionCompareTrustReceipt(weak.receipt, report, webcrypto), /at least 2048/);
const invalid = structuredClone(source.receipt);
const signature = Buffer.from(invalid.signature.signatureBase64Url, 'base64url'); signature[0] ^= 1;
invalid.signature.signatureBase64Url = signature.toString('base64url'); await rehash(invalid);
await assert.rejects(() => verifyRevisionCompareTrustReceipt(invalid, report, webcrypto), /signature is invalid/);

const attached = Object.freeze({ ...createRevisionCompareTrustReceiptState(), status: REVISION_COMPARE_TRUST_STATUS.VERIFIED_CURRENT,
  receipt: verified, receiptId: verified.receiptId, contentSha256: verified.contentSha256,
  publicKeySha256: verified.signature.publicKeySha256, cryptographicStatus: 'VALID' });
assert.equal(reconcileRevisionCompareTrustReceiptState(attached, { status: 'CREATED', report }).status, 'VERIFIED_CURRENT');
assert.equal(reconcileRevisionCompareTrustReceiptState(attached, { status: 'STALE', report }).status, 'VERIFIED_HISTORICAL');
assert.equal(reconcileRevisionCompareTrustReceiptState(attached, { status: 'CREATED', report: { ...report, reportId: `revision-sign-off:${'c'.repeat(64)}` } }).status, 'IDLE');

const production = await readFile(new URL('../tabs/revision-compare/revision-trust-receipt.js', import.meta.url), 'utf8');
assert.doesNotMatch(production, /generateKey\s*\(|\.sign\s*\(|privateKey|private-key material/i);
assert.doesNotMatch(production, /default export|export default/);
const workspace = await readFile(new URL('../tabs/revision-compare/revision-compare-workspace.js', import.meta.url), 'utf8');
assert.match(workspace, /let trustImportGeneration = 0;/);
assert.match(workspace, /const generation = \+\+trustImportGeneration;/);
assert.doesNotMatch(workspace, /state\.trustReceipt\?\.requestGeneration[^\n]*\+ 1/);
console.log('revision-compare-trust-receipt.test.mjs passed');