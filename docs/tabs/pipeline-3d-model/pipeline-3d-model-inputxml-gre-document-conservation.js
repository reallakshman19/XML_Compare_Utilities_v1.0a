import {
  PIPELINE_INPUTXML_GRE_BEND_PROJECTION_SCHEMA,
  PIPELINE_INPUTXML_GRE_PROJECTED_ELEMENT_SCHEMA,
  PIPELINE_INPUTXML_GRE_PROJECTION_PLAN_SCHEMA,
  PIPELINE_INPUTXML_GRE_SOURCE_CONSERVATION_SCHEMA,
  createPipelineInputXmlGreProjectionPlan,
  clonePipelineInputXmlGreProjectionValue,
} from './pipeline-3d-model-inputxml-gre-projection-contracts.js';
import {
  createPipelineInputXmlGreDocumentAdoptionDiagnostic as diagnostic,
  createPipelineInputXmlGreDocumentCandidateConservation,
  createPipelineInputXmlGreDocumentSourceConservation,
  freezePipelineInputXmlGreDocumentAdoptionValue as freeze,
} from './pipeline-3d-model-inputxml-gre-document-adoption-contracts.js';

const DOCUMENT_SCHEMA = 'PipelineInputXmlDocumentPlan.v1';
const ELEMENT_SCHEMA = 'PipelineInputXmlElementPlan.v1';
const PROFILE_PLAN_SCHEMA = 'PipelineInputXmlProfileAuthorityPlan.v1';
const GRE_BLOCKER = 'PIPELINE_INPUTXML_GRE_BEND_GEOMETRY_REQUIRED';
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const text = (value) => typeof value === 'string' ? value.trim() : '';
const plain = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const canonical = (value) => JSON.stringify(clonePipelineInputXmlGreProjectionValue(value));
const same = (left, right) => canonical(left) === canonical(right);
const sorted = (values) => [...values].sort(compare);

function uniqueIndex(values, key, code, errors) {
  const result = Object.create(null);
  for (const item of values) {
    const identity = item?.[key];
    if (identity === undefined || identity === null || identity === '' || Object.hasOwn(result, identity)) {
      errors.push(diagnostic(code, { key, identity }));
    } else result[identity] = item;
  }
  return result;
}

function allowedGreDiagnostics(value) {
  const diagnostics = Array.isArray(value?.diagnostics) ? value.diagnostics : [];
  const blockers = Array.isArray(value?.blockerCodes) ? value.blockerCodes : [];
  return diagnostics.every((item) => item?.severity === 'BLOCKING' && item?.code === GRE_BLOCKER)
    && blockers.every((code) => code === GRE_BLOCKER)
    && new Set(blockers).size === blockers.length;
}

function sourceElementValid(element, index) {
  const coordinates = ['fromX', 'fromY', 'fromZ', 'toX', 'toY', 'toZ', 'deltaX', 'deltaY', 'deltaZ'];
  return plain(element) && element.schema === ELEMENT_SCHEMA && element.id === `E${index + 1}`
    && element.index === index && Number.isSafeInteger(element.fromNode) && element.fromNode > 0
    && Number.isSafeInteger(element.toNode) && element.toNode > 0 && element.fromNode !== element.toNode
    && coordinates.every((key) => finite(element[key]))
    && element.deltaX === element.toX - element.fromX
    && element.deltaY === element.toY - element.fromY
    && element.deltaZ === element.toZ - element.fromZ
    && text(element.analysisSectionId) && text(element.profileId)
    && plain(element.emittedProperties) && plain(element.profileAuthority)
    && element.profileAuthority.elementIndex === index
    && element.profileAuthority.elementId === element.id
    && element.profileAuthority.analysisSectionId === element.analysisSectionId
    && element.profileAuthority.profileId === element.profileId
    && allowedGreDiagnostics(element);
}

function profilePlanValid(plan, elements, errors) {
  if (!plain(plan) || plan.schema !== PROFILE_PLAN_SCHEMA || !Array.isArray(plan.sectionAuthorities)
    || !Array.isArray(plan.elementAuthorities) || plan.elementAuthorities.length !== elements.length
    || !allowedGreDiagnostics(plan)) {
    errors.push(diagnostic('PIPELINE_INPUTXML_GRE_PROFILE_AUTHORITY_INVALID'));
    return false;
  }
  const sections = uniqueIndex(plan.sectionAuthorities, 'analysisSectionId',
    'PIPELINE_INPUTXML_GRE_PROFILE_AUTHORITY_INVALID', errors);
  let valid = true;
  plan.elementAuthorities.forEach((authority, index) => {
    const element = elements[index], section = sections[authority?.analysisSectionId];
    const ok = plain(authority) && authority.elementIndex === index && authority.elementId === `E${index + 1}`
      && section && authority.profileId === section.profileId
      && authority.analysisSectionId === section.analysisSectionId
      && authority.caesarDiameterMm > 0 && allowedGreDiagnostics(authority)
      && same(authority, element?.profileAuthority);
    if (!ok) valid = false;
  });
  if (!valid) errors.push(diagnostic('PIPELINE_INPUTXML_GRE_PROFILE_AUTHORITY_INVALID'));
  return valid;
}

export function authenticatePipelineInputXmlGreSourceDocumentPlan(value, errors = []) {
  if (!plain(value) || value.schema !== DOCUMENT_SCHEMA || !Array.isArray(value.elements)
    || !plain(value.counts) || value.counts.numElt !== value.elements.length
    || !allowedGreDiagnostics(value)) {
    errors.push(diagnostic('PIPELINE_INPUTXML_GRE_SOURCE_DOCUMENT_INVALID'));
    return null;
  }
  const elements = value.elements;
  if (elements.some((element, index) => !sourceElementValid(element, index))) {
    errors.push(diagnostic('PIPELINE_INPUTXML_GRE_SOURCE_DOCUMENT_INVALID'));
  }
  if (!profilePlanValid(value.profileAuthorityPlan, elements, errors)) return null;
  const sourceBendCount = elements.filter((element) => element.bend != null).length;
  if (value.counts.numBend !== sourceBendCount || value.ready !== (value.blockerCodes.length === 0)) {
    errors.push(diagnostic('PIPELINE_INPUTXML_GRE_SOURCE_DOCUMENT_INVALID'));
  }
  return errors.length ? null : freeze(value);
}

function nodeRegistry(elements, errors) {
  const byNumber = Object.create(null), byId = Object.create(null);
  const register = (element, side) => {
    const number = element[`${side}Node`], id = element[`${side}MaterializedNodeId`];
    const point = { x: element[`${side}X`], y: element[`${side}Y`], z: element[`${side}Z`] };
    const numberValue = byNumber[number], idValue = byId[id];
    if (!text(id) || !Number.isSafeInteger(number) || number <= 0
      || (numberValue && (numberValue.id !== id || !same(numberValue.point, point)))
      || (idValue && (idValue.number !== number || !same(idValue.point, point)))) {
      errors.push(diagnostic('PIPELINE_INPUTXML_GRE_DOCUMENT_NODE_IDENTITY_INVALID', { id, number }));
    } else {
      byNumber[number] = { id, point }; byId[id] = { number, point };
    }
  };
  elements.forEach((element) => { register(element, 'from'); register(element, 'to'); });
  return { byNumber, byId };
}

function projectedElementValid(element, index) {
  const fields = ['fromX', 'fromY', 'fromZ', 'toX', 'toY', 'toZ', 'deltaX', 'deltaY', 'deltaZ'];
  return plain(element) && element.schema === PIPELINE_INPUTXML_GRE_PROJECTED_ELEMENT_SCHEMA
    && element.id === `E${index + 1}` && element.index === index && text(element.materializedElementId)
    && element.elementKind !== 'GRE_BEND' && text(element.analysisSectionId)
    && text(element.fromMaterializedNodeId) && text(element.toMaterializedNodeId)
    && Number.isSafeInteger(element.fromNode) && element.fromNode > 0
    && Number.isSafeInteger(element.toNode) && element.toNode > 0 && element.fromNode !== element.toNode
    && fields.every((key) => finite(element[key]))
    && element.deltaX === element.toX - element.fromX
    && element.deltaY === element.toY - element.fromY
    && element.deltaZ === element.toZ - element.fromZ
    && Math.hypot(element.deltaX, element.deltaY, element.deltaZ) > 0
    && Array.isArray(element.sourceElementIndexes) && element.sourceElementIndexes.length === 1
    && Number.isSafeInteger(element.sourceElementIndexes[0]) && element.sourceElementIndexes[0] >= 0
    && text(element.lineageDisposition);
}

function bendValid(bend, elementsById, materializedById, errors) {
  const owner = elementsById[bend?.incomingOwnerProjectionElementId];
  const semanticEmitted = materializedById[bend?.semanticGreBendElementId];
  const ok = plain(bend) && bend.schema === PIPELINE_INPUTXML_GRE_BEND_PROJECTION_SCHEMA
    && text(bend.candidateId) && text(bend.semanticGreBendElementId) && !semanticEmitted
    && owner && owner.materializedElementId === bend.incomingOwnerMaterializedElementId
    && owner.toMaterializedNodeId === bend.incomingTangencyNodeId
    && owner.toNode === bend.incomingTangencyNodeNumber
    && owner.candidateId === bend.candidateId && same(owner.bend, bend)
    && bend.outgoingSourceElementIndex === bend.incomingSourceElementIndex + 1
    && Number.isSafeInteger(bend.inactiveCornerNodeNumber) && bend.inactiveCornerNodeNumber > 0
    && bend.radiusMm > 0 && bend.turnAngleDeg > 0 && bend.turnAngleDeg < 180
    && bend.fittingThicknessMm > 0 && text(bend.vendorId) && text(bend.seriesId)
    && text(bend.qualificationEvidenceId) && text(bend.requirementReference)
    && text(bend.sourceAuthority) && text(bend.sourceReference);
  if (!ok) errors.push(diagnostic('PIPELINE_INPUTXML_GRE_DOCUMENT_BEND_OWNERSHIP_INVALID', {
    candidateId: bend?.candidateId || '' }));
  return ok;
}

function conservationValid(plan, elements, bends, errors) {
  const byProjection = Object.fromEntries(elements.map((item) => [item.id, item]));
  const byMaterialized = Object.fromEntries(elements.map((item) => [item.materializedElementId, item]));
  const bySource = uniqueIndex(plan.sourceElementConservation, 'sourceElementIndex',
    'PIPELINE_INPUTXML_GRE_DOCUMENT_SOURCE_CONSERVATION_INVALID', errors);
  bends.forEach((bend) => bendValid(bend, byProjection, byMaterialized, errors));
  for (const element of elements) {
    const sourceIndex = element.sourceElementIndexes[0], item = bySource[sourceIndex];
    if (!item || item.schema !== PIPELINE_INPUTXML_GRE_SOURCE_CONSERVATION_SCHEMA
      || item.sourceElementId !== `E${sourceIndex + 1}`
      || !item.successorMaterializedElementIds.includes(element.materializedElementId)
      || !item.emittedElementIds.includes(element.id)) errors.push(diagnostic(
      'PIPELINE_INPUTXML_GRE_DOCUMENT_SOURCE_CONSERVATION_INVALID', { sourceElementIndex: sourceIndex }));
  }
  const semanticIds = bends.map((bend) => bend.semanticGreBendElementId);
  bends.forEach((bend) => [bend.incomingSourceElementIndex, bend.outgoingSourceElementIndex].forEach((index) => {
    const item = bySource[index];
    if (!item?.successorMaterializedElementIds.includes(bend.semanticGreBendElementId)
      || !item?.emittedElementIds.includes(bend.incomingOwnerProjectionElementId)) errors.push(diagnostic(
      'PIPELINE_INPUTXML_GRE_DOCUMENT_SOURCE_CONSERVATION_INVALID', { sourceElementIndex: index }));
  }));
  const successors = new Set(plan.sourceElementConservation.flatMap((item) => item.successorMaterializedElementIds));
  if (elements.some((item) => !successors.has(item.materializedElementId))
    || semanticIds.some((id) => !successors.has(id))) errors.push(diagnostic(
    'PIPELINE_INPUTXML_GRE_DOCUMENT_SOURCE_CONSERVATION_INVALID'));
  return bySource;
}

export function authenticatePipelineInputXmlGreProjectionPlan(value, errors = []) {
  if (!plain(value) || value.schema !== PIPELINE_INPUTXML_GRE_PROJECTION_PLAN_SCHEMA) {
    errors.push(diagnostic('PIPELINE_INPUTXML_GRE_PROJECTION_UNAUTHENTICATED'));
    return null;
  }
  let rebuilt;
  try { rebuilt = createPipelineInputXmlGreProjectionPlan(value); } catch { rebuilt = null; }
  if (!rebuilt || !same(rebuilt, value) || value.ready !== true || value.projectionStatus !== 'READY'
    || value.documentAuthorityAdopted !== false || value.writerAdmission !== 'NOT_ADOPTED'
    || value.coordinateRouteAdopted !== false || value.canvasAdopted !== false
    || !Array.isArray(value.projectedElements) || !Array.isArray(value.bendProjections)
    || !Array.isArray(value.sourceElementConservation) || !Array.isArray(value.inactiveCornerReferences)) {
    errors.push(diagnostic('PIPELINE_INPUTXML_GRE_PROJECTION_UNAUTHENTICATED'));
    return null;
  }
  const elements = value.projectedElements;
  elements.forEach((item, index) => {
    const zero = item?.fromNode === item?.toNode || (finite(item?.deltaX) && finite(item?.deltaY)
      && finite(item?.deltaZ) && Math.hypot(item.deltaX, item.deltaY, item.deltaZ) === 0);
    if (zero) errors.push(diagnostic('PIPELINE_INPUTXML_GRE_DOCUMENT_ZERO_LENGTH_ELEMENT', {
      projectionElementId: item?.id || '' }));
    else if (!projectedElementValid(item, index)) errors.push(diagnostic(
      'PIPELINE_INPUTXML_GRE_DOCUMENT_ELEMENT_INVALID', { projectionElementId: item?.id || '' }));
  });
  const byId = uniqueIndex(elements, 'id', 'PIPELINE_INPUTXML_GRE_DOCUMENT_ELEMENT_INVALID', errors);
  uniqueIndex(elements, 'materializedElementId', 'PIPELINE_INPUTXML_GRE_DOCUMENT_ELEMENT_INVALID', errors);
  nodeRegistry(elements, errors);
  const bends = value.bendProjections;
  uniqueIndex(bends, 'candidateId', 'PIPELINE_INPUTXML_GRE_DOCUMENT_CANDIDATE_CONSERVATION_INVALID', errors);
  uniqueIndex(bends, 'semanticGreBendElementId', 'PIPELINE_INPUTXML_GRE_DOCUMENT_BEND_OWNERSHIP_INVALID', errors);
  conservationValid(value, elements, bends, errors);
  const inactive = sorted(value.inactiveCornerReferences), bendInactive = sorted(bends.map((item) => item.inactiveCornerReferenceId));
  if (new Set(inactive).size !== inactive.length || !same(inactive, bendInactive)
    || elements.some((item) => inactive.includes(item.fromMaterializedNodeId)
      || inactive.includes(item.toMaterializedNodeId))) errors.push(diagnostic(
    'PIPELINE_INPUTXML_GRE_DOCUMENT_INACTIVE_CORNER_REAPPEARED'));
  const coverage = value.coverage || {};
  if (coverage.projectedElementCount !== elements.length || coverage.bendProjectionCount !== bends.length
    || coverage.sourceElementCount !== value.sourceElementConservation.length
    || coverage.inactiveCornerCount !== inactive.length) errors.push(diagnostic(
    'PIPELINE_INPUTXML_GRE_DOCUMENT_COUNT_MISMATCH'));
  return errors.length ? null : freeze({ plan: value, elements, bends, byId });
}

export function buildPipelineInputXmlGreDocumentConservation({ sourceDocumentPlan, projectionPlan,
  adoptedElements, bendAuthorities, projectionToDocumentId }, errors = []) {
  const sourceRecords = projectionPlan.sourceElementConservation.map((item) => {
    const emittedDocumentElementIds = item.emittedElementIds.map((id) => projectionToDocumentId[id]).filter(Boolean);
    const sourceElement = sourceDocumentPlan.elements[item.sourceElementIndex];
    if (!sourceElement || emittedDocumentElementIds.length === 0) errors.push(diagnostic(
      'PIPELINE_INPUTXML_GRE_DOCUMENT_SOURCE_CONSERVATION_INVALID', { sourceElementIndex: item.sourceElementIndex }));
    return createPipelineInputXmlGreDocumentSourceConservation({ sourceElementIndex: item.sourceElementIndex,
      sourceElementId: item.sourceElementId, analysisSectionId: sourceElement?.analysisSectionId || '',
      profileId: sourceElement?.profileId || '', successorMaterializedElementIds: item.successorMaterializedElementIds,
      successorProjectionElementIds: item.emittedElementIds, successorDocumentElementIds: emittedDocumentElementIds });
  });
  const candidateRecords = bendAuthorities.map((bend) => createPipelineInputXmlGreDocumentCandidateConservation({
    candidateId: bend.candidateId, semanticGreBendElementId: bend.semanticGreBendElementId,
    incomingOwnerProjectedElementId: bend.incomingOwnerProjectedElementId,
    incomingOwnerDocumentElementId: bend.incomingOwnerDocumentElementId,
    bendAuthorityId: bend.bendAuthorityId, analysisSectionId: bend.analysisSectionId }));
  if (sourceRecords.length !== projectionPlan.sourceElementConservation.length
    || candidateRecords.length !== projectionPlan.bendProjections.length
    || adoptedElements.length !== projectionPlan.projectedElements.length) errors.push(diagnostic(
    'PIPELINE_INPUTXML_GRE_DOCUMENT_COUNT_MISMATCH'));
  return freeze({ sourceRecords: Object.freeze(sourceRecords), candidateRecords: Object.freeze(candidateRecords) });
}

export const pipelineInputXmlGreDocumentAllowedSourceBlocker = GRE_BLOCKER;
