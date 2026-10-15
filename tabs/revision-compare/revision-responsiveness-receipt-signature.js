/** Strict detached RSA-PSS verification for one retained responsiveness receipt. */
import { assertJsonSafe, deepFreeze, stableStringify } from './revision-contract-utils.js';
import { sha256Text } from './revision-hash.js';
import { REVISION_RESPONSIVENESS_RECEIPT_V2_SCHEMA } from './revision-responsiveness-receipt-integrity.js';
import { verifyRevisionResponsivenessObservationReceiptJson } from './revision-responsiveness-observation-receipt-import.js';

export const REVISION_RESPONSIVENESS_SIGNATURE_RECEIPT_SCHEMA = 'RevisionResponsivenessExternalSignatureReceipt.v1';
export const REVISION_RESPONSIVENESS_SIGNATURE_PAYLOAD_SCHEMA = 'RevisionResponsivenessSignaturePayload.v1';
export const REVISION_RESPONSIVENESS_SIGNATURE_STATE_SCHEMA = 'RevisionResponsivenessSignatureState.v1';
export const REVISION_RESPONSIVENESS_SIGNATURE_RECEIPT_ID_PREFIX = 'responsiveness-signature-receipt:';
export const REVISION_RESPONSIVENESS_SIGNATURE_ALGORITHM = 'RSA_PSS_SHA256';
export const REVISION_RESPONSIVENESS_SIGNATURE_MAX_BYTES = 256 * 1024;
export const REVISION_RESPONSIVENESS_SIGNATURE_STATEMENT = 'The detached signature is cryptographically valid for the identified responsiveness receipt and supplied public key. Signer identity, organizational authority, certificate trust, engineering acceptance and approval are not established.';

const ROOT = ['schema', 'receiptId', 'contentSha256', 'subject', 'signerClaim', 'signature', 'trustBoundary'];
const SUBJECT = ['responsivenessReceiptId', 'responsivenessReceiptContentSha256', 'sessionId', 'auditId', 'basisId', 'runId'];
const CLAIM = ['displayName', 'role', 'organization', 'issuer', 'keyId'];
const SIGNATURE = ['algorithm', 'publicKeyJwk', 'publicKeySha256', 'signedPayloadSha256', 'signatureBase64Url', 'signedAt'];
const BOUNDARY = ['identityStatus', 'trustStatus'];
const JWK = ['kty', 'n', 'e', 'alg', 'ext', 'key_ops'];
const PRIVATE_JWK = ['d', 'p', 'q', 'dp', 'dq', 'qi', 'oth'];
const SHA256 = /^[a-f0-9]{64}$/;
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const FIXED_TRUST_BOUNDARY = Object.freeze({ identityStatus: 'EXTERNALLY_ASSERTED', trustStatus: 'NOT_ESTABLISHED' });

function exactObject(value, fields, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be a plain object.`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new TypeError(`${label} must be a plain object.`);
  const actual = Object.keys(value).sort(); const expected = [...fields].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new TypeError(`${label} contains unsupported or missing fields.`);
  }
}

function assertPlainJson(value, label, seen = new WeakSet()) {
  if (value === null || ['string', 'boolean'].includes(typeof value)) return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (!value || typeof value !== 'object') throw new TypeError(`${label} is not JSON-safe.`);
  if (seen.has(value)) throw new TypeError(`${label} must not contain cycles.`); seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertPlainJson(item, `${label}[${index}]`, seen)); seen.delete(value); return;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new TypeError(`${label} must contain plain objects only.`);
  Object.entries(value).forEach(([key, item]) => assertPlainJson(item, `${label}.${key}`, seen)); seen.delete(value);
}

function requiredText(value, label, maximum = 240) {
  if (typeof value !== 'string' || !value || value !== value.trim()) throw new TypeError(`${label} must be a trimmed non-empty string.`);
  if (value.length > maximum) throw new RangeError(`${label} is limited to ${maximum} characters.`);
  return value;
}
function optionalText(value, label, maximum = 240) {
  if (value === null) return null;
  if (typeof value !== 'string' || value !== value.trim()) throw new TypeError(`${label} must be null or a trimmed string.`);
  if (value.length > maximum) throw new RangeError(`${label} is limited to ${maximum} characters.`);
  return value;
}
function digest(value, label) {
  if (typeof value !== 'string' || !SHA256.test(value)) throw new TypeError(`${label} must be a lowercase SHA-256 value.`);
  return value;
}
function exactIso(value, label) {
  const date = new Date(requiredText(value, label, 64));
  if (Number.isNaN(date.getTime()) || date.toISOString() !== value) throw new TypeError(`${label} must be an exact ISO timestamp.`);
  return value;
}

function encodeBase64Url(bytes) {
  let binary = ''; bytes.forEach((value) => { binary += String.fromCharCode(value); });
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}
function decodeBase64Url(value, label) {
  if (typeof value !== 'string' || !value || !BASE64URL.test(value) || value.includes('=')) throw new TypeError(`${label} must be unpadded base64url.`);
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = `${base64}${'='.repeat((4 - (base64.length % 4)) % 4)}`;
  let binary; try { binary = atob(padded); } catch { throw new TypeError(`${label} is malformed base64url.`); }
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (encodeBase64Url(bytes) !== value) throw new TypeError(`${label} is not canonical base64url.`);
  return bytes;
}

function assertNoDuplicateJsonKeys(text) {
  let index = 0;
  const invalid = () => { throw new TypeError('Responsiveness signature receipt JSON is invalid.'); };
  const skip = () => { while (/\s/u.test(text[index] ?? '')) index += 1; };
  const stringValue = () => {
    const start = index; index += 1;
    while (index < text.length) {
      if (text[index] === '\\') { index += 2; continue; }
      if (text[index] === '"') { index += 1; return JSON.parse(text.slice(start, index)); }
      index += 1;
    }
    return invalid();
  };
  const value = () => {
    skip(); const token = text[index];
    if (token === '"') return void stringValue();
    if (token === '[') { index += 1; skip(); if (text[index] === ']') { index += 1; return; } while (true) { value(); skip(); if (text[index] === ']') { index += 1; return; } if (text[index] !== ',') return invalid(); index += 1; } }
    if (token === '{') {
      index += 1; const keys = new Set(); skip(); if (text[index] === '}') { index += 1; return; }
      while (true) {
        skip(); if (text[index] !== '"') return invalid(); const key = stringValue();
        if (keys.has(key)) throw new TypeError(`Responsiveness signature receipt contains duplicate field "${key}".`); keys.add(key);
        skip(); if (text[index] !== ':') return invalid(); index += 1; value(); skip();
        if (text[index] === '}') { index += 1; return; } if (text[index] !== ',') return invalid(); index += 1;
      }
    }
    const start = index; while (index < text.length && !/[\s,\]}]/u.test(text[index])) index += 1;
    if (start === index) return invalid(); JSON.parse(text.slice(start, index));
  };
  value(); skip(); if (index !== text.length) invalid();
}

function modulusBits(bytes) {
  if (!bytes.length || bytes[0] === 0) return 0;
  return ((bytes.length - 1) * 8) + Math.floor(Math.log2(bytes[0])) + 1;
}
function validatePublicJwk(value) {
  exactObject(value, JWK, 'signature.publicKeyJwk');
  if (PRIVATE_JWK.some((field) => Object.hasOwn(value, field))) throw new TypeError('Private RSA JWK fields are prohibited.');
  if (value.kty !== 'RSA' || value.alg !== 'PS256' || value.ext !== true) throw new TypeError('The public JWK must be RSA, PS256 and extractable public evidence.');
  if (!Array.isArray(value.key_ops) || value.key_ops.length !== 1 || value.key_ops[0] !== 'verify') throw new TypeError('The public JWK key_ops must be exactly ["verify"].');
  const modulus = decodeBase64Url(value.n, 'signature.publicKeyJwk.n');
  const exponent = decodeBase64Url(value.e, 'signature.publicKeyJwk.e');
  if (modulusBits(modulus) < 2048) throw new TypeError('The RSA modulus must be at least 2048 bits.');
  if (exponent.length !== 3 || exponent[0] !== 1 || exponent[1] !== 0 || exponent[2] !== 1) throw new TypeError('The RSA public exponent must be 65537.');
  return { jwk: JSON.parse(stableStringify(value)), modulusBytes: modulus.length };
}

function validateSubject(subject) {
  exactObject(subject, SUBJECT, 'subject');
  return {
    responsivenessReceiptId: requiredText(subject.responsivenessReceiptId, 'subject.responsivenessReceiptId'),
    responsivenessReceiptContentSha256: digest(subject.responsivenessReceiptContentSha256, 'subject.responsivenessReceiptContentSha256'),
    sessionId: requiredText(subject.sessionId, 'subject.sessionId'), auditId: requiredText(subject.auditId, 'subject.auditId'),
    basisId: requiredText(subject.basisId, 'subject.basisId'), runId: requiredText(subject.runId, 'subject.runId'),
  };
}
function validateClaim(claim) {
  exactObject(claim, CLAIM, 'signerClaim');
  return {
    displayName: requiredText(claim.displayName, 'signerClaim.displayName', 160), role: requiredText(claim.role, 'signerClaim.role', 160),
    organization: optionalText(claim.organization, 'signerClaim.organization', 200), issuer: optionalText(claim.issuer, 'signerClaim.issuer', 200),
    keyId: requiredText(claim.keyId, 'signerClaim.keyId', 160),
  };
}
function validateBoundary(value) {
  exactObject(value, BOUNDARY, 'trustBoundary');
  if (value.identityStatus !== FIXED_TRUST_BOUNDARY.identityStatus || value.trustStatus !== FIXED_TRUST_BOUNDARY.trustStatus) {
    throw new TypeError('The signature receipt trust boundary is invalid.');
  }
  return { ...FIXED_TRUST_BOUNDARY };
}

export function revisionResponsivenessSignatureSubject(receipt) {
  if (receipt?.schema !== REVISION_RESPONSIVENESS_RECEIPT_V2_SCHEMA) throw new TypeError('A verified RevisionResponsivenessObservationReceipt.v2 is required.');
  return deepFreeze(validateSubject({
    responsivenessReceiptId: receipt.receiptId, responsivenessReceiptContentSha256: receipt.contentSha256,
    sessionId: receipt.session?.sessionId, auditId: receipt.audit?.auditId, basisId: receipt.audit?.basisId,
    runId: receipt.observation?.runId,
  }));
}
export function revisionResponsivenessSignaturePayload(subject, signerClaim, signedAt, trustBoundary = FIXED_TRUST_BOUNDARY) {
  return deepFreeze({
    schema: REVISION_RESPONSIVENESS_SIGNATURE_PAYLOAD_SCHEMA, algorithm: REVISION_RESPONSIVENESS_SIGNATURE_ALGORITHM,
    subject: validateSubject(subject), signerClaim: validateClaim(signerClaim),
    signedAt: exactIso(signedAt, 'signedAt'), trustBoundary: validateBoundary(trustBoundary),
  });
}
export function serializeRevisionResponsivenessSignaturePayload(subject, signerClaim, signedAt, trustBoundary = FIXED_TRUST_BOUNDARY) {
  return stableStringify(revisionResponsivenessSignaturePayload(subject, signerClaim, signedAt, trustBoundary));
}
export function revisionResponsivenessSignatureReceiptHashMaterial(receipt) {
  return deepFreeze(JSON.parse(stableStringify({
    schema: receipt?.schema, subject: receipt?.subject, signerClaim: receipt?.signerClaim,
    signature: receipt?.signature, trustBoundary: receipt?.trustBoundary,
  })));
}

function validateStructure(input) {
  assertPlainJson(input, 'receipt'); exactObject(input, ROOT, 'receipt');
  if (input.schema !== REVISION_RESPONSIVENESS_SIGNATURE_RECEIPT_SCHEMA) throw new TypeError(`Receipt schema must be ${REVISION_RESPONSIVENESS_SIGNATURE_RECEIPT_SCHEMA}.`);
  const subject = validateSubject(input.subject); const signerClaim = validateClaim(input.signerClaim);
  exactObject(input.signature, SIGNATURE, 'signature');
  if (input.signature.algorithm !== REVISION_RESPONSIVENESS_SIGNATURE_ALGORITHM) throw new TypeError('Only RSA_PSS_SHA256 is supported.');
  const signedAt = exactIso(input.signature.signedAt, 'signature.signedAt'); const trustBoundary = validateBoundary(input.trustBoundary);
  const key = validatePublicJwk(input.signature.publicKeyJwk);
  return { subject, signerClaim, signedAt, trustBoundary, key, signatureBytes: decodeBase64Url(input.signature.signatureBase64Url, 'signature.signatureBase64Url') };
}

async function verifyHashes(input, structure, cryptoRef) {
  const receiptHash = await sha256Text(stableStringify(revisionResponsivenessSignatureReceiptHashMaterial(input)), cryptoRef);
  if (digest(input.contentSha256, 'contentSha256') !== receiptHash) throw new TypeError('Signature receipt content SHA-256 does not match canonical material.');
  if (input.receiptId !== `${REVISION_RESPONSIVENESS_SIGNATURE_RECEIPT_ID_PREFIX}${receiptHash}`) throw new TypeError('Signature receipt ID does not match content SHA-256.');
  const payload = serializeRevisionResponsivenessSignaturePayload(structure.subject, structure.signerClaim, structure.signedAt, structure.trustBoundary);
  if (digest(input.signature.signedPayloadSha256, 'signature.signedPayloadSha256') !== await sha256Text(payload, cryptoRef)) throw new TypeError('Signed-payload SHA-256 does not match the canonical responsiveness signature payload.');
  if (digest(input.signature.publicKeySha256, 'signature.publicKeySha256') !== await sha256Text(stableStringify(structure.key.jwk), cryptoRef)) throw new TypeError('Public-JWK SHA-256 does not match the supplied public key.');
  return payload;
}
async function verifyRsaPss(structure, payload, cryptoRef) {
  const subtle = cryptoRef?.subtle; if (!subtle?.importKey || !subtle?.verify) throw new Error('Web Crypto RSA-PSS verification is unavailable.');
  if (structure.signatureBytes.length !== structure.key.modulusBytes) throw new TypeError('The detached signature length does not match the RSA modulus.');
  let key; try { key = await subtle.importKey('jwk', structure.key.jwk, { name: 'RSA-PSS', hash: 'SHA-256' }, false, ['verify']); }
  catch { throw new TypeError('The supplied public RSA JWK cannot be imported for RSA-PSS verification.'); }
  if (key.algorithm?.name !== 'RSA-PSS' || key.algorithm?.modulusLength < 2048) throw new TypeError('The imported RSA key does not satisfy the fixed profile.');
  const valid = await subtle.verify({ name: 'RSA-PSS', saltLength: 32 }, key, structure.signatureBytes, new TextEncoder().encode(payload));
  if (!valid) throw new Error('The detached RSA-PSS signature is invalid for the identified responsiveness receipt.');
}

export async function verifyRevisionResponsivenessSignatureReceipt(input, targetReceipt, cryptoRef) {
  const target = await verifyRevisionResponsivenessObservationReceiptJson(stableStringify(targetReceipt), cryptoRef);
  if (target.contentSha256Status !== 'VERIFIED') throw new TypeError('Signature verification requires a full-digest responsiveness receipt v2.');
  const before = stableStringify(input); const structure = validateStructure(input);
  if (stableStringify(structure.subject) !== stableStringify(revisionResponsivenessSignatureSubject(target.receipt))) throw new TypeError('The signature receipt subject does not match the retained responsiveness receipt.');
  await verifyRsaPss(structure, await verifyHashes(input, structure, cryptoRef), cryptoRef);
  if (stableStringify(input) !== before) throw new Error('Signature verification mutated the supplied evidence.');
  const canonical = JSON.parse(stableStringify(input)); assertJsonSafe(canonical, REVISION_RESPONSIVENESS_SIGNATURE_RECEIPT_SCHEMA);
  return deepFreeze(canonical);
}
export async function verifyRevisionResponsivenessSignatureReceiptJson(textValue, targetReceipt, cryptoRef) {
  const source = String(textValue ?? '');
  if (new TextEncoder().encode(source).byteLength > REVISION_RESPONSIVENESS_SIGNATURE_MAX_BYTES) throw new RangeError('Responsiveness signature receipt is limited to 256 KiB.');
  assertNoDuplicateJsonKeys(source);
  let value; try { value = JSON.parse(source); } catch { throw new TypeError('Responsiveness signature receipt JSON is invalid.'); }
  return verifyRevisionResponsivenessSignatureReceipt(value, targetReceipt, cryptoRef);
}

export function createRevisionResponsivenessSignatureState() {
  return deepFreeze({ schema: REVISION_RESPONSIVENESS_SIGNATURE_STATE_SCHEMA, status: 'IDLE', generation: 0, fileName: '', receipt: null, error: null });
}
export function startRevisionResponsivenessSignatureImport(state, generation, fileName) {
  return deepFreeze({ ...createRevisionResponsivenessSignatureState(), status: 'IMPORTING', generation, fileName: String(fileName ?? '') });
}
export function completeRevisionResponsivenessSignatureImport(state, generation, receipt) {
  if (state.generation !== generation || state.status !== 'IMPORTING') return state;
  return deepFreeze({ ...state, status: 'VERIFIED', receipt, error: null });
}
export function failRevisionResponsivenessSignatureImport(state, generation, error) {
  if (state.generation !== generation || state.status !== 'IMPORTING') return state;
  return deepFreeze({ ...state, status: 'FAILED', receipt: null, error: error?.message || String(error) });
}
export function revisionResponsivenessSignatureModel(state, targetReceipt, targetModel) {
  const available = targetReceipt?.schema === REVISION_RESPONSIVENESS_RECEIPT_V2_SCHEMA;
  const signature = state?.receipt;
  return deepFreeze({
    status: state?.status ?? 'IDLE', available, fileName: state?.fileName ?? '', error: state?.error ?? null,
    signatureReceiptId: signature?.receiptId ?? null, publicKeySha256: signature?.signature?.publicKeySha256 ?? null,
    signedAt: signature?.signature?.signedAt ?? null, signerClaim: signature ? `${signature.signerClaim.displayName} · ${signature.signerClaim.role}` : null,
    organizationClaim: signature?.signerClaim?.organization ?? null, algorithm: signature?.signature?.algorithm ?? REVISION_RESPONSIVENESS_SIGNATURE_ALGORITHM,
    cryptographicStatus: signature ? 'VALID' : state?.status === 'FAILED' ? 'INVALID' : 'NOT_VERIFIED',
    receiptRelationship: targetModel?.status ?? 'UNAVAILABLE', identityStatus: 'EXTERNALLY_ASSERTED', trustStatus: 'NOT_ESTABLISHED',
  });
}
