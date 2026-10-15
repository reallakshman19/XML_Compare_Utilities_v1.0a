export const PIPELINE_GRE_BEND_GEOMETRY_PLAN_SCHEMA = 'PipelineGreBendGeometryPlan.v1';
export const PIPELINE_GRE_BEND_GEOMETRY_CANDIDATE_SCHEMA = 'PipelineGreBendGeometryCandidatePlan.v1';
export const PIPELINE_GRE_BEND_GEOMETRY_POINT_SCHEMA = 'PipelineGreBendGeometryPoint.v1';
export const PIPELINE_GRE_BEND_GEOMETRY_CONFLICT_SCHEMA = 'PipelineGreBendGeometrySharedSegmentConflict.v1';
export const PIPELINE_GRE_BEND_APPLICATION_AUTHORITY_SCHEMA = 'PipelineGreBendBreakApplicationAuthority.v1';

export const PIPELINE_GRE_BEND_BREAK_APPLICATIONS = Object.freeze([
  'EACH_LEG_FROM_CORNER',
  'EACH_LEG_FROM_TANGENCY',
]);
export const PIPELINE_GRE_BEND_GEOMETRY_BLOCKER_ORDER = Object.freeze([
  'PIPELINE_GRE_BEND_GEOMETRY_INPUT_INVALID',
  'PIPELINE_GRE_BEND_GEOMETRY_BEND_PLAN_INVALID',
  'PIPELINE_GRE_BEND_GEOMETRY_ROUTING_PLAN_INVALID',
  'PIPELINE_GRE_BEND_GEOMETRY_VENDOR_PLAN_INVALID',
  'PIPELINE_GRE_BEND_GEOMETRY_CANDIDATE_UNOWNED',
  'PIPELINE_GRE_BEND_GEOMETRY_PROFILE_INVALID',
  'PIPELINE_GRE_BEND_GEOMETRY_VENDOR_AUTHORITY_MISSING',
  'PIPELINE_GRE_BEND_GEOMETRY_VENDOR_IDENTITY_CONFLICT',
  'PIPELINE_GRE_BEND_GEOMETRY_BREAK_BASIS_UNRESOLVED',
  'PIPELINE_GRE_BEND_GEOMETRY_RADIUS_INVALID',
  'PIPELINE_GRE_BEND_GEOMETRY_ANGLE_INVALID',
  'PIPELINE_GRE_BEND_GEOMETRY_TANGENCY_INFEASIBLE',
  'PIPELINE_GRE_BEND_GEOMETRY_BREAK_ENVELOPE_INFEASIBLE',
  'PIPELINE_GRE_BEND_GEOMETRY_SECTION_BOUNDARY_CONFLICT',
  'PIPELINE_GRE_BEND_GEOMETRY_SHARED_SEGMENT_CONFLICT',
  'PIPELINE_GRE_BEND_GEOMETRY_COVERAGE_INVALID',
]);

const text = (value) => typeof value === 'string' ? value.trim() : '';
const plain = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value)));
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const finite = (value) => value === null || value === undefined || value === '' ? null
  : Number.isFinite(Number(value)) ? Number(value) : null;
function clone(value) {
  if (value === undefined) return null;
  if (value === null || ['string', 'boolean'].includes(typeof value)) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(clone);
  if (!plain(value)) throw new TypeError('GRE bend geometry evidence must be JSON-safe plain data.');
  return Object.fromEntries(Object.keys(value).sort(compare).map((key) => [key, clone(value[key])]));
}
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}
const rank = (code) => {
  const index = PIPELINE_GRE_BEND_GEOMETRY_BLOCKER_ORDER.indexOf(code);
  return index < 0 ? PIPELINE_GRE_BEND_GEOMETRY_BLOCKER_ORDER.length : index;
};
export function createPipelineGreBendGeometryDiagnostic(code, message = code, details = {}) {
  return freeze({ severity: 'BLOCKING', code, message, details: clone(details) });
}
function finalState(values = []) {
  const keyed = Object.create(null);
  values.filter(plain).filter((item) => text(item.code)).forEach((item) => {
    const normalized = freeze({ severity: text(item.severity) || 'BLOCKING', code: text(item.code),
      message: text(item.message) || text(item.code), details: plain(item.details) ? clone(item.details) : {} });
    keyed[`${normalized.code}:${JSON.stringify(normalized.details)}`] = normalized;
  });
  const diagnostics = Object.freeze(Object.values(keyed).sort((a, b) => rank(a.code) - rank(b.code)
    || compare(a.code, b.code) || compare(JSON.stringify(a.details), JSON.stringify(b.details))));
  const blockerCodes = Object.freeze([...new Set(diagnostics.map((item) => item.code))]
    .sort((a, b) => rank(a) - rank(b) || compare(a, b)));
  return { diagnostics, blockerCodes, ready: blockerCodes.length === 0 };
}
function safe(input) {
  try { const source = clone(input); if (plain(source)) return { source, errors: [] }; } catch { /* block */ }
  return { source: {}, errors: [createPipelineGreBendGeometryDiagnostic(
    'PIPELINE_GRE_BEND_GEOMETRY_INPUT_INVALID', 'Input must be JSON-safe plain data.')] };
}

export function createPipelineGreBendBreakApplicationAuthority(input = {}) {
  const safeValue = safe(input), source = safeValue.source, errors = [...safeValue.errors];
  if (!/^AS[1-9]\d*$/.test(text(source.analysisSectionId)) || !text(source.vendorId)
    || !text(source.seriesId) || !text(source.qualificationEvidenceId)
    || !text(source.sourceAuthority) || !text(source.sourceReference)) errors.push(
    createPipelineGreBendGeometryDiagnostic('PIPELINE_GRE_BEND_GEOMETRY_VENDOR_IDENTITY_CONFLICT',
      'Break-length application authority requires exact section, vendor, qualification and provenance identity.'));
  if (!PIPELINE_GRE_BEND_BREAK_APPLICATIONS.includes(source.bendBreakLengthApplication)) errors.push(
    createPipelineGreBendGeometryDiagnostic('PIPELINE_GRE_BEND_GEOMETRY_BREAK_BASIS_UNRESOLVED',
      'Break-length application must be explicitly qualified.'));
  const state = finalState(errors);
  return freeze({ schema: PIPELINE_GRE_BEND_APPLICATION_AUTHORITY_SCHEMA,
    analysisSectionId: text(source.analysisSectionId), vendorId: text(source.vendorId),
    seriesId: text(source.seriesId), qualificationEvidenceId: text(source.qualificationEvidenceId),
    bendBreakLengthApplication: text(source.bendBreakLengthApplication),
    sourceAuthority: text(source.sourceAuthority), sourceReference: text(source.sourceReference),
    diagnostics: state.diagnostics, blockerCodes: state.blockerCodes, ready: state.ready });
}

export function createPipelineGreBendGeometryPoint(input = {}) {
  const safeValue = safe(input), source = safeValue.source, errors = [...safeValue.errors];
  const x = finite(source.x), y = finite(source.y), z = finite(source.z);
  if ([x, y, z].some((value) => value === null)) errors.push(createPipelineGreBendGeometryDiagnostic(
    'PIPELINE_GRE_BEND_GEOMETRY_INPUT_INVALID', 'Geometry points require finite x, y and z.'));
  const state = finalState(errors);
  return freeze({ schema: PIPELINE_GRE_BEND_GEOMETRY_POINT_SCHEMA, x, y, z,
    diagnostics: state.diagnostics, blockerCodes: state.blockerCodes, ready: state.ready });
}
function candidateIdentityErrors(source) {
  const errors = [];
  if (!text(source.candidateId) || !/^AS[1-9]\d*$/.test(text(source.analysisSectionId))
    || source.profileId !== 'gre') errors.push(createPipelineGreBendGeometryDiagnostic(
    'PIPELINE_GRE_BEND_GEOMETRY_PROFILE_INVALID', 'Candidate requires exact GRE section ownership.'));
  if (!Number.isInteger(source.incomingElementIndex) || source.incomingElementIndex < 0
    || source.outgoingElementIndex !== source.incomingElementIndex + 1) errors.push(
    createPipelineGreBendGeometryDiagnostic('PIPELINE_GRE_BEND_GEOMETRY_CANDIDATE_UNOWNED',
      'Candidate element identity must remain adjacent and canonical.'));
  return errors;
}
export function createPipelineGreBendGeometryCandidatePlan(input = {}) {
  const safeValue = safe(input), source = safeValue.source;
  const errors = [...safeValue.errors, ...candidateIdentityErrors(source),
    ...(Array.isArray(source.diagnostics) ? source.diagnostics : [])];
  const points = ['incomingTangencyPoint', 'outgoingTangencyPoint', 'incomingBreakPoint', 'outgoingBreakPoint']
    .map((field) => [field, createPipelineGreBendGeometryPoint(source[field] || {})]);
  errors.push(...points.flatMap(([, point]) => point.diagnostics));
  if (!PIPELINE_GRE_BEND_BREAK_APPLICATIONS.includes(source.bendBreakLengthApplication)) errors.push(
    createPipelineGreBendGeometryDiagnostic('PIPELINE_GRE_BEND_GEOMETRY_BREAK_BASIS_UNRESOLVED',
      'An explicit qualified GRE bend break-length application is required.'));
  const positiveFields = ['turnAngleDeg', 'bendRadiusMm', 'tangentLengthMm', 'bendBreakLengthMm',
    'bendLocalThicknessMm', 'incomingAvailableLengthMm', 'outgoingAvailableLengthMm',
    'incomingBreakDistanceFromCornerMm', 'outgoingBreakDistanceFromCornerMm'];
  if (positiveFields.some((field) => !(finite(source[field]) > 0))) errors.push(
    createPipelineGreBendGeometryDiagnostic('PIPELINE_GRE_BEND_GEOMETRY_INPUT_INVALID',
      'Candidate geometry quantities must be finite positive scalars.'));
  const state = finalState(errors);
  return freeze({ schema: PIPELINE_GRE_BEND_GEOMETRY_CANDIDATE_SCHEMA,
    candidateId: text(source.candidateId), analysisSectionId: text(source.analysisSectionId), profileId: text(source.profileId),
    incomingElementIndex: Number.isInteger(source.incomingElementIndex) ? source.incomingElementIndex : null,
    outgoingElementIndex: Number.isInteger(source.outgoingElementIndex) ? source.outgoingElementIndex : null,
    incomingElementId: text(source.incomingElementId), outgoingElementId: text(source.outgoingElementId),
    previousNode: finite(source.previousNode), cornerNode: finite(source.cornerNode), nextNode: finite(source.nextNode),
    turnAngleDeg: finite(source.turnAngleDeg), bendRadiusMm: finite(source.bendRadiusMm),
    tangentLengthMm: finite(source.tangentLengthMm), bendBreakLengthBasis: text(source.bendBreakLengthBasis),
    bendBreakLengthApplication: text(source.bendBreakLengthApplication),
    bendBreakLengthMm: finite(source.bendBreakLengthMm), bendLocalThicknessMm: finite(source.bendLocalThicknessMm),
    incomingAvailableLengthMm: finite(source.incomingAvailableLengthMm),
    outgoingAvailableLengthMm: finite(source.outgoingAvailableLengthMm),
    incomingBreakDistanceFromCornerMm: finite(source.incomingBreakDistanceFromCornerMm),
    outgoingBreakDistanceFromCornerMm: finite(source.outgoingBreakDistanceFromCornerMm),
    ...Object.fromEntries(points), vendorId: text(source.vendorId), seriesId: text(source.seriesId),
    qualificationEvidenceId: text(source.qualificationEvidenceId), requirementReference: text(source.requirementReference),
    sourceAuthority: text(source.sourceAuthority), sourceReference: text(source.sourceReference),
    geometryFits: source.geometryFits === true, breakEnvelopeFits: source.breakEnvelopeFits === true,
    sharedSegmentFits: source.sharedSegmentFits === true,
    status: state.ready && source.geometryFits === true && source.breakEnvelopeFits === true
      && source.sharedSegmentFits === true ? 'PLANNED' : 'BLOCKED',
    diagnostics: state.diagnostics, blockerCodes: state.blockerCodes,
    ready: state.ready && source.geometryFits === true && source.breakEnvelopeFits === true
      && source.sharedSegmentFits === true });
}
export function createPipelineGreBendGeometrySharedSegmentConflict(input = {}) {
  const safeValue = safe(input), source = safeValue.source, errors = [...safeValue.errors];
  const candidateIds = [...new Set((Array.isArray(source.candidateIds) ? source.candidateIds : [])
    .map(text).filter(Boolean))].sort(compare);
  if (!text(source.conflictId) || !Number.isInteger(source.segmentIndex) || candidateIds.length !== 2
    || !(finite(source.availableLengthMm) > 0) || !(finite(source.requiredLengthMm) > 0)) errors.push(
    createPipelineGreBendGeometryDiagnostic('PIPELINE_GRE_BEND_GEOMETRY_SHARED_SEGMENT_CONFLICT',
      'Shared-segment conflict evidence is invalid.'));
  const state = finalState(errors);
  return freeze({ schema: PIPELINE_GRE_BEND_GEOMETRY_CONFLICT_SCHEMA, conflictId: text(source.conflictId),
    segmentIndex: Number.isInteger(source.segmentIndex) ? source.segmentIndex : null, candidateIds: Object.freeze(candidateIds),
    availableLengthMm: finite(source.availableLengthMm), requiredLengthMm: finite(source.requiredLengthMm),
    diagnostics: state.diagnostics, blockerCodes: state.blockerCodes, ready: state.ready });
}
export function createPipelineGreBendGeometryPlan(input = {}) {
  const safeValue = safe(input), source = safeValue.source, errors = [...safeValue.errors,
    ...(Array.isArray(source.diagnostics) ? source.diagnostics : [])];
  const candidatePlans = Object.freeze((Array.isArray(source.candidatePlans) ? source.candidatePlans : [])
    .map(createPipelineGreBendGeometryCandidatePlan).sort((a, b) => a.incomingElementIndex - b.incomingElementIndex
      || compare(a.candidateId, b.candidateId)));
  const conflicts = Object.freeze((Array.isArray(source.sharedSegmentConflicts) ? source.sharedSegmentConflicts : [])
    .map(createPipelineGreBendGeometrySharedSegmentConflict).sort((a, b) => a.segmentIndex - b.segmentIndex
      || compare(a.conflictId, b.conflictId)));
  const notApplicable = Object.freeze([...new Set((Array.isArray(source.notApplicableCandidateIds)
    ? source.notApplicableCandidateIds : []).map(text).filter(Boolean))].sort(compare));
  errors.push(...candidatePlans.flatMap((item) => item.diagnostics), ...conflicts.flatMap((item) => item.diagnostics));
  const candidateIds = candidatePlans.map((item) => item.candidateId);
  if (new Set(candidateIds).size !== candidateIds.length) errors.push(createPipelineGreBendGeometryDiagnostic(
    'PIPELINE_GRE_BEND_GEOMETRY_COVERAGE_INVALID', 'Candidate identities must be unique.'));
  const state = finalState(errors);
  return freeze({ schema: PIPELINE_GRE_BEND_GEOMETRY_PLAN_SCHEMA,
    bendResolutionSchema: text(source.bendResolutionSchema),
    sectionProfileRoutingPlanSchema: text(source.sectionProfileRoutingPlanSchema),
    greVendorSeriesPlanSchema: text(source.greVendorSeriesPlanSchema),
    candidatePlans, notApplicableCandidateIds: notApplicable, sharedSegmentConflicts: conflicts,
    coverage: freeze(plain(source.coverage) ? clone(source.coverage) : {}),
    diagnostics: state.diagnostics, blockerCodes: state.blockerCodes,
    ready: state.ready && candidatePlans.every((item) => item.ready) });
}
export const buildPipelineGreBendGeometryPlanJson = (plan) => JSON.stringify(plan, null, 2);
export function buildPipelineGreBendGeometryPlanTsv(plan) {
  const header = ['CandidateId', 'AnalysisSectionId', 'IncomingElementId', 'OutgoingElementId',
    'TurnAngleDeg', 'BendRadiusMm', 'TangentLengthMm', 'BreakApplication', 'BreakLengthMm',
    'GeometryFits', 'BreakEnvelopeFits', 'SharedSegmentFits', 'Status'];
  const rows = (plan?.candidatePlans || []).map((item) => [item.candidateId, item.analysisSectionId,
    item.incomingElementId, item.outgoingElementId, item.turnAngleDeg, item.bendRadiusMm,
    item.tangentLengthMm, item.bendBreakLengthApplication, item.bendBreakLengthMm,
    item.geometryFits, item.breakEnvelopeFits, item.sharedSegmentFits, item.status]);
  return [header, ...rows].map((row) => row.map((value) => value ?? '').join('\t')).join('\n');
}
