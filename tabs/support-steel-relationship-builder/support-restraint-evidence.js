import {
  geometryRepresentativePoint,
  projectPointToCarrierFrame,
} from './support-restraint-local-frame.js';

const REST_ROLES = new Set(['PIPE_SHOE', 'WEAR_PLATE', 'BRACKET_MEMBER', 'SPRING_MEMBER']);

export function buildFamilyRestraintEvidence(input = {}) {
  const family = input.family || {};
  const threshold = positive(input.directionOffsetToleranceMm, 5);
  const frames = new Map((input.carrierFrames || []).map((row) => [row.carrierObjectId, row]));
  const members = new Map((family.members || []).map((row) => [row.memberId, row]));
  const attachmentEdges = (input.attachmentEdges || []).filter((row) => row.supportFamilyId === family.familyId);
  const completePaths = (input.completePaths || []).filter((row) => row.supportFamilyId === family.familyId);
  const chainEdges = (input.chainEdges || []).filter((row) => row.supportFamilyId === family.familyId);
  return attachmentEdges.map((attachment) => {
    const frame = frames.get(attachment.carrierObjectId) || null;
    const paths = completePaths.filter((row) => row.carrierAttachmentEdgeId === attachment.edgeId);
    const reachableMemberIds = reachableMembers(attachment.supportMemberId, chainEdges);
    const memberRows = [...reachableMemberIds].map((id) => members.get(id)).filter(Boolean);
    const directionEvidence = [];
    const memberProjections = [];
    for (const member of memberRows) {
      const point = geometryRepresentativePoint(member);
      const projection = projectPointToCarrierFrame(point, frame);
      const physicalGeometryAvailable = Boolean(member.analyticalGeometry?.physicalGeometryAvailable);
      memberProjections.push({
        supportMemberId: member.memberId,
        semanticRole: member.semanticRole,
        representativePointGlobal: point,
        physicalGeometryAvailable,
        ...projection,
      });
      if (!physicalGeometryAvailable || !projection.available || !paths.length || frame?.frameStatus !== 'RESOLVED_ORTHOGONAL_FRAME') continue;
      directionEvidence.push(...directionsForMember(member, projection, threshold, frame));
    }
    return {
      evidenceId: `SSRF-EVIDENCE:${family.familyId}:${attachment.carrierObjectId}`,
      supportFamilyId: family.familyId,
      carrierObjectId: attachment.carrierObjectId,
      carrierAttachmentEdgeId: attachment.edgeId,
      attachmentSupportMemberId: attachment.supportMemberId,
      carrierFrameStatus: frame?.frameStatus || 'UNRESOLVED_CARRIER_FRAME',
      carrierFrameQuality: frame?.frameQuality || 'NONE',
      structuralContinuityProven: paths.length > 0,
      completePathIds: paths.map((row) => row.pathId),
      reachableMemberIds: [...reachableMemberIds].sort(),
      memberProjections,
      directionEvidence: uniqueDirectionEvidence(directionEvidence),
      evidencedDirections: unique(directionEvidence.map((row) => row.direction)),
      roleEvidence: roleEvidence(memberRows, attachment),
      evidenceStatus: evidenceStatus(frame, paths),
      directionOffsetToleranceMm: threshold,
    };
  });
}

function directionsForMember(member, projection, threshold, frame) {
  const role = member.semanticRole;
  const rows = [];
  if (role === 'GUIDE_MEMBER' && Math.abs(projection.lateralMm) >= threshold) {
    rows.push(directionRow(member, projection.lateralMm > 0 ? '+LATERAL' : '-LATERAL', projection.lateralMm, frame));
  }
  if (role === 'LINE_STOP_MEMBER' && Math.abs(projection.axialMm) >= threshold) {
    rows.push(directionRow(member, projection.axialMm > 0 ? '+AXIAL' : '-AXIAL', projection.axialMm, frame));
  }
  if (role === 'CLAMP_MEMBER' && Math.abs(projection.verticalMm) >= threshold) {
    rows.push(directionRow(member, projection.verticalMm > 0 ? '+VERTICAL' : '-VERTICAL', projection.verticalMm, frame));
  }
  if (REST_ROLES.has(role) && projection.verticalMm <= -threshold) {
    rows.push(directionRow(member, '-VERTICAL', projection.verticalMm, frame));
  }
  return rows;
}

function directionRow(member, direction, offsetMm, frame) {
  return {
    evidenceId: `SSRF-DIRECTION:${member.memberId}:${direction}`,
    supportMemberId: member.memberId,
    semanticRole: member.semanticRole,
    direction,
    offsetMm: round3(offsetMm),
    evidenceClass: 'ANALYTICAL_MEMBER_GEOMETRY_IN_CARRIER_FRAME',
    structuralContinuityRequired: true,
    confidence: frame.frameQuality === 'HIGH' ? 'HIGH' : 'LOW',
  };
}

function roleEvidence(members, attachment) {
  const physicalMembers = members.filter((row) => row.analyticalGeometry?.physicalGeometryAvailable);
  const roles = new Set(physicalMembers.map((row) => row.semanticRole));
  return {
    pipeShoePresent: roles.has('PIPE_SHOE') || (attachment.supportMemberRole === 'PIPE_SHOE'
      && physicalMembers.some((row) => row.memberId === attachment.supportMemberId)),
    guideMemberCount: physicalMembers.filter((row) => row.semanticRole === 'GUIDE_MEMBER').length,
    lineStopMemberCount: physicalMembers.filter((row) => row.semanticRole === 'LINE_STOP_MEMBER').length,
    clampMemberCount: physicalMembers.filter((row) => row.semanticRole === 'CLAMP_MEMBER').length,
    springMemberCount: physicalMembers.filter((row) => row.semanticRole === 'SPRING_MEMBER').length,
    anchorMemberCount: physicalMembers.filter((row) => row.semanticRole === 'ANCHOR_MEMBER').length,
    wearPlateCount: physicalMembers.filter((row) => row.semanticRole === 'WEAR_PLATE').length,
  };
}

function reachableMembers(start, edges) {
  const adjacency = new Map();
  for (const edge of edges) {
    add(adjacency, edge.supportA, edge.supportB);
    add(adjacency, edge.supportB, edge.supportA);
  }
  const visited = new Set(start ? [start] : []);
  const queue = start ? [start] : [];
  while (queue.length) {
    const current = queue.shift();
    for (const next of adjacency.get(current) || []) {
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push(next);
    }
  }
  return visited;
}
function add(map, key, value) {
  if (!key || !value) return;
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}
function evidenceStatus(frame, paths) {
  if (!frame) return 'UNRESOLVED_CARRIER_FRAME';
  if (frame.frameStatus === 'VERTICAL_PIPE_FRAME_AMBIGUOUS') return 'VERTICAL_PIPE_FRAME_AMBIGUOUS';
  if (frame.frameStatus !== 'RESOLVED_ORTHOGONAL_FRAME') return frame.frameStatus;
  if (!paths.length) return 'CARRIER_TO_STRUCTURE_PATH_NOT_PROVEN';
  return 'ANALYTICAL_RESTRAINT_EVIDENCE_AVAILABLE';
}
function uniqueDirectionEvidence(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = `${row.supportMemberId}:${row.direction}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function unique(values) { return [...new Set(values.filter(Boolean))].sort(); }
function positive(value, fallback) { const number = Number(value); return Number.isFinite(number) && number >= 0 ? number : fallback; }
function round3(value) { return Math.round(value * 1000) / 1000; }
