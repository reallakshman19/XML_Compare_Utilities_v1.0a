import assert from 'node:assert/strict';
import {
  ENGINEERING_VIEWER_LIFECYCLE_METHODS,
  assertEngineeringViewerBackend,
  createEngineeringViewerController,
  createEngineeringViewerFactory,
} from '../core/engineering-viewer/index.js';

function viewerFactory(name, log, callbacksByName, options) {
  return async (host, callbacks) => {
    log.push(`${name}:mount:${host.id}`);
    callbacksByName[name] = callbacks;
    if (options.failMount === true) throw new Error(`${name} unavailable`);
    const state = {
      mode: callbacks.initialSnapshot?.mode ?? null,
      selectedIds: callbacks.initialSnapshot?.selectedIds ?? [],
      presentationId: null,
    };
    return {
      apply(presentation) {
        state.presentationId = presentation.id;
        state.mode = presentation.mode;
        log.push(`${name}:apply:${presentation.id}`);
      },
      setSelection(primaryId, relatedIds) {
        state.selectedIds = [primaryId, ...relatedIds].filter(Boolean);
      },
      fitAll: () => `${name}:fit-all`,
      fitSelection: () => `${name}:fit-selection`,
      reattach(nextHost) { log.push(`${name}:reattach:${nextHost.id}`); },
      getStateSnapshot: () => (
        options.invalidSnapshot === true ? { name, invalid: undefined } : { name, ...state }
      ),
      dispose() { log.push(`${name}:dispose`); return true; },
    };
  };
}

function controllerEnvironment(options) {
  const log = [];
  const callbacks = {};
  const picks = [];
  const errors = [];
  const factories = Object.fromEntries(options.backends.map((name) => [
    name,
    viewerFactory(name, log, callbacks, {
      failMount: options.failBackend === name,
      invalidSnapshot: options.invalidSnapshotBackend === name,
    }),
  ]));
  const controller = createEngineeringViewerController({
    backendIds: options.backends,
    initialBackend: options.initialBackend,
    factories,
    applyPresentation: (viewer, presentation) => viewer.apply(presentation),
    onPick: (pick) => picks.push(pick),
    onError: (error) => errors.push(error.message),
  });
  return { controller, log, callbacks, picks, errors };
}

const lifecycleViewer = {
  setSelection() {}, fitAll() {}, fitSelection() {}, reattach() {},
  getStateSnapshot() { return {}; }, dispose() {},
};
assert.equal(assertEngineeringViewerBackend(lifecycleViewer, {
  label: 'Lifecycle fixture',
  requiredMethods: ENGINEERING_VIEWER_LIFECYCLE_METHODS,
}), lifecycleViewer);
assert.throws(() => assertEngineeringViewerBackend({}, {
  label: 'Incomplete fixture',
  requiredMethods: ENGINEERING_VIEWER_LIFECYCLE_METHODS,
}), /setSelection.*fitAll.*dispose/);
assert.throws(() => createEngineeringViewerFactory(null, {
  label: 'Invalid fixture',
  requiredMethods: ENGINEERING_VIEWER_LIFECYCLE_METHODS,
}), /factory must be a function/);

const environment = controllerEnvironment({
  backends: ['SVG', 'WEBGL'],
  initialBackend: 'SVG',
  failBackend: null,
});
const hostA = { id: 'host-a' };
const hostB = { id: 'host-b' };
assert.equal(await environment.controller.render(hostA, { id: 'p1', mode: 'overlay' }), true);
assert.deepEqual(environment.controller.evidence().mountRequests, ['SVG']);
assert.equal(environment.controller.setSelection('source:1', ['target:1']), true);
assert.equal(environment.controller.fitAll(), 'SVG:fit-all');
assert.equal(environment.controller.fitSelection(), 'SVG:fit-selection');

assert.equal(environment.controller.setBackend('WEBGL'), true);
assert(environment.log.includes('SVG:dispose'));
assert.equal(await environment.controller.render(hostA, { id: 'p2', mode: 'side-by-side' }), true);
let current = environment.controller.evidence();
assert.equal(current.activeBackend, 'WEBGL');
assert.deepEqual(current.viewer.selectedIds, ['source:1', 'target:1']);
assert.equal(current.snapshots.SVG.mode, 'overlay');

assert.equal(environment.controller.setBackend('SVG'), true);
assert.equal(await environment.controller.render(hostA, { id: 'p3', mode: 'overlay' }), true);
current = environment.controller.evidence();
assert.deepEqual(current.mountRequests, ['SVG', 'WEBGL', 'SVG']);
assert.deepEqual(current.viewer.selectedIds, ['source:1', 'target:1']);
assert.equal(current.snapshots.WEBGL.mode, 'side-by-side');
assert.equal(environment.callbacks.SVG.initialSnapshot.mode, 'overlay');

const mountsBeforeReattach = current.mountRequests.length;
assert.equal(await environment.controller.render(hostB, { id: 'p4', mode: 'overlay' }), true);
assert.equal(environment.controller.evidence().mountRequests.length, mountsBeforeReattach);
assert(environment.log.includes('SVG:reattach:host-b'));

environment.controller.setBackend('WEBGL');
await environment.controller.render(hostB, { id: 'p5', mode: 'overlay' });
environment.callbacks.SVG.onPick({ objectId: 'stale' });
environment.callbacks.SVG.onRuntimeError(new Error('stale failure'));
assert.deepEqual(environment.picks, []);
assert.equal(environment.controller.evidence().failed, false);
environment.callbacks.WEBGL.onPick({ objectId: 'live' });
assert.deepEqual(environment.picks, [{ objectId: 'live' }]);

const exposed = environment.controller.evidence();
assert(Object.isFrozen(exposed));
assert(Object.isFrozen(exposed.snapshots));
assert(Object.isFrozen(exposed.selection.relatedIds));
assert.throws(() => { exposed.snapshots.SVG.mode = 'changed'; }, TypeError);
assert.equal(environment.controller.dispose(), true);
assert.equal(environment.controller.dispose(), false);
assert.equal(environment.controller.evidence().mounted, false);

const failure = controllerEnvironment({
  backends: ['SVG', 'WEBGL'],
  initialBackend: 'SVG',
  failBackend: 'WEBGL',
});
assert.equal(await failure.controller.render(hostA, { id: 'failure-a', mode: 'overlay' }), true);
failure.controller.setBackend('WEBGL');
assert.equal(await failure.controller.render(hostA, { id: 'failure-b', mode: 'overlay' }), false);
assert.deepEqual(failure.controller.evidence().mountRequests, ['SVG', 'WEBGL']);
assert.equal(failure.controller.evidence().activeBackend, null);
assert.equal(failure.controller.evidence().failed, true);
assert.match(failure.controller.evidence().error, /WEBGL unavailable/);
assert.deepEqual(failure.errors, ['WEBGL unavailable']);
failure.controller.dispose();

const invalidSnapshot = controllerEnvironment({
  backends: ['SVG'],
  initialBackend: 'SVG',
  failBackend: null,
  invalidSnapshotBackend: 'SVG',
});
assert.equal(await invalidSnapshot.controller.render(hostA, { id: 'invalid', mode: 'overlay' }), true);
const invalidEvidence = invalidSnapshot.controller.evidence();
assert.equal(invalidEvidence.failed, true);
assert.equal(invalidEvidence.viewer, null);
assert.match(invalidEvidence.error, /invalid snapshot.*unsupported type "undefined"/);
invalidSnapshot.controller.dispose();

console.log('engineering viewer controller [SIMULATED]: ok');
