/** Pure SVG editor-handle geometry and pointer-to-axis calculations. */
import { escapeMarkup } from './topology-validator-values.js';
import { projectTopologyPoint } from './topology-svg-projections.js';

const AXES = Object.freeze({ x: { x: 1, y: 0, z: 0 }, y: { x: 0, y: 1, z: 0 }, z: { x: 0, y: 0, z: 1 } });

export function clientToTopologySvg(svg, clientX, clientY) {
  const values = String(svg.getAttribute('viewBox') || '').split(/\s+/).map(Number), rect = svg.getBoundingClientRect();
  if (values.length !== 4 || !rect.width || !rect.height) return { x: 0, y: 0 };
  return { x: values[0] + ((clientX - rect.left) / rect.width) * values[2], y: values[1] + ((clientY - rect.top) / rect.height) * values[3] };
}

export function topologyEditorAxisVector(projection, axis, transform) {
  const origin = transform(projectTopologyPoint({ x: 0, y: 0, z: 0 }, projection));
  const end = transform(projectTopologyPoint(AXES[axis], projection));
  const vector = { x: end.x - origin.x, y: end.y - origin.y }, length = Math.hypot(vector.x, vector.y);
  return length > 1e-8 ? { ...vector, length } : null;
}

export function solveTopologyEditorAxisDrag(start, current, vector) {
  if (!vector?.length) return 0;
  const dx = current.x - start.x, dy = current.y - start.y;
  return (dx * vector.x + dy * vector.y) / (vector.length * vector.length);
}

export function buildTopologySvgEditorHandles(entity, projection, transform) {
  const anchorProjected = projectTopologyPoint(entity.position, projection), anchor = anchorProjected ? transform(anchorProjected) : null;
  if (!anchor) return '';
  const axes = Object.keys(AXES).flatMap((axis) => {
    const vector = topologyEditorAxisVector(projection, axis, transform);
    if (!vector) return [];
    const ux = vector.x / vector.length, uy = vector.y / vector.length, length = 48;
    const x2 = anchor.x + ux * length, y2 = anchor.y + uy * length;
    return [`<g class="ttv-editor-axis ttv-editor-axis-${axis}" data-ttv-editor-axis="${axis}" data-object-key="${escapeMarkup(entity.objectKey)}" data-axis-vx="${vector.x}" data-axis-vy="${vector.y}"><line x1="${anchor.x}" y1="${anchor.y}" x2="${x2}" y2="${y2}"/><circle cx="${x2}" cy="${y2}" r="5"/><text x="${x2 + ux * 9}" y="${y2 + uy * 9}">${axis.toUpperCase()}</text></g>`];
  }).join('');
  return `<g class="ttv-svg-editor-layer" data-ttv-editor-layer="handles" data-object-key="${escapeMarkup(entity.objectKey)}"><circle class="ttv-editor-origin" cx="${anchor.x}" cy="${anchor.y}" r="6"/>${axes}</g>`;
}

export function buildTopologySvgEditorPreview(entity, projection, transform) {
  const projected = projectTopologyPoint(entity.position, projection), point = projected ? transform(projected) : null;
  if (!point) return '';
  return `<g class="ttv-editor-support-preview" data-ttv-editor-preview="support" transform="translate(${point.x} ${point.y})"><circle r="14"/><path d="M -8 -8 L 8 8 M -8 8 L 8 -8"/></g>`;
}

export const _test = Object.freeze({ AXES });
