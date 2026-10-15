import assert from 'node:assert/strict';
import { mountSequentialEngineeringSvgPreviewController } from '../tabs/sequential-sketcher/sequential-engineering-svg-preview-controller.js';

class FakeClassList { constructor() { this.values = new Set(); } toggle(name, enabled) { if (enabled) this.values.add(name); else this.values.delete(name); } }
class FakeElement {
  constructor(dataset = {}) { this.dataset = dataset; this.classList = new FakeClassList(); this.attrs = {}; this.hidden = false; this.disabled = false; this.children = []; this.clientWidth = 1000; this.clientHeight = 660; }
  setAttribute(k, v) { this.attrs[k] = String(v); } removeAttribute(k) { delete this.attrs[k]; }
  replaceChildren() { this.children = []; } closest() { return null; }
}
const construction = new FakeElement();
const previewHost = new FakeElement();
const constructionButton = new FakeElement({ sskRenderer: 'CONSTRUCTION_SVG' });
const previewButton = new FakeElement({ sskRenderer: 'ENGINEERING_SVG_PREVIEW' });
const status = new FakeElement();
const views = ['ISO', 'XY', 'XZ', 'YZ'].map((sskView) => new FakeElement({ sskView }));
views[0].classList.values.add('is-active');
const listeners = new Map();
const root = {
  querySelector(selector) {
    if (selector === '[data-ssk-construction-surface]') return construction;
    if (selector === '[data-ssk-engineering-svg-preview-host]') return previewHost;
    if (selector.includes('CONSTRUCTION_SVG')) return constructionButton;
    if (selector.includes('ENGINEERING_SVG_PREVIEW')) return previewButton;
    if (selector === '[data-ssk-preview-status]') return status;
    if (selector === '[data-ssk-view].is-active') return views.find((row) => row.classList.values.has('is-active'));
    return null;
  },
  querySelectorAll: () => views,
  addEventListener(type, listener) { listeners.set(type, listener); },
  removeEventListener(type) { listeners.delete(type); },
};
const ownerSnapshot = { schema: 'SequentialEngineeringSvgOwnerSnapshot.v1', session: { schema: 'SequentialConstructionSession.v1' }, revision: { schema: 'EngineeringRevisionToken.v1' }, sessionFingerprint: 'fingerprint', visibleProjection: 'ISO', constructionCandidateSelection: null };
let ownerListener;
let snapshotReads = 0;
let subscriptions = 0;
const owner = {
  getEngineeringSvgOwnerSnapshot() { snapshotReads += 1; return ownerSnapshot; },
  subscribeEngineeringSvgOwnerState(listener) { subscriptions += 1; ownerListener = listener; return () => { ownerListener = null; }; },
};
let destroyed = 0;
const preview = {
  bridge: { getLastRejectedEvent: () => null }, clearSelection() {}, destroy() { destroyed += 1; },
  getProjection: () => 'ISO', setProjection: (value) => value,
};
const controller = mountSequentialEngineeringSvgPreviewController(root, { workspace: owner, createPreviewWorkspace: async () => preview });
assert.equal(snapshotReads, 1);
assert.equal(subscriptions, 1);
assert.equal(controller.getState().renderer, 'CONSTRUCTION_SVG');
assert.equal(await controller.switchRenderer('ENGINEERING_SVG_PREVIEW'), true);
assert.equal(controller.getState().previewMounted, true);
ownerListener({ schema: 'SequentialEngineeringSvgOwnerEvent.v1', reason: 'construction-advanced', snapshot: ownerSnapshot });
assert.equal(controller.getState().refreshCount, 1);
ownerListener({ schema: 'SequentialEngineeringSvgOwnerEvent.v1', reason: 'source-reloaded', snapshot: null });
assert.equal(controller.getState().renderer, 'CONSTRUCTION_SVG');
assert.equal(destroyed, 1);
assert.equal(controller.destroy(), true);
assert.equal(controller.destroy(), false);
assert.equal(await controller.switchRenderer('ENGINEERING_SVG_PREVIEW'), false);
console.log('Sequential Engineering SVG preview controller: ok');
