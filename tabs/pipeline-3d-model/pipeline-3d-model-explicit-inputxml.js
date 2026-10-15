import {
  PIPELINE_CANONICAL_NAMESPACE,
  PIPELINE_EXTENSION_NAMESPACE,
  PIPELINE_INPUTXML_DOCUMENT_SCHEMA,
  buildPipelineInputXmlDocumentPlan,
} from './pipeline-3d-model-inputxml-document.js?v=20260722-p3d-base-039-1';
import { PIPELINE_SECTION_PROPERTY_ASSIGNMENT_PLAN_SCHEMA } from './pipeline-3d-model-section-property-assignment.js';
import { PIPELINE_SECTION_PROFILE_ROUTING_PLAN_SCHEMA } from './pipeline-3d-model-section-profile-routing.js';

const text = (value) => String(value ?? '').trim();
const zeroCounts = Object.freeze({ numElt: 0, numNoz: 0, noHgrs: 0, numBend: 0,
  numRigid: 0, numExpJnt: 0, numRest: 0, numForcMnt: 0, numUnfLoad: 0,
  numWind: 0, numEleOff: 0, numAllow: 0, numISect: 0 });
function branchInfo(input) {
  const context = input?.exportContext;
  return context?.schema === 'PipelineUtilityExportContext.v1' ? context.branchInfo || {} : context || {};
}
function missingFields(value) {
  return ['jobName', 'caesarVersion', 'branchName', 'lineNo'].filter((key) => !text(value[key]));
}
function exactPlan(value, schema) {
  return value?.schema === schema && value.ready === true
    && Array.isArray(value.diagnostics) && Array.isArray(value.blockerCodes)
    && value.blockerCodes.length === 0;
}
function same(left, right) {
  try { return JSON.stringify(left) === JSON.stringify(right); } catch { return false; }
}
function authorityCodes(input) {
  if (input?.profileAuthorityPlans === undefined) return [];
  const codes = [];
  if (!exactPlan(input.sectionPropertyAssignmentPlan, PIPELINE_SECTION_PROPERTY_ASSIGNMENT_PLAN_SCHEMA)
    || !same(input.sectionPropertyAssignmentPlan, input.profileAuthorityPlans?.sectionPropertyAssignmentPlan)) {
    codes.push('PIPELINE_SECTION_PROPERTY_ASSIGNMENT_REQUIRED');
  }
  if (!exactPlan(input.sectionProfileRoutingPlan, PIPELINE_SECTION_PROFILE_ROUTING_PLAN_SCHEMA)
    || !same(input.sectionProfileRoutingPlan, input.profileAuthorityPlans?.sectionProfileRoutingPlan)) {
    codes.push('PIPELINE_SECTION_PROFILE_ROUTING_COVERAGE_INVALID');
  }
  return codes;
}
function blockedDocument(value, fields, codes = []) {
  const diagnostics = Object.freeze([
    ...fields.map((fieldId) => Object.freeze({ severity: 'BLOCKING',
      code: 'PIPELINE_CONFIGURATION_FIELD_REQUIRED', message: 'Explicit InputXML metadata is required.',
      details: Object.freeze({ fieldId }) })),
    ...codes.map((code) => Object.freeze({ severity: 'BLOCKING', code, message: code,
      details: Object.freeze({}) })),
  ]);
  return Object.freeze({ schema: PIPELINE_INPUTXML_DOCUMENT_SCHEMA,
    namespace: PIPELINE_CANONICAL_NAMESPACE, extensionNamespace: PIPELINE_EXTENSION_NAMESPACE,
    xmlType: 'Input', version: text(value.caesarVersion), metadata: Object.freeze({
      caesarVersion: text(value.caesarVersion), jobName: text(value.jobName), issueNo: text(value.issueNo),
      timeText: text(value.inputXmlTime ?? value.timeText), northX: 0, northY: 1, northZ: 0 }),
    counts: zeroCounts, propertySectionPlan: null, propertySectionPlanSchema: '', elements: Object.freeze([]),
    diagnostics, blockerCodes: Object.freeze([...new Set(diagnostics.map((item) => item.code))]),
    ready: false, resolvedMode: '' });
}
export function buildExplicitPipelineInputXmlDocumentPlan(input = {}) {
  const value = branchInfo(input), fields = missingFields(value), codes = authorityCodes(input);
  return fields.length || codes.length ? blockedDocument(value, fields, codes)
    : buildPipelineInputXmlDocumentPlan(input);
}
