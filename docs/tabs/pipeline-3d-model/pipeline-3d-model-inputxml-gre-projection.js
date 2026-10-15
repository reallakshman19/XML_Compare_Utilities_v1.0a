import {
  PIPELINE_INPUTXML_GRE_BEND_PROJECTION_SCHEMA,
  PIPELINE_INPUTXML_GRE_PROJECTED_ELEMENT_SCHEMA,
  PIPELINE_INPUTXML_GRE_SOURCE_CONSERVATION_SCHEMA,
  createPipelineInputXmlGreProjectionDiagnostic as diagnostic,
  createPipelineInputXmlGreProjectionPlan,
  freezePipelineInputXmlGreProjectionValue as freeze,
  safePipelineInputXmlGreProjectionInput as safe,
} from './pipeline-3d-model-inputxml-gre-projection-contracts.js';
import { authenticatePipelineInputXmlGreMaterializationPlan } from './pipeline-3d-model-inputxml-gre-projection-authentication.js';
export {
  PIPELINE_INPUTXML_GRE_BEND_PROJECTION_SCHEMA,
  PIPELINE_INPUTXML_GRE_PROJECTED_ELEMENT_SCHEMA,
  PIPELINE_INPUTXML_GRE_PROJECTION_BLOCKER_ORDER,
  PIPELINE_INPUTXML_GRE_PROJECTION_PLAN_SCHEMA,
  PIPELINE_INPUTXML_GRE_SOURCE_CONSERVATION_SCHEMA,
  buildPipelineInputXmlGreProjectionPlanJson,
} from './pipeline-3d-model-inputxml-gre-projection-contracts.js';

const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const plain = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const sorted = (values) => [...values].sort(compare);

function indexUnique(values, key, errors, code) {
  const result = Object.create(null);
  for (const item of values) {
    const identity = item?.[key];
    if (identity === undefined || identity === null || identity === '' || Object.hasOwn(result, identity)) {
      errors.push(diagnostic(code, { key, identity }));
    } else result[identity] = item;
  }
  return result;
}

function point(value) {
  return plain(value) && ['x', 'y', 'z'].every((axis) => finite(value[axis]));
}

function exactPoint(left, right) {
  return point(left) && point(right) && ['x', 'y', 'z'].every((axis) => left[axis] === right[axis]);
}

function validateNodes(plan, model, errors) {
  const nodes = model.nodes;
  const byId = indexUnique(nodes, 'materializedNodeId', errors,
    'PIPELINE_INPUTXML_GRE_NODE_IDENTITY_INVALID');
  indexUnique(nodes, 'nodeNumber', errors, 'PIPELINE_INPUTXML_GRE_NODE_IDENTITY_INVALID');
  const originals = nodes.filter((node) => node.inserted === false);
  const rows = model.sourceRows;
  if (originals.length !== rows.length) errors.push(diagnostic(
    'PIPELINE_INPUTXML_GRE_NODE_IDENTITY_INVALID', { originalNodeCount: originals.length, sourceRowCount: rows.length }));
  rows.forEach((row, rowIndex) => {
    const matches = originals.filter((item) => item.sourceNodeNumber === row?.nodeNumber);
    const node = matches[0];
    if (matches.length !== 1 || !Number.isSafeInteger(row?.nodeNumber) || !point(row)
      || node.nodeNumber !== row.nodeNumber || !exactPoint(node.coordinates, row)) {
      errors.push(diagnostic('PIPELINE_INPUTXML_GRE_NODE_IDENTITY_INVALID', { rowIndex }));
    }
  });
  const allocations = plan.nodeAllocationPlan.allocations;
  const byAllocationId = indexUnique(allocations, 'materializedNodeId', errors,
    'PIPELINE_INPUTXML_GRE_NODE_ALLOCATION_INVALID');
  const inserted = nodes.filter((node) => node.inserted === true);
  inserted.forEach((node) => {
    const allocation = byAllocationId[node.materializedNodeId];
    if (!allocation || allocation.nodeNumber !== node.nodeNumber || allocation.nodeRole !== node.nodeRole
      || allocation.candidateId !== node.candidateId) errors.push(diagnostic(
      'PIPELINE_INPUTXML_GRE_NODE_ALLOCATION_INVALID', { materializedNodeId: node.materializedNodeId }));
  });
  if (allocations.length !== inserted.length) errors.push(diagnostic(
    'PIPELINE_INPUTXML_GRE_NODE_ALLOCATION_INVALID'));
  return { nodes, byId };
}

function projectedElement(element, index, nodeById) {
  const from = nodeById[element.fromMaterializedNodeId], to = nodeById[element.toMaterializedNodeId];
  return freeze({ schema: PIPELINE_INPUTXML_GRE_PROJECTED_ELEMENT_SCHEMA, id: `E${index + 1}`, index,
    materializedElementId: element.materializedElementId, elementKind: element.elementKind,
    analysisSectionId: element.analysisSectionId, candidateId: element.candidateId || '',
    fromMaterializedNodeId: from.materializedNodeId, toMaterializedNodeId: to.materializedNodeId,
    fromNode: from.nodeNumber, toNode: to.nodeNumber,
    fromX: from.coordinates.x, fromY: from.coordinates.y, fromZ: from.coordinates.z,
    toX: to.coordinates.x, toY: to.coordinates.y, toZ: to.coordinates.z,
    deltaX: to.coordinates.x - from.coordinates.x, deltaY: to.coordinates.y - from.coordinates.y,
    deltaZ: to.coordinates.z - from.coordinates.z,
    sourceElementIndexes: Object.freeze([...element.sourceElementIndexes]),
    lineageDisposition: element.lineageDisposition, bend: null,
    sourceAuthority: element.sourceAuthority, sourceReference: element.sourceReference });
}

function validateElements(model, nodes, errors) {
  const elements = model.elements;
  const byId = indexUnique(elements, 'materializedElementId', errors,
    'PIPELINE_INPUTXML_GRE_ELEMENT_IDENTITY_INVALID');
  elements.forEach((element, index) => {
    const from = nodes.byId[element.fromMaterializedNodeId], to = nodes.byId[element.toMaterializedNodeId];
    if (element.orderIndex !== index || !from || !to || from.active !== true || to.active !== true) {
      errors.push(diagnostic('PIPELINE_INPUTXML_GRE_ELEMENT_IDENTITY_INVALID', {
        materializedElementId: element.materializedElementId }));
    }
  });
  const zeroLength = elements.filter((element) => element.lengthMm === 0);
  if (zeroLength.length) errors.push(diagnostic(
    'PIPELINE_INPUTXML_GRE_ZERO_LENGTH_ELEMENT_UNRESOLVED',
    { materializedElementIds: zeroLength.map((item) => item.materializedElementId) }));
  const emittable = elements.filter((element) => element.elementKind !== 'GRE_BEND' && element.lengthMm > 0);
  const projected = emittable.map((element, index) => projectedElement(element, index, nodes.byId));
  return { elements, byId, projected, projectedByMaterializedId: Object.fromEntries(
    projected.map((item) => [item.materializedElementId, item])) };
}

function exactCandidateNodes(component, lineage, nodes) {
  const expected = nodes.nodes.filter((node) => node.inserted === true
    && node.candidateId === component.candidateId).map((node) => node.materializedNodeId);
  return expected.length === 4 && same(sorted(expected), sorted(lineage.insertedNodeIds));
}

function bendProjection(component, bendElement, incomingOwner, nodeById) {
  const incoming = nodeById[component.incomingTangencyNodeId];
  const outgoing = nodeById[component.outgoingTangencyNodeId];
  const inactive = nodeById[component.inactiveCornerReferenceId];
  const [incomingIndex, outgoingIndex] = component.sourceElementIndexes;
  return freeze({ schema: PIPELINE_INPUTXML_GRE_BEND_PROJECTION_SCHEMA,
    candidateId: component.candidateId, bendComponentId: component.componentId,
    semanticGreBendElementId: bendElement.materializedElementId,
    incomingOwnerProjectionElementId: incomingOwner.id,
    incomingOwnerMaterializedElementId: incomingOwner.materializedElementId,
    incomingSourceElementIndex: incomingIndex, incomingSourceElementId: `E${incomingIndex + 1}`,
    outgoingSourceElementIndex: outgoingIndex, outgoingSourceElementId: `E${outgoingIndex + 1}`,
    incomingTangencyNodeId: incoming.materializedNodeId, incomingTangencyNodeNumber: incoming.nodeNumber,
    outgoingTangencyNodeId: outgoing.materializedNodeId, outgoingTangencyNodeNumber: outgoing.nodeNumber,
    inactiveCornerReferenceId: inactive.materializedNodeId, inactiveCornerNodeNumber: inactive.nodeNumber,
    radiusMm: component.bendRadiusMm, turnAngleDeg: component.turnAngleDeg,
    fittingThicknessMm: component.localThicknessMm,
    bendBreakLengthApplication: component.bendBreakLengthApplication,
    vendorId: component.vendorId, seriesId: component.seriesId,
    qualificationEvidenceId: component.qualificationEvidenceId,
    requirementReference: component.requirementReference,
    sourceAuthority: component.sourceAuthority, sourceReference: component.sourceReference });
}

function componentValid(component, bendElement, incomingOwner, lineage, nodes, candidateElements) {
  const incoming = nodes.byId[component.incomingTangencyNodeId];
  const outgoing = nodes.byId[component.outgoingTangencyNodeId];
  const inactive = nodes.byId[component.inactiveCornerReferenceId];
  const sourceIndexes = component.sourceElementIndexes;
  return bendElement && incomingOwner && lineage
    && incoming?.nodeRole === 'GRE_INCOMING_TANGENCY'
    && outgoing?.nodeRole === 'GRE_OUTGOING_TANGENCY'
    && inactive?.nodeRole === 'INACTIVE_CORNER_REFERENCE' && inactive.active === false
    && [incoming, outgoing, inactive].every((node) => node.candidateId === component.candidateId
      && node.analysisSectionId === component.analysisSectionId)
    && bendElement.fromMaterializedNodeId === incoming.materializedNodeId
    && bendElement.toMaterializedNodeId === outgoing.materializedNodeId
    && bendElement.analysisSectionId === component.analysisSectionId
    && bendElement.vendorId === component.vendorId && bendElement.seriesId === component.seriesId
    && bendElement.localThicknessMm === component.localThicknessMm
    && same(bendElement.sourceElementIndexes, sourceIndexes)
    && sourceIndexes.length === 2 && sourceIndexes[1] === sourceIndexes[0] + 1
    && incomingOwner.candidateId === component.candidateId
    && incomingOwner.analysisSectionId === component.analysisSectionId
    && incomingOwner.toMaterializedNodeId === incoming.materializedNodeId
    && lineage.analysisSectionId === component.analysisSectionId
    && lineage.bendElementId === bendElement.materializedElementId
    && lineage.bendComponentId === component.componentId
    && lineage.inactiveCornerReferenceId === inactive.materializedNodeId
    && lineage.vendorId === component.vendorId && lineage.seriesId === component.seriesId
    && exactCandidateNodes(component, lineage, nodes)
    && same(sorted(lineage.successorElementIds), sorted(candidateElements.map((item) => item.materializedElementId)));
}

function validateBends(plan, model, nodes, elements, errors) {
  const lineageByCandidate = indexUnique(plan.candidateLineage, 'candidateId', errors,
    'PIPELINE_INPUTXML_GRE_BEND_OWNERSHIP_INVALID');
  const projections = [];
  for (const component of model.bendComponents) {
    const candidateElements = elements.elements.filter((item) => item.candidateId === component.candidateId);
    const bendElements = candidateElements.filter((item) => item.elementKind === 'GRE_BEND');
    const incomingOwners = elements.projected.filter((item) => item.candidateId === component.candidateId
      && item.toMaterializedNodeId === component.incomingTangencyNodeId);
    const bendElement = bendElements.length === 1 ? bendElements[0] : null;
    const incomingOwner = incomingOwners.length === 1 ? incomingOwners[0] : null;
    const lineage = lineageByCandidate[component.candidateId];
    if (!componentValid(component, bendElement, incomingOwner, lineage, nodes, candidateElements)) {
      errors.push(diagnostic('PIPELINE_INPUTXML_GRE_BEND_OWNERSHIP_INVALID', {
        candidateId: component.candidateId }));
    } else projections.push(bendProjection(component, bendElement, incomingOwner, nodes.byId));
  }
  if (projections.length !== model.bendComponents.length
    || plan.candidateLineage.length !== model.bendComponents.length
    || !same(sorted(plan.appliedCandidateIds), sorted(model.bendComponents.map((item) => item.candidateId)))) {
    errors.push(diagnostic('PIPELINE_INPUTXML_GRE_BEND_OWNERSHIP_INVALID'));
  }
  return projections;
}

function validateLineage(plan, model, elements, bends, errors) {
  const sourceCount = Math.max(0, model.sourceRows.length - 1);
  const byIndex = indexUnique(plan.elementLineage, 'sourceElementIndex', errors,
    'PIPELINE_INPUTXML_GRE_LINEAGE_CONSERVATION_INVALID');
  const projectedByMaterialized = elements.projectedByMaterializedId;
  const bendBySemantic = Object.fromEntries(bends.map((bend) =>
    [bend.semanticGreBendElementId, bend]));
  const conservation = [];
  for (let index = 0; index < sourceCount; index += 1) {
    const item = byIndex[index];
    const expected = elements.elements.filter((element) => element.sourceElementIndexes.includes(index))
      .map((element) => element.materializedElementId);
    const emitted = [...new Set(expected.map((id) => projectedByMaterialized[id]?.id
      || bendBySemantic[id]?.incomingOwnerProjectionElementId).filter(Boolean))];
    if (!item || item.sourceElementId !== `E${index + 1}` || !same(item.successorElementIds, expected)
      || emitted.length === 0) errors.push(diagnostic(
      'PIPELINE_INPUTXML_GRE_LINEAGE_CONSERVATION_INVALID', { sourceElementIndex: index }));
    else conservation.push(freeze({ schema: PIPELINE_INPUTXML_GRE_SOURCE_CONSERVATION_SCHEMA,
      sourceElementIndex: index, sourceElementId: item.sourceElementId,
      successorMaterializedElementIds: Object.freeze([...expected]),
      emittedElementIds: Object.freeze(emitted) }));
  }
  if (plan.elementLineage.length !== sourceCount) errors.push(diagnostic(
    'PIPELINE_INPUTXML_GRE_LINEAGE_CONSERVATION_INVALID'));
  return conservation;
}

function attachBends(projected, bends) {
  const byOwner = Object.fromEntries(bends.map((bend) =>
    [bend.incomingOwnerProjectionElementId, bend]));
  return Object.freeze(projected.map((element) => freeze({ ...element, bend: byOwner[element.id] || null })));
}

export function buildPipelineInputXmlGreProjectionPlan(input = {}) {
  const safeValue = safe(input), errors = [...safeValue.diagnostics];
  const authenticated = authenticatePipelineInputXmlGreMaterializationPlan(
    safeValue.source.materializationPlan);
  errors.push(...authenticated.errors);
  const plan = authenticated.plan || { nodeAllocationPlan: { allocations: [] }, candidateLineage: [],
    elementLineage: [], appliedCandidateIds: [], notApplicableCandidateIds: [] };
  const model = authenticated.model || { sourceRows: [], nodes: [], elements: [], bendComponents: [],
    inactiveCornerReferences: [] };
  const nodes = validateNodes(plan, model, errors);
  const elements = validateElements(model, nodes, errors);
  const bends = validateBends(plan, model, nodes, elements, errors);
  const conservation = validateLineage(plan, model, elements, bends, errors);
  const projected = attachBends(elements.projected, bends);
  const semanticBendElementCount = model.elements.filter((item) => item.elementKind === 'GRE_BEND').length;
  const zeroLengthElementCount = model.elements.filter((item) => item.lengthMm === 0).length;
  const coverage = freeze({ sourceNodeCount: model.sourceRows.length,
    activeNodeCount: model.nodes.filter((node) => node.active === true).length,
    inactiveCornerCount: model.nodes.filter((node) => node.nodeRole === 'INACTIVE_CORNER_REFERENCE').length,
    sourceElementCount: Math.max(0, model.sourceRows.length - 1),
    materializedElementCount: model.elements.length, semanticBendElementCount, zeroLengthElementCount,
    emittableMaterializedElementCount: model.elements.length - semanticBendElementCount - zeroLengthElementCount,
    projectedElementCount: projected.length, bendComponentCount: model.bendComponents.length,
    bendProjectionCount: bends.length });
  if (coverage.projectedElementCount !== coverage.emittableMaterializedElementCount
    || coverage.bendProjectionCount !== coverage.bendComponentCount
    || conservation.length !== coverage.sourceElementCount
    || coverage.inactiveCornerCount !== coverage.bendComponentCount) {
    errors.push(diagnostic('PIPELINE_INPUTXML_GRE_PROJECTION_COVERAGE_INVALID', coverage));
  }
  return createPipelineInputXmlGreProjectionPlan({
    sourceMaterializationPlanSchema: plan.schema || '', sourceMaterializedModelSchema: model.schema || '',
    projectedElements: projected, bendProjections: bends, sourceElementConservation: conservation,
    inactiveCornerReferences: model.inactiveCornerReferences || [],
    notApplicableCandidateIds: plan.notApplicableCandidateIds || [], coverage,
  }, errors);
}
