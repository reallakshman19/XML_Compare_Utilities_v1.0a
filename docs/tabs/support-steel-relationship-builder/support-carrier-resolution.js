import {
  SUPPORT_CARRIER_CATALOG_SCHEMA,
  carrierReference,
  collectSupportCarrierCatalog,
  normalizeCarrierId,
} from './support-carrier-catalog.js';
import { cleanText, cloneJson, parseSupportSteelJson } from './support-steel-source-utils.js';

export const SUPPORT_CARRIER_RESOLUTION_SCHEMA = 'SupportCarrierResolution.v1';

const EXEMPT_ROLES = new Set(['STRUCTURAL_REFERENCE']);
const RESOLVED_STATUSES = new Set([
  'RESOLVED_EXPLICIT_CARRIER',
  'RESOLVED_HIERARCHY_CARRIER',
  'RESOLVED_UNIQUE_BRANCH_CARRIER',
]);

export function buildSupportCarrierResolutionBundle(input = {}) {
  const source = parseSupportSteelJson(input.supportInput, 'Support source');
  const catalog = collectSupportCarrierCatalog(source);
  const resolution = resolveSupportFamilyCarriers(input.supportFamilies || [], catalog);
  return {
    schema: SUPPORT_CARRIER_RESOLUTION_SCHEMA,
    catalogSchema: SUPPORT_CARRIER_CATALOG_SCHEMA,
    relationshipSemantic: 'SUPPORT_MEMBER_TO_AUTHORITATIVE_CARRIER_OBJECT',
    contactEvidenceAvailable: false,
    carrierObjects: catalog.carrierObjects,
    branchContexts: catalog.branchContexts,
    resolutions: resolution.resolutions,
    supportCarrierEdges: resolution.supportCarrierEdges,
    branchContextEdges: resolution.branchContextEdges,
    supportFamilies: resolution.supportFamilies,
    summary: buildSummary(catalog, resolution),
    diagnostics: resolution.diagnostics,
  };
}

export function resolveSupportFamilyCarriers(supportFamilies, catalog) {
  const carrierIndex = indexRows(catalog.carrierObjects, 'carrierObjectId');
  const branchIndex = indexRows(catalog.branchContexts, 'branchContextId');
  const carriersByBranch = groupByBranch(catalog.carrierObjects);
  const resolutions = [];
  const supportCarrierEdges = [];
  const branchContextEdges = [];
  const diagnostics = [];
  const supportFamiliesOut = (supportFamilies || []).map((family) => {
    const members = (family.members || []).map((member) => {
      const result = resolveMemberCarrier(member, carrierIndex, branchIndex, carriersByBranch);
      resolutions.push(result);
      if (RESOLVED_STATUSES.has(result.resolutionStatus)) {
        supportCarrierEdges.push(physicalCarrierEdge(result));
      } else if (result.resolutionStatus === 'BRANCH_CONTEXT_ONLY') {
        branchContextEdges.push(branchContextEdge(result));
      }
      diagnostics.push(...resolutionDiagnostics(result));
      return { ...cloneJson(member), carrierResolution: result };
    });
    const familyRows = members.map((member) => member.carrierResolution);
    return {
      ...cloneJson(family),
      members,
      carrierObjectIds: unique(familyRows.map((row) => row.carrierObjectId)),
      carrierResolutionStatuses: unique(familyRows.map((row) => row.resolutionStatus)),
      resolvedPhysicalCarrierCount: familyRows.filter((row) => row.physicalCarrierObjectAvailable).length,
      branchContextOnlyMemberCount: familyRows.filter((row) => row.resolutionStatus === 'BRANCH_CONTEXT_ONLY').length,
      unresolvedCarrierMemberCount: familyRows.filter((row) => row.resolutionStatus.startsWith('UNRESOLVED_')).length,
    };
  });
  return {
    supportFamilies: supportFamiliesOut,
    resolutions,
    supportCarrierEdges,
    branchContextEdges,
    diagnostics,
  };
}

function resolveMemberCarrier(member, carrierIndex, branchIndex, carriersByBranch) {
  const explicitReference = carrierReference(member.attributes || {});
  const hierarchyReference = normalizeCarrierId(member.lineContext?.carrierId);
  const branchNode = normalizeCarrierId(
    member.lineContext?.branchNode || member.sourceParentBranch,
  );
  const base = baseResolution(member, branchNode, explicitReference, hierarchyReference);
  if (EXEMPT_ROLES.has(base.supportMemberRole) && !explicitReference && !hierarchyReference) {
    return resolvedRecord(base, 'NOT_APPLICABLE_SYMBOLIC_MEMBER', 'NONE', []);
  }
  if (explicitReference) {
    const matches = carrierIndex.get(token(explicitReference)) || [];
    if (matches.length === 1) {
      return resolvedCarrier(base, matches[0], 'RESOLVED_EXPLICIT_CARRIER', 'HIGH', [
        'EXPLICIT_CARRIER_REFERENCE',
      ]);
    }
    if (matches.length > 1) return ambiguousCarrier(base, matches, 'EXPLICIT_CARRIER_REFERENCE');
    return resolvedRecord(base, 'UNRESOLVED_CARRIER_REFERENCE', 'NONE', [
      'EXPLICIT_CARRIER_REFERENCE_NOT_FOUND',
    ]);
  }
  if (hierarchyReference) {
    const matches = carrierIndex.get(token(hierarchyReference)) || [];
    if (matches.length === 1) {
      return resolvedCarrier(base, matches[0], 'RESOLVED_HIERARCHY_CARRIER', 'HIGH', [
        'TYPED_CARRIER_ANCESTOR',
      ]);
    }
    if (matches.length > 1) return ambiguousCarrier(base, matches, 'TYPED_CARRIER_ANCESTOR');
  }
  const branchMatches = carriersByBranch.get(token(branchNode)) || [];
  if (branchMatches.length === 1) {
    return resolvedCarrier(
      base,
      branchMatches[0],
      'RESOLVED_UNIQUE_BRANCH_CARRIER',
      'MEDIUM',
      ['UNIQUE_PHYSICAL_CARRIER_IN_BRANCH'],
    );
  }
  if (branchMatches.length > 1) {
    return ambiguousCarrier(base, branchMatches, 'MULTIPLE_PHYSICAL_CARRIERS_IN_BRANCH');
  }
  const branchContext = (branchIndex.get(token(branchNode)) || [])[0];
  if (branchContext) {
    return {
      ...resolvedRecord(base, 'BRANCH_CONTEXT_ONLY', 'LOW', [
        'TYPED_BRANCH_CONTEXT_OBJECT',
      ]),
      branchContextId: branchContext.branchContextId,
      relationshipCardinality: 'ONE_BRANCH_CONTEXT',
    };
  }
  return resolvedRecord(base, 'UNRESOLVED_NO_CARRIER', 'NONE', [
    'NO_AUTHORITATIVE_CARRIER_OBJECT',
  ]);
}

function baseResolution(member, branchNode, explicitReference, hierarchyReference) {
  return {
    schema: SUPPORT_CARRIER_RESOLUTION_SCHEMA,
    evidenceId: `SSCR:${member.memberId || 'UNKNOWN_MEMBER'}`,
    supportFamilyId: supportFamilyRoot(member.memberId),
    supportMemberId: member.memberId || null,
    supportMemberRole: member.semanticRole || 'OTHER_FAMILY_MEMBER',
    branchNode: branchNode || null,
    explicitCarrierReference: explicitReference || null,
    hierarchyCarrierReference: hierarchyReference || null,
    carrierObjectId: null,
    branchContextId: null,
    physicalCarrierObjectAvailable: false,
    contactEvidenceStatus: 'NOT_PROVEN',
    relationshipCardinality: 'UNRESOLVED',
  };
}

function resolvedCarrier(base, carrier, status, confidence, basis) {
  return {
    ...resolvedRecord(base, status, confidence, basis),
    carrierObjectId: carrier.carrierObjectId,
    carrierObjectClass: carrier.carrierObjectClass,
    carrierSourceRecordType: carrier.sourceRecordType,
    physicalCarrierObjectAvailable: true,
    relationshipCardinality: 'ONE_TO_ONE',
  };
}

function ambiguousCarrier(base, carriers, basis) {
  return {
    ...resolvedRecord(base, 'AMBIGUOUS_CARRIER_OBJECT', 'NONE', [basis]),
    candidateCarrierObjectIds: unique(carriers.map((row) => row.carrierObjectId)),
    relationshipCardinality: 'ONE_TO_MANY_AMBIGUOUS',
  };
}

function resolvedRecord(base, resolutionStatus, confidence, relationshipBasis) {
  return {
    ...base,
    resolutionStatus,
    confidence,
    relationshipBasis,
    candidateCarrierObjectIds: [],
  };
}

function physicalCarrierEdge(row) {
  return {
    edgeId: `SSCR-EDGE:${row.supportMemberId}::${row.carrierObjectId}`,
    edgeType: 'SUPPORT_MEMBER_TO_CARRIER',
    supportFamilyId: row.supportFamilyId,
    supportMemberId: row.supportMemberId,
    carrierObjectId: row.carrierObjectId,
    relationshipStatus: row.resolutionStatus,
    relationshipBasis: row.relationshipBasis,
    confidence: row.confidence,
    evidenceId: row.evidenceId,
    evidenceClass: 'AUTHORITATIVE_CONTEXT',
    contactEvidenceStatus: 'NOT_PROVEN',
  };
}

function branchContextEdge(row) {
  return {
    edgeId: `SSCR-BRANCH:${row.supportMemberId}::${row.branchContextId}`,
    edgeType: 'SUPPORT_MEMBER_TO_BRANCH_CONTEXT',
    supportFamilyId: row.supportFamilyId,
    supportMemberId: row.supportMemberId,
    branchContextId: row.branchContextId,
    relationshipStatus: row.resolutionStatus,
    relationshipBasis: row.relationshipBasis,
    confidence: row.confidence,
    evidenceId: row.evidenceId,
    evidenceClass: 'CONTEXT_ONLY',
    contactEvidenceStatus: 'NOT_PROVEN',
  };
}

function resolutionDiagnostics(row) {
  if (row.resolutionStatus === 'UNRESOLVED_CARRIER_REFERENCE') {
    return [diagnostic(row, 'WARN', 'CARRIER_REFERENCE_NOT_FOUND',
      'The explicit carrier reference does not match an authoritative carrier object.')];
  }
  if (row.resolutionStatus === 'AMBIGUOUS_CARRIER_OBJECT') {
    return [diagnostic(row, 'WARN', 'AMBIGUOUS_CARRIER_OBJECT',
      'More than one authoritative carrier object satisfies the available context.')];
  }
  if (row.resolutionStatus === 'BRANCH_CONTEXT_ONLY') {
    return [diagnostic(row, 'INFO', 'BRANCH_CONTEXT_WITHOUT_PHYSICAL_CARRIER',
      'A branch context is known, but no physical carrier object is available.')];
  }
  if (row.resolutionStatus === 'UNRESOLVED_NO_CARRIER') {
    return [diagnostic(row, 'INFO', 'NO_AUTHORITATIVE_CARRIER_OBJECT',
      'No physical carrier object or branch context could be resolved.')];
  }
  return [];
}

function diagnostic(row, severity, code, message) {
  return {
    severity,
    code,
    supportFamilyId: row.supportFamilyId,
    supportMemberId: row.supportMemberId,
    message,
  };
}

function buildSummary(catalog, resolution) {
  const rows = resolution.resolutions;
  return {
    carrierObjectCount: catalog.carrierObjects.length,
    branchContextCount: catalog.branchContexts.length,
    supportMemberResolutionCount: rows.length,
    resolvedPhysicalCarrierCount: rows.filter((row) => row.physicalCarrierObjectAvailable).length,
    explicitCarrierResolutionCount: countStatus(rows, 'RESOLVED_EXPLICIT_CARRIER'),
    hierarchyCarrierResolutionCount: countStatus(rows, 'RESOLVED_HIERARCHY_CARRIER'),
    branchUniqueCarrierResolutionCount: countStatus(rows, 'RESOLVED_UNIQUE_BRANCH_CARRIER'),
    branchContextOnlyCount: countStatus(rows, 'BRANCH_CONTEXT_ONLY'),
    ambiguousCarrierCount: countStatus(rows, 'AMBIGUOUS_CARRIER_OBJECT'),
    unresolvedCarrierCount: rows.filter((row) => row.resolutionStatus.startsWith('UNRESOLVED_')).length,
  };
}

function countStatus(rows, status) {
  return rows.filter((row) => row.resolutionStatus === status).length;
}

function groupByBranch(carriers) {
  const map = new Map();
  for (const carrier of carriers || []) {
    const key = token(carrier.lineContext?.branchNode);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(carrier);
  }
  return map;
}

function indexRows(rows, key) {
  const map = new Map();
  for (const row of rows || []) {
    const id = token(row[key]);
    if (!id) continue;
    if (!map.has(id)) map.set(id, []);
    map.get(id).push(row);
  }
  return map;
}

function supportFamilyRoot(memberId) {
  return normalizeCarrierId(memberId).replace(/(?:\/DATUM|\/SREF|\.\d+)$/iu, '');
}

function token(value) {
  return cleanText(value).replace(/\(REF\)$/iu, '').toUpperCase();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}
