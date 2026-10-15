export const SUPPORT_PRIMARY_RELATIONSHIP_SCHEMA = 'SupportPrimaryRelationshipBundle.v1';
export const SUPPORT_PRIMARY_RELATIONSHIP_PROFILE = 'SUPPORT_PRIMARY_REL_V1';

const CONCRETE_MEMBER_RE = /^\/(?:PS|SL)-\d+[A-Z]?\.\d+$/iu;
const SYMBOLIC_MEMBER_RE = /\/(?:DATUM|STRUCTURAL_REFERENCE)$/iu;
const FAMILY_RE = /^\/?((?:PS|SL)-\d+[A-Z]?)(?=\.|\/|$)/iu;

export function buildSupportPrimaryRelationshipBundle(input = {}) {
  const diagnostics = [];
  const edges = normalizeRelationshipEdges(input.relationshipRows || [], diagnostics);
  const familyIds = unique(edges.map((edge) => edge.familyId)).sort();
  const families = familyIds.map((familyId) => buildFamily(familyId, edges, diagnostics));
  const assemblies = families.flatMap((family) => family.assemblies);
  const zoneScope = freezeZoneScope(input.zoneScope);
  return Object.freeze({
    schema: SUPPORT_PRIMARY_RELATIONSHIP_SCHEMA,
    profileId: SUPPORT_PRIMARY_RELATIONSHIP_PROFILE,
    evidenceMode: edges.length ? 'EXPLICIT_SUPPORT_RELATIONSHIP' : 'UNAVAILABLE',
    zoneScope,
    families: Object.freeze(families),
    assemblies: Object.freeze(assemblies),
    diagnostics: Object.freeze(diagnostics),
    summary: Object.freeze({
      familyCount: families.length,
      explicitEdgeCount: edges.length,
      assemblyCount: assemblies.length,
      countableAssemblyCount: assemblies.filter((item) => item.countable).length,
      symbolicOnlyAssemblyCount: assemblies.filter((item) => !item.countable).length,
      diagnosticCount: diagnostics.length,
    }),
  });
}

function normalizeRelationshipEdges(rows, diagnostics) {
  const edges = [];
  const seen = new Set();
  for (const [index, row] of rows.entries()) {
    if (row?.edgeType && row.edgeType !== 'SupportChain') continue;
    const supportA = canonicalMemberId(row?.supportA);
    const supportB = canonicalMemberId(row?.supportB);
    if (!supportA || !supportB || supportA === supportB) {
      diagnostics.push(diagnostic('INVALID_SUPPORT_MEMBER_EDGE', row, { supportA, supportB }));
      continue;
    }
    const roots = relationshipFamilyRoots(row, supportA, supportB);
    if (roots.length !== 1) {
      diagnostics.push(diagnostic('SUPPORT_MEMBER_EDGE_FAMILY_CONFLICT', row, { supportA, supportB, familyIds: roots }));
      continue;
    }
    const pair = [supportA, supportB].sort(memberCompare);
    const edgeKey = `${roots[0]}::${pair.join('::')}`;
    if (seen.has(edgeKey)) continue;
    seen.add(edgeKey);
    edges.push(Object.freeze({
      edgeId: relationshipEvidenceId(row, index, pair),
      familyId: roots[0],
      supportA: pair[0],
      supportB: pair[1],
      relationshipBasis: Object.freeze(unique(row?.relationshipBasis?.length
        ? row.relationshipBasis : ['EXPLICIT_SUPPORT_CLASH'])),
      evidenceSource: row?.sourceInput || 'Clash within Supports',
      clashName: row?.clashName || '',
      point: validPoint(row?.point) ? Object.freeze({ ...row.point }) : null,
      pipeContextStatus: row?.pipeContextStatus || (row?.fullLineTag ? 'RESOLVED' : 'UNAVAILABLE'),
      fullLineTag: clean(row?.fullLineTag),
      branchNode: clean(row?.branchNode),
      sourcePaths: Object.freeze(sourcePaths(row)),
    }));
  }
  return edges.sort(edgeCompare);
}

function buildFamily(familyId, allEdges, diagnostics) {
  const edges = allEdges.filter((edge) => edge.familyId === familyId);
  const nodes = unique(edges.flatMap((edge) => [edge.supportA, edge.supportB])).sort(memberCompare);
  const components = connectedComponents(nodes, edges).map((members) => buildAssembly(familyId, members, edges, diagnostics));
  const sorted = components.sort((left, right) => left.assemblyId.localeCompare(right.assemblyId));
  let primaryOrdinal = 0;
  let referenceOrdinal = 0;
  const assemblies = sorted.map((assembly) => {
    const ordinal = assembly.countable ? ++primaryOrdinal : ++referenceOrdinal;
    const kind = assembly.countable ? 'PRIMARY' : 'REFERENCE';
    return Object.freeze({ ...assembly, displayId: `${familyId} / ${kind}-${String(ordinal).padStart(2, '0')}` });
  });
  return Object.freeze({
    familyId,
    primarySupportAssemblyCount: assemblies.filter((item) => item.countable).length,
    assemblies: Object.freeze(assemblies),
    explicitEdgeCount: edges.length,
  });
}

function buildAssembly(familyId, members, familyEdges, diagnostics) {
  const memberSet = new Set(members);
  const edges = familyEdges.filter((edge) => memberSet.has(edge.supportA) && memberSet.has(edge.supportB));
  const concreteMemberIds = members.filter(isConcreteMember).sort(memberCompare);
  const symbolicMemberIds = members.filter(isSymbolicMember).sort(memberCompare);
  const unclassifiedMemberIds = members.filter((id) => !isConcreteMember(id) && !isSymbolicMember(id)).sort(memberCompare);
  if (unclassifiedMemberIds.length) diagnostics.push(Object.freeze({
    severity: 'INFO',
    code: 'PRIMARY_ASSEMBLY_UNCLASSIFIED_MEMBERS',
    familyId,
    memberIds: Object.freeze(unclassifiedMemberIds),
    message: 'Assembly contains non-numeric, non-symbolic family members; they are retained but do not make the assembly countable.',
  }));
  const countable = concreteMemberIds.length > 0;
  return Object.freeze({
    assemblyId: assemblyId(familyId, concreteMemberIds, symbolicMemberIds, unclassifiedMemberIds),
    displayId: '',
    familyId,
    countable,
    memberIds: Object.freeze([...members].sort(memberCompare)),
    concreteMemberIds: Object.freeze(concreteMemberIds),
    symbolicMemberIds: Object.freeze(symbolicMemberIds),
    unclassifiedMemberIds: Object.freeze(unclassifiedMemberIds),
    concreteMemberCount: concreteMemberIds.length,
    relationshipEdgeIds: Object.freeze(edges.map((edge) => edge.edgeId).sort()),
    relationshipBasis: Object.freeze(unique(edges.flatMap((edge) => edge.relationshipBasis)).sort()),
    pipeMemberships: Object.freeze(unique(edges.map((edge) => edge.fullLineTag)).sort()),
    branchNodes: Object.freeze(unique(edges.map((edge) => edge.branchNode)).sort()),
    evidenceIds: Object.freeze(edges.map((edge) => edge.edgeId).sort()),
    confidence: edges.length ? 'HIGH' : 'UNAVAILABLE',
  });
}

function connectedComponents(nodes, edges) {
  const parent = new Map(nodes.map((node) => [node, node]));
  const find = (node) => {
    let current = node;
    while (parent.get(current) !== current) {
      parent.set(current, parent.get(parent.get(current)));
      current = parent.get(current);
    }
    return current;
  };
  for (const edge of edges) union(parent, find, edge.supportA, edge.supportB);
  const groups = new Map();
  for (const node of nodes) {
    const root = find(node);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(node);
  }
  return [...groups.values()].map((members) => members.sort(memberCompare));
}

function union(parent, find, left, right) {
  if (!parent.has(left) || !parent.has(right)) return;
  const leftRoot = find(left);
  const rightRoot = find(right);
  if (leftRoot === rightRoot) return;
  const [keep, merge] = [leftRoot, rightRoot].sort(memberCompare);
  parent.set(merge, keep);
}

function relationshipFamilyRoots(row, supportA, supportB) {
  return unique([
    familyIdFromMember(supportA),
    familyIdFromMember(supportB),
    normalizeFamilyId(row?.psRoot),
    ...(row?.supportRoots || []).map(normalizeFamilyId),
  ]).sort();
}

function familyIdFromMember(memberId) {
  return normalizeFamilyId(FAMILY_RE.exec(memberId)?.[1]);
}

function normalizeFamilyId(value) {
  const text = clean(value).replace(/^\/+/, '').replace(/\(REF\)$/iu, '').toUpperCase();
  return FAMILY_RE.exec(text)?.[1]?.toUpperCase() || '';
}

function canonicalMemberId(value) {
  const text = clean(value).replace(/^\/+/, '').replace(/\(REF\)$/iu, '').toUpperCase();
  return familyIdFromMember(`/${text}`) ? `/${text}` : '';
}

function isConcreteMember(value) { return CONCRETE_MEMBER_RE.test(value); }
function isSymbolicMember(value) { return SYMBOLIC_MEMBER_RE.test(value); }

function assemblyId(familyId, concreteIds, symbolicIds, unclassifiedIds) {
  if (concreteIds.length) return `PSA::${familyId}::M-${concreteIds.map(memberSuffix).join('+')}`;
  const symbolic = symbolicIds.map(referenceToken);
  const unresolved = unclassifiedIds.map(referenceToken);
  return `PSA::${familyId}::R-${[...symbolic, ...unresolved].join('+') || 'UNRESOLVED'}`;
}

function memberSuffix(memberId) {
  return String(Number(memberId.match(/\.(\d+)$/u)?.[1] || 0));
}

function referenceToken(memberId) {
  return memberId.replace(/^\//u, '').replace(/[^A-Z0-9]+/giu, '-').replace(/^-|-$/gu, '');
}

function relationshipEvidenceId(row, index, pair) {
  if (clean(row?.relationshipEvidenceId)) return clean(row.relationshipEvidenceId);
  const source = clean(row?.sourceInput) || 'SUPPORT_RELATIONSHIP';
  const clash = clean(row?.clashName) || `ROW-${index + 1}`;
  return `${source}:${clash}:${pair.join('::')}`;
}

function sourcePaths(row) {
  const paths = [row?.objectA?.path, row?.objectB?.path].filter((path) => Array.isArray(path) && path.length);
  return paths.map((path) => Object.freeze([...path]));
}

function freezeZoneScope(scope) {
  if (!scope || typeof scope !== 'object') return null;
  return Object.freeze({
    schema: clean(scope.schema),
    active: Boolean(scope.active),
    primaryZoneIds: Object.freeze([...(scope.primaryZoneIds || [])]),
    secondaryZoneIds: Object.freeze([...(scope.secondaryZoneIds || [])]),
  });
}

function diagnostic(code, row, details = {}) {
  return Object.freeze({
    severity: 'WARNING',
    code,
    clashName: row?.clashName || '',
    ...details,
    message: code === 'SUPPORT_MEMBER_EDGE_FAMILY_CONFLICT'
      ? 'Support-member relationship crosses or ambiguously identifies PS/SL families and was excluded.'
      : 'Support-member relationship is missing two distinct usable member identities and was excluded.',
  });
}

function memberCompare(left, right) {
  const leftNumber = Number(String(left || '').match(/\.(\d+)$/u)?.[1]);
  const rightNumber = Number(String(right || '').match(/\.(\d+)$/u)?.[1]);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) return leftNumber - rightNumber;
  return String(left || '').localeCompare(String(right || ''));
}
function edgeCompare(left, right) { return left.edgeId.localeCompare(right.edgeId); }
function validPoint(point) { return Boolean(point && [point.x, point.y, point.z].every(Number.isFinite)); }
function clean(value) { return value == null ? '' : String(value).trim(); }
function unique(values) { return [...new Set((values || []).filter(Boolean))]; }

export const _test = Object.freeze({
  assemblyId,
  canonicalMemberId,
  connectedComponents,
  familyIdFromMember,
  isConcreteMember,
  isSymbolicMember,
  normalizeRelationshipEdges,
});
