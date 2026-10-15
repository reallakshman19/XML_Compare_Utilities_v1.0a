import {
  PIPELINE_GRE_BEND_CANDIDATE_LINEAGE_SCHEMA,
  PIPELINE_GRE_BEND_COMPONENT_SCHEMA,
  PIPELINE_GRE_BEND_ELEMENT_LINEAGE_SCHEMA,
  PIPELINE_GRE_BEND_MATERIALIZATION_PLAN_SCHEMA,
  PIPELINE_GRE_BEND_MATERIALIZED_ELEMENT_SCHEMA,
  PIPELINE_GRE_BEND_MATERIALIZED_MODEL_SCHEMA,
  PIPELINE_GRE_BEND_MATERIALIZED_NODE_SCHEMA,
  PIPELINE_GRE_BEND_NODE_ALLOCATION_PLAN_SCHEMA,
  PIPELINE_GRE_BEND_NODE_ALLOCATION_POLICY_SCHEMA,
  PIPELINE_GRE_BEND_NODE_ALLOCATION_SCHEMA,
  clonePipelineGreMaterializationValue,
  createPipelineGreBendCandidateLineage,
  createPipelineGreBendComponent,
  createPipelineGreBendElementLineage,
  createPipelineGreBendMaterializedElement,
  createPipelineGreBendMaterializedModel,
  createPipelineGreBendMaterializedNode,
  createPipelineGreBendNodeAllocation,
  createPipelineGreBendNodeAllocationPlan,
  createPipelineGreBendNodeAllocationPolicy,
} from './pipeline-3d-model-gre-bend-materialization-contracts.js';
import { validatePipelineGreBendMaterializedTopology } from './pipeline-3d-model-gre-bend-lineage.js';
import {
  createPipelineInputXmlGreProjectionDiagnostic as diagnostic,
  freezePipelineInputXmlGreProjectionValue as freeze,
} from './pipeline-3d-model-inputxml-gre-projection-contracts.js';

const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const plain = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const canonical = (value) => JSON.stringify(clonePipelineGreMaterializationValue(value));
const same = (left, right) => canonical(left) === canonical(right);
const sorted = (values) => [...values].sort(compare);

function authenticateRecord(value, schema, constructor, code, errors) {
  if (!plain(value) || value.schema !== schema) {
    errors.push(diagnostic(code, { schema: value?.schema || '' }));
    return null;
  }
  const rebuilt = constructor(value);
  if (rebuilt.ready !== true || rebuilt.blockerCodes.length || rebuilt.diagnostics.length
    || !same(value, rebuilt)) {
    errors.push(diagnostic(code, { schema, identity: value.materializedNodeId
      || value.materializedElementId || value.componentId || value.candidateId
      || value.sourceElementId || value.policyId || '' }));
    return null;
  }
  return rebuilt;
}

function authenticateList(values, schema, constructor, code, errors) {
  if (!Array.isArray(values)) {
    errors.push(diagnostic(code));
    return [];
  }
  return values.map((value) => authenticateRecord(value, schema, constructor, code, errors))
    .filter(Boolean);
}

function unique(values, key, code, errors) {
  const seen = new Set();
  for (const value of values) {
    const identity = value?.[key];
    if (identity === undefined || identity === null || identity === '' || seen.has(identity)) {
      errors.push(diagnostic(code, { key, identity }));
    }
    seen.add(identity);
  }
}

function authenticateAllocationPlan(plan, errors) {
  if (!plain(plan) || plan.schema !== PIPELINE_GRE_BEND_NODE_ALLOCATION_PLAN_SCHEMA) {
    errors.push(diagnostic('PIPELINE_INPUTXML_GRE_NODE_ALLOCATION_INVALID'));
    return null;
  }
  const noCandidates = plan.candidateCount === 0 && plan.policy === null;
  const policy = noCandidates ? null : authenticateRecord(plan.policy,
    PIPELINE_GRE_BEND_NODE_ALLOCATION_POLICY_SCHEMA, createPipelineGreBendNodeAllocationPolicy,
    'PIPELINE_INPUTXML_GRE_NODE_ALLOCATION_INVALID', errors);
  const allocations = authenticateList(plan.allocations, PIPELINE_GRE_BEND_NODE_ALLOCATION_SCHEMA,
    createPipelineGreBendNodeAllocation, 'PIPELINE_INPUTXML_GRE_NODE_ALLOCATION_INVALID', errors);
  unique(allocations, 'materializedNodeId', 'PIPELINE_INPUTXML_GRE_NODE_ALLOCATION_INVALID', errors);
  unique(allocations, 'nodeNumber', 'PIPELINE_INPUTXML_GRE_NODE_ALLOCATION_INVALID', errors);
  const rebuilt = createPipelineGreBendNodeAllocationPlan({ ...plan, policy, allocations });
  if ((!noCandidates && !policy) || rebuilt.ready !== true || !same(plan, rebuilt)) {
    errors.push(diagnostic('PIPELINE_INPUTXML_GRE_NODE_ALLOCATION_INVALID'));
    return null;
  }
  return rebuilt;
}

function authenticateModel(model, errors) {
  if (!plain(model) || model.schema !== PIPELINE_GRE_BEND_MATERIALIZED_MODEL_SCHEMA) {
    errors.push(diagnostic('PIPELINE_INPUTXML_GRE_MATERIALIZATION_UNAUTHENTICATED'));
    return null;
  }
  const nodes = authenticateList(model.nodes, PIPELINE_GRE_BEND_MATERIALIZED_NODE_SCHEMA,
    createPipelineGreBendMaterializedNode, 'PIPELINE_INPUTXML_GRE_NODE_IDENTITY_INVALID', errors);
  const elements = authenticateList(model.elements, PIPELINE_GRE_BEND_MATERIALIZED_ELEMENT_SCHEMA,
    createPipelineGreBendMaterializedElement, 'PIPELINE_INPUTXML_GRE_ELEMENT_IDENTITY_INVALID', errors);
  const bendComponents = authenticateList(model.bendComponents, PIPELINE_GRE_BEND_COMPONENT_SCHEMA,
    createPipelineGreBendComponent, 'PIPELINE_INPUTXML_GRE_BEND_OWNERSHIP_INVALID', errors);
  unique(nodes, 'materializedNodeId', 'PIPELINE_INPUTXML_GRE_NODE_IDENTITY_INVALID', errors);
  unique(nodes, 'nodeNumber', 'PIPELINE_INPUTXML_GRE_NODE_IDENTITY_INVALID', errors);
  unique(elements, 'materializedElementId', 'PIPELINE_INPUTXML_GRE_ELEMENT_IDENTITY_INVALID', errors);
  unique(bendComponents, 'componentId', 'PIPELINE_INPUTXML_GRE_BEND_OWNERSHIP_INVALID', errors);
  const rebuilt = createPipelineGreBendMaterializedModel({ ...model, nodes, elements, bendComponents });
  const topology = validatePipelineGreBendMaterializedTopology({ nodes, elements, components: bendComponents });
  if (rebuilt.ready !== true || topology.ready !== true || !same(model, rebuilt)) {
    errors.push(...topology.diagnostics.map((item) => diagnostic(
      'PIPELINE_INPUTXML_GRE_MATERIALIZATION_UNAUTHENTICATED', { upstreamCode: item.code })));
    errors.push(diagnostic('PIPELINE_INPUTXML_GRE_MATERIALIZATION_UNAUTHENTICATED'));
    return null;
  }
  return rebuilt;
}

function exactInactiveReferences(model, components, errors) {
  const listed = model.inactiveCornerReferences || [];
  const inactive = model.nodes.filter((node) =>
    node.nodeRole === 'INACTIVE_CORNER_REFERENCE' && node.active === false)
    .map((node) => node.materializedNodeId);
  const componentRefs = components.map((component) => component.inactiveCornerReferenceId);
  if (new Set(listed).size !== listed.length || !same(sorted(listed), sorted(inactive))
    || !same(sorted(listed), sorted(componentRefs))) {
    errors.push(diagnostic('PIPELINE_INPUTXML_GRE_INACTIVE_CORNER_REAPPEARED'));
  }
}

function coverageErrors(plan, model, allocations, candidateLineage, elementLineage, errors) {
  const sourceNodeCount = model.sourceRows.length;
  const insertedNodeCount = model.nodes.filter((node) => node.inserted === true).length;
  const expected = {
    sourceNodeCount,
    originalNodeCount: model.nodes.filter((node) => node.inserted === false).length,
    insertedNodeCount,
    sourceElementCount: Math.max(0, sourceNodeCount - 1),
    materializedElementCount: model.elements.length,
    appliedCandidateCount: candidateLineage.length,
    notApplicableCandidateCount: plan.notApplicableCandidateIds.length,
    inactiveCornerCount: model.bendComponents.length,
    coveredSourceElementCount: elementLineage.length,
    coveredSuccessorElementCount: new Set(elementLineage.flatMap((item) =>
      item.successorElementIds)).size,
  };
  if (!plain(plan.coverage) || Object.entries(expected).some(([key, value]) =>
    plan.coverage[key] !== value) || allocations.length !== insertedNodeCount) {
    errors.push(diagnostic('PIPELINE_INPUTXML_GRE_PROJECTION_COVERAGE_INVALID', expected));
  }
}

export function authenticatePipelineInputXmlGreMaterializationPlan(value) {
  const errors = [];
  if (!plain(value) || value.schema !== PIPELINE_GRE_BEND_MATERIALIZATION_PLAN_SCHEMA
    || value.ready !== true || !Array.isArray(value.diagnostics) || value.diagnostics.length
    || !Array.isArray(value.blockerCodes) || value.blockerCodes.length) {
    return freeze({ plan: null, model: null, errors: Object.freeze([
      diagnostic('PIPELINE_INPUTXML_GRE_MATERIALIZATION_UNAUTHENTICATED')]) });
  }
  const model = authenticateModel(value.materializedModel, errors);
  const nodeAllocationPlan = authenticateAllocationPlan(value.nodeAllocationPlan, errors);
  const candidateLineage = authenticateList(value.candidateLineage,
    PIPELINE_GRE_BEND_CANDIDATE_LINEAGE_SCHEMA, createPipelineGreBendCandidateLineage,
    'PIPELINE_INPUTXML_GRE_BEND_OWNERSHIP_INVALID', errors);
  const elementLineage = authenticateList(value.elementLineage,
    PIPELINE_GRE_BEND_ELEMENT_LINEAGE_SCHEMA, createPipelineGreBendElementLineage,
    'PIPELINE_INPUTXML_GRE_LINEAGE_CONSERVATION_INVALID', errors);
  unique(candidateLineage, 'candidateId', 'PIPELINE_INPUTXML_GRE_BEND_OWNERSHIP_INVALID', errors);
  unique(elementLineage, 'sourceElementIndex',
    'PIPELINE_INPUTXML_GRE_LINEAGE_CONSERVATION_INVALID', errors);
  if (!Array.isArray(value.appliedCandidateIds) || !Array.isArray(value.notApplicableCandidateIds)
    || !model || !nodeAllocationPlan) {
    errors.push(diagnostic('PIPELINE_INPUTXML_GRE_MATERIALIZATION_UNAUTHENTICATED'));
  } else {
    exactInactiveReferences(model, model.bendComponents, errors);
    coverageErrors(value, model, nodeAllocationPlan.allocations,
      candidateLineage, elementLineage, errors);
    if (!same(sorted(value.appliedCandidateIds),
      sorted(candidateLineage.map((item) => item.candidateId)))) {
      errors.push(diagnostic('PIPELINE_INPUTXML_GRE_BEND_OWNERSHIP_INVALID'));
    }
  }
  const authenticated = errors.length ? null : freeze({ ...value, materializedModel: model,
    nodeAllocationPlan, candidateLineage: Object.freeze(candidateLineage),
    elementLineage: Object.freeze(elementLineage) });
  return freeze({ plan: authenticated, model, errors: Object.freeze(errors) });
}
