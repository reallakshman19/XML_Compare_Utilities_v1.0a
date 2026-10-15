import { GraphTool, InteractiveGraph } from './pipeline-3d-model-interactive-graph.js';
import { formatDepth, interpolateCumulativeFromAbsoluteH, interpolateAbsoluteHFromCumulative } from './pipeline-3d-model-cad-math.js';
import { drawPipelineCadMarkerRail, drawPipelineCadSelectionNode } from './pipeline-3d-model-cad-batch-view.js';
import { emptyPipelineCadMarkupProjection, drawPipelineCadMarkupOverlay } from './pipeline-3d-model-cad-markup-renderer.js';
import { drawPipelineCadSelectionBox, installPipelineCadSelectionRuntime, selectedPipelineCadItems } from './pipeline-3d-model-cad-selection-runtime.js';

function modifierActive(event = {}) { return event.shiftKey || event.ctrlKey || event.metaKey; }
function clampX(graph, value) { return Math.max(graph.bounds.minX, Math.min(graph.bounds.maxX, Number(value))); }
function precisionCancel(event) { return String(event.detail?.reason || '').startsWith('precision-'); }

export class Table3XCanvas extends InteractiveGraph {
  constructor(canvas, options = {}) {
    super(canvas, options);
    this.model = null; this.depthSnapshot = []; this.depthOverrides = new Map();
    this.markerOverrides = new Map(); this.precisionOverrides = new Map(); this.precisionGripId = null;
    this.selected = null; this.dragging = null; this.groupDrag = null;
    this.hitRadius = Number(options.hitRadius) || 10; this.markerRailY = Number(options.markerRailY) || 0.75;
    this.pipelineCadMarkupGraph = 'table3x'; this.markupProjection = emptyPipelineCadMarkupProjection();
    installPipelineCadSelectionRuntime(this, {
      graphName: 'table3x', candidates: () => [...this.depthNodes(), ...this.markerNodes()],
      syncLegacy: (detail) => { this.selected = detail.primaryId ? { id: detail.primaryId, type: detail.primaryType } : null; },
    });
    const cancel = (event) => { if (!precisionCancel(event)) this.cancelActiveSelectionInteraction('escape'); };
    this.addEventListener('interactionCancelled', cancel);
    this.destroyCallbacks.push(() => this.removeEventListener('interactionCancelled', cancel));
  }

  setModel(model, options = {}) {
    this.model = model; const preserveSnapshot = options.preserveSnapshot === true;
    if (!preserveSnapshot) {
      this.depthSnapshot = this.depthNodes(false); this.depthOverrides.clear(); this.markerOverrides.clear();
      this.precisionOverrides.clear(); this.precisionGripId = null; this.dragging = null; this.groupDrag = null;
      this.setSelection([], { emit: false, source: 'model-reset' });
    } else if (!this.depthSnapshot.length) this.depthSnapshot = this.depthNodes(false);
    const map = model?.coordinateMap; const ys = this.depthNodes(false).map((node) => node.y);
    const minY = Math.min(-2, ...ys); const maxY = Math.max(this.markerRailY + 0.5, ...ys);
    if (map) this.setWorldBounds({ minX: map.cumulativeMin, maxX: map.cumulativeMax, minY, maxY }, { fit: !preserveSnapshot });
    else this.render();
  }

  depthNodes(includeOverrides = true) {
    if (!this.model?.coordinateMap) return [];
    return (this.model.table3DepthRows || []).filter((row) => Number.isFinite(row.absoluteH) && Number.isFinite(row.z)).map((row) => {
      const precision = this.precisionOverrides.get(row.id);
      const cumulative = interpolateCumulativeFromAbsoluteH(row.absoluteH, this.model.coordinateMap);
      return {
        id: row.id, type: 'depth-node', absoluteH: row.absoluteH,
        x: includeOverrides ? (precision?.x ?? cumulative) : cumulative,
        y: includeOverrides ? (this.depthOverrides.get(row.id) ?? precision?.y ?? row.z) : row.z,
        text: row.zText,
      };
    });
  }

  markerNodes(includeOverrides = true) {
    if (!this.model?.coordinateMap) return [];
    return (this.model.table3MarkerRows || []).filter((row) => Number.isFinite(row.absoluteH)).map((row) => {
      const cumulative = interpolateCumulativeFromAbsoluteH(row.absoluteH, this.model.coordinateMap);
      const precision = this.precisionOverrides.get(row.id);
      return {
        id: row.id, type: 'marker', absoluteH: row.absoluteH,
        x: includeOverrides ? (this.markerOverrides.get(row.id) ?? precision?.x ?? cumulative) : cumulative,
        y: this.markerRailY, text: precision?.label ?? row.markerText,
      };
    });
  }

  reloadGraph() {
    this.depthSnapshot = this.depthNodes(false); this.depthOverrides.clear(); this.markerOverrides.clear();
    this.precisionOverrides.clear(); this.setSelection([], { emit: false, source: 'reload' });
    this.model?.clearDirtyRows?.(); this.dispatchGraphEvent('reloadRequested', { graph: 'table3x' }); this.render();
  }
  setMarkupProjection(projection) {
    this.markupProjection = projection || emptyPipelineCadMarkupProjection(); this.render(); return true;
  }
  setPrecisionPreview(id, point = {}) {
    if (!id) return false;
    this.precisionOverrides.set(id, { x: Number(point.x), y: Number(point.y), label: point.label }); this.render(); return true;
  }
  clearPrecisionPreview() { this.precisionOverrides.clear(); this.render(); return true; }
  setPrecisionGrip(id) { this.precisionGripId = id || null; this.render(); }

  hitTest(screenPoint) {
    let best = null; let distance = this.hitRadius;
    for (const node of [...this.markerNodes(), ...this.depthNodes()]) {
      const screen = this.worldToScreen(node); const next = Math.hypot(screen.x - screenPoint.x, screen.y - screenPoint.y);
      if (next < distance) { best = { type: node.type, node, screen }; distance = next; }
    }
    return best;
  }

  beginGroupDrag(hit, event, world) {
    if (modifierActive(event) || !this.isSelected(hit.node.id)) return false;
    const selection = this.getSelectionDetail();
    this.dragging = { id: hit.node.id, type: hit.type };
    if (selection.count < 2) return false;
    if (hit.type !== 'marker') {
      this.dragging = null;
      this.dispatchGraphEvent('batchMoveRejected', {
        graph: 'table3x', entityType: hit.type, code: 'TABLE3_DEPTH_BATCH_NOT_AUTHORIZED',
        entityIds: selection.entityIds,
      });
      return true;
    }
    const items = selectedPipelineCadItems(this, 'marker');
    const initial = new Map(this.markerNodes().map((node) => [node.id, node.x]));
    const skippedEntityIds = selection.items.filter((item) => item.type !== 'marker').map((item) => item.id).sort();
    this.groupDrag = {
      type: 'marker', ids: items.map((item) => item.id), start: clampX(this, world.x), initial, skippedEntityIds,
    };
    return true;
  }

  onPrimaryPointerDown(event, screen, world) {
    const hit = this.hitTest(screen);
    if (this.tool === GraphTool.DELETE && hit) {
      this.dispatchGraphEvent('nodeDeleted', { graph: 'table3x', entityId: hit.node.id, entityType: hit.type }); return;
    }
    if (this.tool === GraphTool.ADD_MARKER) {
      const cumulative = clampX(this, world.x);
      this.dispatchGraphEvent('nodeAdded', {
        graph: 'table3x', entityType: 'marker', cumulative,
        absoluteH: interpolateAbsoluteHFromCumulative(cumulative, this.model.coordinateMap),
      });
      return;
    }
    if (this.tool === GraphTool.ADD_NODE) {
      const cumulative = clampX(this, world.x);
      this.dispatchGraphEvent('nodeAdded', {
        graph: 'table3x', entityType: 'depth-node', cumulative,
        absoluteH: interpolateAbsoluteHFromCumulative(cumulative, this.model.coordinateMap), z: world.y, zText: formatDepth(world.y),
      });
      return;
    }
    if (this.tool !== GraphTool.SELECT) return;
    this.clearPrecisionPreview();
    if (!hit) { this.dragging = null; this.groupDrag = null; this.beginSelectionBox(screen, event); return; }
    this.selectHit(hit, event);
    if (modifierActive(event) || !this.isSelected(hit.node.id)) return;
    this.beginGroupDrag(hit, event, world); this.render();
  }

  previewMarkerGroup(world) {
    const drag = this.groupDrag; const delta = clampX(this, world.x) - drag.start;
    for (const id of drag.ids) this.markerOverrides.set(id, clampX(this, drag.initial.get(id) + delta));
    this.dispatchGraphEvent('batchPreviewMoved', {
      graph: 'table3x', entityType: 'marker', entityIds: [...drag.ids], skippedEntityIds: [...drag.skippedEntityIds], delta: { x: delta },
    });
  }

  onPrimaryPointerMove(event, screen, world) {
    if (this.pipelineCadSelectionState.box) { this.updateSelectionBox(screen); return; }
    if (this.groupDrag) { this.previewMarkerGroup(world); this.render(); return; }
    if (!this.dragging) return;
    if (this.dragging.type === 'marker') {
      const cumulative = clampX(this, world.x); this.markerOverrides.set(this.dragging.id, cumulative);
      this.dispatchGraphEvent('nodePreviewMoved', { graph: 'table3x', entityId: this.dragging.id, entityType: 'marker', cumulative });
    } else {
      this.depthOverrides.set(this.dragging.id, world.y);
      this.dispatchGraphEvent('nodePreviewMoved', {
        graph: 'table3x', entityId: this.dragging.id, entityType: 'depth-node', z: world.y, zText: formatDepth(world.y),
      });
    }
    this.render();
  }

  finishMarkerGroup(world) {
    const drag = this.groupDrag; const delta = clampX(this, world.x) - drag.start;
    const edits = drag.ids.map((id) => {
      const cumulative = clampX(this, drag.initial.get(id) + delta);
      return { id, cumulative, absoluteH: interpolateAbsoluteHFromCumulative(cumulative, this.model.coordinateMap) };
    });
    this.groupDrag = null; this.dragging = null;
    this.dispatchGraphEvent('batchMoved', {
      graph: 'table3x', entityType: 'marker', entityIds: edits.map((edit) => edit.id), edits,
      skippedEntityIds: [...drag.skippedEntityIds], delta: { x: delta },
    });
  }

  onPrimaryPointerUp(event, screen, world) {
    if (this.pipelineCadSelectionState.box) { this.finishSelectionBox(); return; }
    if (this.groupDrag) { this.finishMarkerGroup(world); this.render(); return; }
    if (!this.dragging) return;
    const dragging = this.dragging; this.dragging = null;
    if (dragging.type === 'marker') {
      const cumulative = clampX(this, world.x); this.markerOverrides.set(dragging.id, cumulative);
      this.dispatchGraphEvent('nodeMoved', {
        graph: 'table3x', entityId: dragging.id, entityType: 'marker',
        after: { cumulative, absoluteH: interpolateAbsoluteHFromCumulative(cumulative, this.model.coordinateMap) },
        commitReason: 'pointer-release',
      });
    } else {
      this.depthOverrides.set(dragging.id, world.y);
      this.dispatchGraphEvent('nodeMoved', {
        graph: 'table3x', entityId: dragging.id, entityType: 'depth-node',
        after: { z: world.y, zText: formatDepth(world.y) }, commitReason: 'pointer-release',
      });
    }
    this.render();
  }

  cancelActiveSelectionInteraction(source = 'cancel') {
    this.groupDrag = null; this.dragging = null; this.depthOverrides.clear(); this.markerOverrides.clear();
    this.cancelSelectionBox(); this.clearSelection({ source });
  }
  drawGrip(ctx, point, node) {
    if (node.id !== this.precisionGripId || node.id !== this.selected?.id) return;
    ctx.save(); ctx.strokeStyle = '#f8fafc'; ctx.fillStyle = node.type === 'marker' ? '#10b981' : '#ec4899'; ctx.lineWidth = 2;
    ctx.fillRect(point.x - 5, point.y - 5, 10, 10); ctx.strokeRect(point.x - 7, point.y - 7, 14, 14); ctx.restore();
  }

  render() {
    const ctx = this.context; if (!ctx) return;
    ctx.clearRect(0, 0, this.width, this.height); ctx.fillStyle = '#0b1220'; ctx.fillRect(0, 0, this.width, this.height); this.drawGrid(ctx);
    const zeroA = this.worldToScreen({ x: this.bounds.minX, y: 0 }); const zeroB = this.worldToScreen({ x: this.bounds.maxX, y: 0 });
    ctx.beginPath(); ctx.moveTo(zeroA.x, zeroA.y); ctx.lineTo(zeroB.x, zeroB.y); ctx.strokeStyle = '#64748b'; ctx.lineWidth = 1.5; ctx.stroke();
    if (this.depthSnapshot.length > 1) {
      ctx.beginPath(); const first = this.worldToScreen(this.depthSnapshot[0]); ctx.moveTo(first.x, first.y);
      for (let index = 1; index < this.depthSnapshot.length; index += 1) {
        const point = this.worldToScreen(this.depthSnapshot[index]); ctx.lineTo(point.x, point.y);
      }
      ctx.strokeStyle = '#f472b6'; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.stroke();
    }
    for (const node of this.depthNodes()) {
      drawPipelineCadSelectionNode(this, ctx, node, {
        primaryId: this.selected?.id, fill: '#f472b6', labelColor: '#fbcfe8',
        label: formatDepth(node.y), labelOffsetY: 18, drawGrip: (context, point, item) => this.drawGrip(context, point, item),
      });
    }
    for (const marker of this.markerNodes()) {
      drawPipelineCadMarkerRail(this, ctx, marker);
      drawPipelineCadSelectionNode(this, ctx, marker, {
        primaryId: this.selected?.id, fill: '#34d399', labelColor: '#6ee7b7', font: 'bold 11px monospace',
        label: marker.text, labelOffsetY: -16, drawGrip: (context, point, item) => this.drawGrip(context, point, item),
      });
      const top = this.worldToScreen(marker); ctx.fillStyle = '#fb923c'; ctx.font = '11px monospace'; ctx.textAlign = 'center';
      ctx.fillText(`X: ${marker.x.toFixed(1)}`, top.x, top.y - 4);
    }
    drawPipelineCadMarkupOverlay(this, ctx, this.markupProjection);
    drawPipelineCadSelectionBox(this, ctx);
  }
}
