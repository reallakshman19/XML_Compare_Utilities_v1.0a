/** Deterministic identities and complete structural replacement evidence for one pipe split. */
import { createSequentialEditEligibility, inheritSequentialEditEligibility } from './sequential-edit-eligibility.js';
import { sequentialSemanticFingerprint } from './sequential-command-contracts.js';

export const SEQUENTIAL_PIPE_SPLIT_IDENTITIES_SCHEMA = 'SequentialPipeSplitIdentities.v1';

function token(label, material) {
  return sequentialSemanticFingerprint(label, material)
    .replace(/[^a-zA-Z0-9]+/g, '').slice(-20).toLowerCase();
}
function id(prefix, suffix) { return `ssk:${prefix}:${suffix}`; }
function sorted(values) { return [...new Set(values)].sort(); }
function replaceId(values, before, after) {
  return sorted(values.flatMap((value) => value === before ? after : [value]));
}
function byIds(rows, key, ids) {
  const set = new Set(ids); return rows.filter((row) => set.has(row[key]));
}
export function createSequentialPipeSplitIdentities(input = {}) {
  const material = { parentComponentId: String(input.parentComponentId || ''),
    parentGeometryPartId: String(input.parentGeometryPartId || ''),
    operationId: String(input.operationId || ''), parameter: Number(input.parameter) };
  if (!material.parentComponentId || !material.parentGeometryPartId
    || !material.operationId || !Number.isFinite(material.parameter)) {
    throw new TypeError('Pipe split identities require parent IDs, operation ID and parameter.');
  }
  const suffix = token('SSK3QSPLITIDENTITY', material);
  const result = { schema: SEQUENTIAL_PIPE_SPLIT_IDENTITIES_SCHEMA,
    parentComponentId: material.parentComponentId,
    parentGeometryPartId: material.parentGeometryPartId,
    upstreamComponentId: id('split-component-upstream', suffix),
    downstreamComponentId: id('split-component-downstream', suffix),
    upstreamGeometryPartId: id('split-geometry-upstream', suffix),
    downstreamGeometryPartId: id('split-geometry-downstream', suffix),
    upstreamSplitPortId: id('split-port-upstream', suffix),
    downstreamSplitPortId: id('split-port-downstream', suffix),
    splitNodeId: id('split-node', suffix), splitConnectionId: id('split-connection', suffix),
    upstreamEdgeId: id('split-edge-upstream', suffix),
    downstreamEdgeId: id('split-edge-downstream', suffix) };
  return Object.freeze({ ...result,
    identitiesFingerprint: sequentialSemanticFingerprint('SSK3QSPLITIDENTITIES', result) });
}
export function sequentialPipeSplitIdentityValues(value) {
  if (value?.schema !== SEQUENTIAL_PIPE_SPLIT_IDENTITIES_SCHEMA) {
    throw new TypeError(`Split identities must use ${SEQUENTIAL_PIPE_SPLIT_IDENTITIES_SCHEMA}.`);
  }
  return Object.values(value).filter((row) => typeof row === 'string' && row.startsWith('ssk:'));
}
function childAncestry(parent, input, role) {
  return { ...parent.ancestry, splitParentComponentId: parent.componentId,
    splitParentGeometryPartId: input.target.parentGeometryPartId,
    splitOperationId: input.preview.operationId, splitRole: role,
    sceneEntityIds: [role === 'UPSTREAM' ? input.ids.upstreamGeometryPartId
      : input.ids.downstreamGeometryPartId] };
}
function outerNeighbours(target, childId, siblingId, portId) {
  const external = target.boundaryCuts.filter((row) => row.selectedPortId === portId)
    .map((row) => row.stationaryComponentId);
  return sorted([siblingId, ...external]);
}
function childComponent(target, input, role) {
  const upstream = role === 'UPSTREAM'; const ids = input.ids;
  const componentId = upstream ? ids.upstreamComponentId : ids.downstreamComponentId;
  const siblingId = upstream ? ids.downstreamComponentId : ids.upstreamComponentId;
  const outerPort = upstream ? target.startPort : target.endPort;
  const outerNode = upstream ? target.startNode : target.endNode;
  const splitPortId = upstream ? ids.upstreamSplitPortId : ids.downstreamSplitPortId;
  const geometryPartId = upstream ? ids.upstreamGeometryPartId : ids.downstreamGeometryPartId;
  const edgeId = upstream ? ids.upstreamEdgeId : ids.downstreamEdgeId;
  return { ...target.parentComponent, componentId,
    routeOrder: target.parentComponent.routeOrder + (upstream ? 0 : 0.5),
    portIds: [outerPort.portId, splitPortId], nodeIds: [outerNode.nodeId, ids.splitNodeId],
    geometryPartIds: [geometryPartId], geometryKinds: ['segment'], internalEdgeIds: [edgeId],
    neighbourComponentIds: outerNeighbours(target, componentId, siblingId, outerPort.portId),
    supportAttachmentIds: [], ancestry: childAncestry(target.parentComponent, input, role) };
}
function childPart(target, input, role) {
  const upstream = role === 'UPSTREAM'; const ids = input.ids;
  const outerPort = upstream ? target.startPort : target.endPort;
  const outerNode = upstream ? target.startNode : target.endNode;
  const splitPortId = upstream ? ids.upstreamSplitPortId : ids.downstreamSplitPortId;
  const geometry = upstream ? input.preview.children[0].geometry : input.preview.children[1].geometry;
  return { ...target.parentGeometryPart,
    geometryPartId: upstream ? ids.upstreamGeometryPartId : ids.downstreamGeometryPartId,
    sceneEntityId: upstream ? ids.upstreamGeometryPartId : ids.downstreamGeometryPartId,
    componentId: upstream ? ids.upstreamComponentId : ids.downstreamComponentId,
    role: upstream ? 'upstream' : 'downstream', geometry,
    nodeIds: upstream ? [outerNode.nodeId, ids.splitNodeId] : [ids.splitNodeId, outerNode.nodeId],
    portIds: upstream ? [outerPort.portId, splitPortId] : [splitPortId, outerPort.portId] };
}
function splitPort(target, input, role) {
  const upstream = role === 'UPSTREAM'; const ids = input.ids;
  return { portId: upstream ? ids.upstreamSplitPortId : ids.downstreamSplitPortId,
    componentId: upstream ? ids.upstreamComponentId : ids.downstreamComponentId,
    sourcePosition: input.preview.splitPosition, position: input.preview.splitPosition,
    nodeId: ids.splitNodeId, topologyEditAncestry: { operationId: input.preview.operationId,
      parentComponentId: target.parentComponentId, role } };
}
function outerPort(port, componentId, input) {
  return { ...port, componentId, topologyEditAncestry: { operationId: input.preview.operationId,
    parentComponentId: input.target.parentComponentId, retainedPortId: port.portId } };
}
function childEdge(input, role) {
  const upstream = role === 'UPSTREAM'; const ids = input.ids;
  return { edgeId: upstream ? ids.upstreamEdgeId : ids.downstreamEdgeId,
    componentId: upstream ? ids.upstreamComponentId : ids.downstreamComponentId,
    geometryPartId: upstream ? ids.upstreamGeometryPartId : ids.downstreamGeometryPartId,
    order: 0, fromNodeId: upstream ? input.target.startNode.nodeId : ids.splitNodeId,
    toNodeId: upstream ? ids.splitNodeId : input.target.endNode.nodeId };
}
function endpointNode(node, input, role) {
  const upstream = role === 'UPSTREAM'; const ids = input.ids;
  const childId = upstream ? ids.upstreamComponentId : ids.downstreamComponentId;
  const partId = upstream ? ids.upstreamGeometryPartId : ids.downstreamGeometryPartId;
  const edgeId = upstream ? ids.upstreamEdgeId : ids.downstreamEdgeId;
  return { ...node,
    incidentComponentIds: replaceId(node.incidentComponentIds,
      input.target.parentComponentId, [childId]),
    incidentGeometryPartIds: replaceId(node.incidentGeometryPartIds,
      input.target.parentGeometryPartId, [partId]),
    incidentEdgeIds: replaceId(node.incidentEdgeIds,
      input.target.parentInternalEdge.edgeId, [edgeId]),
    positionAncestry: node.positionAncestry.map((row) => row.componentId === input.target.parentComponentId
      ? { ...row, componentId: childId } : row) };
}
function splitNode(input) {
  const ids = input.ids; const position = input.preview.splitPosition;
  return { nodeId: ids.splitNodeId, position,
    portIds: [ids.upstreamSplitPortId, ids.downstreamSplitPortId].sort(),
    incidentComponentIds: [ids.upstreamComponentId, ids.downstreamComponentId].sort(),
    incidentGeometryPartIds: [ids.upstreamGeometryPartId, ids.downstreamGeometryPartId].sort(),
    incidentEdgeIds: [ids.upstreamEdgeId, ids.downstreamEdgeId].sort(),
    committedConnectionIds: [ids.splitConnectionId], degree: 3, boundaryClass: 'CONNECTED',
    positionProvenance: 'TOPOLOGY_EDIT_JOURNAL',
    positionAncestry: [
      { portId: ids.upstreamSplitPortId, componentId: ids.upstreamComponentId,
        sourcePosition: position, resolvedPosition: position },
      { portId: ids.downstreamSplitPortId, componentId: ids.downstreamComponentId,
        sourcePosition: position, resolvedPosition: position },
    ] };
}
function splitConnection(input) {
  const ids = input.ids; const position = input.preview.splitPosition;
  return { connectionId: ids.splitConnectionId, fromPortId: ids.upstreamSplitPortId,
    toPortId: ids.downstreamSplitPortId, fromPosition: position, toPosition: position,
    fromNodeId: ids.splitNodeId, toNodeId: ids.splitNodeId,
    nodeRelation: 'MERGED_BY_COMMITTED_IDENTITY', status: 'COMMITTED',
    topologyEditAncestry: { operationId: input.preview.operationId,
      parentComponentId: input.target.parentComponentId } };
}
function splitBoundaryCut(input, role) {
  const upstream = role === 'UPSTREAM'; const ids = input.ids;
  const componentId = upstream ? ids.upstreamComponentId : ids.downstreamComponentId;
  const stationaryComponentId = upstream ? ids.downstreamComponentId : ids.upstreamComponentId;
  const selectedPortId = upstream ? ids.upstreamSplitPortId : ids.downstreamSplitPortId;
  const stationaryPortId = upstream ? ids.downstreamSplitPortId : ids.upstreamSplitPortId;
  return { boundaryCutId: `ssk:boundary-cut:${componentId}:${ids.splitConnectionId}`,
    componentId, connectionId: ids.splitConnectionId, selectedPortId, stationaryPortId,
    stationaryComponentId, nodeRelation: 'MERGED_BY_COMMITTED_IDENTITY',
    status: 'COMMITTED', currentCoincidence: true,
    rigidTransformDisposition: 'BLOCKED_STATIONARY_TOPOLOGY_BOUNDARY' };
}
function remappedCuts(input, role) {
  const upstream = role === 'UPSTREAM'; const outerPortId = upstream
    ? input.target.startPort.portId : input.target.endPort.portId;
  const componentId = upstream ? input.ids.upstreamComponentId : input.ids.downstreamComponentId;
  return input.target.boundaryCuts.filter((row) => row.selectedPortId === outerPortId)
    .map((row) => ({ ...row, componentId,
      boundaryCutId: `ssk:boundary-cut:${componentId}:${row.connectionId}` }));
}
function childIdForPort(input, portId) {
  if (portId === input.target.startPort.portId) return input.ids.upstreamComponentId;
  if (portId === input.target.endPort.portId) return input.ids.downstreamComponentId;
  throw new RangeError(`Parent split port is not canonical: ${portId}`);
}
function reciprocalCuts(input) {
  const connections = new Set(input.target.boundaryCuts.map((row) => row.connectionId));
  return input.topology.componentBoundaryCuts.filter((row) => (
    row.componentId !== input.target.parentComponentId && connections.has(row.connectionId)
  ));
}
function stationaryComponents(input) {
  const ids = sorted(input.target.boundaryCuts.map((row) => row.stationaryComponentId));
  return byIds(input.topology.components, 'componentId', ids);
}
function stationaryComponentAfter(component, input) {
  const children = input.target.boundaryCuts
    .filter((row) => row.stationaryComponentId === component.componentId)
    .map((row) => childIdForPort(input, row.selectedPortId));
  return { ...component, neighbourComponentIds: sorted(component.neighbourComponentIds
    .flatMap((idValue) => idValue === input.target.parentComponentId ? children : [idValue])) };
}
function stationaryCutAfter(cut, input) {
  return { ...cut, stationaryComponentId: childIdForPort(input, cut.stationaryPortId) };
}
function eligibility(input, components, parts, nodes, cuts) {
  const parent = input.topology.eligibility.find((row) => row.targetId === input.target.parentComponentId);
  const parentPart = input.topology.eligibility.find((row) => row.targetId === input.target.parentGeometryPartId);
  const componentRows = components.map((row) => createSequentialEditEligibility({
    targetKind: 'COMPONENT', targetId: row.componentId, componentId: row.componentId,
    canonicalType: 'PIPE', sessionState: 'ROUTE_COMPLETE', geometryPartCount: 1,
    positionedPortCount: 2, completeAncestry: true,
    rigidBoundaryCount: cuts.filter((cut) => cut.componentId === row.componentId).length,
    evidence: { ...row.ancestry, boundaryCutIds: cuts
      .filter((cut) => cut.componentId === row.componentId).map((cut) => cut.boundaryCutId),
      splitOperationId: input.preview.operationId } }));
  const partRows = parts.map((row, index) => inheritSequentialEditEligibility(componentRows[index], {
    targetKind: 'GEOMETRY_PART', targetId: row.geometryPartId,
    evidence: { sceneEntityId: row.sceneEntityId, role: row.role,
      sourceStrokeId: row.sourceStrokeId, selectionResolution: 'WHOLE_COMPONENT' } }));
  const nodeRows = nodes.map((row) => createSequentialEditEligibility({
    targetKind: 'NODE', targetId: row.nodeId, sessionState: 'ROUTE_COMPLETE',
    geometryPartCount: row.incidentEdgeIds.length || 1, positionedPortCount: row.portIds.length || 1,
    completeAncestry: true, capabilities: ['STRETCH_ELIGIBLE'], locks: [],
    evidence: { incidentComponentIds: row.incidentComponentIds, boundaryClass: row.boundaryClass } }));
  return { before: [parent, parentPart,
    ...byIds(input.topology.eligibility, 'targetId', input.target.nodeIds)].filter(Boolean),
    after: [...componentRows, ...partRows, ...nodeRows] };
}
function selection(component, part, eligibilityRow) {
  const candidate = { selectionCandidateId: `ssk:selection:${part.geometryPartId}`,
    topologyEntityId: part.geometryPartId,
    selectionGroupId: `ssk:selection-group:${component.componentId}`,
    resolvedComponentId: component.componentId, sceneEntityId: part.sceneEntityId,
    boundaryCutIds: [], eligibilityId: eligibilityRow.eligibilityId };
  const group = { selectionGroupId: candidate.selectionGroupId,
    componentId: component.componentId, geometryPartIds: [part.geometryPartId],
    selectionCandidateIds: [candidate.selectionCandidateId], boundaryCutIds: [],
    eligibilityId: null };
  return { candidate, group };
}
function selectionEvidence(parts, components, eligibilityRows, cuts) {
  return parts.map((part, index) => {
    const row = selection(components[index], part, eligibilityRows.after[index + 2]);
    const boundaryCutIds = cuts.filter((cut) => cut.componentId === components[index].componentId)
      .map((cut) => cut.boundaryCutId);
    return { candidate: { ...row.candidate, boundaryCutIds },
      group: { ...row.group, boundaryCutIds,
        eligibilityId: eligibilityRows.after[index].eligibilityId } };
  });
}
function sceneEntity(parent, component, part, input) {
  return { ...parent, id: part.geometryPartId, geometry: part.geometry,
    domainRef: { ...parent.domainRef, componentId: component.componentId,
      geometryRole: part.role }, metadata: { ...parent.metadata,
      sequential: { ...parent.metadata?.sequential,
        component: { ...parent.metadata?.sequential?.component,
          componentId: component.componentId, canonicalType: 'PIPE' },
        topologyEdit: { operationId: input.preview.operationId,
          parentComponentId: input.target.parentComponentId, role: part.role } } } };
}
export function createSequentialPipeSplitReplacement(input = {}) {
  const target = input.target; const ids = input.preview.identities;
  const context = { ...input, target, ids };
  const stationary = stationaryComponents(context);
  const components = [childComponent(target, context, 'UPSTREAM'),
    childComponent(target, context, 'DOWNSTREAM')];
  const reciprocal = reciprocalCuts(context);
  const parts = [childPart(target, context, 'UPSTREAM'), childPart(target, context, 'DOWNSTREAM')];
  const ports = [outerPort(target.startPort, ids.upstreamComponentId, context),
    outerPort(target.endPort, ids.downstreamComponentId, context),
    splitPort(target, context, 'UPSTREAM'), splitPort(target, context, 'DOWNSTREAM')];
  const nodes = [endpointNode(target.startNode, context, 'UPSTREAM'),
    endpointNode(target.endNode, context, 'DOWNSTREAM'), splitNode(context)];
  const edges = [childEdge(context, 'UPSTREAM'), childEdge(context, 'DOWNSTREAM')];
  const cuts = [splitBoundaryCut(context, 'UPSTREAM'), splitBoundaryCut(context, 'DOWNSTREAM'),
    ...remappedCuts(context, 'UPSTREAM'), ...remappedCuts(context, 'DOWNSTREAM'),
    ...reciprocal.map((row) => stationaryCutAfter(row, context))];
  const elig = eligibility(context, components, parts, nodes, cuts);
  const selections = selectionEvidence(parts, components, elig, cuts);
  const before = { components: [target.parentComponent, ...stationary],
    geometryParts: [target.parentGeometryPart],
    ports: [target.startPort, target.endPort], nodes: [target.startNode, target.endNode],
    internalEdges: [target.parentInternalEdge], committedConnections: [],
    componentBoundaryCuts: [...target.boundaryCuts, ...reciprocal],
    selectionGroups: input.topology.selectionGroups.filter((row) => row.componentId === target.parentComponentId),
    selectionCandidates: input.topology.selectionCandidates.filter((row) => row.resolvedComponentId === target.parentComponentId),
    eligibility: elig.before,
    supportCarriers: input.topology.supportCarriers.filter((row) => row.componentId === target.parentComponentId) };
  const after = { components: [...components,
      ...stationary.map((row) => stationaryComponentAfter(row, context))],
    geometryParts: parts, ports, nodes, internalEdges: edges,
    committedConnections: [splitConnection(context)], componentBoundaryCuts: cuts,
    selectionGroups: selections.map((row) => row.group),
    selectionCandidates: selections.map((row) => row.candidate), eligibility: elig.after,
    supportCarriers: components.map((row) => ({ carrierId: row.componentId,
      componentId: row.componentId, supportAttachmentIds: [] })) };
  const scene = { before: [target.parentSceneEntity], after: components.map((row, index) => (
    sceneEntity(target.parentSceneEntity, row, parts[index], context))) };
  return Object.freeze({ before, after, scene });
}
