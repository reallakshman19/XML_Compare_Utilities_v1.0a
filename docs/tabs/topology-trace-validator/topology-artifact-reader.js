/**
 * Functionality: normalizes canonical topology, trace-ledger, and InputXML
 * artifacts into immutable read models. Inputs are parsed JSON or XML text.
 * Outputs preserve producer IDs and references. Fallback: absent IDs are kept
 * empty and receive view-only path keys so validation can report them.
 */

import {
  asArray,
  cleanText,
  cloneJson,
  deepFreeze,
  finiteNumber,
  objectRecord,
  strictPoint,
  uniqueText,
} from './topology-validator-values.js';

/** @param {Record<string, unknown>} record @param {string[]} names @returns {string[]} */
function textList(record, names) {
  const values = names.flatMap((name) => asArray(record[name]));
  return uniqueText(values.length ? values : names.map((name) => record[name]));
}

/** @param {Record<string, unknown>} record @param {string[]} names @returns {boolean} */
function hasField(record, names) {
  return names.some((name) => Object.hasOwn(record, name));
}

/** @param {Record<string, unknown>} record @param {string} kind @param {number} index @returns {Readonly<Record<string, unknown>>} */
function canonicalObject(record, kind, index) {
  const id = cleanText(record.id ?? record[`${kind}Id`] ?? record.canonicalId);
  return deepFreeze({
    ...cloneJson(record),
    viewKey: `canonical:${kind}:${id || index}`,
    id,
    position: strictPoint(record.position ?? record.pos ?? record.POS),
    sourceEntityIds: textList(record, ['sourceEntityIds', 'sourceIds', 'sourceAncestry']),
    sourcePortIds: textList(record, ['sourcePortIds', 'portAncestry']),
    sourceTypes: textList(record, ['sourceTypes', 'sourceType', 'componentTypes', 'componentType']),
    inputXmlElementIds: textList(record, ['inputXmlElementIds', 'projectionElementIds']),
    inputXmlNodeIds: textList(record, ['inputXmlNodeIds', 'projectionNodeIds']),
  });
}

/** @param {unknown} input @returns {Readonly<Record<string, unknown>>} */
export function readCanonicalTopology(input) {
  const raw = objectRecord(cloneJson(input));
  const collections = {
    nodes: asArray(raw.nodes ?? raw.canonicalNodes),
    edges: asArray(raw.edges ?? raw.canonicalEdges),
    pointFeatures: asArray(raw.pointFeatures ?? raw.features),
    junctions: asArray(raw.junctions),
    boundaries: asArray(raw.boundaries ?? raw.externalBoundaries),
  };
  const normalized = Object.fromEntries(Object.entries(collections).map(([kind, rows]) => [
    kind,
    Object.freeze(rows.map((row, index) => canonicalObject(objectRecord(row), kind.replace(/s$/, ''), index))),
  ]));
  const edges = asArray(normalized.edges).map((edge) => deepFreeze({
    ...objectRecord(edge),
    fromNodeId: cleanText(objectRecord(edge).fromNodeId ?? objectRecord(edge).from ?? objectRecord(edge).FROM_NODE),
    toNodeId: cleanText(objectRecord(edge).toNodeId ?? objectRecord(edge).to ?? objectRecord(edge).TO_NODE),
  }));
  return deepFreeze({
    schema: cleanText(raw.schema) || 'CanonicalTopology.unversioned',
    nodes: normalized.nodes,
    edges: Object.freeze(edges),
    pointFeatures: normalized.pointFeatures,
    junctions: normalized.junctions,
    boundaries: normalized.boundaries,
    raw: deepFreeze(raw),
  });
}

/** @param {Record<string, unknown>} record @param {number} index @returns {Readonly<Record<string, unknown>>} */
function ledgerRecord(record, index) {
  const canonical = objectRecord(record.canonical);
  const projection = objectRecord(record.projection ?? record.inputXml);
  const source = objectRecord(record.source);
  return deepFreeze({
    ...cloneJson(record),
    viewKey: `ledger:${cleanText(record.id ?? record.recordId) || index}`,
    recordId: cleanText(record.id ?? record.recordId),
    sourceEntityId: cleanText(record.sourceEntityId ?? source.sourceEntityId ?? source.id),
    sourcePath: cleanText(record.sourcePath ?? source.sourcePath ?? source.path),
    sourceType: cleanText(record.sourceType ?? source.sourceType ?? source.type).toUpperCase(),
    sourceRef: cleanText(record.sourceRef ?? source.sourceRef ?? source.ref),
    disposition: cleanText(record.primaryDisposition ?? record.disposition ?? record.finalDisposition).toUpperCase(),
    primaryDisposition: cleanText(record.primaryDisposition ?? record.disposition ?? record.finalDisposition).toUpperCase(),
    operation: cleanText(record.operation ?? record.projectionOperation),
    status: cleanText(record.status).toUpperCase(),
    projectionCardinality: cleanText(record.projectionCardinality).toUpperCase(),
    classification: cleanText(record.lossClassification ?? record.classification ?? record.lossDeferredClassification),
    lossClassification: cleanText(record.lossClassification ?? record.classification ?? record.lossDeferredClassification),
    deferredProperties: Object.freeze(textList(record, ['deferredProperties'])),
    affectedSourceEntityIds: textList(record, ['affectedSourceEntityIds']),
    canonicalNodeIds: uniqueText([...textList(record, ['canonicalNodeIds', 'nodeIds']), ...textList(canonical, ['nodeIds', 'canonicalNodeIds'])]),
    canonicalEdgeIds: uniqueText([...textList(record, ['canonicalEdgeIds', 'edgeIds']), ...textList(canonical, ['edgeIds', 'canonicalEdgeIds'])]),
    pointFeatureIds: uniqueText([...textList(record, ['pointFeatureIds']), ...textList(canonical, ['pointFeatureIds'])]),
    junctionIds: uniqueText([...textList(record, ['junctionIds']), ...textList(canonical, ['junctionIds'])]),
    boundaryIds: uniqueText([...textList(record, ['boundaryIds']), ...textList(canonical, ['boundaryIds'])]),
    affectedEdgeIds: uniqueText([...textList(record, ['affectedEdgeIds']), ...textList(canonical, ['affectedEdgeIds'])]),
    branchEdgeIds: uniqueText([...textList(record, ['branchEdgeIds']), ...textList(canonical, ['branchEdgeIds'])]),
    inputXmlElementIds: uniqueText([...textList(record, ['inputXmlElementIds']), ...textList(projection, ['elementIds', 'inputXmlElementIds'])]),
    inputXmlChildIds: uniqueText([...textList(record, ['inputXmlChildIds']), ...textList(projection, ['childIds', 'inputXmlChildIds'])]),
    inputXmlFromNode: cleanText(record.inputXmlFromNode ?? projection.fromNode ?? projection.FROM_NODE),
    inputXmlToNode: cleanText(record.inputXmlToNode ?? projection.toNode ?? projection.TO_NODE),
    evidence: deepFreeze(cloneJson(record.evidence ?? {})),
    declaredFields: deepFreeze({
      sourceEntityId: hasField(record, ['sourceEntityId']) || hasField(source, ['sourceEntityId', 'id']),
      sourcePath: hasField(record, ['sourcePath']) || hasField(source, ['sourcePath', 'path']),
      sourceType: hasField(record, ['sourceType']) || hasField(source, ['sourceType', 'type']),
      sourceRef: hasField(record, ['sourceRef']) || hasField(source, ['sourceRef', 'ref']),
      primaryDisposition: hasField(record, ['primaryDisposition']),
      canonicalNodeIds: hasField(record, ['canonicalNodeIds', 'nodeIds']) || hasField(canonical, ['nodeIds', 'canonicalNodeIds']),
      canonicalEdgeIds: hasField(record, ['canonicalEdgeIds', 'edgeIds']) || hasField(canonical, ['edgeIds', 'canonicalEdgeIds']),
      pointFeatureIds: hasField(record, ['pointFeatureIds']) || hasField(canonical, ['pointFeatureIds']),
      junctionIds: hasField(record, ['junctionIds']) || hasField(canonical, ['junctionIds']),
      affectedSourceEntityIds: hasField(record, ['affectedSourceEntityIds']),
      inputXmlElementIds: hasField(record, ['inputXmlElementIds']) || hasField(projection, ['elementIds', 'inputXmlElementIds']),
      projectionCardinality: hasField(record, ['projectionCardinality']),
      deferredProperties: hasField(record, ['deferredProperties']),
      lossClassification: hasField(record, ['lossClassification']),
      status: hasField(record, ['status']),
    }),
  });
}

/** @param {Record<string, unknown>} record @param {number} index @returns {Readonly<Record<string, unknown>>} */
function ledgerSourcePort(record, index) {
  return deepFreeze({
    ...cloneJson(record),
    viewKey: `ledger:source-port:${cleanText(record.sourcePortId) || index}`,
    sourcePortId: cleanText(record.sourcePortId ?? record.id),
    sourceEntityId: cleanText(record.sourceEntityId),
    sourcePath: cleanText(record.sourcePath ?? record.path),
    role: cleanText(record.role).toUpperCase(),
    field: cleanText(record.field).toUpperCase(),
    sourceType: cleanText(record.sourceType).toUpperCase(),
  });
}

/** @param {unknown} input @returns {Readonly<Record<string, unknown>>} */
export function readTopologyTraceLedger(input) {
  const raw = objectRecord(cloneJson(input));
  const rows = asArray(raw.records ?? raw.entries ?? raw.ledger);
  if (!rows.length) throw new TypeError('Trace ledger JSON must contain a non-empty records array.');
  const sourcePorts = asArray(raw.sourcePorts).map((row, index) => ledgerSourcePort(objectRecord(row), index));
  return deepFreeze({
    schema: cleanText(raw.schema) || 'TopologyTraceLedger.unversioned',
    records: Object.freeze(rows.map((row, index) => ledgerRecord(objectRecord(row), index))),
    sourceIdentity: deepFreeze(cloneJson(raw.sourceIdentity ?? {})),
    sourcePorts: Object.freeze(sourcePorts),
    raw: deepFreeze(raw),
  });
}

/** @param {string} source @returns {Record<string, string>} */
function parseAttributes(source) {
  const attributes = {};
  source.replace(/([A-Za-z_][\w:.-]*)\s*=\s*(["'])(.*?)\2/g, (_match, name, _quote, value) => {
    attributes[name.toUpperCase()] = value;
    return '';
  });
  return attributes;
}

/** Normalize native fixed-decimal node numbers for graph comparison. */
function normalizeNodeId(value) {
  const number = finiteNumber(value);
  if (number === null) return cleanText(value);
  return Math.abs(number - Math.round(number)) < 1e-9 ? String(Math.round(number)) : String(number);
}

/** @param {string} body @param {string} parentKey @returns {ReadonlyArray<Record<string, unknown>>} */
function parseChildren(body, parentKey) {
  const counts = new Map();
  const rows = [];
  const pattern = /<([A-Za-z_][\w:.-]*)\b([^>]*)>/g;
  for (const match of body.matchAll(pattern)) {
    const tag = cleanText(match[1]).toUpperCase();
    if (!tag || tag === 'PIPINGELEMENT') continue;
    const count = (counts.get(tag) ?? 0) + 1;
    counts.set(tag, count);
    const attributes = parseAttributes(match[2] ?? '');
    const id = cleanText(attributes.ID ?? attributes.ELEMENT_ID ?? attributes.NAME);
    rows.push(deepFreeze({ viewKey: `${parentKey}/${tag}[${count}]`, id, tag, attributes: deepFreeze(attributes) }));
  }
  return Object.freeze(rows);
}

/** @param {string} xmlText @returns {Readonly<Record<string, unknown>>} */
export function readTopologyInputXml(xmlText) {
  const xml = String(xmlText ?? '');
  if (!/<CAESARII\b/i.test(xml) || !/<PIPINGMODEL\b/i.test(xml)) {
    throw new TypeError('Topology InputXML must contain CAESARII and PIPINGMODEL elements.');
  }
  const elements = [];
  const paired = /<PIPINGELEMENT\b([^>]*)>([\s\S]*?)<\/PIPINGELEMENT>/gi;
  let match;
  while ((match = paired.exec(xml))) {
    const attributes = parseAttributes(match[1] ?? '');
    const id = cleanText(attributes.ID ?? attributes.ELEMENT_ID ?? attributes.NAME);
    const viewKey = `inputxml:PIPINGELEMENT[${elements.length + 1}]`;
    elements.push(deepFreeze({
      viewKey,
      id,
      fromNode: normalizeNodeId(attributes.FROM_NODE),
      toNode: normalizeNodeId(attributes.TO_NODE),
      delta: deepFreeze({
        x: finiteNumber(attributes.DELTA_X),
        y: finiteNumber(attributes.DELTA_Y),
        z: finiteNumber(attributes.DELTA_Z),
      }),
      sourceType: cleanText(attributes.SOURCE_TYPE ?? attributes.COMPONENT_TYPE ?? attributes.TYPE).toUpperCase(),
      attributes: deepFreeze(attributes),
      children: parseChildren(match[2] ?? '', id || viewKey),
    }));
  }
  if (!elements.length) throw new TypeError('Topology InputXML contains no paired PIPINGELEMENT records.');
  return deepFreeze({ schema: 'TopologyInputXmlReadModel.v1', elements: Object.freeze(elements), rawText: xml });
}
