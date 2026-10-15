/** Pure bounded structural-impact evidence for an explicit Sequential SPLIT_PIPE mapping. */
import { immutableJson } from '../../../contracts/contract-values.js';
import { assertTopologySequentialSplitEdgeRequest } from '../../topology-trace-validator/topology-sequential-split-edge-request.js';
import {
  sameSequentialContractValue,
  sequentialSemanticFingerprint,
} from './sequential-command-contracts.js';
export const SEQUENTIAL_SPLIT_PIPE_IMPACT_PREVIEW_SCHEMA = 'SequentialSplitPipeImpactPreview.v1';
export const SEQUENTIAL_SPLIT_PIPE_IMPACT_REJECTION = Object.freeze({
  REQUEST_INVALID: 'SEQUENTIAL_SPLIT_PIPE_REQUEST_INVALID',
  TOPOLOGY_INVALID: 'SEQUENTIAL_SPLIT_PIPE_TOPOLOGY_INVALID',
  EXPLICIT_IDENTITY_REQUIRED: 'SEQUENTIAL_SPLIT_PIPE_EXPLICIT_IDENTITY_REQUIRED',
  COMPONENT_MISSING: 'SEQUENTIAL_SPLIT_PIPE_COMPONENT_MISSING',
  GEOMETRY_PART_MISSING: 'SEQUENTIAL_SPLIT_PIPE_GEOMETRY_PART_MISSING',
  INTERNAL_EDGE_MISSING: 'SEQUENTIAL_SPLIT_PIPE_INTERNAL_EDGE_MISSING',
  BRANCH_MISSING: 'SEQUENTIAL_SPLIT_PIPE_BRANCH_MISSING',
  OWNERSHIP_INVALID: 'SEQUENTIAL_SPLIT_PIPE_OWNERSHIP_INVALID',
  GEOMETRY_INVALID: 'SEQUENTIAL_SPLIT_PIPE_GEOMETRY_INVALID',
  PREVIEW_INVALID: 'SEQUENTIAL_SPLIT_PIPE_PREVIEW_INVALID',
});
function fail(code, message, Constructor = RangeError) {
  const error = new Constructor(message); error.code = code; throw error;
}
function requiredText(value, label) {
  const result = String(value ?? '').trim();
  if (!result) fail(SEQUENTIAL_SPLIT_PIPE_IMPACT_REJECTION.EXPLICIT_IDENTITY_REQUIRED,
    `${label} is required.`, TypeError);
  return result;
}
function exactRequest(value) {
  try {
    const request = assertTopologySequentialSplitEdgeRequest(value);
    const intent = request.sequentialIntent;
    if (intent?.candidateNativeOperation !== 'SPLIT_PIPE'
      || intent?.candidateNativeOperationIsBounded !== true
      || intent?.currentNativeSplitAuthority !== 'BOUNDED_ADAPTER_UNQUALIFIED'
      || intent?.automaticIdentityMapping !== false) {
      throw new TypeError('Request does not preserve bounded SPLIT_PIPE authority.');
    }
    return request;
  } catch (error) {
    fail(SEQUENTIAL_SPLIT_PIPE_IMPACT_REJECTION.REQUEST_INVALID,
      `Validator split request is invalid: ${error.message || String(error)}`, TypeError);
  }
}
function exactTopology(value) {
  if (value?.schema !== 'SequentialEditableTopologySnapshot.v1') fail(
    SEQUENTIAL_SPLIT_PIPE_IMPACT_REJECTION.TOPOLOGY_INVALID,
    'Split impact requires SequentialEditableTopologySnapshot.v1.', TypeError);
  return value;
}
function exactRow(rows, key, id, label, code) {
  const row = (Array.isArray(rows) ? rows : []).find((item) => item[key] === id);
  if (!row) fail(code, `${label} is unavailable in current Sequential topology: ${id}`);
  return row;
}
function finitePoint(value, label) {
  const source = value || {}; const coordinates = ['x', 'y', 'z'].map((axis) => source[axis]);
  if (coordinates.some((coordinate) => coordinate === null || coordinate === undefined
    || String(coordinate).trim() === '') || !coordinates.every(Number.isFinite)) fail(
    SEQUENTIAL_SPLIT_PIPE_IMPACT_REJECTION.GEOMETRY_INVALID,
    `${label} must contain finite x, y and z coordinates.`, TypeError);
  return { x: coordinates[0], y: coordinates[1], z: coordinates[2] };
}
function sortedUnique(values) { return [...new Set(values.filter(Boolean))].sort(); }
function exactMapping(topology, input) {
  const componentId = requiredText(input.sequentialComponentId, 'sequentialComponentId');
  const geometryPartId = requiredText(input.sequentialGeometryPartId, 'sequentialGeometryPartId');
  const internalEdgeId = requiredText(input.sequentialInternalEdgeId, 'sequentialInternalEdgeId');
  const branchId = requiredText(input.sequentialBranchId, 'sequentialBranchId');
  const component = exactRow(topology.components, 'componentId', componentId, 'Component',
    SEQUENTIAL_SPLIT_PIPE_IMPACT_REJECTION.COMPONENT_MISSING);
  const part = exactRow(topology.geometryParts, 'geometryPartId', geometryPartId, 'Geometry part',
    SEQUENTIAL_SPLIT_PIPE_IMPACT_REJECTION.GEOMETRY_PART_MISSING);
  const edge = exactRow(topology.internalEdges, 'edgeId', internalEdgeId, 'Internal edge',
    SEQUENTIAL_SPLIT_PIPE_IMPACT_REJECTION.INTERNAL_EDGE_MISSING);
  if (!(topology.branch?.branchIds || []).includes(branchId)) fail(
    SEQUENTIAL_SPLIT_PIPE_IMPACT_REJECTION.BRANCH_MISSING,
    `Branch is unavailable in current Sequential topology: ${branchId}`);
  return { componentId, geometryPartId, internalEdgeId, branchId, component, part, edge };
}
function assertOwnership(mapping) {
  const { component, part, edge } = mapping;
  const edgeIndex = Number(edge.order);
  const exactVertices = Number.isInteger(edgeIndex)
    && part.nodeIds?.[edgeIndex] === edge.fromNodeId
    && part.nodeIds?.[edgeIndex + 1] === edge.toNodeId;
  if (component.branchId !== mapping.branchId
    || part.componentId !== mapping.componentId
    || edge.componentId !== mapping.componentId
    || edge.geometryPartId !== mapping.geometryPartId
    || !component.geometryPartIds.includes(mapping.geometryPartId)
    || !component.internalEdgeIds.includes(mapping.internalEdgeId)
    || !exactVertices) fail(SEQUENTIAL_SPLIT_PIPE_IMPACT_REJECTION.OWNERSHIP_INVALID,
    'Explicit split mapping does not preserve component, part, edge, branch and endpoint ownership.');
}
function splitGeometry(topology, edge, fraction) {
  const from = exactRow(topology.nodes, 'nodeId', edge.fromNodeId, 'FROM node',
    SEQUENTIAL_SPLIT_PIPE_IMPACT_REJECTION.GEOMETRY_INVALID);
  const to = exactRow(topology.nodes, 'nodeId', edge.toNodeId, 'TO node',
    SEQUENTIAL_SPLIT_PIPE_IMPACT_REJECTION.GEOMETRY_INVALID);
  const fromPosition = finitePoint(from.position, 'Sequential FROM position');
  const toPosition = finitePoint(to.position, 'Sequential TO position');
  const displacement = Object.fromEntries(['x', 'y', 'z'].map((axis) =>
    [axis, toPosition[axis] - fromPosition[axis]]));
  const lengthMm = Math.hypot(displacement.x, displacement.y, displacement.z);
  if (!(lengthMm > 0)) fail(SEQUENTIAL_SPLIT_PIPE_IMPACT_REJECTION.GEOMETRY_INVALID,
    'Mapped Sequential internal edge must have non-zero length.');
  const splitPosition = Object.fromEntries(['x', 'y', 'z'].map((axis) =>
    [axis, fromPosition[axis] + displacement[axis] * fraction]));
  return { fraction, fromPosition, toPosition, displacement, lengthMm, splitPosition,
    leftLengthMm: lengthMm * fraction, rightLengthMm: lengthMm * (1 - fraction) };
}
function nodeEvidence(topology, nodeId, role) {
  const node = exactRow(topology.nodes, 'nodeId', nodeId, `${role} node`,
    SEQUENTIAL_SPLIT_PIPE_IMPACT_REJECTION.GEOMETRY_INVALID);
  return { role, canonicalRecord: node, nodeId, position: finitePoint(node.position, `${role} position`),
    boundaryClass: node.boundaryClass, degree: node.degree,
    portIds: sortedUnique(node.portIds || []),
    incidentEdgeIds: sortedUnique(node.incidentEdgeIds || []),
    committedConnectionIds: sortedUnique(node.committedConnectionIds || []) };
}
function affectedRecords(topology, mapping, endpoints) {
  const connectionIds = sortedUnique(endpoints.flatMap((row) => row.committedConnectionIds));
  return {
    componentIds: [mapping.componentId], geometryPartIds: [mapping.geometryPartId],
    internalEdgeIds: [mapping.internalEdgeId], branchIds: [mapping.branchId],
    nodeIds: endpoints.map((row) => row.nodeId),
    portIds: sortedUnique(endpoints.flatMap((row) => row.portIds)), connectionIds,
    supportAttachmentIds: sortedUnique(mapping.component.supportAttachmentIds || []),
    boundaryCutIds: sortedUnique((topology.componentBoundaryCuts || []).filter((row) =>
      row.componentId === mapping.componentId).map((row) => row.boundaryCutId)),
    repairIds: sortedUnique((topology.repairs || []).filter((row) =>
      connectionIds.includes(row.connectionId)
      || endpoints.some((endpoint) => [row.fromNodeId, row.toNodeId].includes(endpoint.nodeId)))
      .map((row) => row.repairId)),
  };
}
function blocker(code, ids, message) { return { code, entityIds: sortedUnique(ids), message }; }
function splitCollision(topology, geometry, endpointIds) {
  return (topology.nodes || []).filter((node) => !endpointIds.includes(node.nodeId)
    && ['x', 'y', 'z'].every((axis) => node.position?.[axis] === geometry.splitPosition[axis]));
}
function impactBlockers(topology, mapping, endpoints, geometry, affected) {
  const protectedNodes = endpoints.filter((row) =>
    ['EXTERNAL_BOUNDARY', 'REPAIR_BOUNDARY', 'INTENTIONAL_TERMINAL'].includes(row.boundaryClass));
  const collisions = splitCollision(topology, geometry, endpoints.map((row) => row.nodeId));
  const geometryKind = mapping.part.geometry?.kind;
  return [
    ...(mapping.component.canonicalType !== 'PIPE' ? [blocker('NON_PIPE_COMPONENT',
      [mapping.componentId], 'Bounded SPLIT_PIPE requires a PIPE component.')] : []),
    ...(mapping.component.geometryPartIds.length !== 1 ? [blocker('MULTI_PART_COMPONENT',
      mapping.component.geometryPartIds, 'Bounded SPLIT_PIPE requires one geometry part.')] : []),
    ...(mapping.component.internalEdgeIds.length !== 1 || mapping.part.nodeIds.length !== 2
      ? [blocker('MULTI_SEGMENT_COMPONENT', mapping.component.internalEdgeIds,
        'Bounded SPLIT_PIPE requires one straight internal segment.')] : []),
    ...(geometryKind !== 'segment' ? [blocker('UNSUPPORTED_GEOMETRY', [mapping.geometryPartId],
      `Bounded SPLIT_PIPE requires segment geometry; found ${geometryKind || 'missing'}.`)] : []),
    ...(affected.supportAttachmentIds.length ? [blocker('SUPPORTED_COMPONENT',
      affected.supportAttachmentIds, 'Mapped component carries support attachments.')] : []),
    ...(affected.boundaryCutIds.length ? [blocker('BOUNDARY_CUT_PRESENT', affected.boundaryCutIds,
      'Mapped component crosses a committed stationary boundary.')] : []),
    ...(affected.repairIds.length ? [blocker('REPAIR_MEDIATED_CONTINUITY', affected.repairIds,
      'Mapped component participates in repair-mediated continuity.')] : []),
    ...(protectedNodes.length ? [blocker('PROTECTED_ENDPOINT_BOUNDARY',
      protectedNodes.map((row) => row.nodeId), 'Mapped segment terminates at a protected boundary.')] : []),
    ...(collisions.length ? [blocker('SPLIT_POSITION_COLLISION', collisions.map((row) => row.nodeId),
      'Proposed split position collides with an existing distinct node.')] : []),
  ].sort((left, right) => left.code.localeCompare(right.code));
}
function reviewFlags(request, geometry, mapping, affected) {
  const source = request.splitGeometry; const dot = ['x', 'y', 'z']
    .reduce((sum, axis) => sum + source.displacement[axis] * geometry.displacement[axis], 0);
  return [
    ...(Math.abs(source.lengthMm - geometry.lengthMm) > 1e-6 ? ['SOURCE_LENGTH_DIFFERS'] : []),
    ...(!['x', 'y', 'z'].every((axis) => source.splitPosition[axis] === geometry.splitPosition[axis])
      ? ['SOURCE_SPLIT_POSITION_DIFFERS'] : []),
    ...(dot < 0 ? ['SOURCE_DIRECTION_REVERSED'] : []),
    ...(mapping.component.neighbourComponentIds?.length > 1 ? ['MULTIPLE_NEIGHBOUR_COMPONENTS'] : []),
    ...(affected.connectionIds.length > 1 ? ['MULTIPLE_ENDPOINT_CONNECTIONS'] : []),
  ];
}
function previewMaterial(topology, request, mapping) {
  const fraction = request.sourceCommand.payload.fraction;
  const geometry = splitGeometry(topology, mapping.edge, fraction);
  const endpoints = [nodeEvidence(topology, mapping.edge.fromNodeId, 'FROM'),
    nodeEvidence(topology, mapping.edge.toNodeId, 'TO')];
  const affected = affectedRecords(topology, mapping, endpoints);
  const blockers = impactBlockers(topology, mapping, endpoints, geometry, affected);
  return { schema: SEQUENTIAL_SPLIT_PIPE_IMPACT_PREVIEW_SCHEMA,
    requestFingerprint: request.requestFingerprint,
    topologyAuthority: { authorityId: topology.authority.authorityId,
      topologyFingerprint: topology.topologyFingerprint, geometryFingerprint: topology.geometryFingerprint,
      ancestryFingerprint: topology.ancestryFingerprint, snapshotFingerprint: topology.snapshotFingerprint },
    mapping: { validatorEdgeId: request.sourceEdge.edgeId, splitFraction: fraction,
      sequentialComponentId: mapping.componentId, sequentialGeometryPartId: mapping.geometryPartId,
      sequentialInternalEdgeId: mapping.internalEdgeId, sequentialBranchId: mapping.branchId,
      disposition: 'EXPLICIT_OPERATOR_SELECTION' },
    validatorSource: { sourceCommand: request.sourceCommand, edge: request.sourceEdge,
      splitGeometry: request.splitGeometry },
    component: mapping.component, geometryPart: mapping.part, internalEdge: mapping.edge,
    endpoints, sequentialSplitGeometry: geometry, affected, blockers,
    reviewFlags: reviewFlags(request, geometry, mapping, affected),
    impactStatus: blockers.length ? 'BLOCKED' : 'REVIEWABLE',
    candidateNativeOperation: 'SPLIT_PIPE', candidateNativeOperationIsBounded: true,
    currentNativeSplitAuthority: 'BOUNDED_ADAPTER_UNQUALIFIED',
    applicationDisposition: 'REQUIRES_QUALIFIED_STRUCTURAL_TOPOLOGY_AUTHORITY',
    publicationState: 'NOT_PUBLISHED' };
}
export function parseSequentialSplitPipeRequestText(text) {
  try { return exactRequest(JSON.parse(String(text))); }
  catch (error) {
    if (error.code) throw error;
    fail(SEQUENTIAL_SPLIT_PIPE_IMPACT_REJECTION.REQUEST_INVALID,
      `Validator split request JSON is invalid: ${error.message || String(error)}`, TypeError);
  }
}
export function createSequentialSplitPipeImpact(topologyInput, input = {}) {
  const topology = exactTopology(topologyInput); const request = exactRequest(input.request);
  const mapping = exactMapping(topology, input); assertOwnership(mapping);
  const material = previewMaterial(topology, request, mapping);
  return immutableJson({ ...material,
    previewFingerprint: sequentialSemanticFingerprint('SSKSPLITPIPEIMPACT', material) },
  'Sequential SPLIT_PIPE impact preview');
}
function sourceInvariant(source, mapping) {
  try {
    const command = source.sourceCommand || {}; const payload = command.payload || {};
    const split = source.splitGeometry || {};
    const from = finitePoint(split.fromPosition, 'Validator FROM position'); const to = finitePoint(split.toPosition, 'Validator TO position');
    const displacement = Object.fromEntries(['x', 'y', 'z'].map((axis) => [axis, to[axis] - from[axis]]));
    const lengthMm = Math.hypot(displacement.x, displacement.y, displacement.z);
    const splitPosition = Object.fromEntries(['x', 'y', 'z'].map((axis) => [axis, from[axis] + displacement[axis] * mapping.splitFraction]));
    const expected = { fraction: mapping.splitFraction, fromPosition: from, toPosition: to, displacement, lengthMm, splitPosition, leftLengthMm: lengthMm * mapping.splitFraction, rightLengthMm: lengthMm * (1 - mapping.splitFraction) };
    return command.type === 'SPLIT_EDGE' && payload.edgeId === mapping.validatorEdgeId
      && payload.fraction === mapping.splitFraction && source.edge?.edgeId === mapping.validatorEdgeId
      && sameSequentialContractValue(expected, split);
  } catch { return false; }
}
function previewInvariant(value) {
  const mapping = value.mapping || {}, component = value.component || {}, part = value.geometryPart || {}, edge = value.internalEdge || {};
  const endpoints = value.endpoints || [], geometry = value.sequentialSplitGeometry || {}, source = value.validatorSource || {}, affected = value.affected || {};
  const index = Number(edge.order); const fraction = mapping.splitFraction;
  let expected, partStart, partEnd;
  try { expected = splitGeometry({ nodes: endpoints.map((row) => row.canonicalRecord) }, edge, fraction);
    partStart = finitePoint(part.geometry?.start, 'Geometry-part start'); partEnd = finitePoint(part.geometry?.end, 'Geometry-part end'); } catch { return false; }
  return component.componentId === mapping.sequentialComponentId
    && component.branchId === mapping.sequentialBranchId
    && component.geometryPartIds?.includes(mapping.sequentialGeometryPartId)
    && component.internalEdgeIds?.includes(mapping.sequentialInternalEdgeId)
    && part.geometryPartId === mapping.sequentialGeometryPartId
    && part.componentId === mapping.sequentialComponentId
    && edge.edgeId === mapping.sequentialInternalEdgeId
    && edge.componentId === mapping.sequentialComponentId
    && edge.geometryPartId === mapping.sequentialGeometryPartId
    && Number.isInteger(index) && part.nodeIds?.[index] === edge.fromNodeId
    && part.nodeIds?.[index + 1] === edge.toNodeId
    && endpoints[0]?.nodeId === edge.fromNodeId && endpoints[1]?.nodeId === edge.toNodeId
    && sameSequentialContractValue(partStart, endpoints[0]?.position)
    && sameSequentialContractValue(partEnd, endpoints[1]?.position)
    && sameSequentialContractValue(finitePoint(endpoints[0]?.position, 'FROM evidence position'),
      finitePoint(endpoints[0]?.canonicalRecord?.position, 'Canonical FROM evidence position'))
    && sameSequentialContractValue(finitePoint(endpoints[1]?.position, 'TO evidence position'),
      finitePoint(endpoints[1]?.canonicalRecord?.position, 'Canonical TO evidence position'))
    && sameSequentialContractValue(expected, geometry) && sourceInvariant(source, mapping)
    && affected.componentIds?.includes(mapping.sequentialComponentId)
    && affected.geometryPartIds?.includes(mapping.sequentialGeometryPartId)
    && affected.internalEdgeIds?.includes(mapping.sequentialInternalEdgeId)
      && affected.branchIds?.includes(mapping.sequentialBranchId)
    && value.impactStatus === ((value.blockers || []).length ? 'BLOCKED' : 'REVIEWABLE')
    && value.candidateNativeOperation === 'SPLIT_PIPE'
    && value.candidateNativeOperationIsBounded === true
    && value.currentNativeSplitAuthority === 'BOUNDED_ADAPTER_UNQUALIFIED'
    && mapping.disposition === 'EXPLICIT_OPERATOR_SELECTION'
    && value.applicationDisposition === 'REQUIRES_QUALIFIED_STRUCTURAL_TOPOLOGY_AUTHORITY'
    && value.publicationState === 'NOT_PUBLISHED';
}
export function assertSequentialSplitPipeImpact(value) {
  if (value?.schema !== SEQUENTIAL_SPLIT_PIPE_IMPACT_PREVIEW_SCHEMA) fail(
    SEQUENTIAL_SPLIT_PIPE_IMPACT_REJECTION.PREVIEW_INVALID,
    `Split preview must use ${SEQUENTIAL_SPLIT_PIPE_IMPACT_PREVIEW_SCHEMA}.`, TypeError);
  const material = { ...value }; delete material.previewFingerprint;
  if (!previewInvariant(value) || !sameSequentialContractValue(value.previewFingerprint,
    sequentialSemanticFingerprint('SSKSPLITPIPEIMPACT', material))) fail(
    SEQUENTIAL_SPLIT_PIPE_IMPACT_REJECTION.PREVIEW_INVALID,
    'Split preview differs from immutable structural-topology authority evidence.');
  immutableJson(value, 'Sequential SPLIT_PIPE impact preview'); return value;
}
export function validateSequentialSplitPipeImpact(value, topology, input = {}) {
  const preview = assertSequentialSplitPipeImpact(value);
  const rebuilt = createSequentialSplitPipeImpact(topology, input);
  if (!sameSequentialContractValue(preview, rebuilt)) fail(
    SEQUENTIAL_SPLIT_PIPE_IMPACT_REJECTION.PREVIEW_INVALID,
    'Split preview differs from current topology regeneration.');
  return rebuilt;
}
