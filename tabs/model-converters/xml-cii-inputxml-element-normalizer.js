const DEFAULT_CONSUME_TOL_MM = 6;

function text(value) { return value === undefined || value === null ? '' : String(value).trim(); }
function finite(value) { const n = Number(value); return Number.isFinite(n) ? n : null; }
function unique(values) { return [...new Set((values || []).filter((value) => text(value)))]; }
function nodeSort(a, b) { return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }); }
function edgeLength(edge) { return Math.hypot(Number(edge.dx || 0), Number(edge.dy || 0), Number(edge.dz || 0)); }
function packetEvidence(edge) {
  return unique([
    ...(edge.flags || []),
    ...(edge.restraintTypes || []).map((type) => `REST:${type}`),
    ...(edge.sifTypes || []).map((type) => `SIF:${type}`),
  ]).sort();
}
function createDsu(nodeIds) {
  const parent = new Map();
  for (const id of nodeIds) parent.set(text(id), text(id));
  const find = (id) => {
    const key = text(id);
    if (!parent.has(key)) parent.set(key, key);
    const root = parent.get(key);
    if (root === key) return key;
    const found = find(root);
    parent.set(key, found);
    return found;
  };
  const mergeInto = (retained, dropped) => {
    const keep = find(retained);
    const drop = find(dropped);
    if (keep !== drop) parent.set(drop, keep);
    return keep;
  };
  return { find, mergeInto };
}
function chooseShortEdgeRetainedNode(edge, nodeEdges) {
  const fromEdges = nodeEdges.get(edge.from) || [];
  const toEdges = nodeEdges.get(edge.to) || [];
  const fromHasLongIncoming = fromEdges.some((item) => item !== edge && item.to === edge.from && item.lengthMm > edge.consumeToleranceMm);
  const toHasLongOutgoing = toEdges.some((item) => item !== edge && item.from === edge.to && item.lengthMm > edge.consumeToleranceMm);
  if (fromHasLongIncoming || toHasLongOutgoing) return { retained: edge.from, dropped: edge.to };
  return nodeSort(edge.from, edge.to) <= 0 ? { retained: edge.from, dropped: edge.to } : { retained: edge.to, dropped: edge.from };
}
function buildRawNodeEdges(edges) {
  const map = new Map();
  const add = (node, edge) => {
    const key = text(node);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(edge);
  };
  for (const edge of edges) { add(edge.from, edge); add(edge.to, edge); }
  return map;
}
function cloneCanonicalEdge(edge, dsu) {
  const canonicalFrom = dsu.find(edge.from);
  const canonicalTo = dsu.find(edge.to);
  return {
    ...edge,
    canonicalFrom,
    canonicalTo,
    normalizedFromTo: `${canonicalFrom}->${canonicalTo}`,
    consumedPackets: [],
    packetEvidence: packetEvidence(edge),
    normalizedLengthMm: edge.lengthMm,
  };
}
function rebuildNodeContexts(edges) {
  const nodes = new Map();
  const ensure = (id) => {
    const key = text(id);
    if (!nodes.has(key)) nodes.set(key, { id: key, incident: [], inbound: [], outbound: [], flags: new Set(), childTypes: new Set() });
    return nodes.get(key);
  };
  for (const edge of edges) {
    const from = ensure(edge.canonicalFrom);
    const to = ensure(edge.canonicalTo);
    from.incident.push(edge); from.outbound.push(edge);
    to.incident.push(edge); to.inbound.push(edge);
    for (const node of [from, to]) {
      for (const item of edge.packetEvidence || []) {
        if (item.startsWith('REST:') || item.startsWith('SIF:')) node.childTypes.add(item);
        else node.flags.add(item);
      }
    }
  }
  return nodes;
}
function attachConsumedPackets(canonicalEdges, consumedRows) {
  const orphanPackets = [];
  for (const consumed of consumedRows) {
    const candidates = canonicalEdges.filter((edge) => edge.canonicalFrom === consumed.retainedNode || edge.canonicalTo === consumed.retainedNode || edge.canonicalFrom === consumed.droppedNode || edge.canonicalTo === consumed.droppedNode);
    const after = candidates.find((edge) => Number(edge.index) > Number(consumed.index));
    const target = after || candidates[0] || null;
    if (!target) { orphanPackets.push(consumed); continue; }
    target.consumedPackets.push(consumed);
    target.packetEvidence = unique([...(target.packetEvidence || []), ...(consumed.packetEvidence || [])]).sort();
  }
  return orphanPackets;
}
function nodeContext(node, toleranceMm) {
  const lengths = (node?.incident || []).map((edge) => Math.round(edge.lengthMm / toleranceMm) * toleranceMm).sort((a, b) => a - b);
  const diameters = (node?.incident || []).map((edge) => finite(edge.diameter)).filter((value) => value !== null).map((value) => Math.round(value / toleranceMm) * toleranceMm).sort((a, b) => a - b);
  return {
    nodeId: node?.id || '',
    degree: node?.incident?.length || 0,
    inDegree: node?.inbound?.length || 0,
    outDegree: node?.outbound?.length || 0,
    lengths,
    diameters,
    flags: [...(node?.flags || [])].sort(),
    childTypes: [...(node?.childTypes || [])].sort(),
  };
}
function classifyAnchor(edge, nodeMap) {
  const flags = [];
  const from = nodeMap.get(edge.canonicalFrom);
  const to = nodeMap.get(edge.canonicalTo);
  if ((from?.incident?.length || 0) === 1) flags.push('FROM_TERMINAL');
  if ((to?.incident?.length || 0) === 1) flags.push('TO_TERMINAL');
  if ((from?.incident?.length || 0) >= 3) flags.push('FROM_BRANCH');
  if ((to?.incident?.length || 0) >= 3) flags.push('TO_BRANCH');
  if ((edge.packetEvidence || []).some((item) => ['RIGID', 'BEND', 'SIF', 'RESTRAINT'].includes(item) || item.startsWith('REST:') || item.startsWith('SIF:'))) flags.push('PROPERTY_PACKET');
  return unique(flags).sort();
}
function assignComponentsAndStations(edges, nodeMap) {
  const adjacency = new Map();
  const add = (node, edge) => {
    if (!adjacency.has(node)) adjacency.set(node, []);
    adjacency.get(node).push(edge);
  };
  for (const edge of edges) { add(edge.canonicalFrom, edge); add(edge.canonicalTo, edge); }
  const visitedEdges = new Set();
  let componentId = 0;
  const componentRows = [];
  const sortedNodes = [...adjacency.keys()].sort(nodeSort);
  for (const seed of sortedNodes) {
    if ((adjacency.get(seed) || []).every((edge) => visitedEdges.has(edge.elementId))) continue;
    componentId += 1;
    const componentNodes = new Set();
    const componentEdges = [];
    const terminals = sortedNodes.filter((node) => (adjacency.get(node) || []).some((edge) => !visitedEdges.has(edge)) && (nodeMap.get(node)?.incident?.length || 0) === 1);
    const start = terminals.find((node) => (adjacency.get(node) || []).some((edge) => !visitedEdges.has(edge))) || seed;
    const queue = [{ node: start, station: 0 }];
    const nodeStation = new Map([[start, 0]]);
    while (queue.length) {
      const current = queue.shift();
      componentNodes.add(current.node);
      for (const edge of adjacency.get(current.node) || []) {
        if (visitedEdges.has(edge.elementId)) continue;
        visitedEdges.add(edge.elementId);
        const other = edge.canonicalFrom === current.node ? edge.canonicalTo : edge.canonicalFrom;
        const stationStart = current.station;
        const stationEnd = current.station + edge.lengthMm;
        edge.componentId = componentId;
        edge.stationStartMm = stationStart;
        edge.stationEndMm = stationEnd;
        edge.stationMidMm = (stationStart + stationEnd) / 2;
        componentEdges.push(edge);
        if (!nodeStation.has(other) || stationEnd < nodeStation.get(other)) {
          nodeStation.set(other, stationEnd);
          queue.push({ node: other, station: stationEnd });
        }
      }
    }
    for (const node of nodeStation.keys()) componentNodes.add(node);
    const componentLengthMm = Math.max(0, ...componentEdges.map((edge) => Math.max(edge.stationStartMm || 0, edge.stationEndMm || 0)));
    for (const edge of componentEdges) edge.componentLengthMm = componentLengthMm;
    componentRows.push({ componentId, nodeCount: componentNodes.size, elementCount: componentEdges.length, componentLengthMm: Number(componentLengthMm.toFixed(3)), startNode: start });
  }
  return componentRows;
}
export function normalizeInputXmlElementGraph(graph, options = {}) {
  const toleranceMm = Number(options.shortElementToleranceMm || options.lengthToleranceMm || DEFAULT_CONSUME_TOL_MM);
  const rawEdges = (graph.edges || []).map((edge) => ({ ...edge, lengthMm: Number(edge.lengthMm ?? edgeLength(edge)), consumeToleranceMm: toleranceMm }));
  const nodeIds = unique(rawEdges.flatMap((edge) => [edge.from, edge.to]));
  const dsu = createDsu(nodeIds);
  const nodeEdges = buildRawNodeEdges(rawEdges);
  const consumedRows = [];
  const consumedIds = new Set();
  for (const edge of rawEdges) {
    if (!(edge.lengthMm <= toleranceMm) && edge.from !== edge.to) continue;
    const choice = chooseShortEdgeRetainedNode(edge, nodeEdges);
    const retainedNode = dsu.mergeInto(choice.retained, choice.dropped);
    consumedIds.add(edge.elementId);
    consumedRows.push({
      index: edge.index,
      referenceElement: edge.elementId,
      fromTo: `${edge.from}->${edge.to}`,
      retainedNode,
      droppedNode: choice.dropped,
      lengthMm: Number(edge.lengthMm.toFixed(3)),
      toleranceMm,
      packetEvidence: packetEvidence(edge),
      action: 'CONSUMED_SHORT_OR_ZERO_LENGTH_ELEMENT_INTO_CANONICAL_ELEMENT_CONTEXT',
    });
  }
  let canonicalEdges = rawEdges.filter((edge) => !consumedIds.has(edge.elementId)).map((edge) => cloneCanonicalEdge(edge, dsu)).filter((edge) => edge.canonicalFrom !== edge.canonicalTo);
  const orphanPackets = attachConsumedPackets(canonicalEdges, consumedRows);
  const nodeMap = rebuildNodeContexts(canonicalEdges);
  for (const edge of canonicalEdges) {
    edge.fromContext = nodeContext(nodeMap.get(edge.canonicalFrom), toleranceMm);
    edge.toContext = nodeContext(nodeMap.get(edge.canonicalTo), toleranceMm);
    edge.anchorFlags = classifyAnchor(edge, nodeMap);
    edge.isAnchorElement = edge.anchorFlags.length > 0;
  }
  const componentRows = assignComponentsAndStations(canonicalEdges, nodeMap);
  const anchorRows = canonicalEdges.filter((edge) => edge.isAnchorElement).map((edge) => ({
    element: edge.elementId,
    canonicalFromTo: edge.normalizedFromTo,
    lengthMm: Number(edge.lengthMm.toFixed(3)),
    anchorFlags: edge.anchorFlags.join(';'),
    packetEvidence: (edge.packetEvidence || []).join(';'),
  }));
  return {
    ...graph,
    rawEdges,
    edges: canonicalEdges,
    canonicalEdges,
    nodeMap,
    nodes: [...nodeMap.values()],
    normalization: {
      toleranceMm,
      rawElementCount: rawEdges.length,
      canonicalElementCount: canonicalEdges.length,
      consumedElementCount: consumedRows.length,
      consumedRows,
      orphanPackets,
      componentRows,
      anchorRows,
      rule: 'consume short/zero InputXML elements <= tolerance before element-wise compare; attach consumed property packets to adjacent canonical element; retain target geometry during transfer',
    },
    summary: { ...(graph.summary || {}), rawElementCount: rawEdges.length, elementCount: canonicalEdges.length, consumedElementCount: consumedRows.length, anchorElementCount: anchorRows.length },
  };
}
