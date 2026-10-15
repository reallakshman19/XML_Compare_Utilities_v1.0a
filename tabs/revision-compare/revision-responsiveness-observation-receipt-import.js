/** Strict local integrity verification for responsiveness observation receipts. */
import {
  assertJsonSafe, deepFreeze, stableStringify,
} from './revision-contract-utils.js';
import {
  REVISION_RESPONSIVENESS_RECEIPT_V1_SCHEMA,
  REVISION_RESPONSIVENESS_RECEIPT_V2_SCHEMA,
  verifyRevisionResponsivenessReceiptIntegrity,
} from './revision-responsiveness-receipt-integrity.js';
import {
  REVISION_RESPONSIVENESS_OBSERVATION_AUTHORITY,
  REVISION_RESPONSIVENESS_OBSERVATION_CAVEATS,
} from './revision-responsiveness-observation-receipt.js';

export const REVISION_RESPONSIVENESS_RECEIPT_VERIFICATION_SCHEMA = 'RevisionResponsivenessReceiptVerification.v1';
export const REVISION_RESPONSIVENESS_RECEIPT_VERIFICATION_STATE_SCHEMA = 'RevisionResponsivenessReceiptVerificationState.v1';
export const REVISION_RESPONSIVENESS_RECEIPT_MAX_BYTES = 256 * 1024;
export const REVISION_RESPONSIVENESS_RECEIPT_VERIFICATION_STATUS = Object.freeze({
  IDLE: 'IDLE', IMPORTING: 'IMPORTING', VERIFIED: 'VERIFIED', FAILED: 'FAILED',
});

const ROOT_V1 = ['schema', 'authority', 'session', 'audit', 'revisions', 'observation', 'caveats', 'receiptId'];
const ROOT_V2 = [...ROOT_V1, 'contentSha256'];
const AUTHORITY = ['classification', 'engineeringCertification', 'statement'];
const SESSION = ['sessionId', 'createdAt', 'updatedAt'];
const AUDIT = ['auditId', 'basisId', 'engineVersion', 'revADocumentId', 'revBDocumentId'];
const REVISIONS = ['revA', 'revB'];
const REVISION = ['documentId', 'sourceHash', 'scopedHash', 'stagedSchema', 'unit', 'coordinateFrame', 'verticalAxis'];
const OBSERVATION = ['backend', 'runKey', 'runId', 'runSequence', 'policyId', 'bandId', 'drawableCount', 'sceneStatus', 'disposition', 'elapsedMs', 'sampleCount', 'metrics', 'comparison'];
const METRICS = ['scene', 'firstReady', 'fitSelected', 'memory'];
const BASIC_METRIC = ['status', 'value', 'limit'];
const FIT_METRIC = ['status', 'value', 'limit', 'count'];
const MEMORY_METRIC = ['status', 'value', 'limit', 'usedBytes'];
const COMPARISON = ['available', 'reason', 'previous', 'current', 'deltas'];
const RUN = ['runId', 'runSequence', 'policyId', 'bandId', 'drawableCount', 'disposition', 'sceneMs', 'firstReadyMs', 'fitSelectedMs', 'heapGrowthBytes'];
const DELTAS = ['sceneMs', 'firstReadyMs', 'fitSelectedMs', 'heapGrowthBytes'];
const SHA256 = /^[a-f0-9]{64}$/;
const RECEIPT_ID = /^responsiveness-observation:[a-f0-9]{24}$/;
const COMPLETED = new Set(['QUALIFIED', 'NOT_QUALIFIED']);
const METRIC_STATUS = new Set(['PASS', 'FAIL', 'UNAVAILABLE']);

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
  if (Array.isArray(value)) { value.forEach((item, index) => assertPlainJson(item, `${label}[${index}]`, seen)); return; }
  if (!value || typeof value !== 'object') throw new TypeError(`${label} is not JSON-safe.`);
  if (seen.has(value)) throw new TypeError(`${label} must not contain cycles.`); seen.add(value);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new TypeError(`${label} must contain plain objects only.`);
  Object.entries(value).forEach(([key, item]) => assertPlainJson(item, `${label}.${key}`, seen)); seen.delete(value);
}

function assertNoDuplicateJsonKeys(text) {
  let index = 0;
  const invalid = () => { throw new TypeError('Responsiveness receipt JSON is invalid.'); };
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
    if (token === '[') return arrayValue();
    if (token === '{') return objectValue();
    const start = index; while (index < text.length && !/[\s,\]}]/u.test(text[index])) index += 1;
    if (start === index) return invalid(); JSON.parse(text.slice(start, index));
  };
  const arrayValue = () => {
    index += 1; skip(); if (text[index] === ']') { index += 1; return; }
    while (true) { value(); skip(); if (text[index] === ']') { index += 1; return; } if (text[index] !== ',') return invalid(); index += 1; }
  };
  const objectValue = () => {
    index += 1; const keys = new Set(); skip(); if (text[index] === '}') { index += 1; return; }
    while (true) {
      skip(); if (text[index] !== '"') return invalid(); const key = stringValue();
      if (keys.has(key)) throw new TypeError(`Responsiveness receipt contains duplicate field "${key}".`); keys.add(key);
      skip(); if (text[index] !== ':') return invalid(); index += 1; value(); skip();
      if (text[index] === '}') { index += 1; return; } if (text[index] !== ',') return invalid(); index += 1;
    }
  };
  value(); skip(); if (index !== text.length) invalid();
}

function text(value, label, maximum = 512) {
  if (typeof value !== 'string' || !value || value !== value.trim()) throw new TypeError(`${label} must be a trimmed non-empty string.`);
  if (value.length > maximum) throw new RangeError(`${label} is limited to ${maximum} characters.`);
  return value;
}

function exactIso(value, label) {
  text(value, label, 64); const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) throw new TypeError(`${label} must be an exact ISO timestamp.`);
  return value;
}

function integer(value, label, positive = false) {
  if (!Number.isInteger(value) || value < (positive ? 1 : 0)) throw new TypeError(`${label} must be ${positive ? 'positive' : 'non-negative'} integer.`);
  return value;
}

function numberOrNull(value, label, allowNegative = false) {
  if (value === null) return null;
  if (!Number.isFinite(value) || (!allowNegative && value < 0)) throw new TypeError(`${label} must be ${allowNegative ? 'finite' : 'non-negative'} or null.`);
  return value;
}

function validateRevision(value, label) {
  exactObject(value, REVISION, label);
  for (const key of ['documentId', 'stagedSchema', 'unit', 'coordinateFrame', 'verticalAxis']) text(value[key], `${label}.${key}`);
  for (const key of ['sourceHash', 'scopedHash']) if (!SHA256.test(value[key])) throw new TypeError(`${label}.${key} must be lowercase SHA-256.`);
}

function validateMetric(value, fields, label) {
  exactObject(value, fields, label);
  if (!METRIC_STATUS.has(value.status)) throw new TypeError(`${label}.status is invalid.`);
  numberOrNull(value.value, `${label}.value`); numberOrNull(value.limit, `${label}.limit`);
  if (value.limit == null || value.limit <= 0) throw new TypeError(`${label}.limit must be positive.`);
  if (Object.hasOwn(value, 'count')) integer(value.count, `${label}.count`, true);
  if (Object.hasOwn(value, 'usedBytes')) numberOrNull(value.usedBytes, `${label}.usedBytes`);
}

function validateRun(value, label) {
  if (value === null) return;
  exactObject(value, RUN, label);
  text(value.runId, `${label}.runId`); integer(value.runSequence, `${label}.runSequence`, true);
  for (const key of ['policyId', 'bandId']) text(value[key], `${label}.${key}`);
  integer(value.drawableCount, `${label}.drawableCount`, true);
  if (!COMPLETED.has(value.disposition)) throw new TypeError(`${label}.disposition is invalid.`);
  for (const key of ['sceneMs', 'firstReadyMs', 'fitSelectedMs', 'heapGrowthBytes']) numberOrNull(value[key], `${label}.${key}`);
}

function validateComparison(value, observation) {
  exactObject(value, COMPARISON, 'observation.comparison');
  if (typeof value.available !== 'boolean') throw new TypeError('observation.comparison.available must be boolean.');
  text(value.reason, 'observation.comparison.reason'); validateRun(value.previous, 'observation.comparison.previous'); validateRun(value.current, 'observation.comparison.current');
  exactObject(value.deltas, DELTAS, 'observation.comparison.deltas');
  for (const key of DELTAS) numberOrNull(value.deltas[key], `observation.comparison.deltas.${key}`, true);
  if (!value.current || value.current.runId !== observation.runId || value.current.runSequence !== observation.runSequence) throw new TypeError('Comparison current run must match the receipt observation.');
  if (value.available && (!value.previous || value.previous.runSequence >= value.current.runSequence)) throw new TypeError('Available comparison requires an older previous run.');
}

function validateObservation(value) {
  exactObject(value, OBSERVATION, 'observation');
  if (value.backend !== 'WEBGL') throw new TypeError('observation.backend must be WEBGL.');
  text(value.runKey, 'observation.runKey'); text(value.runId, 'observation.runId');
  integer(value.runSequence, 'observation.runSequence', true);
  if (value.runId !== `${value.runKey}|run:${value.runSequence}`) throw new TypeError('observation.runId does not match runKey and runSequence.');
  for (const key of ['policyId', 'bandId', 'sceneStatus']) text(value[key], `observation.${key}`);
  integer(value.drawableCount, 'observation.drawableCount', true); integer(value.sampleCount, 'observation.sampleCount');
  numberOrNull(value.elapsedMs, 'observation.elapsedMs');
  if (!COMPLETED.has(value.disposition)) throw new TypeError('observation.disposition must be completed.');
  exactObject(value.metrics, METRICS, 'observation.metrics');
  validateMetric(value.metrics.scene, BASIC_METRIC, 'observation.metrics.scene');
  validateMetric(value.metrics.firstReady, BASIC_METRIC, 'observation.metrics.firstReady');
  validateMetric(value.metrics.fitSelected, FIT_METRIC, 'observation.metrics.fitSelected');
  validateMetric(value.metrics.memory, MEMORY_METRIC, 'observation.metrics.memory');
  validateComparison(value.comparison, value);
}

function validateReceipt(input) {
  assertPlainJson(input, 'receipt');
  const schemas = [REVISION_RESPONSIVENESS_RECEIPT_V1_SCHEMA, REVISION_RESPONSIVENESS_RECEIPT_V2_SCHEMA];
  if (!schemas.includes(input?.schema)) throw new TypeError(`Receipt schema must be ${schemas.join(' or ')}.`);
  exactObject(input, input.schema === REVISION_RESPONSIVENESS_RECEIPT_V2_SCHEMA ? ROOT_V2 : ROOT_V1, 'receipt');
  if (!RECEIPT_ID.test(input.receiptId)) throw new TypeError('receiptId is invalid.');
  if (input.schema === REVISION_RESPONSIVENESS_RECEIPT_V2_SCHEMA && !SHA256.test(input.contentSha256)) throw new TypeError('contentSha256 must be lowercase SHA-256.');
  exactObject(input.authority, AUTHORITY, 'authority');
  if (stableStringify(input.authority) !== stableStringify(REVISION_RESPONSIVENESS_OBSERVATION_AUTHORITY)) throw new TypeError('Receipt authority boundary is invalid.');
  exactObject(input.session, SESSION, 'session'); text(input.session.sessionId, 'session.sessionId'); exactIso(input.session.createdAt, 'session.createdAt'); exactIso(input.session.updatedAt, 'session.updatedAt');
  exactObject(input.audit, AUDIT, 'audit'); for (const key of AUDIT) text(input.audit[key], `audit.${key}`);
  exactObject(input.revisions, REVISIONS, 'revisions'); validateRevision(input.revisions.revA, 'revisions.revA'); validateRevision(input.revisions.revB, 'revisions.revB');
  validateObservation(input.observation);
  if (stableStringify(input.caveats) !== stableStringify(REVISION_RESPONSIVENESS_OBSERVATION_CAVEATS)) throw new TypeError('Receipt caveats are invalid.');
  return deepFreeze(JSON.parse(stableStringify(input)));
}

function authorityRelation(receipt, currentInput) {
  const audit = currentInput?.audit; const revA = currentInput?.revA; const revB = currentInput?.revB;
  if (!audit || !revA || !revB) return 'UNAVAILABLE';
  const matches = receipt.audit.auditId === audit.auditId && receipt.audit.basisId === audit.basisId
    && receipt.revisions.revA.documentId === revA.documentId && receipt.revisions.revA.sourceHash === revA.sourceHash
    && receipt.revisions.revA.scopedHash === revA.scopedHash && receipt.revisions.revB.documentId === revB.documentId
    && receipt.revisions.revB.sourceHash === revB.sourceHash && receipt.revisions.revB.scopedHash === revB.scopedHash;
  return matches ? 'MATCH' : 'DIFFERENT';
}

function runRelation(receipt, currentInput, authorityStatus) {
  if (authorityStatus !== 'MATCH') return authorityStatus === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'DIFFERENT';
  const current = currentInput?.sceneEvidence?.responsiveness;
  if (!current?.runId) return 'UNAVAILABLE';
  return current.runId === receipt.observation.runId ? 'MATCH' : 'HISTORICAL';
}

export function createRevisionResponsivenessReceiptVerificationState() {
  return deepFreeze({ schema: REVISION_RESPONSIVENESS_RECEIPT_VERIFICATION_STATE_SCHEMA, status: 'IDLE', generation: 0, fileName: '', verification: null, error: null });
}

export function startRevisionResponsivenessReceiptVerification(state, generation, fileName) {
  return deepFreeze({ ...createRevisionResponsivenessReceiptVerificationState(), status: 'IMPORTING', generation, fileName: String(fileName ?? '') });
}

export function completeRevisionResponsivenessReceiptVerification(state, generation, verification) {
  if (state.generation !== generation || state.status !== 'IMPORTING') return state;
  return deepFreeze({ ...state, status: 'VERIFIED', verification, error: null });
}

export function failRevisionResponsivenessReceiptVerification(state, generation, error) {
  if (state.generation !== generation || state.status !== 'IMPORTING') return state;
  return deepFreeze({ ...state, status: 'FAILED', verification: null, error: error?.message || String(error) });
}

export async function verifyRevisionResponsivenessObservationReceiptJson(textValue, cryptoRef) {
  const textSource = String(textValue ?? '');
  if (new TextEncoder().encode(textSource).byteLength > REVISION_RESPONSIVENESS_RECEIPT_MAX_BYTES) throw new RangeError('Responsiveness receipt is limited to 256 KiB.');
  assertNoDuplicateJsonKeys(textSource);
  let parsed; try { parsed = JSON.parse(textSource); } catch { throw new TypeError('Responsiveness receipt JSON is invalid.'); }
  const receipt = validateReceipt(parsed);
  const integrity = await verifyRevisionResponsivenessReceiptIntegrity(receipt, cryptoRef);
  const verification = deepFreeze({
    schema: REVISION_RESPONSIVENESS_RECEIPT_VERIFICATION_SCHEMA,
    structureStatus: 'VERIFIED', receiptIdStatus: integrity.receiptIdStatus,
    contentSha256Status: integrity.contentSha256Status, contentSha256: integrity.contentSha256,
    authenticityStatus: 'NOT_ESTABLISHED', receipt,
  });
  assertJsonSafe(verification, REVISION_RESPONSIVENESS_RECEIPT_VERIFICATION_SCHEMA);
  return verification;
}

export function revisionResponsivenessReceiptVerificationModel(state, currentInput) {
  const verification = state?.verification; const receipt = verification?.receipt;
  if (state?.status !== 'VERIFIED' || !receipt) return deepFreeze({
    status: state?.status ?? 'IDLE', fileName: state?.fileName ?? '', receiptId: null, contentSha256: null,
    structureStatus: state?.status === 'FAILED' ? 'FAILED' : 'NOT_VERIFIED',
    receiptIdStatus: state?.status === 'FAILED' ? 'FAILED' : 'NOT_VERIFIED',
    contentSha256Status: state?.status === 'FAILED' ? 'FAILED' : 'NOT_VERIFIED',
    authorityStatus: 'UNAVAILABLE', runStatus: 'UNAVAILABLE', authenticityStatus: 'NOT_ESTABLISHED',
    error: state?.error ?? null,
  });
  const authorityStatus = authorityRelation(receipt, currentInput);
  const runStatus = runRelation(receipt, currentInput, authorityStatus);
  return deepFreeze({
    status: runStatus === 'MATCH' ? 'VERIFIED_CURRENT' : authorityStatus === 'MATCH' ? 'VERIFIED_HISTORICAL' : 'VERIFIED_OTHER_AUTHORITY',
    fileName: state.fileName, receiptId: receipt.receiptId, contentSha256: verification.contentSha256,
    structureStatus: verification.structureStatus, receiptIdStatus: verification.receiptIdStatus,
    contentSha256Status: verification.contentSha256Status, authorityStatus, runStatus,
    authenticityStatus: verification.authenticityStatus, error: null,
  });
}
