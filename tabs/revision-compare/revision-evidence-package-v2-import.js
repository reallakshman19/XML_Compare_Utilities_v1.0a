/** Verification adapter for RevisionCompareEvidencePackage.v2 attachments. */
import { deepFreeze } from './revision-contract-utils.js';
import {
  REVISION_COMPARE_EVIDENCE_PACKAGE_FIELDS,
  REVISION_COMPARE_EVIDENCE_PACKAGE_ID_PREFIX,
  REVISION_COMPARE_EVIDENCE_PACKAGE_V1_SCHEMA,
  REVISION_COMPARE_EVIDENCE_PACKAGE_V2_SCHEMA,
  canonicalRevisionCompareEvidenceValue,
  revisionCompareEvidencePackageHashMaterial,
} from './revision-evidence-package.js';
import {
  REVISION_EVIDENCE_PACKAGE_RESPONSIVENESS_STATUS,
  verifyRevisionEvidencePackageResponsivenessReceipt,
} from './revision-evidence-package-responsiveness-receipt.js';
import { sha256Text } from './revision-hash.js';

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const PAYLOAD_FIELDS = Object.freeze(['sessionManifest', 'scopeBasisManifest', 'audit', 'reviewSession', 'decisionLedger', 'responsivenessReceipt']);
const IDENTITY_FIELDS = Object.freeze(['sessionId', 'basisId', 'auditId', 'reviewSessionId', 'decisionLedgerId', 'revADocumentId', 'revBDocumentId', 'engineVersion', 'responsivenessReceiptId', 'responsivenessReceiptContentSha256']);
const STATUS_FIELDS = Object.freeze(['basisStatus', 'auditValidationStatus', 'reviewStatus', 'decisionStatus', 'responsivenessReceiptStatus']);

function plainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function exactKeys(value, allowed, label) {
  if (!plainObject(value)) throw new TypeError(`${label} must be a plain JSON object.`);
  const actual = Object.keys(value).sort(); const expected = [...allowed].sort();
  if (actual.join('|') !== expected.join('|')) throw new TypeError(`${label} contains unsupported or missing fields.`);
}
function sameJson(left, right) {
  return JSON.stringify(canonicalRevisionCompareEvidenceValue(left, 'left'))
    === JSON.stringify(canonicalRevisionCompareEvidenceValue(right, 'right'));
}

async function verifyEnvelope(parsed, cryptoRef) {
  exactKeys(parsed, REVISION_COMPARE_EVIDENCE_PACKAGE_FIELDS, 'Evidence package');
  if (parsed.schema !== REVISION_COMPARE_EVIDENCE_PACKAGE_V2_SCHEMA) throw new TypeError(`Evidence package schema must be ${REVISION_COMPARE_EVIDENCE_PACKAGE_V2_SCHEMA}.`);
  if (!Object.hasOwn(parsed.payload ?? {}, 'responsivenessReceipt')) {
    throw new TypeError(`Evidence package schema must be ${REVISION_COMPARE_EVIDENCE_PACKAGE_V1_SCHEMA} unless a responsivenessReceipt attachment is present.`);
  }
  exactKeys(parsed.payload, PAYLOAD_FIELDS, 'Evidence package payload');
  exactKeys(parsed.validation, ['status', 'errors'], 'Package validation');
  if (parsed.validation.status !== 'READY' || !Array.isArray(parsed.validation.errors) || parsed.validation.errors.length) throw new TypeError('Package validation must be READY.');
  if (!HASH_PATTERN.test(parsed.contentSha256 ?? '')) throw new TypeError('contentSha256 must be a lowercase 64-character SHA-256.');
  if (parsed.packageId !== `${REVISION_COMPARE_EVIDENCE_PACKAGE_ID_PREFIX}${parsed.contentSha256}`) throw new TypeError('packageId does not match contentSha256.');
  const frozen = deepFreeze(canonicalRevisionCompareEvidenceValue(parsed, REVISION_COMPARE_EVIDENCE_PACKAGE_V2_SCHEMA));
  if (await sha256Text(JSON.stringify(revisionCompareEvidencePackageHashMaterial(frozen)), cryptoRef) !== frozen.contentSha256) {
    throw new TypeError('Evidence package canonical SHA-256 does not match contentSha256.');
  }
  return frozen;
}

async function v1Projection(value, cryptoRef) {
  const { responsivenessReceipt: _receipt, ...payload } = value.payload;
  const { responsivenessReceiptId: _id, responsivenessReceiptContentSha256: _hash, ...identity } = value.identity;
  const { responsivenessReceiptStatus: _status, ...authorityStatus } = value.authorityStatus;
  const material = revisionCompareEvidencePackageHashMaterial({
    schema: REVISION_COMPARE_EVIDENCE_PACKAGE_V1_SCHEMA, identity, authorityStatus, payload, validation: value.validation,
  });
  const contentSha256 = await sha256Text(JSON.stringify(material), cryptoRef);
  return canonicalRevisionCompareEvidenceValue({
    ...material, packageId: `${REVISION_COMPARE_EVIDENCE_PACKAGE_ID_PREFIX}${contentSha256}`, contentSha256,
  }, REVISION_COMPARE_EVIDENCE_PACKAGE_V1_SCHEMA);
}

function verifyBinding(value, verified, attachment) {
  exactKeys(value.identity, IDENTITY_FIELDS, 'Package identity'); exactKeys(value.authorityStatus, STATUS_FIELDS, 'Package authorityStatus');
  const expectedIdentity = {
    sessionId: verified.session.sessionId, basisId: verified.basis.basisId, auditId: verified.audit.auditId,
    reviewSessionId: value.payload.reviewSession.reviewSessionId, decisionLedgerId: value.payload.decisionLedger.ledgerId,
    revADocumentId: verified.audit.revADocumentId, revBDocumentId: verified.audit.revBDocumentId, engineVersion: verified.audit.engineVersion,
    responsivenessReceiptId: attachment.receiptId, responsivenessReceiptContentSha256: attachment.contentSha256,
  };
  if (!sameJson(value.identity, expectedIdentity)) throw new TypeError('Package identity does not equal its nested authority and responsiveness identities.');
  const expectedStatus = {
    basisStatus: 'CURRENT', auditValidationStatus: 'READY', reviewStatus: value.payload.reviewSession.status,
    decisionStatus: value.payload.decisionLedger.status,
    responsivenessReceiptStatus: REVISION_EVIDENCE_PACKAGE_RESPONSIVENESS_STATUS,
  };
  if (!sameJson(value.authorityStatus, expectedStatus)) throw new TypeError('Package authorityStatus does not equal its nested authority and responsiveness statuses.');
}

export async function verifyRevisionCompareEvidencePackageV2(parsed, fileName, importedAt, cryptoRef, verifyV1Json) {
  const frozen = await verifyEnvelope(parsed, cryptoRef);
  const projection = await v1Projection(frozen, cryptoRef);
  const verified = await verifyV1Json(JSON.stringify(projection), fileName, importedAt, cryptoRef);
  const attachment = await verifyRevisionEvidencePackageResponsivenessReceipt(
    frozen.payload.responsivenessReceipt, verified.session, verified.audit,
    verified.slots.baseline.document, verified.slots.candidate.document, cryptoRef,
  );
  verifyBinding(frozen, verified, attachment);
  return deepFreeze({
    ...verified,
    responsivenessReceiptVerification: attachment,
    receipt: {
      ...verified.receipt, packageId: frozen.packageId, contentSha256: frozen.contentSha256,
      responsivenessReceiptAttached: true, responsivenessReceiptId: attachment.receiptId,
      responsivenessReceiptContentSha256: attachment.contentSha256,
      responsivenessReceiptIntegrityStatus: attachment.integrityStatus,
    },
  });
}
