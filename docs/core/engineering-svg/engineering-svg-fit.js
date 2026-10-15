function finitePositive(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new TypeError(`${label} must be a positive finite number.`);
  return number;
}

export function createProjectedBounds(points = []) {
  const usable = points.filter((point) => Number.isFinite(point?.x) && Number.isFinite(point?.y));
  if (!usable.length) return Object.freeze({ minX: -1, maxX: 1, minY: -1, maxY: 1 });
  return Object.freeze({
    minX: Math.min(...usable.map((point) => point.x)),
    maxX: Math.max(...usable.map((point) => point.x)),
    minY: Math.min(...usable.map((point) => point.y)),
    maxY: Math.max(...usable.map((point) => point.y)),
  });
}

export function createEngineeringSvgFit(bounds, viewport = {}, padding = 24) {
  const width = finitePositive(viewport.width ?? 1200, 'Viewport width');
  const height = finitePositive(viewport.height ?? 720, 'Viewport height');
  const pad = Math.max(0, Number(padding) || 0);
  const usableWidth = Math.max(1, width - (2 * pad));
  const usableHeight = Math.max(1, height - (2 * pad));
  const spanX = Math.max(0, bounds.maxX - bounds.minX);
  const spanY = Math.max(0, bounds.maxY - bounds.minY);
  const fitSpanX = spanX || 1;
  const fitSpanY = spanY || 1;
  const scale = Math.min(usableWidth / fitSpanX, usableHeight / fitSpanY);
  const offsetX = pad + ((usableWidth - (spanX * scale)) / 2) - (bounds.minX * scale);
  const offsetY = pad + ((usableHeight - (spanY * scale)) / 2) + (bounds.maxY * scale);
  return Object.freeze({ width, height, padding: pad, scale, offsetX, offsetY, bounds });
}

export function applyEngineeringSvgFit(point, fit) {
  return Object.freeze({
    x: fit.offsetX + (point.x * fit.scale),
    y: fit.offsetY - (point.y * fit.scale),
    depth: point.depth,
  });
}
