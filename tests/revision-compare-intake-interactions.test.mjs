import assert from 'node:assert/strict';
import {
  bindRevisionCompareIntakeInteractions,
  revisionCompareDropInput,
  revisionCompareDropSlot,
  selectRevisionCompareDropFile,
} from '../tabs/revision-compare/revision-compare-intake-interactions.js';

class FakeClassList {
  constructor() { this.values = new Set(); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  contains(value) { return this.values.has(value); }
}

class FakeDataTransfer {
  constructor() {
    this.files = [];
    this.items = { add: (file) => { this.files = [file]; } };
  }
}

class FakeEvent {
  constructor(type, options = {}) { this.type = type; this.bubbles = Boolean(options.bubbles); }
}

function createInput() {
  return {
    disabled: false,
    files: [],
    dispatched: [],
    ownerDocument: { defaultView: { DataTransfer: FakeDataTransfer, Event: FakeEvent } },
    dispatchEvent(event) { this.dispatched.push(event); },
  };
}

function createSlot(input) {
  return {
    classList: new FakeClassList(),
    dataset: { revcDropEnabled: 'true', revcDropLabel: 'REV A' },
    contains: () => false,
    querySelector: (selector) => selector === '[data-revc-file]' ? input : null,
  };
}

function createRoot(slot) {
  const listeners = new Map();
  const live = { textContent: '' };
  return {
    listeners,
    live,
    addEventListener(type, handler) { listeners.set(type, handler); },
    removeEventListener(type, handler) { if (listeners.get(type) === handler) listeners.delete(type); },
    querySelector(selector) { return selector === '[data-revc-live]' ? live : null; },
    querySelectorAll() { return slot.classList.contains('is-revc-drop-active') ? [slot] : []; },
  };
}

function createTarget(slot) {
  return { closest: (selector) => selector === '[data-revc-drop-slot]' ? slot : null };
}

function createDragEvent(slot, files) {
  return {
    dataTransfer: { files, dropEffect: 'none' },
    defaultPrevented: false,
    relatedTarget: null,
    stopped: false,
    target: createTarget(slot),
    preventDefault() { this.defaultPrevented = true; },
    stopPropagation() { this.stopped = true; },
  };
}

function testSelection() {
  const file = Object.freeze({ name: 'rev-a.json' });
  assert.equal(selectRevisionCompareDropFile({ files: [file] }).file, file);
  assert.match(selectRevisionCompareDropFile({ files: [] }).error, /exactly one/i);
  assert.match(selectRevisionCompareDropFile({ files: [file, file] }).error, /one staged JSON/i);
}

function testEligibility() {
  const input = createInput();
  const slot = createSlot(input);
  assert.equal(revisionCompareDropSlot(createTarget(slot)), slot);
  assert.equal(revisionCompareDropInput(slot), input);
  input.disabled = true;
  assert.equal(revisionCompareDropInput(slot), null);
  input.disabled = false;
  slot.dataset.revcDropEnabled = 'false';
  assert.equal(revisionCompareDropInput(slot), null);
}

function testBoundLifecycle() {
  const input = createInput();
  const slot = createSlot(input);
  const root = createRoot(slot);
  const cleanup = bindRevisionCompareIntakeInteractions(root);
  assert.deepEqual([...root.listeners.keys()].sort(), ['dragend', 'dragenter', 'dragleave', 'dragover', 'drop']);

  const file = Object.freeze({ name: 'rev-a.json' });
  const drag = createDragEvent(slot, [file]);
  root.listeners.get('dragover')(drag);
  assert.equal(drag.defaultPrevented, true);
  assert.equal(drag.dataTransfer.dropEffect, 'copy');
  assert.equal(slot.classList.contains('is-revc-drop-active'), true);

  const drop = createDragEvent(slot, [file]);
  root.listeners.get('drop')(drop);
  assert.equal(drop.stopped, true);
  assert.equal(input.files[0], file);
  assert.equal(input.dispatched[0].type, 'change');
  assert.match(root.live.textContent, /Loading dropped file into REV A/);

  root.listeners.get('drop')(createDragEvent(slot, [file, file]));
  assert.match(root.live.textContent, /one staged JSON/i);
  assert.equal(input.dispatched.length, 1);

  input.disabled = true;
  root.listeners.get('drop')(createDragEvent(slot, [file]));
  assert.match(root.live.textContent, /not available/i);
  assert.equal(input.dispatched.length, 1);

  cleanup();
  assert.equal(root.listeners.size, 0);
}

testSelection();
testEligibility();
testBoundLifecycle();
console.log('revision-compare-intake-interactions: PASS');
