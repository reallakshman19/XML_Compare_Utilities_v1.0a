/** Deterministic, audit-bound browser responsiveness observation receipt. */
import {
  assertJsonSafe, cleanText, deepFreeze, stableStringify,
} from './revision-contract-utils.js';
import {
  REVISION_RESPONSIVENESS_RECEIPT_V1_SCHEMA,
  REVISION_RESPONSIVENESS_RECEIPT_V2_SCHEMA,
  createRevisionResponsivenessReceiptIntegrity,
} from './revision-responsiveness-receipt-integrity.js';

export const REVISION_RESPONSIVENESS_OBSERVATION_RECEIPT_V1_SCHEMA = REVISION_RESPONSIVENESS_RECEIPT_V1_SCHEMA;
export const REVISION_RESPONSIVENESS_OBSERVATION_RECEIPT_SCHEMA = REVISION_RESPONSIVENESS_RECEIPT_V2_SCHEMA;
const AUDIT_SCHEMA = 'RevisionCompareAudit.v1';
const COMPLETED_DISPOSITIONS = new Set(['QUALIFIED', 'NOT_QUALIFIED']);
const HASH_PATTERN = /^[a-f0-9]{64}$/;
export const REVISION_RESPONSIVENESS_OBSERVATION_AUTHORITY = deepFreeze({
  classification: 'PRODUCT_RUNTIME_OBSERVATION_ONLY',
  engineeringCertification: 'NONE',
  statement: 'This receipt records browser runtime observations and is not engineering acceptance, design validation, or certification.',
});
export const REVISION_RESPONSIVENESS_OBSERVATION_CAVEATS = deepFreeze([
  'Scene completion and first-ready values are sampled at the active product-policy resolution.',
  'Fit selected records synchronous command-dispatch time, not frame-paint completion.',
  'Browser heap telemetry is optional; unavailable values remain null and are not inferred.',
]);

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function required(value, label) {
  const text = cleanText(value);
  if (!text) throw new TypeError(`${label} is required.`);
  return text;
}

function revisionLineage(document, label) {
  const sourceHash = required(document?.sourceHash, `${label} sourceHash`).toLowerCase();
  const scopedHash = required(document?.scopedHash, `${label} scopedHash`).toLowerCase();
  if (!HASH_PATTERN.test(sourceHash) || !HASH_PATTERN.test(scopedHash)) {
    throw new TypeError(`${label} source and scoped hashes must be full lowercase SHA-256 values.`);
  }
  return deepFreeze({
    documentId: required(document?.documentId, `${label} documentId`),
    sourceHash,
    scopedHash,
    stagedSchema: required(document?.stagedSchema, `${label} stagedSchema`),
    unit: required(document?.unit, `${label} unit`),
    coordinateFrame: required(document?.coordinateFrame, `${label} coordinateFrame`),
    verticalAxis: required(document?.verticalAxis, `${label} verticalAxis`),
  });
}

function metric(value) {
  const result = {
    status: required(value?.status, 'Responsiveness metric status').toUpperCase(),
    value: numberOrNull(value?.value),
    limit: numberOrNull(value?.limit),
  };
  if (Object.hasOwn(value ?? {}, 'count')) result.count = Math.max(0, Math.trunc(Number(value.count) || 0));
  if (Object.hasOwn(value ?? {}, 'usedBytes')) result.usedBytes = numberOrNull(value.usedBytes);
  return deepFreeze(result);
}

function runSummary(value) {
  if (!value) return null;
  return deepFreeze({
    runId: required(value.runId, 'Comparison runId'),
    runSequence: Math.max(0, Math.trunc(Number(value.runSequence) || 0)),
    policyId: required(value.policyId, 'Comparison policyId'),
    bandId: required(value.bandId, 'Comparison bandId'),
    drawableCount: Math.max(0, Math.trunc(Number(value.drawableCount) || 0)),
    disposition: required(value.disposition, 'Comparison disposition').toUpperCase(),
    sceneMs: numberOrNull(value.sceneMs),
    firstReadyMs: numberOrNull(value.firstReadyMs),
    fitSelectedMs: numberOrNull(value.fitSelectedMs),
    heapGrowthBytes: numberOrNull(value.heapGrowthBytes),
  });
}

function comparison(value) {
  const deltas = value?.deltas ?? {};
  return deepFreeze({
    available: Boolean(value?.available),
    reason: required(value?.reason, 'Comparison reason'),
    previous: runSummary(value?.previous),
    current: runSummary(value?.current),
    deltas: {
      sceneMs: numberOrNull(deltas.sceneMs),
      firstReadyMs: numberOrNull(deltas.firstReadyMs),
      fitSelectedMs: numberOrNull(deltas.fitSelectedMs),
      heapGrowthBytes: numberOrNull(deltas.heapGrowthBytes),
    },
  });
}

function receiptContext(input) {
  const audit = input?.audit;
  const scene = input?.sceneEvidence;
  const model = scene?.responsiveness;
  const revA = revisionLineage(input?.revA, 'Rev A');
  const revB = revisionLineage(input?.revB, 'Rev B');
  if (audit?.schema !== AUDIT_SCHEMA || audit?.validation?.status !== 'READY') {
    throw new Error('A validated RevisionCompareAudit.v1 is required.');
  }
  if (audit.revADocumentId !== revA.documentId || audit.revBDocumentId !== revB.documentId) {
    throw new Error('Receipt revision documents do not match the current audit.');
  }
  if (!model || !COMPLETED_DISPOSITIONS.has(model.disposition)) {
    throw new Error('Complete the current responsiveness disposition before downloading a receipt.');
  }
  const runKey = `${required(audit.auditId, 'auditId')}|WEBGL`;
  if (scene.runKey !== runKey || model.runKey !== runKey || scene.runId !== model.runId) {
    throw new Error('Responsiveness run identity does not match the current audit and WebGL backend.');
  }
  const runSequence = Math.max(0, Math.trunc(Number(model.runSequence) || 0));
  if (!runSequence || scene.runSequence !== runSequence || model.runId !== `${runKey}|run:${runSequence}`) {
    throw new Error('Responsiveness run sequence is invalid.');
  }
  return { audit, scene, model, revA, revB };
}

function sessionIdentity(session) {
  return deepFreeze({
    sessionId: required(session?.sessionId, 'sessionId'),
    createdAt: required(session?.createdAt, 'session createdAt'),
    updatedAt: required(session?.updatedAt, 'session updatedAt'),
  });
}

function auditIdentity(audit) {
  return deepFreeze({
    auditId: audit.auditId,
    basisId: required(audit.basisId, 'basisId'),
    engineVersion: required(audit.engineVersion, 'engineVersion'),
    revADocumentId: audit.revADocumentId,
    revBDocumentId: audit.revBDocumentId,
  });
}

function observationIdentity(scene, model) {
  return deepFreeze({
    backend: 'WEBGL',
    runKey: model.runKey,
    runId: model.runId,
    runSequence: model.runSequence,
    policyId: required(model.policyId, 'policyId'),
    bandId: required(model.bandId, 'bandId'),
    drawableCount: Math.max(0, Math.trunc(Number(model.drawableCount) || 0)),
    sceneStatus: required(model.sceneStatus, 'sceneStatus'),
    disposition: model.disposition,
    elapsedMs: numberOrNull(scene.elapsedMs),
    sampleCount: Math.max(0, Math.trunc(Number(scene.runSampleCount) || 0)),
    metrics: {
      scene: metric(model.metrics?.scene),
      firstReady: metric(model.metrics?.firstReady),
      fitSelected: metric(model.metrics?.fitSelected),
      memory: metric(model.metrics?.memory),
    },
    comparison: comparison(model.comparison),
  });
}

function receiptIdentity(input) {
  const { audit, scene, model, revA, revB } = receiptContext(input);
  return deepFreeze({
    schema: REVISION_RESPONSIVENESS_OBSERVATION_RECEIPT_SCHEMA,
    authority: REVISION_RESPONSIVENESS_OBSERVATION_AUTHORITY,
    session: sessionIdentity(input?.session),
    audit: auditIdentity(audit),
    revisions: { revA, revB },
    observation: observationIdentity(scene, model),
    caveats: REVISION_RESPONSIVENESS_OBSERVATION_CAVEATS,
  });
}

export async function createRevisionResponsivenessObservationReceipt(input, cryptoRef) {
  const identity = receiptIdentity(input);
  const receipt = deepFreeze({
    ...identity,
    ...await createRevisionResponsivenessReceiptIntegrity(identity, cryptoRef),
  });
  assertJsonSafe(receipt, REVISION_RESPONSIVENESS_OBSERVATION_RECEIPT_SCHEMA);
  return receipt;
}

export function revisionResponsivenessObservationReceiptMatches(receipt, input) {
  try {
    const { receiptId: _receiptId, contentSha256: _contentSha256, ...identity } = receipt;
    return receipt.schema === REVISION_RESPONSIVENESS_OBSERVATION_RECEIPT_SCHEMA
      && stableStringify(identity) === stableStringify(receiptIdentity(input));
  } catch {
    return false;
  }
}

export function revisionResponsivenessObservationReceiptFileName(receipt) {
  const audit = cleanText(receipt?.audit?.auditId).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
  const run = Math.max(0, Math.trunc(Number(receipt?.observation?.runSequence) || 0));
  if (!audit || !run) throw new TypeError('A valid responsiveness observation receipt is required.');
  return `revision-responsiveness-${audit}-run-${run}.json`;
}
