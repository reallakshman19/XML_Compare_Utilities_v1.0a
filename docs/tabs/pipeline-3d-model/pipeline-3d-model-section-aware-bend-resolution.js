import { calculateElasticBendScreening, bendDiagnostic } from './pipeline-3d-model-bend-screening.js';
import {
  buildRawBendCandidateWindows,
  materializeRawBendCandidate,
} from './pipeline-3d-model-bend-route.js';
import { resolveSharedBendSegmentFeasibility } from './pipeline-3d-model-bend-feasibility.js';
import { assignBendCurvatureNodes } from './pipeline-3d-model-bend-resolution-nodes.js';
import { bendCandidateDiagnostic, bendCandidateStatus } from './pipeline-3d-model-bend-resolution-status.js';
import { buildPipelineSectionProfileRoutingPlan } from './pipeline-3d-model-section-profile-routing.js';

const DETECTION_KEYS = Object.freeze([
  'shortElementAnglePolicy', 'minimumAngleElementLengthMm', 'minimumPlanTurnAngleDeg',
  'minimumProfileTurnAngleDeg', 'maximumTurnAngleDeg', 'detectHorizontal',
  'detectVertical', 'detectCompound',
]);
const text = (value) => typeof value === 'string' ? value.trim() : '';
const plain = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze); return Object.freeze(value);
}
function diagnostic(code, message, details = {}) {
  return bendDiagnostic('BLOCKING', code, message, details);
}
function validPlan(plan) {
  return plain(plan) && plan.schema === 'PipelineAnalysisSectionPlan.v1' && plan.ready === true
    && Array.isArray(plan.sections) && Array.isArray(plan.elementResolutions);
}
function indexes(plan) {
  return {
    section: Object.fromEntries(plan.sections.map((item) => [item.analysisSectionId, item])),
    element: Object.fromEntries(plan.elementResolutions.map((item) => [item.elementIndex, item])),
  };
}
function sameDetectionSettings(sectionSettings, errors) {
  const values = Object.values(sectionSettings);
  const first = values[0] || {};
  const signature = JSON.stringify(Object.fromEntries(DETECTION_KEYS.map((key) => [key, first[key]])));
  values.slice(1).forEach((settings) => {
    const next = JSON.stringify(Object.fromEntries(DETECTION_KEYS.map((key) => [key, settings[key]])));
    if (next !== signature) errors.push(diagnostic('PIPELINE_SECTION_PROFILE_ROUTING_INPUT_INVALID',
      'Candidate detection settings must be canonical and shared; profile policy settings remain section-owned.'));
  });
  return first;
}
function windowOwner(window, index, errors) {
  const owners = window.interiorIndexes.map((pointIndex) => {
    const incoming = index.element[pointIndex - 1], outgoing = index.element[pointIndex];
    return incoming && outgoing && incoming.analysisSectionId === outgoing.analysisSectionId
      ? incoming.analysisSectionId : '';
  });
  const unique = [...new Set(owners.filter(Boolean))];
  if (unique.length !== 1 || owners.some((item) => !item)) {
    errors.push(diagnostic('PIPELINE_SECTION_PROFILE_ROUTING_UNOWNED_CANDIDATE',
      'A candidate window crosses or lacks a canonical section boundary.',
      { leftSegment: window.leftSegment, rightSegment: window.rightSegment, analysisSectionIds: unique }));
    return '';
  }
  return unique[0];
}
function sectionScreening(sectionId, sectionSettings, branchInfo, cache, errors) {
  if (cache[sectionId]) return cache[sectionId];
  const settings = sectionSettings[sectionId];
  if (!plain(settings)) {
    errors.push(diagnostic('PIPELINE_SECTION_PROFILE_ROUTING_PROFILE_INVALID',
      'Every canonical section requires exact profile settings.', { analysisSectionId: sectionId }));
    return null;
  }
  cache[sectionId] = calculateElasticBendScreening(settings, branchInfo);
  return cache[sectionId];
}
function materializeWindows(geometryRoute, plan, sectionSettings, branchInfo, errors) {
  const index = indexes(plan), cache = Object.create(null);
  const detection = sameDetectionSettings(sectionSettings, errors);
  const evidence = buildRawBendCandidateWindows(geometryRoute.entries, detection);
  const candidates = [];
  for (const window of evidence.windows) {
    const sectionId = windowOwner(window, index, errors); if (!sectionId) continue;
    const screening = sectionScreening(sectionId, sectionSettings, branchInfo, cache, errors); if (!screening) continue;
    const candidate = materializeRawBendCandidate(geometryRoute.entries, evidence.lengths, window, screening);
    if (!candidate) continue;
    const incoming = index.element[candidate.incomingElementIndex];
    const outgoing = index.element[candidate.outgoingElementIndex];
    if (!incoming || !outgoing || incoming.analysisSectionId !== sectionId
      || outgoing.analysisSectionId !== sectionId) {
      errors.push(diagnostic('PIPELINE_SECTION_PROFILE_ROUTING_UNOWNED_CANDIDATE',
        'Materialized candidate does not preserve canonical section ownership.', { candidateId: candidate.id }));
      continue;
    }
    candidates.push(freeze({ ...candidate, analysisSectionId: sectionId, profileId: incoming.profileId }));
  }
  return { candidates, cache, detection };
}
function candidateMessages(candidates, shared, settingsById, screenings) {
  const warnings = Object.values(screenings).flatMap((screening) => screening.warnings || []);
  const errors = shared.failures.map((failure) => diagnostic('BEND_SHARED_SEGMENT_INFEASIBLE',
    `The straight from node ${failure.fromNode} to ${failure.toNode} is too short for adjacent bends.`, failure));
  candidates.forEach((candidate) => {
    const settings = settingsById[candidate.analysisSectionId] || {};
    if (candidate.profileId === 'gre' && settings.enabled === true && settings.emitToInputXml === true) {
      errors.push(diagnostic('PIPELINE_INPUTXML_GRE_BEND_GEOMETRY_REQUIRED',
        'GRE turn geometry is not reconstructed or emitted.', { candidateId: candidate.id,
          analysisSectionId: candidate.analysisSectionId }));
      return;
    }
    const item = bendCandidateDiagnostic(candidate, settings);
    if (item?.severity === 'BLOCKING') errors.push(item); else if (item) warnings.push(item);
    if (settings.enabled === true && candidate.geometryFits && !candidate.preferredStraightFits) warnings.push(
      bendDiagnostic('WARNING', 'bend_preferred_tangent_not_met',
        `Node ${candidate.cornerNode} fits mandatory geometry but not the preferred tangent.`, candidate));
  });
  return { warnings: Object.freeze(warnings), errors: Object.freeze(errors) };
}
export function resolvePipelineSectionAwareBends({
  geometryRoute = null,
  canonicalAnalysisSectionPlan = null,
  sectionSettingsById = {},
  branchInfo = {},
} = {}) {
  const errors = [];
  if (!plain(geometryRoute) || !Array.isArray(geometryRoute.entries)
    || !Array.isArray(geometryRoute.coordinateRows)) errors.push(diagnostic(
    'PIPELINE_SECTION_PROFILE_ROUTING_INPUT_INVALID', 'One canonical geometry route is required.'));
  if (!validPlan(canonicalAnalysisSectionPlan)) errors.push(diagnostic(
    'PIPELINE_SECTION_PROFILE_ROUTING_SECTION_PLAN_INVALID', 'A ready canonical analysis-section plan is required.'));
  const route = plain(geometryRoute) ? geometryRoute : { entries: [], coordinateRows: [], points: [], excludedMarkerCount: 0 };
  const plan = validPlan(canonicalAnalysisSectionPlan) ? canonicalAnalysisSectionPlan
    : { sections: [], elementResolutions: [] };
  const materialized = materializeWindows(route, plan, sectionSettingsById, branchInfo, errors);
  const shared = resolveSharedBendSegmentFeasibility(materialized.candidates);
  const statusCandidates = shared.candidates.map((candidate) => freeze({ ...candidate,
    status: bendCandidateStatus(candidate, sectionSettingsById[candidate.analysisSectionId] || {}),
    curvatureNodes: Object.freeze([]) }));
  const candidates = Object.freeze(assignBendCurvatureNodes(statusCandidates, route.coordinateRows,
    (candidate) => sectionSettingsById[candidate.analysisSectionId] || {}));
  const emitted = candidates.filter((candidate) => candidate.status === 'EMITTED');
  const messages = candidateMessages(candidates, shared, sectionSettingsById, materialized.cache);
  const bendResolution = freeze({ schema: 'PipelineBendResolution.v3', screening: freeze({
    schema: 'PipelineSectionBendScreening.v1', settings: freeze({ ...materialized.detection }),
    sectionScreenings: freeze(materialized.cache) }), candidates,
    bendByIncomingElementIndex: freeze(Object.fromEntries(emitted.map((candidate) =>
      [candidate.incomingElementIndex, candidate]))), geometryRows: route.coordinateRows,
    geometryPoints: route.points, sharedSegmentFailures: shared.failures,
    warnings: messages.warnings, errors: Object.freeze([...errors, ...messages.errors]),
    hasBlockingErrors: errors.length + messages.errors.length > 0,
    diagnostics: freeze({ candidateCount: candidates.length, emittedCount: emitted.length,
      feasibleCount: candidates.filter((candidate) => candidate.geometryFits).length,
      blockedCount: errors.length + messages.errors.length,
      sharedSegmentFailureCount: shared.failures.length,
      excludedMarkerCount: route.excludedMarkerCount || 0 }) });
  const sectionProfileRoutingPlan = buildPipelineSectionProfileRoutingPlan({
    canonicalAnalysisSectionPlan: plan, bendResolution });
  return freeze({ bendResolution, sectionProfileRoutingPlan });
}
