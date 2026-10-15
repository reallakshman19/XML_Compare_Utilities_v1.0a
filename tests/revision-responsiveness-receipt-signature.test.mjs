import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { stableStringify } from '../tabs/revision-compare/revision-contract-utils.js';
import { sha256Text } from '../tabs/revision-compare/revision-hash.js';
import { routeRevisionCompareInputChange } from '../tabs/revision-compare/revision-compare-event-routing.js';
import { createRevisionResponsivenessObservationReceipt } from '../tabs/revision-compare/revision-responsiveness-observation-receipt.js';
import { createRevisionResponsivenessReceiptVerificationWorkspace } from '../tabs/revision-compare/revision-responsiveness-receipt-verification-workspace.js';
import {
  REVISION_RESPONSIVENESS_SIGNATURE_ALGORITHM,
  REVISION_RESPONSIVENESS_SIGNATURE_RECEIPT_ID_PREFIX,
  REVISION_RESPONSIVENESS_SIGNATURE_RECEIPT_SCHEMA,
  REVISION_RESPONSIVENESS_SIGNATURE_STATEMENT,
  revisionResponsivenessSignatureReceiptHashMaterial,
  revisionResponsivenessSignatureSubject,
  serializeRevisionResponsivenessSignaturePayload,
  verifyRevisionResponsivenessSignatureReceipt,
  verifyRevisionResponsivenessSignatureReceiptJson,
} from '../tabs/revision-compare/revision-responsiveness-receipt-signature.js';

const HASH_A = 'a'.repeat(64); const SCOPE_A = 'b'.repeat(64);
const HASH_B = 'c'.repeat(64); const SCOPE_B = 'd'.repeat(64);
const RUN_KEY = 'audit:signature|WEBGL';
const session = Object.freeze({ sessionId: 'revision-session-signature', createdAt: '2026-07-30T12:00:00.000Z', updatedAt: '2026-07-30T12:05:00.000Z' });
const audit = Object.freeze({
  schema: 'RevisionCompareAudit.v1', auditId: 'audit:signature', basisId: 'basis:signature',
  engineVersion: 'revision-compare-test/v1', revADocumentId: 'document:a', revBDocumentId: 'document:b',
  validation: Object.freeze({ status: 'READY', errors: Object.freeze([]) }),
});
function document(documentId, sourceHash, scopedHash) {
  return Object.freeze({ documentId, sourceHash, scopedHash, stagedSchema: 'inputxml-managed-stage/v1', unit: 'MM', coordinateFrame: 'PLANT', verticalAxis: 'Z' });
}
const revA = document('document:a', HASH_A, SCOPE_A); const revB = document('document:b', HASH_B, SCOPE_B);
function runSummary(runId) {
  return Object.freeze({ runId, runSequence: 1, policyId: 'signature-policy', bandId: 'FINE', drawableCount: 2, disposition: 'QUALIFIED', sceneMs: 10, firstReadyMs: 12, fitSelectedMs: 2, heapGrowthBytes: null });
}
function currentInput(sessionValue = session) {
  const runId = `${RUN_KEY}|run:1`; const current = runSummary(runId);
  const responsiveness = Object.freeze({
    runKey: RUN_KEY, runId, runSequence: 1, policyId: current.policyId, bandId: current.bandId,
    drawableCount: current.drawableCount, sceneStatus: 'READY', disposition: 'QUALIFIED',
    metrics: Object.freeze({
      scene: Object.freeze({ status: 'PASS', value: 10, limit: 100 }),
      firstReady: Object.freeze({ status: 'PASS', value: 12, limit: 100 }),
      fitSelected: Object.freeze({ status: 'PASS', value: 2, limit: 20, count: 1 }),
      memory: Object.freeze({ status: 'UNAVAILABLE', value: null, limit: 1024, usedBytes: null }),
    }),
    comparison: Object.freeze({ available: false, reason: 'NO_PREVIOUS_RUN', previous: null, current,
      deltas: Object.freeze({ sceneMs: null, firstReadyMs: null, fitSelectedMs: null, heapGrowthBytes: null }) }),
  });
  return Object.freeze({
    session: sessionValue, audit, revA, revB,
    sceneEvidence: Object.freeze({ runKey: RUN_KEY, runId, runSequence: 1, runSampleCount: 1, elapsedMs: 15, responsiveness }),
  });
}
const base64Url = (bytes) => Buffer.from(bytes).toString('base64url');
async function keyPair(modulusLength = 2048) {
  return webcrypto.subtle.generateKey({ name: 'RSA-PSS', modulusLength, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
}
async function signatureReceiptFor(target, keys = await keyPair()) {
  const publicKeyJwk = await webcrypto.subtle.exportKey('jwk', keys.publicKey);
  const subject = revisionResponsivenessSignatureSubject(target);
  const signerClaim = { displayName: 'External Runtime Reviewer', role: 'Verifier', organization: 'Example Engineering', issuer: null, keyId: 'runtime-rsa-001' };
  const signedAt = '2026-07-30T12:10:00.000Z';
  const trustBoundary = { identityStatus: 'EXTERNALLY_ASSERTED', trustStatus: 'NOT_ESTABLISHED' };
  const payload = serializeRevisionResponsivenessSignaturePayload(subject, signerClaim, signedAt, trustBoundary);
  const signatureBytes = new Uint8Array(await webcrypto.subtle.sign({ name: 'RSA-PSS', saltLength: 32 }, keys.privateKey, new TextEncoder().encode(payload)));
  const receipt = {
    schema: REVISION_RESPONSIVENESS_SIGNATURE_RECEIPT_SCHEMA, receiptId: '', contentSha256: '', subject, signerClaim,
    signature: {
      algorithm: REVISION_RESPONSIVENESS_SIGNATURE_ALGORITHM, publicKeyJwk,
      publicKeySha256: await sha256Text(stableStringify(publicKeyJwk), webcrypto),
      signedPayloadSha256: await sha256Text(payload, webcrypto), signatureBase64Url: base64Url(signatureBytes), signedAt,
    },
    trustBoundary,
  };
  receipt.contentSha256 = await sha256Text(stableStringify(revisionResponsivenessSignatureReceiptHashMaterial(receipt)), webcrypto);
  receipt.receiptId = `${REVISION_RESPONSIVENESS_SIGNATURE_RECEIPT_ID_PREFIX}${receipt.contentSha256}`;
  return { receipt, keys };
}
async function rehash(value) {
  value.contentSha256 = await sha256Text(stableStringify(revisionResponsivenessSignatureReceiptHashMaterial(value)), webcrypto);
  value.receiptId = `${REVISION_RESPONSIVENESS_SIGNATURE_RECEIPT_ID_PREFIX}${value.contentSha256}`;
  return value;
}
async function resignPayloadHash(value) {
  const payload = serializeRevisionResponsivenessSignaturePayload(value.subject, value.signerClaim, value.signature.signedAt, value.trustBoundary);
  value.signature.signedPayloadSha256 = await sha256Text(payload, webcrypto); return rehash(value);
}
function fileFor(name, value) {
  const text = JSON.stringify(value); return { name, size: Buffer.byteLength(text), text: async () => text };
}
function deferredFile(name, value) {
  const text = JSON.stringify(value); let release;
  const gate = new Promise((resolve) => { release = resolve; });
  return { file: { name, size: Buffer.byteLength(text), text: async () => { await gate; return text; } }, release };
}

const input = currentInput(); const target = await createRevisionResponsivenessObservationReceipt(input, webcrypto);
const signed = await signatureReceiptFor(target); const before = structuredClone(signed.receipt);
const verified = await verifyRevisionResponsivenessSignatureReceipt(signed.receipt, target, webcrypto);
assert.deepEqual(signed.receipt, before); assert.deepEqual(verified, signed.receipt);
assert(Object.isFrozen(verified) && Object.isFrozen(verified.signature.publicKeyJwk));
assert.equal((await verifyRevisionResponsivenessSignatureReceiptJson(JSON.stringify(signed.receipt), target, webcrypto)).receiptId, verified.receiptId);
assert.equal(REVISION_RESPONSIVENESS_SIGNATURE_STATEMENT.includes('engineering acceptance'), true);
assert.equal(verified.trustBoundary.identityStatus, 'EXTERNALLY_ASSERTED'); assert.equal(verified.trustBoundary.trustStatus, 'NOT_ESTABLISHED');

await assert.rejects(
  () => verifyRevisionResponsivenessSignatureReceiptJson('{"schema":"RevisionResponsivenessExternalSignatureReceipt.v1","schema":"RevisionResponsivenessExternalSignatureReceipt.v1"}', target, webcrypto),
  /duplicate field/,
);
for (const [mutate, pattern] of [
  [(value) => { value.subject.runId = `${RUN_KEY}|run:2`; }, /subject does not match/],
  [(value) => { value.signature.publicKeySha256 = '0'.repeat(64); }, /Public-JWK/],
  [(value) => { value.signature.publicKeyJwk.d = 'private'; }, /unsupported or missing fields|Private RSA/],
  [(value) => { value.trustBoundary.trustStatus = 'TRUSTED'; }, /trust boundary/],
  [(value) => { value.signerClaim.displayName = 'Altered Reviewer'; }, /Signed-payload/],
  [(value) => { value.signature.signedAt = '2026-07-30T12:11:00.000Z'; }, /Signed-payload/],
]) {
  const value = structuredClone(signed.receipt); mutate(value); await rehash(value);
  await assert.rejects(() => verifyRevisionResponsivenessSignatureReceipt(value, target, webcrypto), pattern);
}
for (const mutate of [
  (value) => { value.signerClaim.displayName = 'Altered Reviewer'; },
  (value) => { value.signature.signedAt = '2026-07-30T12:11:00.000Z'; },
]) {
  const value = structuredClone(signed.receipt); mutate(value); await resignPayloadHash(value);
  await assert.rejects(() => verifyRevisionResponsivenessSignatureReceipt(value, target, webcrypto), /signature is invalid/);
}
const invalid = structuredClone(signed.receipt); const signatureBytes = Buffer.from(invalid.signature.signatureBase64Url, 'base64url');
signatureBytes[0] ^= 1; invalid.signature.signatureBase64Url = signatureBytes.toString('base64url'); await rehash(invalid);
await assert.rejects(() => verifyRevisionResponsivenessSignatureReceipt(invalid, target, webcrypto), /signature is invalid/);
const weak = await signatureReceiptFor(target, await keyPair(1024));
await assert.rejects(() => verifyRevisionResponsivenessSignatureReceipt(weak.receipt, target, webcrypto), /at least 2048/);

const lifecycle = createRevisionResponsivenessReceiptVerificationWorkspace({
  cryptoRef: webcrypto, root: null, readCurrentInput: () => input, renderWorkspace() {}, showToast() {}, reportFailure(error) { throw error; },
});
await lifecycle.importFile(fileFor('receipt.json', target));
assert.equal(lifecycle.model().status, 'VERIFIED_CURRENT'); assert.equal(lifecycle.signatureModel().available, true);
await lifecycle.importFile(fileFor('signature.json', signed.receipt), 'signature');
assert.equal(lifecycle.signatureModel().status, 'VERIFIED'); assert.equal(lifecycle.signatureModel().cryptographicStatus, 'VALID');
assert.equal(lifecycle.signatureModel().trustStatus, 'NOT_ESTABLISHED');
await lifecycle.importFile(fileFor('receipt-again.json', target));
assert.equal(lifecycle.signatureModel().status, 'IDLE', 'replacing the target receipt must clear its signature state');

const target2 = await createRevisionResponsivenessObservationReceipt(currentInput(Object.freeze({ ...session, updatedAt: '2026-07-30T12:06:00.000Z' })), webcrypto);
const signed2 = await signatureReceiptFor(target2); await lifecycle.importFile(fileFor('receipt-race-a.json', target));
const delayed = deferredFile('signature-old.json', signed.receipt); const oldImport = lifecycle.importFile(delayed.file, 'signature');
await lifecycle.importFile(fileFor('receipt-race-b.json', target2)); await lifecycle.importFile(fileFor('signature-new.json', signed2.receipt), 'signature');
delayed.release(); await oldImport;
assert.equal(lifecycle.signatureModel().signatureReceiptId, signed2.receipt.receiptId, 'stale signature completion must not replace the newer signature');

let routed = null;
const routedActions = new Proxy({ transferChange() {}, syncSignOffControls() {} }, {
  get: (object, key) => object[key] ?? ((...args) => { if (key === 'importResponsivenessReceipt') routed = args; }),
});
const routedFile = fileFor('signature.json', signed.receipt);
const targetInput = { files: [routedFile], value: 'selected', matches: (selector) => selector === '[data-revc-responsiveness-signature-import]', dataset: {} };
routeRevisionCompareInputChange(routedActions, targetInput);
assert.equal(targetInput.value, ''); assert.equal(routed[0], routedFile); assert.equal(routed[1], 'signature');

const production = await readFile(new URL('../tabs/revision-compare/revision-responsiveness-receipt-signature.js', import.meta.url), 'utf8');
assert.doesNotMatch(production, /generateKey\s*\(|\.sign\s*\(|privateKey|private-key material/i);
assert.doesNotMatch(production, /default export|export default/);
console.log('revision-responsiveness-receipt-signature.test.mjs passed');
