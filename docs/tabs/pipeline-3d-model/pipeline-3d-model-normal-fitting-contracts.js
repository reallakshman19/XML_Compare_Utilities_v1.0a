import { getPipelineEngineeringProfile } from './pipeline-3d-model-engineering-profile-registry.js';
import { PIPELINE_ANALYSIS_SECTION_PLAN_SCHEMA } from './pipeline-3d-model-analysis-section-contracts.js';
import { PIPELINE_ANALYSIS_DIAMETER_PLAN_SCHEMA, parsePipelinePositiveScalar } from './pipeline-3d-model-diameter-contracts.js';

export const PIPELINE_BEND_RESOLUTION_SCHEMA = 'PipelineBendResolution.v3';
export const PIPELINE_NORMAL_FITTING_POLICY_REGISTRY_SCHEMA = 'PipelineNormalFittingPolicyRegistry.v1';
export const PIPELINE_NORMAL_FITTING_POLICY_DESCRIPTOR_SCHEMA = 'PipelineNormalFittingPolicyDescriptor.v1';
export const PIPELINE_NORMAL_FITTING_MIGRATION_SCHEMA = 'PipelineNormalFittingMigration.v1';
export const PIPELINE_NORMAL_FITTING_PLAN_SCHEMA = 'PipelineNormalFittingPlan.v1';
export const PIPELINE_NORMAL_FITTING_RESOLUTION_SCHEMA = 'PipelineNormalFittingResolution.v1';
export const PIPELINE_NORMAL_FITTING_POLICY_IDS = Object.freeze({
  STANDARD_ELBOW: 'normal-standard-elbow',
  EXPLICIT_RADIUS_BEND: 'normal-explicit-radius-bend',
});
export const PIPELINE_NORMAL_FITTING_BLOCKER_ORDER = Object.freeze([
  'PIPELINE_NORMAL_FITTING_INPUT_INVALID', 'PIPELINE_NORMAL_FITTING_POLICY_INVALID',
  'PIPELINE_NORMAL_FITTING_PROFILE_INCOMPATIBLE', 'PIPELINE_NORMAL_FITTING_TARGET_INVALID',
  'PIPELINE_NORMAL_FITTING_SOURCE_CONFLICT', 'PIPELINE_NORMAL_FITTING_AUTHORITY_UNRESOLVED',
  'PIPELINE_NORMAL_FITTING_LEGACY_AUTHORITY_UNCONFIRMED', 'PIPELINE_NORMAL_FITTING_RADIUS_INVALID',
  'PIPELINE_NORMAL_FITTING_RADIUS_BASIS_CONFLICT', 'PIPELINE_NORMAL_FITTING_DIAMETER_PLAN_INVALID',
  'PIPELINE_NORMAL_FITTING_OWNERSHIP_INVALID', 'PIPELINE_NORMAL_FITTING_CANDIDATE_COVERAGE_INVALID',
  'PIPELINE_NORMAL_FITTING_EMITTED_RADIUS_CONFLICT',
]);
const DESCRIPTORS = Object.freeze([
  Object.freeze({ schema: PIPELINE_NORMAL_FITTING_POLICY_DESCRIPTOR_SCHEMA,
    fittingPolicyId: 'normal-standard-elbow', fittingKind: 'STANDARD_ELBOW',
    radiusAuthority: 'EXPLICIT_RADIUS_D', sourceAuthority: 'P3D-PROF-043', status: 'CONTRACT_ONLY' }),
  Object.freeze({ schema: PIPELINE_NORMAL_FITTING_POLICY_DESCRIPTOR_SCHEMA,
    fittingPolicyId: 'normal-explicit-radius-bend', fittingKind: 'EXPLICIT_RADIUS_BEND',
    radiusAuthority: 'EXACTLY_ONE_RADIUS_MM_OR_RADIUS_D', sourceAuthority: 'P3D-PROF-043', status: 'CONTRACT_ONLY' }),
]);
const text = (value) => String(value ?? '').trim();
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const plain = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value); return prototype === Object.prototype || prototype === null;
};
function clone(value) {
  if (value === undefined) return null;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(clone);
  if (!plain(value)) throw new TypeError('Normal fitting input must be JSON-safe plain data.');
  return Object.fromEntries(Object.keys(value).sort(compare).map((key) => [key, clone(value[key])]));
}
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze); return Object.freeze(value);
}
function diagnostic(code, message, details = {}) {
  return freeze({ severity: 'BLOCKING', code, message, details: clone(details) });
}
const rank = (code) => {
  const index = PIPELINE_NORMAL_FITTING_BLOCKER_ORDER.indexOf(code);
  return index < 0 ? PIPELINE_NORMAL_FITTING_BLOCKER_ORDER.length : index;
};
function diagnostics(values = []) {
  const keyed = Object.create(null);
  values.filter(plain).filter((item) => text(item.code)).forEach((item) => {
    const normalized = freeze({ severity: text(item.severity) || 'BLOCKING', code: text(item.code),
      message: text(item.message), details: plain(item.details) ? clone(item.details) : {} });
    keyed[`${normalized.code}:${JSON.stringify(normalized.details)}`] = normalized;
  });
  return Object.freeze(Object.values(keyed).sort((a, b) => rank(a.code) - rank(b.code)
    || compare(a.code, b.code) || compare(JSON.stringify(a.details), JSON.stringify(b.details))));
}
function codes(items, supplied = []) {
  const keyed = Object.create(null);
  [...supplied, ...items.map((item) => item.code)].map(text).filter(Boolean).forEach((code) => { keyed[code] = true; });
  return Object.freeze(Object.keys(keyed).sort((a, b) => rank(a) - rank(b) || compare(a, b)));
}
function safe(input, code) {
  try { const source = clone(input); if (plain(source)) return { source, errors: [] }; } catch { /* blocked */ }
  return { source: {}, errors: [diagnostic(code, 'Input must be JSON-safe plain data.')] };
}
function final(source, generated, extra = []) {
  const items = diagnostics([...(Array.isArray(source.diagnostics) ? source.diagnostics : []), ...generated]);
  const blockerCodes = codes(items, [...(Array.isArray(source.blockerCodes) ? source.blockerCodes : []), ...extra]);
  return { diagnostics: items, blockerCodes, ready: blockerCodes.length === 0 };
}
function canonical(value) {
  return JSON.stringify(Object.fromEntries(Object.keys(value || {}).sort(compare).map((key) => [key, value[key]])));
}
export function createPipelineNormalFittingPolicyRegistry(descriptors = DESCRIPTORS) {
  const safeValue = safe({ descriptors }, 'PIPELINE_NORMAL_FITTING_POLICY_INVALID');
  const values = Array.isArray(safeValue.source.descriptors) ? safeValue.source.descriptors : [];
  const valid = values.length === DESCRIPTORS.length && values.every((item, index) => plain(item)
    && item.fittingPolicyId === DESCRIPTORS[index].fittingPolicyId && canonical(item) === canonical(DESCRIPTORS[index]));
  const errors = [...safeValue.errors];
  if (!valid) errors.push(diagnostic('PIPELINE_NORMAL_FITTING_POLICY_INVALID',
    'Registry must contain exactly the two canonical Normal fitting policies in canonical order.'));
  const state = final({}, errors);
  return freeze({ schema: PIPELINE_NORMAL_FITTING_POLICY_REGISTRY_SCHEMA,
    descriptors: Object.freeze((valid ? values : []).map(clone).map(freeze)),
    diagnostics: state.diagnostics, blockerCodes: state.blockerCodes, ready: state.ready });
}
export const PIPELINE_NORMAL_FITTING_POLICY_REGISTRY = createPipelineNormalFittingPolicyRegistry();
export function getPipelineNormalFittingPolicy(policyId, registry = PIPELINE_NORMAL_FITTING_POLICY_REGISTRY) {
  if (registry?.schema !== PIPELINE_NORMAL_FITTING_POLICY_REGISTRY_SCHEMA || registry.ready !== true) return null;
  return registry.descriptors.find((item) => item.fittingPolicyId === text(policyId)) || null;
}
export function createPipelineNormalFittingMigration(input = {}) {
  const safeValue = safe(input, 'PIPELINE_NORMAL_FITTING_INPUT_INVALID'), source = safeValue.source;
  const state = final(source, safeValue.errors);
  return freeze({ schema: PIPELINE_NORMAL_FITTING_MIGRATION_SCHEMA,
    sourceKinds: Object.freeze((Array.isArray(source.sourceKinds) ? source.sourceKinds : []).map(text).filter(Boolean).sort(compare)),
    legacyEvidenceObserved: source.legacyEvidenceObserved === true,
    legacyNormalFittingBasisConfirmed: source.legacyNormalFittingBasisConfirmed === true,
    sourceAuthority: text(source.sourceAuthority), sourceReference: text(source.sourceReference),
    diagnostics: state.diagnostics, blockerCodes: state.blockerCodes, ready: state.ready });
}
function radiusErrors(source, policy, outsideDiameterMm) {
  const errors = [], radiusD = parsePipelinePositiveScalar(source.radiusD), radiusMm = parsePipelinePositiveScalar(source.radiusMm);
  if (!outsideDiameterMm) errors.push(diagnostic('PIPELINE_NORMAL_FITTING_DIAMETER_PLAN_INVALID',
    'A canonical positive outsideDiameterMm is required.'));
  if (!radiusD || !radiusMm) errors.push(diagnostic('PIPELINE_NORMAL_FITTING_RADIUS_INVALID',
    'Normalized fitting resolution requires positive radiusD and radiusMm.'));
  const basis = text(source.radiusBasis);
  const allowed = policy?.fittingPolicyId === 'normal-standard-elbow'
    ? ['NORMAL_STANDARD_ELBOW_RADIUS_D'] : ['NORMAL_EXPLICIT_RADIUS_MM', 'NORMAL_EXPLICIT_RADIUS_D'];
  if (!allowed.includes(basis)) errors.push(diagnostic('PIPELINE_NORMAL_FITTING_POLICY_INVALID',
    'radiusBasis does not match the fitting policy.'));
  if (radiusD && radiusMm && outsideDiameterMm && Math.abs(radiusMm - radiusD * outsideDiameterMm) > 0.000001) {
    errors.push(diagnostic('PIPELINE_NORMAL_FITTING_RADIUS_BASIS_CONFLICT',
      'Normalized radiusD and radiusMm are inconsistent with physical OD.'));
  }
  return errors;
}
function observedEvidence(source, outsideDiameterMm, authorityRadiusMm) {
  const errors = [], rawD = source.observedCandidateRadiusD, rawMm = source.observedCandidateRadiusMm;
  const hasD = rawD !== undefined && rawD !== null, hasMm = rawMm !== undefined && rawMm !== null;
  const suppliedD = hasD ? parsePipelinePositiveScalar(rawD) : null;
  const suppliedMm = hasMm ? parsePipelinePositiveScalar(rawMm) : null;
  if ((hasD && !suppliedD) || (hasMm && !suppliedMm)) errors.push(diagnostic(
    'PIPELINE_NORMAL_FITTING_RADIUS_INVALID', 'Observed candidate radii must be positive scalars when supplied.'));
  let observedD = suppliedD, observedMm = suppliedMm;
  if (outsideDiameterMm && suppliedD && !hasMm) observedMm = suppliedD * outsideDiameterMm;
  if (outsideDiameterMm && suppliedMm && !hasD) observedD = suppliedMm / outsideDiameterMm;
  const inconsistent = Boolean(outsideDiameterMm && suppliedD && suppliedMm
    && Math.abs(suppliedMm - suppliedD * outsideDiameterMm) > 0.000001);
  if (inconsistent) errors.push(diagnostic('PIPELINE_NORMAL_FITTING_RADIUS_BASIS_CONFLICT',
    'Observed radiusD and radiusMm are inconsistent with physical OD.'));
  const available = Boolean(observedD && observedMm), mismatch = Boolean(authorityRadiusMm && available && (
    inconsistent || (hasD && suppliedD && Math.abs(suppliedD * outsideDiameterMm - authorityRadiusMm) > 0.000001)
    || (hasMm && suppliedMm && Math.abs(suppliedMm - authorityRadiusMm) > 0.000001)));
  return { errors, observedD, observedMm, disposition: !authorityRadiusMm || !available ? 'NOT_AVAILABLE'
    : mismatch ? 'REQUIRES_RECOMPUTE' : 'MATCHES_AUTHORITY', mismatch };
}
function suppliedBlockingCodes(source) {
  return codes((Array.isArray(source.diagnostics) ? source.diagnostics : []).filter((item) => text(item.severity) === 'BLOCKING'),
    Array.isArray(source.blockerCodes) ? source.blockerCodes : []);
}
export function createPipelineNormalFittingResolution(input = {}) {
  const safeValue = safe(input, 'PIPELINE_NORMAL_FITTING_INPUT_INVALID'), source = safeValue.source;
  const declaredBlockers = suppliedBlockingCodes(source), blockedAuthority = text(source.status) === 'BLOCKED'
    && declaredBlockers.length > 0 && !text(source.fittingPolicyId);
  const policy = getPipelineNormalFittingPolicy(source.fittingPolicyId), profile = getPipelineEngineeringProfile(source.profileId);
  const outsideDiameterMm = parsePipelinePositiveScalar(source.outsideDiameterMm), errors = [...safeValue.errors];
  if (!policy && !blockedAuthority) errors.push(diagnostic('PIPELINE_NORMAL_FITTING_POLICY_INVALID', 'fittingPolicyId must be exact and canonical.'));
  if (!profile || profile.profileId !== 'normal-metallic') errors.push(diagnostic(
    'PIPELINE_NORMAL_FITTING_PROFILE_INCOMPATIBLE', 'Normal fitting resolution requires profileId normal-metallic.'));
  if (!text(source.candidateId) || !Number.isInteger(source.incomingElementIndex) || source.incomingElementIndex < 0
    || text(source.incomingElementId) !== `E${source.incomingElementIndex + 1}`
    || source.outgoingElementIndex !== source.incomingElementIndex + 1
    || text(source.outgoingElementId) !== `E${source.outgoingElementIndex + 1}`
    || !/^AS[1-9]\d*$/.test(text(source.analysisSectionId))) errors.push(diagnostic(
    'PIPELINE_NORMAL_FITTING_OWNERSHIP_INVALID', 'Canonical candidate, incoming/outgoing E identity and AS identity are required.'));
  if (!blockedAuthority) {
    errors.push(...radiusErrors(source, policy, outsideDiameterMm));
    if (text(source.fittingKind) !== (policy?.fittingKind || '')) errors.push(diagnostic(
      'PIPELINE_NORMAL_FITTING_POLICY_INVALID', 'fittingKind must match the canonical fitting policy.'));
  } else if (!outsideDiameterMm) errors.push(diagnostic('PIPELINE_NORMAL_FITTING_DIAMETER_PLAN_INVALID',
    'A canonical positive outsideDiameterMm is required.'));
  const requiredEvidence = [text(source.candidateStatus), text(source.geometricClass), text(source.sourceBasis), text(source.sourceKind)];
  const nodesValid = [source.previousNode, source.cornerNode, source.nextNode].every((value) => Number.isInteger(value) && value > 0);
  if (requiredEvidence.some((value) => !value) || !nodesValid || !Number.isFinite(source.turnAngleDeg)) errors.push(diagnostic(
    'PIPELINE_NORMAL_FITTING_INPUT_INVALID', 'Candidate status, geometric evidence, nodes, angle and sourceKind are required.'));
  const authorityRadius = blockedAuthority ? null : parsePipelinePositiveScalar(source.radiusMm);
  const observed = observedEvidence(source, outsideDiameterMm, authorityRadius); errors.push(...observed.errors);
  if (text(source.candidateRadiusDisposition) !== observed.disposition) errors.push(diagnostic(
    'PIPELINE_NORMAL_FITTING_INPUT_INVALID', 'candidateRadiusDisposition does not match observed radius evidence.'));
  if (source.geometryRecheckRequired !== (observed.disposition === 'REQUIRES_RECOMPUTE')) errors.push(diagnostic(
    'PIPELINE_NORMAL_FITTING_INPUT_INVALID', 'geometryRecheckRequired must match candidate radius disposition.'));
  if (text(source.candidateStatus) === 'EMITTED' && observed.mismatch) errors.push(diagnostic(
    'PIPELINE_NORMAL_FITTING_EMITTED_RADIUS_CONFLICT', 'Emitted candidate radius conflicts with authoritative radius.'));
  const state = final(source, errors);
  return freeze({ schema: PIPELINE_NORMAL_FITTING_RESOLUTION_SCHEMA,
    candidateId: text(source.candidateId), incomingElementIndex: Number.isInteger(source.incomingElementIndex) ? source.incomingElementIndex : null,
    incomingElementId: text(source.incomingElementId), outgoingElementIndex: Number.isInteger(source.outgoingElementIndex) ? source.outgoingElementIndex : null,
    outgoingElementId: text(source.outgoingElementId), analysisSectionId: text(source.analysisSectionId), profileId: text(source.profileId),
    cornerNode: source.cornerNode ?? null, previousNode: source.previousNode ?? null, nextNode: source.nextNode ?? null,
    geometricClass: text(source.geometricClass), turnAngleDeg: Number.isFinite(source.turnAngleDeg) ? source.turnAngleDeg : null,
    sourceBasis: text(source.sourceBasis), fittingPolicyId: text(source.fittingPolicyId), fittingKind: text(source.fittingKind),
    radiusBasis: text(source.radiusBasis), outsideDiameterMm, radiusD: parsePipelinePositiveScalar(source.radiusD),
    radiusMm: parsePipelinePositiveScalar(source.radiusMm), observedCandidateRadiusD: observed.observedD,
    observedCandidateRadiusMm: observed.observedMm, candidateStatus: text(source.candidateStatus),
    candidateRadiusDisposition: text(source.candidateRadiusDisposition), geometryRecheckRequired: source.geometryRecheckRequired === true,
    sourceKind: text(source.sourceKind), sourceAuthority: text(source.sourceAuthority), sourceReference: text(source.sourceReference),
    status: state.ready ? 'RESOLVED' : 'BLOCKED', diagnostics: state.diagnostics, blockerCodes: state.blockerCodes, ready: state.ready });
}
export function createPipelineNormalFittingPlan(input = {}) {
  const safeValue = safe(input, 'PIPELINE_NORMAL_FITTING_INPUT_INVALID'), source = safeValue.source;
  const resolutionInputs = Array.isArray(source.fittingResolutions) ? source.fittingResolutions : [];
  const resolutions = Object.freeze(resolutionInputs.map(createPipelineNormalFittingResolution)
    .sort((a, b) => a.incomingElementIndex - b.incomingElementIndex || compare(a.candidateId, b.candidateId)));
  const migration = createPipelineNormalFittingMigration(source.migration || {}), errors = [...safeValue.errors];
  if (source.analysisSectionPlanSchema !== PIPELINE_ANALYSIS_SECTION_PLAN_SCHEMA
    || source.analysisDiameterPlanSchema !== PIPELINE_ANALYSIS_DIAMETER_PLAN_SCHEMA
    || source.bendResolutionSchema !== PIPELINE_BEND_RESOLUTION_SCHEMA) errors.push(diagnostic(
    'PIPELINE_NORMAL_FITTING_INPUT_INVALID', 'Exact analysis, diameter and bend schemas are required.'));
  if (!Array.isArray(source.fittingResolutions) || !Array.isArray(source.notApplicableCandidateIds)) errors.push(diagnostic(
    'PIPELINE_NORMAL_FITTING_CANDIDATE_COVERAGE_INVALID', 'Resolution and not-applicable candidate arrays are required.'));
  const ids = Object.create(null), owners = Object.create(null), corners = Object.create(null);
  const notApplicable = Array.isArray(source.notApplicableCandidateIds)
    ? source.notApplicableCandidateIds.map(text).filter(Boolean) : [], excluded = Object.create(null);
  resolutions.forEach((item) => {
    if (ids[item.candidateId] || owners[item.incomingElementIndex] || corners[item.cornerNode]) errors.push(diagnostic(
      'PIPELINE_NORMAL_FITTING_CANDIDATE_COVERAGE_INVALID', 'Candidate IDs, incoming ownership and corner nodes must be unique.',
      { candidateId: item.candidateId, incomingElementIndex: item.incomingElementIndex, cornerNode: item.cornerNode }));
    ids[item.candidateId] = true; owners[item.incomingElementIndex] = true; corners[item.cornerNode] = true;
  });
  notApplicable.forEach((candidateId) => {
    if (excluded[candidateId] || ids[candidateId]) errors.push(diagnostic('PIPELINE_NORMAL_FITTING_CANDIDATE_COVERAGE_INVALID',
      'Not-applicable candidate IDs must be unique and disjoint from resolved candidates.', { candidateId }));
    excluded[candidateId] = true;
  });
  const records = [migration, ...resolutions], nested = records.flatMap((item) => item.diagnostics);
  const state = final(source, [...errors, ...nested], records.flatMap((item) => item.blockerCodes));
  return freeze({ schema: PIPELINE_NORMAL_FITTING_PLAN_SCHEMA,
    analysisSectionPlanSchema: text(source.analysisSectionPlanSchema), analysisDiameterPlanSchema: text(source.analysisDiameterPlanSchema),
    bendResolutionSchema: text(source.bendResolutionSchema), migration, fittingResolutions: resolutions,
    notApplicableCandidateIds: Object.freeze(notApplicable.sort(compare)), diagnostics: state.diagnostics, blockerCodes: state.blockerCodes,
    ready: state.ready && records.every((item) => item.ready) });
}
