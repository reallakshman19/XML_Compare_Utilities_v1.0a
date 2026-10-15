// Copied from 3D_Converters@ffbbafbb1757a84826b736731a8d75c43a2c3e9c.
// Adapted to use Sequential Sketcher's owned point and support-kind resolvers.
import {
  classifySupportKind,
  cleanText,
  cloneJson,
  clonePoint,
  finiteNumber,
  firstText,
  parsePoint,
  sequenceIndexFromPath,
  sourceAttributes,
  unique,
} from './sj-pipe-support-utils.js';

const SUPPORT_SOURCE_TYPES = new Set(['ATTA', 'SUPPORT', 'ANCI']);
const MEMBER_POSITION_KEYS = Object.freeze([
  'POS', 'SUPPORT_POS', 'SUPPORTPOS', 'SUPPORT_POSITION',
  'SUPPORTPOSITION', 'ATTACHMENT_POINT', 'ATTACHMENTPOINT',
  'APOS', 'LPOS', 'HPOS', 'TPOS', 'BPOS',
]);
const EXPLICIT_CARRIER_REFERENCE_KEYS = Object.freeze([
  'CARRIER_ID', 'CARRIERID', 'CARRIER_REF', 'CARRIERREF',
  'PIPE_REF', 'PIPEREF', 'PIPE_ID', 'PIPEID',
  'ATTACHED_TO', 'ATTACHEDTO', 'ATTACHED_COMPONENT_REF',
  'ATTACHEDCOMPONENTREF', 'COMPONENT_REF', 'COMPONENTREF',
  'PARENT_COMPONENT_REF', 'PARENTCOMPONENTREF',
]);

export function reconstructSupportFamilies(supportRecords, context = {}) {
  const diagnostics = context.diagnostics || [];
  const groups = new Map();

  supportRecords.forEach((record, sourceIndex) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) return;
    const attrs = sourceAttributes(record);
    const sourceRecordType = sourceType(record, attrs);
    const memberId = cleanText(attrs.NAME);

    if (isNonSemanticAttachmentPlaceholder(record, attrs, memberId)) {
      const sourceParentBranch = sourceBranch(record, attrs);
      const position = readSupportPosition(attrs);
      diagnostics.push({
        severity: 'INFO',
        code: 'NON_SEMANTIC_ATTACHMENT_EXCLUDED',
        memberId: memberId || null,
        sourceIndex,
        sourceRecordType,
        sourceParentBranch: sourceParentBranch || null,
        sourcePositionGlobal: position ? clonePoint(position) : null,
        attributes: cloneJson(attrs),
        message: 'Generic ATTA placeholder was retained as audit evidence and excluded from semantic support-family reconstruction.',
      });
      return;
    }

    const identity = deriveSupportFamilyIdentity(memberId, attrs, sourceIndex);
    if (!SUPPORT_SOURCE_TYPES.has(sourceRecordType) && !memberId && identity.familyIdBasis === 'UNRESOLVED') return;
    if (!memberId) diagnostics.push({
      severity: 'WARNING',
      code: 'SUPPORT_MEMBER_IDENTITY_MISSING',
      familyId: identity.familyId,
      sourceIndex,
      message: 'Support member has no attributes.NAME; fallback identity was retained for audit.',
    });

    const sourceParentBranch = sourceBranch(record, attrs);
    const position = readSupportPosition(attrs);
    const member = {
      memberId: memberId || null,
      memberIdentitySource: memberId ? 'attributes.NAME' : 'UNRESOLVED',
      semanticRole: classifySupportMemberRole({ memberId, attrs, record }),
      sourceRecordType,
      physicalGeometryAvailable: physicalGeometryAvailable(record, context.hasPhysicalGeometry),
      attributes: cloneJson(attrs),
      sourceEvidence: {
        sourceIndex,
        sourceSequenceIndex: finiteNumber(record.sourceSequenceIndex) ?? sequenceIndexFromPath(record.path),
        sourcePath: cloneJson(record.path ?? null),
        topLevelName: cleanText(record.name) || null,
        sourceParentBranch: sourceParentBranch || null,
        sourcePositionGlobal: position ? clonePoint(position) : null,
      },
    };

    if (!groups.has(identity.familyId)) groups.set(identity.familyId, {
      familyId: identity.familyId,
      familyIdBasis: identity.familyIdBasis,
      sourceParentBranches: new Set(),
      members: [],
      firstSourceIndex: sourceIndex,
    });
    const group = groups.get(identity.familyId);
    if (sourceParentBranch) group.sourceParentBranches.add(sourceParentBranch);
    group.members.push(member);
  });

  return [...groups.values()].map((group) => finalizeFamily(group, context, diagnostics));
}

export function isNonSemanticAttachmentPlaceholder(record = {}, attrs = sourceAttributes(record), memberId = cleanText(attrs?.NAME)) {
  const recordType = sourceType(record, attrs);
  if (recordType !== 'ATTA') return false;
  const identity = cleanText(memberId);
  if (!/^=\d+(?:\/\d+)?$/u.test(identity)) return false;

  const functionText = firstText(attrs, [
    'CMPSUPTYPE', 'MDSSUPPTYPE', 'SUPPORT_KIND', 'SUPPORT_MAPPER_KIND',
    'SUPPORT_TYPE', 'NODETYPE', 'FUNCTION',
  ]);
  const description = firstText(attrs, ['DTXR', 'DESCRIPTION', 'DESC', 'STEX']);
  const placeholderDescription = !description || /^-+$/u.test(description);
  if (functionText || !placeholderDescription) return false;

  const aliases = [attrs.REF, attrs.SUPPORT_TAG]
    .map(cleanText)
    .filter(Boolean);
  return aliases.length > 0 && aliases.every((value) => value === identity);
}

export function deriveSupportFamilyIdentity(memberId, attrs = {}, sourceIndex = 0) {
  const authoritative = cleanText(memberId);
  if (authoritative) {
    const firstSegment = authoritative.split('/').filter(Boolean)[0] || authoritative;
    const rootSegment = firstSegment.replace(/\.\d+$/u, '');
    return {
      familyId: rootSegment.startsWith('/') ? rootSegment : `/${rootSegment}`,
      familyIdBasis: 'DERIVED_FROM_ATTRIBUTES_NAME',
    };
  }

  const fallback = normalizeFallbackFamilyId(firstText(attrs, [
    'SUPPORT_TAG', 'CMPSUPREFN', 'STEX', 'MDSSUPREFN',
  ]));
  if (fallback) return { familyId: fallback, familyIdBasis: 'SUPPORT_TAG_FALLBACK' };
  return { familyId: `/UNRESOLVED-SUPPORT-${sourceIndex + 1}`, familyIdBasis: 'UNRESOLVED' };
}

export function classifySupportMemberRole({ memberId = '', attrs = {}, record = {} } = {}) {
  const id = cleanText(memberId).toUpperCase();
  const text = [
    id, attrs.CMPSUPTYPE, attrs.MDSSUPPTYPE, attrs.MDSCP3,
    attrs.DTXR, attrs.STEX, attrs.SUPPORT_TYPE, record.name,
  ].map(cleanText).join(' ').toUpperCase();

  if (/\/DATUM$/u.test(id) || /\bDATUM\b/u.test(text)) return 'DATUM';
  if (/\/SREF$/u.test(id) || /\bSTRUCTURAL\s+REFERENCE\b|\bSREF\b/u.test(text)) return 'STRUCTURAL_REFERENCE';
  if (/WEAR\s*PLATE|W\.?\s*PAD|\bPAD\b/u.test(text)) return 'WEAR_PLATE';
  if (/PIPE\s*SHOE|\bSHOE\b|\bSH[-_ ]?\d+/u.test(text)) return 'PIPE_SHOE';
  if (/LINE\s*STOP|LINESTOP|\bST06\b/u.test(text)) return 'LINE_STOP_MEMBER';
  if (/GUIDE|\bGT01\b/u.test(text)) return 'GUIDE_MEMBER';
  if (/SPRING|HANGER/u.test(text)) return 'SPRING_MEMBER';
  if (/ANCHOR|FIXED/u.test(text)) return 'ANCHOR_MEMBER';
  return 'OTHER_FAMILY_MEMBER';
}

export function readSupportPosition(attrs) {
  for (const key of MEMBER_POSITION_KEYS) {
    const point = parsePoint(attrs?.[key]);
    if (point) return point;
  }
  return null;
}

function finalizeFamily(group, context, diagnostics) {
  const sourceParentBranches = [...group.sourceParentBranches];
  const sourceParentBranch = sourceParentBranches.length === 1
    ? sourceParentBranches[0]
    : (sourceParentBranches.includes(context.branchId)
      ? context.branchId
      : sourceParentBranches[0] || context.branchId || '');

  if (sourceParentBranches.length > 1) diagnostics.push({
    severity: 'WARNING',
    code: 'SUPPORT_FAMILY_MULTIPLE_SOURCE_BRANCHES',
    familyId: group.familyId,
    message: `Family members reference multiple source branches: ${sourceParentBranches.join(', ')}`,
  });

  const representative = group.members.find((member) => (
    member.semanticRole === 'DATUM' && member.sourceEvidence.sourcePositionGlobal
  )) || group.members.find((member) => member.sourceEvidence.sourcePositionGlobal) || null;
  const supportPosGlobal = representative?.sourceEvidence?.sourcePositionGlobal || null;
  checkPositionDivergence(group.familyId, group.members, supportPosGlobal, diagnostics);

  return {
    familyId: group.familyId,
    familyIdBasis: group.familyIdBasis,
    sourceParentBranch,
    sourceParentBranches,
    supportPosGlobal: supportPosGlobal ? clonePoint(supportPosGlobal) : null,
    resolvedSupportKind: resolveFamilySupportKind(group.members),
    members: group.members,
    firstSourceIndex: group.firstSourceIndex,
    sourceSequenceIndex: familySequenceIndex(group.members),
    explicitCarrierReferences: familyCarrierReferences(group.members),
  };
}

function resolveFamilySupportKind(members) {
  const explicit = members.map((member) => firstText(member.attributes, [
    'SUPPORT_KIND', 'SUPPORT_MAPPER_KIND', 'SUPPORT_TYPE', 'NODETYPE',
  ])).find(Boolean);
  if (explicit) return classifySupportKind({ SUPPORT_KIND: explicit });
  const datum = members.find((member) => member.semanticRole === 'DATUM');
  if (datum) return classifySupportKind(datum.attributes);
  const nonReference = members.find((member) => member.semanticRole !== 'STRUCTURAL_REFERENCE');
  return classifySupportKind(nonReference?.attributes || members[0]?.attributes || {});
}

function familySequenceIndex(members) {
  const values = members
    .map((member) => finiteNumber(member.sourceEvidence.sourceSequenceIndex))
    .filter(Number.isFinite);
  return values.length ? Math.min(...values) : null;
}

function familyCarrierReferences(members) {
  const refs = [];
  for (const member of members) {
    for (const key of EXPLICIT_CARRIER_REFERENCE_KEYS) {
      const value = cleanText(member.attributes?.[key]);
      if (value) refs.push(value);
    }
  }
  return unique(refs);
}

function checkPositionDivergence(familyId, members, representative, diagnostics) {
  if (!representative) return;
  const divergent = members.filter((member) => {
    const point = member.sourceEvidence.sourcePositionGlobal;
    return point && Math.hypot(
      point.x - representative.x,
      point.y - representative.y,
      point.z - representative.z,
    ) > 1;
  });
  if (divergent.length) diagnostics.push({
    severity: 'WARNING',
    code: 'SUPPORT_FAMILY_MEMBER_POSITION_DIVERGENCE',
    familyId,
    memberIds: divergent.map((member) => member.memberId),
    message: 'Sibling positions differ by more than 1 mm; DATUM/first position was used.',
  });
}

function sourceType(record, attrs) {
  return cleanText(attrs.RAW_TYPE || attrs.TYPE || record.rawType || record.componentType || record.type).toUpperCase();
}

function sourceBranch(record, attrs) {
  return cleanText(
    record.sourceBranchName || record.sourceBranchId || record.branchName || record.branchId
    || attrs.OWNER_BRANCH || attrs.OWNERBRANCH || attrs.OWNER,
  );
}

function physicalGeometryAvailable(record, resolver) {
  if (typeof resolver === 'function') return Boolean(resolver(record));
  return Boolean(record.physicalGeometryAvailable || record.geometry?.primitive || record.primitives?.length);
}

function normalizeFallbackFamilyId(value) {
  let text = cleanText(value).replace(/\(REF\)/giu, '').replace(/\/SREF$/iu, '');
  if (!text) return '';
  if (text.includes('/')) text = text.split('/').filter(Boolean)[0] || text;
  text = text.replace(/\.\d+$/u, '').trim();
  return text ? (text.startsWith('/') ? text : `/${text}`) : '';
}
