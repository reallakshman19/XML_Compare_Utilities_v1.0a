import {
  createPipelineGreBendBreakApplicationAuthority,
  createPipelineGreBendGeometryCandidatePlan,
  createPipelineGreBendGeometryDiagnostic,
  createPipelineGreBendGeometryPlan,
  createPipelineGreBendGeometrySharedSegmentConflict,
} from './pipeline-3d-model-gre-bend-geometry-contracts.js';

const EPSILON_MM = 1e-6;
const text = (value) => typeof value === 'string' ? value.trim() : '';
const plain = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const finite = (value) => value === null || value === undefined || value === '' ? null
  : Number.isFinite(Number(value)) ? Number(value) : null;
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const diagnostic = (suffix, message, details = {}) => createPipelineGreBendGeometryDiagnostic(
  `PIPELINE_GRE_BEND_GEOMETRY_${suffix}`, message, details);
function vector(from, to) {
  const values = [finite(from?.x), finite(from?.y), finite(from?.z),
    finite(to?.x), finite(to?.y), finite(to?.z)];
  if (values.some((value) => value === null)) return null;
  const [fx, fy, fz, tx, ty, tz] = values;
  const dx = tx - fx, dy = ty - fy, dz = tz - fz, length = Math.hypot(dx, dy, dz);
  return Number.isFinite(length) && length > 0 ? { x: dx / length, y: dy / length, z: dz / length, length } : null;
}
function point(origin, direction, distance) {
  const values = [finite(origin?.x), finite(origin?.y), finite(origin?.z), finite(distance)];
  if (values.some((value) => value === null) || !direction) return { x: null, y: null, z: null };
  return { x: values[0] + direction.x * values[3], y: values[1] + direction.y * values[3],
    z: values[2] + direction.z * values[3] };
}
function authenticate(input, errors) {
  const bend = input.bendResolution, routing = input.sectionProfileRoutingPlan, vendor = input.greVendorSeriesPlan;
  const bendValid = plain(bend) && bend.schema === 'PipelineBendResolution.v3'
    && Array.isArray(bend.candidates) && Array.isArray(bend.geometryRows);
  const routingValid = plain(routing) && routing.schema === 'PipelineSectionProfileRoutingPlan.v1'
    && routing.ready === true && Array.isArray(routing.candidateOwnership);
  const vendorValid = plain(vendor) && vendor.schema === 'PipelineGreVendorSeriesPlan.v1'
    && vendor.ready === true && Array.isArray(vendor.sectionResolutions);
  if (!bendValid) errors.push(diagnostic('BEND_PLAN_INVALID', 'Canonical PipelineBendResolution.v3 evidence is required.'));
  if (!routingValid) errors.push(diagnostic('ROUTING_PLAN_INVALID', 'A ready section-profile routing plan is required.'));
  if (!vendorValid) errors.push(diagnostic('VENDOR_PLAN_INVALID', 'A ready GRE vendor-series plan is required.'));
  return {
    bend: bendValid ? bend : { candidates: [], geometryRows: [] },
    routing: routingValid ? routing : { candidateOwnership: [] },
    vendor: vendorValid ? vendor : { sectionResolutions: [] },
  };
}
function indexes(source, applicationsInput, errors) {
  const ownership = Object.create(null), vendors = Object.create(null), applications = Object.create(null);
  for (const item of source.routing.candidateOwnership) {
    if (!text(item?.candidateId) || ownership[item.candidateId]) errors.push(diagnostic(
      'ROUTING_PLAN_INVALID', 'Candidate routing identities must be unique.'));
    else ownership[item.candidateId] = item;
  }
  for (const item of source.vendor.sectionResolutions) {
    if (!text(item?.analysisSectionId) || vendors[item.analysisSectionId]) errors.push(diagnostic(
      'VENDOR_PLAN_INVALID', 'GRE section vendor resolutions must be unique.'));
    else vendors[item.analysisSectionId] = item;
  }
  for (const raw of Array.isArray(applicationsInput) ? applicationsInput : []) {
    const item = createPipelineGreBendBreakApplicationAuthority(raw);
    errors.push(...item.diagnostics);
    if (applications[item.analysisSectionId]) errors.push(diagnostic(
      'VENDOR_IDENTITY_CONFLICT', 'Break-length application authority must be unique per GRE section.',
      { analysisSectionId: item.analysisSectionId }));
    else applications[item.analysisSectionId] = item;
  }
  for (const item of Object.values(applications)) {
    const vendor = vendors[item.analysisSectionId];
    if (!vendor || item.vendorId !== vendor.vendorId || item.seriesId !== vendor.seriesId
      || item.qualificationEvidenceId !== vendor.qualificationEvidenceId) errors.push(diagnostic(
      'VENDOR_IDENTITY_CONFLICT', 'Every application authority must match one qualified GRE vendor section.',
      { analysisSectionId: item.analysisSectionId }));
  }
  return { ownership, vendors, applications };
}
function identity(candidate, owner, vendor, application, errors) {
  if (!owner) errors.push(diagnostic('CANDIDATE_UNOWNED', 'Candidate has no canonical section-profile owner.',
    { candidateId: text(candidate?.id) }));
  if (owner?.profileId !== 'gre') return false;
  if (!vendor || vendor.ready !== true || vendor.status !== 'RESOLVED') errors.push(diagnostic(
    'VENDOR_AUTHORITY_MISSING', 'GRE candidate requires one ready section-local vendor resolution.',
    { candidateId: text(candidate?.id), analysisSectionId: text(owner?.analysisSectionId) }));
  if (vendor && (vendor.analysisSectionId !== owner.analysisSectionId || vendor.profileId !== 'gre')) errors.push(
    diagnostic('VENDOR_IDENTITY_CONFLICT', 'Vendor resolution must exactly match the owning GRE section.',
      { candidateId: text(candidate?.id), analysisSectionId: text(owner?.analysisSectionId) }));
  if (!application || application.ready !== true || application.analysisSectionId !== owner?.analysisSectionId
    || application.vendorId !== vendor?.vendorId || application.seriesId !== vendor?.seriesId
    || application.qualificationEvidenceId !== vendor?.qualificationEvidenceId) errors.push(diagnostic(
    'BREAK_BASIS_UNRESOLVED', 'Break-length application authority must exactly match the qualified vendor section.',
    { candidateId: text(candidate?.id), analysisSectionId: text(owner?.analysisSectionId) }));
  return true;
}
function breakDistance(vendor, applicationAuthority, tangent, errors, candidateId) {
  const application = text(applicationAuthority?.bendBreakLengthApplication), length = finite(vendor?.bendBreakLengthMm);
  if (applicationAuthority?.ready !== true || !(length > 0)) {
    errors.push(diagnostic('BREAK_BASIS_UNRESOLVED', 'Qualified break length and application are required.',
      { candidateId, bendBreakLengthApplication: application }));
    return { application, length, distance: null };
  }
  return { application, length,
    distance: application === 'EACH_LEG_FROM_TANGENCY' ? tangent + length : length };
}
function candidatePlan(candidate, owner, vendor, application, rows) {
  const errors = [], candidateId = text(candidate?.id);
  identity(candidate, owner, vendor, application, errors);
  const incoming = candidate?.incomingElementIndex, outgoing = candidate?.outgoingElementIndex;
  if (!Number.isInteger(incoming) || outgoing !== incoming + 1) errors.push(diagnostic(
    'CANDIDATE_UNOWNED', 'Candidate must preserve adjacent incoming and outgoing element identity.', { candidateId }));
  const previous = rows[incoming], corner = rows[outgoing], next = rows[outgoing + 1];
  const incomingVector = vector(corner, previous), outgoingVector = vector(corner, next);
  if (!incomingVector || !outgoingVector) errors.push(diagnostic(
    'INPUT_INVALID', 'Candidate geometry rows must contain finite noncoincident coordinates.', { candidateId }));
  const radius = finite(vendor?.bendRadiusMm), tangent = finite(candidate?.tangentMm);
  if (!(radius > 0) || finite(candidate?.radiusMm) !== radius) errors.push(diagnostic(
    'RADIUS_INVALID', 'Canonical candidate radius must exactly match qualified GRE vendor radius.', { candidateId }));
  if (!(finite(candidate?.turnAngleDeg) > 0) || finite(candidate?.turnAngleDeg) >= 180) errors.push(diagnostic(
    'ANGLE_INVALID', 'GRE turn angle must be finite and between zero and 180 degrees.', { candidateId }));
  if (!(tangent > 0)) errors.push(diagnostic('TANGENCY_INFEASIBLE',
    'Canonical candidate tangent length is required.', { candidateId }));
  const basis = breakDistance(vendor, application, tangent || 0, errors, candidateId);
  const incomingLength = incomingVector?.length ?? finite(candidate?.incomingLengthMm);
  const outgoingLength = outgoingVector?.length ?? finite(candidate?.outgoingLengthMm);
  const geometryFits = Boolean(tangent > 0 && incomingLength + EPSILON_MM >= tangent
    && outgoingLength + EPSILON_MM >= tangent);
  if (!geometryFits) errors.push(diagnostic('TANGENCY_INFEASIBLE',
    'Qualified bend tangency does not fit the adjacent straight lengths.', { candidateId }));
  const breakEnvelopeFits = Boolean(basis.distance > 0 && incomingLength + EPSILON_MM >= basis.distance
    && outgoingLength + EPSILON_MM >= basis.distance);
  if (!breakEnvelopeFits) errors.push(diagnostic('BREAK_ENVELOPE_INFEASIBLE',
    'Qualified GRE break envelope exceeds an adjacent straight.', { candidateId }));
  const safeDirection = { x: 0, y: 0, z: 0 };
  const inDirection = incomingVector || safeDirection, outDirection = outgoingVector || safeDirection;
  const safeCorner = plain(corner) ? corner : { x: null, y: null, z: null };
  return createPipelineGreBendGeometryCandidatePlan({
    candidateId, analysisSectionId: text(owner?.analysisSectionId), profileId: text(owner?.profileId),
    incomingElementIndex: incoming, outgoingElementIndex: outgoing,
    incomingElementId: Number.isInteger(incoming) ? `E${incoming + 1}` : '',
    outgoingElementId: Number.isInteger(outgoing) ? `E${outgoing + 1}` : '',
    previousNode: candidate?.previousNode, cornerNode: candidate?.cornerNode, nextNode: candidate?.nextNode,
    turnAngleDeg: candidate?.turnAngleDeg, bendRadiusMm: radius, tangentLengthMm: tangent,
    bendBreakLengthBasis: vendor?.bendBreakLengthBasis,
    bendBreakLengthApplication: basis.application, bendBreakLengthMm: basis.length,
    bendLocalThicknessMm: vendor?.bendLocalThicknessMm,
    incomingAvailableLengthMm: incomingLength, outgoingAvailableLengthMm: outgoingLength,
    incomingBreakDistanceFromCornerMm: basis.distance, outgoingBreakDistanceFromCornerMm: basis.distance,
    incomingTangencyPoint: point(safeCorner, inDirection, tangent || 0),
    outgoingTangencyPoint: point(safeCorner, outDirection, tangent || 0),
    incomingBreakPoint: point(safeCorner, inDirection, basis.distance || 0),
    outgoingBreakPoint: point(safeCorner, outDirection, basis.distance || 0),
    vendorId: vendor?.vendorId, seriesId: vendor?.seriesId,
    qualificationEvidenceId: vendor?.qualificationEvidenceId, requirementReference: vendor?.requirementReference,
    sourceAuthority: application?.sourceAuthority || vendor?.sourceAuthority,
    sourceReference: application?.sourceReference || vendor?.sourceReference,
    geometryFits, breakEnvelopeFits, sharedSegmentFits: true, diagnostics: errors,
  });
}
function applySharedConflicts(plans) {
  const conflicts = [], affected = Object.create(null);
  const ordered = [...plans].sort((a, b) => a.incomingElementIndex - b.incomingElementIndex
    || compare(a.candidateId, b.candidateId));
  for (let index = 0; index < ordered.length - 1; index += 1) {
    const left = ordered[index], right = ordered[index + 1];
    if (left.outgoingElementIndex !== right.incomingElementIndex) continue;
    const available = left.outgoingAvailableLengthMm;
    const required = left.outgoingBreakDistanceFromCornerMm + right.incomingBreakDistanceFromCornerMm;
    if (available + EPSILON_MM >= required) continue;
    const ids = [left.candidateId, right.candidateId].sort(compare);
    const conflictId = `GRE-BEND-SHARED:${left.outgoingElementIndex}:${ids.join('|')}`;
    const conflict = createPipelineGreBendGeometrySharedSegmentConflict({
      conflictId, segmentIndex: left.outgoingElementIndex, candidateIds: ids,
      availableLengthMm: available, requiredLengthMm: required,
      diagnostics: [diagnostic('SHARED_SEGMENT_CONFLICT',
        'Adjacent GRE fitting envelopes overlap on one canonical straight.', { conflictId })],
    });
    conflicts.push(conflict); ids.forEach((id) => { affected[id] = conflictId; });
  }
  const resolved = plans.map((item) => affected[item.candidateId] ? createPipelineGreBendGeometryCandidatePlan({
    ...item, sharedSegmentFits: false, diagnostics: [...item.diagnostics, diagnostic('SHARED_SEGMENT_CONFLICT',
      'GRE fitting envelope conflicts with an adjacent candidate.', { conflictId: affected[item.candidateId] })],
  }) : item);
  return { candidatePlans: resolved, sharedSegmentConflicts: conflicts };
}
export function resolvePipelineGreBendGeometryPlan(input = {}) {
  const errors = [], source = authenticate(plain(input) ? input : {}, errors),
    index = indexes(source, input?.bendBreakApplications, errors);
  const candidates = [...source.bend.candidates].sort((a, b) => a.incomingElementIndex - b.incomingElementIndex
    || compare(text(a.id), text(b.id)));
  const plans = [], notApplicable = [];
  for (const candidate of candidates) {
    const candidateId = text(candidate?.id), owner = index.ownership[candidateId];
    if (!owner) {
      errors.push(diagnostic('CANDIDATE_UNOWNED', 'Every bend candidate requires canonical routing ownership.',
        { candidateId }));
      continue;
    }
    if (owner.profileId !== 'gre') {
      if (!['normal-metallic', 'asme-b31.4'].includes(owner.profileId)) errors.push(diagnostic(
        'PROFILE_INVALID', 'Candidate routing profile is invalid.', { candidateId, profileId: owner.profileId }));
      else notApplicable.push(candidateId);
      continue;
    }
    plans.push(candidatePlan(candidate, owner, index.vendors[owner.analysisSectionId],
      index.applications[owner.analysisSectionId], source.bend.geometryRows));
  }
  const shared = applySharedConflicts(plans);
  const greOwned = Object.values(index.ownership).filter((item) => item?.profileId === 'gre').length;
  if (shared.candidatePlans.length !== greOwned) errors.push(diagnostic(
    'COVERAGE_INVALID', 'Every GRE-owned bend candidate requires exactly one geometry plan.',
    { greOwnedCandidateCount: greOwned, plannedCandidateCount: shared.candidatePlans.length }));
  return createPipelineGreBendGeometryPlan({
    bendResolutionSchema: text(source.bend.schema),
    sectionProfileRoutingPlanSchema: text(source.routing.schema),
    greVendorSeriesPlanSchema: text(source.vendor.schema),
    candidatePlans: shared.candidatePlans, notApplicableCandidateIds: notApplicable,
    sharedSegmentConflicts: shared.sharedSegmentConflicts,
    coverage: { candidateCount: candidates.length, greOwnedCandidateCount: greOwned,
      plannedCandidateCount: shared.candidatePlans.length, notApplicableCandidateCount: notApplicable.length,
      sharedSegmentConflictCount: shared.sharedSegmentConflicts.length },
    diagnostics: errors,
  });
}
