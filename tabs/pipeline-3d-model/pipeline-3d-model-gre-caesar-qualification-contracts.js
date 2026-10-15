export const PIPELINE_GRE_CAESAR_FIXTURE_EVIDENCE_SCHEMA = 'PipelineGreCaesarFixtureEvidence.v2';
export const PIPELINE_GRE_CAESAR_BEND_FIELD_MAPPING_SCHEMA = 'PipelineGreCaesarBendFieldMapping.v2';
export const PIPELINE_GRE_CAESAR_BEND_TOPOLOGY_MAPPING_SCHEMA = 'PipelineGreCaesarBendTopologyMapping.v2';
export const PIPELINE_GRE_CAESAR_BEND_QUALIFICATION_PROFILE_SCHEMA = 'PipelineGreCaesarBendQualificationProfile.v2';
export const PIPELINE_GRE_CAESAR_BEND_QUALIFICATION_PLAN_SCHEMA = 'PipelineGreCaesarBendQualificationPlan.v2';

export const PIPELINE_GRE_CAESAR_FIXTURE_CASES = Object.freeze(['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7']);
export const PIPELINE_GRE_CAESAR_FIELD_CASES = Object.freeze(['F1', 'F2', 'F3', 'F4', 'F5']);
export const PIPELINE_GRE_CAESAR_FIELD_DISPOSITIONS = Object.freeze([
  'EMIT_NUMERIC', 'OMIT_ATTRIBUTE', 'PRESERVE_QUALIFIED_SENTINEL',
  'NO_CURVATURE_NODES_REQUIRED', 'EXACT_CURVATURE_ROLES_REQUIRED',
  'OPTIONAL_QUALIFIED_CURVATURE_ROLES', 'OVERALL_ANGLE_EVIDENCE_ONLY',
  'EMIT_AUTHENTICATED_VALUE',
]);
export const PIPELINE_GRE_CAESAR_TOPOLOGY_MODES = Object.freeze([
  'CONSECUTIVE_SHARED_LOGICAL_NODE', 'CAESAR_FAR_POINT_SHARED_NODE',
  'TANGENCY_SEPARATED_BRIDGE', 'CAESAR_SPECIFIC_REPROJECTED_TOPOLOGY',
]);
export const PIPELINE_GRE_CAESAR_COMPATIBILITY = Object.freeze([
  'DIRECTLY_WRITER_COMPATIBLE', 'REQUIRES_CAESAR_TOPOLOGY_REPROJECTION',
  'INCOMPATIBLE', 'UNRESOLVED',
]);
export const PIPELINE_GRE_CAESAR_QUALIFICATION_OUTCOMES = Object.freeze([
  'QUALIFIED', 'TOPOLOGY_RECONCILIATION_REQUIRED', 'STILL_BLOCKED',
]);
export const PIPELINE_GRE_CAESAR_BLOCKER_ORDER = Object.freeze([
  'PIPELINE_GRE_CAESAR_FIXTURE_REQUIRED',
  'PIPELINE_GRE_CAESAR_FIXTURE_UNAUTHENTICATED',
  'PIPELINE_GRE_CAESAR_FIXTURE_MATRIX_INCOMPLETE',
  'PIPELINE_GRE_CAESAR_VERSION_UNRESOLVED',
  'PIPELINE_GRE_CAESAR_BUILD_UNRESOLVED',
  'PIPELINE_GRE_CAESAR_CODE_ID_UNRESOLVED',
  'PIPELINE_GRE_CAESAR_CODE_EDITION_UNRESOLVED',
  'PIPELINE_GRE_CAESAR_LAMINATE_UNRESOLVED',
  'PIPELINE_GRE_CAESAR_UNIT_FILE_UNRESOLVED',
  'PIPELINE_GRE_CAESAR_NATIVE_JOB_UNAUTHENTICATED',
  'PIPELINE_GRE_CAESAR_OPERATOR_LOG_UNAUTHENTICATED',
  'PIPELINE_GRE_CAESAR_SOURCE_COMMIT_UNRESOLVED',
  'PIPELINE_GRE_CAESAR_IMPORT_NOT_PROVEN',
  'PIPELINE_GRE_CAESAR_IMPORT_WARNING_UNRESOLVED',
  'PIPELINE_GRE_CAESAR_ROUND_TRIP_NOT_PROVEN',
  'PIPELINE_GRE_CAESAR_ROUND_TRIP_COMPARISON_INCOMPLETE',
  'PIPELINE_GRE_CAESAR_BEND_TYPE_UNRESOLVED',
  'PIPELINE_GRE_CAESAR_NUM_MITER_UNRESOLVED',
  'PIPELINE_GRE_CAESAR_LEXICAL_VALUE_UNRESOLVED',
  'PIPELINE_GRE_CAESAR_CURVATURE_NODE_POLICY_UNRESOLVED',
  'PIPELINE_GRE_CAESAR_TOPOLOGY_UNRESOLVED',
  'PIPELINE_GRE_CAESAR_ROLE_SEMANTICS_UNRESOLVED',
  'PIPELINE_GRE_CAESAR_F6_F7_DECISION_UNRESOLVED',
  'PIPELINE_GRE_CAESAR_SUCCESSOR_NOT_AUTHORIZED',
  'PIPELINE_GRE_CAESAR_FIXTURE_CONFLICT',
  'PIPELINE_GRE_CAESAR_QUALIFICATION_INCOMPLETE',
]);

const compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const text = (value) => typeof value === 'string' ? value.trim() : '';
const plain = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value)));

export function clonePipelineGreCaesarQualificationValue(value) {
  if (value === undefined) return null;
  if (value === null || ['string', 'boolean'].includes(typeof value)) return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('CAESAR qualification numbers must be finite.');
    return value;
  }
  if (Array.isArray(value)) return value.map(clonePipelineGreCaesarQualificationValue);
  if (!plain(value)) throw new TypeError('CAESAR qualification evidence must be JSON-safe plain data.');
  return Object.fromEntries(Object.keys(value).sort(compare)
    .map((key) => [key, clonePipelineGreCaesarQualificationValue(value[key])]));
}

export function freezePipelineGreCaesarQualificationValue(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freezePipelineGreCaesarQualificationValue);
  return Object.freeze(value);
}

export function createPipelineGreCaesarDiagnostic(code, details = {}) {
  return freezePipelineGreCaesarQualificationValue({ severity: 'BLOCKING', code: text(code),
    message: text(code), details: clonePipelineGreCaesarQualificationValue(details) });
}

function rank(code) {
  const index = PIPELINE_GRE_CAESAR_BLOCKER_ORDER.indexOf(code);
  return index < 0 ? PIPELINE_GRE_CAESAR_BLOCKER_ORDER.length : index;
}

export function finalizePipelineGreCaesarQualificationState(values = []) {
  const keyed = Object.create(null);
  values.filter(plain).filter((item) => text(item.code)).forEach((item) => {
    const normalized = freezePipelineGreCaesarQualificationValue({
      severity: text(item.severity) || 'BLOCKING', code: text(item.code),
      message: text(item.message) || text(item.code),
      details: plain(item.details) ? clonePipelineGreCaesarQualificationValue(item.details) : {},
    });
    keyed[`${normalized.code}:${JSON.stringify(normalized.details)}`] = normalized;
  });
  const diagnostics = Object.freeze(Object.values(keyed).sort((a, b) => rank(a.code) - rank(b.code)
    || compare(a.code, b.code) || compare(JSON.stringify(a.details), JSON.stringify(b.details))));
  const blockerCodes = Object.freeze([...new Set(diagnostics.map((item) => item.code))]
    .sort((a, b) => rank(a) - rank(b) || compare(a, b)));
  return freezePipelineGreCaesarQualificationValue({ diagnostics, blockerCodes,
    ready: blockerCodes.length === 0 });
}

export function safePipelineGreCaesarQualificationInput(input) {
  try {
    const source = clonePipelineGreCaesarQualificationValue(input);
    if (plain(source)) return { source, diagnostics: [] };
  } catch { /* Fail closed. */ }
  return { source: {}, diagnostics: [createPipelineGreCaesarDiagnostic(
    'PIPELINE_GRE_CAESAR_FIXTURE_UNAUTHENTICATED')] };
}

function record(schema, input = {}, diagnostics = []) {
  const state = finalizePipelineGreCaesarQualificationState(diagnostics);
  return freezePipelineGreCaesarQualificationValue({ schema,
    ...clonePipelineGreCaesarQualificationValue(input), diagnostics: state.diagnostics,
    blockerCodes: state.blockerCodes, ready: state.ready });
}

export const createPipelineGreCaesarFixtureEvidenceRecord = (input, diagnostics = []) =>
  record(PIPELINE_GRE_CAESAR_FIXTURE_EVIDENCE_SCHEMA, input, diagnostics);
export const createPipelineGreCaesarBendFieldMappingRecord = (input, diagnostics = []) =>
  record(PIPELINE_GRE_CAESAR_BEND_FIELD_MAPPING_SCHEMA, input, diagnostics);
export const createPipelineGreCaesarBendTopologyMappingRecord = (input, diagnostics = []) =>
  record(PIPELINE_GRE_CAESAR_BEND_TOPOLOGY_MAPPING_SCHEMA, input, diagnostics);
export const createPipelineGreCaesarBendQualificationProfileRecord = (input, diagnostics = []) =>
  record(PIPELINE_GRE_CAESAR_BEND_QUALIFICATION_PROFILE_SCHEMA, input, diagnostics);

export function createPipelineGreCaesarBendQualificationPlanRecord(input = {}, diagnostics = []) {
  const state = finalizePipelineGreCaesarQualificationState(diagnostics);
  const outcome = PIPELINE_GRE_CAESAR_QUALIFICATION_OUTCOMES.includes(input.qualificationOutcome)
    ? input.qualificationOutcome : 'STILL_BLOCKED';
  const ready = state.ready && outcome === 'QUALIFIED';
  return freezePipelineGreCaesarQualificationValue({
    schema: PIPELINE_GRE_CAESAR_BEND_QUALIFICATION_PLAN_SCHEMA,
    governingBaseline: text(input.governingBaseline),
    fixtures: clonePipelineGreCaesarQualificationValue(input.fixtures || []),
    fieldMappings: clonePipelineGreCaesarQualificationValue(input.fieldMappings || []),
    topologyMappings: clonePipelineGreCaesarQualificationValue(input.topologyMappings || []),
    qualificationProfiles: clonePipelineGreCaesarQualificationValue(input.qualificationProfiles || []),
    fixtureCaseCoverage: clonePipelineGreCaesarQualificationValue(input.fixtureCaseCoverage || {}),
    topologyDecision: text(input.topologyDecision),
    currentP3dGre055Compatibility: PIPELINE_GRE_CAESAR_COMPATIBILITY.includes(
      input.currentP3dGre055Compatibility) ? input.currentP3dGre055Compatibility : 'UNRESOLVED',
    derivedTopologyAssessment: text(input.derivedTopologyAssessment),
    qualificationOutcome: outcome, writerAuthorized: false, productXmlGenerated: false,
    diagnostics: state.diagnostics, blockerCodes: state.blockerCodes, ready,
  });
}

export const buildPipelineGreCaesarQualificationPlanJson = (plan) => JSON.stringify(plan, null, 2);
