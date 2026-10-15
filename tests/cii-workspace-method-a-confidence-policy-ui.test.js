import assert from 'node:assert/strict';
import { _test as ui } from '../tabs/cii-workspace/cii-workspace-multisource-review-only-filter-shell.js';
import {
  getCiiMultiSourceMethodAConfidenceOptions,
  setCiiMultiSourceMethodAConfidenceThresholds,
} from '../tabs/cii-workspace/cii-workspace-source-set.js';

function fakeControl() {
  const listeners = new Map();
  const attributes = new Map();
  return {
    value: '', listeners, attributes,
    setAttribute(key, value) { attributes.set(key, value); },
    addEventListener(name, cb) { listeners.set(name, cb); },
    removeEventListener(name, cb) { if (listeners.get(name) === cb) listeners.delete(name); },
    change() { listeners.get('change')?.(); },
  };
}
const high = fakeControl();
const medium = fakeControl();
const status = { textContent: '' };
const settings = {
  className: '', attributes: new Map(), innerHTML: '', removed: false,
  setAttribute(key, value) { this.attributes.set(key, value); },
  querySelector(selector) {
    if (selector === '[data-ciiw-method-a-high-threshold]') return high;
    if (selector === '[data-ciiw-method-a-medium-threshold]') return medium;
    if (selector === '[data-ciiw-method-a-policy-status]') return status;
    return null;
  },
  remove() { this.removed = true; },
};
const inserted = [];
const inspect = { parentNode: { insertBefore(el) { inserted.push(el); } } };
const events = [];
const documentRef = {
  createElement(tag) { assert.equal(tag, 'div'); return settings; },
  defaultView: {
    CustomEvent: class {
      constructor(type, options) { this.type = type; this.detail = options.detail; }
    },
  },
};
const container = {
  ownerDocument: documentRef,
  querySelector(selector) { return selector === '[data-ciiw-inspect]' ? inspect : null; },
  dispatchEvent(event) { events.push(event); },
};
const saved = getCiiMultiSourceMethodAConfidenceOptions();
let dispose = null;
try {
  dispose = ui.mountMethodAConfidenceControls(container, saved);
  assert.deepEqual(inserted, [settings]);
  assert.equal(high.value, String(saved.methodAHighConfidenceThreshold));
  assert.equal(medium.value, String(saved.methodAMediumConfidenceThreshold));
  high.value = '';
  high.change();
  assert.equal(events.length, 0, 'invalid value cannot trigger stale-result invalidation');
  assert.equal(high.attributes.get('aria-invalid'), 'true');
  assert.match(status.textContent, /METHOD_A_CONFIDENCE_THRESHOLDS_INVALID/);
  assert.equal(getCiiMultiSourceMethodAConfidenceOptions().methodAHighConfidenceThreshold,
    saved.methodAHighConfidenceThreshold, 'invalid value must not alter effective policy');

  high.value = '75'; medium.value = '65';
  high.change();
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'ciiw-method-a-confidence-changed');
  assert.deepEqual(events[0].detail, { high: 75, medium: 65 });
  assert.match(status.textContent, /Writer2 scope invalidated/);
  assert.equal(high.attributes.get('aria-invalid'), 'false');
  high.change();
  assert.equal(events.length, 1, 'unchanged value must not invalidate again');

  high.value = '65'; medium.value = '75'; medium.change();
  assert.equal(events.length, 1, 'overlapping policy cannot fire a change');
  assert.equal(getCiiMultiSourceMethodAConfidenceOptions().methodAHighConfidenceThreshold, 75);
  assert.equal(getCiiMultiSourceMethodAConfidenceOptions().methodAMediumConfidenceThreshold, 65);

  high.value = '100'; medium.value = '0'; medium.change();
  assert.equal(events.length, 2);
  assert.deepEqual(events[1].detail, { high: 100, medium: 0 });
} finally {
  dispose?.();
  setCiiMultiSourceMethodAConfidenceThresholds({
    high: saved.methodAHighConfidenceThreshold, medium: saved.methodAMediumConfidenceThreshold,
  });
}
assert.equal(settings.removed, true);
assert.equal(high.listeners.size, 0);
assert.equal(medium.listeners.size, 0);
console.log('Method A confidence UI validation and invalidation dispatch: PASS');
