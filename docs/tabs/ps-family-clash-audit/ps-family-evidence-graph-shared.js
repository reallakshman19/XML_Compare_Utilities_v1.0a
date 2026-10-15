import { uniqueSorted } from './ps-family-token-utils.js';

export const PS_FAMILY_EVIDENCE_MODE = 'RELATIONSHIP_BUNDLE';
export const PS_FAMILY_EVIDENCE_SOURCE_SCHEMA = 'SupportSteelRelationshipBundle.v1';
export const SYMBOLIC_SUPPORT_ROLES = new Set(['DATUM', 'STRUCTURAL_REFERENCE']);

export function evidenceId(row) {
  return row?.evidenceId || row?.edgeId || row?.relationshipId || '';
}

export function normalizeMemberKey(value) {
  return String(value || '').trim().toUpperCase().replace(/\(REF\)$/u, '');
}

export function filterEvidenceFamilies(families, sourceFamily) {
  const token = normalizeMemberKey(sourceFamily);
  if (!token) return families;
  return families.filter((family) => normalizeMemberKey(family.familyId) === token);
}

export function detectedEvidenceSourceFamily(families, config) {
  if (config.sourceFamily) return config.sourceFamily;
  if (families.length === 1) return families[0].familyId;
  return families.length ? 'MULTIPLE_SUPPORT_FAMILIES' : '';
}

export function resolveEvidenceConfig(config = {}) {
  return { sourceFamily: String(config.sourceFamily || '').trim().toUpperCase() };
}

export function deriveEvidenceFamilyContext(family) {
  const normalized = family?.lineContext || {};
  const branchNodes = uniqueSorted(normalized.branchNodes || family?.branchIds || []);
  const fullLineTags = uniqueSorted(normalized.fullLineTags || family?.fullLineTags || []);
  const lineFamilies = uniqueSorted(normalized.lineFamilies || family?.lineFamilies || []);
  const carrierIds = uniqueSorted(normalized.carrierIds || family?.carrierIds || []);
  const attributes = (family?.members || []).map((member) => member.attributes || {});
  const branchNode = text(normalized.branchNode || family?.branchId || branchNodes[0]);
  const explicitFullLineTag = firstAttribute(attributes, [
    'FULL_LINE_TAG', 'FULLLINETAG', 'LINE_TAG', 'LINETAG', 'LINE_NO', 'LINENO',
  ]);
  const derivedTag = branchNode.replace(/^\//u, '').replace(/\/B[^/]*$/iu, '');
  const fullLineTag = text(
    normalized.fullLineTag || family?.fullLineTag || fullLineTags[0] || explicitFullLineTag || derivedTag,
  );
  const explicitLineFamily = firstAttribute(attributes, ['LINE_FAMILY', 'LINEFAMILY']);
  const lineFamily = text(
    normalized.lineFamily || family?.lineFamily || lineFamilies[0] || explicitLineFamily || fullLineTag,
  );
  return {
    branchNode,
    branchNodes: branchNodes.length ? branchNodes : [branchNode].filter(Boolean),
    fullLineTag,
    fullLineTags: fullLineTags.length ? fullLineTags : [fullLineTag].filter(Boolean),
    lineFamily,
    lineFamilies: lineFamilies.length ? lineFamilies : [lineFamily].filter(Boolean),
    pipeOwner: text(normalized.pipeOwner || family?.pipeOwner),
    pipeOwners: uniqueSorted(normalized.pipeOwners || family?.pipeOwners || []),
    carrierIds,
    contextQuality: text(normalized.contextQuality || 'NONE').toUpperCase(),
    contextEvidence: uniqueSorted(normalized.contextEvidence || []),
    ownerFallbackUsed: Boolean(normalized.ownerFallbackUsed),
    contextConflicts: uniqueSorted(normalized.contextConflicts || []),
    contextComplete: normalized.contextComplete !== false && Boolean(branchNode && lineFamily),
  };
}

export function createEvidenceSupportGroup(lineFamily, familyId) {
  const line = String(lineFamily || 'NO_LINE').replace(/^\//u, '').replace(/[\s/]+/gu, '_');
  const family = String(familyId || 'UNKNOWN_FAMILY').replace(/^\//u, '');
  return `${line}_${family}`;
}

export function representativeEvidenceSupport(family) {
  return (family.members || []).find((member) => member.semanticRole === 'DATUM')?.memberId
    || (family.members || []).find((member) => !SYMBOLIC_SUPPORT_ROLES.has(member.semanticRole))?.memberId
    || family.members?.[0]?.memberId
    || family.familyId;
}

export function formatEvidencePoint(value) {
  return value ? `X=${value.x ?? ''};Y=${value.y ?? ''};Z=${value.z ?? ''}` : '';
}

export function evidenceDiagnostic(level, code, message) {
  return { level, code, message };
}

export function normalizeEvidenceDiagnostics(rows = []) {
  return rows.map((row) => {
    const rawLevel = String(row.level || row.severity || 'INFO').toUpperCase();
    return {
      level: rawLevel === 'WARNING' ? 'WARN' : rawLevel,
      code: row.code || 'SOURCE_DIAGNOSTIC',
      message: row.message || '',
      supportFamilyId: row.supportFamilyId || '',
    };
  });
}

export function evidenceBundleDiagnostics(bundle) {
  const diagnostics = [];
  if (!bundle.supportFamilies.length) {
    diagnostics.push(evidenceDiagnostic('ERROR', 'EMPTY_SUPPORT_FAMILY_GRAPH', 'The relationship bundle contains no support families.'));
  }
  if (!bundle.relationships.length) {
    diagnostics.push(evidenceDiagnostic('ERROR', 'EMPTY_SUPPORT_STEEL_RELATIONSHIPS', 'The relationship bundle contains no support-to-steel relationship rows.'));
  }
  if (!bundle.supportMemberChain) {
    diagnostics.push(evidenceDiagnostic('ERROR', 'MISSING_SUPPORT_MEMBER_CHAIN', 'SupportMemberChainBundle.v1 is required for graph-native audit completeness.'));
  }
  if (bundle.contactEvidenceAvailable === true) {
    diagnostics.push(evidenceDiagnostic('INFO', 'SOURCE_CONTACT_EVIDENCE_AVAILABLE', 'The source bundle declares contact evidence available.'));
  }
  return diagnostics;
}

function firstAttribute(rows, keys) {
  for (const row of rows) {
    for (const key of keys) {
      if (String(row[key] || '').trim()) return String(row[key]).trim();
    }
  }
  return '';
}

function text(value) {
  return String(value ?? '').trim();
}
