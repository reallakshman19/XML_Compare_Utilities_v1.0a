import { buildEngineeringSvgProjectedScene } from './engineering-svg-projected-scene.js';

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[character]);
}

function number(value) {
  const normalized = Math.abs(value) < 1e-12 ? 0 : value;
  return normalized.toFixed(6).replace(/\.?0+$/, '');
}

function geometryMarkup(geometry) {
  if (geometry == null) return '';
  if (geometry.kind === 'point') {
    const [point] = geometry.points;
    return `<circle cx="${number(point.x)}" cy="${number(point.y)}" r="4" vector-effect="non-scaling-stroke"/>`;
  }
  if (geometry.kind === 'segment') {
    const [start, end] = geometry.points;
    return `<line x1="${number(start.x)}" y1="${number(start.y)}" x2="${number(end.x)}" y2="${number(end.y)}" vector-effect="non-scaling-stroke"/>`;
  }
  const points = geometry.closed ? [...geometry.points, geometry.points[0]] : geometry.points;
  const value = points.map((point) => `${number(point.x)},${number(point.y)}`).join(' ');
  return `<polyline points="${value}" vector-effect="non-scaling-stroke"/>`;
}

function entityMarkup(entity) {
  const attributes = [
    `data-engineering-svg-entity-id="${escapeXml(entity.id)}"`,
    `data-engineering-svg-kind="${escapeXml(entity.kind)}"`,
    `data-engineering-svg-domain-type="${escapeXml(entity.domainType)}"`,
    `data-engineering-svg-layer-name="${escapeXml(entity.layer)}"`,
  ].join(' ');
  return `<g ${attributes}>${geometryMarkup(entity.projectedGeometry)}</g>`;
}

export function exportEngineeringSvg(scene, options = {}) {
  const projected = buildEngineeringSvgProjectedScene(scene, options);
  const byLayer = new Map();
  projected.entities.forEach((entity) => {
    if (!byLayer.has(entity.layer)) byLayer.set(entity.layer, []);
    byLayer.get(entity.layer).push(entityMarkup(entity));
  });
  const layers = [...byLayer.entries()].map(([layer, entities]) => (
    `<g data-engineering-svg-layer="${escapeXml(layer)}">${entities.join('')}</g>`
  )).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" role="img" viewBox="0 0 ${number(projected.viewport.width)} ${number(projected.viewport.height)}" data-engineering-svg-scene-id="${escapeXml(projected.sceneId)}" data-engineering-svg-projection="${escapeXml(projected.projection)}">${layers}</svg>`;
}
