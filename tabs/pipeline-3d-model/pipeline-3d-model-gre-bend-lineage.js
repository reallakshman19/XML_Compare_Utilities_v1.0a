import {
  createPipelineGreBendCandidateLineage,
  createPipelineGreBendElementLineage,
  createPipelineGreBendMaterializationDiagnostic,
  freezePipelineGreMaterializationValue,
} from './pipeline-3d-model-gre-bend-materialization-contracts.js';

const EPSILON_MM = 1e-6;
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const text = (value) => typeof value === 'string' ? value.trim() : '';
const diagnostic = (code, message, details = {}) => createPipelineGreBendMaterializationDiagnostic(code, message, details);

function orderedElements(elements) {
  return [...elements].sort((a, b) => Number(a.orderIndex) - Number(b.orderIndex)
    || compare(text(a.materializedElementId), text(b.materializedElementId)));
}
function sourceIndexes(element, count, errors) {
  const values = Array.isArray(element?.sourceElementIndexes) ? element.sourceElementIndexes : [];
  const valid = values.every((value) => Number.isInteger(value) && value >= 0 && value < count);
  if (!values.length || !valid || new Set(values).size !== values.length) errors.push(diagnostic(
    'PIPELINE_GRE_BEND_MATERIALIZATION_LINEAGE_INVALID',
    'Every successor element requires unique valid source-element indexes.',
    { materializedElementId: text(element?.materializedElementId), sourceElementIndexes: values }));
  return values.filter((value) => Number.isInteger(value) && value >= 0 && value < count);
}
export function buildPipelineGreBendElementLineage({ sourceRows = [], materializedElements = [] } = {}) {
  const errors = [], sourceCount = Math.max(0, sourceRows.length - 1), ordered = orderedElements(materializedElements);
  const bySource = Array.from({ length: sourceCount }, () => []), successorSources = Object.create(null);
  const successorIds = ordered.map((item) => text(item.materializedElementId));
  if (successorIds.some((id) => !id) || new Set(successorIds).size !== successorIds.length) errors.push(diagnostic(
    'PIPELINE_GRE_BEND_MATERIALIZATION_LINEAGE_INVALID',
    'Every successor element requires one unique materialized identity.', { successorElementIds: successorIds }));
  for (const element of ordered) {
    const indexes = sourceIndexes(element, sourceCount, errors);
    successorSources[element.materializedElementId] = indexes;
    indexes.forEach((index) => bySource[index].push(element));
  }
  const lineage = bySource.map((items, sourceElementIndex) => {
    const ids = items.map((item) => item.materializedElementId);
    if (!ids.length || new Set(ids).size !== ids.length) errors.push(diagnostic(
      'PIPELINE_GRE_BEND_MATERIALIZATION_LINEAGE_INVALID',
      'Every source element requires unique successor coverage.', { sourceElementIndex, successorElementIds: ids }));
    const candidateIds = [...new Set(items.map((item) => text(item.candidateId)).filter(Boolean))].sort(compare);
    const dispositions = [...new Set(items.map((item) => text(item.lineageDisposition)).filter(Boolean))].sort(compare);
    return createPipelineGreBendElementLineage({ sourceElementIndex, sourceElementId: `E${sourceElementIndex + 1}`,
      sourceFromNodeNumber: sourceRows[sourceElementIndex]?.nodeNumber ?? null,
      sourceToNodeNumber: sourceRows[sourceElementIndex + 1]?.nodeNumber ?? null,
      candidateIds: Object.freeze(candidateIds), successorElementIds: Object.freeze(ids),
      dispositions: Object.freeze(dispositions), sourceAuthority: 'PIPELINE_BEND_RESOLUTION_GEOMETRY_ROWS',
      sourceReference: `geometryRows[${sourceElementIndex}..${sourceElementIndex + 1}]` });
  });
  const coveredSuccessors = new Set(lineage.flatMap((item) => item.successorElementIds));
  const missing = ordered.map((item) => item.materializedElementId).filter((id) => !coveredSuccessors.has(id));
  if (missing.length || Object.values(successorSources).some((indexes) => !indexes.length)) errors.push(diagnostic(
    'PIPELINE_GRE_BEND_MATERIALIZATION_LINEAGE_INVALID',
    'Every successor element must participate in source lineage.', { missingSuccessorElementIds: missing }));
  return freezePipelineGreMaterializationValue({ elementLineage: Object.freeze(lineage), diagnostics: Object.freeze(errors),
    sourceElementCount: sourceCount, coveredSourceElementCount: lineage.filter((item) => item.successorElementIds.length).length,
    successorElementCount: ordered.length, coveredSuccessorElementCount: coveredSuccessors.size });
}

export function validatePipelineGreBendSharedSegments(candidateContexts = []) {
  const errors = [], ordered = [...candidateContexts].sort((a, b) =>
    a.candidate.incomingElementIndex - b.candidate.incomingElementIndex
    || compare(a.candidate.candidateId, b.candidate.candidateId));
  for (let index = 0; index < ordered.length - 1; index += 1) {
    const left = ordered[index], right = ordered[index + 1];
    if (left.candidate.outgoingElementIndex !== right.candidate.incomingElementIndex) continue;
    const available = left.outgoingLength;
    const required = left.candidate.outgoingBreakDistanceFromCornerMm
      + right.candidate.incomingBreakDistanceFromCornerMm;
    if (!Number.isFinite(available) || !Number.isFinite(required) || available + EPSILON_MM < required) {
      const candidateIds = [left.candidate.candidateId, right.candidate.candidateId].sort(compare);
      errors.push(diagnostic('PIPELINE_GRE_BEND_MATERIALIZATION_SHARED_SEGMENT_CONFLICT',
        'Adjacent GRE bend envelopes overlap on one canonical source straight.',
        { conflictId: `GRE-MATERIALIZATION-SHARED:${left.candidate.outgoingElementIndex}:${candidateIds.join('|')}`,
          sourceElementIndex: left.candidate.outgoingElementIndex, candidateIds, availableLengthMm: available,
          requiredLengthMm: required }));
    }
  }
  return freezePipelineGreMaterializationValue({ diagnostics: Object.freeze(errors), ready: errors.length === 0 });
}

export function buildPipelineGreBendCandidateLineage(candidateContexts = []) {
  const errors = [];
  const lineage = [...candidateContexts].sort((a, b) => a.candidate.incomingElementIndex - b.candidate.incomingElementIndex
    || compare(a.candidate.candidateId, b.candidate.candidateId)).map((context) => {
    const candidate = context.candidate, successorIds = context.successorElementIds || [];
    if (successorIds.length < 3 || !context.bendElementId || !context.bendComponentId
      || !context.inactiveCornerReferenceId || (context.insertedNodeIds || []).length !== 4) errors.push(diagnostic(
      'PIPELINE_GRE_BEND_MATERIALIZATION_LINEAGE_INVALID',
      'Candidate lineage requires four inserted nodes, one bend and complete successor evidence.',
      { candidateId: candidate.candidateId }));
    return createPipelineGreBendCandidateLineage({ candidateId: candidate.candidateId,
      analysisSectionId: candidate.analysisSectionId, profileId: candidate.profileId,
      incomingElementIndex: candidate.incomingElementIndex, outgoingElementIndex: candidate.outgoingElementIndex,
      incomingElementId: candidate.incomingElementId, outgoingElementId: candidate.outgoingElementId,
      insertedNodeIds: Object.freeze([...(context.insertedNodeIds || [])]), bendElementId: context.bendElementId,
      bendComponentId: context.bendComponentId, inactiveCornerReferenceId: context.inactiveCornerReferenceId,
      successorElementIds: Object.freeze([...successorIds]), vendorId: candidate.vendorId, seriesId: candidate.seriesId,
      qualificationEvidenceId: candidate.qualificationEvidenceId,
      bendBreakLengthApplication: candidate.bendBreakLengthApplication,
      sourceAuthority: candidate.sourceAuthority, sourceReference: candidate.sourceReference });
  });
  return freezePipelineGreMaterializationValue({ candidateLineage: Object.freeze(lineage), diagnostics: Object.freeze(errors) });
}
function duplicateIds(items, field) {
  const values = items.map((item) => text(item?.[field]));
  return values.filter((value, index) => !value || values.indexOf(value) !== index);
}
function topologyIdentityErrors(nodes, elements, components) {
  const errors = [];
  const duplicateNodes = duplicateIds(nodes, 'materializedNodeId');
  const duplicateElements = duplicateIds(elements, 'materializedElementId');
  const duplicateComponents = duplicateIds(components, 'componentId');
  if (duplicateNodes.length || duplicateElements.length || duplicateComponents.length) errors.push(diagnostic(
    'PIPELINE_GRE_BEND_MATERIALIZATION_TOPOLOGY_INVALID',
    'Materialized node, element and component identities must be unique.',
    { duplicateNodes, duplicateElements, duplicateComponents }));
  return errors;
}
function samePoint(left, right) {
  return ['x', 'y', 'z'].every((axis) => Number.isFinite(Number(left?.[axis]))
    && Number.isFinite(Number(right?.[axis])) && Math.abs(Number(left[axis]) - Number(right[axis])) <= EPSILON_MM);
}
function referenceErrors(nodes, elements, components) {
  const errors = [], nodeIndex = new Map(nodes.map((node) => [node.materializedNodeId, node]));
  const used = new Set();
  for (const element of elements) {
    const from = nodeIndex.get(element.fromMaterializedNodeId), to = nodeIndex.get(element.toMaterializedNodeId);
    if (!from || !to || from.active !== true || to.active !== true) errors.push(diagnostic(
      'PIPELINE_GRE_BEND_MATERIALIZATION_TOPOLOGY_INVALID',
      'Every materialized element must reference two known active nodes.',
      { materializedElementId: element.materializedElementId }));
    used.add(element.fromMaterializedNodeId); used.add(element.toMaterializedNodeId);
    const length = Number(element.lengthMm);
    const coincident = ['COINCIDENT_ZERO_LENGTH_AUTHORIZED', 'COINCIDENT_ENVELOPE_CONTACT']
      .includes(element.lineageDisposition);
    if (element.lineageDisposition === 'COINCIDENT_ENVELOPE_CONTACT'
      && (!from || !to || from.nodeRole !== 'GRE_OUTGOING_BREAK' || to.nodeRole !== 'GRE_INCOMING_BREAK'
        || from.candidateId === to.candidateId || !samePoint(from.coordinates, to.coordinates))) errors.push(diagnostic(
      'PIPELINE_GRE_BEND_MATERIALIZATION_ZERO_LENGTH_INVALID',
      'Coincident envelope contact requires exact adjacent candidate break-node evidence.',
      { materializedElementId: element.materializedElementId }));
    if (!Number.isFinite(length) || length < -EPSILON_MM || (Math.abs(length) <= EPSILON_MM && !coincident)) errors.push(
      diagnostic('PIPELINE_GRE_BEND_MATERIALIZATION_ZERO_LENGTH_INVALID',
        'Zero-length materialized elements require an explicit coincident disposition.',
        { materializedElementId: element.materializedElementId, lengthMm: element.lengthMm }));
  }
  const orphanNodes = nodes.filter((node) => node.active === true && !used.has(node.materializedNodeId))
    .map((node) => node.materializedNodeId);
  if (orphanNodes.length) errors.push(diagnostic('PIPELINE_GRE_BEND_MATERIALIZATION_TOPOLOGY_INVALID',
    'Active materialized nodes must not be isolated.', { orphanNodeIds: orphanNodes }));
  for (const component of components) {
    const incoming = nodeIndex.get(component.incomingTangencyNodeId);
    const outgoing = nodeIndex.get(component.outgoingTangencyNodeId);
    const corner = nodeIndex.get(component.inactiveCornerReferenceId);
    if (!incoming || !outgoing || !corner || incoming.active !== true || outgoing.active !== true
      || incoming.nodeRole !== 'GRE_INCOMING_TANGENCY' || outgoing.nodeRole !== 'GRE_OUTGOING_TANGENCY'
      || corner.active !== false || corner.nodeRole !== 'INACTIVE_CORNER_REFERENCE') errors.push(diagnostic(
      'PIPELINE_GRE_BEND_MATERIALIZATION_TOPOLOGY_INVALID',
      'GRE bend components must reference active tangency nodes and one inactive corner evidence node.',
      { componentId: component.componentId }));
  }
  return errors;
}
export function validatePipelineGreBendMaterializedTopology({ nodes = [], elements = [], components = [] } = {}) {
  const errors = [...topologyIdentityErrors(nodes, elements, components), ...referenceErrors(nodes, elements, components)];
  return freezePipelineGreMaterializationValue({ diagnostics: Object.freeze(errors), ready: errors.length === 0 });
}
