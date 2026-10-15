import assert from 'node:assert/strict';
import { createSequentialMoveManipulatorController }
  from '../tabs/sequential-sketcher/scoped-edit/sequential-move-manipulator-controller.js';
import { SEQUENTIAL_SINGLE_ENTITY_MOVE_TARGET_SCHEMA }
  from '../tabs/sequential-sketcher/scoped-edit/sequential-single-entity-move-target.js';

function dataName(name) {
  return name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}
function element(name = 'div') {
  const listeners = new Map();
  const value = {
    name, attrs: new Map(), dataset: {}, children: [], style: {}, hidden: false,
    value: '', textContent: '', parent: null, removed: false,
    captureCount: 0, releaseCount: 0, focused: false,
    setAttribute(key, raw) {
      this.attrs.set(key, String(raw));
      if (key.startsWith('data-')) this.dataset[dataName(key)] = String(raw);
      if (key === 'hidden') this.hidden = true;
    },
    removeAttribute(key) { this.attrs.delete(key); if (key === 'hidden') this.hidden = false; },
    getAttribute(key) { return this.attrs.get(key) ?? null; },
    appendChild(child) { child.parent = this; this.children.push(child); return child; },
    append(...children) { children.forEach((child) => this.appendChild(child)); },
    remove() {
      this.removed = true;
      if (this.parent) this.parent.children = this.parent.children.filter((row) => row !== this);
    },
    addEventListener(type, callback) { listeners.set(type, callback); },
    removeEventListener(type) { listeners.delete(type); },
    dispatch(type, event = {}) { listeners.get(type)?.({ target: this, ...event }); },
    closest(selector) {
      const match = selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
      let current = this;
      while (current && match) {
        const actual = current.getAttribute(match[1]);
        if (actual != null && (match[2] == null || actual === match[2])) return current;
        current = current.parent;
      }
      return null;
    },
    setPointerCapture() { this.captureCount += 1; },
    releasePointerCapture() { this.releaseCount += 1; },
    focus() { this.focused = true; },
  };
  value._listeners = listeners;
  return value;
}
function documentEnvironment() {
  const windowListeners = new Map();
  const defaultView = {
    addEventListener(type, callback) { windowListeners.set(type, callback); },
    removeEventListener(type) { windowListeners.delete(type); },
  };
  const documentRef = {
    defaultView,
    createElementNS(_namespace, name) { return element(name); },
  };
  const host = element('host'); host.ownerDocument = documentRef;
  return { host, defaultView };
}
function descendants(root) { return [root, ...root.children.flatMap(descendants)]; }
function handle(host, id) {
  return descendants(host).find((row) => (
    row.getAttribute('data-ssk-move-manipulator-handle') === id
  ));
}
function pointerEvent(target, pointerId, x, y, type = 'pointermove') {
  return {
    type, target, pointerId, clientX: x, clientY: y,
    preventDefault() {}, stopImmediatePropagation() {},
  };
}
function constraintAuthority(initial = 'XY') {
  let value = initial;
  const listeners = new Set();
  return {
    get: () => value,
    set(next, source) {
      const changed = value !== next; value = next;
      if (changed) listeners.forEach((listener) => listener(value, source));
      return value;
    },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    operator(next) { return this.set(next, 'operator'); },
  };
}

const target = Object.freeze({
  schema: SEQUENTIAL_SINGLE_ENTITY_MOVE_TARGET_SCHEMA,
  moveTargetId: 'MOVE-TARGET-1', componentId: 'PIPE-1', authorityId: 'AUTH-1',
  sceneRevision: 'SCENE-1', geometryFingerprint: 'GEOMETRY-1',
  geometryPartIds: ['PART-1'],
  geometryParts: Object.freeze([{
    geometryPartId: 'PART-1', role: 'primary',
    geometry: Object.freeze({ kind: 'segment',
      start: Object.freeze({ x: 0, y: 0, z: 0 }),
      end: Object.freeze({ x: 100, y: 0, z: 0 }) }),
  }]),
});
const environment = documentEnvironment();
const constraints = constraintAuthority();
const calls = [];
let currentTarget = null;
const viewer = {
  projectPoint([x, y, z]) {
    return { x: 200 + x, y: 150 - y + z * 0 };
  },
};
const controller = createSequentialMoveManipulatorController({
  host: environment.host, constraintApi: constraints,
  readViewer: () => viewer, readTarget: () => currentTarget,
  beginDrag(input) { calls.push(['begin', input]); return { status: 'dragging' }; },
  updateDrag(input) { calls.push(['update', input]); return { status: 'dragging' }; },
  endDrag(pointerId) { calls.push(['end', pointerId]); return { status: 'review' }; },
  cancelDrag(reason) { calls.push(['cancel', reason]); return { status: 'cancelled' }; },
  onError(error, phase) { calls.push(['error', phase, error.message]); },
});

assert.equal(controller.getState().visible, false, 'overlay must start hidden');
assert.equal(controller.setActive(true), false, 'no target means no overlay');
assert.equal(controller.getState().visible, false);
assert.equal(controller.getState().framePending, false, 'no perpetual frame loop is allowed');

currentTarget = target;
assert.equal(controller.refresh(), true);
assert.equal(controller.getState().visible, true);
assert.equal(controller.getState().overlay.handleCount, 6);
assert.deepEqual(controller.getState().overlay.viewAlignedAxes, ['Z']);
const svg = environment.host.children.find((row) => row.name === 'svg');
const xHandle = handle(environment.host, 'X');
assert.ok(xHandle);
svg._listeners.get('pointerdown')(pointerEvent(xHandle, 9, 250, 150, 'pointerdown'));
assert.equal(constraints.get(), 'X');
assert.equal(calls[0][0], 'begin');
assert.equal(calls[0][1].handleStart.handleId, 'X');
assert.equal(xHandle.captureCount, 1, 'capture occurs after successful begin');
assert.equal(controller.getState().overlay.capturedPointerId, 9);
svg._listeners.get('pointermove')(pointerEvent(xHandle, 9, 275, 150));
svg._listeners.get('pointerup')(pointerEvent(xHandle, 9, 275, 150, 'pointerup'));
assert.deepEqual(calls.slice(0, 3).map((row) => row[0]), ['begin', 'update', 'end']);
assert.equal(xHandle.releaseCount, 1);
assert.equal(controller.getState().dragging, null);

constraints.operator('YZ');
assert.equal(controller.getState().overlay.activeHandle, 'YZ');
const yzHandle = handle(environment.host, 'YZ');
svg._listeners.get('pointerdown')(pointerEvent(yzHandle, 10, 220, 120, 'pointerdown'));
currentTarget = Object.freeze({ ...target, authorityId: 'AUTH-2' });
controller.refresh();
assert.equal(calls.at(-1)[0], 'cancel');
assert.equal(calls.at(-1)[1], 'manipulator-identity-changed');
assert.equal(yzHandle.releaseCount, 1, 'authority invalidation releases capture');
assert.equal(controller.getState().dragging, null);
assert.equal(controller.getState().overlay.draggingHandle, null);

currentTarget = null;
assert.equal(controller.refresh(), false);
assert.equal(controller.getState().visible, false);
assert.equal(controller.setActive(false), false);
assert.equal(controller.getState().framePending, false);
assert.equal(controller.destroy(), true);
assert.equal(controller.destroy(), false);

console.log('Sequential move manipulator controller hardening: ok');
