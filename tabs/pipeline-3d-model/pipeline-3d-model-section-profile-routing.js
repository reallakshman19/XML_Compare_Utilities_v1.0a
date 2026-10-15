export const PIPELINE_SECTION_PROFILE_ROUTING_PLAN_SCHEMA = 'PipelineSectionProfileRoutingPlan.v1';
export const PIPELINE_SECTION_PROFILE_CANDIDATE_OWNERSHIP_SCHEMA = 'PipelineSectionProfileCandidateOwnership.v1';

const PROFILES = Object.freeze(['normal-metallic', 'asme-b31.4', 'gre']);
const ORDER = Object.freeze([
  'PIPELINE_SECTION_PROFILE_ROUTING_INPUT_INVALID',
  'PIPELINE_SECTION_PROFILE_ROUTING_SECTION_PLAN_INVALID',
  'PIPELINE_SECTION_PROFILE_ROUTING_CANDIDATE_INVALID',
  'PIPELINE_SECTION_PROFILE_ROUTING_DUPLICATE_CANDIDATE',
  'PIPELINE_SECTION_PROFILE_ROUTING_UNOWNED_CANDIDATE',
  'PIPELINE_SECTION_PROFILE_ROUTING_PROFILE_INVALID',
  'PIPELINE_SECTION_PROFILE_ROUTING_COVERAGE_INVALID',
]);
const text = (value) => typeof value === 'string' ? value.trim() : '';
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const plain = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value)));
function clone(value) {
  if (value === undefined) return null;
  if (value === null || ['string', 'boolean'].includes(typeof value)) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(clone);
  if (!plain(value)) throw new TypeError('Routing evidence must be JSON-safe plain data.');
  return Object.fromEntries(Object.keys(value).sort(compare).map((key) => [key, clone(value[key])]));
}
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze); return Object.freeze(value);
}
function diagnostic(code, message = code, details = {}) {
  return freeze({ severity: 'BLOCKING', code, message, details: clone(details) });
}
function rank(code) { const index = ORDER.indexOf(code); return index < 0 ? ORDER.length : index; }
function finalState(values) {
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
  return { source: {}, errors: [diagnostic('PIPELINE_SECTION_PROFILE_ROUTING_INPUT_INVALID')] };
}
function canonicalPlan(source, errors) {
  const plan = source.canonicalAnalysisSectionPlan;
  const valid = plain(plan) && plan.schema === 'PipelineAnalysisSectionPlan.v1' && plan.ready === true
    && Array.isArray(plan.sections) && Array.isArray(plan.elementResolutions);
  if (!valid) errors.push(diagnostic('PIPELINE_SECTION_PROFILE_ROUTING_SECTION_PLAN_INVALID',
    'A ready canonical PipelineAnalysisSectionPlan.v1 is required.'));
  return valid ? plan : { schema: '', sections: [], elementResolutions: [] };
}
function elementIndex(plan, errors) {
  const result = Object.create(null);
  for (const item of plan.elementResolutions) {
    if (!Number.isInteger(item.elementIndex) || result[item.elementIndex]) errors.push(diagnostic(
      'PIPELINE_SECTION_PROFILE_ROUTING_SECTION_PLAN_INVALID', 'Canonical element ownership must be unique.',
      { elementIndex: item.elementIndex }));
    else result[item.elementIndex] = item;
  }
  return result;
}
function candidateIdentity(candidate, errors) {
  const candidateId = text(candidate?.id);
  const incoming = candidate?.incomingElementIndex, outgoing = candidate?.outgoingElementIndex;
  if (!plain(candidate) || !candidateId || !Number.isInteger(incoming) || incoming < 0
    || outgoing !== incoming + 1) errors.push(diagnostic(
    'PIPELINE_SECTION_PROFILE_ROUTING_CANDIDATE_INVALID', 'Candidate identity and adjacent element indexes are required.',
    { candidateId, incomingElementIndex: incoming, outgoingElementIndex: outgoing }));
  return { candidateId, incoming, outgoing };
}
function ownership(candidate, elements, errors) {
  const identity = candidateIdentity(candidate, errors);
  const incoming = elements[identity.incoming], outgoing = elements[identity.outgoing];
  if (!incoming || !outgoing || incoming.analysisSectionId !== outgoing.analysisSectionId) {
    errors.push(diagnostic('PIPELINE_SECTION_PROFILE_ROUTING_UNOWNED_CANDIDATE',
      'Candidate incoming and outgoing elements must have one canonical section owner.',
      { candidateId: identity.candidateId }));
    return null;
  }
  if (incoming.profileId !== outgoing.profileId || !PROFILES.includes(incoming.profileId)) {
    errors.push(diagnostic('PIPELINE_SECTION_PROFILE_ROUTING_PROFILE_INVALID',
      'Candidate profile must come only from canonical section ownership.',
      { candidateId: identity.candidateId, incomingProfileId: incoming.profileId,
        outgoingProfileId: outgoing.profileId }));
    return null;
  }
  return freeze({ schema: PIPELINE_SECTION_PROFILE_CANDIDATE_OWNERSHIP_SCHEMA,
    candidateId: identity.candidateId, incomingElementIndex: identity.incoming,
    outgoingElementIndex: identity.outgoing, analysisSectionId: incoming.analysisSectionId,
    profileId: incoming.profileId, sourceAuthority: 'CANONICAL_ANALYSIS_SECTION_PLAN',
    sourceReference: `${incoming.analysisSectionId}:${incoming.elementId}->${outgoing.elementId}`,
    diagnostics: Object.freeze([]), blockerCodes: Object.freeze([]), ready: true });
}
export function buildPipelineSectionProfileRoutingPlan(input = {}) {
  const safeValue = safe(input), source = safeValue.source, errors = [...safeValue.errors];
  const plan = canonicalPlan(source, errors), elements = elementIndex(plan, errors);
  const candidates = Array.isArray(source.bendResolution?.candidates) ? source.bendResolution.candidates : [];
  if (!plain(source.bendResolution) || source.bendResolution.schema !== 'PipelineBendResolution.v3'
    || !Array.isArray(source.bendResolution?.candidates)) errors.push(diagnostic(
    'PIPELINE_SECTION_PROFILE_ROUTING_INPUT_INVALID', 'Canonical PipelineBendResolution.v3 candidate evidence is required.'));
  const ids = Object.create(null), incomingOwners = Object.create(null), ownerships = [];
  for (const candidate of candidates) {
    const id = text(candidate?.id), incoming = candidate?.incomingElementIndex;
    if (id && (ids[id] || incomingOwners[incoming])) errors.push(diagnostic(
      'PIPELINE_SECTION_PROFILE_ROUTING_DUPLICATE_CANDIDATE', 'Candidate identity or incoming owner is duplicated.',
      { candidateId: id, incomingElementIndex: incoming }));
    ids[id] = true; incomingOwners[incoming] = true;
    const item = ownership(candidate, elements, errors); if (item) ownerships.push(item);
  }
  const profileRoutes = Object.fromEntries(PROFILES.map((profileId) => [profileId, Object.freeze(ownerships
    .filter((item) => item.profileId === profileId).map((item) => item.candidateId))]));
  const mutuallyExclusive = ownerships.length === new Set(ownerships.map((item) => item.candidateId)).size;
  const complete = ownerships.length === candidates.length;
  if (!mutuallyExclusive || !complete) errors.push(diagnostic(
    'PIPELINE_SECTION_PROFILE_ROUTING_COVERAGE_INVALID', 'Every candidate must have exactly one profile route.',
    { candidateCount: candidates.length, ownedCandidateCount: ownerships.length, mutuallyExclusive }));
  const state = finalState(errors);
  return freeze({ schema: PIPELINE_SECTION_PROFILE_ROUTING_PLAN_SCHEMA,
    canonicalAnalysisSectionPlanSchema: text(plan.schema), bendResolutionSchema: text(source.bendResolution?.schema),
    analysisSections: plan.sections, candidateOwnership: ownerships, profileRoutes,
    coverageCounts: { candidateCount: candidates.length, ownedCandidateCount: ownerships.length,
      normalCandidateCount: profileRoutes['normal-metallic'].length,
      b314CandidateCount: profileRoutes['asme-b31.4'].length,
      greCandidateCount: profileRoutes.gre.length,
      unownedCandidateCount: Math.max(0, candidates.length - ownerships.length),
      duplicateCandidateCount: candidates.length - Object.keys(ids).length },
    fallbackApplied: false, diagnostics: state.diagnostics, blockerCodes: state.blockerCodes,
    ready: state.ready && complete && mutuallyExclusive });
}
export const buildPipelineSectionProfileRoutingJson = (plan) => JSON.stringify(plan, null, 2);
