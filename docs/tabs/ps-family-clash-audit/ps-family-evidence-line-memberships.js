import { createEvidenceSupportGroup } from './ps-family-evidence-graph-shared.js';

export const PS_FAMILY_LINE_MEMBERSHIP_SCHEMA = 'PsFamilyLineMembership.v1';

export function deriveEvidenceFamilyLineMemberships(family, fallbackContext = {}) {
  const groups = new Map();
  for (const member of family?.members || []) {
    const context = normalizeContext(member.lineContext, fallbackContext);
    const key = membershipKey(context);
    if (!groups.has(key)) groups.set(key, createMembership(family.familyId, context));
    const membership = groups.get(key);
    if (member.memberId) membership.memberIds.add(member.memberId);
    if (context.carrierId) membership.carrierIds.add(context.carrierId);
    for (const value of context.contextEvidence || []) membership.contextEvidence.add(value);
    membership.ownerFallbackUsed ||= Boolean(context.ownerFallbackUsed);
    membership.contextQuality = strongerQuality(membership.contextQuality, context.contextQuality);
  }
  if (!groups.size) {
    const context = normalizeContext(family?.lineContext, fallbackContext);
    groups.set(membershipKey(context), createMembership(family?.familyId, context));
  }
  const memberships = [...groups.values()].map(finalizeMembership);
  markPrimaryMembership(memberships, fallbackContext);
  return memberships.sort(compareMemberships);
}

export function createMemberLineMembershipIndex(memberships = []) {
  const index = new Map();
  for (const membership of memberships) {
    for (const memberId of membership.memberIds || []) index.set(memberId, membership);
  }
  return index;
}

export function resolveMemberLineMembership(index, memberId, primaryMembership = null) {
  return index?.get(memberId) || primaryMembership || null;
}

export function resolveEdgeLineProjection(edge, index, primaryMembership = null) {
  const fromMemberId = edge?.supportA || edge?.fromMemberId || edge?.supportMemberId || '';
  const toMemberId = edge?.supportB || edge?.toMemberId || '';
  const fromMembership = resolveMemberLineMembership(index, fromMemberId, primaryMembership);
  const toMembership = toMemberId
    ? resolveMemberLineMembership(index, toMemberId, primaryMembership)
    : fromMembership;
  const memberships = uniqueMemberships([fromMembership, toMembership]);
  const crossLine = memberships.length > 1;
  const selected = crossLine ? primaryMembership || fromMembership || toMembership : memberships[0] || primaryMembership;
  return {
    membership: selected || null,
    memberships,
    crossLine,
    fromMemberId,
    toMemberId,
    fromMembershipId: fromMembership?.membershipId || '',
    toMembershipId: toMembership?.membershipId || '',
    fromLineFamily: fromMembership?.lineFamily || '',
    toLineFamily: toMembership?.lineFamily || '',
    lineMembershipIds: memberships.map((row) => row.membershipId),
  };
}

export function lineProjectionFields(projection) {
  const membership = projection?.membership || projection || {};
  return {
    lineMembershipId: membership.membershipId || '',
    lineMembershipIds: projection?.lineMembershipIds || [membership.membershipId].filter(Boolean),
    line: projection?.crossLine ? 'MULTI_LINE' : membership.fullLineTag || '',
    fullLineTag: projection?.crossLine ? 'MULTI_LINE' : membership.fullLineTag || '',
    lineFamily: projection?.crossLine ? 'MULTI_LINE' : membership.lineFamily || '',
    branchNode: projection?.crossLine ? '' : membership.branchNode || '',
    carrierIds: membership.carrierIds || [],
    crossLine: Boolean(projection?.crossLine),
    fromMembershipId: projection?.fromMembershipId || '',
    toMembershipId: projection?.toMembershipId || '',
    fromLineFamily: projection?.fromLineFamily || '',
    toLineFamily: projection?.toLineFamily || '',
  };
}

function normalizeContext(source = {}, fallback = {}) {
  const branchNode = text(source?.branchNode || fallback?.branchNode);
  const fullLineTag = text(source?.fullLineTag || fallback?.fullLineTag || deriveLineTag(branchNode));
  const lineFamily = text(source?.lineFamily || fallback?.lineFamily || fullLineTag);
  return {
    branchNode,
    fullLineTag,
    lineFamily,
    carrierId: text(source?.carrierId),
    contextQuality: text(source?.contextQuality || fallback?.contextQuality || 'NONE').toUpperCase(),
    contextEvidence: unique([...(source?.contextEvidence || []), ...(fallback?.contextEvidence || [])]),
    ownerFallbackUsed: Boolean(source?.ownerFallbackUsed ?? fallback?.ownerFallbackUsed),
  };
}

function createMembership(familyId, context) {
  const membershipId = [familyId || 'UNKNOWN_FAMILY', context.lineFamily || 'NO_LINE', context.branchNode || 'NO_BRANCH']
    .map(token)
    .join('::');
  return {
    schema: PS_FAMILY_LINE_MEMBERSHIP_SCHEMA,
    membershipId,
    supportFamilyId: familyId || '',
    supportGroup: createEvidenceSupportGroup(context.lineFamily || context.fullLineTag, familyId),
    branchNode: context.branchNode,
    fullLineTag: context.fullLineTag,
    lineFamily: context.lineFamily,
    memberIds: new Set(),
    carrierIds: new Set(),
    contextQuality: context.contextQuality,
    contextEvidence: new Set(context.contextEvidence),
    ownerFallbackUsed: context.ownerFallbackUsed,
    isPrimary: false,
  };
}

function finalizeMembership(row) {
  return {
    ...row,
    memberIds: [...row.memberIds].sort(),
    carrierIds: [...row.carrierIds].sort(),
    contextEvidence: [...row.contextEvidence].sort(),
  };
}

function markPrimaryMembership(memberships, context) {
  const exact = memberships.find((row) => (
    (!context?.branchNode || row.branchNode === context.branchNode)
    && (!context?.lineFamily || row.lineFamily === context.lineFamily)
  ));
  const primary = exact || [...memberships].sort(compareMemberships)[0];
  if (primary) primary.isPrimary = true;
}

function compareMemberships(left, right) {
  if (left.isPrimary !== right.isPrimary) return left.isPrimary ? -1 : 1;
  const quality = qualityRank(left.contextQuality) - qualityRank(right.contextQuality);
  if (quality) return quality;
  return `${left.lineFamily}|${left.branchNode}`.localeCompare(`${right.lineFamily}|${right.branchNode}`);
}

function strongerQuality(left, right) {
  return qualityRank(left) <= qualityRank(right) ? left : right;
}

function qualityRank(value) {
  return ({ HIGH: 0, MEDIUM: 1, LOW: 2, NONE: 3 })[text(value).toUpperCase()] ?? 4;
}

function membershipKey(context) {
  return `${context.lineFamily}|${context.fullLineTag}|${context.branchNode}`;
}

function uniqueMemberships(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    if (!row || seen.has(row.membershipId)) return false;
    seen.add(row.membershipId);
    return true;
  });
}

function deriveLineTag(branchNode) {
  return text(branchNode).replace(/^\//u, '').replace(/\/B(?:RANCH)?[-_A-Z0-9.]*$/iu, '');
}

function token(value) {
  return text(value).replace(/^\//u, '').replace(/[\s/]+/gu, '_') || 'UNKNOWN';
}

function text(value) {
  return String(value ?? '').trim();
}

function unique(values) {
  return [...new Set(values.map(text).filter(Boolean))].sort();
}
