/** Deterministic binding of existing Revision Compare authorities and optional runtime evidence. */
import { assertJsonSafe, deepFreeze } from './revision-contract-utils.js';
import {
  REVISION_SCOPE_MANIFEST_SCHEMA,
  REVISION_SESSION_MANIFEST_SCHEMA,
  createRevisionScopeManifest,
  createRevisionSessionManifest,
} from './revision-manifests.js';
import { createReviewSessionExport } from './revision-review-manifest.js';
import { REVIEW_SESSION_SCHEMA } from './revision-review-contracts.js';
import { reviewSessionMatchesAudit } from './revision-review-session.js';
import { createDecisionLedgerExport } from './revision-decision-manifest.js';
import { DECISION_LEDGER_SCHEMA } from './revision-decision-contracts.js';
import { decisionLedgerMatchesAudit } from './revision-decision-ledger.js';
import { sha256Text } from './revision-hash.js';
import {
  REVISION_EVIDENCE_PACKAGE_RESPONSIVENESS_STATUS,
  createRevisionEvidencePackageResponsivenessReceiptAttachment,
  revisionEvidencePackageResponsivenessIdentity,
  verifyRevisionEvidencePackageResponsivenessReceipt,
} from './revision-evidence-package-responsiveness-receipt.js';

export const REVISION_COMPARE_EVIDENCE_PACKAGE_V1_SCHEMA = 'RevisionCompareEvidencePackage.v1';
export const REVISION_COMPARE_EVIDENCE_PACKAGE_V2_SCHEMA = 'RevisionCompareEvidencePackage.v2';
export const REVISION_COMPARE_EVIDENCE_PACKAGE_SCHEMA = REVISION_COMPARE_EVIDENCE_PACKAGE_V1_SCHEMA;
export const REVISION_COMPARE_EVIDENCE_PACKAGE_ID_PREFIX = 'revision-evidence-package:';
export const REVISION_COMPARE_EVIDENCE_PACKAGE_FIELDS = Object.freeze([
  'schema', 'packageId', 'contentSha256', 'identity', 'authorityStatus', 'payload', 'validation',
]);

export function canonicalRevisionCompareEvidenceValue(value, path = 'value') {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`${path} must contain only finite JSON numbers.`);
    return value;
  }
  if (Array.isArray(value)) return value.map((item, index) => canonicalRevisionCompareEvidenceValue(item, `${path}[${index}]`));
  if (!value || typeof value !== 'object') throw new TypeError(`${path} is not JSON-safe.`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new TypeError(`${path} must be a plain object.`);
  const output = {};
  for (const key of Object.keys(value).sort()) output[key] = canonicalRevisionCompareEvidenceValue(value[key], `${path}.${key}`);
  return output;
}

export function revisionCompareEvidencePackageHashMaterial(value) {
  return deepFreeze(canonicalRevisionCompareEvidenceValue({
    schema: value?.schema,
    identity: value?.identity,
    authorityStatus: value?.authorityStatus,
    payload: value?.payload,
    validation: value?.validation,
  }, 'hashMaterial'));
}

function readinessErrors(state) {
  const errors = [];
  const sessionId = state?.session?.sessionId;
  const basis = state?.basis;
  const audit = state?.compare?.audit;
  const review = state?.review?.session;
  const decision = state?.decision?.ledger;
  if (state?.basisStatus !== 'CURRENT') errors.push('Evidence package requires a current comparison basis.');
  if (!basis) errors.push('Evidence package requires an approved comparison basis.');
  if (!sessionId || !state?.proposal) errors.push('Evidence package requires the current revision session and scope proposal.');
  if (!state?.slots?.baseline || !state?.slots?.candidate) errors.push('Evidence package requires both current revision intake records.');
  if (basis && sessionId && basis.sessionId !== sessionId) errors.push('The comparison basis does not belong to the current revision session.');
  if (!audit || audit.schema !== 'RevisionCompareAudit.v1' || audit.validation?.status !== 'READY') {
    errors.push('Evidence package requires a READY RevisionCompareAudit.v1.');
  }
  if (basis && audit && audit.basisId !== basis.basisId) errors.push('The audit basis identity does not match the current basis.');
  if (basis && audit && (audit.revADocumentId !== basis.revADocumentId || audit.revBDocumentId !== basis.revBDocumentId)) {
    errors.push('The audit revision document identities do not match the current basis.');
  }
  if (!review || review.schema !== REVIEW_SESSION_SCHEMA || !reviewSessionMatchesAudit(review, audit)) {
    errors.push('Evidence package requires a review session matching the current audit.');
  } else if (review.validation?.status !== 'READY') errors.push('The review session is not export-ready.');
  if (!decision || decision.schema !== DECISION_LEDGER_SCHEMA || !decisionLedgerMatchesAudit(decision, audit)) {
    errors.push('Evidence package requires a decision ledger matching the current audit.');
  } else if (decision.validation?.status !== 'READY') errors.push('The decision ledger is not export-ready.');
  return errors;
}

export function revisionCompareEvidencePackageReadiness(state) {
  const blockers = Object.freeze(readinessErrors(state));
  return deepFreeze({ status: blockers.length ? 'BLOCKED' : 'READY', blockers });
}

function manifestErrors(state, sessionManifest, scopeBasisManifest) {
  const errors = [];
  if (sessionManifest.schema !== REVISION_SESSION_MANIFEST_SCHEMA) errors.push('Session manifest schema is invalid.');
  if (scopeBasisManifest.schema !== REVISION_SCOPE_MANIFEST_SCHEMA) errors.push('Scope/basis manifest schema is invalid.');
  if (sessionManifest.session?.sessionId !== state.session.sessionId
      || scopeBasisManifest.sessionId !== state.session.sessionId
      || state.basis?.sessionId !== state.session.sessionId) {
    errors.push('Session and scope manifests do not share the current revision session identity.');
  }
  if (sessionManifest.basisStatus !== 'CURRENT' || scopeBasisManifest.basisStatus !== 'CURRENT'
      || sessionManifest.basisId !== state.basis?.basisId
      || scopeBasisManifest.basis?.basisId !== state.basis?.basisId) {
    errors.push('Session and scope manifests do not share the current basis authority.');
  }
  return errors;
}

function exactPayload(state, preflight, responsivenessReceipt) {
  const sessionManifest = createRevisionSessionManifest(state, preflight);
  const scopeBasisManifest = createRevisionScopeManifest(state, preflight);
  const errors = manifestErrors(state, sessionManifest, scopeBasisManifest);
  if (errors.length) throw new TypeError(`Evidence package manifest mismatch: ${errors.join(' ')}`);
  return deepFreeze(canonicalRevisionCompareEvidenceValue({
    sessionManifest,
    scopeBasisManifest,
    audit: state.compare.audit,
    reviewSession: createReviewSessionExport(state.review.session),
    decisionLedger: createDecisionLedgerExport(state.decision.ledger),
    ...(responsivenessReceipt ? { responsivenessReceipt } : {}),
  }, 'payload'));
}

function packageIdentity(state, payload) {
  const audit = payload.audit;
  return {
    sessionId: state.session.sessionId,
    basisId: audit.basisId,
    auditId: audit.auditId,
    reviewSessionId: payload.reviewSession.reviewSessionId,
    decisionLedgerId: payload.decisionLedger.ledgerId,
    revADocumentId: audit.revADocumentId,
    revBDocumentId: audit.revBDocumentId,
    engineVersion: audit.engineVersion,
    ...(revisionEvidencePackageResponsivenessIdentity(payload.responsivenessReceipt) ?? {}),
  };
}

function hashMaterial(state, payload) {
  const attached = Boolean(payload.responsivenessReceipt);
  return revisionCompareEvidencePackageHashMaterial({
    schema: attached ? REVISION_COMPARE_EVIDENCE_PACKAGE_V2_SCHEMA : REVISION_COMPARE_EVIDENCE_PACKAGE_V1_SCHEMA,
    identity: packageIdentity(state, payload),
    authorityStatus: {
      basisStatus: state.basisStatus,
      auditValidationStatus: payload.audit.validation.status,
      reviewStatus: payload.reviewSession.status,
      decisionStatus: payload.decisionLedger.status,
      ...(attached ? { responsivenessReceiptStatus: REVISION_EVIDENCE_PACKAGE_RESPONSIVENESS_STATUS } : {}),
    },
    payload,
    validation: { status: 'READY', errors: [] },
  });
}

async function verifiedResponsivenessReceipt(state, attachment, cryptoRef) {
  const receipt = createRevisionEvidencePackageResponsivenessReceiptAttachment(attachment, state);
  if (!receipt) return null;
  const verified = await verifyRevisionEvidencePackageResponsivenessReceipt(
    receipt, state.session, state.compare.audit,
    state.slots.baseline.document, state.slots.candidate.document, cryptoRef,
  );
  return verified.receipt;
}

export async function createRevisionCompareEvidencePackage(state, preflight, cryptoRef, responsivenessAttachment = null) {
  const readiness = revisionCompareEvidencePackageReadiness(state);
  if (readiness.status !== 'READY') throw new Error(readiness.blockers[0]);
  const receipt = await verifiedResponsivenessReceipt(state, responsivenessAttachment, cryptoRef);
  const material = hashMaterial(state, exactPayload(state, preflight, receipt));
  const contentSha256 = await sha256Text(JSON.stringify(material), cryptoRef);
  const artifact = deepFreeze(canonicalRevisionCompareEvidenceValue({
    ...material,
    packageId: `${REVISION_COMPARE_EVIDENCE_PACKAGE_ID_PREFIX}${contentSha256}`,
    contentSha256,
  }, material.schema));
  assertJsonSafe(artifact, material.schema);
  return artifact;
}

export function serializeRevisionCompareEvidencePackage(artifact) {
  const schemas = [REVISION_COMPARE_EVIDENCE_PACKAGE_V1_SCHEMA, REVISION_COMPARE_EVIDENCE_PACKAGE_V2_SCHEMA];
  if (!schemas.includes(artifact?.schema)) throw new TypeError(`A ${schemas.join(' or ')} artifact is required.`);
  const canonical = canonicalRevisionCompareEvidenceValue(artifact, artifact.schema);
  assertJsonSafe(canonical, artifact.schema);
  return `${JSON.stringify(canonical, null, 2)}\n`;
}

export function revisionCompareEvidencePackageFileName(sessionId) {
  const value = String(sessionId ?? '').trim();
  if (!value) throw new TypeError('Revision session ID is required for the evidence package filename.');
  return `${value.replace(/[^A-Za-z0-9._-]/g, '_')}.evidence-package.json`;
}

export const _test = Object.freeze({
  canonicalPlain: canonicalRevisionCompareEvidenceValue,
  hashMaterial,
  manifestErrors,
  readinessErrors,
});
