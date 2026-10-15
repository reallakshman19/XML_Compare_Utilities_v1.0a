/**
 * Functionality: renders the relationship-focused source-to-canonical lane
 * markup from TopologySvgViewModel.v1. Input is the immutable view model.
 * Output is SVG markup only. Fallback: deferred/blocked records terminate in
 * explicit disposition targets rather than disappearing.
 */

import { asArray, cleanText, escapeMarkup, objectRecord, uniqueText } from './topology-validator-values.js';

/** @param {Record<string, unknown>} link @returns {string[]} */
function targetKeys(link) {
  const keys = [
    ...uniqueText([...asArray(link.canonicalEdgeIds), ...asArray(link.affectedEdgeIds), ...asArray(link.branchEdgeIds)]).map((id) => `edge:${cleanText(id)}`),
    ...asArray(link.canonicalNodeIds).map((id) => `node:${cleanText(id)}`),
    ...asArray(link.pointFeatureIds).map((id) => `point:${cleanText(id)}`),
    ...asArray(link.junctionIds).map((id) => `junction:${cleanText(id)}`),
    ...asArray(link.boundaryIds).map((id) => `boundary:${cleanText(id)}`),
    ...(cleanText(link.projectionCardinality) === 'MANY_TO_ONE' ? asArray(link.inputXmlElementIds).map((id) => `projection:${cleanText(id)}`) : []),
  ];
  if (!keys.length) keys.push(`disposition:${cleanText(link.disposition) || 'UNRESOLVED'}`);
  return uniqueText(keys);
}

/** @param {Record<string, unknown>} viewModel @returns {string} */
export function buildTopologyTraceLaneMarkup(viewModel) {
  const sources = asArray(viewModel.traceSources ?? viewModel.sourceComponents).map(objectRecord);
  const links = asArray(viewModel.traceLinks).map(objectRecord);
  const targets = uniqueText(links.flatMap(targetKeys));
  const sourceX = new Map(sources.map((source, index) => [cleanText(source.objectKey), laneX(index, sources.length)]));
  const targetX = new Map(targets.map((target, index) => [target, laneX(index, targets.length)]));
  const sourceByIdentity = (link) => sources.find((source) => cleanText(source.sourceEntityId) === cleanText(link.sourceEntityId) || cleanText(source.sourcePath) === cleanText(link.sourcePath));
  const connectors = links.flatMap((link) => {
    const source = sourceByIdentity(link), startX = sourceX.get(cleanText(source?.objectKey));
    if (!source || startX === undefined) return [];
    return targetKeys(link).map((target) => {
      const endX = targetX.get(target) ?? 600;
      return `<path class="ttv-trace-link ttv-disposition-${escapeMarkup(cleanText(link.disposition).toLowerCase())}" d="M ${startX} 250 C ${startX} 340 ${endX} 340 ${endX} 448" data-object-key="${escapeMarkup(link.objectKey)}" data-source-entity-id="${escapeMarkup(link.sourceEntityId)}" data-inputxml-element-ids="${escapeMarkup(asArray(link.inputXmlElementIds).join(' '))}"/>`;
    });
  }).join('');
  const sourceBoxes = sources.map((source, index) => {
    const x = laneX(index, sources.length), label = source.name || source.ref || source.type || source.sourcePath;
    return `<g class="ttv-lane-object ttv-source-object" data-object-key="${escapeMarkup(source.objectKey)}" data-source-entity-id="${escapeMarkup(source.sourceEntityId)}"><rect x="${x - 45}" y="180" width="90" height="70" rx="8"/><text x="${x}" y="204">${escapeMarkup(source.type)}</text><text x="${x}" y="224">${escapeMarkup(shortLabel(label, 14))}</text><title>${escapeMarkup(source.sourcePath)}</title></g>`;
  }).join('');
  const targetBoxes = targets.map((target, index) => {
    const x = laneX(index, targets.length), parts = target.split(':'), type = parts[0], id = parts.slice(1).join(':');
    return `<g class="ttv-lane-object ttv-target-object ttv-target-${escapeMarkup(type)}" data-object-key="${escapeMarkup(targetObjectKey(type, id))}"><rect x="${x - 45}" y="448" width="90" height="70" rx="8"/><text x="${x}" y="473">${escapeMarkup(type.toUpperCase())}</text><text x="${x}" y="493">${escapeMarkup(shortLabel(id, 14))}</text><title>${escapeMarkup(target)}</title></g>`;
  }).join('');
  return `<text class="ttv-lane-title" x="48" y="92">SOURCE COMPONENTS</text><line class="ttv-lane-rule" x1="48" y1="112" x2="1152" y2="112"/><text class="ttv-lane-title" x="48" y="610">CANONICAL TOPOLOGY / CII PROJECTION</text><line class="ttv-lane-rule" x1="48" y1="590" x2="1152" y2="590"/>${connectors}${sourceBoxes}${targetBoxes}`;
}

/** @param {number} index @param {number} count @returns {number} */
function laneX(index, count) {
  if (count <= 1) return 600;
  return 60 + index * (1080 / (count - 1));
}

/** @param {unknown} value @param {number} length @returns {string} */
function shortLabel(value, length) {
  const text = cleanText(value);
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

/** @param {string} type @param {string} id @returns {string} */
function targetObjectKey(type, id) {
  const prefixes = { edge: 'edge', node: 'node', point: 'pointFeature', junction: 'junction', boundary: 'boundary' };
  return prefixes[type] ? `canonical:${prefixes[type]}:${id}` : `trace-target:${type}:${id}`;
}

export const _test = Object.freeze({ targetKeys, targetObjectKey, laneX, shortLabel });
