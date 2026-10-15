import assert from 'node:assert/strict';
import { routeRevisionCompareActionClick } from '../tabs/revision-compare/revision-compare-event-routing.js';
import { createRevisionCompareViewerAdapter } from '../tabs/revision-compare/revision-compare-viewer-adapter.js';
import { createRevisionViewerSceneMonitor } from '../tabs/revision-compare/revision-viewer-scene-monitor.js';
import {
  revisionViewerCompletedRunSnapshot,
  revisionViewerRunComparison,
} from '../tabs/revision-compare/revision-viewer-run-comparison.js';
import {
  REVISION_VIEWER_DEFAULT_RESPONSIVENESS_POLICY,
  createRevisionViewerResponsivenessPolicy,
  readRevisionViewerMemory,
  revisionViewerResponsivenessMarkup,
  revisionViewerResponsivenessModel,
} from '../tabs/revision-compare/revision-viewer-responsiveness.js';

const MIB = 1024 * 1024;

function visualModel(id, count) {
  return Object.freeze({
    schema: 'VisualGeometryModel.v1', modelId: id, verticalAxis: 'Z',
    segments: Object.freeze(Array.from({ length: count }, (_, index) => Object.freeze({
      objectId: `${id}:${index}`, kind: 'PIPE', start: [index, 0, 0], end: [index + 1, 0, 0], radiusMm: 25,
    }))),
    markers: Object.freeze([]),
  });
}
function audit(id = 'audit:performance', source = 2, target = 3) {
  return Object.freeze({
    auditId: id,
    visualModels: Object.freeze({
      revA: visualModel('source', source),
      revB: visualModel('target', target),
      statusByObjectId: Object.freeze({ 'source:0': 'MISSING_IN_TARGET', 'target:0': 'NEW_IN_TARGET' }),
    }),
    differenceRows: Object.freeze([Object.freeze({
      differenceId: 'difference:1',
      visualRefs: Object.freeze({ sourceObjectId: 'source:0', targetObjectId: 'target:0' }),
    })]),
  });
}
function scene(drawableCount, status = 'READY') {
  return Object.freeze({
    status,
    requestedBackend: 'WEBGL',
    expected: Object.freeze({ source: Math.floor(drawableCount / 2), target: Math.ceil(drawableCount / 2), total: drawableCount }),
  });
}
function observations(overrides = {}) {
  return {
    runKey: 'audit:performance|WEBGL',
    runId: 'audit:performance|WEBGL|run:1',
    runSequence: 1,
    previousRun: null,
    elapsedMs: 900,
    sceneRuntimeObservedMs: 600,
    firstReadyMs: 800,
    memory: { available: false, usedBytes: null, peakGrowthBytes: null },
    ...overrides,
  };
}
function viewerEvidence(overrides = {}) {
  return {
    viewerBackend: 'WEBGL', activeBackend: 'WEBGL', mounted: true, failed: false,
    fitSelectedCount: 1, lastFitSelectedMs: 30,
    viewer: {
      runtimePending: false, runtimeRevision: 4, runtimeError: null,
      instanceCount: 6, drawBatchCount: 2, sceneChunkCount: 1,
      spatialEntryCount: 5, selectedObjectId: 'source:0',
    },
    ...overrides,
  };
}

const policy = createRevisionViewerResponsivenessPolicy(REVISION_VIEWER_DEFAULT_RESPONSIVENESS_POLICY);
assert.equal(policy.bands.length, 3);
assert.equal(Object.isFrozen(policy), true);
assert.throws(() => createRevisionViewerResponsivenessPolicy({
  policyId: 'invalid', samplingResolutionMs: 250,
  bands: [{ bandId: 'ONLY', maximumDrawablesExclusive: 100, sceneObservedMaxMs: 1, firstReadyMaxMs: 1, fitSelectedMaxMs: 1, heapGrowthMaxBytes: 1 }],
}), /final responsiveness band must be unbounded/);

const fine = revisionViewerResponsivenessModel(scene(2999), viewerEvidence(), observations(), policy);
const balanced = revisionViewerResponsivenessModel(scene(3000), viewerEvidence(), observations(), policy);
const coarse = revisionViewerResponsivenessModel(scene(12000), viewerEvidence(), observations(), policy);
assert.equal(fine.bandId, 'FINE');
assert.equal(balanced.bandId, 'BALANCED');
assert.equal(coarse.bandId, 'COARSE');
assert.equal(fine.runKey, 'audit:performance|WEBGL');
assert.equal(fine.runId, 'audit:performance|WEBGL|run:1');
assert.equal(fine.runSequence, 1);
assert.equal(fine.canRerun, true);
assert.equal(fine.disposition, 'QUALIFIED');
assert.equal(fine.metrics.memory.status, 'UNAVAILABLE');
assert.equal(fine.comparison.available, false);
assert.equal(fine.comparison.reason, 'NO_PREVIOUS_COMPLETED_RUN');
assert.match(fine.message, /heap telemetry is unavailable/);
assert.match(fine.disclosure, /sampling resolution 250 ms/i);
assert.match(fine.disclosure, /Run deltas are current minus previous/);
assert.match(fine.disclosure, /Rerun measurement clears only runtime timing observations/);
assert.match(fine.disclosure, /do not alter renderer, engineering, topology, comparison, persistence, or export authority/);
const fineMarkup = revisionViewerResponsivenessMarkup(fine);
assert.match(fineMarkup, /data-revc-rerun-responsiveness/);
assert.match(fineMarkup, /data-revc-performance-run>Run 1</);
assert.match(fineMarkup, /data-revc-run-comparison/);

const previousFine = revisionViewerCompletedRunSnapshot(fine.runKey, fine);
assert.equal(previousFine.runSequence, 1);
assert.equal(revisionViewerCompletedRunSnapshot(fine.runKey, { ...fine, disposition: 'PENDING' }), null);
const secondFine = revisionViewerResponsivenessModel(scene(2999), viewerEvidence({ lastFitSelectedMs: 20 }), observations({
  runId: 'audit:performance|WEBGL|run:2', runSequence: 2, previousRun: previousFine,
  sceneRuntimeObservedMs: 500, firstReadyMs: 650,
}), policy);
assert.equal(secondFine.comparison.available, true);
assert.equal(secondFine.comparison.previous.runSequence, 1);
assert.equal(secondFine.comparison.current.runSequence, 2);
assert.equal(secondFine.comparison.deltas.sceneMs, -100);
assert.equal(secondFine.comparison.deltas.firstReadyMs, -150);
assert.equal(secondFine.comparison.deltas.fitSelectedMs, -10);
assert.equal(secondFine.comparison.deltas.heapGrowthBytes, null);
assert.match(revisionViewerResponsivenessMarkup(secondFine), /Run 1 → Run 2/);
assert.equal(revisionViewerRunComparison(previousFine, secondFine, 'other|WEBGL').reason, 'RUN_KEY_MISMATCH');

const slowFit = revisionViewerResponsivenessModel(scene(100), viewerEvidence({ lastFitSelectedMs: 100 }), observations(), policy);
assert.equal(slowFit.metrics.fitSelected.status, 'FAIL');
assert.equal(slowFit.disposition, 'NOT_QUALIFIED');
const slowReady = revisionViewerResponsivenessModel(scene(100, 'PENDING'), viewerEvidence({ fitSelectedCount: 0, lastFitSelectedMs: null }), observations({ elapsedMs: 2500, sceneRuntimeObservedMs: null, firstReadyMs: null }), policy);
assert.equal(slowReady.metrics.firstReady.status, 'FAIL');
assert.equal(slowReady.disposition, 'NOT_QUALIFIED');
const memoryFail = revisionViewerResponsivenessModel(scene(100), viewerEvidence(), observations({ memory: { available: true, usedBytes: 300 * MIB, peakGrowthBytes: 129 * MIB } }), policy);
assert.equal(memoryFail.metrics.memory.status, 'FAIL');
assert.equal(memoryFail.disposition, 'NOT_QUALIFIED');

assert.deepEqual(readRevisionViewerMemory({}), { available: false, usedBytes: null, limitBytes: null });
assert.deepEqual(readRevisionViewerMemory({ memory: { usedJSHeapSize: 40 * MIB, jsHeapSizeLimit: 1024 * MIB } }), {
  available: true, usedBytes: 40 * MIB, limitBytes: 1024 * MIB,
});

let routedReruns = 0;
const routedActions = new Proxy({ transferClick() {} }, { get: (target, key) => target[key] ?? (() => { if (key === 'rerunResponsiveness') routedReruns += 1; }) });
const rerunButton = { dataset: {}, hasAttribute: (name) => name === 'data-revc-rerun-responsiveness' };
routeRevisionCompareActionClick(routedActions, { closest: () => rerunButton });
assert.equal(routedReruns, 1);

function node() {
  return { textContent: '', attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } };
}
function monitorRoot() {
  const children = new Map([
    ['[data-revc-scene-state]', node()], ['[data-revc-scene-source]', node()],
    ['[data-revc-scene-target]', node()], ['[data-revc-scene-instances]', node()],
    ['[data-revc-scene-batches]', node()], ['[data-revc-scene-runtime]', node()],
    ['[data-revc-scene-selection]', node()], ['[data-revc-scene-picks]', node()],
    ['[data-revc-scene-last-pick]', node()], ['[data-revc-scene-message]', node()],
  ]);
  const host = node();
  host.querySelector = (selector) => children.get(selector) ?? null;
  host.insertAdjacentHTML = () => {};
  return { querySelector: (selector) => (selector === '[data-revc-scene-status]' ? host : null) };
}

let now = 0;
let heapUsed = 100 * MIB;
let evidence = viewerEvidence({
  fitSelectedCount: 0, lastFitSelectedMs: null,
  viewer: { runtimePending: true, runtimeRevision: null, runtimeError: null, instanceCount: 0 },
});
let timerId = 0;
const timers = new Map();
const setTimer = (callback) => { timerId += 1; timers.set(timerId, callback); return timerId; };
const clearTimer = (id) => timers.delete(id);
const monitor = createRevisionViewerSceneMonitor({
  intervalMs: 100,
  pendingLimitMs: 10_000,
  clock: () => now,
  setTimer,
  clearTimer,
  memoryReader: () => ({ available: true, usedBytes: heapUsed, limitBytes: 1024 * MIB }),
  responsivenessPolicy: {
    policyId: 'test-policy', samplingResolutionMs: 100,
    bands: [{ bandId: 'TEST', maximumDrawablesExclusive: null, sceneObservedMaxMs: 1000, firstReadyMaxMs: 1200, fitSelectedMaxMs: 50, heapGrowthMaxBytes: 64 * MIB }],
  },
});
const monitoredAudit = audit();
const adapterEvidence = { evidence: () => evidence };
monitor.start(monitorRoot(), monitoredAudit, adapterEvidence);
const firstRunId = monitor.evidence().runId;
assert.equal(monitor.evidence().runSequence, 1);
assert.match(firstRunId, /audit:performance\|WEBGL\|run:1$/);
assert.equal(monitor.evidence().responsiveness.disposition, 'PENDING');
now = 300;
heapUsed = 120 * MIB;
evidence = viewerEvidence({ fitSelectedCount: 0, lastFitSelectedMs: null });
const readyTimer = [...timers.values()][0];
timers.clear();
readyTimer();
assert.equal(monitor.evidence().sceneRuntimeObservedMs, 300);
assert.equal(monitor.evidence().firstReadyMs, 300);
monitor.stop();
now = 500;
heapUsed = 125 * MIB;
evidence = viewerEvidence({ fitSelectedCount: 1, lastFitSelectedMs: 20 });
monitor.start(monitorRoot(), monitoredAudit, adapterEvidence);
assert.equal(monitor.evidence().runId, firstRunId, 'same audit/backend retains run identity');
assert.equal(monitor.evidence().responsiveness.disposition, 'QUALIFIED');
assert.equal(monitor.evidence().responsiveness.metrics.memory.value, 25 * MIB);
monitor.resetResponsiveness();
assert.equal(monitor.evidence().runKey, null);
assert.equal(monitor.evidence().previousRun.runSequence, 1);
assert.equal(monitor.evidence().firstReadyMs, null);
evidence = viewerEvidence({ fitSelectedCount: 0, lastFitSelectedMs: null });
monitor.start(monitorRoot(), monitoredAudit, adapterEvidence);
assert.equal(monitor.evidence().runSequence, 2);
assert.notEqual(monitor.evidence().runId, firstRunId);
assert.equal(monitor.evidence().responsiveness.comparison.available, true);
assert.equal(monitor.evidence().responsiveness.comparison.previous.runSequence, 1);
assert.equal(monitor.evidence().responsiveness.comparison.current.runSequence, 2);
assert.equal(monitor.evidence().responsiveness.metrics.fitSelected.count, 0);
now = 550;
heapUsed = 130 * MIB;
evidence = viewerEvidence({ fitSelectedCount: 1, lastFitSelectedMs: 10 });
const secondReadyTimer = [...timers.values()][0];
timers.clear();
secondReadyTimer();
const comparison = monitor.evidence().responsiveness.comparison;
assert.equal(comparison.deltas.sceneMs, -300);
assert.equal(comparison.deltas.firstReadyMs, -300);
assert.equal(comparison.deltas.fitSelectedMs, -10);
assert.equal(comparison.deltas.heapGrowthBytes, -20 * MIB);
monitor.stop();
monitor.start(monitorRoot(), audit('audit:replacement'), adapterEvidence);
assert.equal(monitor.evidence().previousRun, null, 'new audit clears the previous-run baseline');
assert.equal(monitor.evidence().responsiveness.comparison.available, false);
monitor.destroy();
assert.equal(timers.size, 0);
assert.equal(monitor.evidence().runKey, null);
assert.equal(monitor.evidence().previousRun, null);
assert.equal(monitor.evidence().runSequence, 0);

let viewerCallbacks;
let viewerSnapshot = {
  runtimePending: false, runtimeRevision: 1, runtimeError: null,
  instanceCount: 2, drawBatchCount: 1, sceneChunkCount: 1,
  spatialEntryCount: 2, selectedObjectId: null,
};
const clockValues = [10, 30, 40, 90];
const viewerFactory = async (_host, callbacks) => {
  viewerCallbacks = callbacks;
  return {
    reattach() {}, setModels() {}, setStatuses() {}, setMode() {}, setVerticalAxis() {},
    setSelection(primary) { viewerSnapshot = { ...viewerSnapshot, selectedObjectId: primary }; },
    fitAll() { return true; }, fitSelection() { return true; },
    getStateSnapshot() { return viewerSnapshot; }, dispose() {},
  };
};
const adapter = createRevisionCompareViewerAdapter({
  webglViewerFactory: viewerFactory,
  clock: () => clockValues.shift(),
});
adapter.setBackend('WEBGL');
await adapter.render({}, audit());
adapter.selectDifference('difference:1');
adapter.fitSelected();
adapter.fitSelected();
viewerCallbacks.onPick({ objectId: 'source:0' });
assert.equal(adapter.evidence().fitSelectedCount, 2);
assert.equal(adapter.evidence().lastFitSelectedMs, 50);
assert.equal(adapter.evidence().maxFitSelectedMs, 50);
assert.equal(adapter.evidence().pickCount, 1);
adapter.resetResponsivenessEvidence();
assert.equal(adapter.evidence().fitSelectedCount, 0);
assert.equal(adapter.evidence().lastFitSelectedMs, null);
assert.equal(adapter.evidence().pickCount, 1, 'responsiveness reset preserves pick evidence');
assert.equal(adapter.evidence().lastPickedObjectId, 'source:0');
await adapter.render({}, audit('audit:replacement'));
assert.equal(adapter.evidence().fitSelectedCount, 0);
assert.equal(adapter.evidence().pickCount, 0);
adapter.dispose();

console.log('revision-viewer-responsiveness: PASS');
