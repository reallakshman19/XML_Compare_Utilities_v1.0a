import { getPipelineEngineeringProfile } from './pipeline-3d-model-engineering-profile-registry.js';
import { PIPELINE_ANALYSIS_SECTION_PLAN_SCHEMA, PIPELINE_ANALYSIS_SECTION_SCHEMA, PIPELINE_ELEMENT_SECTION_RESOLUTION_SCHEMA } from './pipeline-3d-model-analysis-section-contracts.js';
import { PIPELINE_ANALYSIS_DIAMETER_PLAN_SCHEMA, PIPELINE_ANALYSIS_DIAMETER_RESOLUTION_SCHEMA, PIPELINE_DIAMETER_MIGRATION_SCHEMA, PIPELINE_ELEMENT_DIAMETER_RESOLUTION_SCHEMA, PIPELINE_PROPERTY_SECTION_PLAN_SCHEMA, parsePipelinePositiveScalar } from './pipeline-3d-model-diameter-contracts.js';
import { PIPELINE_BEND_RESOLUTION_SCHEMA, PIPELINE_NORMAL_FITTING_POLICY_IDS, createPipelineNormalFittingMigration, createPipelineNormalFittingPlan, createPipelineNormalFittingResolution, getPipelineNormalFittingPolicy } from './pipeline-3d-model-normal-fitting-contracts.js';
const text = (value) => String(value ?? '').trim(); const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const plain = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
function clone(value) {
  if (value === undefined) return null; if (value === null || ['string', 'boolean'].includes(typeof value)) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value; if (Array.isArray(value)) return value.map(clone);
  if (!plain(value)) throw new TypeError('Normal fitting resolver input must be JSON-safe plain data.');
  return Object.fromEntries(Object.keys(value).sort(compare).map((key) => [key, clone(value[key])]));
}
const diag = (code, message, details = {}) => ({ severity: 'BLOCKING', code, message, details: clone(details) });
const supplied = (source, key) => plain(source) && Object.prototype.hasOwnProperty.call(source, key)
  && source[key] !== null && !(typeof source[key] === 'string' && !source[key].trim());
const clear = (value) => Array.isArray(value?.blockerCodes) && value.blockerCodes.length === 0
  && Array.isArray(value?.diagnostics) && !value.diagnostics.some((item) => plain(item) && text(item.severity) === 'BLOCKING');
function analysisAuthentic(plan) {
  if (!plain(plan) || plan.schema !== PIPELINE_ANALYSIS_SECTION_PLAN_SCHEMA || plan.ready !== true || !clear(plan)
    || !Array.isArray(plan.sections) || !Array.isArray(plan.elementResolutions)) return false;
  const sections = Object.create(null);
  for (const item of plan.sections) {
    if (!plain(item) || item.schema !== PIPELINE_ANALYSIS_SECTION_SCHEMA || !text(item.status) || item.status === 'BLOCKED' || !clear(item)
      || !/^AS[1-9]\d*$/.test(text(item.analysisSectionId)) || !Number.isInteger(item.startElementIndex) || item.startElementIndex < 0
      || !getPipelineEngineeringProfile(item.profileId) || sections[item.analysisSectionId]) return false;
    sections[item.analysisSectionId] = item;
  }
  return plan.elementResolutions.every((item) => plain(item) && item.schema === PIPELINE_ELEMENT_SECTION_RESOLUTION_SCHEMA
    && item.ready === true && clear(item) && Number.isInteger(item.elementIndex) && item.elementIndex >= 0
    && item.elementId === `E${item.elementIndex + 1}` && sections[item.analysisSectionId]?.profileId === item.profileId);
}
function diameterAuthentic(plan) {
  if (!plain(plan) || plan.schema !== PIPELINE_ANALYSIS_DIAMETER_PLAN_SCHEMA || plan.ready !== true || !clear(plan)
    || plan.analysisSectionPlanSchema !== PIPELINE_ANALYSIS_SECTION_PLAN_SCHEMA
    || plan.propertySectionPlanSchema !== PIPELINE_PROPERTY_SECTION_PLAN_SCHEMA
    || !plain(plan.migration) || plan.migration.schema !== PIPELINE_DIAMETER_MIGRATION_SCHEMA
    || plan.migration.ready !== true || !clear(plan.migration)
    || !Array.isArray(plan.sectionResolutions) || !Array.isArray(plan.elementResolutions)) return false;
  return plan.sectionResolutions.every((item) => plain(item) && item.schema === PIPELINE_ANALYSIS_DIAMETER_RESOLUTION_SCHEMA
    && item.ready === true && text(item.status) && item.status !== 'BLOCKED' && clear(item))
    && plan.elementResolutions.every((item) => plain(item) && item.schema === PIPELINE_ELEMENT_DIAMETER_RESOLUTION_SCHEMA
      && item.ready === true && clear(item));
}
function exactPlans(input, diagnostics) {
  const analysis = input.analysisSectionPlan, diameter = input.analysisDiameterPlan, bend = input.bendResolution;
  const analysisOk = analysisAuthentic(analysis), diameterOk = diameterAuthentic(diameter);
  const bendOk = plain(bend) && bend.schema === PIPELINE_BEND_RESOLUTION_SCHEMA
    && Array.isArray(bend.candidates) && bend.candidates.every(plain);
  if (!analysisOk) diagnostics.push(diag('PIPELINE_NORMAL_FITTING_INPUT_INVALID', 'A ready authentic analysis-section plan is required.'));
  if (!diameterOk) diagnostics.push(diag('PIPELINE_NORMAL_FITTING_DIAMETER_PLAN_INVALID', 'A ready authentic diameter plan is required.'));
  if (!bendOk) diagnostics.push(diag('PIPELINE_NORMAL_FITTING_INPUT_INVALID', 'A canonical PipelineBendResolution.v3 is required.'));
  return { analysis: analysisOk ? analysis : { sections: [], elementResolutions: [] }, diameter: diameterOk ? diameter
    : { sectionResolutions: [], elementResolutions: [] }, bend: bendOk ? bend : { candidates: [] } };
}
function putUnique(target, key, item, code, message, diagnostics) { if (target[key] !== undefined)
  diagnostics.push(diag(code, message, { key })); target[key] = item; }
function indexPlans(plans, diagnostics) {
  const sectionById = Object.create(null), elementByIndex = Object.create(null);
  plans.analysis.sections.forEach((item) => putUnique(sectionById, item.analysisSectionId, item, 'PIPELINE_NORMAL_FITTING_OWNERSHIP_INVALID', 'Analysis section identities must be unique.', diagnostics));
  plans.analysis.elementResolutions.forEach((item) => putUnique(elementByIndex, item.elementIndex, item, 'PIPELINE_NORMAL_FITTING_OWNERSHIP_INVALID', 'Analysis element indexes must be unique.', diagnostics));
  const diameterSectionById = Object.create(null), diameterElementByIndex = Object.create(null);
  plans.diameter.sectionResolutions.forEach((item) => putUnique(diameterSectionById, item.analysisSectionId, item, 'PIPELINE_NORMAL_FITTING_DIAMETER_PLAN_INVALID', 'Diameter section identities must be unique.', diagnostics));
  plans.diameter.elementResolutions.forEach((item) => putUnique(diameterElementByIndex, item.elementIndex, item, 'PIPELINE_NORMAL_FITTING_DIAMETER_PLAN_INVALID', 'Diameter element indexes must be unique.', diagnostics));
  return { sectionById, elementByIndex, diameterSectionById, diameterElementByIndex };
}
function validateCandidateSet(candidates, diagnostics) {
  const ids = Object.create(null), incoming = Object.create(null), corners = Object.create(null);
  for (const item of candidates) {
    const candidateId = text(item.id), owner = item.incomingElementIndex, corner = String(item.cornerNode ?? '');
    if (!candidateId || !Number.isInteger(owner) || owner < 0 || item.outgoingElementIndex !== owner + 1 || !corner) {
      diagnostics.push(diag('PIPELINE_NORMAL_FITTING_INPUT_INVALID', 'Bend candidate identity and ownership are invalid.')); continue;
    }
    if (ids[candidateId] || incoming[owner] || corners[corner]) diagnostics.push(diag(
      'PIPELINE_NORMAL_FITTING_CANDIDATE_COVERAGE_INVALID', 'Candidate ID, incoming owner and corner node must be unique.',
      { candidateId, incomingElementIndex: owner, cornerNode: item.cornerNode }));
    ids[candidateId] = true; incoming[owner] = true; corners[corner] = true;
  }
}
function candidateOwnership(candidate, index, diagnostics) {
  const incoming = index.elementByIndex[candidate.incomingElementIndex], outgoing = index.elementByIndex[candidate.outgoingElementIndex];
  if (!incoming || !outgoing || incoming.elementId !== `E${candidate.incomingElementIndex + 1}`
    || outgoing.elementId !== `E${candidate.outgoingElementIndex + 1}` || incoming.analysisSectionId !== outgoing.analysisSectionId) {
    diagnostics.push(diag('PIPELINE_NORMAL_FITTING_OWNERSHIP_INVALID',
      'Incoming and outgoing elements must exist in one analysis section.', { candidateId: candidate.id })); return null;
  }
  const section = index.sectionById[incoming.analysisSectionId];
  if (!section || section.profileId !== incoming.profileId || outgoing.profileId !== incoming.profileId) {
    diagnostics.push(diag('PIPELINE_NORMAL_FITTING_OWNERSHIP_INVALID',
      'Candidate element and section profile ownership must agree.', { candidateId: candidate.id })); return null;
  }
  return { incoming, outgoing, section };
}
function candidateDiameter(ownership, index, diagnostics, candidate) {
  if (!ownership) return null;
  const section = index.diameterSectionById[ownership.section.analysisSectionId];
  const incoming = index.diameterElementByIndex[ownership.incoming.elementIndex];
  const outgoing = index.diameterElementByIndex[ownership.outgoing.elementIndex];
  const outside = parsePipelinePositiveScalar(section?.outsideDiameterMm);
  const valid = section?.ready === true && incoming?.ready === true && outgoing?.ready === true
    && section.profileId === 'normal-metallic' && incoming.profileId === section.profileId && outgoing.profileId === section.profileId
    && incoming.elementId === ownership.incoming.elementId && outgoing.elementId === ownership.outgoing.elementId
    && incoming.analysisSectionId === section.analysisSectionId && outgoing.analysisSectionId === section.analysisSectionId
    && incoming.outsideDiameterMm === section.outsideDiameterMm && outgoing.outsideDiameterMm === section.outsideDiameterMm;
  if (!valid || !outside) diagnostics.push(diag('PIPELINE_NORMAL_FITTING_DIAMETER_PLAN_INVALID',
    'Candidate requires matching ready Normal diameter section and element evidence.', { candidateId: candidate.id }));
  return valid && outside ? outside : null;
}
function targetMatches(entry, candidate) {
  if (!plain(entry)) return false;
  const suppliedIdentity = [['candidateId', text(candidate.id)], ['incomingElementIndex', candidate.incomingElementIndex],
    ['cornerNode', candidate.cornerNode]].filter(([key]) => supplied(entry, key));
  return suppliedIdentity.length > 0 && suppliedIdentity.every(([key, value]) => entry[key] === value);
}
function normalizePolicy(entry, sourceKind, diagnostics) {
  if (!plain(entry)) { diagnostics.push(diag('PIPELINE_NORMAL_FITTING_INPUT_INVALID',
    'Explicit policy must be a plain object.', { sourceKind })); return { invalid: true }; }
  const policy = getPipelineNormalFittingPolicy(entry.fittingPolicyId);
  if (!policy) { diagnostics.push(diag('PIPELINE_NORMAL_FITTING_POLICY_INVALID', 'Explicit fittingPolicyId is invalid.',
    { fittingPolicyId: text(entry.fittingPolicyId), sourceKind })); return { invalid: true }; }
  const radiusD = supplied(entry, 'radiusD') ? parsePipelinePositiveScalar(entry.radiusD) : null;
  const radiusMm = supplied(entry, 'radiusMm') ? parsePipelinePositiveScalar(entry.radiusMm) : null;
  const rawInvalid = (supplied(entry, 'radiusD') && !radiusD) || (supplied(entry, 'radiusMm') && !radiusMm);
  const basisInvalid = policy.fittingPolicyId === PIPELINE_NORMAL_FITTING_POLICY_IDS.STANDARD_ELBOW
    ? !radiusD || supplied(entry, 'radiusMm') : Number(Boolean(radiusD)) + Number(Boolean(radiusMm)) !== 1;
  if (rawInvalid || basisInvalid) { diagnostics.push(diag(rawInvalid ? 'PIPELINE_NORMAL_FITTING_RADIUS_INVALID'
    : 'PIPELINE_NORMAL_FITTING_RADIUS_BASIS_CONFLICT', 'Explicit fitting radius authority is invalid.',
  { sourceKind, fittingPolicyId: policy.fittingPolicyId })); return { invalid: true }; }
  return { invalid: false, fittingPolicyId: policy.fittingPolicyId, radiusD, radiusMm, sourceKind,
    sourceAuthority: text(entry.sourceAuthority), sourceReference: text(entry.sourceReference) };
}
function sameAuthority(entries, sourceKind, diagnostics) {
  const normalized = entries.map((entry) => normalizePolicy(entry, sourceKind, diagnostics));
  if (normalized.some((item) => item.invalid)) return { invalid: true };
  const signatures = Object.create(null);
  normalized.forEach((item) => { signatures[JSON.stringify([item.fittingPolicyId, item.radiusD, item.radiusMm])] = item; });
  if (Object.keys(signatures).length > 1) { diagnostics.push(diag(
    'PIPELINE_NORMAL_FITTING_SOURCE_CONFLICT', 'Same-authority fitting policies conflict.', { sourceKind })); return { invalid: true }; }
  return Object.values(signatures)[0] || null;
}
function explicitSource(candidate, ownership, input, diagnostics) {
  const overrides = input.normalFittingOverrides;
  if (overrides !== undefined && !Array.isArray(overrides)) { diagnostics.push(diag(
    'PIPELINE_NORMAL_FITTING_INPUT_INVALID', 'normalFittingOverrides must be an array.')); return { invalid: true }; }
  if ((overrides || []).some((item) => !plain(item))) { diagnostics.push(diag(
    'PIPELINE_NORMAL_FITTING_INPUT_INVALID', 'Candidate overrides must be plain objects.')); return { invalid: true }; }
  const matches = (overrides || []).filter((entry) => targetMatches(entry, candidate));
  const partial = (overrides || []).filter((entry) => [['candidateId', text(candidate.id)],
    ['incomingElementIndex', candidate.incomingElementIndex], ['cornerNode', candidate.cornerNode]]
    .some(([key, value]) => supplied(entry, key) && entry[key] === value));
  if (partial.length !== matches.length) { diagnostics.push(diag('PIPELINE_NORMAL_FITTING_TARGET_INVALID',
    'Candidate override identity fields are contradictory.', { candidateId: candidate.id })); return { invalid: true }; }
  if (matches.length) return sameAuthority(matches, 'EXPLICIT_CANDIDATE_OVERRIDE', diagnostics);
  const sections = input.normalFittingSections;
  if (sections !== undefined && !Array.isArray(sections)) { diagnostics.push(diag(
    'PIPELINE_NORMAL_FITTING_INPUT_INVALID', 'normalFittingSections must be an array.')); return { invalid: true }; }
  if ((sections || []).some((entry) => !plain(entry))) { diagnostics.push(diag(
    'PIPELINE_NORMAL_FITTING_INPUT_INVALID', 'Section policies must be plain objects.')); return { invalid: true }; }
  const sectionMatches = (sections || []).filter((entry) => text(entry.analysisSectionId) === ownership.section.analysisSectionId);
  if (sectionMatches.length) return sameAuthority(sectionMatches, 'EXPLICIT_ANALYSIS_SECTION_POLICY', diagnostics);
  if (input.normalFittingPolicy !== undefined) return normalizePolicy(input.normalFittingPolicy,
    'EXPLICIT_GLOBAL_NORMAL_POLICY', diagnostics);
  return null;
}
function legacySource(candidate, input, diagnostics) {
  const settings = plain(input.settings) ? input.settings : {};
  const observed = ['designBasis', 'bendClass', 'standardRadiusMultiplierD'].some((key) => supplied(settings, key))
    || ['bendClass', 'radiusBasis', 'radiusD', 'radiusMm'].some((key) => supplied(candidate, key));
  if (!observed) return { source: null, observed: false };
  const confirmedBasis = input.legacyNormalFittingBasisConfirmed === true && settings.designBasis === 'default-metallic'
    && settings.bendClass === 'standard';
  const legacyRadiusD = parsePipelinePositiveScalar(settings.standardRadiusMultiplierD);
  if (confirmedBasis && !legacyRadiusD) { diagnostics.push(diag('PIPELINE_NORMAL_FITTING_RADIUS_INVALID',
    'Confirmed legacy standardRadiusMultiplierD is invalid.')); return { source: { invalid: true }, observed: true }; }
  if (!confirmedBasis || !legacyRadiusD) { diagnostics.push(diag('PIPELINE_NORMAL_FITTING_LEGACY_AUTHORITY_UNCONFIRMED',
    'Observed legacy Normal fitting evidence is not explicitly confirmed.', { candidateId: candidate.id }));
    return { source: { invalid: true }, observed: true }; }
  return { source: { invalid: false, fittingPolicyId: PIPELINE_NORMAL_FITTING_POLICY_IDS.STANDARD_ELBOW,
    radiusD: legacyRadiusD, radiusMm: null, sourceKind: 'CONFIRMED_LEGACY_NORMAL_STANDARD_ELBOW',
    sourceAuthority: text(input.sourceAuthority), sourceReference: text(input.sourceReference) }, observed: true };
}
function resolvedRadius(authority, outsideDiameterMm) {
  const policy = getPipelineNormalFittingPolicy(authority.fittingPolicyId);
  if (policy.fittingPolicyId === PIPELINE_NORMAL_FITTING_POLICY_IDS.STANDARD_ELBOW) return {
    fittingKind: policy.fittingKind, radiusBasis: 'NORMAL_STANDARD_ELBOW_RADIUS_D',
    radiusD: authority.radiusD, radiusMm: authority.radiusD * outsideDiameterMm };
  if (authority.radiusMm) return { fittingKind: policy.fittingKind, radiusBasis: 'NORMAL_EXPLICIT_RADIUS_MM',
    radiusD: authority.radiusMm / outsideDiameterMm, radiusMm: authority.radiusMm };
  return { fittingKind: policy.fittingKind, radiusBasis: 'NORMAL_EXPLICIT_RADIUS_D',
    radiusD: authority.radiusD, radiusMm: authority.radiusD * outsideDiameterMm };
}
function radiusEvidence(candidate, outside, authorityRadius, diagnostics) {
  const hasD = supplied(candidate, 'radiusD'), hasMm = supplied(candidate, 'radiusMm');
  const suppliedD = hasD ? parsePipelinePositiveScalar(candidate.radiusD) : null;
  const suppliedMm = hasMm ? parsePipelinePositiveScalar(candidate.radiusMm) : null;
  if ((hasD && !suppliedD) || (hasMm && !suppliedMm)) diagnostics.push(diag(
    'PIPELINE_NORMAL_FITTING_RADIUS_INVALID', 'Observed candidate radii must be positive scalars when supplied.', { candidateId: candidate.id }));
  const observedD = suppliedD || (suppliedMm ? suppliedMm / outside : null);
  const observedMm = suppliedMm || (suppliedD ? suppliedD * outside : null);
  const inconsistent = Boolean(suppliedD && suppliedMm && Math.abs(suppliedMm - suppliedD * outside) > 0.000001);
  if (inconsistent) diagnostics.push(diag('PIPELINE_NORMAL_FITTING_RADIUS_BASIS_CONFLICT',
    'Observed radiusD and radiusMm are inconsistent with physical OD.', { candidateId: candidate.id }));
  const available = Boolean(observedD && observedMm), mismatch = Boolean(authorityRadius && available && (inconsistent
    || (hasD && suppliedD && Math.abs(suppliedD * outside - authorityRadius) > 0.000001)
    || (hasMm && suppliedMm && Math.abs(suppliedMm - authorityRadius) > 0.000001)));
  if (candidate.status === 'EMITTED' && mismatch) diagnostics.push(diag('PIPELINE_NORMAL_FITTING_EMITTED_RADIUS_CONFLICT',
    'Emitted candidate radius conflicts with resolved Normal fitting authority.',
    { candidateId: candidate.id, observedCandidateRadiusD: observedD, observedCandidateRadiusMm: observedMm,
      authoritativeRadiusMm: authorityRadius }));
  return { disposition: !authorityRadius || !available ? 'NOT_AVAILABLE'
    : mismatch ? 'REQUIRES_RECOMPUTE' : 'MATCHES_AUTHORITY', recheck: mismatch, observedMm, observedD };
}
const candidateFields = (candidate, ownership, outside, evidence) => ({ candidateId: text(candidate.id),
  incomingElementIndex: candidate.incomingElementIndex, incomingElementId: `E${candidate.incomingElementIndex + 1}`,
  outgoingElementIndex: candidate.outgoingElementIndex, outgoingElementId: `E${candidate.outgoingElementIndex + 1}`,
  analysisSectionId: ownership.section.analysisSectionId, profileId: 'normal-metallic', cornerNode: candidate.cornerNode,
  previousNode: candidate.previousNode, nextNode: candidate.nextNode, geometricClass: text(candidate.classification),
  turnAngleDeg: Number.isFinite(candidate.turnAngleDeg) ? candidate.turnAngleDeg : null, sourceBasis: text(candidate.sourceBasis),
  outsideDiameterMm: outside, observedCandidateRadiusD: evidence.observedD, observedCandidateRadiusMm: evidence.observedMm,
  candidateStatus: text(candidate.status), candidateRadiusDisposition: evidence.disposition,
  geometryRecheckRequired: evidence.recheck });
function resolveCandidate(candidate, ownership, outside, input, diagnostics) {
  const local = [], explicit = explicitSource(candidate, ownership, input, local); let authority = explicit, legacyObserved = false;
  if (!authority) { const legacy = legacySource(candidate, input, local); authority = legacy.source; legacyObserved = legacy.observed; }
  if (!authority || authority.invalid) {
    if (!authority) local.push(diag('PIPELINE_NORMAL_FITTING_AUTHORITY_UNRESOLVED',
      'No explicit or confirmed legacy Normal fitting authority resolved.', { candidateId: candidate.id }));
    const evidence = radiusEvidence(candidate, outside, null, local); diagnostics.push(...local);
    return createPipelineNormalFittingResolution({ ...candidateFields(candidate, ownership, outside, evidence),
      sourceKind: authority?.sourceKind || 'UNRESOLVED', status: 'BLOCKED', diagnostics: local });
  }
  const radius = resolvedRadius(authority, outside), evidence = radiusEvidence(candidate, outside, radius.radiusMm, local);
  diagnostics.push(...local);
  return createPipelineNormalFittingResolution({ ...candidateFields(candidate, ownership, outside, evidence),
    fittingPolicyId: authority.fittingPolicyId, fittingKind: radius.fittingKind, radiusBasis: radius.radiusBasis,
    radiusD: radius.radiusD, radiusMm: radius.radiusMm, sourceKind: authority.sourceKind,
    sourceAuthority: authority.sourceAuthority, sourceReference: authority.sourceReference,
    diagnostics: local, legacyEvidenceObserved: legacyObserved });
}
function validateExplicitInputs(source, index, candidates, diagnostics) {
  const overrides = source.normalFittingOverrides, sections = source.normalFittingSections;
  if (overrides !== undefined && !Array.isArray(overrides)) diagnostics.push(diag('PIPELINE_NORMAL_FITTING_INPUT_INVALID',
    'normalFittingOverrides must be an array.'));
  if (sections !== undefined && !Array.isArray(sections)) diagnostics.push(diag('PIPELINE_NORMAL_FITTING_INPUT_INVALID',
    'normalFittingSections must be an array.'));
  (Array.isArray(overrides) ? overrides : []).forEach((entry) => { if (!plain(entry)) diagnostics.push(diag(
    'PIPELINE_NORMAL_FITTING_INPUT_INVALID', 'Candidate overrides must be plain objects.')); else if (!candidates.some((candidate) =>
    targetMatches(entry, candidate))) diagnostics.push(diag('PIPELINE_NORMAL_FITTING_TARGET_INVALID',
    'Candidate override must identify exactly one existing candidate.')); });
  (Array.isArray(sections) ? sections : []).forEach((entry) => { const section = plain(entry)
    ? index.sectionById[text(entry.analysisSectionId)] : null; if (!plain(entry)) diagnostics.push(diag(
    'PIPELINE_NORMAL_FITTING_INPUT_INVALID', 'Section policies must be plain objects.')); else if (!section
    || section.profileId !== 'normal-metallic') diagnostics.push(diag('PIPELINE_NORMAL_FITTING_TARGET_INVALID',
    'Section policy must target one existing Normal analysis section.')); });
  if (source.normalFittingPolicy !== undefined && !plain(source.normalFittingPolicy)) diagnostics.push(diag(
    'PIPELINE_NORMAL_FITTING_INPUT_INVALID', 'normalFittingPolicy must be a plain object.'));
}
export function resolvePipelineNormalFittingPlan(input = {}) {
  const diagnostics = []; let source;
  try { source = clone(input); if (!plain(source)) throw new TypeError(); } catch {
    source = {}; diagnostics.push(diag('PIPELINE_NORMAL_FITTING_INPUT_INVALID', 'Resolver input must be JSON-safe plain data.')); }
  const plans = exactPlans(source, diagnostics), index = indexPlans(plans, diagnostics);
  const candidates = plans.bend.candidates.slice().sort((a, b) => a.incomingElementIndex - b.incomingElementIndex || compare(text(a.id), text(b.id)));
  validateCandidateSet(candidates, diagnostics); validateExplicitInputs(source, index, candidates, diagnostics);
  const resolutions = [], notApplicable = [];
  for (const candidate of candidates) {
    const ownership = candidateOwnership(candidate, index, diagnostics); if (!ownership) continue;
    const profile = getPipelineEngineeringProfile(ownership.section.profileId);
    if (profile?.profileId !== 'normal-metallic') { notApplicable.push(text(candidate.id)); continue; }
    const outside = candidateDiameter(ownership, index, diagnostics, candidate); if (!outside) continue;
    resolutions.push(resolveCandidate(candidate, ownership, outside, source, diagnostics));
  }
  const normalCount = candidates.filter((candidate) => index.sectionById[index.elementByIndex[candidate.incomingElementIndex]
    ?.analysisSectionId]?.profileId === 'normal-metallic').length;
  if (resolutions.length !== normalCount) diagnostics.push(diag('PIPELINE_NORMAL_FITTING_CANDIDATE_COVERAGE_INVALID',
    'Every Normal candidate must receive exactly one fitting resolution.', { normalCandidateCount: normalCount, resolutionCount: resolutions.length }));
  const migration = createPipelineNormalFittingMigration({ sourceKinds: resolutions.map((item) => item.sourceKind),
    legacyEvidenceObserved: resolutions.some((item) => item.sourceKind === 'CONFIRMED_LEGACY_NORMAL_STANDARD_ELBOW')
      || candidates.some((item) => ['bendClass', 'radiusBasis', 'radiusD', 'radiusMm'].some((key) => supplied(item, key))),
    legacyNormalFittingBasisConfirmed: source.legacyNormalFittingBasisConfirmed === true,
    sourceAuthority: source.sourceAuthority, sourceReference: source.sourceReference });
  return createPipelineNormalFittingPlan({ analysisSectionPlanSchema: plans.analysis.schema,
    analysisDiameterPlanSchema: plans.diameter.schema, bendResolutionSchema: plans.bend.schema, migration,
    fittingResolutions: resolutions, notApplicableCandidateIds: notApplicable,
    diagnostics, blockerCodes: diagnostics.map((item) => item.code) });
}
export const buildPipelineNormalFittingPlanJson = (plan) => JSON.stringify(plan, null, 2);
const cell = (value) => value == null ? '' : String(value).replace(/[\t\r\n]/g, ' ');
export function buildPipelineNormalFittingLedgerText(plan) {
  const header = ['Schema', 'CandidateId', 'IncomingElementId', 'OutgoingElementId', 'AnalysisSectionId', 'ProfileId',
    'FittingPolicyId', 'FittingKind', 'RadiusBasis', 'OutsideDiameterMm', 'RadiusD', 'RadiusMm',
    'ObservedCandidateRadiusD', 'ObservedCandidateRadiusMm', 'CandidateStatus', 'CandidateRadiusDisposition',
    'GeometryRecheckRequired', 'SourceKind', 'Ready'];
  const rows = (plan?.fittingResolutions || []).map((item) => [item.schema, item.candidateId, item.incomingElementId,
    item.outgoingElementId, item.analysisSectionId, item.profileId, item.fittingPolicyId, item.fittingKind,
    item.radiusBasis, item.outsideDiameterMm, item.radiusD, item.radiusMm, item.observedCandidateRadiusD,
    item.observedCandidateRadiusMm, item.candidateStatus, item.candidateRadiusDisposition,
    item.geometryRecheckRequired ? 'YES' : 'NO', item.sourceKind, item.ready ? 'YES' : 'NO']);
  return [header, ...rows].map((row) => row.map(cell).join('\t')).join('\n'); }
