/** Pure evidence expansion and classification for whole-component retirement review. */
import { sameSequentialContractValue } from './sequential-command-contracts.js';

export const SEQUENTIAL_COMPONENT_RETIREMENT_EVIDENCE_REJECTION =
  'SEQUENTIAL_COMPONENT_RETIREMENT_EVIDENCE_INVALID';
function fail(message, Constructor = RangeError) {
  const error = new Constructor(message); error.code = SEQUENTIAL_COMPONENT_RETIREMENT_EVIDENCE_REJECTION;
  throw error;
}
function exactRow(rows, key, id, label) {
  const row = (Array.isArray(rows) ? rows : []).find((item) => item[key] === id);
  if (!row) fail(`${label} is unavailable in current Sequential topology: ${id}`);
  return row;
}
function finitePoint(value, label) {
  const source = value || {}, coordinates = ['x', 'y', 'z'].map((axis) => source[axis]);
  if (coordinates.some((coordinate) => coordinate === null || coordinate === undefined
    || String(coordinate).trim() === '') || !coordinates.every(Number.isFinite)) {
    fail(`${label} must contain finite x, y and z coordinates.`, TypeError);
  }
  return { x: coordinates[0], y: coordinates[1], z: coordinates[2] };
}
function sortedUnique(values) { return [...new Set(values.filter(Boolean))].sort(); }
function sortedBy(rows, key) {
  return [...rows].sort((left, right) => String(left[key]).localeCompare(String(right[key])));
}
function geometryPoints(part) {
  const geometry = part.geometry || {};
  if (geometry.kind === 'segment') {
    return [geometry.start, geometry.end].map((row) => finitePoint(row, 'Segment point'));
  }
  if (geometry.kind === 'polyline') {
    return (geometry.points || []).map((row) => finitePoint(row, 'Polyline point'));
  }
  fail(`Retirement anchor requires segment or polyline geometry; found ${geometry.kind || 'missing'}.`);
}
export function createSequentialRetirementAnchorGeometry(topology, mapping) {
  const from = exactRow(topology.nodes, 'nodeId', mapping.edge.fromNodeId, 'FROM node');
  const to = exactRow(topology.nodes, 'nodeId', mapping.edge.toNodeId, 'TO node');
  const fromPosition = finitePoint(from.position, 'Sequential FROM position');
  const toPosition = finitePoint(to.position, 'Sequential TO position');
  const points = geometryPoints(mapping.part), order = Number(mapping.edge.order);
  if (points.length !== mapping.part.nodeIds.length
    || !sameSequentialContractValue(points[order], fromPosition)
    || !sameSequentialContractValue(points[order + 1], toPosition)) {
    fail('Mapped geometry-part anchor does not match current endpoint evidence.');
  }
  const displacement = Object.fromEntries(['x', 'y', 'z'].map((axis) =>
    [axis, toPosition[axis] - fromPosition[axis]]));
  const lengthMm = Math.hypot(displacement.x, displacement.y, displacement.z);
  if (!(lengthMm > 0)) fail('Mapped Sequential retirement anchor must have non-zero length.');
  return { fromPosition, toPosition, displacement, lengthMm };
}
export function collectSequentialComponentRetirementEvidence(topology, mapping) {
  const component = mapping.component;
  const pick = (rows, key, ids, label) => sortedBy(ids.map((id) => exactRow(rows, key, id, label)), key);
  const geometryParts = pick(topology.geometryParts, 'geometryPartId', component.geometryPartIds,
    'Geometry part');
  const internalEdges = pick(topology.internalEdges, 'edgeId', component.internalEdgeIds,
    'Internal edge');
  const nodes = pick(topology.nodes, 'nodeId', component.nodeIds, 'Component node');
  const ports = pick(topology.ports, 'portId', component.portIds, 'Component port');
  const portIds = new Set(component.portIds), nodeIds = new Set(component.nodeIds);
  const committedConnections = sortedBy((topology.committedConnections || []).filter((row) =>
    portIds.has(row.fromPortId) || portIds.has(row.toPortId)
      || nodeIds.has(row.fromNodeId) || nodeIds.has(row.toNodeId)), 'connectionId');
  const connectionIds = new Set(committedConnections.map((row) => row.connectionId));
  return { geometryParts, internalEdges, nodes, ports, committedConnections,
    selectionGroup: exactRow(topology.selectionGroups, 'componentId', component.componentId,
      'Component selection group'),
    supportCarrier: exactRow(topology.supportCarriers, 'componentId', component.componentId,
      'Component support carrier'),
    supportAttachments: pick(topology.supportAttachments || [], 'supportAttachmentId',
      component.supportAttachmentIds || [], 'Support attachment'),
    boundaryCuts: sortedBy((topology.componentBoundaryCuts || []).filter((row) =>
      row.componentId === component.componentId), 'boundaryCutId'),
    repairs: sortedBy((topology.repairs || []).filter((row) => connectionIds.has(row.connectionId)
      || nodeIds.has(row.fromNodeId) || nodeIds.has(row.toNodeId)), 'repairId'),
    openBoundaries: sortedBy((topology.openBoundaries || []).filter((row) =>
      nodeIds.has(row.nodeId)), 'boundaryId') };
}
export function createSequentialRetirementAffectedIds(mapping, evidence) {
  return { componentIds: [mapping.componentId], branchIds: [mapping.branchId],
    geometryPartIds: evidence.geometryParts.map((row) => row.geometryPartId),
    internalEdgeIds: evidence.internalEdges.map((row) => row.edgeId),
    nodeIds: evidence.nodes.map((row) => row.nodeId),
    portIds: evidence.ports.map((row) => row.portId),
    connectionIds: evidence.committedConnections.map((row) => row.connectionId),
    supportAttachmentIds: evidence.supportAttachments.map((row) => row.supportAttachmentId),
    boundaryCutIds: evidence.boundaryCuts.map((row) => row.boundaryCutId),
    repairIds: evidence.repairs.map((row) => row.repairId),
    openBoundaryIds: evidence.openBoundaries.map((row) => row.boundaryId) };
}
function blocker(code, ids, message) {
  return { code, entityIds: sortedUnique(ids), message };
}
function completeAncestry(component, evidence) {
  const ancestry = component.ancestry || {};
  const sceneIds = sortedUnique(evidence.geometryParts.map((row) => row.sceneEntityId));
  return Boolean(ancestry.sourceComponentId && Number.isInteger(ancestry.sourceIndex)
    && ancestry.sourceBranchId === component.branchId && ancestry.sessionFingerprint
    && ancestry.confirmedConstructionFingerprint && ancestry.strokeId && ancestry.strokeOperation)
    && sameSequentialContractValue(sortedUnique(ancestry.sceneEntityIds || []), sceneIds);
}
export function createSequentialRetirementBlockers(mapping, evidence) {
  const ownedEdges = new Set(evidence.internalEdges.map((row) => row.edgeId));
  const shared = evidence.nodes.filter((node) => (node.incidentComponentIds || [])
    .some((id) => id !== mapping.componentId)
    || (node.incidentEdgeIds || []).some((id) => !ownedEdges.has(id)));
  const external = evidence.nodes.filter((node) => node.boundaryClass === 'EXTERNAL_BOUNDARY');
  return [
    ...(!completeAncestry(mapping.component, evidence)
      ? [blocker('INCOMPLETE_COMPONENT_ANCESTRY', [mapping.componentId],
        'Whole-component retirement requires complete construction ancestry.')] : []),
    ...(evidence.supportAttachments.length ? [blocker('SUPPORTED_COMPONENT',
      evidence.supportAttachments.map((row) => row.supportAttachmentId),
      'Retiring the component would orphan support attachments.')] : []),
    ...(evidence.boundaryCuts.length ? [blocker('BOUNDARY_CUT_PRESENT',
      evidence.boundaryCuts.map((row) => row.boundaryCutId),
      'Retiring the component crosses a committed stationary boundary.')] : []),
    ...(evidence.repairs.length ? [blocker('REPAIR_MEDIATED_CONTINUITY',
      evidence.repairs.map((row) => row.repairId),
      'Retiring the component affects repair-mediated continuity.')] : []),
    ...(shared.length ? [blocker('SHARED_NODE_DEPENDENCY', shared.map((row) => row.nodeId),
      'Retiring the component affects nodes owned by other topology.')] : []),
    ...(external.length ? [blocker('PROTECTED_EXTERNAL_BOUNDARY',
      external.map((row) => row.nodeId),
      'Retiring the component affects an external boundary.')] : []),
  ].sort((left, right) => left.code.localeCompare(right.code));
}
export function createSequentialRetirementReviewFlags(request, geometry, mapping, evidence) {
  const source = request.retirementGeometry;
  const dot = ['x', 'y', 'z'].reduce((sum, axis) =>
    sum + source.displacement[axis] * geometry.displacement[axis], 0);
  return sortedUnique([
    ...(Math.abs(source.lengthMm - geometry.lengthMm) > 1e-6 ? ['SOURCE_LENGTH_DIFFERS'] : []),
    ...(!sameSequentialContractValue(source.fromPosition, geometry.fromPosition)
      || !sameSequentialContractValue(source.toPosition, geometry.toPosition)
      ? ['SOURCE_ENDPOINTS_DIFFER'] : []),
    ...(dot < 0 ? ['SOURCE_DIRECTION_REVERSED'] : []),
    ...(evidence.geometryParts.length > 1 ? ['WHOLE_COMPONENT_EXPANDS_MULTIPLE_PARTS'] : []),
    ...(evidence.internalEdges.length > 1 ? ['WHOLE_COMPONENT_EXPANDS_MULTIPLE_EDGES'] : []),
    ...(evidence.committedConnections.length ? ['COMMITTED_CONNECTION_RETIREMENT_REQUIRED'] : []),
    ...(mapping.component.neighbourComponentIds?.length ? ['NEIGHBOUR_COMPONENTS_AFFECTED'] : []),
    ...(evidence.openBoundaries.length ? ['OPEN_BOUNDARY_RETIREMENT'] : []),
  ]);
}
function ownedGeometryInvariant(component, evidence) {
  const nodes = new Map(evidence.nodes.map((row) => [row.nodeId, row]));
  const parts = new Map(evidence.geometryParts.map((row) => [row.geometryPartId, row]));
  try {
    return evidence.geometryParts.every((part) => {
      const points = geometryPoints(part);
      return points.length === part.nodeIds.length && part.nodeIds.every((id, index) =>
        sameSequentialContractValue(points[index], finitePoint(nodes.get(id)?.position,
          'Owned node position')));
    }) && evidence.internalEdges.every((edge) => {
      const part = parts.get(edge.geometryPartId), order = Number(edge.order);
      return edge.componentId === component.componentId && part?.componentId === component.componentId
        && Number.isInteger(order) && part.nodeIds?.[order] === edge.fromNodeId
        && part.nodeIds?.[order + 1] === edge.toNodeId;
    });
  } catch { return false; }
}
function sortedRecordIds(rows, key) {
  const ids = rows.map((row) => row[key]);
  return ids.every(Boolean) && new Set(ids).size === ids.length
    && sameSequentialContractValue(ids, [...ids].sort());
}
function expansionSetInvariant(mapping, evidence, affected) {
  const component = mapping.component, ids = (rows, key) => rows.map((row) => row[key]);
  const exact = sameSequentialContractValue;
  const openNodeIds = sortedUnique(evidence.nodes.filter((row) =>
    ['OPEN_TERMINAL', 'INTENTIONAL_TERMINAL', 'EXTERNAL_BOUNDARY'].includes(row.boundaryClass))
    .map((row) => row.nodeId));
  const neighbourIds = sortedUnique(evidence.boundaryCuts.map((row) => row.stationaryComponentId));
  const collections = [['geometryParts', 'geometryPartId'], ['internalEdges', 'edgeId'],
    ['nodes', 'nodeId'], ['ports', 'portId'], ['committedConnections', 'connectionId'],
    ['supportAttachments', 'supportAttachmentId'], ['boundaryCuts', 'boundaryCutId'],
    ['repairs', 'repairId'], ['openBoundaries', 'boundaryId']];
  return collections.every(([name, key]) => sortedRecordIds(evidence[name], key))
    && exact(ids(evidence.geometryParts, 'geometryPartId'), [...component.geometryPartIds].sort())
    && exact(ids(evidence.internalEdges, 'edgeId'), [...component.internalEdgeIds].sort())
    && exact(ids(evidence.nodes, 'nodeId'), [...component.nodeIds].sort())
    && exact(ids(evidence.ports, 'portId'), [...component.portIds].sort())
    && exact(ids(evidence.supportAttachments, 'supportAttachmentId'),
      [...component.supportAttachmentIds].sort())
    && evidence.selectionGroup?.componentId === component.componentId
    && exact(evidence.selectionGroup.geometryPartIds, [...component.geometryPartIds].sort())
    && exact(evidence.selectionGroup.boundaryCutIds, ids(evidence.boundaryCuts, 'boundaryCutId'))
    && evidence.supportCarrier?.componentId === component.componentId
    && evidence.supportCarrier?.carrierId === component.componentId
    && exact(evidence.supportCarrier.supportAttachmentIds,
      ids(evidence.supportAttachments, 'supportAttachmentId'))
    && completeAncestry(component, evidence)
    && exact(neighbourIds, [...component.neighbourComponentIds].sort())
    && exact(ids(evidence.openBoundaries, 'nodeId'), openNodeIds)
    && exact(affected, createSequentialRetirementAffectedIds(mapping, evidence));
}
function relationshipEvidenceInvariant(mapping, evidence) {
  const component = mapping.component, ports = new Set(component.portIds);
  const nodes = new Set(component.nodeIds);
  const connectionIds = evidence.committedConnections.map((row) => row.connectionId);
  const connections = new Set(connectionIds);
  const nodeConnectionIds = sortedUnique(evidence.nodes.flatMap((row) =>
    row.committedConnectionIds || []));
  return sameSequentialContractValue(connectionIds, nodeConnectionIds)
    && sameSequentialContractValue(evidence.geometryParts.find((row) =>
      row.geometryPartId === mapping.part.geometryPartId), mapping.part)
    && sameSequentialContractValue(evidence.internalEdges.find((row) =>
      row.edgeId === mapping.edge.edgeId), mapping.edge)
    && ownedGeometryInvariant(component, evidence)
    && evidence.ports.every((row) => row.componentId === component.componentId
      && nodes.has(row.nodeId))
    && evidence.committedConnections.every((row) => ports.has(row.fromPortId)
      || ports.has(row.toPortId) || nodes.has(row.fromNodeId) || nodes.has(row.toNodeId))
    && evidence.supportAttachments.every((row) => row.carrierId === component.componentId)
    && evidence.boundaryCuts.every((row) => row.componentId === component.componentId)
    && evidence.repairs.every((row) => connections.has(row.connectionId)
      || nodes.has(row.fromNodeId) || nodes.has(row.toNodeId))
    && evidence.committedConnections.filter((row) =>
      row.nodeRelation === 'REPAIR_MEDIATED_CONTINUITY').every((row) =>
      evidence.repairs.some((repair) => repair.connectionId === row.connectionId))
    && evidence.openBoundaries.every((row) => nodes.has(row.nodeId));
}
export function validateSequentialRetirementEvidence(mapping, evidence, affected) {
  return expansionSetInvariant(mapping, evidence, affected)
    && relationshipEvidenceInvariant(mapping, evidence);
}
