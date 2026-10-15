export const PIPELINE_INPUTXML_GRE_DOCUMENT_ADOPTION_PLAN_SCHEMA = 'PipelineInputXmlGreDocumentAdoptionPlan.v1';
export const PIPELINE_INPUTXML_GRE_DOCUMENT_ELEMENT_SCHEMA = 'PipelineInputXmlGreDocumentElementAuthority.v1';
export const PIPELINE_INPUTXML_GRE_BEND_AUTHORITY_SCHEMA = 'PipelineInputXmlGreBendAuthority.v1';
export const PIPELINE_INPUTXML_GRE_ADOPTED_PROFILE_AUTHORITY_SCHEMA = 'PipelineInputXmlGreAdoptedProfileAuthority.v1';
export const PIPELINE_INPUTXML_GRE_ADOPTED_PROFILE_AUTHORITY_PLAN_SCHEMA = 'PipelineInputXmlGreAdoptedProfileAuthorityPlan.v1';
export const PIPELINE_INPUTXML_GRE_DOCUMENT_SOURCE_CONSERVATION_SCHEMA = 'PipelineInputXmlGreDocumentSourceConservation.v1';
export const PIPELINE_INPUTXML_GRE_DOCUMENT_CANDIDATE_CONSERVATION_SCHEMA = 'PipelineInputXmlGreDocumentCandidateConservation.v1';
export const PIPELINE_INPUTXML_GRE_DOCUMENT_ADOPTION_BLOCKER_ORDER = Object.freeze([
  'PIPELINE_INPUTXML_GRE_DOCUMENT_ADOPTION_INPUT_INVALID',
  'PIPELINE_INPUTXML_GRE_SOURCE_DOCUMENT_INVALID',
  'PIPELINE_INPUTXML_GRE_PROJECTION_UNAUTHENTICATED',
  'PIPELINE_INPUTXML_GRE_PROFILE_AUTHORITY_INVALID',
  'PIPELINE_INPUTXML_GRE_DOCUMENT_ELEMENT_INVALID',
  'PIPELINE_INPUTXML_GRE_DOCUMENT_NODE_IDENTITY_INVALID',
  'PIPELINE_INPUTXML_GRE_DOCUMENT_SECTION_BOUNDARY_CONFLICT',
  'PIPELINE_INPUTXML_GRE_DOCUMENT_PROPERTY_CONFLICT',
  'PIPELINE_INPUTXML_GRE_DOCUMENT_BEND_OWNERSHIP_INVALID',
  'PIPELINE_INPUTXML_GRE_DOCUMENT_VENDOR_CONFLICT',
  'PIPELINE_INPUTXML_GRE_DOCUMENT_INACTIVE_CORNER_REAPPEARED',
  'PIPELINE_INPUTXML_GRE_DOCUMENT_SOURCE_CONSERVATION_INVALID',
  'PIPELINE_INPUTXML_GRE_DOCUMENT_CANDIDATE_CONSERVATION_INVALID',
  'PIPELINE_INPUTXML_GRE_DOCUMENT_ZERO_LENGTH_ELEMENT',
  'PIPELINE_INPUTXML_GRE_DOCUMENT_COUNT_MISMATCH',
  'PIPELINE_INPUTXML_GRE_DOCUMENT_TRANSACTION_ABORTED',
]);

const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const text = (value) => typeof value === 'string' ? value.trim() : '';
const plain = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value)));

export function clonePipelineInputXmlGreDocumentAdoptionValue(value) {
  if (value === undefined) return null;
  if (value === null || ['string', 'boolean'].includes(typeof value)) return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Document-adoption numbers must be finite.');
    return value;
  }
  if (Array.isArray(value)) return value.map(clonePipelineInputXmlGreDocumentAdoptionValue);
  if (!plain(value)) throw new TypeError('Document-adoption evidence must be JSON-safe plain data.');
  return Object.fromEntries(Object.keys(value).sort(compare)
    .map((key) => [key, clonePipelineInputXmlGreDocumentAdoptionValue(value[key])]));
}

export function freezePipelineInputXmlGreDocumentAdoptionValue(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freezePipelineInputXmlGreDocumentAdoptionValue);
  return Object.freeze(value);
}

export function createPipelineInputXmlGreDocumentAdoptionDiagnostic(code, details = {}) {
  return freezePipelineInputXmlGreDocumentAdoptionValue({ severity: 'BLOCKING', code: text(code),
    message: text(code), details: clonePipelineInputXmlGreDocumentAdoptionValue(details) });
}

function rank(code) {
  const index = PIPELINE_INPUTXML_GRE_DOCUMENT_ADOPTION_BLOCKER_ORDER.indexOf(code);
  return index < 0 ? PIPELINE_INPUTXML_GRE_DOCUMENT_ADOPTION_BLOCKER_ORDER.length : index;
}

export function finalizePipelineInputXmlGreDocumentAdoptionState(values = []) {
  const keyed = Object.create(null);
  values.filter(plain).filter((item) => text(item.code)).forEach((item) => {
    const normalized = freezePipelineInputXmlGreDocumentAdoptionValue({
      severity: text(item.severity) || 'BLOCKING', code: text(item.code),
      message: text(item.message) || text(item.code),
      details: plain(item.details) ? clonePipelineInputXmlGreDocumentAdoptionValue(item.details) : {},
    });
    keyed[`${normalized.code}:${JSON.stringify(normalized.details)}`] = normalized;
  });
  const diagnostics = Object.freeze(Object.values(keyed).sort((a, b) => rank(a.code) - rank(b.code)
    || compare(a.code, b.code) || compare(JSON.stringify(a.details), JSON.stringify(b.details))));
  const blockerCodes = Object.freeze([...new Set(diagnostics.map((item) => item.code))]
    .sort((a, b) => rank(a) - rank(b) || compare(a, b)));
  return { diagnostics, blockerCodes, ready: blockerCodes.length === 0 };
}

export function safePipelineInputXmlGreDocumentAdoptionInput(input) {
  try {
    const source = clonePipelineInputXmlGreDocumentAdoptionValue(input);
    if (plain(source)) return { source, diagnostics: [] };
  } catch { /* Fail closed. */ }
  return { source: {}, diagnostics: [createPipelineInputXmlGreDocumentAdoptionDiagnostic(
    'PIPELINE_INPUTXML_GRE_DOCUMENT_ADOPTION_INPUT_INVALID')] };
}

function record(schema, input = {}, diagnostics = []) {
  const state = finalizePipelineInputXmlGreDocumentAdoptionState(diagnostics);
  return freezePipelineInputXmlGreDocumentAdoptionValue({ schema,
    ...clonePipelineInputXmlGreDocumentAdoptionValue(input), diagnostics: state.diagnostics,
    blockerCodes: state.blockerCodes, ready: state.ready });
}

export const createPipelineInputXmlGreDocumentElement = (input, diagnostics = []) =>
  record(PIPELINE_INPUTXML_GRE_DOCUMENT_ELEMENT_SCHEMA, input, diagnostics);
export const createPipelineInputXmlGreBendAuthority = (input, diagnostics = []) =>
  record(PIPELINE_INPUTXML_GRE_BEND_AUTHORITY_SCHEMA, input, diagnostics);
export const createPipelineInputXmlGreDocumentSourceConservation = (input, diagnostics = []) =>
  record(PIPELINE_INPUTXML_GRE_DOCUMENT_SOURCE_CONSERVATION_SCHEMA, input, diagnostics);
export const createPipelineInputXmlGreDocumentCandidateConservation = (input, diagnostics = []) =>
  record(PIPELINE_INPUTXML_GRE_DOCUMENT_CANDIDATE_CONSERVATION_SCHEMA, input, diagnostics);

export function createPipelineInputXmlGreDocumentAdoptionPlan(input = {}, diagnostics = []) {
  const state = finalizePipelineInputXmlGreDocumentAdoptionState(diagnostics);
  const ready = state.ready;
  const zeroCounts = { numElt: 0, numBend: 0, sourceElementCount: 0, projectedElementCount: 0,
    adoptedElementCount: 0, greCandidateCount: 0, greBendAuthorityCount: 0, inactiveCornerCount: 0 };
  return freezePipelineInputXmlGreDocumentAdoptionValue({
    schema: PIPELINE_INPUTXML_GRE_DOCUMENT_ADOPTION_PLAN_SCHEMA,
    sourceDocumentPlanSchema: text(input.sourceDocumentPlanSchema),
    sourceProjectionPlanSchema: text(input.sourceProjectionPlanSchema),
    namespace: text(input.namespace), extensionNamespace: text(input.extensionNamespace),
    xmlType: text(input.xmlType), version: text(input.version),
    metadata: ready ? clonePipelineInputXmlGreDocumentAdoptionValue(input.metadata || {}) : {},
    propertySectionPlan: ready ? clonePipelineInputXmlGreDocumentAdoptionValue(input.propertySectionPlan) : null,
    profileAuthorityPlan: ready ? clonePipelineInputXmlGreDocumentAdoptionValue(input.profileAuthorityPlan) : null,
    adoptedElements: ready ? clonePipelineInputXmlGreDocumentAdoptionValue(input.adoptedElements || []) : [],
    greBendAuthorities: ready ? clonePipelineInputXmlGreDocumentAdoptionValue(input.greBendAuthorities || []) : [],
    sourceElementConservation: ready
      ? clonePipelineInputXmlGreDocumentAdoptionValue(input.sourceElementConservation || []) : [],
    candidateConservation: ready
      ? clonePipelineInputXmlGreDocumentAdoptionValue(input.candidateConservation || []) : [],
    inactiveCornerReferences: ready
      ? clonePipelineInputXmlGreDocumentAdoptionValue(input.inactiveCornerReferences || []) : [],
    removedSourceBlockerCodes: ready
      ? clonePipelineInputXmlGreDocumentAdoptionValue(input.removedSourceBlockerCodes || []) : [],
    counts: clonePipelineInputXmlGreDocumentAdoptionValue(ready ? input.counts || zeroCounts : zeroCounts),
    projectionStatus: ready ? 'READY' : 'BLOCKED', documentAuthorityAdopted: ready,
    writerAdmission: ready ? 'NOT_ADOPTED' : 'BLOCKED', coordinateRouteAdopted: false,
    canvasAdopted: false, diagnostics: state.diagnostics, blockerCodes: state.blockerCodes, ready,
  });
}

export const buildPipelineInputXmlGreDocumentAdoptionPlanJson = (plan) => JSON.stringify(plan, null, 2);
export function buildPipelineInputXmlGreDocumentElementsTsv(plan) {
  const header = ['Id', 'Index', 'ProfileId', 'AnalysisSectionId', 'FromNode', 'ToNode',
    'SourceProjectionElementId', 'SourceMaterializedElementId', 'SourceElementIndexes', 'BendCandidateId'];
  const rows = (plan?.adoptedElements || []).map((item) => [item.id, item.index, item.profileId,
    item.analysisSectionId, item.fromNode, item.toNode, item.sourceProjectionElementId,
    item.sourceMaterializedElementId, (item.sourceElementIndexes || []).join('|'), item.bend?.candidateId || '']);
  return [header, ...rows].map((row) => row.join('\t')).join('\n');
}
export function buildPipelineInputXmlGreBendAuthoritiesTsv(plan) {
  const header = ['CandidateId', 'OwnerProjectionElementId', 'OwnerDocumentElementId',
    'SemanticGreBendElementId', 'IncomingTangencyNode', 'OutgoingTangencyNode', 'InactiveCornerNode'];
  const rows = (plan?.greBendAuthorities || []).map((item) => [item.candidateId,
    item.incomingOwnerProjectedElementId, item.incomingOwnerDocumentElementId,
    item.semanticGreBendElementId, item.incomingTangencyNodeNumber,
    item.outgoingTangencyNodeNumber, item.inactiveCornerNodeNumber]);
  return [header, ...rows].map((row) => row.join('\t')).join('\n');
}
