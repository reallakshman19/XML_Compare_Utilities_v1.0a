export const PROJECTION_MODES = Object.freeze(['ISO', 'XY', 'XZ', 'YZ']);

export function projectPlantPoint(point, mode = 'ISO') {
  if (!point) return null;
  if (mode === 'XY') return { x: point.x, y: -point.y };
  if (mode === 'XZ') return { x: point.x, y: -point.z };
  if (mode === 'YZ') return { x: point.y, y: -point.z };
  const c = Math.cos(Math.PI / 6); const s = Math.sin(Math.PI / 6);
  return { x: (point.x - point.y) * c, y: -(point.z + (point.x + point.y) * s) };
}

export function createViewportTransform(points, width, height, padding = 54) {
  const valid = points.filter(Boolean);
  if (!valid.length) return () => ({ x: width / 2, y: height / 2 });
  const xs = valid.map((point) => point.x); const ys = valid.map((point) => point.y);
  const minX = Math.min(...xs); const maxX = Math.max(...xs);
  const minY = Math.min(...ys); const maxY = Math.max(...ys);
  const spanX = Math.max(1, maxX - minX); const spanY = Math.max(1, maxY - minY);
  const scale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY);
  const offsetX = (width - spanX * scale) / 2 - minX * scale;
  const offsetY = (height - spanY * scale) / 2 - minY * scale;
  return (point) => ({ x: point.x * scale + offsetX, y: point.y * scale + offsetY });
}

export function interpolatePoint(left, right, fraction) {
  const t = Math.max(0, Math.min(1, Number(fraction) || 0));
  return { x: left.x + (right.x - left.x) * t, y: left.y + (right.y - left.y) * t };
}
