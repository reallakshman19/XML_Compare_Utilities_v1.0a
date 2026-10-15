import assert from 'node:assert/strict';
import {
  REVISION_COMPARE_SVG_COARSE_PAN,
  REVISION_COMPARE_SVG_FINE_PAN,
  REVISION_COMPARE_SVG_KEYBOARD_ZOOM_FACTOR,
  REVISION_COMPARE_SVG_MAX_ZOOM,
  REVISION_COMPARE_SVG_MIN_ZOOM,
  REVISION_COMPARE_SVG_VIEWPORT_SCHEMA,
  createRevisionCompareSvgViewport,
  normalizeRevisionCompareSvgViewportKey,
  normalizeRevisionCompareSvgViewportState,
  revisionCompareSvgViewBox,
  zoomRevisionCompareSvgViewport,
} from '../tabs/revision-compare/revision-compare-svg-viewport.js';

class FakeNode {
  constructor(localName = 'g', parentNode = null) {
    this.localName = localName;
    this.parentNode = parentNode;
    this.attributes = new Map();
    this.isContentEditable = false;
  }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
}

class FakeRoot extends FakeNode {
  constructor(viewBox = '0 0 1000 500') {
    super('svg');
    this.attributes.set('viewBox', viewBox);
    this.listeners = new Map();
  }
  addEventListener(type, listener, options) {
    const capture = options === true || options?.capture === true;
    this.listeners.set(`${type}:${capture}`, listener);
  }
  removeEventListener(type, _listener, options) {
    const capture = options === true || options?.capture === true;
    this.listeners.delete(`${type}:${capture}`);
  }
  getBoundingClientRect() { return { left: 0, top: 0, width: 1000, height: 500 }; }
  setPointerCapture() {}
  releasePointerCapture() {}
  dispatch(type, event = {}) {
    const value = {
      target: this,
      currentTarget: this,
      key: undefined,
      button: 0,
      pointerId: 1,
      clientX: 500,
      clientY: 250,
      deltaY: 0,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      prevented: 0,
      stopped: 0,
      immediate: 0,
      preventDefault() { this.prevented += 1; },
      stopPropagation() { this.stopped += 1; },
      stopImmediatePropagation() { this.immediate += 1; },
      ...event,
    };
    this.listeners.get(`${type}:true`)?.(value);
    if (!value.stopped) this.listeners.get(`${type}:false`)?.(value);
    return value;
  }
}

assert.equal(REVISION_COMPARE_SVG_VIEWPORT_SCHEMA, 'RevisionCompareSvgViewport.v1');
assert.equal(REVISION_COMPARE_SVG_MIN_ZOOM, 0.25);
assert.equal(REVISION_COMPARE_SVG_MAX_ZOOM, 32);
assert.equal(REVISION_COMPARE_SVG_FINE_PAN, 0.05);
assert.equal(REVISION_COMPARE_SVG_COARSE_PAN, 0.20);
assert.equal(REVISION_COMPARE_SVG_KEYBOARD_ZOOM_FACTOR, 1.20);

const invalid = normalizeRevisionCompareSvgViewportState({
  zoom: Number.NaN,
  panX: Infinity,
  panY: -Infinity,
  minimumZoom: -1,
  maximumZoom: 0,
});
assert.equal(invalid.schema, REVISION_COMPARE_SVG_VIEWPORT_SCHEMA);
assert.equal(invalid.zoom, 1);
assert.equal(invalid.panX, 0);
assert.equal(invalid.panY, 0);
assert(invalid.minimumZoom > 0);
assert(invalid.maximumZoom >= invalid.minimumZoom);

const base = { x: 0, y: 0, width: 1000, height: 500 };
assert.deepEqual(revisionCompareSvgViewBox(base, invalid), base);
const anchored = zoomRevisionCompareSvgViewport(invalid, base, { x: 0.25, y: 0.75 }, 2);
const before = revisionCompareSvgViewBox(base, invalid);
const after = revisionCompareSvgViewBox(base, anchored);
assert.equal(before.x + (before.width * 0.25), after.x + (after.width * 0.25));
assert.equal(before.y + (before.height * 0.75), after.y + (after.height * 0.75));

assert.deepEqual(
  normalizeRevisionCompareSvgViewportKey({ key: 'ArrowLeft' }),
  { type: 'pan', x: -1, y: 0, coarse: false },
);
assert.deepEqual(
  normalizeRevisionCompareSvgViewportKey({ key: 'ArrowUp', shiftKey: true }),
  { type: 'pan', x: 0, y: -1, coarse: true },
);
assert.equal(normalizeRevisionCompareSvgViewportKey({ key: '=' }).factor, 1.2);
assert.equal(normalizeRevisionCompareSvgViewportKey({ key: '+' }).factor, 1.2);
assert.equal(normalizeRevisionCompareSvgViewportKey({ key: '-' }).factor, 1 / 1.2);
assert.equal(normalizeRevisionCompareSvgViewportKey({ key: '0' }).type, 'reset');
for (const event of [
  { key: 'Home' },
  { key: 'Enter' },
  { key: ' ' },
  { key: 'ArrowLeft', ctrlKey: true },
  { key: 'ArrowLeft', metaKey: true },
  { key: 'ArrowLeft', altKey: true },
]) {
  assert.equal(normalizeRevisionCompareSvgViewportKey(event), null);
}

const source = new FakeRoot();
const target = new FakeRoot();
const changes = [];
const controller = createRevisionCompareSvgViewport({
  onChange: (state, reason) => changes.push({ state, reason }),
});
controller.attachSurface('source', source);
controller.attachSurface('target', target);
assert.deepEqual(controller.getResourceCounts(), { surfaces: 2, listeners: 14 });
assert.equal(source.getAttribute('viewBox'), target.getAttribute('viewBox'));

let event = source.dispatch('keydown', { key: 'ArrowRight' });
assert.deepEqual([event.prevented, event.stopped, event.immediate], [1, 1, 0]);
assert.equal(controller.getState().panX, 0.05);
event = source.dispatch('keydown', { key: 'ArrowDown', shiftKey: true });
assert.deepEqual([event.prevented, event.stopped], [1, 1]);
assert.equal(controller.getState().panY, 0.20);
const centreBefore = revisionCompareSvgViewBox(base, controller.getState());
event = target.dispatch('keydown', { key: '=' });
assert.equal(controller.getState().zoom, 1.2);
const centreAfter = revisionCompareSvgViewBox(base, controller.getState());
assert.equal(centreBefore.x + (centreBefore.width / 2), centreAfter.x + (centreAfter.width / 2));
assert.equal(centreBefore.y + (centreBefore.height / 2), centreAfter.y + (centreAfter.height / 2));
assert.equal(source.getAttribute('viewBox'), target.getAttribute('viewBox'));

const zoomAwareBefore = controller.getState().panX;
source.dispatch('keydown', { key: 'ArrowRight' });
assert.equal(controller.getState().panX, zoomAwareBefore + (0.05 / 1.2));
const entity = new FakeNode('g', source);
entity.setAttribute('data-engineering-svg-entity-id', 'entity:1');
const stateBeforeEntity = controller.getState();
event = source.dispatch('keydown', { key: 'ArrowLeft', target: entity });
assert.deepEqual(controller.getState(), stateBeforeEntity);
assert.deepEqual([event.prevented, event.stopped], [0, 0]);
const input = new FakeNode('input', source);
event = source.dispatch('keydown', { key: 'ArrowLeft', target: input });
assert.deepEqual(controller.getState(), stateBeforeEntity);
assert.equal(event.prevented, 0);
const editable = new FakeNode('g', source);
editable.setAttribute('contenteditable', 'true');
event = source.dispatch('keydown', { key: 'ArrowLeft', target: editable });
assert.deepEqual(controller.getState(), stateBeforeEntity);
assert.equal(event.prevented, 0);
for (const modifier of ['ctrlKey', 'metaKey', 'altKey']) {
  event = source.dispatch('keydown', { key: 'ArrowLeft', [modifier]: true });
  assert.deepEqual(controller.getState(), stateBeforeEntity);
  assert.equal(event.prevented, 0);
}
event = source.dispatch('keydown', { key: 'PageDown' });
assert.deepEqual(controller.getState(), stateBeforeEntity);
assert.deepEqual([event.prevented, event.stopped], [0, 0]);
source.dispatch('keydown', { key: '0' });
assert.deepEqual(
  [controller.getState().zoom, controller.getState().panX, controller.getState().panY],
  [1, 0, 0],
);

source.dispatch('wheel', { clientX: 250, clientY: 375, deltaY: -400 });
const zoomed = controller.getState();
assert(zoomed.zoom > 1);
assert(zoomed.zoom <= zoomed.maximumZoom);
assert.equal(source.getAttribute('viewBox'), target.getAttribute('viewBox'));
assert.doesNotThrow(() => JSON.stringify(zoomed));

const beforePan = controller.getState();
source.dispatch('pointerdown', { clientX: 200, clientY: 200 });
source.dispatch('pointermove', { clientX: 240, clientY: 215 });
source.dispatch('pointerup', { clientX: 240, clientY: 215 });
assert.equal(source.dispatch('click').prevented, 1);
assert.notEqual(controller.getState().panX, beforePan.panX);
assert.notEqual(controller.getState().panY, beforePan.panY);
assert.equal(source.getAttribute('viewBox'), target.getAttribute('viewBox'));

controller.reset('incremental-pan-baseline');
const incrementalBefore = controller.getState();
source.dispatch('pointerdown', { clientX: 100, clientY: 100 });
for (let step = 1; step <= 6; step += 1) {
  source.dispatch('pointermove', { clientX: 100 + step, clientY: 100 });
}
source.dispatch('pointerup', { clientX: 106, clientY: 100 });
assert.equal(source.dispatch('click').prevented, 1);
assert.notEqual(
  controller.getState().panX,
  incrementalBefore.panX,
  'incremental movement must cross the cumulative drag threshold',
);

source.dispatch('pointerdown', { clientX: 300, clientY: 200 });
source.dispatch('pointermove', { clientX: 320, clientY: 200 });
source.dispatch('pointercancel', { clientX: 320, clientY: 200 });
assert.equal(
  source.dispatch('click').prevented,
  0,
  'pointer cancellation must not suppress the next unrelated click',
);

const stable = controller.getState();
source.dispatch('wheel', { deltaY: Number.NaN });
assert.deepEqual(controller.getState(), stable);
controller.setState({ zoom: 999, panX: 999, panY: -999 }, 'bounded-restore');
assert.equal(controller.getState().zoom, 32);
assert.equal(controller.getState().panX, 4);
assert.equal(controller.getState().panY, -4);
controller.reset('fit-all');
assert.equal(controller.getState().zoom, 1);
assert.equal(controller.getState().panX, 0);
assert.equal(controller.getState().panY, 0);
assert(changes.some((item) => item.reason === 'pan'));
assert(changes.some((item) => item.reason === 'zoom'));
assert(changes.some((item) => item.reason === 'fit-all'));
assert(changes.some((item) => item.reason === 'keyboard-pan'));
assert(changes.some((item) => item.reason === 'keyboard-zoom'));
assert(changes.some((item) => item.reason === 'keyboard-reset'));

assert.equal(controller.dispose(), true);
assert.deepEqual(controller.getResourceCounts(), { surfaces: 0, listeners: 0 });
assert.equal(controller.dispose(), false);
console.log('revision-compare-svg-viewport.test.mjs passed');
