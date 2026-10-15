/** Source-element evidence retained when a packet moves during normalization. */

export const SOURCE_PACKET_ANCESTRY_CONTRACT = 'SourcePacketAncestry.v1';
const CONSUMED_ATTACHMENT = 'CONSUMED_SHORT_ELEMENT';

function text(value) { return String(value ?? '').trim(); }
function invalid(code, message) { return { ok: false, code, message }; }

export function buildConsumedPacketAncestry(record, resolved, retainedNode, droppedNode) {
  const source = record.sourceRecord ?? record;
  return {
    contract: SOURCE_PACKET_ANCESTRY_CONTRACT,
    attachment: CONSUMED_ATTACHMENT,
    sourceElement: {
      fromNode: source.fromNode,
      toNode: source.toNode,
      deltaMm: [...source.deltaMm],
      rawIndex: source.rawIndex ?? record.index,
      name: record.name ?? '',
      lineId: record.lineId ?? '',
    },
    resolvedFromNode: resolved(source.fromNode),
    resolvedToNode: resolved(source.toNode),
    retainedNode: resolved(retainedNode),
    droppedNode,
  };
}

export function resolveConsumedPacketAncestry(packet) {
  const ancestry = packet?.sourceAncestry;
  if (!ancestry) {
    return invalid('BEND_PACKET_ANCESTRY_MISSING', 'Consumed bend packet requires source-element ancestry.');
  }
  if (ancestry.contract !== SOURCE_PACKET_ANCESTRY_CONTRACT) {
    return invalid('BEND_PACKET_ANCESTRY_VERSION', 'Consumed bend packet ancestry has an unsupported contract version.');
  }
  if (ancestry.attachment !== CONSUMED_ATTACHMENT) {
    return invalid('BEND_PACKET_ANCESTRY_INVALID', 'Consumed bend packet ancestry has an invalid attachment type.');
  }
  const source = ancestry.sourceElement ?? {};
  const sourceFromNode = text(source.fromNode);
  const sourceToNode = text(source.toNode);
  const cornerNode = text(ancestry.resolvedToNode);
  const retainedNode = text(ancestry.retainedNode);
  const rawIndex = Number(source.rawIndex);
  if (!sourceFromNode || !sourceToNode || sourceFromNode === sourceToNode) {
    return invalid('BEND_PACKET_ANCESTRY_INVALID', 'Consumed bend source element requires distinct FROM/TO nodes.');
  }
  if (!cornerNode || cornerNode !== retainedNode || !Number.isInteger(rawIndex)) {
    return invalid('BEND_PACKET_ANCESTRY_INVALID', 'Consumed bend ancestry requires a resolved corner and integer source index.');
  }
  return {
    ok: true,
    cornerNode,
    rawIndex,
    lineId: text(source.lineId),
    sourceFromNode,
    sourceToNode,
    evidence: 'CONSUMED_PACKET_ANCESTRY_V1',
  };
}
