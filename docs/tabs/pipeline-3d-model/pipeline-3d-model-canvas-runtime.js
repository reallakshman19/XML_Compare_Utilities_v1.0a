import { InteractiveGraph } from './pipeline-3d-model-interactive-graph.js';
import { Table2XCanvas } from './pipeline-3d-model-table2x-canvas.js';
import { Table3XCanvas } from './pipeline-3d-model-table3x-canvas.js';

const RENDER_PATCH = Symbol.for('pipeline3d.canvas-audit.render.v2');
const MODEL_PATCH = Symbol.for('pipeline3d.canvas-audit.model.v2');
const DESTROY_PATCH = Symbol.for('pipeline3d.canvas-audit.destroy.v2');
const RENDER_STATE = new WeakMap();

function renderState(graph) {
  let state = RENDER_STATE.get(graph);
  if (!state) {
    state = { frameId: null, destroyed: false };
    RENDER_STATE.set(graph, state);
  }
  return state;
}

export function schedulePipelineCanvasFrame(callback) {
  const request = globalThis.requestAnimationFrame;
  if (typeof request !== 'function') {
    callback();
    return null;
  }
  return request.call(globalThis, callback);
}

export function cancelPipelineCanvasFrame(frameId) {
  if (frameId != null) globalThis.cancelAnimationFrame?.(frameId);
}

function freezeNode(node, graphName) {
  return Object.freeze({ ...node, graph: graphName });
}

function buildEdges(nodes, graphName) {
  return Object.freeze(nodes.slice(1).map((nodeB, index) => Object.freeze({
    id: `${nodes[index].id}->${nodeB.id}`,
    graph: graphName,
    nodeA: nodes[index],
    nodeB,
  })));
}

function graphGeometry(graph) {
  if (graph instanceof Table2XCanvas) {
    const nodes = Object.freeze((graph.currentNodes?.() || []).map((node) => freezeNode(node, 'table2x')));
    return { nodes, edges: buildEdges(nodes, 'table2x') };
  }
  if (graph instanceof Table3XCanvas) {
    const depths = (graph.depthNodes?.() || []).map((node) => freezeNode(node, 'table3x'));
    const markers = (graph.markerNodes?.() || []).map((node) => freezeNode(node, 'table3x'));
    return { nodes: Object.freeze([...depths, ...markers]), edges: buildEdges(depths, 'table3x') };
  }
  return { nodes: Object.freeze([]), edges: Object.freeze([]) };
}

export function syncPipelineCanvasGeometry(graph) {
  const geometry = graphGeometry(graph);
  graph.nodes = geometry.nodes;
  graph.edges = geometry.edges;
  return geometry;
}

function patchRender(GraphClass) {
  const prototype = GraphClass.prototype;
  if (prototype[RENDER_PATCH]) return;
  Object.defineProperty(prototype, RENDER_PATCH, { value: true });
  const paint = prototype.render;
  prototype.render = function renderWhenDirty() {
    const state = renderState(this);
    if (state.destroyed) return false;
    this.isDirty = true;
    if (state.frameId != null) return false;
    state.frameId = schedulePipelineCanvasFrame(() => {
      state.frameId = null;
      this.renderFrame = null;
      if (!this.isDirty || state.destroyed) return;
      this.isDirty = false;
      paint.call(this);
    });
    this.renderFrame = state.frameId;
    return true;
  };
}

function patchSetModel(GraphClass) {
  const prototype = GraphClass.prototype;
  if (prototype[MODEL_PATCH]) return;
  Object.defineProperty(prototype, MODEL_PATCH, { value: true });
  const setModel = prototype.setModel;
  prototype.setModel = function setAuditedModel(...args) {
    const result = setModel.apply(this, args);
    syncPipelineCanvasGeometry(this);
    return result;
  };
}

function patchDestroy() {
  const prototype = InteractiveGraph.prototype;
  if (prototype[DESTROY_PATCH]) return;
  Object.defineProperty(prototype, DESTROY_PATCH, { value: true });
  const destroy = prototype.destroy;
  prototype.destroy = function destroyAuditedGraph() {
    const state = renderState(this);
    state.destroyed = true;
    cancelPipelineCanvasFrame(state.frameId);
    state.frameId = null;
    this.renderFrame = null;
    this.isDirty = false;
    return destroy.call(this);
  };
}

export function installPipelineCanvasRuntimeHardening() {
  patchRender(Table2XCanvas);
  patchRender(Table3XCanvas);
  patchSetModel(Table2XCanvas);
  patchSetModel(Table3XCanvas);
  patchDestroy();
}

installPipelineCanvasRuntimeHardening();
