import {
  createPipelineGreBendAbortedMaterializationPlan,
  createPipelineGreBendMaterializationDiagnostic,
  createPipelineGreBendMaterializationPlan,
  createPipelineGreBendMaterializedModel,
} from './pipeline-3d-model-gre-bend-materialization-contracts.js';
import { indexPipelineGreBendNodeAllocations,
  resolvePipelineGreBendNodeAllocationPlan } from './pipeline-3d-model-gre-bend-node-allocation.js';
import { buildPipelineGreBendCandidateLineage, buildPipelineGreBendElementLineage,
  validatePipelineGreBendMaterializedTopology,
  validatePipelineGreBendSharedSegments } from './pipeline-3d-model-gre-bend-lineage.js';
import { buildPipelineGreBendMaterializedRoute, findPipelineGreSectionOwner,
  isFinitePipelineGrePoint, PIPELINE_GRE_BEND_MATERIALIZATION_EPSILON_MM as EPSILON_MM,
  pipelineGreMaterializationDistance as distance } from './pipeline-3d-model-gre-bend-materialized-route.js';

const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const text = (value) => typeof value === 'string' ? value.trim() : '';
const plain = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const diagnostic = (code, message, details = {}) =>
  createPipelineGreBendMaterializationDiagnostic(code, message, details);
function authenticate(input, errors) {
  const geometry = input.greBendGeometryPlan, bend = input.bendResolution, routing = input.sectionProfileRoutingPlan;
  const geometryValid = plain(geometry) && geometry.schema === 'PipelineGreBendGeometryPlan.v1'
    && geometry.ready === true && Array.isArray(geometry.candidatePlans)
    && Array.isArray(geometry.blockerCodes) && geometry.blockerCodes.length === 0
    && Array.isArray(geometry.sharedSegmentConflicts) && geometry.sharedSegmentConflicts.length === 0
    && geometry.bendResolutionSchema === 'PipelineBendResolution.v3'
    && geometry.sectionProfileRoutingPlanSchema === 'PipelineSectionProfileRoutingPlan.v1'
    && geometry.greVendorSeriesPlanSchema === 'PipelineGreVendorSeriesPlan.v1';
  const bendValid = plain(bend) && bend.schema === 'PipelineBendResolution.v3'
    && Array.isArray(bend.candidates) && Array.isArray(bend.geometryRows);
  const routingValid = plain(routing) && routing.schema === 'PipelineSectionProfileRoutingPlan.v1'
    && routing.ready === true && Array.isArray(routing.candidateOwnership)
    && Array.isArray(routing.analysisSections) && Array.isArray(routing.blockerCodes)
    && routing.blockerCodes.length === 0;
  if (!geometryValid) errors.push(diagnostic('PIPELINE_GRE_BEND_MATERIALIZATION_GEOMETRY_PLAN_INVALID',
    'One ready blocker-free GRE bend geometry plan is required.'));
  if (!bendValid) errors.push(diagnostic('PIPELINE_GRE_BEND_MATERIALIZATION_INPUT_INVALID',
    'Canonical PipelineBendResolution.v3 evidence is required.'));
  if (!routingValid) errors.push(diagnostic('PIPELINE_GRE_BEND_MATERIALIZATION_OWNERSHIP_INVALID',
    'One ready blocker-free section-profile routing plan is required.'));
  return { geometry: geometryValid ? geometry : { candidatePlans: [], notApplicableCandidateIds: [] },
    bend: bendValid ? bend : { candidates: [], geometryRows: [] },
    routing: routingValid ? routing : { candidateOwnership: [], analysisSections: [] } };
}
function uniqueIndex(items, key, code, errors) {
  const result = Object.create(null);
  for (const item of items) {
    const id = text(item?.[key]);
    if (!id || result[id]) errors.push(diagnostic(code, 'Upstream identities must be unique.', { identity: id }));
    else result[id] = item;
  }
  return result;
}
function sameNumber(left, right) { return finite(left) && finite(right) && Math.abs(left - right) <= EPSILON_MM; }
function pointOnSegment(value, start, end, expected, errors, candidateId, role) {
  if (!isFinitePipelineGrePoint(value) || !isFinitePipelineGrePoint(start) || !isFinitePipelineGrePoint(end)) {
    errors.push(diagnostic('PIPELINE_GRE_BEND_MATERIALIZATION_CANDIDATE_INVALID',
      'Materialization points and source rows must contain finite coordinates.', { candidateId, role }));
    return;
  }
  const length = distance(start, end), along = distance(start, value), remainder = distance(value, end);
  if (!sameNumber(along, expected) || Math.abs(along + remainder - length) > EPSILON_MM) errors.push(diagnostic(
    'PIPELINE_GRE_BEND_MATERIALIZATION_POINT_ORDER_INVALID',
    'Authenticated break or tangency point is not on its owning source element.',
    { candidateId, role, expectedDistanceMm: expected, actualDistanceMm: along }));
}
function candidateContext(candidate, bendIndex, ownerIndex, rows, sections, allocations, errors) {
  const id = text(candidate.candidateId), bend = bendIndex[id], owner = ownerIndex[id];
  const incoming = candidate.incomingElementIndex, outgoing = candidate.outgoingElementIndex;
  if (!bend || text(bend.id) !== id || bend.incomingElementIndex !== incoming
    || bend.outgoingElementIndex !== outgoing || outgoing !== incoming + 1
    || candidate.incomingElementId !== `E${incoming + 1}` || candidate.outgoingElementId !== `E${outgoing + 1}`
    || bend.previousNode !== candidate.previousNode || bend.cornerNode !== candidate.cornerNode
    || bend.nextNode !== candidate.nextNode || !sameNumber(bend.turnAngleDeg, candidate.turnAngleDeg)
    || !sameNumber(bend.radiusMm, candidate.bendRadiusMm) || !sameNumber(bend.tangentMm, candidate.tangentLengthMm))
    errors.push(diagnostic('PIPELINE_GRE_BEND_MATERIALIZATION_CANDIDATE_INVALID',
      'Geometry-plan candidate identity must exactly match PipelineBendResolution.v3.', { candidateId: id }));
  const incomingOwner = findPipelineGreSectionOwner(sections, incoming);
  const outgoingOwner = findPipelineGreSectionOwner(sections, outgoing);
  if (!owner || owner.ready !== true || (owner.blockerCodes || []).length || owner.profileId !== 'gre'
    || owner.analysisSectionId !== candidate.analysisSectionId) errors.push(diagnostic(
    'PIPELINE_GRE_BEND_MATERIALIZATION_OWNERSHIP_INVALID',
    'Candidate requires exact ready GRE routing ownership.', { candidateId: id }));
  if (incomingOwner?.analysisSectionId !== candidate.analysisSectionId
    || outgoingOwner?.analysisSectionId !== candidate.analysisSectionId) errors.push(diagnostic(
    'PIPELINE_GRE_BEND_MATERIALIZATION_SECTION_BOUNDARY_CONFLICT',
    'A GRE bend candidate cannot cross a canonical analysis-section boundary.', { candidateId: id }));
  if (candidate.status !== 'PLANNED' || candidate.ready !== true || (candidate.blockerCodes || []).length
    || (candidate.diagnostics || []).some((item) => item?.severity === 'BLOCKING') || candidate.profileId !== 'gre'
    || candidate.geometryFits !== true || candidate.breakEnvelopeFits !== true || candidate.sharedSegmentFits !== true)
    errors.push(diagnostic('PIPELINE_GRE_BEND_MATERIALIZATION_CANDIDATE_INVALID',
      'Only ready PLANNED GRE geometry candidates may be materialized.', { candidateId: id }));
  if (!text(candidate.vendorId) || !text(candidate.seriesId) || !text(candidate.qualificationEvidenceId)
    || !text(candidate.sourceAuthority) || !text(candidate.sourceReference)) errors.push(diagnostic(
    'PIPELINE_GRE_BEND_MATERIALIZATION_VENDOR_IDENTITY_CONFLICT',
    'Qualified section-local GRE vendor identity and provenance are required.', { candidateId: id }));
  if (!['EACH_LEG_FROM_CORNER', 'EACH_LEG_FROM_TANGENCY'].includes(candidate.bendBreakLengthApplication))
    errors.push(diagnostic('PIPELINE_GRE_BEND_MATERIALIZATION_BREAK_APPLICATION_INVALID',
      'Break-length application must be authenticated by the geometry plan.', { candidateId: id }));
  const previous = rows[incoming], corner = rows[outgoing], next = rows[outgoing + 1];
  if (previous?.nodeNumber !== candidate.previousNode || corner?.nodeNumber !== candidate.cornerNode
    || next?.nodeNumber !== candidate.nextNode) errors.push(diagnostic(
    'PIPELINE_GRE_BEND_MATERIALIZATION_CANDIDATE_INVALID',
    'Candidate node identities must exactly match canonical geometry rows.', { candidateId: id }));
  const incomingLength = isFinitePipelineGrePoint(previous) && isFinitePipelineGrePoint(corner)
    ? distance(previous, corner) : NaN;
  const outgoingLength = isFinitePipelineGrePoint(corner) && isFinitePipelineGrePoint(next)
    ? distance(corner, next) : NaN;
  const tangent = candidate.tangentLengthMm, inBreak = candidate.incomingBreakDistanceFromCornerMm;
  const outBreak = candidate.outgoingBreakDistanceFromCornerMm;
  if (![incomingLength, outgoingLength, tangent, inBreak, outBreak].every(finite)
    || inBreak + EPSILON_MM < tangent || outBreak + EPSILON_MM < tangent) errors.push(diagnostic(
    'PIPELINE_GRE_BEND_MATERIALIZATION_POINT_ORDER_INVALID',
    'Break points must not fall between tangency and the inactive corner.', { candidateId: id }));
  pointOnSegment(candidate.incomingBreakPoint, previous, corner, incomingLength - inBreak, errors, id, 'GRE_INCOMING_BREAK');
  pointOnSegment(candidate.incomingTangencyPoint, previous, corner, incomingLength - tangent, errors, id, 'GRE_INCOMING_TANGENCY');
  pointOnSegment(candidate.outgoingTangencyPoint, corner, next, tangent, errors, id, 'GRE_OUTGOING_TANGENCY');
  pointOnSegment(candidate.outgoingBreakPoint, corner, next, outBreak, errors, id, 'GRE_OUTGOING_BREAK');
  const roles = ['GRE_INCOMING_BREAK', 'GRE_INCOMING_TANGENCY', 'GRE_OUTGOING_TANGENCY', 'GRE_OUTGOING_BREAK'];
  const roleAllocations = Object.fromEntries(roles.map((role) => [role, allocations[`${id}:${role}`]]));
  if (Object.values(roleAllocations).some((item) => !item)) errors.push(diagnostic(
    'PIPELINE_GRE_BEND_MATERIALIZATION_NODE_ALLOCATION_CONFLICT',
    'Every GRE candidate requires four authenticated inserted-node allocations.', { candidateId: id }));
  return { candidate, bend, owner, previous, corner, next, incomingLength, outgoingLength,
    allocations: roleAllocations };
}
function aborted(source, nodeAllocationPlan, errors, coverage = {}) {
  return createPipelineGreBendAbortedMaterializationPlan({
    sourceGeometryPlanSchema: text(source.geometry.schema), sourceBendResolutionSchema: text(source.bend.schema),
    sourceRoutingPlanSchema: text(source.routing.schema), nodeAllocationPlan,
    notApplicableCandidateIds: source.geometry.notApplicableCandidateIds, coverage }, errors);
}
function verifyCoverage(source, candidates, ownerIndex, errors) {
  for (const id of source.geometry.notApplicableCandidateIds || [])
    if (!['normal-metallic', 'asme-b31.4'].includes(ownerIndex[id]?.profileId)) errors.push(diagnostic(
      'PIPELINE_GRE_BEND_MATERIALIZATION_OWNERSHIP_INVALID',
      'Not-applicable candidates require exact metallic profile ownership.', { candidateId: id }));
  const covered = new Set([...candidates.map((item) => item.candidateId),
    ...(source.geometry.notApplicableCandidateIds || [])]);
  if (covered.size !== source.bend.candidates.length
    || source.bend.candidates.some((item) => !covered.has(item.id))) errors.push(diagnostic(
    'PIPELINE_GRE_BEND_MATERIALIZATION_COVERAGE_INVALID',
    'Every bend candidate must be applied once or declared not applicable.',
    { bendCandidateCount: source.bend.candidates.length, coveredCandidateCount: covered.size }));
}
export function resolvePipelineGreBendMaterializationPlan(input = {}) {
  const errors = [], source = authenticate(plain(input) ? input : {}, errors);
  const bendIndex = uniqueIndex(source.bend.candidates, 'id',
    'PIPELINE_GRE_BEND_MATERIALIZATION_CANDIDATE_INVALID', errors);
  const ownerIndex = uniqueIndex(source.routing.candidateOwnership, 'candidateId',
    'PIPELINE_GRE_BEND_MATERIALIZATION_OWNERSHIP_INVALID', errors);
  const nodeAllocationPlan = resolvePipelineGreBendNodeAllocationPlan({ greBendGeometryPlan: source.geometry,
    bendResolution: source.bend, nodeAllocationPolicy: input?.nodeAllocationPolicy });
  errors.push(...nodeAllocationPlan.diagnostics);
  const allocations = indexPipelineGreBendNodeAllocations(nodeAllocationPlan);
  const candidates = [...source.geometry.candidatePlans].sort((a, b) =>
    a.incomingElementIndex - b.incomingElementIndex || compare(a.candidateId, b.candidateId));
  const contexts = candidates.map((candidate) => candidateContext(candidate, bendIndex, ownerIndex,
    source.bend.geometryRows, source.routing.analysisSections, allocations, errors));
  errors.push(...validatePipelineGreBendSharedSegments(contexts).diagnostics);
  verifyCoverage(source, candidates, ownerIndex, errors);
  if (errors.length) return aborted(source, nodeAllocationPlan, errors);
  const addError = (code, message, details) => errors.push(diagnostic(code, message, details));
  const route = buildPipelineGreBendMaterializedRoute({ rows: source.bend.geometryRows,
    sections: source.routing.analysisSections, contexts, addError });
  if (errors.length) return aborted(source, nodeAllocationPlan, errors);
  const elementEvidence = buildPipelineGreBendElementLineage({ sourceRows: source.bend.geometryRows,
    materializedElements: route.elements });
  const roleOrder = ['GRE_INCOMING_BREAK', 'GRE_INCOMING_TANGENCY',
    'GRE_OUTGOING_TANGENCY', 'GRE_OUTGOING_BREAK'];
  const candidateContexts = route.bends.map((item) => ({ candidate: item.context.candidate,
    insertedNodeIds: roleOrder.map((role) => item.context.allocations[role].materializedNodeId),
    bendElementId: item.element.materializedElementId, bendComponentId: item.componentId,
    inactiveCornerReferenceId: item.inactive,
    successorElementIds: route.elements.filter((element) =>
      element.candidateId === item.context.candidate.candidateId).map((element) => element.materializedElementId) }));
  const candidateEvidence = buildPipelineGreBendCandidateLineage(candidateContexts);
  const topology = validatePipelineGreBendMaterializedTopology({ nodes: route.nodes,
    elements: route.elements, components: route.components });
  errors.push(...elementEvidence.diagnostics, ...candidateEvidence.diagnostics, ...topology.diagnostics);
  const coverage = { sourceNodeCount: source.bend.geometryRows.length, originalNodeCount: route.original.length,
    insertedNodeCount: route.inserted.length, sourceElementCount: Math.max(0, source.bend.geometryRows.length - 1),
    materializedElementCount: route.elements.length, appliedCandidateCount: contexts.length,
    notApplicableCandidateCount: (source.geometry.notApplicableCandidateIds || []).length,
    inactiveCornerCount: route.bends.length, coveredSourceElementCount: elementEvidence.coveredSourceElementCount,
    coveredSuccessorElementCount: elementEvidence.coveredSuccessorElementCount };
  if (coverage.insertedNodeCount !== contexts.length * 4 || coverage.inactiveCornerCount !== contexts.length
    || coverage.coveredSourceElementCount !== coverage.sourceElementCount
    || coverage.coveredSuccessorElementCount !== coverage.materializedElementCount) errors.push(diagnostic(
    'PIPELINE_GRE_BEND_MATERIALIZATION_COVERAGE_INVALID',
    'Materialized topology coverage is incomplete.', coverage));
  const model = createPipelineGreBendMaterializedModel({
    serializationNormalization: route.serializationNormalization, sourceRows: source.bend.geometryRows,
    nodes: Object.freeze(route.nodes), elements: Object.freeze(route.elements),
    bendComponents: Object.freeze(route.components),
    inactiveCornerReferences: Object.freeze(route.bends.map((item) => item.inactive)),
    sourceAuthority: 'PIPELINE_GRE_BEND_GEOMETRY_PLAN', sourceReference: text(source.geometry.schema) }, errors);
  errors.push(...model.diagnostics);
  if (errors.length) return aborted(source, nodeAllocationPlan, errors, coverage);
  return createPipelineGreBendMaterializationPlan({ sourceGeometryPlanSchema: text(source.geometry.schema),
    sourceBendResolutionSchema: text(source.bend.schema), sourceRoutingPlanSchema: text(source.routing.schema),
    nodeAllocationPlan, materializedModel: model, candidateLineage: candidateEvidence.candidateLineage,
    elementLineage: elementEvidence.elementLineage,
    appliedCandidateIds: Object.freeze(contexts.map((item) => item.candidate.candidateId)),
    notApplicableCandidateIds: Object.freeze([...(source.geometry.notApplicableCandidateIds || [])].sort(compare)),
    inactiveCornerReferences: model.inactiveCornerReferences, coverage });
}
