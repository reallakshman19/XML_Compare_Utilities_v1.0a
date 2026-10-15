import {
  PIPELINE_INPUTXML_GRE_ADOPTED_PROFILE_AUTHORITY_PLAN_SCHEMA,
  PIPELINE_INPUTXML_GRE_ADOPTED_PROFILE_AUTHORITY_SCHEMA,
  createPipelineInputXmlGreBendAuthority,
  createPipelineInputXmlGreDocumentAdoptionDiagnostic as diagnostic,
  createPipelineInputXmlGreDocumentAdoptionPlan,
  createPipelineInputXmlGreDocumentElement,
  freezePipelineInputXmlGreDocumentAdoptionValue as freeze,
  safePipelineInputXmlGreDocumentAdoptionInput as safe,
} from './pipeline-3d-model-inputxml-gre-document-adoption-contracts.js';
import {
  authenticatePipelineInputXmlGreProjectionPlan,
  authenticatePipelineInputXmlGreSourceDocumentPlan,
  buildPipelineInputXmlGreDocumentConservation,
  pipelineInputXmlGreDocumentAllowedSourceBlocker as GRE_BLOCKER,
} from './pipeline-3d-model-inputxml-gre-document-conservation.js';
export {
  PIPELINE_INPUTXML_GRE_ADOPTED_PROFILE_AUTHORITY_PLAN_SCHEMA,
  PIPELINE_INPUTXML_GRE_ADOPTED_PROFILE_AUTHORITY_SCHEMA,
  PIPELINE_INPUTXML_GRE_BEND_AUTHORITY_SCHEMA,
  PIPELINE_INPUTXML_GRE_DOCUMENT_ADOPTION_BLOCKER_ORDER,
  PIPELINE_INPUTXML_GRE_DOCUMENT_ADOPTION_PLAN_SCHEMA,
  PIPELINE_INPUTXML_GRE_DOCUMENT_CANDIDATE_CONSERVATION_SCHEMA,
  PIPELINE_INPUTXML_GRE_DOCUMENT_ELEMENT_SCHEMA,
  PIPELINE_INPUTXML_GRE_DOCUMENT_SOURCE_CONSERVATION_SCHEMA,
  buildPipelineInputXmlGreBendAuthoritiesTsv,
  buildPipelineInputXmlGreDocumentAdoptionPlanJson,
  buildPipelineInputXmlGreDocumentElementsTsv,
} from './pipeline-3d-model-inputxml-gre-document-adoption-contracts.js';

const text = (value) => typeof value === 'string' ? value.trim() : '';
const plain = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const exactPoint = (element, source, side) => ['X', 'Y', 'Z'].every((axis) =>
  element[`${side}${axis}`] === source[`${side}${axis}`]);

function emptyProperties(value) {
  if (Array.isArray(value)) return value.map(() => null);
  if (!plain(value)) return null;
  return Object.fromEntries(Object.keys(value).map((key) => [key,
    Array.isArray(value[key]) ? value[key].map(() => null) : null]));
}

function sourceSuccessors(projectedElements) {
  const result = Object.create(null);
  projectedElements.forEach((element) => {
    const index = element.sourceElementIndexes[0];
    (result[index] ||= []).push(element);
  });
  return result;
}

function sourceProfileFor(sourceElement, projection, errors) {
  if (!sourceElement || sourceElement.analysisSectionId !== projection.analysisSectionId
    || sourceElement.profileAuthority?.analysisSectionId !== projection.analysisSectionId
    || sourceElement.profileAuthority?.profileId !== sourceElement.profileId) {
    errors.push(diagnostic('PIPELINE_INPUTXML_GRE_DOCUMENT_SECTION_BOUNDARY_CONFLICT', {
      projectionElementId: projection.id, sourceElementIndex: projection.sourceElementIndexes[0] }));
    return null;
  }
  const sourceAuthority = sourceElement.profileAuthority;
  return freeze({ schema: PIPELINE_INPUTXML_GRE_ADOPTED_PROFILE_AUTHORITY_SCHEMA,
    sourceProfileAuthoritySchema: sourceAuthority.schema, sourceProfileAuthority: sourceAuthority,
    sourceElementIndex: sourceElement.index, sourceElementId: sourceElement.id,
    sourceProjectionElementId: projection.id, analysisSectionId: sourceElement.analysisSectionId,
    profileId: sourceElement.profileId, caesarDiameterMm: sourceAuthority.caesarDiameterMm,
    propertySectionId: sourceAuthority.propertySectionId,
    propertyDisposition: sourceAuthority.propertyDisposition,
    adoptionDisposition: sourceAuthority.blockerCodes?.includes(GRE_BLOCKER)
      ? 'GRE_PROJECTION_ADOPTED' : 'UNCHANGED', diagnostics: Object.freeze([]),
    blockerCodes: Object.freeze([]), ready: true });
}

function adoptedBase(projection, sourceElement, emittedProperties, profileAuthority) {
  return { id: '', index: -1, fromNode: projection.fromNode, toNode: projection.toNode,
    deltaX: projection.deltaX, deltaY: projection.deltaY, deltaZ: projection.deltaZ,
    fromX: projection.fromX, fromY: projection.fromY, fromZ: projection.fromZ,
    toX: projection.toX, toY: projection.toY, toZ: projection.toZ,
    fromMaterializedNodeId: projection.fromMaterializedNodeId,
    toMaterializedNodeId: projection.toMaterializedNodeId,
    analysisSectionId: sourceElement.analysisSectionId, profileId: sourceElement.profileId,
    line: text(sourceElement.line), emittedProperties, bend: null, profileAuthority,
    sourceProjectionElementId: projection.id,
    sourceMaterializedElementId: projection.materializedElementId,
    sourceElementIndexes: Object.freeze([...projection.sourceElementIndexes]),
    lineageDisposition: projection.lineageDisposition };
}

function buildElements(source, projection, errors) {
  const successors = sourceSuccessors(projection.projectedElements), adopted = [];
  projection.projectedElements.forEach((item, index) => {
    const sourceIndex = item.sourceElementIndexes[0], sourceElement = source.elements[sourceIndex];
    const profileAuthority = sourceProfileFor(sourceElement, item, errors);
    const ownerList = successors[sourceIndex] || [], first = ownerList[0] === item;
    const emittedProperties = first ? sourceElement?.emittedProperties
      : emptyProperties(sourceElement?.emittedProperties || {});
    if (!sourceElement || !profileAuthority || !plain(emittedProperties)) errors.push(diagnostic(
      'PIPELINE_INPUTXML_GRE_DOCUMENT_PROPERTY_CONFLICT', { projectionElementId: item.id }));
    const element = createPipelineInputXmlGreDocumentElement({
      ...adoptedBase(item, sourceElement || {}, emittedProperties || {}, profileAuthority || {}),
      id: `E${index + 1}`, index });
    adopted.push(element);
  });
  return { elements: adopted, successors };
}

function attachMetallicBends(source, state, errors) {
  const result = [...state.elements];
  source.elements.forEach((sourceElement, sourceIndex) => {
    if (!sourceElement.bend) return;
    const candidates = result.filter((item) => item.sourceElementIndexes[0] === sourceIndex
      && item.toNode === sourceElement.toNode && exactPoint(item, sourceElement, 'to'));
    if (candidates.length !== 1 || candidates[0].bend != null) {
      errors.push(diagnostic('PIPELINE_INPUTXML_GRE_DOCUMENT_BEND_OWNERSHIP_INVALID', {
        sourceElementIndex: sourceIndex }));
      return;
    }
    const owner = candidates[0], position = result.indexOf(owner);
    result[position] = createPipelineInputXmlGreDocumentElement({ ...owner, bend: sourceElement.bend });
  });
  return result;
}

function greAuthority(projectionBend, projectionElement, documentElement, sourceElement, sectionAuthority, errors) {
  const authority = sourceElement?.profileAuthority;
  const vendor = sectionAuthority?.greVendorSeriesAuthority;
  const analysisSectionId = projectionElement?.analysisSectionId || '';
  const evidence = sourceElement?.profileId === 'gre' && authority?.analysisSectionId === analysisSectionId
    && authority?.ready === false && authority?.blockerCodes?.includes(GRE_BLOCKER)
    && authority?.fittingCandidateId === projectionBend.candidateId
    && authority?.governingRadiusMm === projectionBend.radiusMm
    && authority?.fittingThicknessMm === projectionBend.fittingThicknessMm
    && vendor?.vendorId === projectionBend.vendorId && vendor?.seriesId === projectionBend.seriesId
    && vendor?.qualificationEvidenceId === projectionBend.qualificationEvidenceId
    && vendor?.requirementReference === projectionBend.requirementReference
    && vendor?.bendRadiusMm === projectionBend.radiusMm
    && vendor?.bendLocalThicknessMm === projectionBend.fittingThicknessMm
    && projectionElement?.id === projectionBend.incomingOwnerProjectionElementId
    && documentElement?.sourceProjectionElementId === projectionElement.id
    && documentElement?.toNode === projectionBend.incomingTangencyNodeNumber
    && documentElement?.toMaterializedNodeId === projectionBend.incomingTangencyNodeId;
  if (!evidence) {
    errors.push(diagnostic('PIPELINE_INPUTXML_GRE_DOCUMENT_VENDOR_CONFLICT', {
      candidateId: projectionBend.candidateId }));
    return null;
  }
  return createPipelineInputXmlGreBendAuthority({ bendAuthorityId: `gre-bend-authority:${projectionBend.candidateId}`,
    candidateId: projectionBend.candidateId, analysisSectionId,
    semanticGreBendElementId: projectionBend.semanticGreBendElementId,
    incomingOwnerProjectedElementId: projectionBend.incomingOwnerProjectionElementId,
    incomingOwnerDocumentElementId: documentElement.id,
    incomingSourceElementIndex: projectionBend.incomingSourceElementIndex,
    outgoingSourceElementIndex: projectionBend.outgoingSourceElementIndex,
    incomingTangencyNodeId: projectionBend.incomingTangencyNodeId,
    incomingTangencyNodeNumber: projectionBend.incomingTangencyNodeNumber,
    outgoingTangencyNodeId: projectionBend.outgoingTangencyNodeId,
    outgoingTangencyNodeNumber: projectionBend.outgoingTangencyNodeNumber,
    inactiveCornerNodeNumber: projectionBend.inactiveCornerNodeNumber,
    inactiveCornerReferenceId: projectionBend.inactiveCornerReferenceId,
    radiusMm: projectionBend.radiusMm, turnAngleDeg: projectionBend.turnAngleDeg,
    fittingThicknessMm: projectionBend.fittingThicknessMm,
    bendBreakLengthApplication: projectionBend.bendBreakLengthApplication,
    vendorId: projectionBend.vendorId, seriesId: projectionBend.seriesId,
    qualificationEvidenceId: projectionBend.qualificationEvidenceId,
    requirementReference: projectionBend.requirementReference,
    sourceAuthority: projectionBend.sourceAuthority, sourceReference: projectionBend.sourceReference });
}

function attachGreBends(source, projection, elements, errors) {
  const result = [...elements], byProjection = Object.fromEntries(projection.projectedElements.map((item) => [item.id, item]));
  const sectionById = Object.fromEntries(source.profileAuthorityPlan.sectionAuthorities.map((item) =>
    [item.analysisSectionId, item]));
  const byDocumentProjection = Object.fromEntries(result.map((item) => [item.sourceProjectionElementId, item]));
  const authorities = [];
  projection.bendProjections.forEach((bend) => {
    const projectionOwner = byProjection[bend.incomingOwnerProjectionElementId];
    const documentOwner = byDocumentProjection[bend.incomingOwnerProjectionElementId];
    const sourceIndex = projectionOwner?.sourceElementIndexes?.[0], sourceElement = source.elements[sourceIndex];
    if (!documentOwner || documentOwner.bend != null) {
      errors.push(diagnostic('PIPELINE_INPUTXML_GRE_DOCUMENT_BEND_OWNERSHIP_INVALID', {
        candidateId: bend.candidateId })); return;
    }
    const authority = greAuthority(bend, projectionOwner, documentOwner, sourceElement,
      sectionById[projectionOwner?.analysisSectionId], errors);
    if (!authority) return;
    const position = result.indexOf(documentOwner);
    result[position] = createPipelineInputXmlGreDocumentElement({ ...documentOwner, bend: authority });
    byDocumentProjection[bend.incomingOwnerProjectionElementId] = result[position];
    authorities.push(authority);
  });
  return { elements: result, authorities };
}

function documentRouteValid(elements, errors) {
  for (let index = 0; index < elements.length - 1; index += 1) {
    const left = elements[index], right = elements[index + 1];
    const direct = left.toNode === right.fromNode
      && left.toMaterializedNodeId === right.fromMaterializedNodeId
      && ['X', 'Y', 'Z'].every((axis) => left[`to${axis}`] === right[`from${axis}`]);
    const bridged = left.bend?.candidateId
      && left.bend.outgoingTangencyNodeNumber === right.fromNode
      && left.bend.outgoingTangencyNodeId === right.fromMaterializedNodeId;
    if (!direct && !bridged) errors.push(diagnostic(
      'PIPELINE_INPUTXML_GRE_DOCUMENT_NODE_IDENTITY_INVALID', { leftElementId: left.id, rightElementId: right.id }));
  }
}

function inactiveCornersValid(projection, elements, errors) {
  const ids = new Set(projection.inactiveCornerReferences);
  const numbers = new Set(projection.bendProjections.map((item) => item.inactiveCornerNodeNumber));
  if (elements.some((item) => ids.has(item.fromMaterializedNodeId) || ids.has(item.toMaterializedNodeId)
    || numbers.has(item.fromNode) || numbers.has(item.toNode))) errors.push(diagnostic(
    'PIPELINE_INPUTXML_GRE_DOCUMENT_INACTIVE_CORNER_REAPPEARED'));
}

function countPlan(source, projection, elements, authorities, conservation, errors) {
  const counts = freeze({ numElt: elements.length, numBend: elements.filter((item) => item.bend != null).length,
    sourceElementCount: source.elements.length, projectedElementCount: projection.projectedElements.length,
    adoptedElementCount: elements.length, greCandidateCount: projection.bendProjections.length,
    greBendAuthorityCount: authorities.length, inactiveCornerCount: projection.inactiveCornerReferences.length });
  const documentIds = new Set(elements.map((item) => item.id));
  const valid = counts.numElt === counts.adoptedElementCount
    && counts.projectedElementCount === counts.adoptedElementCount
    && counts.greCandidateCount === counts.greBendAuthorityCount
    && conservation.sourceRecords.length === counts.sourceElementCount
    && conservation.candidateRecords.length === counts.greCandidateCount
    && elements.every((item) => item.ready === true && item.elementKind !== 'GRE_BEND')
    && elements.every((item) => item.profileAuthority?.ready === true)
    && authorities.every((item) => item.ready === true && documentIds.has(item.incomingOwnerDocumentElementId));
  if (!valid) errors.push(diagnostic('PIPELINE_INPUTXML_GRE_DOCUMENT_COUNT_MISMATCH', counts));
  return counts;
}

function aborted(source, projection, errors) {
  return createPipelineInputXmlGreDocumentAdoptionPlan({ sourceDocumentPlanSchema: source?.schema || '',
    sourceProjectionPlanSchema: projection?.schema || '' }, [...errors,
    diagnostic('PIPELINE_INPUTXML_GRE_DOCUMENT_TRANSACTION_ABORTED')]);
}

export function buildPipelineInputXmlGreDocumentAdoptionPlan(input = {}) {
  const safeValue = safe(input), errors = [...safeValue.diagnostics];
  const source = authenticatePipelineInputXmlGreSourceDocumentPlan(safeValue.source.sourceDocumentPlan, errors);
  const projectionState = authenticatePipelineInputXmlGreProjectionPlan(safeValue.source.greProjectionPlan, errors);
  const projection = projectionState?.plan;
  if (!source || !projection) return aborted(source, projection, errors);
  if (projection.coverage.sourceElementCount !== source.elements.length) errors.push(diagnostic(
    'PIPELINE_INPUTXML_GRE_DOCUMENT_SOURCE_CONSERVATION_INVALID'));
  const base = buildElements(source, projection, errors);
  const metallic = attachMetallicBends(source, base, errors);
  const gre = attachGreBends(source, projection, metallic, errors);
  documentRouteValid(gre.elements, errors);
  inactiveCornersValid(projection, gre.elements, errors);
  const projectionToDocumentId = Object.fromEntries(gre.elements.map((item) =>
    [item.sourceProjectionElementId, item.id]));
  const conservation = buildPipelineInputXmlGreDocumentConservation({ sourceDocumentPlan: source,
    projectionPlan: projection, adoptedElements: gre.elements, bendAuthorities: gre.authorities,
    projectionToDocumentId }, errors);
  const counts = countPlan(source, projection, gre.elements, gre.authorities, conservation, errors);
  const sourceGreBlockers = source.blockerCodes.filter((code) => code === GRE_BLOCKER);
  if (sourceGreBlockers.length && (projection.bendProjections.length === 0
    || gre.authorities.length !== projection.bendProjections.length)) errors.push(diagnostic(
    'PIPELINE_INPUTXML_GRE_DOCUMENT_BEND_OWNERSHIP_INVALID'));
  if (errors.length) return aborted(source, projection, errors);
  const adoptedProfileAuthorityPlan = freeze({
    schema: PIPELINE_INPUTXML_GRE_ADOPTED_PROFILE_AUTHORITY_PLAN_SCHEMA,
    sourceProfileAuthorityPlanSchema: source.profileAuthorityPlan.schema,
    sectionAuthorities: source.profileAuthorityPlan.sectionAuthorities,
    elementAuthorities: gre.elements.map((item) => item.profileAuthority),
    diagnostics: Object.freeze([]), blockerCodes: Object.freeze([]), ready: true });
  return createPipelineInputXmlGreDocumentAdoptionPlan({ sourceDocumentPlanSchema: source.schema,
    sourceProjectionPlanSchema: projection.schema, namespace: source.namespace,
    extensionNamespace: source.extensionNamespace, xmlType: source.xmlType, version: source.version,
    metadata: source.metadata, propertySectionPlan: source.propertySectionPlan,
    profileAuthorityPlan: adoptedProfileAuthorityPlan, adoptedElements: gre.elements,
    greBendAuthorities: gre.authorities, sourceElementConservation: conservation.sourceRecords,
    candidateConservation: conservation.candidateRecords,
    inactiveCornerReferences: projection.inactiveCornerReferences,
    removedSourceBlockerCodes: sourceGreBlockers, counts });
}
