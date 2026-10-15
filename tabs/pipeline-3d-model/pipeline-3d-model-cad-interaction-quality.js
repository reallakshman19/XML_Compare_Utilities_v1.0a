import {
  clamp,
  formatDepth,
  interpolateAbsoluteHFromCumulative,
} from './pipeline-3d-model-cad-math.js';
import { Table2XCanvas } from './pipeline-3d-model-table2x-canvas.js';
import { Table3XCanvas } from './pipeline-3d-model-table3x-canvas.js';

const QUALITY_PATCH = Symbol.for('pipeline3d.cad.interaction-quality.patch.v1');
const GRAPH_ENHANCED = Symbol.for('pipeline3d.cad.interaction-quality.graph.v1');
const STYLE_ID = 'pipeline-3d-cad-interaction-quality-style';
const RENDER_FRAMES = new WeakMap();
const DEFAULT_MAX_LABELS = 160;
const KEYBOARD_HELP = 'Arrow Left or Right selects an entity. Arrow Up or Down adjusts elevation or depth. Shift plus Arrow Left or Right moves a marker. Enter edits. Delete removes. Plus or Minus zooms. Zero fits the graph.';

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function graphName(graph) {
  return graph instanceof Table3XCanvas ? 'table3x' : 'table2x';
}

function selectedId(graph) {
  return graph instanceof Table3XCanvas ? graph.selected?.id ?? null : graph.selectedId ?? null;
}

function entityType(graph, entity) {
  if (graph instanceof Table2XCanvas) return 'elevation-node';
  return entity?.type || 'depth-node';
}

export function rectanglesOverlap(a, b, padding = 2) {
  const gap = Math.max(0, finite(padding, 2));
  return !(
    a.right + gap <= b.left
    || b.right + gap <= a.left
    || a.bottom + gap <= b.top
    || b.bottom + gap <= a.top
  );
}

function centeredRect(x, y, width, height) {
  return {
    left: x - width / 2,
    right: x + width / 2,
    top: y - height / 2,
    bottom: y + height / 2,
  };
}

function clampPlacement(x, y, width, height, bounds) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  return {
    x: clamp(x, bounds.left + halfWidth, bounds.right - halfWidth),
    y: clamp(y, bounds.top + halfHeight, bounds.bottom - halfHeight),
  };
}

export function selectVisibleLabels(labels, options = {}) {
  const source = Array.isArray(labels) ? labels : [];
  const maxLabels = Math.max(1, Math.floor(finite(options.maxLabels, DEFAULT_MAX_LABELS)));
  if (source.length <= maxLabels) return source.slice();

  const selected = source.filter((label) => label.selected);
  const priority = source
    .filter((label) => !label.selected && finite(label.priority) >= 500)
    .sort((a, b) => finite(b.priority) - finite(a.priority) || finite(a.preferredX) - finite(b.preferredX));
  const retained = [...selected, ...priority].slice(0, maxLabels);
  const retainedIds = new Set(retained.map((label) => label.id));
  const remaining = source
    .filter((label) => !retainedIds.has(label.id))
    .sort((a, b) => finite(a.preferredX) - finite(b.preferredX));

  const capacity = maxLabels - retained.length;
  if (capacity <= 0 || !remaining.length) return retained;
  const stride = remaining.length / capacity;
  for (let index = 0; index < capacity; index += 1) {
    const candidate = remaining[Math.min(remaining.length - 1, Math.floor(index * stride))];
    if (!retainedIds.has(candidate.id)) {
      retained.push(candidate);
      retainedIds.add(candidate.id);
    }
  }
  return retained;
}

export function placeCollisionManagedLabels(labels, bounds, options = {}) {
  const padding = Math.max(0, finite(options.padding, 3));
  const occupied = [];
  const placed = [];
  const ordered = (Array.isArray(labels) ? labels : []).slice().sort((a, b) => (
    finite(b.priority) - finite(a.priority)
    || finite(a.preferredX) - finite(b.preferredX)
  ));

  for (const label of ordered) {
    const width = Math.max(8, finite(label.width, 40));
    const height = Math.max(8, finite(label.height, 18));
    const offsets = Array.isArray(label.candidateOffsets) && label.candidateOffsets.length
      ? label.candidateOffsets
      : [0, -18, 18, -36, 36, -54, 54];
    let placement = null;

    for (const offset of offsets) {
      const next = clampPlacement(
        finite(label.preferredX),
        finite(label.preferredY) + finite(offset),
        width,
        height,
        bounds,
      );
      const rect = centeredRect(next.x, next.y, width, height);
      if (!occupied.some((candidate) => rectanglesOverlap(rect, candidate, padding))) {
        placement = { ...label, ...next, width, height, rect, forced: false };
        break;
      }
    }

    if (!placement && label.selected) {
      const next = clampPlacement(
        finite(label.preferredX),
        finite(label.preferredY),
        width,
        height,
        bounds,
      );
      placement = {
        ...label,
        ...next,
        width,
        height,
        rect: centeredRect(next.x, next.y, width, height),
        forced: true,
      };
    }

    if (placement) {
      occupied.push(placement.rect);
      placed.push(placement);
    }
  }
  return placed;
}

function allEntities(graph) {
  if (graph instanceof Table2XCanvas) {
    return graph.currentNodes().map((node, index, rows) => ({
      ...node,
      type: 'elevation-node',
      endpoint: index === 0 || index === rows.length - 1,
    }));
  }
  if (graph instanceof Table3XCanvas) {
    return [
      ...graph.markerNodes().map((node) => ({ ...node, type: 'marker' })),
      ...graph.depthNodes().map((node) => ({ ...node, type: 'depth-node' })),
    ];
  }
  return [];
}

function orderedEntities(graph) {
  return allEntities(graph).sort((a, b) => (
    finite(a.x) - finite(b.x)
    || String(a.type).localeCompare(String(b.type))
    || String(a.id).localeCompare(String(b.id))
  ));
}

function entityById(graph, id) {
  return orderedEntities(graph).find((entity) => entity.id === id) ?? null;
}

function describeEntity(graph, entity, index = null, total = null) {
  if (!entity) return 'No graph entity selected.';
  const position = Number.isInteger(index) && Number.isInteger(total)
    ? ` ${index + 1} of ${total}.`
    : '';
  if (graph instanceof Table2XCanvas) {
    return `Table 2 elevation node${position} Station ${entity.stationText || entity.x}. Elevation ${finite(entity.y).toFixed(2)}.`;
  }
  if (entity.type === 'marker') {
    return `Table 3 marker${position} ${entity.text || entity.id}. Cumulative X ${finite(entity.x).toFixed(1)}.`;
  }
  return `Table 3 depth node${position} ${formatDepth(entity.y)} at cumulative X ${finite(entity.x).toFixed(1)}.`;
}

function announce(graph, message) {
  const live = graph.__pipelineCadLiveRegion;
  if (!live) return;
  live.textContent = '';
  queueMicrotask(() => {
    live.textContent = String(message || '');
  });
}

function ensureStyle(doc = globalThis.document) {
  if (!doc?.head || doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.p3d-cad-label-layer{position:absolute;inset:0;z-index:2;overflow:hidden;pointer-events:none}
.p3d-cad-visual-label{position:absolute;max-width:180px;transform:translate(-50%,-50%);padding:2px 5px;border:1px solid rgba(148,163,184,.28);border-radius:4px;background:rgba(2,6,23,.84);color:#dbeafe;font:10px/1.25 ui-monospace,monospace;text-align:center;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.32)}
.p3d-cad-visual-label[data-kind="marker"]{border-color:rgba(52,211,153,.52);color:#a7f3d0}
.p3d-cad-visual-label[data-kind="depth-node"]{border-color:rgba(244,114,182,.45);color:#fbcfe8}
.p3d-cad-visual-label[data-selected="true"]{border-color:#f8fafc;background:rgba(30,41,59,.96);color:#fff;box-shadow:0 0 0 2px rgba(250,204,21,.8),0 4px 14px rgba(0,0,0,.5);font-weight:700}
.p3d-cad-visual-label>span{display:block}
.p3d-cad-sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
.p3d-cad-stage canvas[role="application"]:focus-visible{box-shadow:inset 0 0 0 3px rgba(250,204,21,.92)!important}
.p3d-cad-toolbar button{min-width:36px;min-height:36px}
@media (pointer:coarse){.p3d-cad-toolbar button{min-width:44px;min-height:44px;padding:8px 11px}.p3d-cad-context-menu button{min-height:44px}}
`;
  doc.head.appendChild(style);
}

function ensureGraphAccessibility(graph) {
  if (graph[GRAPH_ENHANCED] || !graph.canvas) return;
  Object.defineProperty(graph, GRAPH_ENHANCED, { value: true });
  const canvas = graph.canvas;
  const stage = canvas.closest?.('[data-p3d-cad-stage]');
  const doc = canvas.ownerDocument || globalThis.document;
  if (!stage || !doc) return;
  ensureStyle(doc);

  const name = graphName(graph);
  const instructionsId = `p3d-cad-${name}-instructions`;
  const liveId = `p3d-cad-${name}-live`;
  let layer = stage.querySelector('[data-p3d-cad-label-layer]');
  if (!layer) {
    layer = doc.createElement('div');
    layer.className = 'p3d-cad-label-layer';
    layer.dataset.p3dCadLabelLayer = name;
    layer.setAttribute('aria-hidden', 'true');
    stage.appendChild(layer);
  }

  let instructions = stage.querySelector(`#${instructionsId}`);
  if (!instructions) {
    instructions = doc.createElement('p');
    instructions.id = instructionsId;
    instructions.className = 'p3d-cad-sr-only';
    instructions.textContent = KEYBOARD_HELP;
    stage.appendChild(instructions);
  }

  let live = stage.querySelector(`#${liveId}`);
  if (!live) {
    live = doc.createElement('div');
    live.id = liveId;
    live.className = 'p3d-cad-sr-only';
    live.dataset.p3dCadLive = name;
    live.setAttribute('role', 'status');
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('aria-atomic', 'true');
    stage.appendChild(live);
  }

  const describedBy = new Set(String(canvas.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
  describedBy.add(instructionsId);
  describedBy.add(liveId);
  canvas.setAttribute('aria-describedby', [...describedBy].join(' '));
  canvas.setAttribute('role', 'application');
  canvas.setAttribute('aria-roledescription', 'interactive engineering profile graph');
  canvas.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight ArrowUp ArrowDown Shift+ArrowLeft Shift+ArrowRight Home End Enter Delete Backspace Escape + - 0');
  canvas.dataset.p3dCadKeyboard = 'enabled';
  graph.__pipelineCadLabelLayer = layer;
  graph.__pipelineCadLiveRegion = live;

  const onFocus = () => {
    const entity = entityById(graph, selectedId(graph));
    announce(graph, entity ? describeEntity(graph, entity) : KEYBOARD_HELP);
  };
  const onSelection = () => {
    const entities = orderedEntities(graph);
    const id = selectedId(graph);
    const index = entities.findIndex((entity) => entity.id === id);
    announce(graph, index >= 0 ? describeEntity(graph, entities[index], index, entities.length) : 'Selection cleared.');
    queueGraphOverlay(graph);
  };
  const onTool = (event) => announce(graph, `Tool ${event.detail?.tool || graph.tool}.`);
  canvas.addEventListener('focus', onFocus);
  graph.addEventListener('selectionChanged', onSelection);
  graph.addEventListener('toolChanged', onTool);
  canvas.addEventListener('keydown', (event) => handleGraphKeyDown(graph, event));
  graph.destroyCallbacks?.push?.(() => {
    canvas.removeEventListener('focus', onFocus);
    graph.removeEventListener('selectionChanged', onSelection);
    graph.removeEventListener('toolChanged', onTool);
  });
}

function selectedEntity(graph) {
  return entityById(graph, selectedId(graph));
}

function setSelectedEntity(graph, entity) {
  if (!entity) return false;
  if (graph instanceof Table2XCanvas) {
    graph.selectedId = entity.id;
    graph.draggingId = null;
  } else {
    graph.selected = { id: entity.id, type: entity.type };
    graph.dragging = null;
  }
  ensureEntityVisible(graph, entity);
  graph.dispatchGraphEvent('selectionChanged', {
    graph: graphName(graph),
    entityId: entity.id,
    entityType: entityType(graph, entity),
    source: 'keyboard',
  });
  graph.render();
  return true;
}

function clearSelection(graph) {
  if (graph instanceof Table2XCanvas) {
    graph.selectedId = null;
    graph.draggingId = null;
  } else {
    graph.selected = null;
    graph.dragging = null;
  }
  graph.dispatchGraphEvent('selectionChanged', { graph: graphName(graph), source: 'keyboard-clear' });
  graph.render();
}

function ensureEntityVisible(graph, entity) {
  const plot = graph.getPlotRect();
  const screen = graph.worldToScreen(entity);
  const margin = 28;
  let dx = 0;
  let dy = 0;
  if (screen.x < plot.left + margin) dx = plot.left + margin - screen.x;
  else if (screen.x > plot.right - margin) dx = plot.right - margin - screen.x;
  if (screen.y < plot.top + margin) dy = plot.top + margin - screen.y;
  else if (screen.y > plot.bottom - margin) dy = plot.bottom - margin - screen.y;
  if (dx || dy) graph.panBy(dx, dy);
}

function cycleSelection(graph, direction, edge = null) {
  const entities = orderedEntities(graph);
  if (!entities.length) return false;
  let index = entities.findIndex((entity) => entity.id === selectedId(graph));
  if (edge === 'first') index = 0;
  else if (edge === 'last') index = entities.length - 1;
  else if (index < 0) index = direction >= 0 ? 0 : entities.length - 1;
  else index = (index + direction + entities.length) % entities.length;
  return setSelectedEntity(graph, entities[index]);
}

function dispatchKeyboardMove(graph, entity, next) {
  const name = graphName(graph);
  if (graph instanceof Table2XCanvas) {
    graph.dispatchGraphEvent('nodeMoved', {
      graph: name,
      entityId: entity.id,
      entityType: 'elevation-node',
      after: { elevationValue: next.y },
      commitReason: 'keyboard-nudge',
    });
    return;
  }
  if (entity.type === 'marker') {
    graph.dispatchGraphEvent('nodeMoved', {
      graph: name,
      entityId: entity.id,
      entityType: 'marker',
      after: {
        cumulative: next.x,
        absoluteH: interpolateAbsoluteHFromCumulative(next.x, graph.model.coordinateMap),
      },
      commitReason: 'keyboard-nudge',
    });
  } else {
    graph.dispatchGraphEvent('nodeMoved', {
      graph: name,
      entityId: entity.id,
      entityType: 'depth-node',
      after: { z: next.y, zText: formatDepth(next.y) },
      commitReason: 'keyboard-nudge',
    });
  }
}

function openSelectedEditor(graph, entity) {
  const canvas = graph.canvas;
  const MouseEventCtor = canvas?.ownerDocument?.defaultView?.MouseEvent || globalThis.MouseEvent;
  if (!canvas || typeof MouseEventCtor !== 'function') return false;
  const local = graph.worldToScreen(entity);
  const rect = canvas.getBoundingClientRect();
  const clientX = rect.left + local.x * (rect.width / graph.width);
  const clientY = rect.top + local.y * (rect.height / graph.height);
  canvas.dispatchEvent(new MouseEventCtor('dblclick', {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
  }));
  return true;
}

function handleGraphKeyDown(graph, event) {
  if (event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey) return;
  const key = event.key;
  let handled = false;
  const entity = selectedEntity(graph);

  if (key === 'ArrowLeft' && event.shiftKey && entity?.type === 'marker') {
    const step = 0.5;
    const x = clamp(entity.x - step, graph.bounds.minX, graph.bounds.maxX);
    dispatchKeyboardMove(graph, entity, { ...entity, x });
    handled = true;
  } else if (key === 'ArrowRight' && event.shiftKey && entity?.type === 'marker') {
    const step = 0.5;
    const x = clamp(entity.x + step, graph.bounds.minX, graph.bounds.maxX);
    dispatchKeyboardMove(graph, entity, { ...entity, x });
    handled = true;
  } else if (key === 'ArrowLeft') {
    handled = cycleSelection(graph, -1);
  } else if (key === 'ArrowRight') {
    handled = cycleSelection(graph, 1);
  } else if (key === 'Home') {
    handled = cycleSelection(graph, 1, 'first');
  } else if (key === 'End') {
    handled = cycleSelection(graph, 1, 'last');
  } else if ((key === 'ArrowUp' || key === 'ArrowDown') && entity && entity.type !== 'marker') {
    const baseStep = graph instanceof Table2XCanvas ? 0.05 : 0.1;
    const step = baseStep * (event.shiftKey ? 10 : 1);
    const direction = key === 'ArrowUp' ? 1 : -1;
    dispatchKeyboardMove(graph, entity, { ...entity, y: entity.y + direction * step });
    handled = true;
  } else if (key === 'Enter' && entity) {
    handled = openSelectedEditor(graph, entity);
  } else if ((key === 'Delete' || key === 'Backspace') && entity) {
    graph.dispatchGraphEvent('nodeDeleted', {
      graph: graphName(graph),
      entityId: entity.id,
      entityType: entityType(graph, entity),
      source: 'keyboard',
    });
    handled = true;
  } else if (key === 'Escape') {
    clearSelection(graph);
    handled = true;
  } else if (key === '0') {
    graph.fitToBounds();
    handled = true;
  } else if (key === '+' || key === '=') {
    const plot = graph.getPlotRect();
    graph.zoomAt({ x: plot.left + plot.width / 2, y: plot.top + plot.height / 2 }, 1.2);
    handled = true;
  } else if (key === '-' || key === '_') {
    const plot = graph.getPlotRect();
    graph.zoomAt({ x: plot.left + plot.width / 2, y: plot.top + plot.height / 2 }, 1 / 1.2);
    handled = true;
  }

  if (handled) {
    event.preventDefault();
    event.stopPropagation();
    queueGraphOverlay(graph);
  }
}

function buildVisualLabels(graph) {
  const entities = orderedEntities(graph);
  const currentSelectedId = selectedId(graph);
  return entities.map((entity, index) => {
    const point = graph.worldToScreen(entity);
    const selected = entity.id === currentSelectedId;
    const isMarker = entity.type === 'marker';
    const isDepth = entity.type === 'depth-node';
    const lines = graph instanceof Table2XCanvas
      ? [finite(entity.y).toFixed(2)]
      : isMarker
        ? [String(entity.text || entity.id), `X: ${finite(entity.x).toFixed(1)}`]
        : [formatDepth(entity.y)];
    const longest = Math.max(...lines.map((line) => line.length), 1);
    const width = Math.min(180, Math.max(34, longest * 6.7 + 12));
    const height = lines.length * 13 + 7;
    const priority = selected
      ? 1000
      : isMarker
        ? 800
        : entity.endpoint
          ? 700
          : isDepth
            ? 300
            : 100;
    const preferredY = graph instanceof Table2XCanvas
      ? point.y - 18
      : isMarker
        ? point.y - 24
        : point.y + 22;
    const candidateOffsets = graph instanceof Table2XCanvas
      ? [0, -18, 18, -36, 36, -54, 54]
      : isMarker
        ? [0, -24, 24, -48, 48, -72, 72]
        : [0, 18, -18, 36, -36, 54, -54];
    return {
      id: entity.id,
      kind: entity.type,
      lines,
      preferredX: point.x,
      preferredY,
      width,
      height,
      priority,
      selected,
      candidateOffsets,
      index,
    };
  });
}

function renderLabelOverlay(graph) {
  ensureGraphAccessibility(graph);
  const layer = graph.__pipelineCadLabelLayer;
  const stage = graph.canvas?.closest?.('[data-p3d-cad-stage]');
  if (!layer || !stage) return;
  const plot = graph.getPlotRect();
  const all = buildVisualLabels(graph).filter((label) => (
    label.preferredX >= plot.left - 30
    && label.preferredX <= plot.right + 30
    && label.preferredY >= plot.top - 60
    && label.preferredY <= plot.bottom + 60
  ));
  const maxLabels = Math.max(24, Math.min(DEFAULT_MAX_LABELS, Math.floor(plot.width / 5)));
  const sampled = selectVisibleLabels(all, { maxLabels });
  const placements = placeCollisionManagedLabels(sampled, {
    left: plot.left + 2,
    right: plot.right - 2,
    top: plot.top + 2,
    bottom: plot.bottom - 2,
  }, { padding: 3 });

  const canvasRect = graph.canvas.getBoundingClientRect();
  const stageRect = stage.getBoundingClientRect();
  const scaleX = canvasRect.width / graph.width;
  const scaleY = canvasRect.height / graph.height;
  const doc = graph.canvas.ownerDocument || globalThis.document;
  const fragment = doc.createDocumentFragment();
  for (const placement of placements) {
    const label = doc.createElement('div');
    label.className = 'p3d-cad-visual-label';
    label.dataset.p3dCadVisualLabel = placement.id;
    label.dataset.kind = placement.kind;
    label.dataset.selected = placement.selected ? 'true' : 'false';
    label.style.left = `${canvasRect.left - stageRect.left + placement.x * scaleX}px`;
    label.style.top = `${canvasRect.top - stageRect.top + placement.y * scaleY}px`;
    for (const line of placement.lines) {
      const span = doc.createElement('span');
      span.textContent = line;
      label.appendChild(span);
    }
    fragment.appendChild(label);
  }
  layer.replaceChildren(fragment);
  layer.dataset.visibleLabels = String(placements.length);
  layer.dataset.suppressedLabels = String(Math.max(0, all.length - placements.length));
}

function drawSelectionBeacon(graph) {
  const entity = selectedEntity(graph);
  const ctx = graph.context;
  if (!entity || !ctx) return;
  const point = graph.worldToScreen(entity);
  const plot = graph.getPlotRect();
  if (point.x < plot.left || point.x > plot.right || point.y < plot.top || point.y > plot.bottom) return;
  ctx.save();
  ctx.beginPath();
  ctx.arc(point.x, point.y, 13, 0, Math.PI * 2);
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([4, 3]);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(point.x - 17, point.y);
  ctx.lineTo(point.x + 17, point.y);
  ctx.moveTo(point.x, point.y - 17);
  ctx.lineTo(point.x, point.y + 17);
  ctx.strokeStyle = 'rgba(250,204,21,.9)';
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.stroke();
  ctx.restore();
}

function queueGraphOverlay(graph) {
  if (!graph?.canvas || RENDER_FRAMES.has(graph)) return;
  const schedule = globalThis.requestAnimationFrame
    ? (callback) => globalThis.requestAnimationFrame(callback)
    : (callback) => queueMicrotask(callback);
  const handle = schedule(() => {
    RENDER_FRAMES.delete(graph);
    renderLabelOverlay(graph);
  });
  RENDER_FRAMES.set(graph, handle || true);
}

function patchCanvasPrototype(prototype) {
  if (prototype[QUALITY_PATCH]) return;
  Object.defineProperty(prototype, QUALITY_PATCH, { value: true });

  const originalSetModel = prototype.setModel;
  prototype.setModel = function qualitySetModel(...args) {
    const result = originalSetModel.apply(this, args);
    ensureGraphAccessibility(this);
    queueGraphOverlay(this);
    return result;
  };

  const originalRender = prototype.render;
  prototype.render = function qualityRender(...args) {
    const context = this.context;
    let nativeFillText = null;
    let suppressed = false;
    if (context?.fillText) {
      nativeFillText = context.fillText;
      try {
        context.fillText = () => {};
        suppressed = true;
      } catch {
        suppressed = false;
      }
    }
    try {
      return originalRender.apply(this, args);
    } finally {
      if (suppressed && nativeFillText) {
        try {
          context.fillText = nativeFillText;
        } catch {
          // Some Canvas implementations expose a read-only method.
        }
      }
      drawSelectionBeacon(this);
      queueGraphOverlay(this);
    }
  };
}

export function installPipelineCadInteractionQuality() {
  patchCanvasPrototype(Table2XCanvas.prototype);
  patchCanvasPrototype(Table3XCanvas.prototype);
  return true;
}

installPipelineCadInteractionQuality();
