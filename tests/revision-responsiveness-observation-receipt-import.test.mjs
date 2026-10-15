import assert from 'node:assert/strict';
import { deterministicId } from '../tabs/revision-compare/revision-contract-utils.js';
import { routeRevisionCompareInputChange } from '../tabs/revision-compare/revision-compare-event-routing.js';
import {
  REVISION_RESPONSIVENESS_OBSERVATION_AUTHORITY,
  REVISION_RESPONSIVENESS_OBSERVATION_CAVEATS,
  REVISION_RESPONSIVENESS_OBSERVATION_RECEIPT_SCHEMA,
  REVISION_RESPONSIVENESS_OBSERVATION_RECEIPT_V1_SCHEMA,
} from '../tabs/revision-compare/revision-responsiveness-observation-receipt.js';
import {
  createRevisionResponsivenessReceiptIntegrity,
} from '../tabs/revision-compare/revision-responsiveness-receipt-integrity.js';
import {
  completeRevisionResponsivenessReceiptVerification,
  createRevisionResponsivenessReceiptVerificationState,
  failRevisionResponsivenessReceiptVerification,
  revisionResponsivenessReceiptVerificationModel,
  startRevisionResponsivenessReceiptVerification,
  verifyRevisionResponsivenessObservationReceiptJson,
} from '../tabs/revision-compare/revision-responsiveness-observation-receipt-import.js';

const HASH_A = 'a'.repeat(64); const SCOPE_A = 'b'.repeat(64);
const HASH_B = 'c'.repeat(64); const SCOPE_B = 'd'.repeat(64);
const RUN_KEY = 'audit:receipt-import|WEBGL';

function revision(documentId, sourceHash, scopedHash) {
  return { documentId, sourceHash, scopedHash, stagedSchema: 'sequential-sketcher-source-array/v1', unit: 'MM', coordinateFrame: 'PLANT', verticalAxis: 'Z' };
}

function run(runSequence, values) {
  return {
    runId: `${RUN_KEY}|run:${runSequence}`, runSequence, policyId: 'revision-webgl-responsiveness/v1',
    bandId: 'BALANCED', drawableCount: 3000, disposition: 'QUALIFIED',
    sceneMs: values.sceneMs, firstReadyMs: values.firstReadyMs,
    fitSelectedMs: values.fitSelectedMs, heapGrowthBytes: null,
  };
}

function receiptIdentity(schema) {
  const previous = run(1, { sceneMs: 600, firstReadyMs: 800, fitSelectedMs: 30 });
  const current = run(2, { sceneMs: 500, firstReadyMs: 650, fitSelectedMs: 20 });
  return {
    schema,
    authority: REVISION_RESPONSIVENESS_OBSERVATION_AUTHORITY,
    session: { sessionId: 'revision-session-import', createdAt: '2026-07-30T10:00:00.000Z', updatedAt: '2026-07-30T10:05:00.000Z' },
    audit: { auditId: 'audit:receipt-import', basisId: 'basis:receipt-import', engineVersion: 'revision-compare-test/v1', revADocumentId: 'document:a', revBDocumentId: 'document:b' },
    revisions: { revA: revision('document:a', HASH_A, SCOPE_A), revB: revision('document:b', HASH_B, SCOPE_B) },
    observation: {
      backend: 'WEBGL', runKey: RUN_KEY, runId: current.runId, runSequence: 2,
      policyId: current.policyId, bandId: current.bandId, drawableCount: current.drawableCount,
      sceneStatus: 'READY', disposition: 'QUALIFIED', elapsedMs: 900, sampleCount: 7,
      metrics: {
        scene: { status: 'PASS', value: 500, limit: 3500 },
        firstReady: { status: 'PASS', value: 650, limit: 4500 },
        fitSelected: { status: 'PASS', value: 20, limit: 125, count: 1 },
        memory: { status: 'UNAVAILABLE', value: null, limit: 268435456, usedBytes: null },
      },
      comparison: {
        available: true, reason: 'COMPARABLE', previous, current,
        deltas: { sceneMs: -100, firstReadyMs: -150, fitSelectedMs: -10, heapGrowthBytes: null },
      },
    },
    caveats: REVISION_RESPONSIVENESS_OBSERVATION_CAVEATS,
  };
}

async function signReceipt(identity) {
  if (identity.schema === REVISION_RESPONSIVENESS_OBSERVATION_RECEIPT_V1_SCHEMA) {
    return { ...identity, receiptId: await deterministicId('responsiveness-observation', identity, globalThis.crypto) };
  }
  return { ...identity, ...await createRevisionResponsivenessReceiptIntegrity(identity, globalThis.crypto) };
}

async function validReceipt(schema = REVISION_RESPONSIVENESS_OBSERVATION_RECEIPT_SCHEMA) {
  return signReceipt(receiptIdentity(schema));
}

async function resign(receipt) {
  const { receiptId: _receiptId, contentSha256: _contentSha256, ...identity } = receipt;
  return signReceipt(identity);
}

function currentInput(runId = `${RUN_KEY}|run:2`, auditId = 'audit:receipt-import') {
  return {
    audit: { auditId, basisId: 'basis:receipt-import' },
    revA: revision('document:a', HASH_A, SCOPE_A), revB: revision('document:b', HASH_B, SCOPE_B),
    sceneEvidence: { responsiveness: { runId } },
  };
}

const receipt = await validReceipt();
const receiptText = JSON.stringify(receipt, null, 2);
const verification = await verifyRevisionResponsivenessObservationReceiptJson(receiptText, globalThis.crypto);
assert.equal(verification.structureStatus, 'VERIFIED');
assert.equal(verification.contentSha256Status, 'VERIFIED');
assert.equal(verification.contentSha256, receipt.contentSha256);
assert.equal(verification.receiptIdStatus, 'VERIFIED');
assert.equal(verification.authenticityStatus, 'NOT_ESTABLISHED');
assert.equal(verification.receipt.receiptId, receipt.receiptId);
assert.equal(Object.isFrozen(verification), true);

let state = createRevisionResponsivenessReceiptVerificationState();
assert.equal(revisionResponsivenessReceiptVerificationModel(state, currentInput()).status, 'IDLE');
state = startRevisionResponsivenessReceiptVerification(state, 1, 'receipt.json');
assert.equal(revisionResponsivenessReceiptVerificationModel(state, currentInput()).status, 'IMPORTING');
state = completeRevisionResponsivenessReceiptVerification(state, 1, verification);
const currentModel = revisionResponsivenessReceiptVerificationModel(state, currentInput());
assert.equal(currentModel.status, 'VERIFIED_CURRENT');
assert.equal(currentModel.structureStatus, 'VERIFIED');
assert.equal(currentModel.contentSha256Status, 'VERIFIED');
assert.equal(currentModel.contentSha256, receipt.contentSha256);
assert.equal(currentModel.receiptIdStatus, 'VERIFIED');
assert.equal(currentModel.authorityStatus, 'MATCH');
assert.equal(currentModel.runStatus, 'MATCH');
assert.equal(currentModel.authenticityStatus, 'NOT_ESTABLISHED');
assert.equal(revisionResponsivenessReceiptVerificationModel(state, currentInput(`${RUN_KEY}|run:3`)).status, 'VERIFIED_HISTORICAL');
assert.equal(revisionResponsivenessReceiptVerificationModel(state, currentInput(`${RUN_KEY}|run:2`, 'audit:other')).status, 'VERIFIED_OTHER_AUTHORITY');

const legacy = await validReceipt(REVISION_RESPONSIVENESS_OBSERVATION_RECEIPT_V1_SCHEMA);
const legacyVerification = await verifyRevisionResponsivenessObservationReceiptJson(JSON.stringify(legacy), globalThis.crypto);
assert.equal(legacyVerification.contentSha256Status, 'LEGACY_NOT_DECLARED');
assert.match(legacyVerification.contentSha256, /^[a-f0-9]{64}$/);
assert.equal(legacyVerification.receiptIdStatus, 'VERIFIED');
const legacyState = completeRevisionResponsivenessReceiptVerification(
  startRevisionResponsivenessReceiptVerification(createRevisionResponsivenessReceiptVerificationState(), 1, 'legacy.json'),
  1,
  legacyVerification,
);
assert.equal(revisionResponsivenessReceiptVerificationModel(legacyState, currentInput()).status, 'VERIFIED_CURRENT');
assert.equal(revisionResponsivenessReceiptVerificationModel(legacyState, currentInput()).contentSha256Status, 'LEGACY_NOT_DECLARED');

const failed = failRevisionResponsivenessReceiptVerification(startRevisionResponsivenessReceiptVerification(state, 2, 'bad.json'), 2, new Error('bad receipt'));
assert.equal(revisionResponsivenessReceiptVerificationModel(failed, currentInput()).structureStatus, 'FAILED');
assert.equal(revisionResponsivenessReceiptVerificationModel(failed, currentInput()).contentSha256Status, 'FAILED');

const tampered = structuredClone(receipt); tampered.observation.metrics.scene.value += 1;
await assert.rejects(() => verifyRevisionResponsivenessObservationReceiptJson(JSON.stringify(tampered), globalThis.crypto), /Content SHA-256 does not match/i);
const badHash = structuredClone(receipt); badHash.contentSha256 = 'f'.repeat(64);
await assert.rejects(() => verifyRevisionResponsivenessObservationReceiptJson(JSON.stringify(badHash), globalThis.crypto), /Content SHA-256 does not match/i);
const unsupported = structuredClone(receipt); unsupported.extra = true;
await assert.rejects(() => verifyRevisionResponsivenessObservationReceiptJson(JSON.stringify(unsupported), globalThis.crypto), /unsupported or missing fields/i);

const wrongAuthority = structuredClone(receipt); wrongAuthority.authority.engineeringCertification = 'ASSERTED';
const resignedAuthority = await resign(wrongAuthority);
await assert.rejects(() => verifyRevisionResponsivenessObservationReceiptJson(JSON.stringify(resignedAuthority), globalThis.crypto), /authority boundary is invalid/i);

const inconsistent = structuredClone(receipt); inconsistent.observation.comparison.current.runId = `${RUN_KEY}|run:9`;
const resignedInconsistent = await resign(inconsistent);
await assert.rejects(() => verifyRevisionResponsivenessObservationReceiptJson(JSON.stringify(resignedInconsistent), globalThis.crypto), /Comparison current run must match/i);

const duplicate = receiptText.replace('"schema":', '"schema":"duplicate",\n  "schema":');
await assert.rejects(() => verifyRevisionResponsivenessObservationReceiptJson(duplicate, globalThis.crypto), /duplicate field "schema"/i);
await assert.rejects(() => verifyRevisionResponsivenessObservationReceiptJson(`{"padding":"${'x'.repeat(256 * 1024)}"}`, globalThis.crypto), /limited to 256 KiB/i);

let routedFile = null;
const actions = new Proxy({ transferChange() {}, syncSignOffControls() {} }, {
  get: (target, key) => target[key] ?? ((file) => { if (key === 'importResponsivenessReceipt') routedFile = file; }),
});
const file = { name: 'receipt.json' };
const target = { value: 'selected', files: [file], matches: (selector) => selector === '[data-revc-responsiveness-receipt-import]' };
routeRevisionCompareInputChange(actions, target);
assert.equal(routedFile, file); assert.equal(target.value, '');

console.log('revision-responsiveness-observation-receipt-import: PASS');
