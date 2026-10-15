/** Packet-marker placement with consumed bend ancestry authority. */

import { resolveConsumedPacketAncestry } from './source-packet-ancestry.js';

function normalizeNodeText(value) {
  const num = Number(String(value ?? '').trim());
  if (Number.isFinite(num)) return String(Math.round(num));
  return String(value ?? '').trim();
}

function midpoint(start, end) {
  if (start && end) return start.map((value, axis) => (value + end[axis]) / 2);
  return start ?? end ?? [0, 0, 0];
}

export function resolvePacketPosition(packet, object, nodeCoord, placement = 'mid') {
  const start = nodeCoord.get(object.fromNode);
  const end = nodeCoord.get(object.toNode);
  const mid = midpoint(start, end);
  if (placement === 'from' && start) return { position: [...start], resolvedNodeId: object.fromNode, fallback: false };
  if (placement === 'to' && end) return { position: [...end], resolvedNodeId: object.toNode, fallback: false };
  if (placement !== 'text') return { position: mid, resolvedNodeId: null, fallback: false };
  const nodeText = packet.attrs?.NODE ?? packet.attrs?.CNODE ?? null;
  if (nodeText === null || nodeText === undefined || String(nodeText).trim() === '') {
    return { position: mid, resolvedNodeId: null, fallback: true };
  }
  const nodeId = normalizeNodeText(nodeText);
  const coord = nodeCoord.get(nodeId);
  if (coord) return { position: [...coord], resolvedNodeId: nodeId, fallback: false };
  return { position: mid, resolvedNodeId: nodeId, fallback: true };
}

function consumedBendPlacement(packet, object, nodeCoord, placement) {
  const ancestry = resolveConsumedPacketAncestry(packet);
  const generic = resolvePacketPosition(packet, object, nodeCoord, placement);
  if (!ancestry.ok) {
    return { ...generic, fallback: true, placementEvidence: ancestry.code };
  }
  const corner = nodeCoord.get(ancestry.cornerNode);
  if (!corner) {
    return {
      ...generic,
      resolvedNodeId: ancestry.cornerNode,
      fallback: true,
      placementEvidence: 'BEND_PACKET_CORNER_MISSING',
    };
  }
  return {
    position: [...corner],
    resolvedNodeId: ancestry.cornerNode,
    fallback: false,
    placementEvidence: ancestry.evidence,
  };
}

export function resolvePacketMarkerPlacement(packet, object, nodeCoord, placement = 'mid') {
  const consumedBend = packet?.kind === 'BEND' && (packet.sourceAncestry || packet.consumedFrom);
  if (consumedBend) return consumedBendPlacement(packet, object, nodeCoord, placement);
  return { ...resolvePacketPosition(packet, object, nodeCoord, placement), placementEvidence: 'MARKER_POLICY' };
}
