import { supportMemberToStructuralGeometryDistance } from './support-structural-terminal-distance.js';

export const SUPPORT_STRUCTURAL_TERMINAL_MULTI_CONTACT_SCHEMA = 'SupportStructuralTerminalMultiContact.v1';

export function applySupportStructuralTerminalMultiContact(bundle = {}, config = {}) {
  const chain = bundle.supportMemberChain || {};
  const contactToleranceMm = nonNegative(config.memberContactToleranceMm, chain.config?.memberContactToleranceMm, 2);
  const candidateToleranceMm = nonNegative(config.memberCandidateToleranceMm, chain.config?.memberCandidateToleranceMm, 25);
  const families = new Map((bundle.supportFamilies || []).map((row) => [normalize(row.familyId), row]));
  const steelGroups = new Map((bundle.steelGroups || []).map((row) => [normalize(row.steelGroupId), row]));
  const relationshipsByFamily = groupBy(bundle.relationships || [], (row) => normalize(row.supportFamilyId));
  const familyChains = (chain.familyChains || []).map((familyChain) => {
    const family = families.get(normalize(familyChain.familyId));
    const relationships = relationshipsByFamily.get(normalize(familyChain.familyId)) || [];
    return rebuildFamilyTerminals(
      familyChain, family, relationships, steelGroups,
      contactToleranceMm, candidateToleranceMm,
    );
  });
  const structuralTerminalEdges = familyChains.flatMap((row) => row.structuralTerminalEdges || []);
  const analyticalContacts = structuralTerminalEdges.filter(isAnalyticalContact);
  const nearbyCandidates = structuralTerminalEdges.filter((row) => (
    row.edgeType === 'SUPPORT_MEMBER_TO_STRUCTURE' && row.contactEvidenceStatus === 'CLEARANCE_ONLY'
  ));
  const unresolvedPhysicalMemberCount = familyChains.reduce(
    (sum, row) => sum + (row.unresolvedPhysicalMemberIds || []).length,
    0,
  );
  const multiTerminalFamilies = familyChains.filter((row) => (
    (row.structuralTerminalEdges || []).filter(isAnalyticalContact).length > 1
  ));
  const unresolvedKeys = new Set(familyChains.flatMap((row) => (
    (row.unresolvedPhysicalMemberIds || []).map((memberId) => memberKey(row.familyId, memberId))
  )));
  const reconciledDiagnostics = (bundle.diagnostics || []).filter((row) => (
    row.code !== 'SUPPORT_MEMBER_NOT_CONNECTED_BY_ANALYTICAL_GEOMETRY'
    || unresolvedKeys.has(memberKey(row.supportFamilyId, row.memberId))
  ));
  const supportMemberChain = {
    ...chain,
    terminalEvaluationSchema: SUPPORT_STRUCTURAL_TERMINAL_MULTI_CONTACT_SCHEMA,
    structuralTerminalEdges,
    familyChains,
    summary: {
      ...(chain.summary || {}),
      structuralTerminalEdgeCount: structuralTerminalEdges.length,
      analyticalStructuralTerminalContactCount: analyticalContacts.length,
      nearbyStructuralTerminalCandidateCount: nearbyCandidates.length,
      multiTerminalFamilyCount: multiTerminalFamilies.length,
      unresolvedPhysicalMemberCount,
    },
  };
  return {
    ...bundle,
    structuralTerminalEvaluationSchema: SUPPORT_STRUCTURAL_TERMINAL_MULTI_CONTACT_SCHEMA,
    supportMemberChain,
    summary: {
      ...(bundle.summary || {}),
      structuralTerminalEdgeCount: structuralTerminalEdges.length,
      analyticalStructuralTerminalContactCount: analyticalContacts.length,
      nearbyStructuralTerminalCandidateCount: nearbyCandidates.length,
      multiTerminalFamilyCount: multiTerminalFamilies.length,
      unresolvedPhysicalMemberCount,
    },
    diagnostics: [
      ...reconciledDiagnostics,
      ...multiTerminalFamilies.map((row) => ({
        severity: 'INFO',
        code: 'MULTIPLE_ANALYTICAL_STRUCTURAL_TERMINALS_CONFIRMED',
        supportFamilyId: row.familyId,
        terminalCount: row.structuralTerminalEdges.filter(isAnalyticalContact).length,
        message: 'More than one physical support member independently contacts the selected structural geometry.',
      })),
    ],
  };
}

function rebuildFamilyTerminals(familyChain, family, relationships, steelGroups, contactToleranceMm, candidateToleranceMm) {
  const symbolicEdges = (familyChain.structuralTerminalEdges || []).filter((row) => row.edgeType === 'STRUCTURAL_REFERENCE');
  const physicalMembers = (family?.members || familyChain.memberNodes || []).filter((member) => (
    !['DATUM', 'STRUCTURAL_REFERENCE'].includes(member.semanticRole)
    && member.analyticalGeometry?.physicalGeometryAvailable
  ));
  const evaluations = relationships
    .filter((row) => row.steelGroupId && row.relationshipStatus !== 'AMBIGUOUS')
    .flatMap((relationship) => evaluateRelationship(
      familyChain.familyId, physicalMembers, relationship,
      steelGroups.get(normalize(relationship.steelGroupId)),
      contactToleranceMm, candidateToleranceMm,
    ));
  const evaluatedRelationshipKeys = new Set(evaluations.map((row) => row.relationshipKey));
  const preservedPhysical = (familyChain.structuralTerminalEdges || []).filter((row) => (
    row.edgeType === 'SUPPORT_MEMBER_TO_STRUCTURE'
    && !evaluatedRelationshipKeys.has(relationshipKey(row.steelGroupId, row.structuralMemberId))
  ));
  const generatedPhysical = evaluations.flatMap((row) => row.edges);
  const structuralTerminalEdges = dedupe([...symbolicEdges, ...preservedPhysical, ...generatedPhysical]);
  const connected = new Set([
    ...(familyChain.supportChainEdges || []).flatMap((row) => [row.supportA, row.supportB]),
    ...structuralTerminalEdges.filter(isAnalyticalContact).map((row) => row.supportMemberId),
  ]);
  const unresolvedPhysicalMemberIds = physicalMembers
    .map((row) => row.memberId)
    .filter((memberId) => memberId && !connected.has(memberId));
  return { ...familyChain, structuralTerminalEdges, unresolvedPhysicalMemberIds };
}

function evaluateRelationship(familyId, members, relationship, steelGroup, contactToleranceMm, candidateToleranceMm) {
  const records = selectedStructuralRecords(steelGroup, relationship.structuralMemberId);
  if (!records.length) return [];
  return records.map((record) => {
    const structuralMemberId = record.recordId || relationship.structuralMemberId || relationship.steelGroupId;
    const candidates = members.map((member) => ({
      member,
      evidence: supportMemberToStructuralGeometryDistance(member, record.analyticalGeometry),
    })).filter((row) => row.evidence.analyticalGeometryAvailable && Number.isFinite(row.evidence.distanceMm))
      .sort((left, right) => left.evidence.distanceMm - right.evidence.distanceMm || String(left.member.memberId).localeCompare(String(right.member.memberId)));
    const contacts = candidates.filter((row) => row.evidence.distanceMm <= contactToleranceMm);
    const chosen = contacts.length ? contacts : candidates.slice(0, 1).filter((row) => row.evidence.distanceMm <= candidateToleranceMm);
    return {
      relationshipKey: relationshipKey(relationship.steelGroupId, structuralMemberId),
      edges: chosen.map((row) => terminalEdge(
        familyId, row.member, relationship, structuralMemberId, row.evidence,
        row.evidence.distanceMm <= contactToleranceMm, contactToleranceMm, candidateToleranceMm,
      )),
    };
  });
}

function terminalEdge(familyId, member, relationship, structuralMemberId, evidence, inContact, contactToleranceMm, candidateToleranceMm) {
  return {
    edgeId: `SSMC-STRUCT:${member.memberId}::${structuralMemberId}`,
    edgeType: 'SUPPORT_MEMBER_TO_STRUCTURE',
    supportFamilyId: familyId,
    supportMemberId: member.memberId,
    supportMemberRole: member.semanticRole,
    steelGroupId: relationship.steelGroupId,
    structuralMemberId,
    relationshipStatus: inContact ? 'RESOLVED_ANALYTICAL_CONTACT' : 'NEARBY_ANALYTICAL_CANDIDATE',
    relationshipBasis: [
      'FAMILY_TO_STEEL_RELATIONSHIP',
      'SUPPORT_MEMBER_TO_STRUCTURAL_MEMBER_GEOMETRY',
      inContact ? 'ALL_IN_CONTACT_MEMBERS' : 'NEAREST_CLEARANCE_MEMBER_ONLY',
    ],
    evidenceSource: 'STAGED_JSON_MEMBER_GEOMETRY_ENGINE',
    evidenceClass: 'ANALYTICAL',
    contactEvidenceStatus: inContact ? 'ANALYTICAL_CONTACT_CANDIDATE' : 'CLEARANCE_ONLY',
    confidence: inContact ? confidence(evidence.geometryQuality) : 'LOW',
    distanceMm: evidence.distanceMm,
    contactToleranceMm,
    candidateToleranceMm,
    geometryMethod: evidence.geometryMethod,
    geometryQuality: evidence.geometryQuality,
    contactPointGlobal: evidence.contactPointGlobal,
    nearestPointOnSupportGlobal: evidence.nearestPointOnLeftGlobal,
    nearestPointOnSteelGlobal: evidence.nearestPointOnRightGlobal,
  };
}

function selectedStructuralRecords(steelGroup, structuralMemberId) {
  const records = (steelGroup?.records || []).filter((row) => row.analyticalGeometry?.geometryAvailable);
  const selected = normalize(structuralMemberId);
  if (!selected) return records;
  const exact = records.filter((row) => normalize(row.recordId) === selected);
  return exact.length ? exact : records;
}
function isAnalyticalContact(row) {
  return row.edgeType === 'SUPPORT_MEMBER_TO_STRUCTURE'
    && row.contactEvidenceStatus === 'ANALYTICAL_CONTACT_CANDIDATE';
}
function memberKey(familyId, memberId) { return `${normalize(familyId)}::${normalize(memberId)}`; }
function relationshipKey(steelGroupId, structuralMemberId) {
  return `${normalize(steelGroupId)}::${normalize(structuralMemberId)}`;
}
function groupBy(rows, keyFn) {
  const groups = new Map();
  rows.forEach((row) => {
    const key = keyFn(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });
  return groups;
}
function dedupe(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = row.edgeId || `${row.edgeType}:${row.supportMemberId}:${row.structuralMemberId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function confidence(quality) { return ({ HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW' })[quality] || 'LOW'; }
function nonNegative(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number) && number >= 0) return number;
  }
  return 0;
}
function normalize(value) { return String(value || '').trim().replace(/^\/+/, '/').toUpperCase(); }
