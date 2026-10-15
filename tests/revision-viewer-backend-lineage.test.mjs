import assert from 'node:assert/strict';
import { createRevisionCompareViewerAdapter } from '../tabs/revision-compare/revision-compare-viewer-adapter.js';

function visualModel(id) {
  return Object.freeze({
    schema: 'VisualGeometryModel.v1', modelId: id, verticalAxis: 'Z',
    segments: Object.freeze([{ objectId: `${id}:0`, kind: 'PIPE', start: [0, 0, 0], end: [100, 0, 0], radiusMm: 10 }]),
    markers: Object.freeze([]),
  });
}
function audit() {
  return Object.freeze({
    auditId: 'audit:backend-lineage',
    visualModels: Object.freeze({
      revA: visualModel('source'), revB: visualModel('target'),
      statusByObjectId: Object.freeze({ 'source:0': 'CHANGED', 'target:0': 'CHANGED' }),
    }),
    differenceRows: Object.freeze([Object.freeze({
      differenceId: 'difference:1',
      visualRefs: Object.freeze({ sourceObjectId: 'source:0', targetObjectId: 'target:0' }),
    })]),
  });
}

let callbacks;
const factory = async (_host, value) => {
  callbacks = value;
  return {
    reattach() {}, setModels() {}, setStatuses() {}, setMode() {}, setVerticalAxis() {},
    setSelection() {}, fitAll() { return true; }, fitSelection() { return true; },
    getStateSnapshot() { return { runtimePending: false, runtimeRevision: 1, instanceCount: 2, drawBatchCount: 1 }; },
    dispose() {},
  };
};
const clockValues = [10, 25];
const adapter = createRevisionCompareViewerAdapter({
  webglViewerFactory: factory,
  svgViewerFactory: factory,
  clock: () => clockValues.shift() ?? 25,
});
adapter.setBackend('WEBGL');
await adapter.render({}, audit());
adapter.selectDifference('difference:1');
adapter.fitSelected();
callbacks.onPick({ objectId: 'source:0' });
assert.equal(adapter.evidence().fitSelectedCount, 1);
assert.equal(adapter.evidence().pickCount, 1);

adapter.setBackend('SVG');
assert.equal(adapter.evidence().fitSelectedCount, 0);
assert.equal(adapter.evidence().lastFitSelectedMs, null);
assert.equal(adapter.evidence().pickCount, 0);
assert.equal(adapter.evidence().lastPickedObjectId, null);

adapter.setBackend('WEBGL');
assert.equal(adapter.evidence().fitSelectedCount, 0);
assert.equal(adapter.evidence().pickCount, 0);
adapter.dispose();

console.log('revision-viewer-backend-lineage: PASS');
