/** Versioned canonical SHA-256 integrity for responsiveness observation receipts. */
import { deepFreeze, stableStringify } from './revision-contract-utils.js';
import { sha256Text } from './revision-hash.js';

export const REVISION_RESPONSIVENESS_RECEIPT_V1_SCHEMA = 'RevisionResponsivenessObservationReceipt.v1';
export const REVISION_RESPONSIVENESS_RECEIPT_V2_SCHEMA = 'RevisionResponsivenessObservationReceipt.v2';
export const REVISION_RESPONSIVENESS_RECEIPT_ID_PREFIX = 'responsiveness-observation:';

const SHA256 = /^[a-f0-9]{64}$/;

export function revisionResponsivenessReceiptHashMaterial(receipt) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    throw new TypeError('Responsiveness receipt must be an object.');
  }
  const { receiptId: _receiptId, contentSha256: _contentSha256, ...material } = receipt;
  return deepFreeze(JSON.parse(stableStringify(material)));
}

export function revisionResponsivenessReceiptId(contentSha256) {
  if (!SHA256.test(String(contentSha256 ?? ''))) {
    throw new TypeError('Responsiveness receipt contentSha256 must be lowercase SHA-256.');
  }
  return `${REVISION_RESPONSIVENESS_RECEIPT_ID_PREFIX}${contentSha256.slice(0, 24)}`;
}

export async function createRevisionResponsivenessReceiptIntegrity(receipt, cryptoRef) {
  const material = revisionResponsivenessReceiptHashMaterial(receipt);
  const contentSha256 = await sha256Text(stableStringify(material), cryptoRef);
  return deepFreeze({ contentSha256, receiptId: revisionResponsivenessReceiptId(contentSha256) });
}

export async function verifyRevisionResponsivenessReceiptIntegrity(receipt, cryptoRef) {
  const schema = receipt?.schema;
  if (![REVISION_RESPONSIVENESS_RECEIPT_V1_SCHEMA, REVISION_RESPONSIVENESS_RECEIPT_V2_SCHEMA].includes(schema)) {
    throw new TypeError('Responsiveness receipt schema is unsupported.');
  }
  const integrity = await createRevisionResponsivenessReceiptIntegrity(receipt, cryptoRef);
  if (schema === REVISION_RESPONSIVENESS_RECEIPT_V2_SCHEMA) {
    if (!SHA256.test(String(receipt.contentSha256 ?? ''))) throw new TypeError('contentSha256 must be lowercase SHA-256.');
    if (receipt.contentSha256 !== integrity.contentSha256) throw new TypeError('Content SHA-256 does not match canonical receipt content.');
  }
  if (receipt.receiptId !== integrity.receiptId) throw new TypeError('Receipt ID does not match canonical receipt content.');
  return deepFreeze({
    schema,
    contentSha256: integrity.contentSha256,
    contentSha256Status: schema === REVISION_RESPONSIVENESS_RECEIPT_V2_SCHEMA ? 'VERIFIED' : 'LEGACY_NOT_DECLARED',
    receiptIdStatus: 'VERIFIED',
  });
}
