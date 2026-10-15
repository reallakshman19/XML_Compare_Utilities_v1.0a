/** Source-order evidence carried from parsed records into canonical objects. */

export const SOURCE_ELEMENT_ORIENTATION_CONTRACT = 'SourceElementOrientation.v1';

export function captureSourceRecord(record) {
  return {
    fromNode: record.fromNode,
    toNode: record.toNode,
    deltaMm: [...record.deltaMm],
    rawIndex: record.index,
  };
}

export function buildSourceOrientation(record, canonicalForward) {
  const source = record.sourceRecord;
  return {
    contract: SOURCE_ELEMENT_ORIENTATION_CONTRACT,
    fromNode: source.fromNode,
    toNode: source.toNode,
    resolvedFromNode: record.fromNode,
    resolvedToNode: record.toNode,
    deltaMm: [...source.deltaMm],
    rawIndex: source.rawIndex,
    canonicalDirection: canonicalForward ? 'SOURCE_FORWARD' : 'SOURCE_REVERSED',
  };
}

function invalid(code, message) {
  return { ok: false, code, message };
}

export function resolveSourceOrientation(object) {
  const orientation = object?.sourceOrientation;
  if (!orientation) {
    return invalid('BEND_SOURCE_ORIENTATION_MISSING', 'Canonical source orientation is required for bend reconstruction.');
  }
  if (orientation.contract !== SOURCE_ELEMENT_ORIENTATION_CONTRACT) {
    return invalid('BEND_SOURCE_ORIENTATION_VERSION', 'Canonical source orientation has an unsupported contract version.');
  }
  const fromNode = String(orientation.resolvedFromNode ?? '').trim();
  const toNode = String(orientation.resolvedToNode ?? '').trim();
  if (!fromNode || !toNode || fromNode === toNode) {
    return invalid('BEND_SOURCE_ORIENTATION_INVALID', 'Canonical source orientation requires distinct resolved FROM/TO nodes.');
  }
  const endpoints = new Set([object.fromNode, object.toNode]);
  if (endpoints.size !== 2 || !endpoints.has(fromNode) || !endpoints.has(toNode)) {
    return invalid('BEND_SOURCE_ORIENTATION_CONFLICT', 'Canonical source orientation conflicts with the object endpoints.');
  }
  const rawIndex = Number(orientation.rawIndex);
  return {
    ok: true,
    fromNode,
    toNode,
    rawIndex: Number.isInteger(rawIndex) ? rawIndex : null,
    evidence: 'SOURCE_ORIENTATION_V1',
  };
}
