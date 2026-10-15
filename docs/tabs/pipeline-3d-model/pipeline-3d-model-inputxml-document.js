import { PIPELINE_PROPERTY_SECTION_PLAN_SCHEMA, resolvePipelinePropertySectionPlan } from './pipeline-3d-model-property-sections.js?v=20260722-p3d-property-sections-1';
import { PIPELINE_MECHANICAL_PROPERTY_PLAN_SCHEMA, resolvePipelineMechanicalPropertyPlan } from './pipeline-3d-model-mechanical-property-sections.js';
import { PIPELINE_RESTRAINT_PLAN_SCHEMA, resolvePipelineRestraintPlan } from './pipeline-3d-model-restraint-plan.js';
import { PIPELINE_RIGID_PLAN_SCHEMA, resolvePipelineRigidPlan } from './pipeline-3d-model-rigid-plan.js';
import { PIPELINE_ALLOWABLE_STRESS_PLAN_SCHEMA, resolvePipelineAllowableStressPlan } from './pipeline-3d-model-allowable-stress-plan.js';
import { PIPELINE_PIPING_CODE_AUTHORITY_PLAN_SCHEMA, resolvePipelinePipingCodeAuthorityPlan } from './pipeline-3d-model-piping-code-authority.js';
import { PIPELINE_ALLOWABLE_VALUE_AUTHORITY_PLAN_SCHEMA, resolvePipelineAllowableValueAuthorityPlan } from './pipeline-3d-model-allowable-value-authority.js';
import { buildPipelineInputXmlProfileAuthorityPlan, PIPELINE_INPUTXML_PROFILE_AUTHORITY_PLAN_SCHEMA } from './pipeline-3d-model-inputxml-profile-authority.js';
import { adoptPipelineApprovedCatalogRegistryIntoInputXmlDocumentPlan } from './pipeline-3d-model-approved-catalog-document.js';
export const PIPELINE_INPUTXML_DOCUMENT_SCHEMA = 'PipelineInputXmlDocumentPlan.v1';
export const PIPELINE_INPUTXML_ELEMENT_SCHEMA = 'PipelineInputXmlElementPlan.v1';
export const PIPELINE_CANONICAL_NAMESPACE = 'COADE';
export const PIPELINE_EXTENSION_NAMESPACE = 'urn:reallaksh19:inputxml:extension:v1';
export const DEFAULT_PIPELINE_INPUTXML_METADATA = Object.freeze({
  caesarVersion: '11.00', jobName: 'PIPELINE_3D_MODEL', issueNo: '',
  northX: 0, northY: 1, northZ: 0,
});
function text(value) { return String(value ?? '').trim(); }
function plain(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value)));
}
function deepClone(value) {
  if (value === undefined) return null;
  if (value === null || ['string', 'boolean'].includes(typeof value)) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(deepClone);
  if (!plain(value)) throw new TypeError('Document evidence must be JSON-safe plain data.');
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, deepClone(item)]));
}
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze); return Object.freeze(value);
}
function branchInfoFrom(input = {}) {
  if (input?.schema === 'PipelineUtilityExportContext.v1') return input.branchInfo || {};
  if (input?.exportContext?.schema === 'PipelineUtilityExportContext.v1') {
    return input.exportContext.branchInfo || {};
  }
  return input?.branchInfo || input || {};
}
function diagnostic(code, message, details = {}) {
  return Object.freeze({ severity: 'BLOCKING', code, message, details: Object.freeze({ ...details }) });
}
function normalizedMetadata(branchInfo) {
  const defaults = DEFAULT_PIPELINE_INPUTXML_METADATA;
  return Object.freeze({
    caesarVersion: text(branchInfo.caesarVersion) || defaults.caesarVersion,
    jobName: text(branchInfo.jobName) || defaults.jobName,
    issueNo: text(branchInfo.issueNo),
    timeText: text(branchInfo.inputXmlTime ?? branchInfo.timeText),
    northX: defaults.northX, northY: defaults.northY, northZ: defaults.northZ,
  });
}
function nodePairValid(fromRow, toRow) {
  const from = Number(fromRow?.nodeNumber), to = Number(toRow?.nodeNumber);
  return Number.isInteger(from) && from > 0 && Number.isInteger(to) && to > 0 && from !== to;
}
function coordinateValues(row) { return [Number(row?.x), Number(row?.y), Number(row?.z)]; }
function elementDiagnostics(fromRow, toRow, index) {
  const messages = [];
  if (!nodePairValid(fromRow, toRow)) messages.push(diagnostic(
    'PIPELINE_NODE_PAIR_INVALID',
    `Element E${index + 1} requires distinct positive integer node identifiers.`,
    { fromNode: fromRow?.nodeNumber, toNode: toRow?.nodeNumber },
  ));
  const coordinates = [...coordinateValues(fromRow), ...coordinateValues(toRow)];
  if (!coordinates.every(Number.isFinite)) {
    messages.push(diagnostic('PIPELINE_GEOMETRY_NONFINITE',
      `Element E${index + 1} contains a non-finite endpoint coordinate.`, { fromRow, toRow }));
    return messages;
  }
  const delta = coordinates.slice(3).map((value, axis) => value - coordinates[axis]);
  if (delta.every((value) => value === 0)) messages.push(diagnostic(
    'PIPELINE_ZERO_LENGTH_ELEMENT', `Element E${index + 1} has zero-length geometry.`,
    { fromNode: fromRow?.nodeNumber, toNode: toRow?.nodeNumber },
  ));
  return messages;
}
function bendForIndex(bendResolution, index) {
  return bendResolution?.bendByIncomingElementIndex?.[index] || null;
}
function restraintFields(restraintResolution) {
  if (!restraintResolution?.realRestraintCount) return {};
  return {
    restraintCount: restraintResolution.realRestraintCount,
    restraintSlots: restraintResolution.slots || Object.freeze([]),
  };
}
function rigidFields(rigidResolution) {
  return rigidResolution?.rigid ? { rigid: rigidResolution.rigid } : {};
}
function allowableFields(allowableResolution) {
  return allowableResolution?.allowableStress
    ? { allowableStress: allowableResolution.allowableStress } : {};
}
function buildElement(fromRow, toRow, index, lineNo, propertyResolution,
  mechanicalResolution, restraintResolution, rigidResolution, allowableResolution,
  bendResolution) {
  const [fromX, fromY, fromZ] = coordinateValues(fromRow);
  const [toX, toY, toZ] = coordinateValues(toRow);
  const mechanical = mechanicalResolution ? {
    mechanicalPropertySectionId: mechanicalResolution.sectionId || '',
    mechanicalPropertyDisposition: mechanicalResolution.propertyDisposition || '',
    mechanicalProperties: mechanicalResolution.properties || Object.freeze({}),
    emittedMechanicalProperties: mechanicalResolution.emittedProperties || Object.freeze({}),
  } : {};
  return Object.freeze({
    schema: PIPELINE_INPUTXML_ELEMENT_SCHEMA,
    id: `E${index + 1}`,
    index,
    fromNode: Number(fromRow?.nodeNumber),
    toNode: Number(toRow?.nodeNumber),
    deltaX: toX - fromX,
    deltaY: toY - fromY,
    deltaZ: toZ - fromZ,
    fromX, fromY, fromZ, toX, toY, toZ,
    fromName: text(fromRow?.nodeName),
    toName: text(toRow?.nodeName),
    line: lineNo,
    propertySectionId: propertyResolution?.sectionId || '',
    propertyDisposition: propertyResolution?.propertyDisposition || '',
    properties: propertyResolution?.properties || Object.freeze({}),
    emittedProperties: propertyResolution?.emittedProperties || Object.freeze({}),
    ...mechanical,
    ...restraintFields(restraintResolution),
    ...rigidFields(rigidResolution),
    ...allowableFields(allowableResolution),
    bend: bendForIndex(bendResolution, index),
    diagnostics: Object.freeze(elementDiagnostics(fromRow, toRow, index)),
  });
}
function globalDiagnostics(branchInfo, coordinateRows) {
  const messages = [];
  if (coordinateRows.length < 2) messages.push(diagnostic(
    'PIPELINE_GEOMETRY_SEGMENT_REQUIRED', 'At least two coordinate rows are required for a PIPINGELEMENT.'));
  if (!text(branchInfo.lineNo)) messages.push(diagnostic(
    'PIPELINE_LINE_NUMBER_REQUIRED', 'Canonical InputXML requires a nonblank LINE value.'));
  return messages;
}
function contextDiagnostics(exportContext) {
  return (exportContext?.readiness?.blockerCodes || []).map((code) => diagnostic(
    text(code) || 'PIPELINE_EXPORT_CONTEXT_BLOCKED',
    code === 'GRE_BEND_POLICY_NOT_IMPLEMENTED'
      ? 'GRE fitting emission requires the future independent resolver.'
      : 'The resolved Pipeline export context blocks canonical InputXML.',
    { resolvedMode: text(exportContext?.profile?.resolvedMode) },
  ));
}
function bendDiagnostics(bendResolution) {
  return (bendResolution?.errors || []).map((item) => diagnostic(
    text(item?.code) || 'BEND_GEOMETRY_BLOCKED',
    text(item?.message) || 'Bend resolution blocks canonical InputXML.', item?.details || {},
  ));
}
function restraintDiagnostics(restraintPlan, metadata) {
  const diagnostics = [...(restraintPlan?.diagnostics || [])];
  if (restraintPlan?.active && metadata.caesarVersion !== '14.00') diagnostics.push(diagnostic(
    'PIPELINE_RESTRAINT_CAESAR14_REQUIRED',
    'The common restraint payload is admitted only by the CAESAR 14 writer profile.',
    { caesarVersion: metadata.caesarVersion },
  ));
  return diagnostics;
}
function rigidDiagnostics(rigidPlan, metadata) {
  const diagnostics = [...(rigidPlan?.diagnostics || [])];
  if (rigidPlan?.active && metadata.caesarVersion !== '14.00') diagnostics.push(diagnostic(
    'PIPELINE_RIGID_CAESAR14_REQUIRED',
    'The common rigid payload is admitted only by the CAESAR 14 writer profile.',
    { caesarVersion: metadata.caesarVersion },
  ));
  return diagnostics;
}
function allowableDiagnostics(allowableStressPlan, metadata) {
  const diagnostics = [...(allowableStressPlan?.diagnostics || [])];
  if (allowableStressPlan?.active && metadata.caesarVersion !== '14.00') diagnostics.push(diagnostic(
    'PIPELINE_ALLOWABLE_CAESAR14_REQUIRED',
    'The common allowable-stress payload is admitted only by the CAESAR 14 writer profile.',
    { caesarVersion: metadata.caesarVersion },
  ));
  return diagnostics;
}
function uniqueDiagnostics(items) {
  const keys = new Set();
  return items.filter((item) => {
    const key = `${item.code}:${JSON.stringify(item.details)}`;
    if (keys.has(key)) return false; keys.add(key); return true;
  });
}
function uniqueCodes(diagnostics) {
  return Object.freeze([...new Set(diagnostics.map((item) => item.code))]);
}
function modelCounts(elements) {
  return Object.freeze({
    numElt: elements.length, numNoz: 0, noHgrs: 0,
    numBend: elements.filter((element) => Number(element.bend?.radiusMm) > 0).length,
    numRigid: elements.filter((element) => element.rigid != null).length,
    numExpJnt: 0,
    numRest: elements.reduce((sum, element) => sum + Number(element.restraintCount || 0), 0),
    numForcMnt: 0, numUnfLoad: 0, numWind: 0, numEleOff: 0,
    numAllow: elements.filter((element) => element.allowableStress != null).length,
    numISect: 0,
  });
}
function profileAuthorityAuthenticated(plan) {
  if (plan?.schema !== PIPELINE_INPUTXML_PROFILE_AUTHORITY_PLAN_SCHEMA) return false;
  const invalid = new Set([
    'PIPELINE_INPUTXML_AUTHORITY_INPUT_INVALID', 'PIPELINE_INPUTXML_AUTHORITY_SCHEMA_INVALID',
    'PIPELINE_INPUTXML_AUTHORITY_OWNERSHIP_INVALID', 'PIPELINE_INPUTXML_AUTHORITY_COVERAGE_INVALID',
    'PIPELINE_INPUTXML_DIAMETER_CONFLICT', 'PIPELINE_INPUTXML_PROPERTY_CONFLICT',
  ]);
  return !(plan.blockerCodes || []).some((code) => invalid.has(code));
}
function adoptedProfileBend(currentBend, authority) {
  if (!currentBend) return null;
  const cloned = deepClone(currentBend);
  cloned.radiusMm = authority.governingRadiusMm;
  cloned.fittingThicknessMm = authority.fittingThicknessMm;
  return deepFreeze(cloned);
}
function profileElement(element, authority, bendResolution) {
  const matched = authority?.geometryDisposition === 'MATCHES_AUTHORITY'
    && authority?.writerDisposition === 'READY';
  const bend = matched
    ? adoptedProfileBend(bendForIndex(bendResolution, element.index), authority) : null;
  const emittedProperties = Object.freeze({
    ...element.emittedProperties, diameter: authority?.caesarDiameterMm ?? null,
  });
  const diagnostics = deepFreeze(deepClone([
    ...element.diagnostics, ...(authority?.diagnostics || []),
  ]));
  return deepFreeze({
    ...element,
    emittedProperties,
    bend,
    analysisSectionId: authority?.analysisSectionId || '',
    profileId: authority?.profileId || '',
    resolvedMode: authority?.resolvedMode || '',
    caesarDiameterMm: authority?.caesarDiameterMm ?? null,
    diameterSourceKind: authority?.diameterSourceKind || '',
    fittingCandidateId: authority?.fittingCandidateId || '',
    fittingAuthorityKind: authority?.fittingAuthorityKind || '',
    fittingPolicyId: authority?.fittingPolicyId || '',
    governingRadiusMm: authority?.governingRadiusMm ?? null,
    fittingThicknessMm: authority?.fittingThicknessMm ?? null,
    geometryDisposition: authority?.geometryDisposition || 'NOT_A_TURN',
    writerDisposition: authority?.writerDisposition || 'BLOCKED',
    profileAuthority: authority ? deepFreeze(deepClone(authority)) : null,
    diagnostics,
  });
}
function adoptedAllowableValueElements(elements, plan) {
  if (!plan?.active) return elements;
  return deepFreeze(elements.map((element, index) => {
    const allowableStress = plan.elements[index]?.allowableStress || null;
    const next = { ...element };
    if (allowableStress) next.allowableStress = allowableStress;
    else delete next.allowableStress;
    return next;
  }));
}
function profileDocumentPlan({
  exportContext, coordinateRows, bendResolution, propertySectionPlan,
  mechanicalPropertyPlan, restraintPlan, rigidPlan, allowableStressPlan,
  pipingCodeAuthorities, allowableValueAuthorities, profileAuthorityPlans, branchInfo, lineNo,
}) {
  const profileAuthorityPlan = buildPipelineInputXmlProfileAuthorityPlan({
    ...(profileAuthorityPlans || {}), bendResolution, propertySectionPlan,
  });
  const pipingCodeAuthorityPlan = resolvePipelinePipingCodeAuthorityPlan({
    profileAuthorityPlan, allowableStressPlan, pipingCodeAuthorities,
  });
  const allowableElements = pipingCodeAuthorityPlan.active
    ? pipingCodeAuthorityPlan.elements : allowableStressPlan.elements;
  const baseElements = coordinateRows.slice(1).map((toRow, index) => buildElement(
    coordinateRows[index], toRow, index, lineNo,
    propertySectionPlan.elements[index], mechanicalPropertyPlan.active ? mechanicalPropertyPlan.elements[index] : null,
    restraintPlan.active ? restraintPlan.elements[index] : null,
    rigidPlan.active ? rigidPlan.elements[index] : null,
    allowableStressPlan.active ? allowableElements[index] : null, bendResolution,
  ));
  const profileElements = Object.freeze(baseElements.map((element, index) =>
    profileElement(element, profileAuthorityPlan.elementAuthorities[index], bendResolution)));
  const allowableValueAuthorityPlan = resolvePipelineAllowableValueAuthorityPlan({
    profileAuthorityPlan, pipingCodeAuthorityPlan, elements: profileElements,
    allowableValueAuthorities,
  });
  const elements = adoptedAllowableValueElements(profileElements, allowableValueAuthorityPlan);
  const replaceGreBlocker = profileAuthorityAuthenticated(profileAuthorityPlan);
  const replaceableGreCodes = new Set([
    'GRE_BEND_POLICY_NOT_IMPLEMENTED', 'GRE_BEND_POLICY_NOT_IMPLEMEMTED',
  ]);
  const context = contextDiagnostics(exportContext).filter((item) =>
    !(replaceGreBlocker && replaceableGreCodes.has(item.code)));
  const propertyDiagnostics = propertySectionPlan.diagnostics.filter((item) =>
    item.code !== 'PIPELINE_DIAMETER_REQUIRED');
  const metadata = normalizedMetadata(branchInfo);
  const diagnostics = deepFreeze(deepClone(uniqueDiagnostics([
    ...profileAuthorityPlan.diagnostics,
    ...context,
    ...globalDiagnostics(branchInfo, coordinateRows),
    ...propertyDiagnostics,
    ...mechanicalPropertyPlan.diagnostics,
    ...restraintDiagnostics(restraintPlan, metadata),
    ...rigidDiagnostics(rigidPlan, metadata),
    ...allowableDiagnostics(allowableStressPlan, metadata),
    ...pipingCodeAuthorityPlan.diagnostics,
    ...allowableValueAuthorityPlan.diagnostics,
    ...elements.flatMap((element) => element.diagnostics),
    ...bendDiagnostics(bendResolution),
  ])));
  return deepFreeze({
    schema: PIPELINE_INPUTXML_DOCUMENT_SCHEMA,
    namespace: PIPELINE_CANONICAL_NAMESPACE,
    extensionNamespace: PIPELINE_EXTENSION_NAMESPACE,
    xmlType: 'Input',
    version: metadata.caesarVersion,
    metadata,
    counts: modelCounts(elements),
    propertySectionPlan,
    propertySectionPlanSchema: PIPELINE_PROPERTY_SECTION_PLAN_SCHEMA,
    ...(mechanicalPropertyPlan.active ? { mechanicalPropertyPlan, mechanicalPropertyPlanSchema: PIPELINE_MECHANICAL_PROPERTY_PLAN_SCHEMA } : {}),
    ...(restraintPlan.active ? { restraintPlan, restraintPlanSchema: PIPELINE_RESTRAINT_PLAN_SCHEMA } : {}),
    ...(rigidPlan.active ? { rigidPlan, rigidPlanSchema: PIPELINE_RIGID_PLAN_SCHEMA } : {}),
    ...(allowableStressPlan.active ? { allowableStressPlan, allowableStressPlanSchema: PIPELINE_ALLOWABLE_STRESS_PLAN_SCHEMA } : {}),
    ...(pipingCodeAuthorityPlan.active ? { pipingCodeAuthorityPlan, pipingCodeAuthorityPlanSchema: PIPELINE_PIPING_CODE_AUTHORITY_PLAN_SCHEMA } : {}),
    ...(allowableValueAuthorityPlan.active ? { allowableValueAuthorityPlan, allowableValueAuthorityPlanSchema: PIPELINE_ALLOWABLE_VALUE_AUTHORITY_PLAN_SCHEMA } : {}),
    profileAuthorityPlan,
    profileAuthorityPlanSchema: PIPELINE_INPUTXML_PROFILE_AUTHORITY_PLAN_SCHEMA,
    analysisSectionPlanSchema: profileAuthorityPlan.analysisSectionPlanSchema,
    analysisDiameterPlanSchema: profileAuthorityPlan.analysisDiameterPlanSchema,
    normalFittingPlanSchema: profileAuthorityPlan.normalFittingPlanSchema,
    b314RadiusPlanSchema: profileAuthorityPlan.b314RadiusPlanSchema,
    greVendorSeriesPlanSchema: profileAuthorityPlan.greVendorSeriesPlanSchema,
    bendResolutionSchema: profileAuthorityPlan.bendResolutionSchema,
    elements,
    diagnostics,
    blockerCodes: uniqueCodes(diagnostics),
    ready: diagnostics.length === 0,
    resolvedMode: text(exportContext?.profile?.resolvedMode),
  });
}
export function buildPipelineInputXmlDocumentPlan(input = {}) {
  const registrySupplied = Object.hasOwn(input, 'approvedCatalogRegistry');
  const {
    exportContext = {}, coordinateRows = [], bendResolution = null, propertySections = [],
    restraints = [], rigids = [], allowableStresses = [], pipingCodeAuthorities = [],
    allowableValueAuthorities = [], profileAuthorityPlans, approvedCatalogRegistry,
  } = input;
  const adoptIfSupplied = (documentPlan) => registrySupplied
    ? adoptPipelineApprovedCatalogRegistryIntoInputXmlDocumentPlan({
      documentPlan, approvedCatalogRegistry,
    })
    : documentPlan;
  const branchInfo = branchInfoFrom(exportContext), lineNo = text(branchInfo.lineNo);
  const propertySectionPlan = resolvePipelinePropertySectionPlan({
    branchInfo, coordinateRows, propertySections,
  });
  const mechanicalPropertyPlan = resolvePipelineMechanicalPropertyPlan({
    branchInfo, propertySections, propertySectionPlan,
  });
  const restraintPlan = resolvePipelineRestraintPlan({ restraints, coordinateRows });
  const rigidPlan = resolvePipelineRigidPlan({ rigids, coordinateRows });
  const allowableStressPlan = resolvePipelineAllowableStressPlan({
    allowableStresses, coordinateRows,
  });
  if (profileAuthorityPlans !== undefined) return adoptIfSupplied(profileDocumentPlan({
    exportContext, coordinateRows, bendResolution, propertySectionPlan,
    mechanicalPropertyPlan, restraintPlan, rigidPlan, allowableStressPlan,
    pipingCodeAuthorities, allowableValueAuthorities, profileAuthorityPlans, branchInfo, lineNo,
  }));
  const pipingCodeAuthorityPlan = resolvePipelinePipingCodeAuthorityPlan({
    profileAuthorityPlan: null, allowableStressPlan, pipingCodeAuthorities,
  });
  const elements = Object.freeze(coordinateRows.slice(1).map((toRow, index) =>
    buildElement(coordinateRows[index], toRow, index, lineNo,
      propertySectionPlan.elements[index], mechanicalPropertyPlan.active ? mechanicalPropertyPlan.elements[index] : null,
      restraintPlan.active ? restraintPlan.elements[index] : null,
      rigidPlan.active ? rigidPlan.elements[index] : null,
      allowableStressPlan.active ? allowableStressPlan.elements[index] : null, bendResolution)));
  const allowableValueAuthorityPlan = resolvePipelineAllowableValueAuthorityPlan({
    profileAuthorityPlan: null, pipingCodeAuthorityPlan, elements, allowableValueAuthorities,
  });
  const metadata = normalizedMetadata(branchInfo);
  const diagnostics = Object.freeze(uniqueDiagnostics([
    ...contextDiagnostics(exportContext),
    ...globalDiagnostics(branchInfo, coordinateRows),
    ...propertySectionPlan.diagnostics,
    ...mechanicalPropertyPlan.diagnostics,
    ...restraintDiagnostics(restraintPlan, metadata),
    ...rigidDiagnostics(rigidPlan, metadata),
    ...allowableDiagnostics(allowableStressPlan, metadata),
    ...pipingCodeAuthorityPlan.diagnostics,
    ...allowableValueAuthorityPlan.diagnostics,
    ...elements.flatMap((element) => element.diagnostics),
    ...bendDiagnostics(bendResolution),
  ]));
  return adoptIfSupplied(Object.freeze({
    schema: PIPELINE_INPUTXML_DOCUMENT_SCHEMA,
    namespace: PIPELINE_CANONICAL_NAMESPACE,
    extensionNamespace: PIPELINE_EXTENSION_NAMESPACE,
    xmlType: 'Input',
    version: metadata.caesarVersion,
    metadata,
    counts: modelCounts(elements),
    propertySectionPlan,
    propertySectionPlanSchema: PIPELINE_PROPERTY_SECTION_PLAN_SCHEMA,
    ...(mechanicalPropertyPlan.active ? { mechanicalPropertyPlan, mechanicalPropertyPlanSchema: PIPELINE_MECHANICAL_PROPERTY_PLAN_SCHEMA } : {}),
    ...(restraintPlan.active ? { restraintPlan, restraintPlanSchema: PIPELINE_RESTRAINT_PLAN_SCHEMA } : {}),
    ...(rigidPlan.active ? { rigidPlan, rigidPlanSchema: PIPELINE_RIGID_PLAN_SCHEMA } : {}),
    ...(allowableStressPlan.active ? { allowableStressPlan, allowableStressPlanSchema: PIPELINE_ALLOWABLE_STRESS_PLAN_SCHEMA } : {}),
    ...(pipingCodeAuthorityPlan.active ? { pipingCodeAuthorityPlan, pipingCodeAuthorityPlanSchema: PIPELINE_PIPING_CODE_AUTHORITY_PLAN_SCHEMA } : {}),
    ...(allowableValueAuthorityPlan.active ? { allowableValueAuthorityPlan, allowableValueAuthorityPlanSchema: PIPELINE_ALLOWABLE_VALUE_AUTHORITY_PLAN_SCHEMA } : {}),
    elements,
    diagnostics,
    blockerCodes: uniqueCodes(diagnostics),
    ready: diagnostics.length === 0,
    resolvedMode: text(exportContext?.profile?.resolvedMode),
  }));
}
export function buildPipelineInputXmlDocumentPlanJson(plan) {
  return JSON.stringify(plan, null, 2);
}
