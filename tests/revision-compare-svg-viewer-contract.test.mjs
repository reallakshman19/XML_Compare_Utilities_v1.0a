import assert from 'node:assert/strict';
import {
  assertRevisionCompareViewer,
  REVISION_COMPARE_VIEWER_METHODS,
} from '../tabs/revision-compare/revision-compare-viewer-contract.js';
import { createRevisionCompareEngineeringSvgViewer } from '../tabs/revision-compare/revision-compare-engineering-svg-viewer.js';

class FakeClassList {
  constructor() { this.values = new Set(); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  toggle(value, force) { if (force) this.values.add(value); else this.values.delete(value); }
  contains(value) { return this.values.has(value); }
}

class FakeStyle {
  constructor() { this.values = new Map(); this.pointerEvents = ''; this.opacity = ''; }
  setProperty(name, value) { this.values.set(name, String(value)); }
}

class FakeElement {
  constructor(ownerDocument, localName) {
    this.ownerDocument = ownerDocument;
    this.localName = localName;
    this.children = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.listeners = new Map();
    this.classList = new FakeClassList();
    this.style = new FakeStyle();
    this.clientWidth = 800;
    this.clientHeight = 500;
    this.textContent = '';
    this.className = '';
  }
  get firstElementChild() { return this.children[0] ?? null; }
  get parentElement() { return this.parentNode; }
  appendChild(child) { child.remove(); child.parentNode = this; this.children.push(child); return child; }
  append(...children) { children.forEach((child) => this.appendChild(child)); }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((item) => item !== this);
    this.parentNode = null;
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  addEventListener(type, listener, options) {
    const capture = options === true || options?.capture === true;
    const key = `${type}:${capture}`;
    if (!this.listeners.has(key)) this.listeners.set(key, new Set());
    this.listeners.get(key).add(listener);
  }
  removeEventListener(type, listener, options) {
    const capture = options === true || options?.capture === true;
    this.listeners.get(`${type}:${capture}`)?.delete(listener);
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight };
  }
  setPointerCapture() {}
  releasePointerCapture() {}
  dispatch(type, input = {}) {
    const event = {
      target: input.target ?? this,
      currentTarget: this,
      key: input.key,
      button: input.button ?? 0,
      pointerId: input.pointerId ?? 1,
      clientX: input.clientX ?? 400,
      clientY: input.clientY ?? 250,
      deltaY: input.deltaY ?? 0,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      preventDefault() {},
      stopPropagation() {},
      stopImmediatePropagation() {},
      ...input,
    };
    this.listeners.get(`${type}:true`)?.forEach((listener) => listener(event));
    this.listeners.get(`${type}:false`)?.forEach((listener) => listener(event));
  }
}

class FakeDocument {
  createElementNS(_namespace, name) { return new FakeElement(this, name); }
  createElement(name) { return new FakeElement(this, name); }
  createHost() { return new FakeElement(this, 'div'); }
}

function descendants(root) {
  return root.children.flatMap((child) => [child, ...descendants(child)]);
}

function byAttribute(root, name, value = null) {
  return descendants(root).filter((node) => node.getAttribute(name) != null
    && (value == null || node.getAttribute(name) === value));
}

function entityNode(root, id) {
  return byAttribute(root, 'data-engineering-svg-entity-id', id)[0] ?? null;
}

function largeModel(side, count) {
  return {
    modelId: `large-model:${side}`,
    revisionId: `large-revision:${side}`,
    unit: 'mm',
    coordinateFrame: 'PLANT',
    verticalAxis: 'Z',
    markers: [],
    segments: Array.from({ length: count }, (_, index) => ({
      objectId: `${side}:large:${index}`,
      start: [index, side === 'A' ? 0 : 1, 0],
      end: [index + 1, side === 'A' ? 0 : 1, 0],
    })),
  };
}

function persistent(value) {
  return {
    schema: value.schema,
    zoom: value.zoom,
    panX: value.panX,
    panY: value.panY,
    minimumZoom: value.minimumZoom,
    maximumZoom: value.maximumZoom,
  };
}

const documentRef = new FakeDocument();
const host = documentRef.createHost();
let pick = null;
const viewer = await createRevisionCompareEngineeringSvgViewer(host, {
  onPick: (value) => { pick = value; },
});
assertRevisionCompareViewer(viewer);
assert(REVISION_COMPARE_VIEWER_METHODS.every((method) => typeof viewer[method] === 'function'));
viewer.setStatuses(new Map([
  ['source:1', 'AMBIGUOUS'],
  ['source:marker', 'MISSING_IN_TARGET'],
  ['target:1', 'NEW_IN_TARGET'],
]));
viewer.setModels({
  source: {
    modelId: 'source',
    revisionId: 'r1',
    unit: 'mm',
    coordinateFrame: 'PLANT',
    verticalAxis: 'Z',
    segments: [{ objectId: 'source:1', start: [0, 0, 0], end: [5, 0, 0] }],
    markers: [{ objectId: 'source:marker', position: [2.5, 0, 0] }],
  },
  target: {
    modelId: 'target',
    revisionId: 'r2',
    unit: 'mm',
    coordinateFrame: 'PLANT',
    verticalAxis: 'Z',
    segments: [{ objectId: 'target:1', start: [0, 1, 0], end: [5, 1, 0] }],
    markers: [],
  },
});
assert.equal(byAttribute(host, 'data-revc-svg-overlay-root').length, 1);
assert.equal(byAttribute(host, 'data-revc-svg-pane-root').length, 0);
let resources = viewer.getStateSnapshot().resources;
assert.equal(resources.roots, 1);
assert.equal(resources.viewportListeners, 7);
assert.equal(byAttribute(host, 'data-revc-svg-keyboard-surface').length, 1);
assert.equal(byAttribute(host, 'data-revc-svg-keyboard-instructions').length, 1);

const overlayRoot = byAttribute(host, 'data-revc-svg-overlay-root')[0];
assert.equal(overlayRoot.getAttribute('role'), 'group');
assert.equal(overlayRoot.getAttribute('tabindex'), '0');
assert.equal(overlayRoot.getAttribute('aria-label'), 'Revision comparison Engineering SVG overlay');
assert.match(overlayRoot.getAttribute('aria-keyshortcuts'), /Shift\+ArrowRight/);
const sourceSegment = entityNode(host, 'source:1');
assert.equal(sourceSegment.getAttribute('role'), 'button');
assert.equal(sourceSegment.getAttribute('tabindex'), '0');
assert.match(sourceSegment.getAttribute('aria-label'), /status: Ambiguous/);
overlayRoot.dispatch('keydown', { target: sourceSegment, key: 'Enter' });
assert.deepEqual(pick, { objectId: 'source:1' });
pick = null;
overlayRoot.dispatch('keydown', { target: sourceSegment, key: ' ' });
assert.deepEqual(pick, { objectId: 'source:1' });

viewer.setSelection('source:marker');
const markerBefore = viewer.getStateSnapshot().fitCounts.selection;
assert.equal(viewer.fitSelection(), true);
assert.equal(viewer.getStateSnapshot().fitCounts.selection, markerBefore + 1);
assert.equal(viewer.getStateSnapshot().fitHistory.overlay.entityIds[0], 'source:marker');

viewer.setSelection('missing:geometry');
const noGeometryBefore = viewer.getStateSnapshot();
assert.equal(viewer.fitSelection(), false);
const noGeometryAfter = viewer.getStateSnapshot();
assert.equal(noGeometryAfter.fitCounts.noGeometry, noGeometryBefore.fitCounts.noGeometry + 1);
assert.deepEqual(noGeometryAfter.viewportHistory.overlay, noGeometryBefore.viewportHistory.overlay);

overlayRoot.dispatch('keydown', { key: 'ArrowRight' });
overlayRoot.dispatch('keydown', { key: '=' });
const overlayHistory = persistent(viewer.getStateSnapshot().viewportHistory.overlay);
assert(overlayHistory.panX > 0);
assert(overlayHistory.zoom > 1);

viewer.setSelection('source:1', ['target:1']);
viewer.setMode('side-by-side');
assert.equal(byAttribute(host, 'data-revc-svg-overlay-root').length, 0);
assert.equal(byAttribute(host, 'data-revc-svg-pane-root').length, 2);
resources = viewer.getStateSnapshot().resources;
assert.equal(resources.roots, 2);
assert.equal(resources.viewportListeners, 14);
assert.equal(byAttribute(host, 'data-revc-svg-keyboard-surface').length, 2);
assert.equal(byAttribute(host, 'data-revc-svg-keyboard-instructions').length, 2);
assert.equal(viewer.getStateSnapshot().visibleEntityCounts.source, 2);
assert.equal(viewer.getStateSnapshot().visibleEntityCounts.target, 1);
assert.equal(byAttribute(host, 'data-revc-hidden-fit-authority').length, 3);
assert.equal(
  byAttribute(host, 'data-revc-hidden-fit-authority').some((node) => node.classList.contains('is-selected')),
  false,
);
assert(byAttribute(host, 'data-revc-hidden-fit-authority').every((node) => (
  node.getAttribute('aria-hidden') === 'true'
  && node.getAttribute('tabindex') === '-1'
  && node.getAttribute('focusable') === 'false'
)));
const roots = byAttribute(host, 'data-revc-svg-pane-root');
assert.equal(roots[0].getAttribute('aria-label'), 'Revision comparison Rev A source Engineering SVG pane');
assert.equal(roots[1].getAttribute('aria-label'), 'Revision comparison Rev B target Engineering SVG pane');
assert.equal(roots[0].getAttribute('viewBox'), roots[1].getAttribute('viewBox'));
roots[0].dispatch('keydown', { key: 'ArrowDown', shiftKey: true });
roots[1].dispatch('keydown', { key: '+' });
assert.equal(roots[0].getAttribute('viewBox'), roots[1].getAttribute('viewBox'));
assert(viewer.getStateSnapshot().viewportHistory['side-by-side'].panY > 0);
assert(viewer.getStateSnapshot().viewportHistory['side-by-side'].zoom > 1);
assert.deepEqual(persistent(viewer.getStateSnapshot().viewportHistory.overlay), overlayHistory);
roots[0].dispatch('keydown', { key: '0' });
assert.equal(viewer.getStateSnapshot().viewportHistory['side-by-side'].zoom, 1);
assert.equal(viewer.getStateSnapshot().viewportHistory['side-by-side'].panX, 0);
assert.equal(viewer.getStateSnapshot().viewportHistory['side-by-side'].panY, 0);
assert.deepEqual(persistent(viewer.getStateSnapshot().viewportHistory.overlay), overlayHistory);

roots[0].dispatch('wheel', { clientX: 250, clientY: 300, deltaY: -400 });
assert(viewer.getStateSnapshot().viewportHistory['side-by-side'].zoom > 1);
assert.equal(roots[0].getAttribute('viewBox'), roots[1].getAttribute('viewBox'));
roots[0].dispatch('pointerdown', { clientX: 200, clientY: 200 });
roots[0].dispatch('pointermove', { clientX: 250, clientY: 225 });
roots[0].dispatch('pointerup', { clientX: 250, clientY: 225 });
assert.notEqual(viewer.getStateSnapshot().viewportHistory['side-by-side'].panX, 0);

const sideSourceNode = entityNode(host, 'source:1');
roots[0].dispatch('click', { target: sideSourceNode });
assert.deepEqual(pick, { objectId: 'source:1' });
const sideTransform = viewer.getStateSnapshot().viewportHistory['side-by-side'];
viewer.setMode('overlay');
assert.equal(byAttribute(host, 'data-revc-svg-overlay-root').length, 1);
viewer.setMode('side-by-side');
assert.deepEqual(viewer.getStateSnapshot().viewportHistory['side-by-side'], sideTransform);

const snapshot = structuredClone(viewer.getStateSnapshot());
const hostB = documentRef.createHost();
viewer.reattach(hostB);
assert.equal(byAttribute(host, 'data-engineering-svg-root').length, 0);
assert.equal(byAttribute(hostB, 'data-revc-svg-pane-root').length, 2);
assert.deepEqual(viewer.getStateSnapshot().viewportHistory['side-by-side'], snapshot.viewportHistory['side-by-side']);
assert.doesNotThrow(() => JSON.stringify(viewer.getStateSnapshot()));
assert.equal(viewer.dispose(), true);
assert.equal(viewer.dispose(), false);
assert.equal(byAttribute(hostB, 'data-engineering-svg-root').length, 0);
assert.equal(byAttribute(hostB, 'data-revc-svg-keyboard-instructions').length, 0);

const largeHost = documentRef.createHost();
const largeViewer = await createRevisionCompareEngineeringSvgViewer(largeHost);
largeViewer.setModels({ source: largeModel('A', 2500), target: largeModel('B', 2500) });
let largeSnapshot = largeViewer.getStateSnapshot();
assert.equal(largeSnapshot.entityCount, 5000);
assert.equal(largeSnapshot.resources.roots, 1);
assert.equal(largeSnapshot.resources.viewportListeners, 7);
assert.equal(byAttribute(largeHost, 'data-revc-svg-keyboard-surface').length, 1);
assert.equal(byAttribute(largeHost, 'data-revc-svg-keyboard-instructions').length, 1);
assert.equal(largeSnapshot.visibleEntityCounts.overlay, 5000);
assert.equal(largeSnapshot.hiddenFitAuthorityCounts.overlay, 0);
assert.equal(byAttribute(largeHost, 'data-engineering-svg-entity-id').length, 5000);
largeViewer.setMode('side-by-side');
largeSnapshot = largeViewer.getStateSnapshot();
assert.equal(largeSnapshot.resources.roots, 2);
assert.equal(largeSnapshot.resources.viewportListeners, 14);
assert.equal(byAttribute(largeHost, 'data-revc-svg-keyboard-surface').length, 2);
assert.equal(byAttribute(largeHost, 'data-revc-svg-keyboard-instructions').length, 2);
assert.equal(largeSnapshot.visibleEntityCounts.source, 2500);
assert.equal(largeSnapshot.visibleEntityCounts.target, 2500);
assert.equal(largeSnapshot.hiddenFitAuthorityCounts.source, 2500);
assert.equal(largeSnapshot.hiddenFitAuthorityCounts.target, 2500);
assert.equal(byAttribute(largeHost, 'data-engineering-svg-entity-id').length, 10000);
assert.equal(byAttribute(largeHost, 'data-revc-hidden-fit-authority').length, 5000);
assert.equal(largeViewer.dispose(), true);
assert.equal(byAttribute(largeHost, 'data-engineering-svg-root').length, 0);
assert.equal(byAttribute(largeHost, 'data-revc-svg-keyboard-instructions').length, 0);
console.log('revision-compare-svg-viewer-contract.test.mjs passed');
