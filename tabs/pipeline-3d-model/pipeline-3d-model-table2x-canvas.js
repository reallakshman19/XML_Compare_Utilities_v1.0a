import { GraphTool, InteractiveGraph } from './pipeline-3d-model-interactive-graph.js';
import { projectPointToSegment } from './pipeline-3d-model-cad-math.js';
import {
  emptyPipelineCadMarkupProjection,
  drawPipelineCadMarkupOverlay,
} from './pipeline-3d-model-cad-markup-renderer.js';
import {
  drawPipelineCadSelectionBox,
  installPipelineCadSelectionRuntime,
  selectedPipelineCadItems,
} from './pipeline-3d-model-cad-selection-runtime.js';

function usableRows(model) {
  return (model?.table2Rows || [])
    .filter((row) => Number.isFinite(row.stationValue) && Number.isFinite(row.elevationValue))
    .map((row) => ({
      id: row.id, type: 'elevation-node', x: row.stationValue,
      y: row.elevationValue, stationText: row.stationText,
    }));
}
function modifierActive(event = {}) { return event.shiftKey || event.ctrlKey || event.metaKey; }
function precisionCancel(event) { return String(event.detail?.reason || '').startsWith('precision-'); }

export class Table2XCanvas extends InteractiveGraph {
  constructor(canvas, options = {}) {
    super(canvas, options);
    this.model = null; this.renderSnapshot = []; this.visualOverrides = new Map();
    this.precisionOverrides = new Map(); this.precisionGripId = null;
    this.selectedId = null; this.draggingId = null; this.groupDrag = null;
    this.hitRadius = Number(options.hitRadius) || 10;
    this.pipelineCadMarkupGraph = 'table2x';
    this.markupProjection = emptyPipelineCadMarkupProjection();
    installPipelineCadSelectionRuntime(this, {
      graphName: 'table2x', candidates: () => this.currentNodes(),
      syncLegacy: (detail) => { this.selectedId = detail.primaryId; },
    });
    const cancel = (event) => {
      if (!precisionCancel(event)) this.cancelActiveSelectionInteraction('escape');
    };
    this.addEventListener('interactionCancelled', cancel);
    this.destroyCallbacks.push(() => this.removeEventListener('interactionCancelled', cancel));
  }

  setModel(model, options = {}) {
    this.model = model; const preserveSnapshot = options.preserveSnapshot === true;
    if (!preserveSnapshot) {
      this.renderSnapshot = usableRows(model); this.visualOverrides.clear();
      this.precisionOverrides.clear(); this.precisionGripId = null;
      this.draggingId = null; this.groupDrag = null;
      this.setSelection([], { emit: false, source: 'model-reset' });
    } else if (!this.renderSnapshot.length) this.renderSnapshot = usableRows(model);
    const rows = usableRows(model); const xs = rows.map((row) => row.x); const ys = rows.map((row) => row.y);
    if (!rows.length) { this.render(); return; }
    const minY = Math.min(...ys); const maxY = Math.max(...ys);
    const padY = Math.max((maxY - minY) * 0.2, 0.5);
    this.setWorldBounds({
      minX: Math.min(...xs), maxX: Math.max(...xs),
      minY: minY - padY, maxY: maxY + padY,
    }, { fit: !preserveSnapshot });
  }

  reloadGraph() {
    this.renderSnapshot = usableRows(this.model); this.visualOverrides.clear();
    this.precisionOverrides.clear();
    this.setSelection([], { emit: false, source: 'reload' }); this.model?.clearDirtyRows?.();
    this.dispatchGraphEvent('reloadRequested', { graph: 'table2x' }); this.render();
  }

  currentNodes() {
    return usableRows(this.model).map((row) => {
      const precision = this.precisionOverrides.get(row.id);
      return {
        ...row, x: precision?.x ?? row.x,
        y: this.visualOverrides.get(row.id) ?? precision?.y ?? row.y,
      };
    });
  }
  setMarkupProjection(projection) {
    this.markupProjection = projection || emptyPipelineCadMarkupProjection();
    this.render(); return true;
  }
  setPrecisionPreview(id, point = {}) {
    if (!id) return false;
    this.precisionOverrides.set(id, { x: Number(point.x), y: Number(point.y) });
    this.render(); return true;
  }
  clearPrecisionPreview() { this.precisionOverrides.clear(); this.render(); return true; }
  setPrecisionGrip(id) { this.precisionGripId = id || null; this.render(); }

  hitTest(screenPoint) {
    let best = null; let distance = this.hitRadius;
    for (const node of this.currentNodes()) {
      const screen = this.worldToScreen(node);
      const next = Math.hypot(screen.x - screenPoint.x, screen.y - screenPoint.y);
      if (next < distance) {
        distance = next; best = { type: 'elevation-node', node, screen };
      }
    }
    return best;
  }

  nearestProfileProjection(worldPoint) {
    if (this.renderSnapshot.length < 2) return null;
    let best = null;
    for (let index = 0; index < this.renderSnapshot.length - 1; index += 1) {
      const start = this.renderSnapshot[index]; const end = this.renderSnapshot[index + 1];
      const projection = projectPointToSegment(worldPoint, start, end);
      if (!best || projection.distance < best.distance) {
        best = { ...projection, start, end, index };
      }
    }
    return best;
  }

  beginGroupDrag(hit, event, world) {
    if (modifierActive(event) || !this.isSelected(hit.node.id)) return false;
    const items = selectedPipelineCadItems(this, 'elevation-node');
    this.draggingId = hit.node.id;
    if (items.length < 2) return false;
    const initial = new Map(this.currentNodes().map((node) => [node.id, node.y]));
    this.groupDrag = { startY: world.y, ids: items.map((item) => item.id), initial };
    return true;
  }

  onPrimaryPointerDown(event, screen, world) {
    const hit = this.hitTest(screen);
    if (this.tool === GraphTool.DELETE && hit) {
      this.dispatchGraphEvent('nodeDeleted', {
        graph: 'table2x', entityId: hit.node.id, entityType: hit.type,
      }); return;
    }
    if (this.tool === GraphTool.ADD_NODE) {
      const projection = this.nearestProfileProjection(world);
      if (projection) this.dispatchGraphEvent('nodeAdded', {
        graph: 'table2x', entityType: 'elevation-node',
        stationValue: projection.x, elevationValue: projection.y,
        insertAfterId: projection.start.id, insertBeforeId: projection.end.id,
      });
      return;
    }
    if (this.tool !== GraphTool.SELECT) return;
    this.clearPrecisionPreview();
    if (!hit) {
      this.draggingId = null; this.groupDrag = null;
      this.beginSelectionBox(screen, event); return;
    }
    this.selectHit(hit, event);
    if (modifierActive(event) || !this.isSelected(hit.node.id)) return;
    this.beginGroupDrag(hit, event, world); this.render();
  }

  onPrimaryPointerMove(event, screen, world) {
    if (this.pipelineCadSelectionState.box) { this.updateSelectionBox(screen); return; }
    if (this.groupDrag) {
      const delta = world.y - this.groupDrag.startY;
      for (const id of this.groupDrag.ids) {
        this.visualOverrides.set(id, this.groupDrag.initial.get(id) + delta);
      }
      this.dispatchGraphEvent('batchPreviewMoved', {
        graph: 'table2x', entityType: 'elevation-node',
        entityIds: [...this.groupDrag.ids], delta: { y: delta },
      });
      this.render(); return;
    }
    if (!this.draggingId) return;
    this.visualOverrides.set(this.draggingId, world.y);
    this.dispatchGraphEvent('nodePreviewMoved', {
      graph: 'table2x', entityId: this.draggingId,
      entityType: 'elevation-node', elevationValue: world.y,
    });
    this.render();
  }

  onPrimaryPointerUp(event, screen, world) {
    if (this.pipelineCadSelectionState.box) { this.finishSelectionBox(); return; }
    if (this.groupDrag) {
      const drag = this.groupDrag; const delta = world.y - drag.startY;
      const edits = drag.ids.map((id) => ({
        id, elevation: drag.initial.get(id) + delta,
      }));
      this.groupDrag = null; this.draggingId = null;
      this.dispatchGraphEvent('batchMoved', {
        graph: 'table2x', entityType: 'elevation-node',
        entityIds: edits.map((edit) => edit.id), edits,
        skippedEntityIds: [], delta: { y: delta },
      });
      this.render(); return;
    }
    if (!this.draggingId) return;
    const entityId = this.draggingId; this.draggingId = null;
    this.visualOverrides.set(entityId, world.y);
    this.dispatchGraphEvent('nodeMoved', {
      graph: 'table2x', entityId, entityType: 'elevation-node',
      after: { elevationValue: world.y }, commitReason: 'pointer-release',
    });
    this.render();
  }

  cancelActiveSelectionInteraction(source = 'cancel') {
    this.groupDrag = null; this.draggingId = null; this.visualOverrides.clear();
    this.cancelSelectionBox(); this.clearSelection({ source });
  }
  drawPrecisionGrip(ctx, point, node) {
    if (node.id !== this.precisionGripId || node.id !== this.selectedId) return;
    ctx.save(); ctx.strokeStyle = '#f8fafc'; ctx.fillStyle = '#0ea5e9'; ctx.lineWidth = 2;
    ctx.fillRect(point.x - 5, point.y - 5, 10, 10);
    ctx.strokeRect(point.x - 7, point.y - 7, 14, 14); ctx.restore();
  }

  render() {
    const ctx = this.context; if (!ctx) return;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.fillStyle = '#0b1220'; ctx.fillRect(0, 0, this.width, this.height);
    this.drawGrid(ctx);
    if (this.renderSnapshot.length > 1) {
      ctx.save(); ctx.beginPath();
      const first = this.worldToScreen(this.renderSnapshot[0]);
      ctx.moveTo(first.x, first.y);
      for (let index = 1; index < this.renderSnapshot.length; index += 1) {
        const point = this.worldToScreen(this.renderSnapshot[index]);
        ctx.lineTo(point.x, point.y);
      }
      ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 3;
      ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore();
    }
    for (const node of this.currentNodes()) {
      const point = this.worldToScreen(node);
      const selected = this.isSelected(node.id); const primary = node.id === this.selectedId;
      ctx.beginPath(); ctx.arc(point.x, point.y, selected ? 8 : 6, 0, Math.PI * 2);
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = primary ? '#ffffff' : selected ? '#22d3ee' : '#0f172a';
      ctx.lineWidth = selected ? 2.5 : 2; ctx.fill(); ctx.stroke();
      this.drawPrecisionGrip(ctx, point, node);
      ctx.fillStyle = '#cbd5e1'; ctx.font = '11px monospace'; ctx.textAlign = 'center';
      ctx.fillText(Number(node.y).toFixed(2), point.x, point.y - 12);
    }
    drawPipelineCadMarkupOverlay(this, ctx, this.markupProjection);
    drawPipelineCadSelectionBox(this, ctx);
  }
}
