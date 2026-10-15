import assert from 'node:assert/strict';
import {
  createEngineeringRevisionToken,
  createEngineeringScene,
  createEngineeringSceneEntity,
  createPointGeometry,
} from '../core/engineering-scene/index.js';
import { createRevisionCompareSvgSurfaceRuntime } from '../tabs/revision-compare/revision-compare-svg-surfaces.js';

class FakeElement {
  constructor(ownerDocument, localName) {
    this.ownerDocument = ownerDocument;
    this.localName = localName;
    this.children = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.style = {};
    this.className = '';
    this.textContent = '';
    this.clientWidth = 400;
    this.clientHeight = 300;
    this.listeners = new Map();
  }
  get firstElementChild() { return this.children[0] || null; }
  appendChild(child) {
    child.remove();
    child.parentNode = this;
    this.children.push(child);
    return child;
  }
  append(...items) { items.forEach((item) => this.appendChild(item)); }
  remove() {
    if (this.parentNode) {
      this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
      this.parentNode = null;
    }
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  removeEventListener(type) { this.listeners.delete(type); }
}

class FakeDocument {
  createElement(localName) { return new FakeElement(this, localName); }
  createElementNS(_ns, localName) { return new FakeElement(this, localName); }
  createHost() { return new FakeElement(this, 'div'); }
}

class FakeResizeObserver {
  constructor(callback) {
    this.callback = callback;
    this.observed = [];
    this.disconnected = false;
  }
  observe(target) { this.observed.push(target); }
  disconnect() { this.disconnected = true; }
  trigger() { this.callback(); }
}

function scene(id, revision, entities) {
  return createEngineeringScene({ sceneId: id, revision: createEngineeringRevisionToken(revision), entities });
}

function entity(id, side) {
  return createEngineeringSceneEntity({
    id, kind: 'point', geometry: createPointGeometry({ x: 0, y: 0, z: 0 }),
    domainRef: { owner: 'revision-compare', side },
  });
}

function sceneForSide(side) {
  if (side === 'A') return scene('rc:A', { side: 'A' }, [entity('A:1', 'A')]);
  if (side === 'B') return scene('rc:B', { side: 'B' }, [entity('B:1', 'B')]);
  return scene('rc:overlay', { overlay: true }, [entity('A:1', 'A'), entity('B:1', 'B')]);
}

function fakeWorkspaceFactory(log, options = {}) {
  return (workspaceOptions) => {
    if (options.failFor && options.failFor(workspaceOptions)) {
      throw new Error('workspace mount failed');
    }
    const documentRef = workspaceOptions.host.ownerDocument;
    const root = documentRef.createElementNS('svg', 'svg');
    root.setAttribute('viewBox', '0 0 400 300');
    workspaceOptions.host.appendChild(root);
    const selectionListeners = new Set();
    log.push('workspace:create');
    return {
      root,
      subscribeSelection(listener) {
        selectionListeners.add(listener);
        return () => selectionListeners.delete(listener);
      },
      setSelection() {},
      setViewport() { log.push('workspace:setViewport'); },
      getEntityNode() { return null; },
      destroy() { log.push('workspace:destroy'); return true; },
    };
  };
}

function entities() { return [entity('A:1', 'A'), entity('B:1', 'B')]; }

class NoopResizeObserver { observe() {} disconnect() {} }

// --- overlay mount: one surface, one ResizeObserver, correct evidence ---
{
  const documentRef = new FakeDocument();
  const host = documentRef.createHost();
  const log = [];
  let observerInstance = null;
  class CapturingResizeObserver extends FakeResizeObserver {
    constructor(callback) { super(callback); observerInstance = this; }
  }
  const runtime = createRevisionCompareSvgSurfaceRuntime({
    host, mode: 'overlay', sceneForSide, entities,
    workspaceFactory: fakeWorkspaceFactory(log),
    resizeObserverFactory: CapturingResizeObserver,
  });
  assert.equal(log.filter((item) => item === 'workspace:create').length, 1, 'overlay mount must create exactly one workspace');
  assert.equal(observerInstance.observed.length, 1, 'exactly one ResizeObserver must be attached');
  const evidence = runtime.getEvidence();
  assert.equal(evidence.roots, 1);
  assert.equal(evidence.observers, 1);
  assert.equal(evidence.selectionSubscriptions, 1);

  observerInstance.trigger();
  assert(log.includes('workspace:setViewport'), 'ResizeObserver notification must refresh the surface');

  assert.equal(runtime.dispose(), true);
  assert.equal(observerInstance.disconnected, true, 'dispose must disconnect the ResizeObserver');
  assert(log.includes('workspace:destroy'), 'dispose must destroy the workspace');
  assert.equal(runtime.dispose(), false, 'dispose must be idempotent');
}

// --- side-by-side mount: two surfaces, one shared viewport controller ---
{
  const documentRef = new FakeDocument();
  const host = documentRef.createHost();
  const log = [];
  const runtime = createRevisionCompareSvgSurfaceRuntime({
    host, mode: 'side-by-side', sceneForSide, entities,
    workspaceFactory: fakeWorkspaceFactory(log),
    resizeObserverFactory: NoopResizeObserver,
  });
  assert.equal(log.filter((item) => item === 'workspace:create').length, 2, 'side-by-side mount must create exactly two workspaces');
  const evidence = runtime.getEvidence();
  assert.equal(evidence.roots, 2);
  assert.equal(evidence.selectionSubscriptions, 2);
  assert.equal(evidence.keyboardRoots, 2, 'both panes must be keyboard-focusable roots');

  assert.equal(runtime.dispose(), true);
  assert.equal(log.filter((item) => item === 'workspace:destroy').length, 2, 'dispose must destroy every mounted workspace');
}

// --- partial mount failure: second surface fails, first must be fully disposed ---
{
  const documentRef = new FakeDocument();
  const host = documentRef.createHost();
  const log = [];
  let calls = 0;
  const factory = fakeWorkspaceFactory(log, { failFor: () => { calls += 1; return calls === 2; } });
  assert.throws(() => createRevisionCompareSvgSurfaceRuntime({
    host, mode: 'side-by-side', sceneForSide, entities,
    workspaceFactory: factory,
    resizeObserverFactory: NoopResizeObserver,
  }), /workspace mount failed/);
  assert.equal(log.filter((item) => item === 'workspace:create').length, 1, 'only the first surface should have mounted before the failure');
  assert.equal(log.filter((item) => item === 'workspace:destroy').length, 1, 'the successfully mounted surface must be disposed when the second surface fails to mount');
  assert.equal(host.children.length, 0, 'no partially-mounted DOM must remain on the host after a failed mount');
}

console.log('revision-compare-svg-surfaces.test.mjs passed');
