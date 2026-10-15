import assert from 'node:assert/strict';
import { PipelineCadController } from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-controller.js';
import { Table2XCanvas } from '../tabs/pipeline-3d-model/pipeline-3d-model-table2x-canvas.js';
import { Table3XCanvas } from '../tabs/pipeline-3d-model/pipeline-3d-model-table3x-canvas.js';
import {
  PIPELINE_CANVAS_GEOMETRY_UPDATED_SCHEMA,
  PIPELINE_CANVAS_NODE_MOVED_SCHEMA,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-canvas-contracts.js';
import {
  PipelineCanvasManager,
  pruneDetachedPipelineCanvasManagers,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-canvas-audit-hardening.js';

if (typeof globalThis.CustomEvent !== 'function') {
  globalThis.CustomEvent = class CustomEvent extends Event {
    constructor(type, options = {}) {
      super(type, options);
      this.detail = options.detail;
    }
  };
}

const RAW = Object.freeze({
  table2a: `H(coor)\tV(coor)\t[H vs V] Length\tStation Text\tElevation Text
659.791\t—\t—\t0+000.0\t231.32
668.540\t-715.825 → -650.258\t65.567\t0+006.7\t230.95
680.803\t-715.825 → -650.258\t65.567\t0+019.0\t230.82`,
  table3a: `From H(coor)\tTo H(coor)\tText Position X\tHLength Text
661.791\t682.337\t671.704\t20.5`,
  table3b: `From H(coor)\tTo H(coor)\tText Position X\tZ Text
682.337\t732.683\t708.374\t1.5M`,
  table3c: `Text Position X\tMarker Text
688.135\tPM-001`,
});

function createContext() {
  return {
    clearCount: 0,
    setTransform() {},
    clearRect() { this.clearCount += 1; },
    fillRect() {},
    save() {},
    restore() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    arc() {},
    fill() {},
    fillText() {},
    setLineDash() {},
  };
}

class FakeCanvas extends EventTarget {
  constructor() {
    super();
    this.width = 0;
    this.height = 0;
    this.style = {};
    this.context = createContext();
    this.listeners = new Map();
  }

  getContext() { return this.context; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 1000, height: 500 }; }
  setPointerCapture() {}
  releasePointerCapture() {}

  addEventListener(type, listener, options) {
    super.addEventListener(type, listener, options);
    const listeners = this.listeners.get(type) || new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener, options) {
    super.removeEventListener(type, listener, options);
    this.listeners.get(type)?.delete(listener);
  }

  listenerCount(type) { return this.listeners.get(type)?.size || 0; }
}

class FakeTextArea extends EventTarget {
  constructor(value, slotName) {
    super();
    this.value = value;
    this.slotName = slotName;
  }

  matches(selector) {
    return selector === '[data-p3d-split$="-raw"]' && this.slotName.endsWith('-raw');
  }
}

class FakeDialog extends EventTarget {
  constructor() {
    super();
    this.isConnected = true;
    this.ownerDocument = null;
    this.elements = Object.fromEntries(Object.entries(RAW).map(([name, value]) => [
      `[data-p3d-split="${name}-raw"]`,
      new FakeTextArea(value, `${name}-raw`),
    ]));
  }

  querySelector(selector) { return this.elements[selector] || null; }
}

function installFrameHarness() {
  const previousRequest = globalThis.requestAnimationFrame;
  const previousCancel = globalThis.cancelAnimationFrame;
  const frames = new Map();
  let nextId = 1;
  globalThis.requestAnimationFrame = (callback) => {
    const id = nextId;
    nextId += 1;
    frames.set(id, callback);
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => frames.delete(id);
  return {
    frames,
    flushAll() {
      let guard = 0;
      while (frames.size && guard < 20) {
        const callbacks = [...frames.values()];
        frames.clear();
        callbacks.forEach((callback) => callback(16));
        guard += 1;
      }
      assert.ok(guard < 20, 'frame queue must settle');
    },
    restore() {
      globalThis.requestAnimationFrame = previousRequest;
      globalThis.cancelAnimationFrame = previousCancel;
    },
  };
}

const frameHarness = installFrameHarness();
try {
  const dialog = new FakeDialog();
  const table2Canvas = new FakeCanvas();
  const table3Canvas = new FakeCanvas();
  const table2 = new Table2XCanvas(table2Canvas, { width: 1000, height: 500 });
  const table3 = new Table3XCanvas(table3Canvas, { width: 1000, height: 500 });
  const controller = new PipelineCadController(dialog);
  controller.attachGraphs({ table2x: table2, table3x: table3 });

  const manager = controller.canvasManager;
  assert.ok(manager instanceof PipelineCanvasManager);
  assert.equal(manager.nodes.length, 5);
  assert.equal(manager.edges.length, 2);
  assert.ok(Object.isFrozen(manager.nodes));
  assert.ok(Object.isFrozen(manager.nodes[0]));
  assert.ok(Object.isFrozen(manager.edges[0]));

  assert.equal(frameHarness.frames.size, 2, 'each graph may request only one initial paint');
  table2.render();
  table2.render();
  table3.render();
  assert.equal(frameHarness.frames.size, 2, 'repeated renders must remain frame-coalesced');
  frameHarness.flushAll();
  assert.equal(table2Canvas.context.clearCount, 1);
  assert.equal(table3Canvas.context.clearCount, 1);

  const table2Moves = [];
  const table3Moves = [];
  const geometryEvents = [];
  table2Canvas.addEventListener('canvas:nodeMoved', (event) => table2Moves.push(event.detail));
  table3Canvas.addEventListener('canvas:nodeMoved', (event) => table3Moves.push(event.detail));
  table2Canvas.addEventListener('canvas:geometryUpdated', () => {
    throw new Error('geometryUpdated must not be duplicated across Canvas elements');
  });
  table3Canvas.addEventListener('canvas:geometryUpdated', () => {
    throw new Error('geometryUpdated must not be duplicated across Canvas elements');
  });
  dialog.addEventListener('canvas:geometryUpdated', (event) => geometryEvents.push(event.detail));

  const node = table2.currentNodes()[1];
  const screen = table2.worldToScreen(node);
  const raw2 = dialog.querySelector('[data-p3d-split="table2a-raw"]');
  const raw2Before = raw2.value;
  table2.onPrimaryPointerDown({ button: 0 }, screen, node);
  table2.onPrimaryPointerMove({}, screen, { x: node.x, y: node.y + 2 });
  assert.equal(raw2.value, raw2Before, 'pointermove must not mutate raw textarea state');
  frameHarness.flushAll();

  assert.equal(table2Moves.length, 1);
  assert.equal(table3Moves.length, 0, 'Table 2 movement must not broadcast from Table 3 Canvas');
  const preview = table2Moves[0];
  assert.equal(preview.schema, PIPELINE_CANVAS_NODE_MOVED_SCHEMA);
  assert.equal(preview.phase, 'preview');
  assert.equal(preview.after.elevationValue, node.y + 2);
  assert.ok(preview.operationId);
  assert.ok(Object.isFrozen(preview));

  table2.onPrimaryPointerUp({}, screen, { x: node.x, y: node.y + 2 });
  assert.notEqual(raw2.value, raw2Before, 'pointer release must commit the model back to raw data');
  assert.equal(table2Moves.length, 2);
  const committed = table2Moves[1];
  assert.equal(committed.phase, 'committed');
  assert.equal(committed.operationId, preview.operationId);
  assert.equal(committed.reason, 'move-table2-node');
  assert.equal(manager.nodes.find((item) => item.id === node.id)?.y, node.y + 2);
  assert.equal(geometryEvents.filter((event) => event.reason === 'node-preview').length, 1);
  assert.equal(geometryEvents.filter((event) => event.reason === 'commandCommitted').length, 1);
  assert.ok(geometryEvents.every((event) => event.schema === PIPELINE_CANVAS_GEOMETRY_UPDATED_SCHEMA));

  const cancelNode = table2.currentNodes()[0];
  const cancelScreen = table2.worldToScreen(cancelNode);
  const moveCountBeforeCancel = table2Moves.length;
  table2.onPrimaryPointerDown({ button: 0 }, cancelScreen, cancelNode);
  table2.onPrimaryPointerMove({}, cancelScreen, { x: cancelNode.x, y: cancelNode.y + 5 });
  table2.visualOverrides.delete(cancelNode.id);
  table2.draggingId = null;
  table2.dispatchGraphEvent('interactionCancelled', { graph: 'table2x', reason: 'escape' });
  frameHarness.flushAll();
  assert.equal(table2Moves.length, moveCountBeforeCancel + 1, 'cancelled preview must not emit a stale preview event');
  assert.equal(table2Moves.at(-1).phase, 'cancelled');
  assert.equal(table2Moves.at(-1).reason, 'escape');
  assert.equal(manager.nodes.find((item) => item.id === cancelNode.id)?.y, cancelNode.y);

  const marker = table3.markerNodes()[0];
  const markerScreen = table3.worldToScreen(marker);
  const raw3 = dialog.querySelector('[data-p3d-split="table3c-raw"]');
  const raw3Before = raw3.value;
  table3.onPrimaryPointerDown({ button: 0 }, markerScreen, marker);
  table3.onPrimaryPointerMove({}, markerScreen, { x: marker.x + 1, y: marker.y });
  frameHarness.flushAll();
  table3.onPrimaryPointerUp({}, markerScreen, { x: marker.x + 1, y: marker.y });
  assert.notEqual(raw3.value, raw3Before);
  assert.equal(table3Moves.length, 2);
  assert.equal(table3Moves[0].phase, 'preview');
  assert.equal(table3Moves[1].phase, 'committed');
  assert.equal(table3Moves[1].operationId, table3Moves[0].operationId);
  assert.equal(table3Moves[1].entityType, 'marker');
  assert.ok(Number.isFinite(table3Moves[1].after.absoluteH));

  const rejectedNode = table2.currentNodes()[2];
  const rejectedScreen = table2.worldToScreen(rejectedNode);
  const canonicalY = rejectedNode.y;
  const savedModel = controller.model;
  table2.onPrimaryPointerDown({ button: 0 }, rejectedScreen, rejectedNode);
  controller.model = null;
  table2.onPrimaryPointerUp({}, rejectedScreen, { x: rejectedNode.x, y: canonicalY + 9 });
  await Promise.resolve();
  controller.model = savedModel;
  assert.equal(table2Moves.at(-1).phase, 'cancelled');
  assert.equal(table2Moves.at(-1).reason, 'commit-rejected');
  assert.equal(table2.currentNodes().find((item) => item.id === rejectedNode.id)?.y, canonicalY);
  assert.equal(manager.nodes.find((item) => item.id === rejectedNode.id)?.y, canonicalY);

  frameHarness.flushAll();
  const stableNodes = table2.nodes;
  table2.panBy(20, 10);
  table2.zoomAt({ x: 400, y: 200 }, 1.1);
  frameHarness.flushAll();
  assert.equal(table2.nodes, stableNodes, 'viewport-only paints must not rebuild immutable geometry');

  assert.ok(table2Canvas.listenerCount('pointermove') > 0);
  assert.ok(table3Canvas.listenerCount('pointermove') > 0);
  dialog.isConnected = false;
  assert.equal(pruneDetachedPipelineCanvasManagers(), 1);
  assert.equal(controller.canvasManager, null);
  assert.equal(table2Canvas.listenerCount('pointermove'), 0);
  assert.equal(table3Canvas.listenerCount('pointermove'), 0);
  assert.equal(frameHarness.frames.size, 0);
} finally {
  frameHarness.restore();
}

console.log('pipeline-3d-model canvas audit hardening tests passed');
