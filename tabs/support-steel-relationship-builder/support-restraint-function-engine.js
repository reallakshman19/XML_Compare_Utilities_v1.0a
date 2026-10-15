import { buildFamilyRestraintEvidence } from './support-restraint-evidence.js';
import { classifySupportRestraintIntent } from './support-restraint-intent.js';
import { buildSupportCarrierLocalFrames } from './support-restraint-local-frame.js';

export const SUPPORT_RESTRAINT_FUNCTION_SCHEMA = 'SupportRestraintFunctionBundle.v1';
const ANCHOR_DIRECTIONS = Object.freeze([
  '+AXIAL', '-AXIAL', '+LATERAL', '-LATERAL', '+VERTICAL', '-VERTICAL',
]);

export function buildSupportRestraintFunctionBundle(input = {}) {
  const config = resolveConfig(input.config || {});
  const frameBundle = buildSupportCarrierLocalFrames({
    carrierObjects: input.carrierObjects || [],
    config,
  });
  const intents = [];
  const evidencedRestraints = [];
  const functionAssessments = [];
  const functionExceptions = [...frameBundle.frameExceptions];
  const familyResults = [];

  for (const family of input.supportFamilies || []) {
    const intent = classifySupportRestraintIntent(family);
    intents.push(intent);
    const evidenceRows = buildFamilyRestraintEvidence({
      family,
      carrierFrames: frameBundle.carrierFrames,
      attachmentEdges: input.carrierAttachment?.supportCarrierAttachmentEdges || [],
      completePaths: input.carrierToStructurePath?.completePaths || [],
      chainEdges: input.supportMemberChain?.supportChainEdges || [],
      directionOffsetToleranceMm: config.restraintDirectionToleranceMm,
    });
    evidencedRestraints.push(...evidenceRows);
    const familyAssessments = assessFamily(family, intent, evidenceRows);
    functionAssessments.push(...familyAssessments.assessments);
    functionExceptions.push(...familyAssessments.exceptions);
    familyResults.push(familyResult(family, intent, evidenceRows, familyAssessments));
  }

  const restraintEdges = evidencedRestraints.flatMap((row) => row.directionEvidence.map((direction) => ({
    edgeId: `SSRF-EDGE:${row.carrierObjectId}:${direction.supportMemberId}:${direction.direction}`,
    edgeType: 'SUPPORT_RESTRAINT_DIRECTION',
    supportFamilyId: row.supportFamilyId,
    supportMemberId: direction.supportMemberId,
    carrierObjectId: row.carrierObjectId,
    movementDirection: direction.direction,
    relationshipStatus: 'ANALYTICAL_RESTRAINT_DIRECTION_CANDIDATE',
    relationshipBasis: [direction.evidenceClass, 'COMPLETE_CARRIER_TO_STRUCTURE_PATH'],
    confidence: direction.confidence,
    evidenceId: direction.evidenceId,
    contactEvidenceStatus: 'ANALYTICAL_FUNCTION_CANDIDATE',
  })));
  return {
    schema: SUPPORT_RESTRAINT_FUNCTION_SCHEMA,
    relationshipSemantic: 'INTENDED_SUPPORT_FUNCTION_TO_ANALYTICAL_RESTRAINT_CAPABILITY',
    xmlRequired: false,
    confirmedFabricatedRestraintAvailable: false,
    config,
    carrierFrameSchema: frameBundle.schema,
    carrierFrames: frameBundle.carrierFrames,
    intendedFunctions: intents,
    evidencedRestraints,
    functionAssessments,
    restraintEdges,
    functionExceptions,
    familyResults,
    summary: createSummary(familyResults, functionAssessments, functionExceptions, frameBundle),
    diagnostics: functionExceptions.map(exceptionDiagnostic),
  };
}

function assessFamily(family, intent, evidenceRows) {
  const assessments = [];
  const exceptions = intent.conflicts.map((row) => exceptionRecord(row.exceptionCode, family.familyId, null, null, row.message));
  if (!intent.intendedFunctions.length) {
    exceptions.push(exceptionRecord(
      'UNCLASSIFIED_SUPPORT_FUNCTION', family.familyId, null, null,
      'No intended support function could be classified from explicit attributes, member roles, or description hints.',
      'INFO',
    ));
    return { assessments, exceptions };
  }
  if (!evidenceRows.length) {
    for (const intended of intent.intendedFunctions) {
      assessments.push(assessmentRecord(family.familyId, null, intended.supportFunction, 'FUNCTION_NOT_PROVEN', [], [], intended.confidence));
    }
    exceptions.push(exceptionRecord(
      'CARRIER_ATTACHMENT_NOT_AVAILABLE_FOR_FUNCTION_AUDIT', family.familyId, null, null,
      'No analytical carrier-attachment edge is available for restraint-function validation.',
    ));
    return { assessments, exceptions };
  }
  for (const evidence of evidenceRows) {
    for (const intended of intent.intendedFunctions) {
      const result = assessFunction(intended.supportFunction, evidence);
      assessments.push(assessmentRecord(
        family.familyId, evidence.carrierObjectId, intended.supportFunction,
        result.status, result.requiredDirections, evidence.evidencedDirections, minimumConfidence(intended.confidence, result.confidence),
      ));
      if (result.exceptionCode) {
        exceptions.push(exceptionRecord(
          result.exceptionCode, family.familyId, evidence.carrierObjectId, intended.supportFunction,
          result.message, result.severity,
        ));
      }
    }
  }
  return { assessments, exceptions };
}

function assessFunction(supportFunction, evidence) {
  const directions = new Set(evidence.evidencedDirections || []);
  const roles = evidence.roleEvidence || {};
  if (isDirectionalFunction(supportFunction) && evidence.carrierFrameStatus === 'VERTICAL_PIPE_FRAME_AMBIGUOUS') {
    return result('FUNCTION_AMBIGUOUS', [], 'VERTICAL_PIPE_FRAME_AMBIGUOUS', 'Directional restraint cannot be confirmed because the carrier axis is parallel to gravity.');
  }
  if (!evidence.structuralContinuityProven && supportFunction !== 'PIPE_SHOE') {
    return result('FUNCTION_NOT_PROVEN', [], 'CARRIER_TO_STRUCTURE_PATH_NOT_PROVEN', 'The support function lacks a complete analytical carrier-to-structure path.');
  }
  if (supportFunction === 'REST') return requireDirections(directions, ['-VERTICAL'], 'REST_VERTICAL_CONTACT_NOT_PROVEN');
  if (supportFunction === 'GUIDE') return pairedDirections(directions, ['+LATERAL', '-LATERAL'], 'GUIDE_SIDE_PLATE_MISSING', 'GUIDE_ONLY_ONE_SIDE_PROVEN');
  if (supportFunction === 'LINE_STOP') return pairedDirections(directions, ['+AXIAL', '-AXIAL'], 'LINE_STOP_DIRECTION_NOT_PROVEN', 'LINE_STOP_ONLY_ONE_DIRECTION_PROVEN');
  if (supportFunction === 'HOLD_DOWN') return requireDirections(directions, ['+VERTICAL'], 'HOLD_DOWN_NOT_CONNECTED');
  if (supportFunction === 'ANCHOR') return requireDirections(directions, ANCHOR_DIRECTIONS, 'ANCHOR_RESTRAINT_INCOMPLETE');
  if (supportFunction === 'SPRING') return roleResult(roles.springMemberCount > 0, 'SPRING_ELEMENT_NOT_IDENTIFIED');
  if (supportFunction === 'CLAMP') return roleResult(roles.clampMemberCount > 0, 'CLAMP_MEMBER_NOT_IDENTIFIED');
  if (supportFunction === 'PIPE_SHOE') return roleResult(Boolean(roles.pipeShoePresent), 'PIPE_SHOE_NOT_IDENTIFIED');
  return result('FUNCTION_NOT_PROVEN', [], 'UNCLASSIFIED_SUPPORT_FUNCTION', 'The intended support function is not supported by the restraint policy.');
}

function requireDirections(evidenced, required, exceptionCode) {
  const found = required.filter((row) => evidenced.has(row));
  if (found.length === required.length) return result('FUNCTION_CONFIRMED', required, null, null, 'HIGH');
  if (found.length) return result('FUNCTION_PARTIALLY_CONFIRMED', required, exceptionCode, `Only ${found.join(', ')} of ${required.join(', ')} is analytically evidenced.`, 'MEDIUM');
  return result('FUNCTION_NOT_PROVEN', required, exceptionCode, `Required restraint direction(s) ${required.join(', ')} are not analytically evidenced.`);
}
function pairedDirections(evidenced, required, missingCode, partialCode) {
  const found = required.filter((row) => evidenced.has(row));
  if (found.length === 2) return result('FUNCTION_CONFIRMED', required, null, null, 'HIGH');
  if (found.length === 1) return result('FUNCTION_PARTIALLY_CONFIRMED', required, partialCode, `Only ${found[0]} is analytically evidenced.`, 'MEDIUM');
  return result('FUNCTION_NOT_PROVEN', required, missingCode, `Neither ${required.join(' nor ')} is analytically evidenced.`);
}
function roleResult(available, exceptionCode) {
  return available
    ? result('FUNCTION_CONFIRMED', [], null, null, 'MEDIUM')
    : result('FUNCTION_NOT_PROVEN', [], exceptionCode, 'The required physical support-member role is not identified in the connected analytical assembly.');
}
function result(status, requiredDirections, exceptionCode, message, confidence = 'NONE', severity = 'WARN') {
  return { status, requiredDirections, exceptionCode, message, confidence, severity };
}
function assessmentRecord(familyId, carrierId, supportFunction, status, requiredDirections, evidencedDirections, confidence) {
  return {
    assessmentId: `SSRF-ASSESS:${familyId}:${carrierId || 'NONE'}:${supportFunction}`,
    supportFamilyId: familyId,
    carrierObjectId: carrierId,
    supportFunction,
    functionStatus: status,
    requiredDirections,
    evidencedDirections,
    confidence,
    evidenceBoundary: 'ANALYTICAL_FUNCTION_CANDIDATE',
  };
}
function exceptionRecord(code, familyId, carrierId, supportFunction, message, severity = 'WARN') {
  return {
    exceptionId: `SSRF-EX:${code}:${familyId}:${carrierId || 'NONE'}:${supportFunction || 'GENERAL'}`,
    exceptionCode: code,
    severity,
    supportFamilyId: familyId,
    carrierObjectId: carrierId,
    supportFunction,
    message,
  };
}
function familyResult(family, intent, evidence, familyAssessments) {
  const statuses = familyAssessments.assessments.map((row) => row.functionStatus);
  const status = intent.conflicts.length ? 'FUNCTION_CONFLICT'
    : !intent.intendedFunctions.length ? 'FUNCTION_NOT_PROVEN'
      : statuses.length && statuses.every((row) => row === 'FUNCTION_CONFIRMED') ? 'FUNCTION_CONFIRMED'
        : statuses.some((row) => row === 'FUNCTION_CONFIRMED' || row === 'FUNCTION_PARTIALLY_CONFIRMED') ? 'FUNCTION_PARTIALLY_CONFIRMED'
          : statuses.some((row) => row === 'FUNCTION_AMBIGUOUS') ? 'FUNCTION_AMBIGUOUS'
            : 'FUNCTION_NOT_PROVEN';
  return {
    supportFamilyId: family.familyId,
    functionStatus: status,
    intendedFunctions: intent.intendedFunctions.map((row) => row.supportFunction),
    carrierObjectIds: unique(evidence.map((row) => row.carrierObjectId)),
    assessmentIds: familyAssessments.assessments.map((row) => row.assessmentId),
    exceptionIds: familyAssessments.exceptions.map((row) => row.exceptionId),
    exceptionCodes: unique(familyAssessments.exceptions.map((row) => row.exceptionCode)),
  };
}
function createSummary(families, assessments, exceptions, frames) {
  return {
    familyCount: families.length,
    confirmedFamilyCount: families.filter((row) => row.functionStatus === 'FUNCTION_CONFIRMED').length,
    partiallyConfirmedFamilyCount: families.filter((row) => row.functionStatus === 'FUNCTION_PARTIALLY_CONFIRMED').length,
    conflictFamilyCount: families.filter((row) => row.functionStatus === 'FUNCTION_CONFLICT').length,
    ambiguousFamilyCount: families.filter((row) => row.functionStatus === 'FUNCTION_AMBIGUOUS').length,
    notProvenFamilyCount: families.filter((row) => row.functionStatus === 'FUNCTION_NOT_PROVEN').length,
    assessmentCount: assessments.length,
    exceptionCount: exceptions.length,
    carrierFrameCount: frames.summary.carrierFrameCount,
    verticalPipeAmbiguousCount: frames.summary.verticalPipeAmbiguousCount,
  };
}
function resolveConfig(config) {
  const tolerance = Number(config.restraintDirectionToleranceMm);
  return {
    gravityAxis: config.gravityAxis || config.verticalAxis || { x: 0, y: 0, z: 1 },
    verticalPipeParallelThreshold: config.verticalPipeParallelThreshold,
    restraintDirectionToleranceMm: Number.isFinite(tolerance) && tolerance >= 0 ? tolerance : 5,
  };
}
function isDirectionalFunction(value) { return ['REST', 'GUIDE', 'LINE_STOP', 'HOLD_DOWN', 'ANCHOR'].includes(value); }
function minimumConfidence(left, right) {
  const rank = { NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3 };
  return (rank[left] || 0) <= (rank[right] || 0) ? left : right;
}
function unique(values) { return [...new Set(values.filter(Boolean))].sort(); }
function exceptionDiagnostic(row) { return { severity: row.severity, code: row.exceptionCode, supportFamilyId: row.supportFamilyId, carrierObjectId: row.carrierObjectId, message: row.message }; }
