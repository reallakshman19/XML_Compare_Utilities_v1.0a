/**
 * Functionality: independently validates lineage, referential integrity,
 * connectivity, and projection geometry. Inputs are immutable reader outputs
 * plus an explicit millimetre tolerance. Output is a frozen findings report.
 * Fallback: InputXML checks are NOT_EVALUATED when no InputXML is supplied.
 */
import { FINAL_DISPOSITIONS, asArray, cleanText, deepFreeze, objectRecord, uniqueText } from './topology-validator-values.js';
import { validateComponentLineage } from './topology-component-validator.js';
import { validateLedgerSemantics } from './topology-ledger-validator.js';
import { validateProjectionVectors } from './topology-projection-geometry.js';
/** @param {string} code @param {string} message @param {Record<string, unknown>} context @returns {Readonly<Record<string, unknown>>} */
function issue(code, message, context) {
  return deepFreeze({
    id: `ISSUE-${cleanText(context.sequence).padStart(5, '0')}`,
    severity: cleanText(context.severity) || 'ERROR',
    blocking: context.blocking !== false,
    code,
    message,
    sourcePath: cleanText(context.sourcePath),
    sourceEntityIds: uniqueText(asArray(context.sourceEntityIds)),
    canonicalIds: uniqueText(asArray(context.canonicalIds)),
    inputXmlElementIds: uniqueText(asArray(context.inputXmlElementIds)),
    details: deepFreeze(context.details ?? {}),
  });
}
/** @param {ReadonlyArray<Record<string, unknown>>} edges @param {string} fromKey @param {string} toKey @returns {Record<string, number>} */
function nodeDegrees(edges, fromKey, toKey) {
  const degrees = {};
  for (const edge of edges) {
    const from = cleanText(edge[fromKey]), to = cleanText(edge[toKey]);
    if (from) degrees[from] = (degrees[from] ?? 0) + 1;
    if (to) degrees[to] = (degrees[to] ?? 0) + 1;
  }
  return degrees;
}

/** @param {ReadonlyArray<Record<string, unknown>>} edges @param {string} fromKey @param {string} toKey @returns {number} */
function connectedComponentCount(edges, fromKey, toKey) {
  const adjacency = new Map();
  for (const edge of edges) {
    const from = cleanText(edge[fromKey]), to = cleanText(edge[toKey]);
    if (!from || !to) continue;
    if (!adjacency.has(from)) adjacency.set(from, new Set());
    if (!adjacency.has(to)) adjacency.set(to, new Set());
    adjacency.get(from).add(to);
    adjacency.get(to).add(from);
  }
  const visited = new Set();
  let count = 0;
  for (const node of adjacency.keys()) {
    if (visited.has(node)) continue;
    count += 1;
    const stack = [node];
    while (stack.length) {
      const current = stack.pop();
      if (!current || visited.has(current)) continue;
      visited.add(current);
      for (const next of adjacency.get(current) ?? []) stack.push(next);
    }
  }
  return count;
}

/** @param {Record<string, unknown>} source @param {Record<string, unknown>} ledger @param {Record<string, unknown>[]} findings @param {() => number} next @returns {Record<string, unknown>} */
function validateSource(source, ledger, findings, next) {
  const records = asArray(ledger.records).map(objectRecord);
  const entities = asArray(source.entities).map(objectRecord), idCounts = new Map();
  for (const conflict of asArray(source.identityConflicts).map(objectRecord)) findings.push(issue(
    'SOURCE_IDENTITY_CONFLICT',
    `Producer source identity conflict at ${cleanText(conflict.sourcePath) || '(unknown path)'}.`,
    { sequence: next(), sourcePath: cleanText(conflict.sourcePath), details: conflict },
  ));
  const manifestUsed = entities.some((entity) => cleanText(entity.identityOrigin) === 'TRACE_LEDGER_MANIFEST');
  const producerIdentity = objectRecord(source.producerIdentity);
  if (manifestUsed && (cleanText(producerIdentity.schema) !== 'SourceEnvelope.v1' || cleanText(producerIdentity.entityIdentitySchema) !== 'UniversalSourceGraph.v1')) findings.push(issue(
    'SOURCE_IDENTITY_SCHEMA_INVALID',
    'Ledger-bound source identity must declare SourceEnvelope.v1 and UniversalSourceGraph.v1.',
    { sequence: next(), details: producerIdentity },
  ));
  for (const entity of entities) {
    const id = cleanText(entity.sourceEntityId);
    if (id) idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
  }
  const sourceIds = new Set([...idCounts.keys()]);
  const sourcePaths = new Set(asArray(source.entities).map((row) => cleanText(objectRecord(row).sourcePath)).filter(Boolean));
  for (const [id, count] of idCounts) if (count > 1) findings.push(issue('SOURCE_IDENTITY_DUPLICATE', `sourceEntityId ${id} occurs ${count} times.`, { sequence: next(), sourceEntityIds: [id] }));
  const portCounts = new Map();
  for (const rawPort of asArray(source.ports)) {
    const port = objectRecord(rawPort), id = cleanText(port.sourcePortId);
    if (!id) findings.push(issue('SOURCE_PORT_ID_MISSING', `Source port ${port.viewKey} has no producer-owned sourcePortId.`, { sequence: next(), details: { viewKey: port.viewKey } }));
    else portCounts.set(id, (portCounts.get(id) ?? 0) + 1);
  }
  for (const [id, count] of portCounts) if (count > 1) findings.push(issue('SOURCE_PORT_ID_DUPLICATE', `sourcePortId ${id} occurs ${count} times.`, { sequence: next(), details: { sourcePortId: id } }));
  let accounted = 0;
  for (const rawEntity of entities) {
    const entity = objectRecord(rawEntity);
    const entityId = cleanText(entity.sourceEntityId), sourcePath = cleanText(entity.sourcePath);
    if (!entityId) findings.push(issue('SOURCE_IDENTITY_MISSING', `Source entity ${sourcePath} has no producer-owned sourceEntityId.`, { sequence: next(), sourcePath }));
    const matches = records.filter((record) => entityId
      ? cleanText(record.sourceEntityId) === entityId
      : cleanText(record.sourcePath) === sourcePath);
    if (matches.length !== 1) findings.push(issue('SOURCE_DISPOSITION_CARDINALITY', `Source entity ${sourcePath} has ${matches.length} final disposition records; expected exactly one.`, { sequence: next(), sourcePath, sourceEntityIds: [entityId] }));
    const valid = Boolean(entityId) && idCounts.get(entityId) === 1 && matches.length === 1 && FINAL_DISPOSITIONS.includes(cleanText(matches[0].disposition));
    if (valid) accounted += 1;
    if (matches.length === 1 && !FINAL_DISPOSITIONS.includes(cleanText(matches[0].disposition))) findings.push(issue('SOURCE_DISPOSITION_INVALID', `Ledger disposition ${matches[0].disposition || '(empty)'} is not allowed.`, { sequence: next(), sourcePath, sourceEntityIds: [entityId] }));
    if (cleanText(entity.type) === 'SUPPORT' && matches.length === 1 && !['DEFER_SUPPORT', 'EMIT_SUPPORT_ATTACHMENT'].includes(cleanText(matches[0].disposition))) findings.push(issue('SUPPORT_DISPOSITION_INVALID', `Support ${sourcePath} must be explicitly deferred or projected as an attachment.`, { sequence: next(), sourcePath, sourceEntityIds: [entityId] }));
  }
  for (const record of records) {
    const id = cleanText(record.sourceEntityId), path = cleanText(record.sourcePath);
    if (!id || !sourceIds.has(id)) findings.push(issue('LEDGER_SOURCE_REFERENCE_MISSING', `Ledger record ${record.recordId || record.viewKey} references an unknown sourceEntityId.`, { sequence: next(), sourcePath: path, sourceEntityIds: [id] }));
    if (path && !sourcePaths.has(path)) findings.push(issue('LEDGER_SOURCE_PATH_MISSING', `Ledger record ${record.recordId || record.viewKey} references unknown source path ${path}.`, { sequence: next(), sourcePath: path, sourceEntityIds: [id] }));
  }
  return { accounted, sourceIds, sourcePaths };
}

/** @param {Record<string, unknown>} source @param {Record<string, unknown>} canonical @param {Record<string, unknown>} ledger @param {Record<string, unknown>[]} findings @param {() => number} next @returns {Record<string, unknown>} */
function validateCanonical(source, canonical, ledger, findings, next) {
  const ports = new Set(asArray(source.ports).map(objectRecord).map((row) => cleanText(row.sourcePortId)).filter(Boolean));
  const sourceIds = new Set(asArray(source.entities).map((row) => cleanText(objectRecord(row).sourceEntityId)).filter(Boolean));
  const collections = ['nodes', 'edges', 'pointFeatures', 'junctions', 'boundaries'];
  const idSets = Object.fromEntries(collections.map((kind) => [kind, new Set(asArray(canonical[kind]).map((row) => cleanText(objectRecord(row).id)).filter(Boolean))]));
  const records = asArray(ledger.records).map(objectRecord);
  const ledgerRefs = {
    nodes: new Set(records.flatMap((row) => asArray(row.canonicalNodeIds)).map(cleanText)),
    edges: new Set(records.flatMap((row) => asArray(row.canonicalEdgeIds)).map(cleanText)),
    pointFeatures: new Set(records.flatMap((row) => asArray(row.pointFeatureIds)).map(cleanText)),
    junctions: new Set(records.flatMap((row) => asArray(row.junctionIds)).map(cleanText)),
    boundaries: new Set(records.flatMap((row) => asArray(row.boundaryIds)).map(cleanText)),
  };
  for (const kind of collections) {
    const seen = new Set();
    for (const rawObject of asArray(canonical[kind])) {
      const object = objectRecord(rawObject), id = cleanText(object.id);
      if (!id) findings.push(issue('CANONICAL_ID_MISSING', `Canonical ${kind} record has no ID.`, { sequence: next(), canonicalIds: [cleanText(object.viewKey)] }));
      if (id && seen.has(id)) findings.push(issue('CANONICAL_ID_DUPLICATE', `Canonical ${kind} ID ${id} is duplicated.`, { sequence: next(), canonicalIds: [id] }));
      if (id) seen.add(id);
      if (!ledgerRefs[kind].has(id)) findings.push(issue(`ORPHAN_CANONICAL_${kind === 'edges' ? 'EDGE' : kind === 'nodes' ? 'NODE' : 'OBJECT'}`, `Canonical ${kind} ${id || object.viewKey} is not referenced by the ledger.`, { sequence: next(), canonicalIds: [id] }));
    }
  }
  let nodeAncestry = 0, edgeAncestry = 0;
  for (const rawNode of asArray(canonical.nodes)) {
    const node = objectRecord(rawNode), ancestry = asArray(node.sourcePortIds).map(cleanText).filter(Boolean);
    if (ancestry.length && ancestry.every((id) => ports.has(id))) nodeAncestry += 1;
    else findings.push(issue('CANONICAL_NODE_ANCESTRY_MISSING', `Canonical node ${node.id || node.viewKey} lacks valid source-port ancestry.`, { sequence: next(), canonicalIds: [cleanText(node.id)], details: { sourcePortIds: ancestry } }));
  }
  for (const rawEdge of asArray(canonical.edges)) {
    const edge = objectRecord(rawEdge), ancestry = asArray(edge.sourceEntityIds).map(cleanText).filter(Boolean);
    if (ancestry.length && ancestry.every((id) => sourceIds.has(id))) edgeAncestry += 1;
    else findings.push(issue('CANONICAL_EDGE_ANCESTRY_MISSING', `Canonical edge ${edge.id || edge.viewKey} lacks valid source-component ancestry.`, { sequence: next(), canonicalIds: [cleanText(edge.id)], sourceEntityIds: ancestry }));
  }
  for (const kind of ['pointFeatures', 'junctions', 'boundaries']) {
    for (const rawObject of asArray(canonical[kind])) {
      const object = objectRecord(rawObject), ancestry = asArray(object.sourceEntityIds).map(cleanText).filter(Boolean);
      const code = kind === 'boundaries' ? 'BOUNDARY_ANCESTRY_MISSING' : kind === 'junctions' ? 'JUNCTION_ANCESTRY_MISSING' : 'POINT_FEATURE_ANCESTRY_MISSING';
      if (!ancestry.length || !ancestry.every((id) => sourceIds.has(id))) findings.push(issue(code, `Canonical ${kind} ${object.id || object.viewKey} lacks valid source ancestry.`, { sequence: next(), canonicalIds: [cleanText(object.id)], sourceEntityIds: ancestry }));
      if (kind === 'boundaries' && !cleanText(object.relationship ?? object.sourceRelationship)) findings.push(issue('BOUNDARY_RELATIONSHIP_MISSING', `Boundary ${object.id || object.viewKey} does not identify its source relationship.`, { sequence: next(), canonicalIds: [cleanText(object.id)], sourceEntityIds: ancestry }));
    }
  }
  const refFields = { nodes: 'canonicalNodeIds', edges: 'canonicalEdgeIds', pointFeatures: 'pointFeatureIds', junctions: 'junctionIds', boundaries: 'boundaryIds' };
  for (const record of records) for (const [kind, field] of Object.entries(refFields)) for (const id of asArray(record[field]).map(cleanText).filter(Boolean)) if (!idSets[kind].has(id)) findings.push(issue('LEDGER_CANONICAL_REFERENCE_MISSING', `Ledger record ${record.recordId || record.viewKey} references missing canonical ${kind} ${id}.`, { sequence: next(), sourcePath: cleanText(record.sourcePath), canonicalIds: [id] }));
  for (const record of records) for (const id of uniqueText([...asArray(record.affectedEdgeIds), ...asArray(record.branchEdgeIds)])) if (!idSets.edges.has(id)) findings.push(issue('LEDGER_CANONICAL_REFERENCE_MISSING', `Ledger record ${record.recordId || record.viewKey} references missing affected/branch edge ${id}.`, { sequence: next(), sourcePath: cleanText(record.sourcePath), canonicalIds: [id] }));
  for (const record of records) for (const id of asArray(record.affectedSourceEntityIds).map(cleanText).filter(Boolean)) if (!sourceIds.has(id)) findings.push(issue('LEDGER_AFFECTED_SOURCE_MISSING', `Ledger record ${record.recordId || record.viewKey} references missing affected source ${id}.`, { sequence: next(), sourcePath: cleanText(record.sourcePath), sourceEntityIds: [id] }));
  return { idSets, nodeAncestry, edgeAncestry };
}

/** @param {Record<string, unknown>} canonical @param {Record<string, unknown>[]} findings @param {() => number} next @returns {Record<string, unknown>} */
function validateCanonicalConnectivity(canonical, findings, next) {
  const nodes = asArray(canonical.nodes).map(objectRecord), edges = asArray(canonical.edges).map(objectRecord);
  const nodeIds = new Set(nodes.map((node) => cleanText(node.id)).filter(Boolean));
  const degrees = nodeDegrees(edges, 'fromNodeId', 'toNodeId');
  for (const edge of edges) {
    const from = cleanText(edge.fromNodeId), to = cleanText(edge.toNodeId), id = cleanText(edge.id);
    if (!nodeIds.has(from)) findings.push(issue('CANONICAL_FROM_NODE_MISSING', `Canonical edge ${id} FROM_NODE ${from} does not exist.`, { sequence: next(), canonicalIds: [id, from] }));
    if (!nodeIds.has(to)) findings.push(issue('CANONICAL_TO_NODE_MISSING', `Canonical edge ${id} TO_NODE ${to} does not exist.`, { sequence: next(), canonicalIds: [id, to] }));
    if (from && from === to && objectRecord(edge).selfEdgeJustification !== true) findings.push(issue('UNEXPLAINED_SELF_EDGE', `Canonical edge ${id} is an unexplained self-edge at ${from}.`, { sequence: next(), canonicalIds: [id, from] }));
  }
  for (const rawJunction of asArray(canonical.junctions)) {
    const junction = objectRecord(rawJunction), nodeId = cleanText(junction.nodeId), expected = Number(junction.expectedDegree ?? junction.degree);
    if (nodeId && Number.isFinite(expected) && (degrees[nodeId] ?? 0) !== expected) findings.push(issue('JUNCTION_DEGREE_MISMATCH', `Junction ${junction.id || junction.viewKey} expects degree ${expected}; canonical degree is ${degrees[nodeId] ?? 0}.`, { sequence: next(), canonicalIds: [cleanText(junction.id), nodeId] }));
  }
  return { degrees, componentCount: connectedComponentCount(edges, 'fromNodeId', 'toNodeId') };
}

/** @param {Record<string, unknown>} canonical @param {Record<string, unknown>} ledger @param {Record<string, unknown>|null} inputXml @param {number} toleranceMm @param {Record<string, unknown>[]} findings @param {() => number} next @returns {Record<string, unknown>} */
function validateProjection(canonical, ledger, inputXml, toleranceMm, findings, next) {
  if (!inputXml) return { status: 'NOT_EVALUATED', mapped: 0, orphan: 0, vectorMismatch: 0, connectivityMismatch: 0, ancestryPercent: 'NOT_EVALUATED' };
  const elements = asArray(inputXml.elements).map(objectRecord), records = asArray(ledger.records).map(objectRecord);
  const elementById = new Map(), elementIdCounts = new Map(), childIdsPresent = new Set();
  for (const element of elements) {
    const id = cleanText(element.id);
    if (id) { elementById.set(id, element); elementIdCounts.set(id, (elementIdCounts.get(id) ?? 0) + 1); }
    for (const child of asArray(element.children).map(objectRecord)) for (const key of [cleanText(child.id), cleanText(child.viewKey)].filter(Boolean)) childIdsPresent.add(key);
  }
  for (const [id, count] of elementIdCounts) if (count > 1) findings.push(issue('INPUTXML_ELEMENT_ID_DUPLICATE', `InputXML element ID ${id} occurs ${count} times.`, { sequence: next(), inputXmlElementIds: [id] }));
  const canonicalMappedIds = asArray(canonical.edges).flatMap((row) => asArray(objectRecord(row).inputXmlElementIds));
  const justifiedLedgerIds = records.filter((row) => cleanText(row.operation)).flatMap((row) => asArray(row.inputXmlElementIds));
  const mappedIds = new Set([...canonicalMappedIds, ...justifiedLedgerIds].map(cleanText).filter(Boolean));
  const childIds = new Set(records.flatMap((row) => asArray(row.inputXmlChildIds)).map(cleanText).filter(Boolean));
  const recordsByElement = new Map();
  for (const record of records) for (const id of asArray(record.inputXmlElementIds).map(cleanText).filter(Boolean)) recordsByElement.set(id, [...(recordsByElement.get(id) ?? []), record]);
  for (const record of records) {
    for (const id of asArray(record.inputXmlElementIds).map(cleanText).filter(Boolean)) if (!elementById.has(id)) findings.push(issue('LEDGER_INPUTXML_REFERENCE_MISSING', `Ledger record ${record.recordId || record.viewKey} references missing InputXML element ${id}.`, { sequence: next(), sourcePath: cleanText(record.sourcePath), inputXmlElementIds: [id] }));
    for (const id of asArray(record.inputXmlChildIds).map(cleanText).filter(Boolean)) if (!childIdsPresent.has(id)) findings.push(issue('LEDGER_INPUTXML_CHILD_REFERENCE_MISSING', `Ledger record ${record.recordId || record.viewKey} references missing InputXML child ${id}.`, { sequence: next(), sourcePath: cleanText(record.sourcePath), details: { childId: id } }));
  }
  let orphan = 0, connectivityMismatch = 0;
  for (const element of elements) {
    const id = cleanText(element.id);
    if (!id) findings.push(issue('INPUTXML_ELEMENT_ID_MISSING', `${element.viewKey} has no machine-verifiable element ID.`, { sequence: next(), inputXmlElementIds: [cleanText(element.viewKey)] }));
    if (!id || !mappedIds.has(id)) { orphan += 1; findings.push(issue('ORPHAN_INPUTXML_ELEMENT', `InputXML element ${id || element.viewKey} has no canonical or projection ancestry.`, { sequence: next(), inputXmlElementIds: [id] })); }
    if (!cleanText(element.fromNode)) findings.push(issue('INPUTXML_FROM_NODE_MISSING', `InputXML element ${id || element.viewKey} has no FROM_NODE.`, { sequence: next(), inputXmlElementIds: [id] }));
    if (!cleanText(element.toNode)) findings.push(issue('INPUTXML_TO_NODE_MISSING', `InputXML element ${id || element.viewKey} has no TO_NODE.`, { sequence: next(), inputXmlElementIds: [id] }));
    const selfEdgeExplained = asArray(recordsByElement.get(id)).map(objectRecord).some((record) => record.selfEdgeJustification === true || objectRecord(record.evidence).selfEdgeJustification === true);
    if (cleanText(element.fromNode) && cleanText(element.fromNode) === cleanText(element.toNode) && !selfEdgeExplained) findings.push(issue('INPUTXML_SELF_EDGE', `InputXML element ${id || element.viewKey} is an unexplained self-edge.`, { sequence: next(), inputXmlElementIds: [id] }));
    for (const child of asArray(element.children).map(objectRecord)) {
      if (!cleanText(child.id)) findings.push(issue('INPUTXML_CHILD_ID_MISSING', `InputXML child ${child.viewKey} has no stable child ID.`, { sequence: next(), inputXmlElementIds: [id] }));
      if (!childIds.has(cleanText(child.id)) && !childIds.has(cleanText(child.viewKey))) findings.push(issue('INPUTXML_CHILD_ANCESTRY_MISSING', `InputXML child ${child.id || child.viewKey} has no explicit ledger ancestry.`, { sequence: next(), inputXmlElementIds: [id], details: { childId: child.id || child.viewKey } }));
    }
  }
  const vectorMismatch = validateProjectionVectors({ canonical, records, elementById }, toleranceMm, (code, message, context) => findings.push(issue(code, message, { ...context, sequence: next() })));
  const inputDegrees = nodeDegrees(elements, 'fromNode', 'toNode');
  const canonicalDegrees = nodeDegrees(asArray(canonical.edges).map(objectRecord), 'fromNodeId', 'toNodeId');
  for (const rawNode of asArray(canonical.nodes)) for (const inputNodeId of asArray(objectRecord(rawNode).inputXmlNodeIds).map(cleanText).filter(Boolean)) if ((canonicalDegrees[cleanText(objectRecord(rawNode).id)] ?? 0) !== (inputDegrees[inputNodeId] ?? 0)) { connectivityMismatch += 1; findings.push(issue('NODE_DEGREE_MISMATCH', `Canonical node ${objectRecord(rawNode).id} degree does not match InputXML node ${inputNodeId}.`, { sequence: next(), canonicalIds: [cleanText(objectRecord(rawNode).id)], details: { inputNodeId } })); }
  const canonicalComponents = connectedComponentCount(asArray(canonical.edges).map(objectRecord), 'fromNodeId', 'toNodeId');
  const inputComponents = connectedComponentCount(elements, 'fromNode', 'toNode');
  if (canonicalComponents !== inputComponents) { connectivityMismatch += 1; findings.push(issue('CONNECTED_COMPONENT_COUNT_MISMATCH', `Canonical connected components (${canonicalComponents}) differ from InputXML (${inputComponents}).`, { sequence: next() })); }
  const ancestryPercent = elements.length ? ((elements.length - orphan) / elements.length) * 100 : 100;
  return { status: 'EVALUATED', mapped: elements.length - orphan, orphan, vectorMismatch, connectivityMismatch, ancestryPercent };
}
/** @param {Record<string, unknown>} input @param {number} toleranceMm @returns {Readonly<Record<string, unknown>>} */
export function validateTopologyArtifacts(input, toleranceMm) {
  const source = objectRecord(input.source), canonical = objectRecord(input.canonical), ledger = objectRecord(input.ledger);
  const inputXml = input.inputXml ? objectRecord(input.inputXml) : null;
  if (!asArray(source.branches).length) throw new TypeError('Independent validation requires a managed source inventory.');
  if (!asArray(ledger.records).length) throw new TypeError('Independent validation requires trace-ledger records.');
  if (!Number.isFinite(toleranceMm) || toleranceMm < 0) throw new RangeError('Geometry tolerance must be a non-negative finite number.');
  const findings = [];
  let sequence = 0;
  const next = () => { sequence += 1; return sequence; };
  const addFinding = (code, message, context) => findings.push(issue(code, message, { ...context, sequence: next() }));
  const sourceResult = validateSource(source, ledger, findings, next);
  validateLedgerSemantics(ledger, addFinding);
  const canonicalResult = validateCanonical(source, canonical, ledger, findings, next);
  const connectivity = validateCanonicalConnectivity(canonical, findings, next);
  const projection = validateProjection(canonical, ledger, inputXml, toleranceMm, findings, next);
  const components = validateComponentLineage({ source, canonical, ledger, inputXml }, toleranceMm, addFinding);
  const sourceTotal = asArray(source.entities).length, nodeTotal = asArray(canonical.nodes).length, edgeTotal = asArray(canonical.edges).length;
  const blockingIssues = findings.filter((row) => objectRecord(row).blocking === true).length;
  const metrics = deepFreeze({
    ...objectRecord(source.metrics),
    canonicalNodeCount: nodeTotal,
    canonicalEdgeCount: edgeTotal,
    pointFeatureCount: asArray(canonical.pointFeatures).length,
    boundaryCount: asArray(canonical.boundaries).length,
    accountedSourceCount: sourceResult.accounted,
    unaccountedSourceCount: sourceTotal - Number(sourceResult.accounted),
    ambiguousCount: asArray(ledger.records).filter((row) => cleanText(objectRecord(row).disposition) === 'BLOCK_AMBIGUOUS').length,
    mappedInputXmlElementCount: projection.status === 'EVALUATED' ? projection.mapped : 'NOT_EVALUATED',
    orphanInputXmlElementCount: projection.status === 'EVALUATED' ? projection.orphan : 'NOT_EVALUATED',
    vectorMismatchCount: projection.status === 'EVALUATED' ? projection.vectorMismatch : 'NOT_EVALUATED',
    connectivityMismatchCount: projection.status === 'EVALUATED' ? projection.connectivityMismatch : 'NOT_EVALUATED',
    componentCoverage: deepFreeze(components.coverage),
    routeComponentsWithFinalDisposition: components.routeAccounted,
    routeComponentsWithoutDisposition: components.routeWithoutDisposition,
    conflictingComponentDispositions: components.conflictingDispositions,
    silentlyDroppedComponentCount: components.silentlyDropped,
    silentlyAbsorbedComponentCount: components.silentlyAbsorbed,
    inlineInstrumentCount: objectRecord(components.instruments).inline,
    pointInstrumentCount: objectRecord(components.instruments).point,
    blockedInstrumentCount: objectRecord(components.instruments).blocked,
    invalidZeroLengthInputXmlElementCount: objectRecord(components.componentProjection).invalidZeroLength,
    canonicalConnectedComponentCount: connectivity.componentCount,
    issueCount: findings.length,
    blockingIssueCount: blockingIssues,
  });
  const percent = (count, total) => total ? (count / total) * 100 : 100;
  const gates = deepFreeze({
    sourceDispositionCoverage: percent(Number(sourceResult.accounted), sourceTotal),
    canonicalNodeAncestry: percent(Number(canonicalResult.nodeAncestry), nodeTotal),
    canonicalEdgeAncestry: percent(Number(canonicalResult.edgeAncestry), edgeTotal),
    inputXmlElementAncestry: projection.ancestryPercent,
    silentDrops: sourceTotal - Number(sourceResult.accounted),
    orphanCanonicalNodes: findings.filter((row) => objectRecord(row).code === 'ORPHAN_CANONICAL_NODE').length,
    orphanCanonicalEdges: findings.filter((row) => objectRecord(row).code === 'ORPHAN_CANONICAL_EDGE').length,
    orphanInputXmlElements: projection.status === 'EVALUATED' ? projection.orphan : 'NOT_EVALUATED',
    blockingTopologyIssues: blockingIssues,
    routeComponentDispositionCoverage: percent(Number(components.routeAccounted), Number(components.routeTotal)),
    silentComponentAbsorption: components.silentlyAbsorbed,
    silentComponentDrops: components.silentlyDropped,
    conflictingComponentDispositions: components.conflictingDispositions,
    componentInputXmlProjection: components.componentInputXmlStatus,
  });
  return deepFreeze({ schema: 'TopologyIndependentValidation.v1', toleranceMm, metrics, gates, issues: Object.freeze(findings), inputXmlStatus: projection.status, componentInputXmlStatus: components.componentInputXmlStatus });
}
export const _test = Object.freeze({ nodeDegrees, connectedComponentCount });
