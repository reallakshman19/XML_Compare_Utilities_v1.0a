import assert from 'node:assert/strict';
import { createSequentialRotationRingController }
  from '../tabs/sequential-sketcher/scoped-edit/sequential-rotation-ring-controller.js';
import { SEQUENTIAL_ROTATION_TARGET_SCHEMA }
  from '../tabs/sequential-sketcher/scoped-edit/sequential-rotation-target.js';

function dataName(name) {
  return name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}
function element(name = 'div') {
  const listeners = new Map();
  const value = {
    name, attrs: new Map(), dataset: {}, children: [], style: {}, hidden: false,
    textContent: '', parent: null, removed: false,
    setAttribute(key, raw) {
      this.attrs.set(key, String(raw));
      if (key.startsWith('data-')) this.dataset[dataName(key)] = String(raw);
    },
    getAttribute(key) { return this.attrs.get(key) ?? null; },
    appendChild(child) { child.parent = this; this.children.push(child); return child; },
    append(...children) { children.forEach((child) => this.appendChild(child)); },
    remove() {
      this.removed = true;
      if (this.parent) this.parent.children = this.parent.children.filter((row) => row !== this);
    },
    addEventListener(type, callback) { listeners.set(type, callback); },
    removeEventListener(type) { listeners.delete(type); },
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
    setPointerCapture() {},
  };
  value._listeners = listeners; return value;
}
function environment() {
  const documentRef = { defaultView: {}, createElementNS(_namespace, name) { return element(name); } };
  const host = element('host'); host.ownerDocument = documentRef;
  const root = { querySelector(selector) {
    return selector === '[data-ssk-draft-edit-3d-host]' ? host : null;
  } };
  return { root, host };
}
function descendants(root) { return [root, ...root.children.flatMap(descendants)]; }
function ring(host, axis) {
  return descendants(host).find((row) => row.getAttribute('data-ssk-rotation-ring') === axis);
}
function pointerEvent(target, pointerId, x, y, type = 'pointermove') {
  return { type, target, pointerId, clientX: x, clientY: y,
    preventDefault() {}, stopImmediatePropagation() {} };
}

const target = Object.freeze({
  schema: SEQUENTIAL_ROTATION_TARGET_SCHEMA,
  rotationTargetId: 'ROTATION-TARGET-1', authorityId: 'AUTH-1',
  sceneRevision: 'SCENE-1', geometryFingerprint: 'GEOMETRY-1',
  scope: 'COMPONENT_ONLY', affectedComponentIds: ['PIPE-1'],
  geometryParts: Object.freeze([{ geometry: Object.freeze({ kind: 'segment',
    start: Object.freeze({ x: 0, y: 0, z: 0 }),
    end: Object.freeze({ x: 100, y: 0, z: 0 }) }) }]),
});
const env = environment(); const calls = [];
let currentTarget = target; let pivot = { x: 50, y: 0, z: 0 }; let axisId = 'Z'; let angle = 90;
const viewer = { projectPoint([x, y, z]) { return { x: 200 + x + z * .4, y: 150 - y - z * .4 }; } };
const controller = createSequentialRotationRingController({
  root: env.root, readViewer: () => viewer, readTarget: () => currentTarget,
  readPivot: () => pivot, readProfile: () => ({ boundaryTolerance: 1e-9 }),
  readAxisId: () => axisId, setAxis(value) { axisId = value; calls.push(['axis', value]); },
  setAngle(value) { angle = value; calls.push(['angle', value]); },
  beginDrag(input) { calls.push(['begin', input]); return { status: 'dragging' }; },
  updateDrag(input) {
    calls.push(['update', input]);
    return { preview: { transform: { angleDegrees: 45 } }, state: { status: 'dragging' } };
  },
  endDrag(pointerId) { calls.push(['end', pointerId]); return { status: 'review' }; },
  cancelDrag(reason) { calls.push(['cancel', reason]); return { status: 'cancelled' }; },
  onReview(result) { calls.push(['review', result.status]); },
  onCancel(reason) { calls.push(['cancelled-preview', reason]); },
});

assert.equal(controller.setActive(true), true);
assert.equal(controller.getState().visible, true);
assert.equal(controller.getState().overlay.ringCount, 3);
const svg = env.host.children.find((row) => row.name === 'svg');
const xRing = ring(env.host, 'X');
assert.ok(xRing);
svg._listeners.get('pointerdown')(pointerEvent(xRing, 9, 250, 150, 'pointerdown'));
assert.equal(axisId, 'X');
assert.equal(calls.find((row) => row[0] === 'begin')[1].ringStart.axisId, 'X');
svg._listeners.get('pointermove')(pointerEvent(xRing, 9, 275, 160));
assert.equal(angle, 45);
svg._listeners.get('pointerup')(pointerEvent(xRing, 9, 275, 160, 'pointerup'));
assert.ok(calls.some((row) => row[0] === 'review'));

pivot = { x: 25, y: 30, z: 5 };
assert.equal(controller.refresh(), true);
assert.equal(controller.getState().ringModelId != null, true);
svg._listeners.get('pointerdown')(pointerEvent(ring(env.host, 'Y'), 10, 220, 120, 'pointerdown'));
controller.cancel('escape');
assert.equal(calls.at(-1)[0], 'cancelled-preview');

currentTarget = null;
assert.equal(controller.refresh(), false);
assert.equal(controller.getState().visible, false);
assert.equal(controller.destroy(), true);
assert.equal(controller.destroy(), false);

console.log('Sequential rotation ring controller: ok');
