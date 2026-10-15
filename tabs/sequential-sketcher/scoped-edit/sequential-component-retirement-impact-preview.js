/** Immutable whole-component retirement-impact preview for an explicit Sequential mapping. */
import { immutableJson } from '../../../contracts/contract-values.js';
import { assertTopologySequentialDeleteEdgeRequest } from '../../topology-trace-validator/topology-sequential-delete-edge-request.js';
import { sameSequentialContractValue, sequentialSemanticFingerprint } from './sequential-command-contracts.js';
import {
  collectSequentialComponentRetirementEvidence,
  createSequentialRetirementAffectedIds,
  createSequentialRetirementAnchorGeometry,
  createSequentialRetirementBlockers,
  createSequentialRetirementReviewFlags,
  validateSequentialRetirementEvidence,
} from './sequential-component-retirement-impact-evidence.js';

export const SEQUENTIAL_COMPONENT_RETIREMENT_IMPACT_PREVIEW_SCHEMA =
  'SequentialComponentRetirementImpactPreview.v1';
export const SEQUENTIAL_COMPONENT_RETIREMENT_IMPACT_REJECTION = Object.freeze({
  REQUEST_INVALID: 'SEQUENTIAL_COMPONENT_RETIREMENT_REQUEST_INVALID',
  TOPOLOGY_INVALID: 'SEQUENTIAL_COMPONENT_RETIREMENT_TOPOLOGY_INVALID',
  EXPLICIT_IDENTITY_REQUIRED: 'SEQUENTIAL_COMPONENT_RETIREMENT_EXPLICIT_IDENTITY_REQUIRED',
  COMPONENT_MISSING: 'SEQUENTIAL_COMPONENT_RETIREMENT_COMPONENT_MISSING',
  GEOMETRY_PART_MISSING: 'SEQUENTIAL_COMPONENT_RETIREMENT_GEOMETRY_PART_MISSING',
  INTERNAL_EDGE_MISSING: 'SEQUENTIAL_COMPONENT_RETIREMENT_INTERNAL_EDGE_MISSING',
  BRANCH_MISSING: 'SEQUENTIAL_COMPONENT_RETIREMENT_BRANCH_MISSING',
  OWNERSHIP_INVALID: 'SEQUENTIAL_COMPONENT_RETIREMENT_OWNERSHIP_INVALID',
  PREVIEW_INVALID: 'SEQUENTIAL_COMPONENT_RETIREMENT_PREVIEW_INVALID',
});
function fail(code, message, Constructor = RangeError) {
  const error = new Constructor(message); error.code = code; throw error;
}
function requiredText(value, label) {
  const result = String(value ?? '').trim();
  if (!result) fail(SEQUENTIAL_COMPONENT_RETIREMENT_IMPACT_REJECTION.EXPLICIT_IDENTITY_REQUIRED,
    `${label} is required.`, TypeError);
  return result;
}
function exactRequest(value) {
  try {
    const request = assertTopologySequentialDeleteEdgeRequest(value);
    const intent = request.sequentialIntent;
    if (intent?.candidateNativeOperation !== null
      || intent?.currentNativeRetirementAuthority !== 'UNAVAILABLE'
      || intent?.retirementQualificationScope !== 'WHOLE_COMPONENT_ONLY'
      || intent?.automaticIdentityMapping !== false) {
      throw new TypeError('Request retirement authority is invalid.');
    }
    return request;
  } catch (error) {
    fail(SEQUENTIAL_COMPONENT_RETIREMENT_IMPACT_REJECTION.REQUEST_INVALID,
      `Validator retirement request is invalid: ${error.message || String(error)}`, TypeError);
  }
}
function exactTopology(value) {
  if (value?.schema !== 'SequentialEditableTopologySnapshot.v1') fail(
    SEQUENTIAL_COMPONENT_RETIREMENT_IMPACT_REJECTION.TOPOLOGY_INVALID,
    'Retirement impact requires SequentialEditableTopologySnapshot.v1.', TypeError);
  return value;
}
function exactRow(rows, key, id, label, code) {
  const row = (Array.isArray(rows) ? rows : []).find((item) => item[key] === id);
  if (!row) fail(code, `${label} is unavailable in current Sequential topology: ${id}`);
  return row;
}
function exactMapping(topology, input) {
  const componentId = requiredText(input.sequentialComponentId, 'sequentialComponentId');
  const geometryPartId = requiredText(input.sequentialGeometryPartId, 'sequentialGeometryPartId');
  const internalEdgeId = requiredText(input.sequentialInternalEdgeId, 'sequentialInternalEdgeId');
  const branchId = requiredText(input.sequentialBranchId, 'sequentialBranchId');
  const component = exactRow(topology.components, 'componentId', componentId, 'Component',
    SEQUENTIAL_COMPONENT_RETIREMENT_IMPACT_REJECTION.COMPONENT_MISSING);
  const part = exactRow(topology.geometryParts, 'geometryPartId', geometryPartId, 'Geometry part',
    SEQUENTIAL_COMPONENT_RETIREMENT_IMPACT_REJECTION.GEOMETRY_PART_MISSING);
  const edge = exactRow(topology.internalEdges, 'edgeId', internalEdgeId, 'Internal edge',
    SEQUENTIAL_COMPONENT_RETIREMENT_IMPACT_REJECTION.INTERNAL_EDGE_MISSING);
  if (!(topology.branch?.branchIds || []).includes(branchId)) fail(
    SEQUENTIAL_COMPONENT_RETIREMENT_IMPACT_REJECTION.BRANCH_MISSING,
    `Branch is unavailable in current Sequential topology: ${branchId}`);
  return { componentId, geometryPartId, internalEdgeId, branchId, component, part, edge };
}
function assertOwnership(mapping) {
  const { component, part, edge } = mapping, order = Number(edge.order);
  if (component.branchId !== mapping.branchId || part.componentId !== mapping.componentId
    || edge.componentId !== mapping.componentId || edge.geometryPartId !== mapping.geometryPartId
    || !component.geometryPartIds.includes(mapping.geometryPartId)
    || !component.internalEdgeIds.includes(mapping.internalEdgeId)
    || !Number.isInteger(order) || part.nodeIds?.[order] !== edge.fromNodeId
    || part.nodeIds?.[order + 1] !== edge.toNodeId) fail(
    SEQUENTIAL_COMPONENT_RETIREMENT_IMPACT_REJECTION.OWNERSHIP_INVALID,
    'Explicit retirement mapping does not preserve component, part, edge, branch and endpoint ownership.');
}
function validatorSource(request) {
  return { sourceCommand: request.sourceCommand, edge: request.sourceEdge,
    fromEndpoint: request.fromEndpoint, toEndpoint: request.toEndpoint,
    retirementGeometry: request.retirementGeometry };
}
function previewMaterial(topology, request, mapping) {
  const wholeComponent = collectSequentialComponentRetirementEvidence(topology, mapping);
  const anchorGeometry = createSequentialRetirementAnchorGeometry(topology, mapping);
  const affected = createSequentialRetirementAffectedIds(mapping, wholeComponent);
  const blockers = createSequentialRetirementBlockers(mapping, wholeComponent);
  return { schema: SEQUENTIAL_COMPONENT_RETIREMENT_IMPACT_PREVIEW_SCHEMA,
    requestFingerprint: request.requestFingerprint,
    topologyAuthority: { authorityId: topology.authority.authorityId,
      topologyFingerprint: topology.topologyFingerprint,
      geometryFingerprint: topology.geometryFingerprint,
      ancestryFingerprint: topology.ancestryFingerprint,
      snapshotFingerprint: topology.snapshotFingerprint },
    mapping: { validatorEdgeId: request.sourceEdge.edgeId,
      sequentialComponentId: mapping.componentId,
      sequentialGeometryPartId: mapping.geometryPartId,
      sequentialInternalEdgeId: mapping.internalEdgeId,
      sequentialBranchId: mapping.branchId,
      disposition: 'EXPLICIT_OPERATOR_SELECTION', retirementScope: 'WHOLE_COMPONENT_ONLY' },
    validatorRequest: request, validatorSource: validatorSource(request),
    component: mapping.component, anchorGeometryPart: mapping.part,
    anchorInternalEdge: mapping.edge, anchorGeometry, wholeComponent, affected, blockers,
    reviewFlags: createSequentialRetirementReviewFlags(
      request, anchorGeometry, mapping, wholeComponent),
    impactStatus: blockers.length ? 'BLOCKED' : 'REVIEWABLE',
    candidateNativeOperation: null,
    currentNativeRetirementAuthority: 'UNAVAILABLE',
    retirementQualificationScope: 'WHOLE_COMPONENT_ONLY',
    applicationDisposition: 'REQUIRES_QUALIFIED_STRUCTURAL_RETIREMENT_AUTHORITY',
    publicationState: 'NOT_PUBLISHED' };
}
export function parseSequentialComponentRetirementRequestText(text) {
  try { return exactRequest(JSON.parse(String(text))); }
  catch (error) {
    if (error.code) throw error;
    fail(SEQUENTIAL_COMPONENT_RETIREMENT_IMPACT_REJECTION.REQUEST_INVALID,
      `Validator retirement request JSON is invalid: ${error.message || String(error)}`, TypeError);
  }
}
export function createSequentialComponentRetirementImpact(topologyInput, input = {}) {
  const topology = exactTopology(topologyInput), request = exactRequest(input.request);
  const mapping = exactMapping(topology, input); assertOwnership(mapping);
  const material = previewMaterial(topology, request, mapping);
  return immutableJson({ ...material, previewFingerprint: sequentialSemanticFingerprint(
    'SSKCOMPONENTRETIREMENTIMPACT', material) },
  'Sequential component retirement impact preview');
}
function previewInvariant(value) {
  const mappingValue = value.mapping || {};
  const component = value.component || {}, part = value.anchorGeometryPart || {};
  const edge = value.anchorInternalEdge || {}, evidence = value.wholeComponent || {};
  const mapping = { componentId: mappingValue.sequentialComponentId,
    geometryPartId: mappingValue.sequentialGeometryPartId,
    internalEdgeId: mappingValue.sequentialInternalEdgeId,
    branchId: mappingValue.sequentialBranchId, component, part, edge };
  let request, expected, blockers, flags, evidenceValid;
  try {
    request = exactRequest(value.validatorRequest); assertOwnership(mapping);
    expected = createSequentialRetirementAnchorGeometry({ nodes: evidence.nodes }, mapping);
    evidenceValid = validateSequentialRetirementEvidence(mapping, evidence, value.affected || {});
    blockers = createSequentialRetirementBlockers(mapping, evidence);
    flags = createSequentialRetirementReviewFlags(request, expected, mapping, evidence);
  } catch { return false; }
  return value.requestFingerprint === request.requestFingerprint
    && mappingValue.validatorEdgeId === request.sourceEdge.edgeId
    && mappingValue.disposition === 'EXPLICIT_OPERATOR_SELECTION'
    && mappingValue.retirementScope === 'WHOLE_COMPONENT_ONLY'
    && sameSequentialContractValue(value.validatorSource, validatorSource(request))
    && evidenceValid
    && sameSequentialContractValue(expected, value.anchorGeometry)
    && sameSequentialContractValue(blockers, value.blockers)
    && sameSequentialContractValue(flags, value.reviewFlags)
    && value.impactStatus === (blockers.length ? 'BLOCKED' : 'REVIEWABLE')
    && value.candidateNativeOperation === null
    && value.currentNativeRetirementAuthority === 'UNAVAILABLE'
    && value.retirementQualificationScope === 'WHOLE_COMPONENT_ONLY'
    && value.applicationDisposition === 'REQUIRES_QUALIFIED_STRUCTURAL_RETIREMENT_AUTHORITY'
    && value.publicationState === 'NOT_PUBLISHED';
}
export function assertSequentialComponentRetirementImpact(value) {
  if (value?.schema !== SEQUENTIAL_COMPONENT_RETIREMENT_IMPACT_PREVIEW_SCHEMA) fail(
    SEQUENTIAL_COMPONENT_RETIREMENT_IMPACT_REJECTION.PREVIEW_INVALID,
    `Retirement preview must use ${SEQUENTIAL_COMPONENT_RETIREMENT_IMPACT_PREVIEW_SCHEMA}.`,
    TypeError);
  const material = { ...value }; delete material.previewFingerprint;
  if (!previewInvariant(value) || !sameSequentialContractValue(value.previewFingerprint,
    sequentialSemanticFingerprint('SSKCOMPONENTRETIREMENTIMPACT', material))) fail(
    SEQUENTIAL_COMPONENT_RETIREMENT_IMPACT_REJECTION.PREVIEW_INVALID,
    'Retirement preview differs from immutable structural-retirement authority evidence.');
  immutableJson(value, 'Sequential component retirement impact preview'); return value;
}
export function validateSequentialComponentRetirementImpact(value, topology, input = {}) {
  const preview = assertSequentialComponentRetirementImpact(value);
  const rebuilt = createSequentialComponentRetirementImpact(topology, input);
  if (!sameSequentialContractValue(preview, rebuilt)) fail(
    SEQUENTIAL_COMPONENT_RETIREMENT_IMPACT_REJECTION.PREVIEW_INVALID,
    'Retirement preview differs from current topology regeneration.');
  return rebuilt;
}
