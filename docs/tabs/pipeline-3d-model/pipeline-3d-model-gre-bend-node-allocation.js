import {
  PIPELINE_GRE_BEND_INSERTED_NODE_ORDER,
  createPipelineGreBendMaterializationDiagnostic,
  createPipelineGreBendNodeAllocation,
  createPipelineGreBendNodeAllocationPlan,
  createPipelineGreBendNodeAllocationPolicy,
  freezePipelineGreMaterializationValue,
} from './pipeline-3d-model-gre-bend-materialization-contracts.js';

const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const text = (value) => typeof value === 'string' ? value.trim() : '';
const plain = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const diagnostic = (code, message, details = {}) => createPipelineGreBendMaterializationDiagnostic(code, message, details);

function upstreamErrors(geometryPlan, bendResolution) {
  const errors = [];
  const geometryValid = plain(geometryPlan) && geometryPlan.schema === 'PipelineGreBendGeometryPlan.v1'
    && geometryPlan.ready === true && Array.isArray(geometryPlan.candidatePlans)
    && Array.isArray(geometryPlan.blockerCodes) && geometryPlan.blockerCodes.length === 0;
  if (!geometryValid) errors.push(diagnostic('PIPELINE_GRE_BEND_MATERIALIZATION_GEOMETRY_PLAN_INVALID',
    'One ready blocker-free PipelineGreBendGeometryPlan.v1 is required.'));
  const bendValid = plain(bendResolution) && bendResolution.schema === 'PipelineBendResolution.v3'
    && Array.isArray(bendResolution.geometryRows);
  if (!bendValid) errors.push(diagnostic('PIPELINE_GRE_BEND_MATERIALIZATION_INPUT_INVALID',
    'PipelineBendResolution.v3 geometry rows are required for original-node preservation.'));
  return { errors, geometryValid, bendValid };
}
function originalNumbers(rows, errors) {
  const values = (Array.isArray(rows) ? rows : []).map((row) => row?.nodeNumber);
  if (values.some((value) => !Number.isSafeInteger(value)) || new Set(values).size !== values.length) errors.push(
    diagnostic('PIPELINE_GRE_BEND_MATERIALIZATION_NODE_ALLOCATION_CONFLICT',
      'Original geometry rows require unique safe-integer node numbers.'));
  return values.filter(Number.isSafeInteger).sort((a, b) => a - b);
}
function sameNumbers(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
function policyEvidence(input, actual, errors) {
  if (!plain(input)) {
    errors.push(diagnostic('PIPELINE_GRE_BEND_NODE_ALLOCATION_POLICY_UNRESOLVED',
      'Explicit GRE inserted-node allocation policy evidence is required.'));
  }
  const policy = createPipelineGreBendNodeAllocationPolicy(plain(input) ? input : {});
  errors.push(...policy.diagnostics);
  if (policy.ready && !sameNumbers(policy.originalNodeNumbers, actual)) errors.push(diagnostic(
    'PIPELINE_GRE_BEND_MATERIALIZATION_NODE_POLICY_INVALID',
    'Allocation policy original-node evidence must exactly match canonical geometry rows.',
    { policyOriginalNodeNumbers: policy.originalNodeNumbers, actualOriginalNodeNumbers: actual }));
  if (policy.ready && policy.reservedNodeNumbers.some((value) => actual.includes(value))) errors.push(diagnostic(
    'PIPELINE_GRE_BEND_MATERIALIZATION_NODE_POLICY_INVALID',
    'Reserved node numbers must be disjoint from original node numbers.'));
  return policy;
}
function orderedCandidates(plan, errors) {
  const candidates = [...(plan?.candidatePlans || [])].sort((a, b) =>
    a.incomingElementIndex - b.incomingElementIndex || compare(text(a.candidateId), text(b.candidateId)));
  const ids = candidates.map((item) => text(item.candidateId));
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length || candidates.some((item) =>
    item.status !== 'PLANNED' || item.ready !== true || item.profileId !== 'gre')) errors.push(diagnostic(
    'PIPELINE_GRE_BEND_MATERIALIZATION_CANDIDATE_INVALID',
    'Allocation consumes unique ready PLANNED GRE candidates only.'));
  return candidates;
}
function allocateNumber(used, start, step) {
  let candidate = start;
  while (used.has(candidate) && Number.isSafeInteger(candidate)) candidate += step;
  if (!Number.isSafeInteger(candidate) || candidate <= 0) return null;
  used.add(candidate);
  return candidate;
}
function allocations(candidates, policy, original, errors) {
  if (!policy.ready || errors.length) return [];
  const used = new Set([...original, ...policy.reservedNodeNumbers]);
  const result = [];
  let next = policy.allocationStart;
  for (const candidate of candidates) {
    for (const nodeRole of PIPELINE_GRE_BEND_INSERTED_NODE_ORDER) {
      const nodeNumber = allocateNumber(used, next, policy.nodeStep);
      if (nodeNumber === null) {
        errors.push(diagnostic('PIPELINE_GRE_BEND_MATERIALIZATION_NODE_ALLOCATION_CONFLICT',
          'Deterministic inserted-node allocation exhausted safe integer space.',
          { candidateId: candidate.candidateId, nodeRole }));
        return [];
      }
      next = nodeNumber + policy.nodeStep;
      result.push(createPipelineGreBendNodeAllocation({ candidateId: candidate.candidateId, nodeRole,
        materializedNodeId: `gre-node:${candidate.candidateId}:${nodeRole}`, nodeNumber,
        policyId: policy.policyId, sourceAuthority: policy.sourceAuthority,
        sourceReference: `${policy.sourceReference}:${candidate.candidateId}:${nodeRole}` }));
    }
  }
  return result;
}
export function resolvePipelineGreBendNodeAllocationPlan({
  greBendGeometryPlan = null,
  bendResolution = null,
  nodeAllocationPolicy = null,
} = {}) {
  const auth = upstreamErrors(greBendGeometryPlan, bendResolution), errors = [...auth.errors];
  const originalNodeNumbers = originalNumbers(bendResolution?.geometryRows, errors);
  const candidates = auth.geometryValid ? orderedCandidates(greBendGeometryPlan, errors) : [];
  const policy = candidates.length ? policyEvidence(nodeAllocationPolicy, originalNodeNumbers, errors) : null;
  const resolved = candidates.length ? allocations(candidates, policy, originalNodeNumbers, errors) : [];
  if (resolved.length !== candidates.length * PIPELINE_GRE_BEND_INSERTED_NODE_ORDER.length) errors.push(
    diagnostic('PIPELINE_GRE_BEND_MATERIALIZATION_NODE_ALLOCATION_CONFLICT',
      'Every admitted GRE candidate requires four unique inserted-node allocations.',
      { candidateCount: candidates.length, allocationCount: resolved.length }));
  const nodeNumbers = resolved.map((item) => item.nodeNumber);
  if (new Set(nodeNumbers).size !== nodeNumbers.length) errors.push(diagnostic(
    'PIPELINE_GRE_BEND_MATERIALIZATION_NODE_ALLOCATION_CONFLICT', 'Allocated node numbers must be unique.'));
  return createPipelineGreBendNodeAllocationPlan({ policy, allocations: Object.freeze(resolved),
    originalNodeNumbers: Object.freeze(originalNodeNumbers),
    reservedNodeNumbers: Object.freeze([...(policy?.reservedNodeNumbers || [])]),
    allocationCount: resolved.length, candidateCount: candidates.length,
    sourceGeometryPlanSchema: text(greBendGeometryPlan?.schema),
    sourceBendResolutionSchema: text(bendResolution?.schema) }, errors);
}

export function indexPipelineGreBendNodeAllocations(plan) {
  return freezePipelineGreMaterializationValue(Object.fromEntries((plan?.allocations || [])
    .map((item) => [`${item.candidateId}:${item.nodeRole}`, item])));
}
