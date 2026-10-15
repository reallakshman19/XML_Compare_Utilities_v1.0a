/**
 * Functionality: builds immutable, directional selection groups for source,
 * canonical, ledger, InputXML, and issue objects. Inputs are view-model rows.
 * Output is a lookup map. Fallback: unlinked objects remain selectable alone;
 * shared canonical targets aggregate all directly referencing ledger records.
 */

import { asArray, cleanText, deepFreeze, objectRecord, uniqueText } from './topology-validator-values.js';

/** @param {Record<string, unknown>} record @returns {string[]} */
export function canonicalSelectionKeys(record) {
  return [
    ...asArray(record.canonicalNodeIds).map((id) => `canonical:node:${cleanText(id)}`),
    ...uniqueText([...asArray(record.canonicalEdgeIds), ...asArray(record.affectedEdgeIds), ...asArray(record.branchEdgeIds)]).map((id) => `canonical:edge:${cleanText(id)}`),
    ...asArray(record.pointFeatureIds).map((id) => `canonical:pointFeature:${cleanText(id)}`),
    ...asArray(record.junctionIds).map((id) => `canonical:junction:${cleanText(id)}`),
    ...asArray(record.boundaryIds).map((id) => `canonical:boundary:${cleanText(id)}`),
  ];
}

/** @param {Record<string, unknown>} link @param {Record<string, unknown>[]} sources @param {Record<string, unknown>[]} inputElements @returns {string[]} */
function linkKeys(link, sources, inputElements) {
  return uniqueText([
    cleanText(link.objectKey),
    ...sources.filter((row) => cleanText(row.sourceEntityId) === cleanText(link.sourceEntityId) || cleanText(row.sourcePath) === cleanText(link.sourcePath)).map((row) => row.objectKey),
    ...canonicalSelectionKeys(link),
    ...asArray(link.inputXmlElementIds).flatMap((id) => inputElements.filter((row) => cleanText(row.id) === cleanText(id)).map((row) => row.objectKey)),
    ...(cleanText(link.projectionCardinality) === 'MANY_TO_ONE' ? asArray(link.inputXmlElementIds).map((id) => `trace-target:projection:${cleanText(id)}`) : []),
  ]);
}

/** @param {Map<string,Record<string,unknown>[]>} assignments @param {string} key @param {Record<string, unknown>} link @returns {void} */
function assign(assignments, key, link) {
  if (!key) return;
  assignments.set(key, [...(assignments.get(key) ?? []), link]);
}

/** @param {Record<string, unknown>[]} links @param {Record<string, unknown>[]} sources @param {Record<string, unknown>[]} inputElements @returns {Record<string, unknown>} */
function linkedLookup(links, sources, inputElements) {
  const assignments = new Map(), keysByLink = new Map();
  for (const link of links) {
    const keys = linkKeys(link, sources, inputElements);
    keysByLink.set(cleanText(link.objectKey), keys);
    assign(assignments, cleanText(link.objectKey), link);
    for (const sourceKey of keys.filter((key) => key.startsWith('source:'))) assign(assignments, sourceKey, link);
    for (const targetKey of keys.filter((key) => key.startsWith('canonical:') || key.startsWith('inputxml:') || key.startsWith('trace-target:'))) assign(assignments, targetKey, link);
  }
  const lookup = {};
  for (const [selectedKey, selectedLinks] of assignments) {
    const records = uniqueRecords(selectedLinks);
    const keys = uniqueText(records.flatMap((link) => keysByLink.get(cleanText(link.objectKey)) ?? []));
    lookup[selectedKey] = deepFreeze({
      keys,
      sourceEntityIds: uniqueText(records.map((record) => record.sourceEntityId)),
      sourcePaths: uniqueText(records.map((record) => record.sourcePath)),
      record: records[0] ?? null,
      records: Object.freeze(records),
    });
  }
  return lookup;
}

/** @param {Record<string, unknown>[]} records @returns {Record<string, unknown>[]} */
function uniqueRecords(records) {
  const seen = new Set();
  return records.filter((record) => {
    const key = cleanText(record.objectKey);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** @param {Record<string, unknown>} lookup @param {Record<string, unknown>[]} issues @returns {void} */
function addIssueGroups(lookup, issues) {
  for (const issue of issues) {
    const issueKey = `issue:${cleanText(issue.id)}`;
    const keys = uniqueText([issueKey, ...asArray(issue.objectKeys)]);
    lookup[issueKey] = deepFreeze({ keys, sourceEntityIds: asArray(issue.sourceEntityIds), sourcePaths: [cleanText(issue.sourcePath)].filter(Boolean), record: null, records: [], issue });
  }
}

/** @param {Record<string, unknown>} input @returns {Readonly<Record<string, unknown>>} */
export function buildTopologySelectionLookup(input) {
  const sources = asArray(input.sources).map(objectRecord), links = asArray(input.links).map(objectRecord), inputElements = asArray(input.inputElements).map(objectRecord);
  const objects = [...sources, ...asArray(input.nodes), ...asArray(input.edges), ...asArray(input.points), ...asArray(input.junctions), ...asArray(input.boundaries), ...links, ...inputElements].map(objectRecord);
  const lookup = linkedLookup(links, sources, inputElements);
  addIssueGroups(lookup, asArray(input.issues).map(objectRecord));
  for (const object of objects) {
    const key = cleanText(object.objectKey);
    if (key && !lookup[key]) lookup[key] = deepFreeze({ keys: [key], sourceEntityIds: uniqueText([object.sourceEntityId]), sourcePaths: uniqueText([object.sourcePath]), record: null, records: [] });
  }
  return deepFreeze(lookup);
}

export const _test = Object.freeze({ linkKeys, linkedLookup, uniqueRecords });
