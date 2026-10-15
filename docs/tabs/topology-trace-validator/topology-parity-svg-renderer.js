/**
 * Semantic SVG renderer for TopologyParitySvgViewModel.v1. It performs only
 * screen transformation, styling, labelling, and interaction-target creation.
 * Topology incidence and world geometry are immutable scene inputs.
 */

import {
  TOPOLOGY_SVG_HEIGHT,
  TOPOLOGY_SVG_PADDING,
  TOPOLOGY_SVG_WIDTH,
  createTopologyWorldTransform,
} from './topology-svg-projections.js';
import { asArray, cleanText, objectRecord } from './topology-validator-values.js';

const LAYERS = Object.freeze([
  'grid', 'unaffected-branches', 'active-branches', 'component-envelopes',
  'legal-connections', 'supports', 'deferred-attachments', 'rigids',
  'junctions', 'issues', 'nodes', 'dimensions', 'labels', 'interaction-targets',
]);

function escapeAttribute(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function list(value) {
  return asArray(value).map(cleanText).filter(Boolean).join(',');
}

function pathData(start, end, transform) {
  if (!start || !end) return '';
  const a = transform(start), b = transform(end);
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} L ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

function edgeAttributes(edge) {
  return [
    ['data-object-key', edge.objectKey],
    ['data-canonical-edge-id', edge.canonicalEdgeId],
    ['data-inputxml-element-id', edge.inputXmlElementId],
    ['data-from-canonical-node-id', edge.fromCanonicalNodeId],
    ['data-to-canonical-node-id', edge.toCanonicalNodeId],
    ['data-source-entity-ids', list(edge.sourceEntityIds)],
    ['data-source-port-ids', list(edge.sourcePortIds)],
    ['data-branch-id', list(edge.branchIds)],
    ['data-segment-role', edge.segmentRole],
    ['data-projection-cardinality', edge.projectionCardinality],
    ['data-topology-operation', edge.topologyOperation],
  ].map(([name, value]) => `${name}="${escapeAttribute(value)}"`).join(' ');
}

function edgeMarkup(edge, transform, className) {
  const d = pathData(edge.projectedStart, edge.projectedEnd, transform);
  return d ? `<path class="${className}" d="${d}" ${edgeAttributes(edge)}/>` : '';
}

function inputEdgeMarkup(edge, transform, selected) {
  const d = pathData(edge.projectedStart, edge.projectedEnd, transform);
  return d ? `<path class="ttv-parity-input-edge${selected ? ' is-selected' : ''}" d="${d}" data-object-key="${escapeAttribute(edge.objectKey)}" data-comparison-origin="inputxml" data-inputxml-element-id="${escapeAttribute(edge.id)}" data-canonical-edge-id="${escapeAttribute(edge.canonicalEdgeId)}" data-from-canonical-node-id="${escapeAttribute(edge.fromCanonicalNodeId)}" data-to-canonical-node-id="${escapeAttribute(edge.toCanonicalNodeId)}"/>` : '';
}

function nodeMarkup(node, transform) {
  if (!node.projectedPosition) return '';
  const point = transform(node.projectedPosition), world = objectRecord(node.position);
  return `<circle class="ttv-parity-node" cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="3.5" data-object-key="${escapeAttribute(node.objectKey)}" data-canonical-node-id="${escapeAttribute(node.canonicalNodeId)}" data-inputxml-node-id="${escapeAttribute(node.inputXmlNodeId)}" data-world-x="${escapeAttribute(world.x)}" data-world-y="${escapeAttribute(world.y)}" data-world-z="${escapeAttribute(world.z)}" data-source-entity-ids="${escapeAttribute(list(node.sourceEntityIds))}" data-source-port-ids="${escapeAttribute(list(node.sourcePortIds))}"/>`;
}

function pointMarkup(row, transform, className, symbol) {
  if (!row.projectedPosition) return '';
  const point = transform(row.projectedPosition);
  return `<g class="${className}" data-object-key="${escapeAttribute(row.objectKey)}" data-canonical-node-id="${escapeAttribute(row.canonicalNodeId)}" data-source-entity-ids="${escapeAttribute(list(row.sourceEntityIds))}" data-branch-id="${escapeAttribute(list(row.branchIds))}"><circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="7"/><text x="${point.x.toFixed(2)}" y="${(point.y + 3).toFixed(2)}">${escapeAttribute(symbol)}</text></g>`;
}

function supportMarkup(row, transform) {
  if (!row.projectedPosition) return '';
  const point = transform(row.projectedPosition);
  return `<g class="ttv-parity-support" data-object-key="${escapeAttribute(row.objectKey)}" data-canonical-support-id="${escapeAttribute(row.canonicalSupportId)}" data-canonical-node-id="${escapeAttribute(row.canonicalNodeId)}" data-inputxml-node-id="${escapeAttribute(row.inputXmlNodeId)}" data-source-entity-ids="${escapeAttribute(list(row.sourceEntityIds))}" data-branch-id="${escapeAttribute(list(row.branchIds))}" data-attachment-authority="${escapeAttribute(row.attachmentAuthority)}"><path d="M ${(point.x - 8).toFixed(2)} ${(point.y + 8).toFixed(2)} L ${point.x.toFixed(2)} ${point.y.toFixed(2)} L ${(point.x + 8).toFixed(2)} ${(point.y + 8).toFixed(2)}"/><line x1="${(point.x - 10).toFixed(2)}" y1="${(point.y + 9).toFixed(2)}" x2="${(point.x + 10).toFixed(2)}" y2="${(point.y + 9).toFixed(2)}"/></g>`;
}

function deferredMarkup(row, transform) {
  if (!row.projectedPosition) return '';
  const point = transform(row.projectedPosition);
  return `<g class="ttv-parity-deferred" data-object-key="${escapeAttribute(row.objectKey)}" data-source-entity-ids="${escapeAttribute(list(row.sourceEntityIds))}" data-source-path="${escapeAttribute(row.sourcePath)}" data-projection-cardinality="${escapeAttribute(row.projectionCardinality)}" data-topology-bearing="false"><rect x="${(point.x - 6).toFixed(2)}" y="${(point.y - 6).toFixed(2)}" width="12" height="12" transform="rotate(45 ${point.x.toFixed(2)} ${point.y.toFixed(2)})"/><text x="${(point.x + 9).toFixed(2)}" y="${(point.y - 9).toFixed(2)}">D</text></g>`;
}

function rigidMarkup(row, edgeById, transform) {
  const edge = edgeById.get(cleanText(row.canonicalEdgeId));
  if (!edge?.projectedStart || !edge?.projectedEnd) return '';
  const a = transform(edge.projectedStart), b = transform(edge.projectedEnd);
  const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
  return `<rect class="ttv-parity-rigid" x="${(x - 10).toFixed(2)}" y="${(y - 5).toFixed(2)}" width="20" height="10" data-object-key="${escapeAttribute(row.objectKey)}" data-canonical-edge-id="${escapeAttribute(row.canonicalEdgeId)}" data-source-entity-ids="${escapeAttribute(list(row.sourceEntityIds))}"/>`;
}

function residualMarkup(row, transform) {
  const source = row.sourcePosition, attachment = row.attachmentPosition;
  if (!source || !attachment) return '';
  const projectedSource = row.projectedSourcePosition || null;
  const projectedAttachment = row.projectedPosition || null;
  if (!projectedSource || !projectedAttachment) return '';
  const a = transform(projectedSource), b = transform(projectedAttachment);
  return `<line class="ttv-parity-residual" x1="${a.x.toFixed(2)}" y1="${a.y.toFixed(2)}" x2="${b.x.toFixed(2)}" y2="${b.y.toFixed(2)}" data-residual-mm="${escapeAttribute(row.connectionResidual)}"/>`;
}

function gapMarkup(edge, transform) {
  if (!(edge.connectionGap > 0)) return '';
  const d = pathData(edge.projectedStart, edge.projectedEnd, transform);
  return d ? `<path class="ttv-parity-gap" d="${d}"/>` : '';
}

function overlapMarkup(edge, transform) {
  if (!(edge.connectionOverlap > 0)) return '';
  const d = pathData(edge.projectedStart, edge.projectedEnd, transform);
  return d ? `<path class="ttv-parity-overlap" d="${d}"/>` : '';
}

function labelMarkup(row, transform, text) {
  if (!row.projectedPosition) return '';
  const point = transform(row.projectedPosition);
  return `<text class="ttv-parity-label" x="${(point.x + 6).toFixed(2)}" y="${(point.y - 6).toFixed(2)}">${escapeAttribute(text)}</text>`;
}

function gridMarkup() {
  const lines = [];
  for (let x = 0; x <= TOPOLOGY_SVG_WIDTH; x += 60) lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${TOPOLOGY_SVG_HEIGHT}"/>`);
  for (let y = 0; y <= TOPOLOGY_SVG_HEIGHT; y += 60) lines.push(`<line x1="0" y1="${y}" x2="${TOPOLOGY_SVG_WIDTH}" y2="${y}"/>`);
  return lines.join('');
}

function layer(name, content) {
  return `<g data-layer="${name}">${content}</g>`;
}

export function topologyParitySvgMarkup(viewModel) {
  if (cleanText(viewModel.schema) !== 'TopologyParitySvgViewModel.v1') throw new TypeError('Parity SVG renderer requires TopologyParitySvgViewModel.v1.');
  const transform = createTopologyWorldTransform(viewModel.bounds, TOPOLOGY_SVG_WIDTH, TOPOLOGY_SVG_HEIGHT, TOPOLOGY_SVG_PADDING);
  const edgeById = new Map([...asArray(viewModel.activeEdges), ...asArray(viewModel.unaffectedEdges)].map((edge) => [cleanText(edge.canonicalEdgeId), edge]));
  const selectedMismatch = asArray(viewModel.mismatches).find((row) => cleanText(row.id) === cleanText(viewModel.selectedMismatchId));
  const selectedKeys = new Set(asArray(selectedMismatch?.objectKeys).map(cleanText));
  const content = {
    grid: gridMarkup(),
    'unaffected-branches': asArray(viewModel.unaffectedEdges).map((edge) => edgeMarkup(edge, transform, 'ttv-parity-edge is-unaffected')).join(''),
    'active-branches': asArray(viewModel.activeEdges).map((edge) => edgeMarkup(edge, transform, `ttv-parity-edge${selectedKeys.has(edge.objectKey) ? ' is-selected' : ''}`)).join(''),
    'component-envelopes': asArray(viewModel.pointFeatures).map((row) => pointMarkup(row, transform, 'ttv-parity-point-feature', 'P')).join(''),
    'legal-connections': asArray(viewModel.activeEdges).filter((edge) => cleanText(edge.segmentRole) === 'CREF_BRANCH_CONNECTION').map((edge) => edgeMarkup(edge, transform, 'ttv-parity-legal-connection')).join(''),
    supports: asArray(viewModel.supports).map((row) => supportMarkup(row, transform)).join(''),
    'deferred-attachments': asArray(viewModel.deferredSupports).map((row) => deferredMarkup(row, transform)).join(''),
    rigids: asArray(viewModel.rigids).map((row) => rigidMarkup(row, edgeById, transform)).join(''),
    junctions: `${asArray(viewModel.junctions).map((row) => pointMarkup(row, transform, 'ttv-parity-junction', cleanText(row.kind) === 'OLET' ? 'O' : 'T')).join('')}${asArray(viewModel.boundaries).map((row) => pointMarkup(row, transform, 'ttv-parity-boundary', '↗')).join('')}`,
    issues: asArray(viewModel.inputEdges).map((edge) => inputEdgeMarkup(edge, transform, selectedKeys.has(edge.objectKey))).join(''),
    'gap-indicators': asArray(viewModel.activeEdges).map((edge) => gapMarkup(edge, transform)).join(''),
    'overlap-indicators': asArray(viewModel.activeEdges).map((edge) => overlapMarkup(edge, transform)).join(''),
    nodes: asArray(viewModel.nodes).map((row) => nodeMarkup(row, transform)).join(''),
    dimensions: asArray(viewModel.supports).map((row) => residualMarkup(row, transform)).join(''),
    labels: viewModel.labels ? `${asArray(viewModel.nodes).map((row) => labelMarkup(row, transform, row.canonicalNodeId)).join('')}${asArray(viewModel.supports).map((row) => labelMarkup(row, transform, row.tag)).join('')}` : '',
    'interaction-targets': asArray(viewModel.activeEdges).map((edge) => {
      const d = pathData(edge.projectedStart, edge.projectedEnd, transform);
      return d ? `<path class="ttv-parity-hit" d="${d}" data-object-key="${escapeAttribute(edge.objectKey)}"/>` : '';
    }).join(''),
  };
  return `<svg class="ttv-parity-svg" viewBox="0 0 ${TOPOLOGY_SVG_WIDTH} ${TOPOLOGY_SVG_HEIGHT}" role="img" aria-label="Canonical InputXML SVG topology parity"><g data-ttv-nav-content>${LAYERS.map((name) => layer(name, content[name] ?? '')).join('')}</g></svg>`;
}

export function renderTopologyParitySvg(host, viewModel) {
  host.innerHTML = topologyParitySvgMarkup(viewModel);
  return host.querySelector('svg');
}

export const TOPOLOGY_PARITY_SVG_LAYERS = LAYERS;
export const _test = Object.freeze({ escapeAttribute, list, pathData, edgeAttributes, edgeMarkup, inputEdgeMarkup, nodeMarkup, pointMarkup, supportMarkup, deferredMarkup, rigidMarkup, gridMarkup, layer });
