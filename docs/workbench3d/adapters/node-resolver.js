/**
 * node-resolver.js — node-wise packet resolution (pure).
 *
 * Reads each property packet and resolves which model node it belongs to,
 * using the packet's own NODE/CNODE text first, then per-kind FROM/TO rules.
 * Feeds the node info panel (click a node sphere → see everything at it).
 */

/** Per packet kind: attribute/endpoint priority for node resolution. */
export const PACKET_NODE_RULES = Object.freeze({
  RESTRAINT: ['NODE', 'CNODE', 'FROM'],
  HANGER: ['NODE', 'FROM'],
  DISPLACEMENT: ['NODE', 'FROM'],
  FORCE: ['NODE', 'FROM'],
  SIF: ['NODE', 'TO'],
  FLANGE: ['NODE', 'FROM'],
  NOZZLE: ['NODE', 'FROM'],
  BEND: ['TO'],
  RIGID: ['FROM'],
  SUPPORT: ['NODE', 'FROM'],
  '*': ['FROM'],
});

function normalizeNodeText(value) {
  const num = Number(String(value ?? '').trim());
  if (Number.isFinite(num)) return String(Math.round(num));
  const text = String(value ?? '').trim();
  return text || '';
}

/**
 * Resolve a packet to a node id.
 * @returns { nodeId, resolvedBy: 'NODE'|'CNODE'|'FROM'|'TO'|'FALLBACK' }
 */
export function resolvePacketNode(packet, object, knownNodeIds = null) {
  const rules = PACKET_NODE_RULES[packet.kind] ?? PACKET_NODE_RULES['*'];
  for (const rule of rules) {
    let candidate = null;
    if (rule === 'NODE' || rule === 'CNODE') {
      const raw = packet.attrs?.[rule];
      if (raw === undefined || raw === null || String(raw).trim() === '') continue;
      candidate = normalizeNodeText(raw);
    } else if (rule === 'FROM') {
      candidate = object.fromNode;
    } else if (rule === 'TO') {
      candidate = object.toNode;
    }
    if (!candidate) continue;
    if (knownNodeIds && !knownNodeIds.has(candidate)) continue;
    return { nodeId: candidate, resolvedBy: rule };
  }
  return { nodeId: object.fromNode, resolvedBy: 'FALLBACK' };
}

/**
 * Build a node-wise index for a graph:
 * Map<nodeId, { nodeId, coordMm, degree, anchorType, componentId,
 *               connectedObjectIds, packets: [{kind, attrs, objectId, resolvedBy}] }>
 */
export function buildNodeInfoIndex(graph) {
  const index = new Map();
  for (const node of graph.nodes) {
    index.set(node.nodeId, {
      nodeId: node.nodeId,
      coordMm: node.coordMm,
      degree: node.degree,
      anchorType: node.anchorType,
      componentId: node.componentId,
      connectedObjectIds: [],
      packets: [],
    });
  }
  const knownNodeIds = new Set(index.keys());
  for (const object of graph.objects) {
    for (const nodeId of new Set([object.fromNode, object.toNode])) {
      index.get(nodeId)?.connectedObjectIds.push(object.objectId);
    }
    for (const packet of object.packets) {
      const resolved = resolvePacketNode(packet, object, knownNodeIds);
      const entry = index.get(resolved.nodeId);
      if (entry) entry.packets.push({ kind: packet.kind, attrs: packet.attrs, objectId: object.objectId, resolvedBy: resolved.resolvedBy });
    }
  }
  return index;
}
