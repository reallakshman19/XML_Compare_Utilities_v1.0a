export const XML_CII_BRANCH_IDENTITY_SCHEMA = 'xml-cii-branch-identity/v1';

function text(value) { return String(value ?? '').trim(); }
function decodeEntities(value) {
  return text(value)
    .replace(/&quot;/gi, '"')
    .replace(/&#34;/g, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/gi, '&');
}
function normalizeBranchText(value) {
  return decodeEntities(value)
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\\"/g, '"')
    .replace(/^\s*=\s*/, '')
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/\s+/g, '')
    .replace(/^\/*/, '/')
    .replace(/\/+$/, '')
    .replace(/\/B0*(\d+)$/i, (_, number) => `/B${Number(number)}`)
    .toUpperCase();
}
export function canonicalizeXmlCiiBranch(value) {
  const originalName = text(value);
  const normalizedFullName = normalizeBranchText(originalName);
  const suffixMatch = normalizedFullName.match(/\/(B(\d+))$/i);
  const branchSuffix = suffixMatch?.[1]?.toUpperCase() || '';
  const branchNumber = suffixMatch ? Number(suffixMatch[2]) : null;
  const normalizedRootName = suffixMatch
    ? normalizedFullName.slice(0, -suffixMatch[0].length)
    : normalizedFullName;
  return Object.freeze({
    schema: XML_CII_BRANCH_IDENTITY_SCHEMA,
    originalName,
    normalizedFullName,
    normalizedRootName,
    branchSuffix,
    branchNumber,
  });
}
export function compareXmlCiiBranches(leftValue, rightValue, context = {}) {
  const left = canonicalizeXmlCiiBranch(leftValue);
  const right = canonicalizeXmlCiiBranch(rightValue);
  if (!left.normalizedFullName || !right.normalizedFullName) {
    return Object.freeze({ left, right, relationship: 'MISSING_BRANCH', rank: 0, autoApply: false });
  }
  if (left.normalizedFullName === right.normalizedFullName) {
    return Object.freeze({ left, right, relationship: 'EXACT_FULL', rank: 100, autoApply: true });
  }
  if (left.normalizedRootName && left.normalizedRootName === right.normalizedRootName) {
    const oneParent = !left.branchSuffix || !right.branchSuffix;
    if (oneParent) {
      return Object.freeze({
        left,
        right,
        relationship: 'SAME_ROOT_PARENT_CHILD',
        rank: 95,
        autoApply: true,
      });
    }
    if (left.branchNumber === right.branchNumber) {
      return Object.freeze({
        left,
        right,
        relationship: 'SAME_ROOT_NORMALIZED',
        rank: 92,
        autoApply: true,
      });
    }
    return Object.freeze({
      left,
      right,
      relationship: 'SIBLING_BRANCH_REJECT',
      rank: 0,
      autoApply: false,
    });
  }
  const boreAgreement = context.boreAgreement === true;
  const typeAgreement = context.typeAgreement === true;
  if (boreAgreement && typeAgreement && left.normalizedRootName && right.normalizedRootName) {
    return Object.freeze({
      left,
      right,
      relationship: 'FUZZY_REVIEW_ONLY',
      rank: 40,
      autoApply: false,
    });
  }
  return Object.freeze({ left, right, relationship: 'NO_MATCH', rank: 0, autoApply: false });
}
export function xmlCiiBranchScopeCompatible(leftValue, rightValue) {
  return compareXmlCiiBranches(leftValue, rightValue).autoApply === true;
}
export function xmlCiiBranchRelationshipRank(leftValue, rightValue) {
  return compareXmlCiiBranches(leftValue, rightValue).rank;
}
export const _test = Object.freeze({ normalizeBranchText });
