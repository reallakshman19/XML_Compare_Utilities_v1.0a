import { escapeHtml } from './sequential-sketcher-contract.js';
import { createViewportTransform, interpolatePoint, projectPlantPoint } from './sequential-sketcher-projection.js';

function nodeMap(topology) { return new Map(topology.nodes.map((node) => [node.id, node])); }
function segmentMap(topology) { return new Map(topology.segments.map((segment) => [segment.id, segment])); }

function supportFraction(support, component, topology) {
  if (Number.isFinite(support.carrierFraction)) return Math.max(0, Math.min(1, support.carrierFraction));
  if (!Number.isFinite(support.carrierStationMm)) return 0.5;
  const segment = topology.segments.find((row) => row.componentId === component.id);
  const nodes = nodeMap(topology);
  const a = nodes.get(segment?.fromNodeId)?.position;
  const b = nodes.get(segment?.toNodeId)?.position;
  const length = a && b ? Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) : 0;
  return length > 0 ? Math.max(0, Math.min(1, support.carrierStationMm / length)) : 0.5;
}

function supportScreenPoint(support, component, topology, screen, transform, mode, segments) {
  if (support.centerlinePointGlobal) return transform(projectPlantPoint(support.centerlinePointGlobal, mode));
  const firstSegment = segments.get(component.segmentIds[0]);
  const from = screen.get(firstSegment?.fromNodeId);
  const to = screen.get(firstSegment?.toNodeId);
  return from && to ? interpolatePoint(from, to, supportFraction(support, component, topology)) : null;
}

export function renderSketchSvg(host, topology, traversal, options = {}) {
  const width = Math.max(640, Number(options.width) || 1000);
  const height = Math.max(420, Number(options.height) || 660);
  const mode = options.mode || 'ISO';
  const step = Number.isFinite(options.step) ? options.step : traversal.commands.length - 1;
  const nodes = nodeMap(topology);
  const segments = segmentMap(topology);
  const projected = new Map(topology.nodes.map((node) => [node.id, projectPlantPoint(node.position, mode)]));
  const supportProjected = topology.components.flatMap((component) => component.supports || [])
    .map((support) => support.centerlinePointGlobal ? projectPlantPoint(support.centerlinePointGlobal, mode) : null)
    .filter(Boolean);
  const transform = createViewportTransform([...projected.values(), ...supportProjected], width, height);
  const screen = new Map([...projected].map(([id, point]) => [id, transform(point)]));
  const drawnSegmentIds = new Set(traversal.commands.slice(0, step + 1).filter((command) => command.op === 'DRAW_SEGMENT').map((command) => command.segmentId));
  const parts = [`<svg class="ssk-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Sequential piping sketch">`, '<defs><pattern id="ssk-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="rgba(148,163,184,.11)" stroke-width="1"/></pattern></defs>', `<rect width="${width}" height="${height}" fill="url(#ssk-grid)"/>`];

  for (const segment of topology.segments) {
    const from = screen.get(segment.fromNodeId); const to = screen.get(segment.toNodeId);
    if (!from || !to) continue;
    const active = drawnSegmentIds.has(segment.id);
    parts.push(`<line data-ssk-segment-id="${escapeHtml(segment.id)}" x1="${from.x.toFixed(2)}" y1="${from.y.toFixed(2)}" x2="${to.x.toFixed(2)}" y2="${to.y.toFixed(2)}" class="ssk-route ${active ? 'is-drawn' : 'is-pending'}"/>`);
  }

  for (const boundary of topology.boundaries) {
    const at = screen.get(boundary.nodeId); if (!at) continue;
    parts.push(`<g class="ssk-boundary" transform="translate(${at.x.toFixed(2)} ${at.y.toFixed(2)})"><path d="M-6 0 0-6 6 0 0 6Z"/><title>${escapeHtml(`${boundary.role}: ${boundary.referenceTarget || boundary.status}`)}</title></g>`);
  }

  for (const component of topology.components) {
    const points = component.segmentIds.flatMap((id) => { const segment = segments.get(id); return [screen.get(segment?.fromNodeId), screen.get(segment?.toNodeId)]; }).filter(Boolean);
    const eventPoint = screen.get(component.eventNodeId);
    const anchor = eventPoint || (points.length ? { x: points.reduce((sum, point) => sum + point.x, 0) / points.length, y: points.reduce((sum, point) => sum + point.y, 0) / points.length } : null);
    if (!anchor) continue;
    if (component.canonicalType !== 'PIPE') parts.push(`<g class="ssk-fitting ssk-${component.canonicalType.toLowerCase()}" data-ssk-component-id="${escapeHtml(component.id)}" transform="translate(${anchor.x.toFixed(2)} ${anchor.y.toFixed(2)})"><circle r="6"/><text x="9" y="-8">${escapeHtml(component.canonicalType)}</text><title>${escapeHtml(component.componentId)}</title></g>`);
    (component.supports || []).forEach((support) => {
      const at = supportScreenPoint(support, component, topology, screen, transform, mode, segments);
      if (!at) return;
      parts.push(`<g class="ssk-support" data-ssk-support-family="${escapeHtml(support.familyId)}" transform="translate(${at.x.toFixed(2)} ${at.y.toFixed(2)})"><path d="M0 0v14m-7 0h14"/><text x="8" y="18">${escapeHtml(support.label)}</text><title>${escapeHtml(`${support.displayKind} · ${support.resolutionStatus}`)}</title></g>`);
    });
  }

  parts.push('</svg>'); host.innerHTML = parts.join('');
}

export function renderMetrics(host, topology, traversal) {
  const supportSummary = topology.supportSummary || { familyCount: 0, unresolvedCount: 0 };
  const metrics = [
    ['Components', topology.components.length], ['Segments', topology.segments.length],
    ['Boundaries', topology.boundaries.length], ['Route sections', traversal.routeSections.length],
    ['Supports', supportSummary.familyCount], ['Unresolved supports', supportSummary.unresolvedCount],
    ['Issues', traversal.issues.length],
  ];
  host.innerHTML = metrics.map(([label, value]) => `<div><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`).join('');
}

export function renderSequence(host, traversal, activeStep) {
  host.innerHTML = traversal.commands.map((command, index) => `<button type="button" data-ssk-step="${index}" class="${index === activeStep ? 'is-active' : ''}"><span>${String(index + 1).padStart(2, '0')}</span><b>${escapeHtml(command.op)}</b><small>${escapeHtml(command.componentId || command.nodeId || command.segmentId || '')}</small></button>`).join('');
}

export function renderInspector(host, topology, traversal) {
  const supportSummary = topology.supportSummary || { familyCount: 0, unresolvedCount: 0, diagnosticCount: 0 };
  host.innerHTML = `<section><h3>Branch contract</h3><dl><dt>Branch</dt><dd>${escapeHtml(topology.branchId)}</dd><dt>Graph</dt><dd>${escapeHtml(traversal.graphClass)}</dd><dt>HREF</dt><dd>${escapeHtml(topology.source.HREF || '—')}</dd><dt>TREF</dt><dd>${escapeHtml(topology.source.TREF || '—')}</dd></dl></section><section><h3>Support projection</h3><dl><dt>Schema</dt><dd>${escapeHtml(topology.supportBundle?.schema || 'Not built')}</dd><dt>Resolved</dt><dd>${escapeHtml(supportSummary.familyCount)}</dd><dt>Unresolved</dt><dd>${escapeHtml(supportSummary.unresolvedCount)}</dd><dt>Diagnostics</dt><dd>${escapeHtml(supportSummary.diagnosticCount)}</dd></dl></section><section><h3>Pipe / fitting inventory</h3><div class="ssk-inspector-list">${topology.components.map((component) => `<button type="button" data-ssk-component="${escapeHtml(component.id)}"><b>${escapeHtml(component.canonicalType)}</b><span>${escapeHtml(component.componentId)}</span><small>${component.supports.length} support families</small></button>`).join('')}</div></section><section><h3>Diagnostics</h3><div class="ssk-issues">${traversal.issues.length ? traversal.issues.map((issue) => `<div data-severity="${escapeHtml(issue.severity)}"><b>${escapeHtml(issue.code)}</b><span>${escapeHtml(issue.componentId || issue.nodeId || issue.carrierId || issue.familyId || '')}</span></div>`).join('') : '<p>No topology or support diagnostics.</p>'}</div></section>`;
}
