import assert from 'node:assert/strict';
import { routeRevisionCompareActionClick } from '../tabs/revision-compare/revision-compare-event-routing.js';
import {
  REVISION_RESPONSIVENESS_OBSERVATION_RECEIPT_SCHEMA,
  createRevisionResponsivenessObservationReceipt,
  revisionResponsivenessObservationReceiptFileName,
  revisionResponsivenessObservationReceiptMatches,
} from '../tabs/revision-compare/revision-responsiveness-observation-receipt.js';
import {
  createRevisionResponsivenessReceiptIntegrity,
  revisionResponsivenessReceiptId,
} from '../tabs/revision-compare/revision-responsiveness-receipt-integrity.js';
import { revisionViewerCompletedRunSnapshot } from '../tabs/revision-compare/revision-viewer-run-comparison.js';
import {
  REVISION_VIEWER_DEFAULT_RESPONSIVENESS_POLICY,
  revisionViewerResponsivenessMarkup,
  revisionViewerResponsivenessModel,
} from '../tabs/revision-compare/revision-viewer-responsiveness.js';

const HASH_A = 'a'.repeat(64);
const SCOPE_A = 'b'.repeat(64);
const HASH_B = 'c'.repeat(64);
const SCOPE_B = 'd'.repeat(64);
const RUN_KEY = 'audit:receipt|WEBGL';

function document(documentId, sourceHash, scopedHash) {
  return Object.freeze({
    documentId,
    sourceHash,
    scopedHash,
    stagedSchema: 'sequential-sketcher-source-array/v1',
    unit: 'MM',
    coordinateFrame: 'PLANT',
    verticalAxis: 'Z',
  });
}

function audit(overrides = {}) {
  return Object.freeze({
    schema: 'RevisionCompareAudit.v1',
    auditId: 'audit:receipt',
    basisId: 'basis:receipt',
    engineVersion: 'revision-compare-test/v1',
    revADocumentId: 'document:a',
    revBDocumentId: 'document:b',
    validation: Object.freeze({ status: 'READY', errors: Object.freeze([]) }),
    ...overrides,
  });
}

function scene(status = 'READY') {
  return Object.freeze({
    status,
    requestedBackend: 'WEBGL',
    expected: Object.freeze({ source: 1500, target: 1500, total: 3000 }),
  });
}

function viewer(fitSelectedMs = 30) {
  return Object.freeze({
    fitSelectedCount: 1,
    lastFitSelectedMs: fitSelectedMs,
    viewerBackend: 'WEBGL',
  });
}

function observations(runSequence, previousRun = null, overrides = {}) {
  return {
    runKey: RUN_KEY,
    runId: `${RUN_KEY}|run:${runSequence}`,
    runSequence,
    previousRun,
    elapsedMs: 900,
    sceneRuntimeObservedMs: 600,
    firstReadyMs: 800,
    memory: { available: false, usedBytes: null, peakGrowthBytes: null },
    ...overrides,
  };
}

function receiptInput(model, overrides = {}) {
  return {
    session: Object.freeze({
      sessionId: 'revision-session-receipt',
      createdAt: '2026-07-30T10:00:00.000Z',
      updatedAt: '2026-07-30T10:05:00.000Z',
    }),
    audit: audit(),
    revA: document('document:a', HASH_A, SCOPE_A),
    revB: document('document:b', HASH_B, SCOPE_B),
    sceneEvidence: Object.freeze({
      runKey: model.runKey,
      runId: model.runId,
      runSequence: model.runSequence,
      runSampleCount: 7,
      elapsedMs: 900,
      responsiveness: model,
    }),
    ...overrides,
  };
}

const first = revisionViewerResponsivenessModel(
  scene(), viewer(30), observations(1), REVISION_VIEWER_DEFAULT_RESPONSIVENESS_POLICY,
);
const previous = revisionViewerCompletedRunSnapshot(RUN_KEY, first);
const current = revisionViewerResponsivenessModel(
  scene(), viewer(20), observations(2, previous, {
    sceneRuntimeObservedMs: 500,
    firstReadyMs: 650,
  }), REVISION_VIEWER_DEFAULT_RESPONSIVENESS_POLICY,
);

assert.equal(current.disposition, 'QUALIFIED');
assert.equal(current.canDownloadReceipt, true);
const markup = revisionViewerResponsivenessMarkup(current);
assert.match(markup, /data-revc-download-responsiveness-receipt/);
assert.doesNotMatch(markup, /data-revc-download-responsiveness-receipt disabled/);
assert.match(current.disclosure, /not engineering acceptance, design validation, or certification/i);

const pending = revisionViewerResponsivenessModel(
  scene(), { fitSelectedCount: 0, lastFitSelectedMs: null }, observations(1),
  REVISION_VIEWER_DEFAULT_RESPONSIVENESS_POLICY,
);
assert.equal(pending.canDownloadReceipt, false);
assert.match(revisionViewerResponsivenessMarkup(pending), /data-revc-download-responsiveness-receipt disabled/);

let routedDownloads = 0;
const routedActions = new Proxy({ transferClick() {} }, {
  get: (target, key) => target[key] ?? (() => {
    if (key === 'downloadResponsivenessReceipt') routedDownloads += 1;
  }),
});
const receiptButton = {
  dataset: {},
  hasAttribute: (name) => name === 'data-revc-download-responsiveness-receipt',
};
routeRevisionCompareActionClick(routedActions, { closest: () => receiptButton });
assert.equal(routedDownloads, 1);

const input = receiptInput(current);
const receipt = await createRevisionResponsivenessObservationReceipt(input, globalThis.crypto);
const duplicate = await createRevisionResponsivenessObservationReceipt(input, globalThis.crypto);
assert.deepEqual(duplicate, receipt, 'identical authority and observations must produce identical receipt bytes');
assert.equal(receipt.schema, REVISION_RESPONSIVENESS_OBSERVATION_RECEIPT_SCHEMA);
assert.equal(receipt.schema, 'RevisionResponsivenessObservationReceipt.v2');
assert.match(receipt.contentSha256, /^[a-f0-9]{64}$/);
assert.equal(receipt.receiptId, revisionResponsivenessReceiptId(receipt.contentSha256));
assert.match(receipt.receiptId, /^responsiveness-observation:[a-f0-9]{24}$/);
const integrity = await createRevisionResponsivenessReceiptIntegrity(receipt, globalThis.crypto);
assert.equal(integrity.contentSha256, receipt.contentSha256);
assert.equal(integrity.receiptId, receipt.receiptId);
assert.equal(receipt.authority.classification, 'PRODUCT_RUNTIME_OBSERVATION_ONLY');
assert.equal(receipt.authority.engineeringCertification, 'NONE');
assert.match(receipt.authority.statement, /not engineering acceptance/i);
assert.equal(receipt.audit.auditId, 'audit:receipt');
assert.equal(receipt.audit.basisId, 'basis:receipt');
assert.equal(receipt.revisions.revA.sourceHash, HASH_A);
assert.equal(receipt.revisions.revB.scopedHash, SCOPE_B);
assert.equal(receipt.observation.backend, 'WEBGL');
assert.equal(receipt.observation.runSequence, 2);
assert.equal(receipt.observation.policyId, 'revision-webgl-responsiveness/v1');
assert.equal(receipt.observation.bandId, 'BALANCED');
assert.equal(receipt.observation.metrics.memory.status, 'UNAVAILABLE');
assert.equal(receipt.observation.metrics.memory.value, null);
assert.equal(receipt.observation.comparison.available, true);
assert.equal(receipt.observation.comparison.previous.runSequence, 1);
assert.equal(receipt.observation.comparison.current.runSequence, 2);
assert.equal(receipt.observation.comparison.deltas.sceneMs, -100);
assert.equal(receipt.observation.comparison.deltas.firstReadyMs, -150);
assert.equal(receipt.observation.comparison.deltas.fitSelectedMs, -10);
assert.equal(receipt.observation.comparison.deltas.heapGrowthBytes, null);
assert.equal(Object.isFrozen(receipt), true);
assert.equal(Object.isFrozen(receipt.observation.metrics), true);
assert.equal(revisionResponsivenessObservationReceiptMatches(receipt, input), true);
assert.equal(
  revisionResponsivenessObservationReceiptFileName(receipt),
  'revision-responsiveness-audit-receipt-run-2.json',
);

assert.equal(revisionResponsivenessObservationReceiptMatches(receipt, {
  ...input,
  session: { ...input.session, updatedAt: '2026-07-30T10:06:00.000Z' },
}), false);
assert.equal(revisionResponsivenessObservationReceiptMatches(receipt, {
  ...input,
  sceneEvidence: {
    ...input.sceneEvidence,
    runId: `${RUN_KEY}|run:3`,
    runSequence: 3,
    responsiveness: { ...current, runId: `${RUN_KEY}|run:3`, runSequence: 3 },
  },
}), false);
assert.equal(revisionResponsivenessObservationReceiptMatches(receipt, {
  ...input,
  revA: { ...input.revA, scopedHash: 'e'.repeat(64) },
}), false);

await assert.rejects(
  () => createRevisionResponsivenessObservationReceipt(receiptInput(pending), globalThis.crypto),
  /complete the current responsiveness disposition/i,
);
await assert.rejects(
  () => createRevisionResponsivenessObservationReceipt({
    ...input,
    audit: audit({ validation: { status: 'INVALID', errors: ['test'] } }),
  }, globalThis.crypto),
  /validated RevisionCompareAudit/i,
);
await assert.rejects(
  () => createRevisionResponsivenessObservationReceipt({
    ...input,
    revB: { ...input.revB, documentId: 'document:other' },
  }, globalThis.crypto),
  /do not match the current audit/i,
);

console.log('revision-responsiveness-observation-receipt: PASS');
