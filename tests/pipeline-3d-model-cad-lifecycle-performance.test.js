import assert from 'node:assert/strict';
import { InteractiveGraph } from '../tabs/pipeline-3d-model/pipeline-3d-model-interactive-graph.js';
import { Table2XCanvas } from '../tabs/pipeline-3d-model/pipeline-3d-model-table2x-canvas.js';
import {
  capturePipelineCadPreviewSnapshots,
  getPipelineCadLifecycleStats,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-lifecycle-performance.js';

function createContext() {
  return {
    setTransform() {},
    clearRect() {},
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

function createCanvas(holder = null, stage = null) {
  const listeners = new Map();
  return {
    width: 0,
    height: 0,
    style: {},
    getContext: () => createContext(),
    addEventListener(type, listener) {
      const values = listeners.get(type) || new Set();
      values.add(listener);
      listeners.set(type, values);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    setPointerCapture() {},
    releasePointerCapture() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 400 }),
    closest(selector) {
      if (selector.includes('table2x-preview') || selector.includes('table3x-preview')) return holder;
      if (selector === '[data-p3d-cad-stage]') return stage;
      return null;
    },
  };
}

{
  const holder = {
    clientWidth: 800,
    clientHeight: 400,
    getBoundingClientRect: () => ({ width: 800, height: 400 }),
  };
  class TestGraph extends InteractiveGraph {
    render() {
      this.renderCount = (this.renderCount || 0) + 1;
    }
  }
  const graph = new TestGraph(createCanvas(holder));
  assert.notEqual(graph.setSize(1200, 600), false);
  assert.equal(graph.setSize(1200, 600), false, 'identical visible surface must be skipped');
  const stats = getPipelineCadLifecycleStats(graph);
  assert.equal(stats.appliedResizes, 1);
  assert.equal(stats.skippedResizes, 1);
  assert.deepEqual(stats.surface, { width: 800, height: 400, dpr: 1 });
  assert.equal(graph.renderCount, 1);
}

{
  const graph = new Table2XCanvas(createCanvas());
  graph.render = () => {};
  graph.draggingId = 'table2a-0002';
  graph.visualOverrides.set('table2a-0002', 240.5);
  graph.pointerState = { pointerId: 8 };
  let committedMoves = 0;
  let cancellations = 0;
  graph.addEventListener('nodeMoved', () => { committedMoves += 1; });
  graph.addEventListener('interactionCancelled', () => { cancellations += 1; });
  const result = graph.onPrimaryPointerUp({ type: 'pointercancel' }, { x: 10, y: 10 }, { x: 1, y: 240.5 });
  assert.equal(result, false);
  assert.equal(committedMoves, 0, 'pointercancel must never commit a model mutation');
  assert.equal(cancellations, 1);
  assert.equal(graph.draggingId, null);
  assert.equal(graph.pointerState, null);
  assert.equal(graph.visualOverrides.has('table2a-0002'), false);
}

{
  let mounted = false;
  const stage = { remove() { mounted = false; } };
  const holder = {
    innerHTML: '<svg data-p3d-legacy-svg="table2x"></svg>',
    dataset: {},
    classList: { remove() {} },
    querySelector() { return mounted ? stage : null; },
    contains(candidate) { return mounted && candidate === stage; },
  };
  const doc = { querySelectorAll: () => [holder] };
  assert.equal(capturePipelineCadPreviewSnapshots(doc), 1);
  const canvas = createCanvas(holder, stage);
  const graph = new InteractiveGraph(canvas);
  mounted = true;
  holder.innerHTML = '<div data-p3d-cad-stage="table2x"></div>';
  assert.notEqual(graph.destroy(), false);
  assert.equal(holder.innerHTML, '<svg data-p3d-legacy-svg="table2x"></svg>');
  assert.equal(graph.destroy(), false, 'destroy must be idempotent');
  const stats = getPipelineCadLifecycleStats(graph);
  assert.equal(stats.destroyCalls, 2);
  assert.equal(stats.previewRestores, 1);
  assert.equal(stats.destroyed, true);
}

console.log('pipeline-3d-model CAD lifecycle/performance tests passed');
