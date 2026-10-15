/** Bounded attachment of one verified-current responsiveness receipt to an evidence package. */
import { deepFreeze } from './revision-contract-utils.js';
import { REVISION_RESPONSIVENESS_RECEIPT_V2_SCHEMA } from './revision-responsiveness-receipt-integrity.js';
import { verifyRevisionResponsivenessObservationReceiptJson } from './revision-responsiveness-observation-receipt-import.js';

export const REVISION_EVIDENCE_PACKAGE_RESPONSIVENESS_STATUS = 'VERIFIED_CURRENT_AT_EXPORT';

function currentAuthority(state) {
  return {
    session: state?.session,
    audit: state?.compare?.audit,
    revA: state?.slots?.baseline?.document,
    revB: state?.slots?.candidate?.document,
  };
}

function revisionMatches(receipt, document) {
  return Boolean(receipt && document
    && receipt.documentId === document.documentId
    && receipt.sourceHash === document.sourceHash
    && receipt.scopedHash === document.scopedHash
    && receipt.stagedSchema === document.stagedSchema
    && receipt.unit === document.unit
    && receipt.coordinateFrame === document.coordinateFrame
    && receipt.verticalAxis === document.verticalAxis);
}

function authorityMatches(receipt, session, audit, revA, revB) {
  return Boolean(receipt && session && audit
    && receipt.session?.sessionId === session.sessionId
    && receipt.session?.createdAt === session.createdAt
    && receipt.session?.updatedAt === session.updatedAt
    && receipt.audit?.auditId === audit.auditId
    && receipt.audit?.basisId === audit.basisId
    && receipt.audit?.engineVersion === audit.engineVersion
    && receipt.audit?.revADocumentId === audit.revADocumentId
    && receipt.audit?.revBDocumentId === audit.revBDocumentId
    && revisionMatches(receipt.revisions?.revA, revA)
    && revisionMatches(receipt.revisions?.revB, revB));
}

function requireV2Receipt(receipt) {
  if (receipt?.schema !== REVISION_RESPONSIVENESS_RECEIPT_V2_SCHEMA) {
    throw new TypeError('Evidence-package attachment requires a verified RevisionResponsivenessObservationReceipt.v2.');
  }
  if (!/^[a-f0-9]{64}$/.test(receipt.contentSha256 ?? '')) {
    throw new TypeError('Attached responsiveness receipt requires a full lowercase contentSha256.');
  }
  return receipt;
}

export function createRevisionEvidencePackageResponsivenessReceiptAttachment(value, state) {
  if (!value) return null;
  const receipt = requireV2Receipt(value.receipt);
  if (value.status !== 'VERIFIED_CURRENT' || value.runId !== receipt.observation?.runId) {
    throw new TypeError('Responsiveness receipt attachment must be verified for the current active run.');
  }
  const { session, audit, revA, revB } = currentAuthority(state);
  if (!authorityMatches(receipt, session, audit, revA, revB)) {
    throw new TypeError('Responsiveness receipt attachment does not match the evidence-package authority.');
  }
  return deepFreeze(receipt);
}

export function revisionEvidencePackageResponsivenessIdentity(receipt) {
  if (!receipt) return null;
  return deepFreeze({
    responsivenessReceiptId: receipt.receiptId,
    responsivenessReceiptContentSha256: receipt.contentSha256,
  });
}

export async function verifyRevisionEvidencePackageResponsivenessReceipt(receipt, session, audit, revA, revB, cryptoRef) {
  requireV2Receipt(receipt);
  const verification = await verifyRevisionResponsivenessObservationReceiptJson(JSON.stringify(receipt), cryptoRef);
  if (verification.contentSha256Status !== 'VERIFIED' || !authorityMatches(receipt, session, audit, revA, revB)) {
    throw new TypeError('Attached responsiveness receipt does not verify against the packaged authority.');
  }
  return deepFreeze({
    status: 'VERIFIED',
    receiptId: receipt.receiptId,
    contentSha256: receipt.contentSha256,
    integrityStatus: 'VERIFIED',
    authenticityStatus: 'NOT_ESTABLISHED',
    receipt: verification.receipt,
  });
}
