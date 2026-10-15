import {
  SUPPORT_STEEL_DEFAULT_CONFIG,
  compileIdentityPattern,
  resolveSupportSteelConfig,
} from './support-steel-relationship-contracts.js';
import {
  buildStructuralAnalyticalMember,
  summarizeSteelAnalyticalGeometry,
} from './support-steel-analytical-geometry.js';
import { buildSupportMemberAnalyticalGeometry } from './support-member-analytical-geometry.js';
import {
  SUPPORT_STEEL_LINE_CONTEXT_SCHEMA,
  resolveSupportLineContext,
  summarizeSupportFamilyLineContext,
} from './support-steel-line-context.js';
import { transformPoint } from './support-steel-world-matrix.js';
import {
  byId,
  cleanText,
  cloneJson,
  deriveIdentityRoot,
  normalizeIdentity,
  normalizeReference,
  readPosition,
  sourceAttributes,
  sourceIdentity,
  sourceType,
  uniquePoints,
  walkSupportSteelHierarchy,
} from './support-steel-source-utils.js';

const SUPPORT_MEMBER_SUFFIX = /(?:\/DATUM|\/SREF|\.\d+)$/iu;
const SUPPORT_ROLE_TEXT = /\b(?:DATUM|SREF|SUPPORT|PIPE\s*SHOE|WEAR\s*PLATE|W\.?\s*PAD|GUIDE|LINE\s*STOP|CLAMP|SPRING|ANCHOR|BRACKET|ATTA|ANCI)\b/iu;
const STRUCTURE_TEXT = /\b(?:STEEL|STRUCTURE|STRUCTURAL|FRAME|FRMW|SCTN)\b/iu;
const BASE_SUPPORT_TYPES = new Set(['ATTA', 'ANCI', 'SUPPORT']);

export function collectSupportFamilies(source, overrides = {}) {
  const config = resolveSupportSteelConfig(overrides);
  if (source?.schema === 'PipeSupportProjectionBundle.v1') {
    return collectProjectionBundleFamilies(source, config);
  }
  const supportPattern = compileIdentityPattern(
    config.supportFamilyPattern,
    SUPPORT_STEEL_DEFAULT_CONFIG.supportFamilyPattern,
  );
  const supportTypes = new Set(config.supportTypes);
  const groups = new Map();
  for (const row of walkSupportSteelHierarchy(source)) {
    const attrs = sourceAttributes(row.node);
    const memberId = sourceIdentity(row.node, attrs);
    if (!isSupportRecord(row.node, attrs, memberId, supportTypes)) continue;
    const familyId = deriveIdentityRoot(memberId, supportPattern, SUPPORT_MEMBER_SUFFIX);
    if (familyId) addSupportMember(groups, familyId, row, attrs, memberId, config);
  }
  return [...groups.values()].map(finalizeSupportFamily).sort(byId('familyId'));
}

export function collectSteelGroups(source, overrides = {}) {
  const config = resolveSupportSteelConfig(overrides);
  const steelPattern = compileIdentityPattern(
    config.steelGroupPattern,
    SUPPORT_STEEL_DEFAULT_CONFIG.steelGroupPattern,
  );
  const steelTypes = new Set(config.steelTypes);
  const groups = new Map();
  for (const row of walkSupportSteelHierarchy(source)) {
    const attrs = sourceAttributes(row.node);
    const identity = sourceIdentity(row.node, attrs);
    if (!isSteelRecord(row.node, attrs, identity, steelTypes)) continue;
    const steelGroupId = deriveIdentityRoot(identity, steelPattern) || normalizeIdentity(identity);
    if (steelGroupId) addSteelRecord(groups, steelGroupId, row, attrs, config);
  }
  return [...groups.values()].map(finalizeSteelGroup).sort(byId('steelGroupId'));
}

function isSupportRecord(node, attrs, identity, supportTypes) {
  const type = sourceType(node, attrs);
  if (supportTypes.has(type)) return true;
  const text = [identity, attrs.DTXR, attrs.CMPSUPTYPE, attrs.SUPPORT_TAG, type].join(' ');
  return SUPPORT_MEMBER_SUFFIX.test(identity) || SUPPORT_ROLE_TEXT.test(text);
}

function isSteelRecord(node, attrs, identity, steelTypes) {
  const type = sourceType(node, attrs);
  const support = isSupportRecord(node, attrs, identity, BASE_SUPPORT_TYPES);
  if (support || SUPPORT_MEMBER_SUFFIX.test(identity)) return false;
  const text = [identity, attrs.DTXR, attrs.DESCRIPTION, attrs.CLASS, attrs.CATEGORY, type].join(' ');
  const structuralClassEvidence = STRUCTURE_TEXT.test(text);
  if (type === 'GROUP') return steelTypes.has(type) && structuralClassEvidence;
  if (steelTypes.has(type)) return true;
  return structuralClassEvidence;
}

function addSupportMember(groups, familyId, row, attrs, memberId, config) {
  if (!groups.has(familyId)) groups.set(familyId, createSupportFamily(familyId));
  const group = groups.get(familyId);
  const position = supportPositionGlobal(row, attrs, config.supportPositionKeys);
  const lineContext = resolveSupportLineContext(row, attrs);
  const branchId = lineContext.branchNode || cleanText(row.owner);
  const carrierId = lineContext.carrierId || cleanText(attrs.CARRIER_ID || attrs.CARRIER_REF || attrs.PIPE_REF);
  const references = readReferences(attrs, config.explicitSteelReferenceKeys);
  const member = createSupportMember(
    row,
    attrs,
    memberId,
    branchId,
    position,
    lineContext,
    config,
  );
  group.members.push(member);
  if (position) group.positions.push(position);
  if (branchId) group.branchIds.add(branchId);
  if (carrierId) group.carrierIds.add(carrierId);
  references.forEach((value) => group.explicitReferences.add(value));
}

function createSupportMember(row, attrs, memberId, branchId, position, lineContext, config) {
  const member = {
    memberId: memberId || null,
    sourceRecordType: sourceType(row.node, attrs),
    semanticRole: supportMemberRole(memberId, attrs),
    sourcePath: row.path,
    sourceParentBranch: branchId || null,
    positionGlobal: position,
    lineContext,
    worldMatrix: [...(row.worldMatrix || [])],
    transformBasis: row.transformBasis || 'IDENTITY',
    attributes: cloneJson(attrs),
  };
  member.analyticalGeometry = buildSupportMemberAnalyticalGeometry(member, config);
  return member;
}

function addSteelRecord(groups, steelGroupId, row, attrs, config) {
  if (!groups.has(steelGroupId)) groups.set(steelGroupId, createSteelGroup(steelGroupId));
  const group = groups.get(steelGroupId);
  const position = readPosition(attrs, config.steelPositionKeys);
  const owner = firstEvidenceValue(attrs, config.ownerEvidenceKeys) || cleanText(row.owner);
  const analyticalGeometry = buildStructuralAnalyticalMember(row, attrs, config);
  group.records.push({
    recordId: sourceIdentity(row.node, attrs) || null,
    sourceRecordType: sourceType(row.node, attrs),
    sourcePath: row.path,
    owner: owner || null,
    positionGlobal: position,
    analyticalGeometry,
    attributes: cloneJson(attrs),
  });
  if (position) group.positions.push(position);
  if (owner) group.owners.add(owner);
}

function collectProjectionBundleFamilies(bundle, config) {
  const groups = new Map();
  for (const carrier of bundle.carriers || []) {
    for (const family of carrier.supportFamilies || []) {
      if (!groups.has(family.familyId)) groups.set(family.familyId, createSupportFamily(family.familyId));
      mergeProjectionFamily(groups.get(family.familyId), family, carrier, bundle, config);
    }
  }
  return [...groups.values()].map(finalizeSupportFamily).sort(byId('familyId'));
}

function mergeProjectionFamily(group, family, carrier, bundle, config) {
  const position = family.position?.supportPosGlobal || family.position?.centerlinePointGlobal || null;
  const lineContext = projectionLineContext(bundle, carrier);
  if (position) group.positions.push(position);
  if (lineContext.branchNode) group.branchIds.add(lineContext.branchNode);
  if (lineContext.carrierId) group.carrierIds.add(lineContext.carrierId);
  for (const sourceMember of cloneJson(family.members || [])) {
    const member = {
      ...sourceMember,
      positionGlobal: sourceMember.positionGlobal || sourceMember.sourcePositionGlobal || position,
      worldMatrix: sourceMember.worldMatrix || null,
      transformBasis: sourceMember.transformBasis || 'IDENTITY',
      lineContext: sourceMember.lineContext || lineContext,
    };
    member.analyticalGeometry = sourceMember.analyticalGeometry
      || buildSupportMemberAnalyticalGeometry(member, config);
    group.members.push(member);
  }
  collectFamilyReferences(family, config.explicitSteelReferenceKeys)
    .forEach((value) => group.explicitReferences.add(value));
}

function projectionLineContext(bundle, carrier) {
  const branchNode = cleanText(bundle.branchId);
  const fullLineTag = cleanText(bundle.fullLineTag || bundle.lineTag)
    || branchNode.replace(/^\//u, '').replace(/\/B(?:RANCH)?[-_A-Z0-9.]*$/iu, '');
  return {
    schema: SUPPORT_STEEL_LINE_CONTEXT_SCHEMA,
    branchNode: branchNode || null,
    branchSource: branchNode ? 'PROJECTION_BUNDLE_BRANCH' : null,
    fullLineTag: fullLineTag || null,
    lineFamily: cleanText(bundle.lineFamily) || fullLineTag || null,
    pipeOwner: branchNode || null,
    carrierId: cleanText(carrier.carrierId) || null,
    contextQuality: branchNode ? 'HIGH' : 'NONE',
    contextEvidence: branchNode ? ['PROJECTION_BUNDLE_BRANCH'] : [],
    ownerFallbackUsed: false,
  };
}

function createSupportFamily(familyId) {
  return {
    familyId,
    members: [],
    positions: [],
    branchIds: new Set(),
    carrierIds: new Set(),
    explicitReferences: new Set(),
  };
}

function createSteelGroup(steelGroupId) {
  return { steelGroupId, records: [], positions: [], owners: new Set() };
}

function finalizeSupportFamily(group) {
  const datum = group.members.find((member) => member.semanticRole === 'DATUM');
  const lineContext = summarizeSupportFamilyLineContext(group.members);
  return {
    familyId: group.familyId,
    supportPositionGlobal: datum?.positionGlobal || group.positions[0] || null,
    positions: uniquePoints(group.positions),
    branchId: lineContext.branchNode,
    branchIds: lineContext.branchNodes.length ? lineContext.branchNodes : [...group.branchIds].sort(),
    fullLineTag: lineContext.fullLineTag,
    fullLineTags: lineContext.fullLineTags,
    lineFamily: lineContext.lineFamily,
    lineFamilies: lineContext.lineFamilies,
    pipeOwner: lineContext.pipeOwner,
    pipeOwners: lineContext.pipeOwners,
    carrierIds: lineContext.carrierIds.length ? lineContext.carrierIds : [...group.carrierIds].sort(),
    lineContext,
    explicitReferences: [...group.explicitReferences].sort(),
    analyticalMemberCount: group.members.filter(
      (member) => member.analyticalGeometry?.physicalGeometryAvailable,
    ).length,
    members: group.members,
  };
}

function finalizeSteelGroup(group) {
  const analyticalGeometry = summarizeSteelAnalyticalGeometry(group.records);
  const steelPositionGlobal = group.positions[0]
    || analyticalGeometry.worldAabb && boundsCenter(analyticalGeometry.worldAabb)
    || null;
  return {
    steelGroupId: group.steelGroupId,
    steelPositionGlobal,
    positions: uniquePoints(group.positions),
    owners: [...group.owners].sort(),
    analyticalGeometry,
    records: group.records,
  };
}

function supportMemberRole(memberId, attrs) {
  const id = cleanText(memberId).toUpperCase();
  const text = [id, attrs.DTXR, attrs.CMPSUPTYPE, attrs.MDSSUPPTYPE, attrs.DESCRIPTION]
    .join(' ')
    .toUpperCase();
  if (/\/DATUM$/u.test(id)) return 'DATUM';
  if (/\/SREF$/u.test(id)) return 'STRUCTURAL_REFERENCE';
  if (/WEAR\s*PLATE|W\.?\s*PAD/u.test(text)) return 'WEAR_PLATE';
  if (/PIPE\s*SHOE|\bSHOE\b|\bSH[-_ ]?\d+/u.test(text)) return 'PIPE_SHOE';
  if (/LINE\s*STOP|LINESTOP|AXIAL\s*STOP|\bSTOPPER\b/u.test(text)) return 'LINE_STOP_MEMBER';
  if (/\bGUIDE\b|GUIDE\s*PLATE/u.test(text)) return 'GUIDE_MEMBER';
  if (/\bCLAMP\b|U[- ]?BOLT/u.test(text)) return 'CLAMP_MEMBER';
  if (/\bSPRING\b|VARIABLE\s*SUPPORT|CONSTANT\s*SUPPORT/u.test(text)) return 'SPRING_MEMBER';
  if (/\bANCHOR\b|\bFIXED\b/u.test(text)) return 'ANCHOR_MEMBER';
  if (/BRACKET|CANTILEVER|TRUNNION|\bFRAME\b|\bPOST\b/u.test(text)) return 'BRACKET_MEMBER';
  return 'OTHER_FAMILY_MEMBER';
}

function supportPositionGlobal(row, attrs, keys) {
  const point = readPosition(attrs, keys);
  if (!point) return null;
  const coordinateSpace = cleanText(
    attrs.POSITION_COORDINATE_SPACE || attrs.GEOMETRY_COORDINATE_SPACE || attrs.COORDINATE_SPACE,
  ).toUpperCase();
  if (coordinateSpace === 'WORLD' || coordinateSpace === 'GLOBAL') return point;
  if (row.transformBasis && row.transformBasis !== 'IDENTITY' && row.worldMatrix?.length === 16) {
    return transformPoint(row.worldMatrix, point);
  }
  return point;
}

function readReferences(attrs, keys) {
  const values = [];
  for (const key of keys || []) {
    const value = cleanText(attrs?.[key]);
    if (value) values.push(normalizeReference(value));
  }
  return [...new Set(values.filter(Boolean))];
}

function collectFamilyReferences(family, keys) {
  const values = [];
  for (const member of family.members || []) {
    const attrs = member.attributes || {};
    for (const key of keys || []) {
      const value = cleanText(attrs[key]);
      if (value) values.push(normalizeReference(value));
    }
  }
  return [...new Set(values.filter(Boolean))];
}

function firstEvidenceValue(attrs, keys) {
  for (const key of keys || []) {
    const value = cleanText(attrs?.[key]);
    if (value) return value;
  }
  return '';
}

function boundsCenter(bounds) {
  return {
    x: (bounds.min.x + bounds.max.x) / 2,
    y: (bounds.min.y + bounds.max.y) / 2,
    z: (bounds.min.z + bounds.max.z) / 2,
  };
}
