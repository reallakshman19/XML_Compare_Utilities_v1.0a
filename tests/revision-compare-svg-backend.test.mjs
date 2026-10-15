import assert from 'node:assert/strict';
import { createRevisionCompareViewerAdapter } from '../tabs/revision-compare/revision-compare-viewer-adapter.js';
import { createComparisonLifecycleState, setComparisonViewerBackend } from '../tabs/revision-compare/revision-compare-lifecycle.js';
import {
  REVISION_COMPARE_DEFAULT_VIEWER_POLICY,
  REVISION_COMPARE_VIEWER_POLICY_SCHEMA,
  createRevisionCompareViewerPolicy,
} from '../tabs/revision-compare/revision-compare-viewer-policy.js';

function fakeFactory(name, log, options = {}) {
  return async (_host, callbacks) => {
    log.push(`${name}:request`);
    if (options.failMount) throw new Error(`${name} unavailable`);
    options.captureCallbacks?.push(callbacks);
    const state = { selected: [], mode: callbacks.initialSnapshot?.mode ?? null };
    log.push(`${name}:mount`);
    log.push(`${name}:initial:${state.mode ?? 'none'}`);
    return {
      setModels: () => log.push(`${name}:models`),
      setStatuses: () => log.push(`${name}:statuses`),
      setMode: (mode) => {
        if (options.failMode === mode) throw new Error(`${name} ${mode} unavailable`);
        state.mode = mode; log.push(`${name}:mode:${mode}`);
      },
      setSelection: (primary, related) => { state.selected = [primary, ...related].filter(Boolean); },
      setVerticalAxis: () => {},
      fitAll: () => log.push(`${name}:fitAll`),
      fitSelection: () => log.push(`${name}:fitSelection`),
      reattach: () => log.push(`${name}:reattach`),
      getStateSnapshot: () => ({ schema: `${name}.snapshot`, selectedIds: state.selected, mode: state.mode }),
      dispose: () => log.push(`${name}:dispose`),
    };
  };
}

const audit = {
  visualModels: {
    revA: { modelId: 'A', verticalAxis: 'Z', segments: [], markers: [] },
    revB: { modelId: 'B', verticalAxis: 'Z', segments: [], markers: [] },
    statusByObjectId: { A1: 'AMBIGUOUS', B1: 'NEW_IN_TARGET' },
  },
  differenceRows: [
    { differenceId: 'D1', visualRefs: { sourceObjectId: 'A1', targetObjectId: null } },
    { differenceId: 'D2', visualRefs: { sourceObjectId: null, targetObjectId: 'B1' } },
  ],
};

assert.equal(REVISION_COMPARE_DEFAULT_VIEWER_POLICY.schema, REVISION_COMPARE_VIEWER_POLICY_SCHEMA);
assert.deepEqual(REVISION_COMPARE_DEFAULT_VIEWER_POLICY, {
  schema: 'RevisionCompareViewerPolicy.v1',
  defaultBackend: 'SVG',
  defaultSvgPresentation: 'overlay',
  retainedBackends: ['SVG', 'WEBGL'],
  recoveryBackendForSvgFailure: 'WEBGL',
  recoveryBackendForWebglFailure: 'SVG',
  failoverMode: 'EXPLICIT_USER_ACTION',
  persistence: 'WORKSPACE_ONLY',
});
assert(Object.isFrozen(REVISION_COMPARE_DEFAULT_VIEWER_POLICY));
assert(Object.isFrozen(REVISION_COMPARE_DEFAULT_VIEWER_POLICY.retainedBackends));
assert.deepEqual(JSON.parse(JSON.stringify(REVISION_COMPARE_DEFAULT_VIEWER_POLICY)), REVISION_COMPARE_DEFAULT_VIEWER_POLICY);
assert.throws(() => createRevisionCompareViewerPolicy({ failoverMode: 'AUTOMATIC' }), /EXPLICIT_USER_ACTION/);
assert.throws(
  () => createRevisionCompareViewerPolicy({ retainedBackends: ['WEBGL', 'SVG'] }),
  /canonical order/,
);

const initial = createComparisonLifecycleState();
assert.equal(initial.viewerBackend, 'SVG');
assert.equal(initial.presentationMode, 'overlay');
assert.deepEqual(initial.viewerPolicy, REVISION_COMPARE_DEFAULT_VIEWER_POLICY);
const auditIdentity = { auditId: 'audit:1' };
const reviewIdentity = { reviewSessionId: 'review:1' };
const decisionIdentity = { decisionLedgerId: 'decision:1' };
const state = Object.freeze({ ...initial, auditIdentity, reviewIdentity, decisionIdentity });
const switchedState = setComparisonViewerBackend(state, 'WEBGL');
assert.equal(switchedState.viewerBackend, 'WEBGL');
assert.equal(switchedState.auditIdentity, auditIdentity);
assert.equal(switchedState.reviewIdentity, reviewIdentity);
assert.equal(switchedState.decisionIdentity, decisionIdentity);

const log = [];
const adapter = createRevisionCompareViewerAdapter({
  webglViewerFactory: fakeFactory('WEBGL', log),
  svgViewerFactory: fakeFactory('SVG', log),
});
assert.equal(adapter.evidence().viewerBackend, 'SVG');
assert.equal(adapter.evidence().presentationMode, 'overlay');
await adapter.render({}, audit);
assert.deepEqual(adapter.evidence().mountRequests, ['SVG']);
assert.equal(log.some((item) => item.startsWith('WEBGL:')), false, 'initial SVG mount must create no WebGL runtime');
adapter.setPresentationMode('side-by-side');
adapter.selectDifference('D1');
assert.equal(adapter.evidence().activeBackend, 'SVG');
adapter.setBackend('WEBGL');
await adapter.render({}, audit);
assert(log.includes('SVG:dispose'));
assert(log.includes('WEBGL:mode:side-by-side'));
assert.equal(adapter.evidence().activeBackend, 'WEBGL');
assert.deepEqual(
  adapter.evidence().viewer.selectedIds, ['A1'],
  'selected difference must be reapplied to the newly mounted backend, not lost on switch',
);
adapter.setPresentationMode('overlay');
adapter.setBackend('SVG');
await adapter.render({}, audit);
assert(log.includes('SVG:initial:side-by-side'), 'SVG snapshot must remain independent from WebGL');
assert.equal(adapter.evidence().viewer.mode, 'overlay');
assert.equal(adapter.evidence().snapshots.SVG.mode, 'side-by-side');
assert.equal(adapter.evidence().snapshots.WEBGL.mode, 'overlay');
const exposedEvidence = adapter.evidence();
assert(Object.isFrozen(exposedEvidence.snapshots));
assert(Object.isFrozen(exposedEvidence.snapshots.SVG));
assert(Object.isFrozen(exposedEvidence.viewer));
assert.throws(() => { exposedEvidence.snapshots.SVG.mode = 'tampered'; }, TypeError);
assert.equal(adapter.evidence().snapshots.SVG.mode, 'side-by-side');

const svgFailureLog = [];
const svgFailure = createRevisionCompareViewerAdapter({
  webglViewerFactory: fakeFactory('WEBGL-F', svgFailureLog),
  svgViewerFactory: fakeFactory('SVG-F', svgFailureLog, { failMount: true }),
});
assert.equal(await svgFailure.render({}, audit), false);
assert.deepEqual(svgFailure.evidence().mountRequests, ['SVG']);
assert.equal(svgFailure.evidence().activeBackend, null);
assert.equal(svgFailureLog.some((item) => item.startsWith('WEBGL-F:')), false, 'SVG failure must not mount WebGL silently');
svgFailure.setBackend('WEBGL');
assert.equal(await svgFailure.render({}, audit), true);
assert.equal(svgFailure.evidence().activeBackend, 'WEBGL');

const webglFailureLog = [];
const webglFailure = createRevisionCompareViewerAdapter({
  webglViewerFactory: fakeFactory('WEBGL-G', webglFailureLog, { failMount: true }),
  svgViewerFactory: fakeFactory('SVG-G', webglFailureLog),
});
await webglFailure.render({}, audit);
webglFailure.setBackend('WEBGL');
assert.equal(await webglFailure.render({}, audit), false);
assert.deepEqual(webglFailure.evidence().mountRequests, ['SVG', 'WEBGL']);
assert.equal(webglFailure.evidence().activeBackend, null);
assert.equal(webglFailureLog.filter((item) => item === 'SVG-G:request').length, 1, 'WebGL failure must not remount SVG silently');
webglFailure.setBackend('SVG');
assert.equal(await webglFailure.render({}, audit), true);
assert.equal(webglFailure.evidence().activeBackend, 'SVG');

const staleLog = [];
const staleCallbacks = [];
const stalePicks = [];
const staleAdapter = createRevisionCompareViewerAdapter({
  onPick: (differenceId) => stalePicks.push(differenceId),
  webglViewerFactory: fakeFactory('WEBGL-S', staleLog),
  svgViewerFactory: fakeFactory('SVG-S', staleLog, { captureCallbacks: staleCallbacks }),
});
await staleAdapter.render({}, audit);
assert.equal(staleCallbacks.length, 1);
staleAdapter.setBackend('WEBGL');
await staleAdapter.render({}, audit);
staleCallbacks[0].onPick({ objectId: 'A1' });
staleCallbacks[0].onRuntimeError(new Error('stale SVG runtime error'));
assert.deepEqual(stalePicks, []);
assert.equal(staleAdapter.evidence().failed, false);
assert.equal(staleAdapter.evidence().activeBackend, 'WEBGL');

const injected = createRevisionCompareViewerPolicy({ defaultBackend: 'WEBGL', defaultSvgPresentation: 'side-by-side' });
assert.equal(createComparisonLifecycleState(injected).viewerBackend, 'WEBGL');
const injectedLog = [];
const injectedAdapter = createRevisionCompareViewerAdapter({
  viewerPolicy: injected,
  webglViewerFactory: fakeFactory('WEBGL-I', injectedLog),
  svgViewerFactory: fakeFactory('SVG-I', injectedLog),
});
await injectedAdapter.render({}, audit);
assert.deepEqual(injectedAdapter.evidence().mountRequests, ['WEBGL']);
assert.equal(injectedAdapter.evidence().presentationMode, 'side-by-side');

adapter.dispose();
svgFailure.dispose();
webglFailure.dispose();
staleAdapter.dispose();
injectedAdapter.dispose();
console.log('revision-compare-svg-backend.test.mjs passed');