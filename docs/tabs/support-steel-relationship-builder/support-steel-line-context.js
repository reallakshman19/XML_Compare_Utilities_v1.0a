import { cleanText } from './support-steel-source-utils.js';

export const SUPPORT_STEEL_LINE_CONTEXT_SCHEMA = 'SupportSteelLineContext.v1';

const BRANCH_TYPES = new Set(['BRANCH', 'PIPE_BRANCH', 'PIPING_BRANCH', 'BRAN']);
const PIPE_TYPES = new Set(['PIPE', 'BRANCH', 'PIPE_BRANCH', 'PIPING_BRANCH', 'TUBE']);
const BRANCH_SUFFIX = /\/B(?:RANCH)?[-_A-Z0-9.]*$/iu;
const BRANCH_ID_PATTERN = /\/(?:B|BRANCH)[-_A-Z0-9.]+$/iu;
const LINE_KEYS = Object.freeze([
  'FULL_LINE_TAG', 'FULLLINETAG', 'LINE_TAG', 'LINETAG',
  'LINE_NO', 'LINENO', 'PIPELINE', 'PIPE_LINE',
]);
const FAMILY_KEYS = Object.freeze(['LINE_FAMILY', 'LINEFAMILY']);
const BRANCH_KEYS = Object.freeze(['BRANCH_NODE', 'BRANCH_ID', 'BRANCH', 'PIPE_BRANCH']);
const CARRIER_KEYS = Object.freeze(['CARRIER_ID', 'CARRIER_REF', 'PIPE_REF']);
const PIPE_OWNER_KEYS = Object.freeze(['PIPE_OWNER', 'PIPEOWNER', 'PIPE_ID', 'PIPEID']);

export function resolveSupportLineContext(row, attrs = {}) {
  const ancestors = Array.isArray(row?.ancestors) ? row.ancestors : [];
  const branch = resolveBranch(row, attrs, ancestors);
  const explicitFullLineTag = firstValue(attrs, LINE_KEYS) || nearestAncestorValue(ancestors, 'fullLineTag');
  const explicitLineFamily = firstValue(attrs, FAMILY_KEYS) || nearestAncestorValue(ancestors, 'lineFamily');
  const fullLineTag = normalizeLineTag(explicitFullLineTag || deriveLineTag(branch.value));
  const lineFamily = normalizeLineTag(explicitLineFamily || fullLineTag);
  const carrier = resolveCarrier(attrs, ancestors);
  const pipeOwner = resolvePipeOwner(row, attrs, ancestors, branch);
  const evidence = unique([
    branch.basis,
    explicitFullLineTag ? 'EXPLICIT_FULL_LINE_TAG' : fullLineTag ? 'DERIVED_FULL_LINE_TAG' : '',
    explicitLineFamily ? 'EXPLICIT_LINE_FAMILY' : lineFamily ? 'DERIVED_LINE_FAMILY' : '',
    carrier.basis,
    pipeOwner.basis,
  ]);
  return {
    schema: SUPPORT_STEEL_LINE_CONTEXT_SCHEMA,
    branchNode: branch.value || null,
    branchSource: branch.basis || null,
    fullLineTag: fullLineTag || null,
    lineFamily: lineFamily || null,
    pipeOwner: pipeOwner.value || null,
    carrierId: carrier.value || null,
    contextQuality: contextQuality(branch.basis, explicitFullLineTag, explicitLineFamily),
    contextEvidence: evidence,
    ownerFallbackUsed: branch.basis === 'OWNER_FALLBACK' || pipeOwner.basis === 'OWNER_FALLBACK',
  };
}

export function summarizeSupportFamilyLineContext(members = []) {
  const contexts = members.map((member) => member.lineContext).filter(Boolean);
  const branchNodes = unique(contexts.map((row) => row.branchNode));
  const fullLineTags = unique(contexts.map((row) => row.fullLineTag));
  const lineFamilies = unique(contexts.map((row) => row.lineFamily));
  const pipeOwners = unique(contexts.map((row) => row.pipeOwner));
  const carrierIds = unique(contexts.map((row) => row.carrierId));
  const primary = selectPrimaryContext(contexts);
  const conflicts = [];
  if (fullLineTags.length > 1) conflicts.push('MULTIPLE_FULL_LINE_TAGS');
  if (lineFamilies.length > 1) conflicts.push('MULTIPLE_LINE_FAMILIES');
  if (branchNodes.length > 1) conflicts.push('MULTIPLE_BRANCH_NODES');
  return {
    schema: SUPPORT_STEEL_LINE_CONTEXT_SCHEMA,
    branchNode: primary?.branchNode || branchNodes[0] || null,
    branchNodes,
    fullLineTag: primary?.fullLineTag || fullLineTags[0] || null,
    fullLineTags,
    lineFamily: primary?.lineFamily || lineFamilies[0] || null,
    lineFamilies,
    pipeOwner: primary?.pipeOwner || pipeOwners[0] || null,
    pipeOwners,
    carrierId: primary?.carrierId || carrierIds[0] || null,
    carrierIds,
    contextQuality: primary?.contextQuality || 'NONE',
    contextEvidence: unique(contexts.flatMap((row) => row.contextEvidence || [])),
    ownerFallbackUsed: contexts.some((row) => row.ownerFallbackUsed),
    contextConflicts: conflicts,
    contextComplete: Boolean(
      (primary?.branchNode || branchNodes[0])
      && (primary?.fullLineTag || fullLineTags[0])
      && (primary?.lineFamily || lineFamilies[0]),
    ),
  };
}

function resolveBranch(row, attrs, ancestors) {
  const explicit = firstValue(attrs, BRANCH_KEYS);
  if (explicit) return evidenceValue(explicit, 'EXPLICIT_BRANCH_ATTRIBUTE');
  for (let index = ancestors.length - 1; index >= 0; index -= 1) {
    const ancestor = ancestors[index];
    if (ancestor.branchId) return evidenceValue(ancestor.branchId, 'ANCESTOR_BRANCH_ATTRIBUTE');
    if (BRANCH_TYPES.has(cleanText(ancestor.type).toUpperCase()) && ancestor.identity) {
      return evidenceValue(ancestor.identity, 'TYPED_BRANCH_ANCESTOR');
    }
    if (looksLikeBranch(ancestor.identity)) {
      return evidenceValue(ancestor.identity, 'BRANCH_IDENTITY_ANCESTOR');
    }
  }
  const owner = cleanText(attrs.OWNER || row?.owner);
  return owner ? evidenceValue(owner, 'OWNER_FALLBACK') : evidenceValue('', '');
}

function resolveCarrier(attrs, ancestors) {
  const explicit = firstValue(attrs, CARRIER_KEYS);
  if (explicit) return evidenceValue(explicit, 'EXPLICIT_CARRIER_REFERENCE');
  const ancestorCarrier = nearestAncestorValue(ancestors, 'carrierId');
  if (ancestorCarrier) return evidenceValue(ancestorCarrier, 'ANCESTOR_CARRIER_REFERENCE');
  for (let index = ancestors.length - 1; index >= 0; index -= 1) {
    const ancestor = ancestors[index];
    if (PIPE_TYPES.has(cleanText(ancestor.type).toUpperCase()) && ancestor.identity) {
      return evidenceValue(ancestor.identity, 'TYPED_PIPE_ANCESTOR');
    }
  }
  return evidenceValue('', '');
}

function resolvePipeOwner(row, attrs, ancestors, branch) {
  const explicit = firstValue(attrs, PIPE_OWNER_KEYS);
  if (explicit) return evidenceValue(explicit, 'EXPLICIT_PIPE_OWNER');
  for (let index = ancestors.length - 1; index >= 0; index -= 1) {
    const ancestor = ancestors[index];
    if (PIPE_TYPES.has(cleanText(ancestor.type).toUpperCase()) && ancestor.identity) {
      return evidenceValue(ancestor.identity, 'TYPED_PIPE_ANCESTOR');
    }
  }
  if (branch.value && branch.basis !== 'OWNER_FALLBACK') {
    return evidenceValue(branch.value, 'BRANCH_AS_PIPE_OWNER');
  }
  const owner = cleanText(attrs.OWNER || row?.owner);
  return owner ? evidenceValue(owner, 'OWNER_FALLBACK') : evidenceValue('', '');
}

function deriveLineTag(branchNode) {
  const text = cleanText(branchNode);
  if (!text) return '';
  return text.replace(BRANCH_SUFFIX, '').replace(/^\//u, '');
}

function normalizeLineTag(value) {
  return cleanText(value).replace(/^\//u, '');
}

function looksLikeBranch(value) {
  const text = cleanText(value);
  return BRANCH_ID_PATTERN.test(text) || BRANCH_SUFFIX.test(text);
}

function firstValue(attrs, keys) {
  for (const key of keys) {
    const value = cleanText(attrs?.[key]);
    if (value) return value;
  }
  return '';
}

function nearestAncestorValue(ancestors, key) {
  for (let index = ancestors.length - 1; index >= 0; index -= 1) {
    const value = cleanText(ancestors[index]?.[key]);
    if (value) return value;
  }
  return '';
}

function contextQuality(branchBasis, explicitLineTag, explicitLineFamily) {
  if (!branchBasis) return 'NONE';
  if (branchBasis === 'OWNER_FALLBACK') return 'LOW';
  if (explicitLineTag && explicitLineFamily) return 'HIGH';
  return 'MEDIUM';
}

function selectPrimaryContext(contexts) {
  return [...contexts].sort((left, right) => qualityRank(left.contextQuality) - qualityRank(right.contextQuality))[0] || null;
}

function qualityRank(value) {
  return ({ HIGH: 0, MEDIUM: 1, LOW: 2, NONE: 3 })[value] ?? 4;
}

function evidenceValue(value, basis) {
  return { value: cleanText(value), basis };
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}
