/**
 * Functionality: validates direct and explicit many-to-one projection vectors.
 * Inputs are canonical records, ledger records, parsed InputXML elements, a
 * tolerance, and a finding callback. Output is mismatch count. Fallback:
 * ambiguous edge-to-element assignments become findings, never guessed pairs.
 */

import { asArray, cleanText, objectRecord, strictPoint, uniqueText } from './topology-validator-values.js';

/** @param {Record<string, unknown>} edge @param {Map<string,Record<string,unknown>>} nodeById @returns {Record<string, number>|null} */
function edgeVector(edge, nodeById) {
  const start = strictPoint(objectRecord(nodeById.get(cleanText(edge.fromNodeId))).position);
  const end = strictPoint(objectRecord(nodeById.get(cleanText(edge.toNodeId))).position);
  return start && end ? { x: end.x - start.x, y: end.y - start.y, z: end.z - start.z } : null;
}

/** @param {Record<string, unknown>} delta @param {Record<string, number>} vector @returns {number|null} */
function vectorResidual(delta, vector) {
  if (![delta.x, delta.y, delta.z].every((value) => typeof value === 'number')) return null;
  return Math.hypot(vector.x - Number(delta.x), vector.y - Number(delta.y), vector.z - Number(delta.z));
}

/** @param {Record<string, unknown>[]} records @returns {Map<string,Record<string,unknown>[]>} */
function recordsByEdge(records) {
  const result = new Map();
  for (const record of records) for (const edgeId of asArray(record.canonicalEdgeIds).map(cleanText)) result.set(edgeId, [...(result.get(edgeId) ?? []), record]);
  return result;
}

/** @param {Record<string, unknown>[]} records @returns {Map<string,Record<string,unknown>[]>} */
function mergeGroups(records) {
  const groups = new Map();
  for (const record of records.filter((row) => cleanText(row.projectionCardinality) === 'MANY_TO_ONE')) for (const elementId of asArray(record.inputXmlElementIds).map(cleanText)) groups.set(elementId, [...(groups.get(elementId) ?? []), record]);
  return groups;
}

/** @param {Record<string, unknown>} input @param {number} toleranceMm @param {(code:string,message:string,context:Record<string,unknown>)=>void} addFinding @returns {number} */
export function validateProjectionVectors(input, toleranceMm, addFinding) {
  const canonical = objectRecord(input.canonical), records = asArray(input.records).map(objectRecord), elementById = input.elementById;
  const nodes = new Map(asArray(canonical.nodes).map((row) => [cleanText(objectRecord(row).id), objectRecord(row)]));
  const edges = asArray(canonical.edges).map(objectRecord), edgeMap = new Map(edges.map((row) => [cleanText(row.id), row]));
  const byEdge = recordsByEdge(records), merges = mergeGroups(records), mergedElementIds = new Set(merges.keys());
  let mismatches = 0;
  for (const edge of edges) {
    const vector = edgeVector(edge, nodes);
    if (!vector) continue;
    const directIds = uniqueText(asArray(edge.inputXmlElementIds)), ledgerIds = uniqueText((byEdge.get(cleanText(edge.id)) ?? []).flatMap((row) => asArray(row.inputXmlElementIds)));
    const ids = directIds.length ? directIds : ledgerIds.length === 1 ? ledgerIds : [];
    if (!directIds.length && ledgerIds.length > 1) addFinding('INPUTXML_EDGE_MAPPING_AMBIGUOUS', `Canonical edge ${edge.id} has ${ledgerIds.length} projection candidates without an explicit edge mapping.`, { canonicalIds: [cleanText(edge.id)], inputXmlElementIds: ledgerIds });
    for (const id of ids) {
      if (mergedElementIds.has(id)) continue;
      const element = objectRecord(elementById.get(id));
      if (!Object.keys(element).length) continue;
      const residual = vectorResidual(objectRecord(element.delta), vector);
      if (residual === null) addFinding('INPUTXML_VECTOR_INCOMPLETE', `InputXML element ${id} has an incomplete DELTA_X/Y/Z vector.`, { canonicalIds: [cleanText(edge.id)], inputXmlElementIds: [id] });
      else if (residual > toleranceMm) { mismatches += 1; addFinding('INPUTXML_VECTOR_MISMATCH', `Canonical edge ${edge.id} and InputXML element ${id} differ by ${residual.toFixed(6)} mm.`, { canonicalIds: [cleanText(edge.id)], inputXmlElementIds: [id], details: { residualMm: residual, toleranceMm } }); }
    }
  }
  for (const [elementId, group] of merges) {
    const edgeIds = uniqueText(group.flatMap((record) => asArray(record.canonicalEdgeIds))), vectors = edgeIds.map((id) => edgeVector(objectRecord(edgeMap.get(id)), nodes)).filter(Boolean);
    if (vectors.length !== edgeIds.length) continue;
    const total = vectors.reduce((sum, vector) => ({ x: sum.x + vector.x, y: sum.y + vector.y, z: sum.z + vector.z }), { x: 0, y: 0, z: 0 });
    const residual = vectorResidual(objectRecord(objectRecord(elementById.get(elementId)).delta), total);
    if (residual === null) addFinding('INPUTXML_VECTOR_INCOMPLETE', `Merged InputXML element ${elementId} has an incomplete DELTA_X/Y/Z vector.`, { canonicalIds: edgeIds, inputXmlElementIds: [elementId] });
    else if (residual > toleranceMm) { mismatches += 1; addFinding('INPUTXML_VECTOR_MISMATCH', `Merged canonical edge set and InputXML element ${elementId} differ by ${residual.toFixed(6)} mm.`, { canonicalIds: edgeIds, inputXmlElementIds: [elementId], details: { residualMm: residual, toleranceMm } }); }
  }
  return mismatches;
}

export const _test = Object.freeze({ edgeVector, vectorResidual, recordsByEdge, mergeGroups });
