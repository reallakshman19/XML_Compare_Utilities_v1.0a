export function supportReportMemberMatchesLine(member, fullLineTag) {
  const context = member?.lineContext || {};
  if (clean(context.fullLineTag)) return sameLine(context.fullLineTag, fullLineTag);
  return sameLine(lineFromBranch(context.branchNode || member?.sourceParentBranch), fullLineTag);
}

export function supportReportMemberMatchesBranches(member, group = {}) {
  const context = member?.lineContext || {};
  if (clean(context.fullLineTag) && !sameLine(context.fullLineTag, group.fullLineTag)) return false;
  const candidates = [context.branchNode, member?.sourceParentBranch].filter(Boolean).map(token);
  const branches = new Set((group.branchNodes || []).map(token));
  return candidates.some((candidate) => branches.has(candidate));
}

export function supportReportMemberContextConflicts(member, group = {}) {
  const context = member?.lineContext || {};
  const explicitLine = clean(context.fullLineTag);
  if (explicitLine && !sameLine(explicitLine, group.fullLineTag)) return true;
  const candidates = [context.branchNode, member?.sourceParentBranch].filter(Boolean).map(token);
  const branches = new Set((group.branchNodes || []).map(token));
  return !explicitLine && candidates.length > 0 && branches.size > 0
    && !candidates.some((candidate) => branches.has(candidate));
}

function sameLine(left, right) {
  const leftToken = token(lineFromBranch(left));
  return Boolean(leftToken) && leftToken === token(lineFromBranch(right));
}
function lineFromBranch(value) {
  return stripLeadingSlash(value).replace(/\/B(?:RANCH)?[-_A-Z0-9.]*$/iu, '');
}
function stripLeadingSlash(value) { return clean(value).replace(/^\/+/, ''); }
function token(value) { return stripLeadingSlash(value).replace(/\(REF\)$/iu, '').toUpperCase(); }
function clean(value) { return value == null ? '' : String(value).trim(); }

export const _test = Object.freeze({ lineFromBranch, sameLine });
