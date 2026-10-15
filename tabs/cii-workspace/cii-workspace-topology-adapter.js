import { CII_WORKSPACE_SCHEMAS, compareNodeIds, uniqueStrings } from './cii-workspace-contracts.js';

function nodeId(value) { return String(Math.round(Number(value))); }
function round(value, places = 6) { return Number(Number(value || 0).toFixed(places)); }
function otherNode(edge, node) { return edge.from === node ? edge.to : edge.from; }
function orderedPair(a, b) { return compareNodeIds(a, b) <= 0 ? [a, b] : [b, a]; }

function capability(document, family) { return document?.capabilities?.families?.[family] || null; }
function pointerFamilyReady(document, family, authorityToken, qualification = null) {
  const item = capability(document, family);
  if (!item || item.state === 'PARSE_ERROR') return false;
  if (qualification && item.qualification !== qualification) return false;
  return String(item.authority || '').includes(authorityToken);
}
function auxiliaryForElement(document, element) {
  return document?.auxiliaryEvidence?.elements?.[Number(element?.index)] || null;
}
function fixedBendPointer(auxiliary) {
  const pointer = Number(auxiliary?.pointers?.bend);
  return Number.isSafeInteger(pointer) && pointer >= 0 ? pointer : null;
}
function bendEvidence(element, auxiliary) {
  const pointer = fixedBendPointer(auxiliary);
  if (pointer != null) return Object.freeze({
    status: pointer > 0 ? 'POINTER_BOUND_RECORD' : 'NONE', pointer,
    authority: 'ELEMENT_FIXED_BEND_POINTER', legacyFlagIgnored: Boolean(element?.hasBend) !== (pointer > 0),
  });
  return Object.freeze({
    status: element?.hasBend ? 'LEGACY_FLAG' : 'NONE', pointer: null,
    authority: 'LEGACY_PARSED_BEND_FLAG_FALLBACK', legacyFlagIgnored: false,
  });
}
function rigidEvidence(document, auxiliary) {
  const record = auxiliary?.rigidRecord;
  if (!record) return Object.freeze({ status: 'NONE' });
  if (!pointerFamilyReady(document, 'rigidMass', '#RIGID_POINTER', 'QUALIFIED')) {
    return Object.freeze({ status: 'UNAVAILABLE', reason: 'RIGID_POINTER_CUSTODY_NOT_QUALIFIED', pointer: Number(record.pointer) });
  }
  return Object.freeze({
    status: 'POINTER_BOUND_RECORD', pointer: Number(record.pointer), weight: Number(record.weight), mass: Number(record.weight),
    rawFields: record.rawFields || Object.freeze([]), authority: 'ELEMENT_RIGID_POINTER_TO_RIGID_RECORD',
  });
}
function sifTeeEvidence(document, auxiliary) {
  if (!auxiliary?.sifTeeRecord) return null;
  return pointerFamilyReady(document, 'sifTee', '#SIF_TEE_POINTER') ? auxiliary.sifTeeRecord : null;
}
function processEvidence(element) {
  const evidence = {
    insulationThickness: Number(element.insul || 0),
    corrosionAllowance: Number(element.corrosion || 0),
    insulationDensity: Number(element.insulationDensity || 0),
    fluidDensity: Number(element.fluidDensity || 0),
    hydroPressure: Number(element.hydroPressure || 0),
  };
  for (let index = 1; index <= 9; index += 1) {
    evidence[`T${index}`] = Number(element[`T${index}`] || 0);
    evidence[`P${index}`] = Number(element[`P${index}`] || 0);
  }
  return evidence;
}
function rawEdge(document, element, auxiliary) {
  const rigid = rigidEvidence(document, auxiliary); const bend = bendEvidence(element, auxiliary);
  const isRigid = rigid.status === 'POINTER_BOUND_RECORD'; const isBend = bend.status === 'POINTER_BOUND_RECORD' || bend.status === 'LEGACY_FLAG';
  const componentKind = isRigid ? 'RIGID' : (isBend ? 'BEND' : 'PIPE');
  const packetEvidence = uniqueStrings([isBend ? 'BEND' : '', isRigid ? 'RIGID' : '']);
  return {
    from: nodeId(element.from), to: nodeId(element.to),
    fromNodeName: document?.nodeNames?.[nodeId(element.from)] || '',
    toNodeName: document?.nodeNames?.[nodeId(element.to)] || '',
    canonicalFrom: nodeId(element.from), canonicalTo: nodeId(element.to), normalizedFromTo: `${nodeId(element.from)}->${nodeId(element.to)}`,
    dx: Number(element.dx || 0), dy: Number(element.dy || 0), dz: Number(element.dz || 0),
    lengthMm: Number(element.length || Math.hypot(element.dx || 0, element.dy || 0, element.dz || 0)),
    diameter: Number(element.od || 0), wall: Number(element.wall || 0),
    ...processEvidence(element),
    fromPos: element.fromPos || null, toPos: element.toPos || null,
    componentKind, packetEvidence, flags: packetEvidence,
    parsedElementIndex: Number(element.index), auxiliaryPointers: auxiliary?.pointers || null,
    bendEvidence: bend, sifTeeEvidence: sifTeeEvidence(document, auxiliary), rigidEvidence: rigid,
  };
}

function canonicalEdgeKey(edge) {
  const [a, b] = orderedPair(edge.from, edge.to);
  // Process values are deliberately excluded. They are downstream engineering
  // evidence and must not perturb canonical edge identity/order when revised.
  return [
    a, b, `${edge.from}->${edge.to}`, edge.componentKind,
    round(edge.lengthMm), round(edge.diameter), round(edge.wall),
    round(edge.dx), round(edge.dy), round(edge.dz),
  ].join('|');
}

function canonicalizeElements(document) {
  const rows = (document?.parsed?.elements || []).map((element) => rawEdge(document, element, auxiliaryForElement(document, element)));
  rows.sort((a, b) => canonicalEdgeKey(a).localeCompare(canonicalEdgeKey(b), undefined, { numeric: true, sensitivity: 'base' }));
  return rows.map((edge, index) => ({ ...edge, elementId: `E${index + 1}:${edge.from}->${edge.to}`, index: index + 1 }));
}

function buildIncidence(elements) {
  const adjacency = new Map();
  const add = (node, edge) => {
    const key = nodeId(node);
    if (!adjacency.has(key)) adjacency.set(key, []);
    adjacency.get(key).push(edge);
  };
  for (const edge of elements) { add(edge.from, edge); add(edge.to, edge); }
  for (const rows of adjacency.values()) rows.sort((a, b) => a.elementId.localeCompare(b.elementId, undefined, { numeric: true }));
  return adjacency;
}

function nodeToken(node, edge, adjacency) {
  const next = otherNode(edge, node);
  const degree = (adjacency.get(node) || []).length;
  const nextDegree = (adjacency.get(next) || []).length;
  // M2 is structural. OD, wall, process values and SIF/TEE are revision
  // evidence and never become network identity tokens.
  return `D${degree}->D${nextDegree}|${edge.componentKind}`;
}

function neighbourhoodLayers(start, adjacency, maxDepth = 3) {
  const visited = new Set([start]);
  let frontier = [start];
  const layers = [];
  for (let depth = 1; depth <= maxDepth && frontier.length; depth += 1) {
    const tokens = [];
    const nextFrontier = [];
    for (const node of frontier.sort(compareNodeIds)) {
      for (const edge of adjacency.get(node) || []) {
        tokens.push(nodeToken(node, edge, adjacency));
        const next = otherNode(edge, node);
        if (!visited.has(next)) { visited.add(next); nextFrontier.push(next); }
      }
    }
    layers.push(Object.freeze(uniqueStrings(tokens)));
    frontier = uniqueStrings(nextFrontier).sort(compareNodeIds);
  }
  return Object.freeze(layers);
}

function contextFor(node, adjacency) {
  const incident = adjacency.get(node) || [];
  const diameters = incident.map((edge) => round(edge.diameter)).sort((a, b) => a - b);
  return Object.freeze({
    nodeId: node, degree: incident.length,
    inDegree: incident.filter((edge) => edge.to === node).length,
    outDegree: incident.filter((edge) => edge.from === node).length,
    lengths: incident.map((edge) => round(edge.lengthMm)).sort((a, b) => a - b),
    diameters, sizeTransition: new Set(diameters).size > 1,
    componentKinds: uniqueStrings(incident.map((edge) => edge.componentKind)),
    neighbourhoodLayers: neighbourhoodLayers(node, adjacency),
  });
}

function contextIndex(orderedNodes, adjacency) {
  return new Map(orderedNodes.map((id) => [id, contextFor(id, adjacency)]));
}

function attachContexts(edges, contexts) {
  for (const edge of edges) {
    edge.fromContext = contexts.get(edge.from);
    edge.toContext = contexts.get(edge.to);
    edge.anchorFlags = uniqueStrings([
      edge.fromContext.degree === 1 ? 'FROM_TERMINAL' : '', edge.toContext.degree === 1 ? 'TO_TERMINAL' : '',
      edge.fromContext.degree >= 3 ? 'FROM_BRANCH' : '', edge.toContext.degree >= 3 ? 'TO_BRANCH' : '',
      edge.fromContext.sizeTransition ? 'FROM_SIZE_TRANSITION' : '', edge.toContext.sizeTransition ? 'TO_SIZE_TRANSITION' : '',
      edge.componentKind !== 'PIPE' ? 'PROPERTY_ANCHOR' : '',
    ]);
    edge.isAnchorElement = edge.anchorFlags.length > 0;
  }
}

export function adaptCiiDocumentToTopologyGraph(document, options = {}) {
  const topologyStartedAt = performance.now();
  if (document?.schema !== CII_WORKSPACE_SCHEMAS.document) throw new Error('CII_WORKSPACE_DOCUMENT_REQUIRED');
  const rigidCapability = capability(document, 'rigidMass');
  if (rigidCapability?.state === 'PARSE_ERROR') throw new Error('CII_WORKSPACE_RIGID_AUXILIARY_PARSE_BLOCKED');
  const edges = canonicalizeElements(document);
  const adjacency = buildIncidence(edges);
  const orderedNodes = [...adjacency.keys()].sort(compareNodeIds);
  const contexts = contextIndex(orderedNodes, adjacency);
  attachContexts(edges, contexts);
  const topologyStage = document.side === 'TARGET' ? 'TARGET_TOPOLOGY' : 'SOURCE_TOPOLOGY';
  options.instrumentation?.record?.(topologyStage);
  options.instrumentation?.record?.(`${topologyStage}_MS`, performance.now() - topologyStartedAt);
  return {
    schema: CII_WORKSPACE_SCHEMAS.graph, side: document.side, documentId: `${document.side}:${document.contentSha256}`,
    edges, adjacency,
    nodes: orderedNodes.map((id) => Object.freeze({
      id, degree: adjacency.get(id).length, position: document.parsed.nodes?.[id] || null,
      nodeName: document.nodeNames?.[id] || '', neighbourhoodLayers: contexts.get(id).neighbourhoodLayers,
    })),
    summary: Object.freeze({ nodeCount: orderedNodes.length, elementCount: edges.length }),
  };
}

export const _test = Object.freeze({ fixedBendPointer, bendEvidence });
