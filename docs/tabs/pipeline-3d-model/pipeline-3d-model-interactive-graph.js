import { clamp } from './pipeline-3d-model-cad-math.js';

export const GraphTool = Object.freeze({
  SELECT: 'select',
  ADD_NODE: 'add-node',
  ADD_MARKER: 'add-marker',
  DELETE: 'delete',
  PAN: 'pan',
});

const DEFAULT_PADDING = Object.freeze({ left: 60, right: 40, top: 40, bottom: 60 });

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export class InteractiveGraph extends EventTarget {
  constructor(canvas, options = {}) {
    super();
    this.canvas = canvas ?? null;
    this.context = canvas?.getContext?.('2d') ?? null;
    this.padding = { ...DEFAULT_PADDING, ...(options.padding || {}) };
    this.tool = options.tool || GraphTool.SELECT;
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.minZoom = finite(options.minZoom, 0.1);
    this.maxZoom = finite(options.maxZoom, 40);
    this.width = finite(options.width, 1000);
    this.height = finite(options.height, 500);
    this.bounds = { minX: 0, maxX: 1, minY: 0, maxY: 1 };
    this.destroyCallbacks = [];
    this.spacePressed = false;
    this.pointerState = null;
    this.#bindNavigation();
  }

  setTool(tool) {
    if (!Object.values(GraphTool).includes(tool)) throw new Error(`Unsupported graph tool: ${tool}`);
    this.tool = tool;
    this.dispatchGraphEvent('toolChanged', { tool });
  }

  setSize(width, height) {
    this.width = Math.max(1, finite(width, this.width));
    this.height = Math.max(1, finite(height, this.height));
    if (this.canvas) {
      const dpr = globalThis.devicePixelRatio || 1;
      this.canvas.width = Math.round(this.width * dpr);
      this.canvas.height = Math.round(this.height * dpr);
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;
      if (this.context) this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    this.render();
  }

  setWorldBounds(bounds, options = {}) {
    const next = {
      minX: finite(bounds?.minX, 0),
      maxX: finite(bounds?.maxX, 1),
      minY: finite(bounds?.minY, 0),
      maxY: finite(bounds?.maxY, 1),
    };
    if (next.maxX <= next.minX) next.maxX = next.minX + 1;
    if (next.maxY <= next.minY) next.maxY = next.minY + 1;
    this.bounds = next;
    if (options.fit !== false) this.fitToBounds();
    else this.render();
  }

  fitToBounds() {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.dispatchGraphEvent('viewportChanged', this.getViewport());
    this.render();
  }

  getViewport() {
    return Object.freeze({
      zoom: this.zoom,
      panX: this.panX,
      panY: this.panY,
      width: this.width,
      height: this.height,
      bounds: { ...this.bounds },
      padding: { ...this.padding },
    });
  }

  getPlotRect() {
    const left = this.padding.left;
    const top = this.padding.top;
    const width = Math.max(1, this.width - this.padding.left - this.padding.right);
    const height = Math.max(1, this.height - this.padding.top - this.padding.bottom);
    return { left, top, width, height, right: left + width, bottom: top + height };
  }

  worldToScreen(point) {
    const plot = this.getPlotRect();
    const centerX = (this.bounds.minX + this.bounds.maxX) / 2;
    const centerY = (this.bounds.minY + this.bounds.maxY) / 2;
    const scaleX = plot.width / (this.bounds.maxX - this.bounds.minX);
    const scaleY = plot.height / (this.bounds.maxY - this.bounds.minY);
    return {
      x: plot.left + plot.width / 2 + (Number(point.x) - centerX) * scaleX * this.zoom + this.panX,
      y: plot.top + plot.height / 2 - (Number(point.y) - centerY) * scaleY * this.zoom + this.panY,
    };
  }

  screenToWorld(point) {
    const plot = this.getPlotRect();
    const centerX = (this.bounds.minX + this.bounds.maxX) / 2;
    const centerY = (this.bounds.minY + this.bounds.maxY) / 2;
    const scaleX = plot.width / (this.bounds.maxX - this.bounds.minX);
    const scaleY = plot.height / (this.bounds.maxY - this.bounds.minY);
    return {
      x: centerX + (Number(point.x) - plot.left - plot.width / 2 - this.panX) / (scaleX * this.zoom),
      y: centerY - (Number(point.y) - plot.top - plot.height / 2 - this.panY) / (scaleY * this.zoom),
    };
  }

  zoomAt(screenPoint, factor) {
    const before = this.screenToWorld(screenPoint);
    this.zoom = clamp(this.zoom * Number(factor), this.minZoom, this.maxZoom);
    const after = this.worldToScreen(before);
    this.panX += Number(screenPoint.x) - after.x;
    this.panY += Number(screenPoint.y) - after.y;
    this.dispatchGraphEvent('viewportChanged', this.getViewport());
    this.render();
  }

  panBy(dx, dy) {
    this.panX += Number(dx) || 0;
    this.panY += Number(dy) || 0;
    this.dispatchGraphEvent('viewportChanged', this.getViewport());
    this.render();
  }

  eventToScreen(event) {
    const rect = this.canvas?.getBoundingClientRect?.() ?? { left: 0, top: 0, width: this.width, height: this.height };
    return {
      x: (event.clientX - rect.left) * (this.width / (rect.width || this.width)),
      y: (event.clientY - rect.top) * (this.height / (rect.height || this.height)),
    };
  }

  dispatchGraphEvent(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  drawGrid(context = this.context, options = {}) {
    if (!context) return;
    const plot = this.getPlotRect();
    const spacing = finite(options.spacing, 40);
    context.save();
    context.strokeStyle = options.strokeStyle || '#1e293b';
    context.lineWidth = 1;
    context.beginPath();
    for (let x = plot.left + (this.panX % spacing); x <= plot.right; x += spacing) {
      context.moveTo(x, plot.top);
      context.lineTo(x, plot.bottom);
    }
    for (let y = plot.top + (this.panY % spacing); y <= plot.bottom; y += spacing) {
      context.moveTo(plot.left, y);
      context.lineTo(plot.right, y);
    }
    context.stroke();
    context.restore();
  }

  hitTest() {
    return null;
  }

  onPrimaryPointerDown() {}
  onPrimaryPointerMove() {}
  onPrimaryPointerUp() {}
  render() {}

  destroy() {
    for (const cleanup of this.destroyCallbacks.splice(0)) cleanup();
    this.pointerState = null;
  }

  #bindNavigation() {
    if (!this.canvas?.addEventListener) return;

    const onWheel = (event) => {
      event.preventDefault?.();
      const screen = this.eventToScreen(event);
      this.zoomAt(screen, Math.exp(-Number(event.deltaY || 0) * 0.001));
    };

    const onPointerDown = (event) => {
      const screen = this.eventToScreen(event);
      const panGesture = event.button === 1 || this.tool === GraphTool.PAN || (event.button === 0 && this.spacePressed);
      this.pointerState = {
        pointerId: event.pointerId,
        screen,
        lastScreen: screen,
        panGesture,
      };
      this.canvas.setPointerCapture?.(event.pointerId);
      if (!panGesture && event.button === 0) this.onPrimaryPointerDown(event, screen, this.screenToWorld(screen));
    };

    const onPointerMove = (event) => {
      if (!this.pointerState || this.pointerState.pointerId !== event.pointerId) return;
      const screen = this.eventToScreen(event);
      if (this.pointerState.panGesture) {
        this.panBy(screen.x - this.pointerState.lastScreen.x, screen.y - this.pointerState.lastScreen.y);
      } else {
        this.onPrimaryPointerMove(event, screen, this.screenToWorld(screen));
      }
      this.pointerState.lastScreen = screen;
    };

    const finishPointer = (event) => {
      if (!this.pointerState || this.pointerState.pointerId !== event.pointerId) return;
      const screen = this.eventToScreen(event);
      if (!this.pointerState.panGesture) this.onPrimaryPointerUp(event, screen, this.screenToWorld(screen));
      this.canvas.releasePointerCapture?.(event.pointerId);
      this.pointerState = null;
    };

    const onKeyDown = (event) => {
      if (event.code === 'Space') this.spacePressed = true;
      if (event.key === 'Escape') {
        this.pointerState = null;
        this.dispatchGraphEvent('interactionCancelled', {});
        this.render();
      }
    };

    const onKeyUp = (event) => {
      if (event.code === 'Space') this.spacePressed = false;
    };

    this.canvas.addEventListener('wheel', onWheel, { passive: false });
    this.canvas.addEventListener('pointerdown', onPointerDown);
    this.canvas.addEventListener('pointermove', onPointerMove);
    this.canvas.addEventListener('pointerup', finishPointer);
    this.canvas.addEventListener('pointercancel', finishPointer);
    globalThis.addEventListener?.('keydown', onKeyDown);
    globalThis.addEventListener?.('keyup', onKeyUp);

    this.destroyCallbacks.push(() => {
      this.canvas.removeEventListener('wheel', onWheel);
      this.canvas.removeEventListener('pointerdown', onPointerDown);
      this.canvas.removeEventListener('pointermove', onPointerMove);
      this.canvas.removeEventListener('pointerup', finishPointer);
      this.canvas.removeEventListener('pointercancel', finishPointer);
      globalThis.removeEventListener?.('keydown', onKeyDown);
      globalThis.removeEventListener?.('keyup', onKeyUp);
    });
  }
}
