/**
 * Ghost visual model for fix proposals. Converts TopologyFixSuggestion.v1
 * previews (and ATTRIBUTE_EDIT suggestion rows) into translucent
 * VisualGeometryModel.v2 fragments rendered by the viewer's ghost layer.
 * Every ghost object carries objectId `ghost:<suggestionId>` so a canvas pick
 * routes straight back to its suggestion for Apply / Reject.
 */

import { createVisualGeometryModelV2 } from '../../contracts/visual-geometry-model.js';
import { asArray, cleanText, objectRecord } from './topology-validator-values.js';

export const GHOST_ID_PREFIX = 'ghost:';

const COLOR_BY_KIND = Object.freeze({
  MERGE_NODES: 0x22d3ee,
  BRIDGE_GAP: 0x38bdf8,
  ADD_BEND_DEFINITION: 0x8b5cf6,
  ADD_JUNCTION_DEFINITION: 0xfacc15,
  TRIM_EDGE: 0xef4444,
  ATTRIBUTE_EDIT: 0x34d399,
});

const point = (value) => {
  const record = objectRecord(value);
  const coords = [Number(record.x), Number(record.y), Number(record.z)];
  return coords.every(Number.isFinite) ? coords : null;
};

function nodePosition(canonical, nodeId) {
  const node = asArray(canonical.nodes).map(objectRecord).find((row) => cleanText(row.id) === cleanText(nodeId));
  return node ? point(node.position) : null;
}

/** @param {string} objectId @returns {string} suggestion id or '' */
export function ghostSuggestionId(objectId) {
  const value = cleanText(objectId);
  return value.startsWith(GHOST_ID_PREFIX) ? value.slice(GHOST_ID_PREFIX.length) : '';
}

/**
 * @param {ReadonlyArray<Record<string, unknown>>} suggestions core + extended geometry suggestions
 * @param {ReadonlyArray<Record<string, unknown>>} attributeSuggestions ATTRIBUTE_EDIT rows
 * @param {Record<string, unknown>} canonical current draft canonical
 * @param {Record<string, unknown>} document active ProjectDocument.v1
 * @returns {Readonly<Record<string, unknown>>} VisualGeometryModel.v2
 */
export function buildGhostVisualModel(suggestions, attributeSuggestions, canonical, document) {
  const segments = [];
  const markers = [];
  const marker = (objectId, position, colorInt, sizeMm) => {
    if (position) markers.push({ objectId, kind: 'NODE', position, colorInt, sizeMm, isObjectMarker: true });
  };
  for (const suggestionRecord of asArray(suggestions).map(objectRecord)) {
    const preview = objectRecord(suggestionRecord.preview);
    const kind = cleanText(preview.kind);
    const objectId = `${GHOST_ID_PREFIX}${cleanText(suggestionRecord.id)}`;
    const colorInt = COLOR_BY_KIND[kind] ?? 0x22d3ee;
    if (kind === 'MERGE_NODES' || kind === 'BRIDGE_GAP') {
      const from = point(preview.from), to = point(preview.to);
      if (from && to) {
        segments.push({ objectId, start: from, end: to, radiusMm: 14, kind: 'ghost-link', colorInt });
        marker(objectId, from, colorInt, 26);
        marker(objectId, to, colorInt, 26);
      }
    } else if (kind === 'ADD_BEND_DEFINITION' || kind === 'ADD_JUNCTION_DEFINITION') {
      const position = nodePosition(canonical, preview.nodeId);
      const size = kind === 'ADD_BEND_DEFINITION' ? Math.max(Number(preview.radiusMm) / 3 || 0, 30) : 36;
      marker(objectId, position, colorInt, size);
    } else if (kind === 'TRIM_EDGE') {
      const from = nodePosition(canonical, preview.nodeId), to = point(preview.position);
      if (from && to) segments.push({ objectId, start: from, end: to, radiusMm: 12, kind: 'ghost-trim', colorInt });
      marker(objectId, to ?? from, colorInt, 24);
    }
  }
  for (const row of asArray(attributeSuggestions).map(objectRecord)) {
    if (!Array.isArray(row.position)) continue;
    marker(`${GHOST_ID_PREFIX}${cleanText(row.id)}`, row.position.map(Number), COLOR_BY_KIND.ATTRIBUTE_EDIT, 30);
  }
  const hash = cleanText(canonical.canonicalTopologyHash) || cleanText(canonical.schema);
  return createVisualGeometryModelV2({
    modelId: `topology:ghost:${hash}`, documentId: cleanText(document.documentId), revisionId: `ghost:${hash}`,
    unit: cleanText(document.unit), coordinateFrame: cleanText(document.coordinateFrame),
    verticalAxis: cleanText(document.verticalAxis), origin: [0, 0, 0], segments, markers,
    bounds: { min: [0, 0, 0], max: [1, 1, 1] },
  });
}
