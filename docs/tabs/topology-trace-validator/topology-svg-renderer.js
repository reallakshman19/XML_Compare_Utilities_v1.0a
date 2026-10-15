/**
 * Functionality: renders immutable TopologySvgViewModel.v1 data into a fixed
 * SVG viewBox for spatial, trace-lane, junction/boundary, and issue modes.
 * Input is only the view model. Output is markup or an updated SVG element.
 * Fallback: invalid/missing geometry is omitted visually but remains in issues.
 */

import { asArray, cleanText, escapeMarkup, objectRecord } from './topology-validator-values.js';
import {
  TOPOLOGY_SVG_HEIGHT,
  TOPOLOGY_SVG_PADDING,
  TOPOLOGY_SVG_WIDTH,
  createTopologyWorldTransform,
} from './topology-svg-projections.js';
import { buildTopologyTraceLaneMarkup } from './topology-svg-trace-lanes.js';
import { buildComponentSymbolMarkup } from './topology-svg-component-symbols.js';

/** @param {Record<string, unknown>} viewModel @returns {string} */
export function buildTopologySvgMarkup(viewModel) {
  const mode = cleanText(viewModel.mode);
  let body = '';
  if (mode === 'trace') body = buildTopologyTraceLaneMarkup(viewModel);
  else if (mode === 'junctions') body = junctionBoundaryMarkup(viewModel);
  else if (mode === 'issues') body = issuesMarkup(viewModel);
  else body = spatialMarkup(viewModel);
  return `<svg class="ttv-svg" viewBox="0 0 ${TOPOLOGY_SVG_WIDTH} ${TOPOLOGY_SVG_HEIGHT}" role="img" tabindex="0" aria-label="Topology trace validator ${escapeMarkup(mode)} view. Drag to pan, use the wheel to zoom, and click an object to select it." data-view-model-schema="${escapeMarkup(viewModel.schema)}" data-mode="${escapeMarkup(mode)}">${gridMarkup()}<g class="ttv-svg-content">${body}</g></svg>`;
}

/** @param {Element} host @param {Record<string, unknown>} viewModel @returns {SVGElement} */
export function renderTopologySvg(host, viewModel) {
  host.innerHTML = buildTopologySvgMarkup(viewModel);
  const svg = host.querySelector('svg');
  if (!(svg instanceof SVGElement)) throw new TypeError('Topology SVG renderer could not create the SVG root.');
  return svg;
}

/** @param {SVGElement} svg @param {Record<string, unknown>} viewModel @returns {void} */
export function renderTopologySearchStatus(svg, viewModel) {
  svg.querySelector('.ttv-filter-message')?.remove();
  const target = svg.querySelector('.ttv-svg-content'), markup = searchStatusMarkup(viewModel);
  if (target && markup) target.insertAdjacentHTML('beforeend', markup);
}

/** @param {Record<string, unknown>} viewModel @returns {string} */
function spatialMarkup(viewModel) {
  const transform = createTopologyWorldTransform(objectRecord(viewModel.bounds), TOPOLOGY_SVG_WIDTH, TOPOLOGY_SVG_HEIGHT, TOPOLOGY_SVG_PADDING);
  const visibility = objectRecord(viewModel.visibility);
  const issueIds = new Set(asArray(viewModel.issues).flatMap((row) => asArray(objectRecord(row).canonicalIds)).map(cleanText));
  const source = visibility.source === false ? '' : asArray(viewModel.sourceComponents).map(objectRecord).flatMap((component) => {
    if (cleanText(component.componentCategory) === 'SUPPORT' || !component.projectedStart || !component.projectedEnd) return [];
    const start = transform(component.projectedStart), end = transform(component.projectedEnd);
    const path = `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} L ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
    return [`<g class="ttv-source-route ${cleanText(component.disposition) === 'BLOCK_AMBIGUOUS' ? 'is-ambiguous' : ''}" data-object-key="${escapeMarkup(component.objectKey)}" data-source-entity-id="${escapeMarkup(component.sourceEntityId)}"><path class="ttv-visible-path" d="${path}"/><path class="ttv-hit-path" d="${path}"/><title>${escapeMarkup(component.sourcePath)}</title></g>`];
  }).join('');
  const edges = visibility.canonical === false ? '' : asArray(viewModel.canonicalEdges).map(objectRecord).flatMap((edge) => {
    if (!edge.projectedStart || !edge.projectedEnd) return [];
    const start = transform(edge.projectedStart), end = transform(edge.projectedEnd), invalid = issueIds.has(cleanText(edge.id));
    const path = `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} L ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
    return [`<g class="ttv-canonical-edge ${invalid ? 'is-invalid' : ''}" data-object-key="${escapeMarkup(edge.objectKey)}" data-canonical-edge-id="${escapeMarkup(edge.id)}" data-source-entity-ids="${escapeMarkup(asArray(edge.sourceEntityIds).join(' '))}" data-inputxml-element-ids="${escapeMarkup(asArray(edge.inputXmlElementIds).join(' '))}"><path class="ttv-visible-path" d="${path}"/><path class="ttv-hit-path" d="${path}"/><title>${escapeMarkup(edge.id)}</title></g>`];
  }).join('');
  const nodes = visibility.canonical === false ? '' : asArray(viewModel.canonicalNodes).map(objectRecord).flatMap((node) => {
    if (!node.projectedPosition) return [];
    const point = transform(node.projectedPosition), invalid = issueIds.has(cleanText(node.id));
    return [`<g class="ttv-canonical-node ${invalid ? 'is-invalid' : ''}" data-object-key="${escapeMarkup(node.objectKey)}" data-canonical-node-id="${escapeMarkup(node.id)}"><circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="5" style="transform: scale(var(--ttv-inverse-scale, 1)); transform-origin: ${point.x.toFixed(2)}px ${point.y.toFixed(2)}px;" />${labelMarkup(viewModel, node.id, point.x + 8, point.y - 8)}<title>${escapeMarkup(node.id)}</title></g>`];
  }).join('');
  const ports = visibility.source === false ? '' : asArray(viewModel.sourcePorts).map(objectRecord).flatMap((port) => {
    if (!port.projectedPosition) return [];
    const point = transform(port.projectedPosition);
    return [`<circle class="ttv-source-port" cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="3" data-object-key="${escapeMarkup(port.objectKey)}" data-source-port-id="${escapeMarkup(port.sourcePortId)}" style="transform: scale(var(--ttv-inverse-scale, 1)); transform-origin: ${point.x.toFixed(2)}px ${point.y.toFixed(2)}px;"><title>${escapeMarkup(port.sourcePortId || port.objectKey)}</title></circle>`];
  }).join('');
  const components = visibility.source === false ? '' : buildComponentSymbolMarkup(viewModel, transform);
  return `${source}${ports}${components}${edges}${nodes}${symbolMarkup(viewModel, transform, 'junctions', 'junction', 'diamond', visibility.junctions !== false)}${symbolMarkup(viewModel, transform, 'pointFeatures', 'point-feature', 'triangle', visibility.pointFeatures !== false)}${symbolMarkup(viewModel, transform, 'boundaries', 'boundary', 'circle', visibility.boundaries !== false)}${searchStatusMarkup(viewModel)}`;
}

/** @param {Record<string, unknown>} viewModel @returns {string} */
function searchStatusMarkup(viewModel) {
  const summary = objectRecord(viewModel.filterSummary);
  if (summary.searchActive !== true) return '';
  const message = `${summary.sourceMatchCount} search matches listed · SVG scope: ${summary.displayScope} · ${summary.displayedSourceCount} source objects displayed`;
  return `<g class="ttv-filter-message"><rect x="30" y="24" width="710" height="34" rx="7"/><text x="46" y="46">${escapeMarkup(message)}</text></g>`;
}

/** @param {Record<string, unknown>} viewModel @param {(point:{x:number,y:number})=>{x:number,y:number}} transform @param {string} collection @param {string} cssName @param {string} shape @param {boolean} visible @returns {string} */
function symbolMarkup(viewModel, transform, collection, cssName, shape, visible) {
  if (!visible) return '';
  return asArray(viewModel[collection]).map(objectRecord).flatMap((object) => {
    if (!object.projectedPosition) return [];
    const point = transform(object.projectedPosition), id = cleanText(object.id), key = escapeMarkup(object.objectKey);
    const shapeMarkup = shape === 'diamond'
      ? `<rect x="${(point.x - 6).toFixed(2)}" y="${(point.y - 6).toFixed(2)}" width="12" height="12" transform="rotate(45 ${point.x.toFixed(2)} ${point.y.toFixed(2)})"/>`
      : shape === 'triangle'
        ? `<path d="M ${point.x.toFixed(2)} ${(point.y - 7).toFixed(2)} L ${(point.x - 7).toFixed(2)} ${(point.y + 6).toFixed(2)} L ${(point.x + 7).toFixed(2)} ${(point.y + 6).toFixed(2)} Z"/>`
        : `<circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="8"/>`;
    const invalid = asArray(viewModel.issues).map(objectRecord).some((finding) => asArray(finding.canonicalIds).map(cleanText).includes(id));
    return [`<g class="ttv-${cssName} ${invalid ? 'is-invalid' : ''}" data-object-key="${key}" data-canonical-${cssName}-id="${escapeMarkup(id)}"><g style="transform: scale(var(--ttv-inverse-scale, 1)); transform-origin: ${point.x.toFixed(2)}px ${point.y.toFixed(2)}px;">${shapeMarkup}</g>${labelMarkup(viewModel, id, point.x + 9, point.y - 9)}<title>${escapeMarkup(id)}</title></g>`];
  }).join('');
}

/** @param {Record<string, unknown>} viewModel @returns {string} */
function junctionBoundaryMarkup(viewModel) {
  const allBranches = asArray(viewModel.branches).map(objectRecord), branches = allBranches.slice(0, 5), width = 180, height = 62;
  const boxes = branches.map((branch, index) => {
    const x = 40 + (index % 5) * 225, y = 60 + Math.floor(index / 5) * 92;
    return `<g class="ttv-branch-box"><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="10"/><text x="${x + 12}" y="${y + 25}">${escapeMarkup(shortLabel(branch.name, 25))}</text><text x="${x + 12}" y="${y + 45}">${escapeMarkup(shortLabel(branch.sourcePath, 28))}</text><title>${escapeMarkup(branch.name)}</title></g>`;
  }).join('');
  const junctionCards = asArray(viewModel.junctions).map(objectRecord).map((junction, index) => {
    const x = 320 + (index % 3) * 180, y = 80 + Math.floor(index / 3) * 76;
    return `<g class="ttv-map-junction" data-object-key="${escapeMarkup(junction.objectKey)}"><rect x="${x}" y="${y}" width="160" height="54" rx="8"/><text x="${x + 10}" y="${y + 22}">${escapeMarkup(junction.kind || 'JUNCTION')} · ${escapeMarkup(junction.id)}</text><text x="${x + 10}" y="${y + 40}">node ${escapeMarkup(junction.nodeId || '—')} · degree ${escapeMarkup(junction.expectedDegree ?? junction.degree ?? '—')}</text></g>`;
  }).join('');
  const boundaryCards = asArray(viewModel.boundaries).map(objectRecord).map((boundary, index) => {
    const x = 860, y = 80 + index * 68;
    return `<g class="ttv-map-boundary" data-object-key="${escapeMarkup(boundary.objectKey)}"><circle cx="${x}" cy="${y + 22}" r="12"/><text x="${x + 22}" y="${y + 18}">${escapeMarkup(boundary.id)}</text><text x="${x + 22}" y="${y + 36}">${escapeMarkup(shortLabel(boundary.relationship, 34))}</text></g>`;
  }).join('');
  const refs = [...asArray(objectRecord(viewModel.branchReferences).branchReferences), ...asArray(objectRecord(viewModel.branchReferences).crefReferences)].map(objectRecord);
  const relationships = refs.slice(0, 24).map((ref, index) => `<g class="ttv-reference-row ${ref.resolved === true ? 'is-resolved' : 'is-unresolved'}"><text x="${60 + (index % 2) * 570}" y="${430 + Math.floor(index / 2) * 20}">${escapeMarkup(ref.kind)} · ${escapeMarkup(shortLabel(ref.branchName, 25))} → ${escapeMarkup(shortLabel(ref.value, 38))}</text></g>`).join('');
  const branchOverflow = allBranches.length > branches.length ? `<text class="ttv-map-note" x="40" y="150">${allBranches.length - branches.length} additional branches remain available in the branch tree.</text>` : '';
  const overflow = refs.length > 24 ? `<text class="ttv-map-note" x="60" y="690">${refs.length - 24} additional relationships remain available in the Connections/Boundaries tabs.</text>` : '';
  return `${boxes}${branchOverflow}${junctionCards}${boundaryCards}${relationships}${overflow}`;
}

/** @param {Record<string, unknown>} viewModel @returns {string} */
function issuesMarkup(viewModel) {
  const issues = asArray(viewModel.issues).map(objectRecord), blocking = issues.filter((row) => row.blocking === true).length;
  const heading = blocking === 0 ? '<text class="ttv-no-issues" x="600" y="80">No blocking topology issues</text>' : `<text class="ttv-issues-heading" x="48" y="72">${blocking} blocking topology issues</text>`;
  const rows = issues.map((finding, index) => {
    const x = index % 2 ? 620 : 48, y = 112 + Math.floor(index / 2) * 54;
    return `<g class="ttv-issue-object ${cleanText(finding.code).includes('AMBIGUOUS') ? 'is-ambiguous' : ''}" data-issue-id="${escapeMarkup(finding.id)}" data-object-key="issue:${escapeMarkup(finding.id)}"><rect x="${x}" y="${y}" width="532" height="42" rx="7"/><text x="${x + 12}" y="${y + 17}">${escapeMarkup(finding.code)}</text><text x="${x + 12}" y="${y + 33}">${escapeMarkup(shortLabel(finding.message, 76))}</text><title>${escapeMarkup(finding.message)}</title></g>`;
  }).join('');
  return `${heading}${rows}`;
}

/** @returns {string} */
function gridMarkup() {
  return '<defs><pattern id="ttv-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(100,116,139,.16)" stroke-width="1"/></pattern></defs><rect width="1200" height="720" fill="url(#ttv-grid)"/>';
}

/** @param {Record<string, unknown>} viewModel @param {unknown} label @param {number} x @param {number} y @returns {string} */
function labelMarkup(viewModel, label, x, y) {
  return viewModel.labels === true ? `<text class="ttv-symbol-label" x="${x.toFixed(2)}" y="${y.toFixed(2)}" style="transform: scale(var(--ttv-inverse-scale, 1)); transform-origin: ${x.toFixed(2)}px ${y.toFixed(2)}px;">${escapeMarkup(label)}</text>` : '';
}

/** @param {unknown} value @param {number} length @returns {string} */
function shortLabel(value, length) {
  const text = cleanText(value);
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

export const _test = Object.freeze({ spatialMarkup, junctionBoundaryMarkup, issuesMarkup, searchStatusMarkup, shortLabel });
