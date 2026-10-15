import { SUPPORT_PRIMARY_RELATIONSHIP_SCHEMA } from './support-primary-relationship.js';

export const SUPPORT_PRIMARY_RECONCILIATION_SCHEMA = 'SupportPrimaryReconciliation.v1';

const CONCRETE_MEMBER_RE = /^\/(?:PS|SL)-\d+[A-Z]?\.\d+$/iu;
const SYMBOLIC_MEMBER_RE = /\/(?:DATUM|STRUCTURAL_REFERENCE)$/iu;
const FAMILY_RE = /^\/?((?:PS|SL)-\d+[A-Z]?)(?=\.|\/|$)/iu;

export function reconcileSupportPrimaryAssemblies(input = {}) {
  const relationshipBundle = input.relationshipBundle || null;
  const locationGroups = Array.isArray(input.locationGroups) ? input.locationGroups : [];
  const index = buildAssemblyIndex(relationshipBundle);
  const assignments = locationGroups.map((group) => reconcileLocationGroup(group, index));
  const diagnostics = assignments.flatMap((assignment) => assignment.diagnostics);
  return Object.freeze({
    schema: SUPPORT_PRIMARY_RECONCILIATION_SCHEMA,
    relationshipSchema: relationshipBundle?.schema || '',
    relationshipEvidenceAvailable: relationshipBundle?.schema === SUPPORT_PRIMARY_RELATIONSHIP_SCHEMA,
    assignments: Object.freeze(assignments),
    familySummaries: Object.freeze(buildFamilySummaries(assignments)),
    diagnostics: Object.freeze(diagnostics),
    summary: Object.freeze({
      locationGroupCount: assignments.length,
      explicitAssemblyGroupCount: countStatus(assignments, 'EXPLICIT_ASSEMBLY'),
      geometryOnlyGroupCount: countStatus(assignments, 'GEOMETRY_ONLY'),
      partialExplicitGroupCount: countStatus(assignments, 'PARTIAL_EXPLICIT'),
      conflictGroupCount: countStatus(assignments, 'CONFLICT'),
      symbolicOnlyGroupCount: countStatus(assignments, 'SYMBOLIC_ONLY'),
    }),
  });
}

function buildAssemblyIndex(bundle) {
  const families = new Map();
  if (bundle?.schema !== SUPPORT_PRIMARY_RELATIONSHIP_SCHEMA) return families;
  for (const family of bundle?.families || []) {
    const familyId = normalizeFamilyId(family?.familyId);
    if (!familyId) continue;
    const memberToAssemblyIds = new Map();
    const assemblies = new Map();
    for (const assembly of family?.assemblies || []) {
      const assemblyId = clean(assembly?.assemblyId);
      if (!assemblyId) continue;
      assemblies.set(assemblyId, assembly);
      for (const memberId of assembly?.memberIds || []) {
        const member = canonicalMemberId(memberId);
        if (!member) continue;
        if (!memberToAssemblyIds.has(member)) memberToAssemblyIds.set(member, new Set());
        memberToAssemblyIds.get(member).add(assemblyId);
      }
    }
    families.set(familyId, Object.freeze({ familyId, assemblies, memberToAssemblyIds }));
  }
  return families;
}

function reconcileLocationGroup(group, index) {
  const familyId = normalizeFamilyId(group?.secondarySupportFamilyId);
  const observed = canonicalObservedMembers(group?.primarySupportMemberIds || []);
  const concreteMemberIds = observed.filter(isConcreteMember);
  const symbolicMemberIds = observed.filter(isSymbolicMember);
  const family = index.get(familyId) || null;
  const candidateMap = new Map(observed.map((memberId) => [
    memberId,
    family ? [...(family.memberToAssemblyIds.get(memberId) || [])].sort() : [],
  ]));
  const concreteCandidates = unique(concreteMemberIds.flatMap((memberId) => candidateMap.get(memberId) || [])).sort();
  const symbolicCandidates = unique(symbolicMemberIds.flatMap((memberId) => candidateMap.get(memberId) || [])).sort();
  const unmatchedConcreteMemberIds = concreteMemberIds.filter((memberId) => !(candidateMap.get(memberId) || []).length);
  const ambiguousConcreteMemberIds = concreteMemberIds.filter((memberId) => (candidateMap.get(memberId) || []).length > 1);
  const provisional = provisionalGeometryIdentity(group, familyId, concreteMemberIds);
  const decision = assignmentDecision({
    concreteMemberIds,
    concreteCandidates,
    unmatchedConcreteMemberIds,
    ambiguousConcreteMemberIds,
    provisional,
  });
  const diagnostics = assignmentDiagnostics({
    group,
    familyId,
    decision,
    concreteCandidates,
    unmatchedConcreteMemberIds,
    ambiguousConcreteMemberIds,
  });
  return Object.freeze({
    groupId: clean(group?.groupId),
    familyId,
    fullLineTag: clean(group?.fullLineTag),
    status: decision.status,
    countable: decision.countable,
    primarySupportAssemblyId: decision.primarySupportAssemblyId,
    provisionalAssemblyId: provisional.assemblyId,
    provisionalSignature: provisional.signature,
    candidateAssemblyIds: Object.freeze(concreteCandidates),
    symbolicCandidateAssemblyIds: Object.freeze(symbolicCandidates),
    observedConcreteMemberIds: Object.freeze(concreteMemberIds),
    observedSymbolicMemberIds: Object.freeze(symbolicMemberIds),
    unmatchedConcreteMemberIds: Object.freeze(unmatchedConcreteMemberIds),
    ambiguousConcreteMemberIds: Object.freeze(ambiguousConcreteMemberIds),
    memberAssemblyCandidates: Object.freeze(Object.fromEntries(
      [...candidateMap.entries()].map(([memberId, ids]) => [memberId, Object.freeze([...ids])]),
    )),
    assignmentBasis: decision.assignmentBasis,
    diagnostics: Object.freeze(diagnostics),
  });
}

function assignmentDecision(input) {
  const {
    concreteMemberIds,
    concreteCandidates,
    unmatchedConcreteMemberIds,
    ambiguousConcreteMemberIds,
    provisional,
  } = input;
  if (!concreteMemberIds.length) return decision('SYMBOLIC_ONLY', false, '', 'NON_COUNTABLE_SYMBOLIC_EVIDENCE');
  if (ambiguousConcreteMemberIds.length || concreteCandidates.length > 1) {
    return decision('CONFLICT', false, '', 'EXPLICIT_ASSEMBLY_CONFLICT');
  }
  if (concreteCandidates.length === 1 && !unmatchedConcreteMemberIds.length) {
    return decision('EXPLICIT_ASSEMBLY', true, concreteCandidates[0], 'EXPLICIT_MEMBER_TO_ASSEMBLY');
  }
  if (concreteCandidates.length === 1) {
    return decision('PARTIAL_EXPLICIT', false, '', 'PARTIAL_EXPLICIT_MEMBERSHIP');
  }
  return decision('GEOMETRY_ONLY', true, provisional.assemblyId, 'PROVISIONAL_GEOMETRY_GROUP');
}

function decision(status, countable, primarySupportAssemblyId, assignmentBasis) {
  return Object.freeze({ status, countable, primarySupportAssemblyId, assignmentBasis });
}

function assignmentDiagnostics(input) {
  const diagnostics = [];
  const groupId = clean(input.group?.groupId);
  if (input.decision.status === 'CONFLICT') diagnostics.push(Object.freeze({
    severity: 'WARNING',
    code: 'PRIMARY_ASSEMBLY_RECONCILIATION_CONFLICT',
    groupId,
    familyId: input.familyId,
    candidateAssemblyIds: Object.freeze([...input.concreteCandidates]),
    ambiguousConcreteMemberIds: Object.freeze([...input.ambiguousConcreteMemberIds]),
    message: 'Location evidence spans more than one explicit primary-support assembly; no assembly was selected.',
  }));
  if (input.decision.status === 'PARTIAL_EXPLICIT') diagnostics.push(Object.freeze({
    severity: 'WARNING',
    code: 'PRIMARY_ASSEMBLY_PARTIAL_EXPLICIT_MEMBERSHIP',
    groupId,
    familyId: input.familyId,
    candidateAssemblyIds: Object.freeze([...input.concreteCandidates]),
    unmatchedConcreteMemberIds: Object.freeze([...input.unmatchedConcreteMemberIds]),
    message: 'Only part of the location evidence maps to an explicit primary-support assembly; automatic assignment is withheld.',
  }));
  return diagnostics;
}

function buildFamilySummaries(assignments) {
  const byFamily = new Map();
  for (const assignment of assignments) {
    const key = assignment.familyId || 'UNRESOLVED';
    if (!byFamily.has(key)) byFamily.set(key, []);
    byFamily.get(key).push(assignment);
  }
  return [...byFamily.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([familyId, rows]) => Object.freeze({
    familyId,
    locationGroupCount: rows.length,
    explicitAssemblyGroupCount: countStatus(rows, 'EXPLICIT_ASSEMBLY'),
    geometryOnlyGroupCount: countStatus(rows, 'GEOMETRY_ONLY'),
    partialExplicitGroupCount: countStatus(rows, 'PARTIAL_EXPLICIT'),
    conflictGroupCount: countStatus(rows, 'CONFLICT'),
    symbolicOnlyGroupCount: countStatus(rows, 'SYMBOLIC_ONLY'),
    distinctResolvedAssignmentIds: Object.freeze(unique(
      rows.filter((row) => row.countable).map((row) => row.primarySupportAssemblyId),
    ).sort()),
  }));
}

function provisionalGeometryIdentity(group, familyId, concreteMemberIds) {
  const branchNodes = unique((group?.branchNodes || []).map(clean)).sort();
  const point = validPoint(group?.representativeClashPointGlobalMm)
    ? pointToken(group.representativeClashPointGlobalMm)
    : 'NO_POINT';
  const signature = [
    familyId || 'UNRESOLVED',
    clean(group?.fullLineTag).toUpperCase() || 'NO_LINE',
    branchNodes.join('+') || 'NO_BRANCH',
    concreteMemberIds.join('+') || 'NO_CONCRETE_MEMBER',
    point,
  ].join('|');
  return Object.freeze({
    signature,
    assemblyId: `PSA::${familyId || 'UNRESOLVED'}::G-${fnv1a(signature)}`,
  });
}

function canonicalObservedMembers(values) {
  return unique((values || []).map(canonicalMemberId).filter(Boolean)).sort(memberCompare);
}
function canonicalMemberId(value) {
  const text = clean(value).replace(/^\/+/, '').replace(/\(REF\)$/iu, '').toUpperCase();
  return normalizeFamilyId(text) ? `/${text}` : '';
}
function normalizeFamilyId(value) {
  const text = clean(value).replace(/^\/+/, '').replace(/\(REF\)$/iu, '').toUpperCase();
  return FAMILY_RE.exec(text)?.[1]?.toUpperCase() || '';
}
function isConcreteMember(value) { return CONCRETE_MEMBER_RE.test(value); }
function isSymbolicMember(value) { return SYMBOLIC_MEMBER_RE.test(value); }
function pointToken(point) { return [point.x, point.y, point.z].map((value) => Number(value).toString()).join(','); }
function validPoint(point) { return Boolean(point && [point.x, point.y, point.z].every(Number.isFinite)); }
function countStatus(rows, status) { return rows.filter((row) => row.status === status).length; }
function memberCompare(left, right) {
  const a = Number(String(left || '').match(/\.(\d+)$/u)?.[1]);
  const b = Number(String(right || '').match(/\.(\d+)$/u)?.[1]);
  if (Number.isFinite(a) && Number.isFinite(b) && a !== b) return a - b;
  return String(left || '').localeCompare(String(right || ''));
}
function fnv1a(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
}
function clean(value) { return value == null ? '' : String(value).trim(); }
function unique(values) { return [...new Set((values || []).filter(Boolean))]; }

export const _test = Object.freeze({
  assignmentDecision,
  buildAssemblyIndex,
  canonicalMemberId,
  provisionalGeometryIdentity,
});
