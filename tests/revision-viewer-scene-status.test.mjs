import assert from 'node:assert/strict';
import { createRevisionCompareViewerAdapter } from '../tabs/revision-compare/revision-compare-viewer-adapter.js';
import { createRevisionViewerSceneMonitor } from '../tabs/revision-compare/revision-viewer-scene-monitor.js';
import {
  revisionViewerSceneStatus,
  revisionViewerSceneStatusMarkup,
  timedOutRevisionViewerSceneStatus,
} from '../tabs/revision-compare/revision-viewer-scene-status.js';

function visualModel(id, count) {
  return Object.freeze({
    schema: 'VisualGeometryModel.v1',
    modelId: id,
    verticalAxis: 'Z',
    segments: Object.freeze(Array.from({ length: count }, (_, index) => Object.freeze({
      objectId: `${id}:${index}`,
      kind: 'PIPE',
      start: [index * 100, 0, 0],
      end: [(index + 1) * 100, 0, 0],
      radius: 25,
    }))),
    markers: Object.freeze([]),
  });
}

function audit(id = 'audit:scene') {
  return Object.freeze({
    auditId: id,
    visualModels: Object.freeze({
      revA: visualModel('source', 2),
      revB: visualModel('target', 3),
      statusByObjectId: Object.freeze({ 'source:0': 'MISSING_IN_TARGET', 'target:0': 'NEW_IN_TARGET' }),
    }),
    differenceRows: Object.freeze([Object.freeze({
      differenceId: 'difference:1',
      visualRefs: Object.freeze({ sourceObjectId: 'source:0', targetObjectId: 'target:0' }),
    })]),
  });
}

function webglEvidence(overrides = {}) {
  return {
    viewerBackend: 'WEBGL',
    activeBackend: 'WEBGL',
    mounted: true,
    failed: false,
    pickCount: 2,
    lastPickedObjectId: 'target:0',
    viewer: {
      runtimePending: false,
      runtimeRevision: 7,
      runtimeError: null,
      instanceCount: 11,
      drawBatchCount: 4,
      sceneChunkCount: 2,
      spatialEntryCount: 5,
      lod: 'FULL',
      selectedObjectId: 'source:0',
    },
    ...overrides,
  };
}

const inactive = revisionViewerSceneStatus(audit(), { viewerBackend: 'SVG', activeBackend: 'SVG' });
assert.equal(inactive.status, 'INACTIVE');
assert.deepEqual(inactive.expected, { source: 2, target: 3, total: 5 });

const pending = revisionViewerSceneStatus(audit(), webglEvidence({
  viewer: { runtimePending: true, runtimeRevision: null, instanceCount: 0 },
}));
assert.equal(pending.status, 'PENDING');
assert.equal(pending.terminal, false);
assert.match(timedOutRevisionViewerSceneStatus(pending, 15_001).message, /16 seconds/);

const ready = revisionViewerSceneStatus(audit(), webglEvidence());
assert.equal(ready.status, 'READY');
assert.equal(ready.rendered.instances, 11);
assert.equal(ready.selectedObjectId, 'source:0');
assert.equal(ready.pickCount, 2);
assert.equal(ready.lastPickedObjectId, 'target:0');
assert.match(ready.authorityNote, /do not alter source, engineering, topology, comparison, or export authority/);
assert.match(revisionViewerSceneStatusMarkup(ready), /data-revc-scene-instances>11</);

const zero = revisionViewerSceneStatus(audit(), webglEvidence({
  viewer: { runtimePending: false, runtimeRevision: 8, instanceCount: 0, drawBatchCount: 0 },
}));
assert.equal(zero.status, 'BLOCKED');
assert.equal(zero.reason, 'ZERO_RENDERED_INSTANCES');

const failed = revisionViewerSceneStatus(audit(), webglEvidence({
  viewer: { runtimePending: false, runtimeRevision: null, runtimeError: 'worker failed' },
}));
assert.equal(failed.status, 'FAILED');
assert.match(failed.message, /worker failed/);

function node() {
  return { textContent: '', attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } };
}
function sceneRoot() {
  const children = new Map([
    ['[data-revc-scene-state]', node()],
    ['[data-revc-scene-source]', node()],
    ['[data-revc-scene-target]', node()],
    ['[data-revc-scene-instances]', node()],
    ['[data-revc-scene-batches]', node()],
    ['[data-revc-scene-runtime]', node()],
    ['[data-revc-scene-selection]', node()],
    ['[data-revc-scene-picks]', node()],
    ['[data-revc-scene-last-pick]', node()],
    ['[data-revc-scene-message]', node()],
  ]);
  const host = node();
  host.querySelector = (selector) => children.get(selector) ?? null;
  return {
    host,
    children,
    root: { querySelector: (selector) => (selector === '[data-revc-scene-status]' ? host : null) },
  };
}

let now = 0;
let timerId = 0;
const timers = new Map();
const setTimer = (callback) => { timerId += 1; timers.set(timerId, callback); return timerId; };
const clearTimer = (id) => timers.delete(id);
const dom = sceneRoot();
let monitoredEvidence = webglEvidence({
  pickCount: 0,
  lastPickedObjectId: null,
  viewer: { runtimePending: true, runtimeRevision: null, instanceCount: 0 },
});
const monitor = createRevisionViewerSceneMonitor({ intervalMs: 1, pendingLimitMs: 10, clock: () => now, setTimer, clearTimer });
monitor.start(dom.root, audit(), { evidence: () => monitoredEvidence });
assert.equal(dom.children.get('[data-revc-scene-state]').textContent, 'PENDING');
assert.equal(timers.size, 1);

monitoredEvidence = webglEvidence();
const nextTimer = [...timers.values()][0];
timers.clear();
nextTimer();
assert.equal(dom.children.get('[data-revc-scene-state]').textContent, 'READY');
assert.equal(dom.children.get('[data-revc-scene-selection]').textContent, 'source:0');
assert.equal(dom.children.get('[data-revc-scene-picks]').textContent, '2');
assert.equal(timers.size, 1);
monitor.destroy();
assert.equal(timers.size, 0);
assert.equal(monitor.evidence().destroyed, true);

let viewerCallbacks;
let viewerSnapshot = {
  runtimePending: false,
  runtimeRevision: 1,
  runtimeError: null,
  instanceCount: 2,
  drawBatchCount: 1,
  sceneChunkCount: 1,
  spatialEntryCount: 2,
  selectedObjectId: null,
};
const viewerFactory = async (_host, callbacks) => {
  viewerCallbacks = callbacks;
  return {
    reattach() {},
    setModels() {},
    setStatuses() {},
    setMode() {},
    setVerticalAxis() {},
    setSelection(primary) { viewerSnapshot = { ...viewerSnapshot, selectedObjectId: primary }; },
    fitAll() { return true; },
    fitSelection() { return true; },
    getStateSnapshot() { return viewerSnapshot; },
    dispose() {},
  };
};
const adapter = createRevisionCompareViewerAdapter({ webglViewerFactory: viewerFactory });
adapter.setBackend('WEBGL');
await adapter.render({}, audit());
viewerCallbacks.onPick({ objectId: 'source:0' });
assert.equal(adapter.evidence().pickCount, 1);
assert.equal(adapter.evidence().lastPickedObjectId, 'source:0');
assert.equal(adapter.evidence().lastPickedDifferenceId, 'difference:1');
await adapter.render({}, audit('audit:replacement'));
assert.equal(adapter.evidence().pickCount, 0);
adapter.dispose();

console.log('revision-viewer-scene-status: PASS');
