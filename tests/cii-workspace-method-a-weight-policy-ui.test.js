import assert from 'node:assert/strict';
import { _test as ui } from '../tabs/cii-workspace/cii-workspace-multisource-review-only-filter-shell.js';
import {
  getCiiMultiSourceMethodAConfidenceOptions, setCiiMultiSourceMethodAConfidenceWeights,
} from '../tabs/cii-workspace/cii-workspace-source-set.js';
import { CII_METHOD_A_WEIGHT_KEYS, CII_METHOD_A_WEIGHT_DEFAULTS } from '../tabs/cii-workspace/cii-workspace-method-a-weights.js';

function fakeControl() {
  const events = new Map(); const attributes = new Map();
  return {
    value: '', events, attributes,
    setAttribute(key, value) { attributes.set(key, value); },
    addEventListener(name, callback) { events.set(name, callback); },
    removeEventListener(name, callback) { if (events.get(name) === callback) events.delete(name); },
    input() { events.get('input')?.(); },
    click() { events.get('click')?.(); },
  };
}
const controls = Object.fromEntries(CII_METHOD_A_WEIGHT_KEYS.map((key) => [key, fakeControl()]));
const apply = fakeControl(); const reset = fakeControl();
const total = { textContent: '' }, status = { textContent: '' };
const wrapper = {
  className: '', attributes: new Map(), innerHTML: '', removed: false,
  setAttribute(key, value) { this.attributes.set(key, value); },
  querySelector(selector) {
    if (selector === '[data-ciiw-method-a-apply-weights]') return apply;
    if (selector === '[data-ciiw-method-a-reset-weights]') return reset;
    if (selector === '[data-ciiw-method-a-weight-total]') return total;
    if (selector === '[data-ciiw-method-a-weight-status]') return status;
    const match = selector.match(/^\[data-ciiw-method-a-weight-(.*?)\]$/);
    return match ? controls[match[1]] || null : null;
  },
  remove() { this.removed = true; },
};
const inserted = [];
const inspect = { parentNode: { insertBefore(el) { inserted.push(el); } } };
const events = [];
const doc = {
  createElement(tag) { assert.equal(tag, 'div'); return wrapper; },
  defaultView: { CustomEvent: class {
    constructor(type, opts) { this.type = type; this.detail = opts.detail; }
  } },
};
const container = {
  ownerDocument: doc,
  querySelector(selector) { return selector === '[data-ciiw-inspect]' ? inspect : null; },
  dispatchEvent(evt) { events.push(evt); },
};
const original = getCiiMultiSourceMethodAConfidenceOptions().methodAConfidenceWeights;
let dispose;
try {
  dispose = ui.mountMethodAWeightControls(container);
  assert.deepEqual(inserted, [wrapper]);
  assert.match(wrapper.innerHTML, /Advanced: Method A score weights/);
  for (const key of CII_METHOD_A_WEIGHT_KEYS) {
    assert.equal(controls[key].value, String(original[key]));
  }
  controls.residualQuality.value = '40';
  controls.residualQuality.input();
  assert.match(total.textContent, /105\/100/);
  assert.equal(events.length, 0, 'draft editing must not invalidate previous results');
  apply.click();
  assert.equal(events.length, 0, 'invalid sum cannot modify effective weights');
  assert.match(status.textContent, /METHOD_A_CONFIDENCE_WEIGHTS_INVALID/);
  assert.equal(controls.residualQuality.attributes.get('aria-invalid'), 'true');
  assert.deepEqual(getCiiMultiSourceMethodAConfidenceOptions().methodAConfidenceWeights, original);
  controls.conditioning.value = '20';
  apply.click();
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'ciiw-method-a-confidence-changed');
  assert.deepEqual(events[0].detail.weights, { ...original, residualQuality: 40, conditioning: 20 });
  assert.match(status.textContent, /scope invalidated/);
  assert.equal(controls.residualQuality.attributes.get('aria-invalid'), 'false');
  apply.click();
  assert.equal(events.length, 1, 'unchanged applied profile cannot invalidate twice');
  reset.click();
  assert.equal(events.length, 2, 'reset requires same invalidation as Apply');
  assert.deepEqual(events[1].detail.weights, CII_METHOD_A_WEIGHT_DEFAULTS);
  assert.deepEqual(getCiiMultiSourceMethodAConfidenceOptions().methodAConfidenceWeights, CII_METHOD_A_WEIGHT_DEFAULTS);
} finally {
  dispose?.();
  setCiiMultiSourceMethodAConfidenceWeights(original);
}
assert.equal(wrapper.removed, true);
assert.equal(apply.events.size, 0);
assert.equal(reset.events.size, 0);
for (const key of CII_METHOD_A_WEIGHT_KEYS) assert.equal(controls[key].events.size, 0);
console.log('CII Method A weight UI Apply/Reset, validation and stale invalidation: PASS');
