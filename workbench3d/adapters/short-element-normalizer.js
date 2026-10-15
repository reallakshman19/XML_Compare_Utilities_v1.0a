/** Short-element normalization with packet provenance preservation. */

import { buildConsumedPacketAncestry } from './source-packet-ancestry.js';

function isExpectedShort(record) {
  return /VALVE|FLANGE|GASK|INST|WELD|REDUCER/i.test(record.componentType || '');
}

function nodeDegree(records) {
  const degree = new Map();
  for (const record of records) {
    degree.set(record.fromNode, (degree.get(record.fromNode) ?? 0) + 1);
    degree.set(record.toNode, (degree.get(record.toNode) ?? 0) + 1);
  }
  return degree;
}

function aliasResolver(nodeAlias) {
  return (node) => {
    let current = node;
    while (nodeAlias.has(current)) current = nodeAlias.get(current);
    return current;
  };
}

function consumedRow(record, retained, dropped, toleranceMm) {
  return {
    elementName: record.name || `#${record.index}`,
    fromTo: `${record.fromNode}->${record.toNode}`,
    retainedNode: retained,
    droppedNode: dropped,
    lengthMm: Number(record.lengthMm.toFixed(3)),
    toleranceMm,
    packetEvidence: record.packets.map((packet) => packet.kind).join('+') || '',
    action: 'CONSUMED',
  };
}

function hostCandidates(records, nodeId, lineId) {
  return records.filter((record) => (record.fromNode === nodeId || record.toNode === nodeId)
    && (!lineId || !record.lineId || record.lineId === lineId));
}

function packetHost(records, nodeId, source, packet) {
  const candidates = hostCandidates(records, nodeId, source.lineId);
  if (packet.kind === 'BEND') {
    const previous = candidates.filter((record) => record.index < source.index)
      .sort((a, b) => b.index - a.index)[0];
    if (previous) return previous;
  }
  return candidates[0] ?? records[0] ?? null;
}

function attachOrphanPackets(surviving, orphans, resolve) {
  for (const orphan of orphans) {
    const nearNode = resolve(orphan.retainedNode);
    for (const packet of orphan.record.packets) {
      const host = packetHost(surviving, nearNode, orphan.record, packet);
      if (!host) continue;
      host.packets.push({
        ...packet,
        consumedFrom: orphan.record.name || `#${orphan.record.index}`,
        sourceAncestry: buildConsumedPacketAncestry(
          orphan.record, resolve, orphan.retainedNode, orphan.droppedNode,
        ),
      });
    }
  }
}

export function consumeShortElements(records, toleranceMm) {
  const degree = nodeDegree(records);
  const nodeAlias = new Map();
  const resolve = aliasResolver(nodeAlias);
  const consumedRows = [];
  const surviving = [];
  const orphans = [];
  for (const record of records) {
    const isShort = record.lengthMm <= toleranceMm && !isExpectedShort(record);
    if (!isShort || !record.fromNode || !record.toNode || record.fromNode === record.toNode) {
      surviving.push(record);
      continue;
    }
    const fromDegree = degree.get(record.fromNode) ?? 0;
    const toDegree = degree.get(record.toNode) ?? 0;
    const retained = resolve(toDegree > fromDegree ? record.toNode : record.fromNode);
    const dropped = resolve(toDegree > fromDegree ? record.fromNode : record.toNode);
    if (retained !== dropped) nodeAlias.set(dropped, retained);
    consumedRows.push(consumedRow(record, retained, dropped, toleranceMm));
    if (record.packets.length) orphans.push({ record, retainedNode: retained, droppedNode: dropped });
  }
  for (const record of surviving) {
    record.fromNode = resolve(record.fromNode);
    record.toNode = resolve(record.toNode);
  }
  attachOrphanPackets(surviving, orphans, resolve);
  return { surviving, consumedRows };
}
