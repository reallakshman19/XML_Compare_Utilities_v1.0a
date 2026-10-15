/**
 * nodeset-adapter.js — NodeSet XML (nodeset/v1) → CanonicalObjectGraph.v1.
 *
 * Node-set models are point clouds: one zero-length object per <Node>, with
 * supports as SUPPORT packets and Props/bore/tag as properties. Deliberately
 * bypasses canonical-graph-builder (its short-element consume would eat
 * zero-length objects). Existing contracts/viewer/compare plumbing consume
 * the result unchanged; graphKind:'nodeset' routes to the node compare engine.
 */

import { parseXml } from '../core/simple-xml.js';
import { CONTRACT_VERSIONS } from '../contracts/contracts.js';

export function isNodeSetXml(xmlText) {
  return /<NodeSet\b[^>]*schema\s*=\s*["']nodeset\/v1["']/i.test(String(xmlText ?? ''));
}

export function parseNodeSetRecords(xmlText) {
  const warnings = [];
  const { documentElement } = parseXml(xmlText);
  if (documentElement.name.toUpperCase() !== 'NODESET') warnings.push('Root element is not <NodeSet>.');
  const records = documentElement.descendantsNamed('Node').map((el, index) => {
    const props = {};
    for (const prop of el.childrenNamed('Prop')) {
      const name = String(prop.getAttribute('name') ?? '').trim();
      if (name) props[name.toUpperCase()] = String(prop.getAttribute('value') ?? '').trim();
    }
    const supports = el.childrenNamed('Support').map((s) => ({
      kind: String(s.getAttribute('kind') ?? 'SUPPORT').trim().toUpperCase(),
      detail: String(s.getAttribute('detail') ?? '').trim(),
    }));
    return {
      index,
      id: String(el.getAttribute('id') ?? `N${index + 1}`).trim(),
      e: Number(el.getAttribute('e')),
      n: Number(el.getAttribute('n')),
      u: Number(el.getAttribute('u')),
      bore: el.getAttribute('bore') !== null ? Number(el.getAttribute('bore')) : null,
      tag: String(el.getAttribute('tag') ?? '').trim(),
      props,
      supports,
    };
  });
  const badCoords = records.filter((r) => ![r.e, r.n, r.u].every(Number.isFinite));
  if (badCoords.length) warnings.push(`${badCoords.length} node(s) have non-numeric coordinates.`);
  if (!records.length) warnings.push('No <Node> elements found.');
  return { records, warnings, name: String(documentElement.getAttribute('name') ?? '').trim() };
}

export function buildNodeSetGraph(modelId, xmlText) {
  const { records, warnings } = parseNodeSetRecords(xmlText);
  const objects = [];
  const nodes = [];
  records.forEach((record, index) => {
    if (![record.e, record.n, record.u].every(Number.isFinite)) return;
    const objectId = `${modelId}:N${index + 1}`;
    const properties = { ...record.props };
    if (record.bore !== null && Number.isFinite(record.bore)) properties.BORE = String(record.bore);
    if (record.tag) properties.TAG = record.tag;
    objects.push({
      objectId,
      kind: 'NODE',
      fromNode: record.id,
      toNode: record.id,
      canonicalFromTo: record.id,
      lengthMm: 0,
      diameterMm: Number.isFinite(record.bore) ? record.bore : null,
      wallThickMm: null,
      name: record.id,
      lineId: '',
      pathId: `${modelId}:P${index + 1}`,
      pathSequence: 0,
      stationMm: 0,
      packets: record.supports.map((s) => ({ kind: 'SUPPORT', attrs: { KIND: s.kind, DETAIL: s.detail, NODE: record.id } })),
      properties,
      blocks: null,
      rawIndex: record.index,
    });
    nodes.push({
      nodeId: record.id,
      coordMm: [record.e, record.n, record.u],
      degree: 0,
      componentId: 'C1',
      anchorType: 'NODE',
    });
  });
  return {
    contract: CONTRACT_VERSIONS.CanonicalObjectGraph,
    graphKind: 'nodeset',
    modelId,
    unit: 'mm',
    rawElementCount: records.length,
    canonicalElementCount: objects.length,
    consumedRows: [],
    normalizationRule: 'nodeset/v1: one canonical object per Node; no consume',
    objects,
    nodes,
    anchors: [],
    paths: objects.map((o) => ({
      pathId: o.pathId,
      startNode: o.fromNode,
      endNode: o.toNode,
      startAnchorType: 'NODE',
      endAnchorType: 'NODE',
      elementIds: [o.objectId],
      elementCount: 1,
      totalLengthMm: 0,
      packetSequence: o.packets.map((p) => p.attrs.KIND ?? p.kind).join('>'),
    })),
    hierarchy: [{ lineId: '(nodes)', paths: objects.map((o) => ({ pathId: o.pathId, elementIds: [o.objectId] })) }],
    warnings,
  };
}
