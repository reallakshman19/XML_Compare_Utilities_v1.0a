/** Deterministic read-only receipt for one bend review-package verification. */

import { stableStringify } from '../adapters/bend-geometry-audit.js';
import {
  BEND_REVIEW_PACKAGE_CONTRACT,
  BEND_REVIEW_PACKAGE_SIGNATURE_ALGORITHM,
  computeWorkbenchEvidenceSignature,
} from './bend-review-package.js';

export const BEND_REVIEW_VERIFICATION_RECEIPT_CONTRACT = 'WorkbenchBendReviewVerificationReceipt.v1';
export const BEND_REVIEW_VERIFICATION_RECEIPT_AUTHORITY = 'READ_ONLY_VERIFICATION_RECEIPT';
export const BEND_REVIEW_RECEIPT_STATUS = Object.freeze({
  MATCH: 'MATCH',
  STALE_CURRENT_PACKAGE: 'STALE_CURRENT_PACKAGE',
  INVALID_RECEIPT: 'INVALID_RECEIPT',
});

const MAX_RECEIPT_CHARACTERS = 250_000;

function text(value) { return String(value ?? '').trim(); }
function object(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function packageReference(manifest) {
  return Object.freeze({
    contract: text(manifest?.contract),
    packageSignature: text(manifest?.packageSignature),
    disposition: text(manifest?.disposition),
  });
}
function differenceRows(rows) {
  return Object.freeze((Array.isArray(rows) ? rows : []).map((row) => Object.freeze({
    field: text(row?.field),
    imported: text(row?.imported) || '—',
    current: text(row?.current) || '—',
  })).sort((a, b) => a.field.localeCompare(b.field)
    || a.imported.localeCompare(b.imported) || a.current.localeCompare(b.current)));
}
function receiptResult(status, code, message, differences = []) {
  return Object.freeze({ status, code, message, differences: Object.freeze(differences) });
}
function receiptDifference(field, imported, current) {
  return Object.freeze({ field, imported: text(imported) || '—', current: text(current) || '—' });
}

export function computeBendReviewVerificationReceiptSignature(payload = {}) {
  return computeWorkbenchEvidenceSignature('wb3d-verify', payload);
}

export function buildBendReviewVerificationReceipt({ importedManifest, currentManifest, verification } = {}) {
  const differences = differenceRows(verification?.differences);
  const payload = Object.freeze({
    importedPackage: packageReference(importedManifest),
    currentPackage: packageReference(currentManifest),
    verification: Object.freeze({
      status: text(verification?.status) || 'INVALID_PACKAGE',
      code: text(verification?.code) || 'VERIFICATION_UNAVAILABLE',
      differenceCount: differences.length,
      differences,
    }),
  });
  return Object.freeze({
    contract: BEND_REVIEW_VERIFICATION_RECEIPT_CONTRACT,
    signatureAlgorithm: BEND_REVIEW_PACKAGE_SIGNATURE_ALGORITHM,
    receiptSignature: computeBendReviewVerificationReceiptSignature(payload),
    deterministic: true,
    authority: BEND_REVIEW_VERIFICATION_RECEIPT_AUTHORITY,
    payload,
  });
}

export function parseBendReviewVerificationReceiptText(value = '') {
  const source = String(value ?? '');
  if (!source.trim()) return Object.freeze({ ok: false, error: 'Receipt JSON is empty.' });
  if (source.length > MAX_RECEIPT_CHARACTERS) {
    return Object.freeze({ ok: false, error: `Receipt JSON exceeds ${MAX_RECEIPT_CHARACTERS} characters.` });
  }
  try {
    const receipt = JSON.parse(source);
    if (!object(receipt)) return Object.freeze({ ok: false, error: 'Receipt JSON must contain one object.' });
    return Object.freeze({ ok: true, receipt });
  } catch (error) {
    return Object.freeze({ ok: false, error: `Receipt JSON is invalid: ${error?.message || error}` });
  }
}

function validateReceipt(receipt) {
  if (!object(receipt)) return 'Receipt object is missing.';
  if (receipt.contract !== BEND_REVIEW_VERIFICATION_RECEIPT_CONTRACT) return `Unsupported receipt contract: ${text(receipt.contract) || 'missing'}.`;
  if (receipt.signatureAlgorithm !== BEND_REVIEW_PACKAGE_SIGNATURE_ALGORITHM) return `Unsupported receipt signature algorithm: ${text(receipt.signatureAlgorithm) || 'missing'}.`;
  if (receipt.authority !== BEND_REVIEW_VERIFICATION_RECEIPT_AUTHORITY) return `Unexpected receipt authority: ${text(receipt.authority) || 'missing'}.`;
  if (receipt.deterministic !== true) return 'Receipt must declare deterministic=true.';
  if (!object(receipt.payload)) return 'Receipt payload is missing.';
  if (!object(receipt.payload.currentPackage)) return 'Receipt current-package reference is missing.';
  if (receipt.payload.currentPackage.contract !== BEND_REVIEW_PACKAGE_CONTRACT) return `Unsupported recorded package contract: ${text(receipt.payload.currentPackage.contract) || 'missing'}.`;
  if (!text(receipt.payload.currentPackage.packageSignature)) return 'Receipt current-package signature is missing.';
  if (!text(receipt.payload.currentPackage.disposition)) return 'Receipt current-package disposition is missing.';
  if (!object(receipt.payload.verification)) return 'Receipt verification evidence is missing.';
  const expected = computeBendReviewVerificationReceiptSignature(receipt.payload);
  if (receipt.receiptSignature !== expected) return `Receipt signature mismatch; expected ${expected}.`;
  return '';
}

export function verifyBendReviewVerificationReceipt(receipt, currentManifest) {
  const invalid = validateReceipt(receipt);
  if (invalid) return receiptResult(BEND_REVIEW_RECEIPT_STATUS.INVALID_RECEIPT, 'RECEIPT_INVALID', invalid);
  const recorded = receipt.payload?.currentPackage ?? {};
  const current = packageReference(currentManifest);
  const differences = [];
  for (const [field, label] of [
    ['contract', 'Current package contract'], ['packageSignature', 'Current package signature'],
    ['disposition', 'Current package disposition'],
  ]) {
    if (text(recorded[field]) !== text(current[field])) differences.push(receiptDifference(label, recorded[field], current[field]));
  }
  if (differences.length) {
    return receiptResult(BEND_REVIEW_RECEIPT_STATUS.STALE_CURRENT_PACKAGE, 'CURRENT_PACKAGE_CHANGED', 'Receipt current-package reference differs from the loaded Workbench package.', differences);
  }
  return receiptResult(BEND_REVIEW_RECEIPT_STATUS.MATCH, 'RECEIPT_MATCH', 'Receipt is valid and its current-package reference matches the loaded Workbench package.');
}

export function serializeBendReviewVerificationReceipt(receipt = {}) {
  return stableStringify(receipt);
}
