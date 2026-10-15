/** Pure native-SVG renderer for the constructed multi-branch network. */
import { escapeHtml } from '../sequential-sketcher-contract.js';
import { createViewportTransform, projectPlantPoint } from '../sequential-sketcher-projection.js';

function projected(point, mode) { return point ? projectPlantPoint(point, mode) : null; }
function transformPoint(transform, point, mode) {
  const value = projected(point, mode);
  return value ? transform(value) : null;
}
function allPoints(network) {
  return [
    ...(network.segments || []).flatMap((row) => [row.from, row.to]),
    ...(network.supports || []).map((row) => row.point),
    ...(network.connectors || []).flatMap((row) => [row.sourcePoint, row.targetPoint].filter(Boolean)),
  ];
}
function line(parts, from, to, className, attrs = '') {
  if (!from || !to) return;
  parts.push(`<line x1="${from.x.toFixed(2)}" y1="${from.y.toFixed(2)}" x2="${to.x.toFixed(2)}" y2="${to.y.toFixed(2)}" class="${className}" ${attrs}/>`);
}
function segmentClass(segment) {
  if (segment.generated) return 'ssk-network-segment is-generated';
  if (segment.type === 'GASK') return 'ssk-network-segment is-gasket';
  if (['VALV', 'VALVE', 'INST', 'INSTRUMENT'].includes(segment.type)) return 'ssk-network-segment is-equipment';
  return 'ssk-network-segment';
}
function midpoint(left, right) {
  return left && right ? { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 } : left || right;
}
function renderSegments(parts, network, transform, mode) {
  parts.push('<g data-ssk-network-layer="segments">');
  for (const segment of network.segments || []) {
    const from = transformPoint(transform, segment.from, mode);
    const to = transformPoint(transform, segment.to, mode);
    line(parts, from, to, segmentClass(segment),
      `data-ssk-network-branch="${escapeHtml(segment.branchId)}" data-ssk-network-type="${escapeHtml(segment.type)}"`);
  }
  parts.push('</g>');
}
function renderSupports(parts, network, transform, mode) {
  parts.push('<g data-ssk-network-layer="supports">');
  for (const support of network.supports || []) {
    const at = transformPoint(transform, support.point, mode);
    if (!at) continue;
    parts.push(`<g class="ssk-network-support" data-ssk-network-branch="${escapeHtml(support.branchId)}"><path d="M${at.x.toFixed(2)} ${(at.y - 8).toFixed(2)}V${(at.y + 5).toFixed(2)}M${(at.x - 7).toFixed(2)} ${(at.y + 5).toFixed(2)}H${(at.x + 7).toFixed(2)}"/><title>${escapeHtml(support.name)}</title></g>`);
  }
  parts.push('</g>');
}
function externalSymbol(parts, connector, at) {
  if (!at) return;
  const label = connector.externalReference || connector.originalReference || 'External continuation';
  const x = at.x; const y = at.y;
  parts.push(`<g class="ssk-network-continuation is-external" data-ssk-connector-id="${escapeHtml(connector.connectorId)}"><path d="M${(x - 12).toFixed(2)} ${(y - 8).toFixed(2)}H${(x + 4).toFixed(2)}L${(x + 12).toFixed(2)} ${y.toFixed(2)}L${(x + 4).toFixed(2)} ${(y + 8).toFixed(2)}H${(x - 12).toFixed(2)}Z"/><text x="${(x + 16).toFixed(2)}" y="${(y - 5).toFixed(2)}">${escapeHtml(label)}</text></g>`);
}
function internalSymbol(parts, connector, from, to) {
  if (!from || !to) return;
  if (Number(connector.gapMm) > 0.001) {
    line(parts, from, to, 'ssk-network-connector is-repaired',
      `data-ssk-connector-id="${escapeHtml(connector.connectorId)}"`);
  }
  const at = midpoint(from, to);
  parts.push(`<path class="ssk-network-continuation is-internal" data-ssk-connector-id="${escapeHtml(connector.connectorId)}" d="M${at.x.toFixed(2)} ${(at.y - 6).toFixed(2)}L${(at.x + 6).toFixed(2)} ${at.y.toFixed(2)}L${at.x.toFixed(2)} ${(at.y + 6).toFixed(2)}L${(at.x - 6).toFixed(2)} ${at.y.toFixed(2)}Z"><title>${escapeHtml(connector.branchId)} → ${escapeHtml(connector.targetBranchId)}</title></path>`);
}
function renderConnectors(parts, network, transform, mode) {
  parts.push('<g data-ssk-network-layer="continuations">');
  for (const connector of network.connectors || []) {
    const from = transformPoint(transform, connector.sourcePoint, mode);
    const to = transformPoint(transform, connector.targetPoint, mode);
    if (connector.status === 'EXTERNAL_SHEET') externalSymbol(parts, connector, from);
    else internalSymbol(parts, connector, from, to);
  }
  parts.push('</g>');
}
function renderLabels(parts, network, transform, mode) {
  const seen = new Set();
  parts.push('<g data-ssk-network-layer="branch-labels">');
  for (const segment of network.segments || []) {
    if (seen.has(segment.branchId)) continue;
    seen.add(segment.branchId);
    const at = transformPoint(transform, segment.from, mode);
    if (!at) continue;
    const short = segment.branchId.split('/').filter(Boolean).slice(-2).join('/');
    parts.push(`<text class="ssk-network-branch-label" x="${(at.x + 7).toFixed(2)}" y="${(at.y - 9).toFixed(2)}">${escapeHtml(short)}</text>`);
  }
  parts.push('</g>');
}
function metricText(network) {
  const value = network.metrics || {};
  return `${value.branchCount || 0} branches · ${value.internalConnectorCount || 0} internal continuations · ${value.externalSheetCount || 0} external sheets · ${value.generatedPipeCount || 0} generated connector pipes`;
}

export function renderSequentialConstructedNetwork(host, network, options = {}) {
  if (!network?.segments?.length) throw new Error('Constructed network has no drawable source segments.');
  const width = Math.max(640, Number(options.width) || 1200);
  const height = Math.max(420, Number(options.height) || 720);
  const mode = options.mode || 'ISO';
  const points = allPoints(network).map((entry) => projected(entry, mode)).filter(Boolean);
  const transform = createViewportTransform(points, width, height);
  const parts = [
    `<svg class="ssk-svg ssk-network-svg" data-ssk-network-svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Constructed Sequential multi-branch geometry">`,
    '<defs><pattern id="ssk-network-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="rgba(148,163,184,.11)" stroke-width="1"/></pattern></defs>',
    `<rect width="${width}" height="${height}" fill="url(#ssk-network-grid)"/>`,
  ];
  renderSegments(parts, network, transform, mode);
  renderSupports(parts, network, transform, mode);
  renderConnectors(parts, network, transform, mode);
  renderLabels(parts, network, transform, mode);
  parts.push(`<text class="ssk-network-summary" x="18" y="${height - 18}">${escapeHtml(metricText(network))}</text>`, '</svg>');
  host.innerHTML = parts.join('');
  return host.querySelector('[data-ssk-network-svg]');
}
