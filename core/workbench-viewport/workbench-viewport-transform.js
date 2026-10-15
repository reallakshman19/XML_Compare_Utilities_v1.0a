function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positive(value, fallback = 1) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeBounds(bounds = {}) {
  const minX = finite(bounds.minX, 0);
  const maxX = finite(bounds.maxX, minX + 1);
  const minY = finite(bounds.minY, 0);
  const maxY = finite(bounds.maxY, minY + 1);
  return Object.freeze({ minX, maxX: maxX > minX ? maxX : minX + 1, minY, maxY: maxY > minY ? maxY : minY + 1 });
}

function normalizePlot(plot = {}) {
  const left = finite(plot.left, 0);
  const top = finite(plot.top, 0);
  const width = positive(plot.width, Math.max(1, finite(plot.right, 1) - left));
  const height = positive(plot.height, Math.max(1, finite(plot.bottom, 1) - top));
  return Object.freeze({ left, top, width, height, right: left + width, bottom: top + height });
}

export function createWorkbenchTransform(bounds, plot, view = {}) {
  const world = normalizeBounds(bounds);
  const screen = normalizePlot(plot);
  const spanX = Math.max(1e-12, world.maxX - world.minX);
  const spanY = Math.max(1e-12, world.maxY - world.minY);
  return Object.freeze({
    bounds: world,
    plot: screen,
    centerX: (world.minX + world.maxX) / 2,
    centerY: (world.minY + world.maxY) / 2,
    scaleX: screen.width / spanX,
    scaleY: screen.height / spanY,
    zoomX: positive(view.zoomX, 1),
    zoomY: positive(view.zoomY, 1),
    panX: finite(view.panX, 0),
    panY: finite(view.panY, 0),
  });
}

export function workbenchWorldToScreen(transform, point) {
  return Object.freeze({
    x: transform.plot.left + transform.plot.width / 2
      + (Number(point.x) - transform.centerX) * transform.scaleX * transform.zoomX + transform.panX,
    y: transform.plot.top + transform.plot.height / 2
      - (Number(point.y) - transform.centerY) * transform.scaleY * transform.zoomY + transform.panY,
  });
}

export function workbenchScreenToWorld(transform, point) {
  return Object.freeze({
    x: transform.centerX + (Number(point.x) - transform.plot.left - transform.plot.width / 2 - transform.panX)
      / (transform.scaleX * transform.zoomX),
    y: transform.centerY - (Number(point.y) - transform.plot.top - transform.plot.height / 2 - transform.panY)
      / (transform.scaleY * transform.zoomY),
  });
}

export function workbenchVisibleRange(transform) {
  const a = workbenchScreenToWorld(transform, { x: transform.plot.left, y: transform.plot.bottom });
  const b = workbenchScreenToWorld(transform, { x: transform.plot.right, y: transform.plot.top });
  return Object.freeze({
    minX: Math.min(a.x, b.x),
    maxX: Math.max(a.x, b.x),
    minY: Math.min(a.y, b.y),
    maxY: Math.max(a.y, b.y),
  });
}

function rangeView(transform, range) {
  const centerX = (range.minX + range.maxX) / 2;
  const centerY = (range.minY + range.maxY) / 2;
  const zoomX = (transform.bounds.maxX - transform.bounds.minX) / (range.maxX - range.minX);
  const zoomY = (transform.bounds.maxY - transform.bounds.minY) / (range.maxY - range.minY);
  return { zoomX, zoomY, panX: (transform.centerX - centerX) * transform.scaleX * zoomX, panY: (centerY - transform.centerY) * transform.scaleY * zoomY };
}

export function workbenchViewForRange(bounds, plot, range, limits = {}) {
  const transform = createWorkbenchTransform(bounds, plot);
  const next = rangeView(transform, range);
  const minZoom = positive(limits.minZoom, 0.05);
  const maxZoom = positive(limits.maxZoom, 100);
  return Object.freeze({
    zoomX: clamp(next.zoomX, minZoom, maxZoom),
    zoomY: clamp(next.zoomY, minZoom, maxZoom),
    panX: next.panX,
    panY: next.panY,
  });
}

export function workbenchHorizontalViewForRange(bounds, plot, range, current = {}, limits = {}) {
  const full = workbenchViewForRange(bounds, plot, { ...range, minY: bounds.minY, maxY: bounds.maxY }, limits);
  return Object.freeze({
    zoomX: full.zoomX,
    panX: full.panX,
    zoomY: positive(current.zoomY, 1),
    panY: finite(current.panY, 0),
  });
}
