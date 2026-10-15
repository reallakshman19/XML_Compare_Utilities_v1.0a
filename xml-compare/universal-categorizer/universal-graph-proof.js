import { createLinewiseUniversalCategorizedGraphPreview, createUniversalCategorizedGraphPreview, findForbiddenUxc002Changes, UNIVERSAL_GRAPH_XML_EXPORT_STATUS } from './universal-graph-builder.js';

export const UNIVERSAL_GRAPH_PROOF_SCHEMA = 'universal-graph-proof/v1-shadow';
export const UNIVERSAL_GRAPH_SIGNATURE_ALGORITHM = 'stable-json-fnv1a32';

const freeze = (value) => Object.freeze(value);
const arr = (value) => Array.isArray(value) ? value : [];
const text = (value, fallback = '') => String(value ?? fallback).trim();

export function createUniversalGraphProof(input = {}) {
  const graph = input.graph?.schema === 'CategorizedGraph.v1-preview-shadow'
    ? input.graph
    : createUniversalCategorizedGraphPreview(input);
  const canonicalGraph = canonicalizeUniversalGraph(graph);
  const canonicalJson = stableStringify(canonicalGraph);
  const signature = hashStableString(canonicalJson);
  const diagnostics = freeze([
    ...(graph.diagnostics || []),
    ...(graph.xmlExportEnabled === false ? [] : [diagnostic('error', 'UXC_GRAPH_EXPORT_FLAG_UNSAFE', graph.profileId, 'Graph preview must keep XML export disabled.')]),
    ...(graph.exportStatus === UNIVERSAL_GRAPH_XML_EXPORT_STATUS ? [] : [diagnostic('error', 'UXC_GRAPH_EXPORT_STATUS_UNSAFE', graph.profileId, 'Graph preview export status is not the expected disabled gate value.')]),
  ]);

  return freeze({
    schema: UNIVERSAL_GRAPH_PROOF_SCHEMA,
    graphSchema: graph.schema,
    profileId: graph.profileId,
    signatureAlgorithm: UNIVERSAL_GRAPH_SIGNATURE_ALGORITHM,
    signature,
    canonicalJson,
    exportStatus: graph.exportStatus,
    xmlExportEnabled: Boolean(graph.xmlExportEnabled),
    counts: freeze({
      levels: graph.summary?.levels ?? graph.levels?.items?.length ?? 0,
      nodes: graph.summary?.nodes ?? graph.nodes?.length ?? 0,
      blocks: graph.summary?.blocks ?? countBlocks(graph),
      sideloadAttachments: graph.summary?.sideloadAttachments ?? countAttachments(graph),
      diagnostics: diagnostics.length,
    }),
    deterministic: true,
    diagnostics,
  });
}

export function createLinewiseUniversalGraphProof() {
  return createUniversalGraphProof({ graph: createLinewiseUniversalCategorizedGraphPreview() });
}

export function canonicalizeUniversalGraph(graph = {}) {
  return freeze({
    schema: text(graph.schema),
    profileId: text(graph.profileId),
    exportStatus: text(graph.exportStatus),
    xmlExportEnabled: Boolean(graph.xmlExportEnabled),
    levels: arr(graph.levels?.items).map((level) => stableObject({
      levelId: level.levelId,
      displayName: level.displayName,
      children: arr(level.children),
      ordinal: level.ordinal,
    })).sort(sortByJson),
    nodes: arr(graph.nodes).map((node) => stableObject({
      nodeId: node.nodeId,
      levelId: node.levelId,
      key: node.key,
      keyField: node.keyField,
      label: node.label,
      parentId: node.parentId,
      blocks: Object.values(node.blocks || {}).map((block) => stableObject({
        blockName: block.blockName,
        attachToLevelId: block.attachToLevelId,
        createMode: block.createMode,
        source: block.source,
        fields: stableObject(block.fields || {}),
        attachments: arr(block.attachments).map((attachment) => stableObject(attachment)).sort(sortByJson),
      })).sort(sortByJson),
    })).sort(sortByJson),
    diagnostics: arr(graph.diagnostics).map((item) => stableObject({ severity: item.severity, code: item.code, subjectId: item.subjectId || item.ruleId || item.sourceId, message: item.message })).sort(sortByJson),
  });
}

export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).filter(([, entryValue]) => entryValue !== undefined).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function hashStableString(value = '') {
  let hash = 0x811c9dc5;
  const input = String(value ?? '');
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `uxc-${hash.toString(16).padStart(8, '0')}`;
}

export function findForbiddenUxc003Changes(paths = []) {
  return findForbiddenUxc002Changes(paths);
}

function stableObject(input = {}) {
  return freeze(Object.fromEntries(Object.entries(input || {}).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, Array.isArray(value) ? freeze(value) : value && typeof value === 'object' ? stableObject(value) : value])));
}

function sortByJson(a, b) {
  return stableStringify(a).localeCompare(stableStringify(b));
}

function countBlocks(graph = {}) {
  return arr(graph.nodes).reduce((sum, node) => sum + Object.keys(node.blocks || {}).length, 0);
}

function countAttachments(graph = {}) {
  return arr(graph.nodes).reduce((sum, node) => sum + Object.values(node.blocks || {}).reduce((inner, block) => inner + arr(block.attachments).length, 0), 0);
}

function diagnostic(severity, code, subjectId, message) {
  return freeze({ severity, code, subjectId, message });
}

export const _test = freeze({ stableObject, sortByJson, countBlocks, countAttachments, diagnostic });
